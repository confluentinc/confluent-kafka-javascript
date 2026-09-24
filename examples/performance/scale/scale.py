#!/usr/bin/env python3
"""Driver for the ckjs-perf-scale Helm chart.

Runs `helm upgrade --install` against the chart with a user-supplied values
file, then while the producer/consumer Jobs run it periodically (every
--copy-interval minutes) copies each pod's log + jsmetrics files into a single
run folder. Each pod's full console log is streamed straight to disk as
`{pod}-console.log` (never held in memory), and the per-component summary embeds
only the last --summary-tail-lines lines of each (via `tail`), parsing
`=== Producer Rate:  <number>` from that tail for an average + aggregate
throughput figure. Each copy is atomic (tmp file then replace) so a good
snapshot is never clobbered by a failed copy, and every round is preceded by a
`kubectl get jobs` to prime external re-authentication. When all main containers
finish it does one final copy, releases the log-keeper sidecars, and uninstalls.

With --resume <folder> it skips the install entirely and keeps collecting logs
from an already-deployed release in the current namespace, writing into that
existing logs/<ts> folder instead of creating a new one.
"""

import argparse
import datetime as dt
import os
import platform
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Map platform.machine() values to Kubernetes `kubernetes.io/arch` node-label
# values, so job pods can be pinned to nodes matching this host's architecture
# (the prebuilt image is single-arch).
_ARCH_MAP = {
    "x86_64": "amd64",
    "amd64": "amd64",
    "aarch64": "arm64",
    "arm64": "arm64",
}


def detect_node_arch():
    """Return the kubernetes.io/arch value matching the host running this
    script (e.g. amd64, arm64)."""
    machine = platform.machine().lower()
    return _ARCH_MAP.get(machine, machine)

PRODUCER_RATE_RE = re.compile(
    r"^=== Producer Rate:\s+([0-9]+(?:\.[0-9]+)?)", re.MULTILINE
)

CHART_DIR = Path(__file__).resolve().parent
LOGS_DIR = CHART_DIR / "logs"

# Files written by performance-primitives*.js into the pod's working directory.
# scale.py tries to `kubectl cp` each of these from the sidecar container every
# copy round.  Missing files are silently skipped (e.g. only
# confluent-producer.log is written for a producer-only run).
#
# jsmetrics-*.jsonl is written to an append-mode stream per sample (see
# startMetricsLogger in performance-primitives-common.js), dispatched to disk
# promptly, so a mid-run copy already reflects every sample written so far.
REMOTE_WORKDIR = "/workspace/repo/examples/performance"
LOG_FILES_TO_COPY = [
    "confluent-producer.log",
    "confluent-consumer-producer.log",
    "confluent-consumer-batch.log",
    "confluent-consumer-message.log",
    "kafkajs-producer.log",
    "kafkajs-consumer-producer.log",
    "kafkajs-consumer-batch.log",
    "kafkajs-consumer-message.log",
    # Periodic latency samples (JSON lines), one per run type so the producer
    # and the two consumer modes don't overwrite each other.
    "jsmetrics-producer.jsonl",
    "jsmetrics-consumer-batch.jsonl",
    "jsmetrics-consumer-message.jsonl",
]
SIDECAR_CONTAINER = "log-keeper"


def run(cmd, check=True, capture=False):
    """Thin wrapper around subprocess.run that streams or captures output."""
    print(f"$ {' '.join(cmd)}", flush=True)
    if capture:
        return subprocess.run(
            cmd, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
    return subprocess.run(cmd, check=check)


def helm_install(release, namespace, values_file, timeout_s, set_overrides):
    # No --wait / --wait-for-jobs: the producer Job never reaches "Complete"
    # until its log-keeper sidecar exits, and the sidecar only exits once
    # scale.py touches /workspace/.shutdown (release_sidecar) — which happens
    # *after* this returns.  Waiting on the Job here would deadlock until the
    # terminationGracePeriodSeconds elapses and the sidecar is SIGKILLed, by
    # which point its filesystem is gone and the logs can't be copied.
    #
    # helm still runs and waits for the pre-install create-topics hook Job
    # regardless of these flags, so topic setup still completes first.  We
    # discover the pods (wait_for_pods) and watch their main containers
    # (containers_terminated) ourselves while copying logs periodically.
    cmd = [
        "helm",
        "upgrade",
        "--install",
        release,
        str(CHART_DIR),
        "-f",
        str(values_file),
        "-n",
        namespace,
        "--create-namespace",
        "--timeout",
        f"{timeout_s}s",
    ]
    for kv in set_overrides:
        cmd.extend(["--set", kv])
    run(cmd)


def helm_uninstall(release, namespace):
    subprocess.run(
        ["helm", "uninstall", release, "-n", namespace],
        check=False,
    )


def kubectl_get_jobs(namespace):
    """Run `kubectl get jobs` to prime external re-authentication before a copy
    round. Some clusters use an auth plugin / proxy whose token expires during a
    long run; any kubectl call refreshes it, so we make a cheap one first so the
    subsequent `kubectl cp`/`logs` don't fail on an expired token. Best-effort —
    log and continue regardless of the result."""
    result = run(
        ["kubectl", "-n", namespace, "get", "jobs"],
        capture=True, check=False,
    )
    if result.returncode != 0:
        print(f"`kubectl get jobs` failed (continuing): {result.stderr.strip()}",
              file=sys.stderr)


def write_text_atomic(path, text):
    """Write `text` to `path` atomically: write a sibling .tmp then os.replace,
    so a reader (or an interrupted run) never sees a half-written file."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text)
    os.replace(tmp, path)


def job_exists(release, namespace, component):
    """Return True if the `{release}-{component}` Job exists (e.g. the optional
    consumer Job is only rendered when values.yaml has a consumer section)."""
    result = run(
        [
            "kubectl", "-n", namespace, "get", "job",
            f"{release}-{component}", "-o", "jsonpath={.metadata.name}",
        ],
        capture=True,
        check=False,
    )
    return bool(result.stdout.strip())


def list_pods(release, namespace, component):
    job_name = f"{release}-{component}"
    # Kubernetes >=1.27 sets batch.kubernetes.io/job-name; <1.27 sets job-name.
    # Try both selectors.
    for selector in (
        f"batch.kubernetes.io/job-name={job_name}",
        f"job-name={job_name}",
    ):
        result = run(
            [
                "kubectl",
                "-n",
                namespace,
                "get",
                "pods",
                "-l",
                selector,
                "-o",
                "jsonpath={.items[*].metadata.name}",
            ],
            capture=True,
        )
        names = result.stdout.split()
        if names:
            return names
    return []


def job_completions(release, namespace, component):
    """Read .spec.completions off the `{release}-{component}` Job (== expected
    pod count)."""
    result = run(
        [
            "kubectl", "-n", namespace, "get", "job",
            f"{release}-{component}", "-o", "jsonpath={.spec.completions}",
        ],
        capture=True,
        check=False,
    )
    try:
        return int(result.stdout.strip())
    except ValueError:
        return 0


def wait_for_pods(release, namespace, component, timeout_s, poll_s=5):
    """Wait until the `{release}-{component}` Job has spawned all its pods.

    helm_install no longer waits for the Job, so the pods may not exist yet
    when it returns.  Block until we see as many pods as the Job's
    .spec.completions (falling back to >=1 if completions is unknown), or the
    timeout elapses, then return whatever pods exist.
    """
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        expected = job_completions(release, namespace, component)
        pods = list_pods(release, namespace, component)
        if pods and (expected == 0 or len(pods) >= expected):
            return pods
        time.sleep(poll_s)
    return list_pods(release, namespace, component)


def containers_terminated(pods, namespace, container):
    """Return True if every pod in `pods` has its main `container`
    (producer/consumer) terminated. The log-keeper sidecar keeps the pod alive
    after the main container exits, so this can be true while the pod is still
    reachable for `kubectl cp`. One batched `kubectl get pods` query: the range
    emits one line per pod (the terminated reason, empty if still running)."""
    if not pods:
        return True
    result = run(
        [
            "kubectl", "-n", namespace, "get", "pods", *pods, "-o",
            'jsonpath={range .items[*]}'
            "{.status.containerStatuses[?(@.name=='" + container + "')]"
            ".state.terminated.reason}"
            '{"\\n"}{end}',
        ],
        capture=True,
        check=False,
    )
    if result.returncode != 0:
        return False
    reasons = [line for line in result.stdout.split("\n") if line.strip()]
    return len(reasons) >= len(pods)


def stream_pod_console_to_file(pod, namespace, dest_path):
    """Stream a pod's full console log (`kubectl logs --all-containers`) straight
    to `dest_path` on disk, never holding it in Python memory — kubectl's stdout
    is redirected to a file handle. Written atomically (sibling .tmp then
    os.replace) like atomic_copy_pod_logs, so a previous good console log is
    never clobbered by a failed/partial fetch. Returns dest_path if it exists
    afterwards (this round's fetch or a prior one), else None."""
    tmp = dest_path.with_name(f".{dest_path.name}.tmp")
    with open(tmp, "w") as fh:
        result = subprocess.run(
            ["kubectl", "-n", namespace, "logs", pod, "--all-containers=true"],
            stdout=fh, stderr=subprocess.PIPE, text=True, check=False,
        )
    if result.returncode == 0:
        os.replace(tmp, dest_path)  # atomic; keeps the old file until now
    else:
        # Leave the previous good console log in place; drop the partial tmp.
        tmp.unlink(missing_ok=True)
        print(
            f"kubectl logs failed for {pod}: {result.stderr.strip()}",
            file=sys.stderr,
        )
    return dest_path if dest_path.is_file() else None


def parse_rate(pod_log):
    """Return the last `=== Producer Rate:` value (MB/s) seen, or None."""
    matches = PRODUCER_RATE_RE.findall(pod_log)
    if not matches:
        return None
    return float(matches[-1])


def tail_metrics(console_path, n):
    """Return (rate, tail_text) for the last `n` lines of `console_path`, read
    cheaply via `tail` so only those lines enter memory (the console log itself
    may be huge). rate is the last `=== Producer Rate:` value in the tail."""
    result = subprocess.run(
        ["tail", "-n", str(n), str(console_path)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    tail_text = result.stdout
    return parse_rate(tail_text), tail_text


def release_sidecar(pod, namespace):
    """Signal the pod's `log-keeper` sidecar to exit voluntarily by touching
    /workspace/.shutdown.  Without this, the sidecar would only die after
    `terminationGracePeriodSeconds` elapses, which would stall
    `helm uninstall`."""
    subprocess.run(
        [
            "kubectl", "-n", namespace, "exec", pod,
            "-c", SIDECAR_CONTAINER, "--",
            "touch", "/workspace/.shutdown",
        ],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
    )


def atomic_copy_pod_logs(pod, namespace, out_dir):
    """`kubectl cp` known producer/consumer log files from the pod's sidecar
    container into `out_dir`, one atomic copy each: copy to a sibling .tmp and
    only os.replace the destination when the copy fully succeeds, so a good
    prior snapshot is never clobbered by a failed/partial copy. Called every
    copy round. Returns the list of destination paths refreshed this round.

    The sidecar (a native sidecar initContainer with restartPolicy: Always) is
    kept alive for the whole run (released only at the end), so its filesystem
    stays reachable. Files that don't exist in the pod are silently skipped —
    `kubectl cp` returns non-zero on missing sources, so we probe with
    `kubectl exec test -f` first.
    """
    out_dir.mkdir(exist_ok=True)
    written = []
    for name in LOG_FILES_TO_COPY:
        remote = f"{REMOTE_WORKDIR}/{name}"
        probe = subprocess.run(
            [
                "kubectl", "-n", namespace, "exec", pod,
                "-c", SIDECAR_CONTAINER, "--",
                "test", "-f", remote,
            ],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
        )
        if probe.returncode != 0:
            continue
        dest = out_dir / f"{pod}-{name}"
        tmp = out_dir / f".{pod}-{name}.tmp"
        cp = subprocess.run(
            [
                "kubectl", "-n", namespace, "cp",
                "-c", SIDECAR_CONTAINER,
                f"{pod}:{remote}", str(tmp),
            ],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
        )
        if cp.returncode == 0 and tmp.is_file():
            os.replace(tmp, dest)  # atomic; keeps the old file until now
            written.append(dest)
        else:
            # Leave the previous good copy in place; drop the partial tmp.
            tmp.unlink(missing_ok=True)
            print(
                f"kubectl cp failed for {pod}:{remote}: {cp.stderr.strip()}",
                file=sys.stderr,
            )
    return written


def fetch_pod_result(pod, namespace, run_dir, tail_lines):
    """Stream one pod's full console log to `{pod}-console.log` on disk, then
    `tail` it for the recent metrics, without waiting for the container — the
    periodic loop reads logs while pods may still be running. Returns
    (pod, rate_or_None, tail_text), where tail_text is the last `tail_lines`
    console lines (the full log stays on disk). Safe to run concurrently (one
    pod per worker thread)."""
    console_path = run_dir / f"{pod}-console.log"
    if stream_pod_console_to_file(pod, namespace, console_path) is None:
        return (pod, None, "<failed to fetch logs>")
    rate, tail_text = tail_metrics(console_path, tail_lines)
    return (pod, rate, tail_text)


def build_summary_text(component, pod_results, release, namespace, values_file,
                       with_rate_summary, tail_lines):
    """Render the per-component console-log summary (header + each pod's recent
    console tail + an optional producer-rate summary) as a string. The full
    console log of each pod is saved separately as `{pod}-console.log`; here we
    embed only its last `tail_lines` lines. `with_rate_summary` parses
    `=== Producer Rate:` per pod and appends average/aggregate MB/s."""
    lines = [
        f"# ckjs-perf-scale run ({component})",
        f"# release:   {release}",
        f"# namespace: {namespace}",
        f"# values:    {values_file}",
        f"# timestamp: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        f"# pods:      {len(pod_results)}",
        "",
    ]
    for pod, rate, log_text in pod_results:
        lines.append(f"===== POD {pod} =====")
        lines.append(f"--- last {tail_lines} console lines; "
                     f"full log: {pod}-console.log ---")
        lines.append(log_text if log_text.endswith("\n") else log_text + "\n")
        if with_rate_summary:
            lines.append(
                "--- parsed rate: "
                f"{'%.4f MB/s' % rate if rate is not None else 'MISSING'}"
            )
        lines.append("")

    lines.append("===== SUMMARY =====")
    lines.append(f"pods: {len(pod_results)}")
    if with_rate_summary:
        rates = [r for (_, r, _) in pod_results if r is not None]
        missing = [p for (p, r, _) in pod_results if r is None]
        if pod_results:
            per_pod = ", ".join(
                f"{r:.4f}" if r is not None else "MISSING"
                for (_, r, _) in pod_results
            )
            lines.append(f"per-pod MB/s: {per_pod}")
        if rates:
            lines.append(f"average MB/s: {sum(rates) / len(rates):.4f}")
            lines.append(f"aggregate MB/s: {sum(rates):.4f}")
        else:
            lines.append("average MB/s: N/A (no rates parsed)")
            lines.append("aggregate MB/s: N/A (no rates parsed)")
        if missing:
            lines.append(f"missing pods: {', '.join(missing)}")
    return "\n".join(lines) + "\n"


def all_done(components, namespace):
    """True when every component's pods have their main container terminated."""
    return all(containers_terminated(c["pods"], namespace, c["container"])
               for c in components)


def _safe_copy(pod, namespace, out_dir):
    """atomic_copy_pod_logs wrapper that never lets one pod's failure abort the
    round (run concurrently across pods)."""
    try:
        atomic_copy_pod_logs(pod, namespace, out_dir)
    except Exception as e:
        print(f"copy failed for {pod}: {e}", file=sys.stderr)


def collect_round(components, namespace, run_dir, release, values_file,
                  tail_lines, max_workers=20):
    """One collection round: prime external auth with `kubectl get jobs`, then
    atomically copy every pod's files, stream each pod's full console log to
    `{pod}-console.log`, and refresh each component's summary from the recent
    console tail (also written atomically). Returns the producer pod_results
    (for the exit-code check), or [] when there is no producer component."""
    kubectl_get_jobs(namespace)  # prime re-auth before the copies

    all_pods = [p for c in components for p in c["pods"]]
    if all_pods:
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            list(pool.map(lambda p: _safe_copy(p, namespace, run_dir), all_pods))

    producer_results = []
    for c in components:
        if not c["pods"]:
            continue
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            results = list(pool.map(
                lambda p: fetch_pod_result(p, namespace, run_dir, tail_lines),
                c["pods"]))
        write_text_atomic(c["log_path"], build_summary_text(
            c["component"], results, release, namespace, values_file,
            c["with_rate_summary"], tail_lines))
        print(f"wrote {c['log_path']}", flush=True)
        if c["component"] == "producer":
            producer_results = results
    return producer_results


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "values",
        nargs="?",
        default=None,
        help="Path to a values YAML for the Helm chart. Required unless "
        "--resume is given (on resume it is only used for the summary header).",
    )
    ap.add_argument("--release", default="ckjs-perf-scale", help="Helm release name.")
    ap.add_argument("--namespace", default="default", help="Kubernetes namespace.")
    ap.add_argument(
        "--timeout",
        type=int,
        default=3600,
        help="Helm --timeout in seconds (also the overall collection deadline).",
    )
    ap.add_argument(
        "--copy-interval",
        type=float,
        default=10,
        help="Minutes between copy rounds while the jobs run (default 10). "
        "Each round copies every pod's files atomically and refreshes the "
        "console-log summaries.",
    )
    ap.add_argument(
        "--keep",
        action="store_true",
        help="Don't `helm uninstall` after collecting logs.",
    )
    ap.add_argument(
        "--summary-tail-lines",
        type=int,
        default=50,
        help="How many trailing lines of each pod's console log to embed in the "
        "summary (default 50). The full console log is always saved to "
        "{pod}-console.log; only this tail (enough to span a metrics block) goes "
        "into the summary, so the summary stays small for big/long runs.",
    )
    ap.add_argument(
        "--resume",
        default=None,
        metavar="FOLDER",
        help="Skip the helm install; continue collecting logs from an "
        "already-deployed release in the current namespace into this existing "
        "logs/<ts> folder.",
    )
    ap.add_argument(
        "--ref",
        default=None,
        help="confluent-kafka-javascript branch/tag/SHA to check out "
        "(overrides source.ref in the values file).",
    )
    ap.add_argument(
        "--source-repo",
        default=None,
        help="Git URL to clone (overrides source.repo in the values file).",
    )
    ap.add_argument(
        "--node-arch",
        default=None,
        help="kubernetes.io/arch value to pin the job pods to "
        "(default: auto-detected from this host; pass an empty string to "
        "disable the affinity).",
    )
    args = ap.parse_args()

    # On --resume the values file is optional (no install happens); it is only
    # used for the summary header, so fall back to a placeholder when omitted.
    if args.values:
        values_file = Path(args.values).resolve()
        if not values_file.is_file():
            sys.exit(f"values file not found: {values_file}")
    elif args.resume:
        values_file = "<resumed>"
    else:
        sys.exit("values file is required (or pass --resume <folder>)")

    set_overrides = []
    if args.resume:
        # Resume into an existing run folder instead of creating a new one, and
        # don't touch the install (so --ref/--source-repo/--node-arch are moot).
        run_dir = Path(args.resume).resolve()
        if not run_dir.is_dir():
            sys.exit(f"--resume folder not found: {run_dir}")
    else:
        # Each run gets its own UTC-timestamped folder under logs/.  Both the
        # global log file and every per-pod log file copied from the pods land
        # there, so runs never overwrite each other.
        ts = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        run_dir = LOGS_DIR / ts
        run_dir.mkdir(parents=True, exist_ok=True)
        if args.ref:
            set_overrides.append(f"source.ref={args.ref}")
        if args.source_repo:
            set_overrides.append(f"source.repo={args.source_repo}")
        # Pin the job pods to nodes matching this host's architecture unless the
        # user explicitly disabled it with --node-arch ''.
        node_arch = detect_node_arch() if args.node_arch is None else args.node_arch
        if node_arch:
            print(f"node arch affinity: {node_arch}", flush=True)
            set_overrides.append(f"nodeArch={node_arch}")

    log_path = run_dir / f"scale-{args.release}.log"
    print(f"log folder: {run_dir}", flush=True)
    print(f"log file: {log_path}", flush=True)

    failed = False
    if not args.resume:
        try:
            helm_install(
                args.release, args.namespace, values_file, args.timeout, set_overrides
            )
        except subprocess.CalledProcessError as e:
            print(f"helm upgrade --install failed: {e}", file=sys.stderr)
            failed = True
            # Continue anyway — we still want to capture whatever logs exist.

    # Discover the pods up front. Producer always exists; consumer only when the
    # values file rendered a consumer Job (checked here so a producer-only run
    # doesn't block waiting for pods that will never appear). Each component maps
    # to its main container name and a summary log file.
    components = [{
        "component": "producer", "container": "producer",
        "pods": wait_for_pods(args.release, args.namespace, "producer", args.timeout),
        "log_path": log_path, "with_rate_summary": True,
    }]
    if not components[0]["pods"]:
        print(f"no producer pods found for release={args.release} "
              f"ns={args.namespace}", file=sys.stderr)
    if job_exists(args.release, args.namespace, "consumer"):
        consumer_log_path = run_dir / f"scale-{args.release}-consumer.log"
        print(f"consumer log file: {consumer_log_path}", flush=True)
        components.append({
            "component": "consumer", "container": "consumer",
            "pods": wait_for_pods(args.release, args.namespace, "consumer", args.timeout),
            "log_path": consumer_log_path, "with_rate_summary": False,
        })

    # Periodically copy each pod's files and refresh the summaries every
    # --copy-interval minutes, until every main container has terminated (then
    # one final post-completion copy captures the fully-flushed files), or the
    # timeout elapses. The log-keeper sidecars are kept alive the whole time and
    # only released afterwards.
    copy_interval_s = args.copy_interval * 60
    poll_s = 30
    deadline = time.monotonic() + args.timeout
    producer_results = []
    while True:
        producer_results = collect_round(
            components, args.namespace, run_dir, args.release, values_file,
            args.summary_tail_lines)
        if all_done(components, args.namespace):
            break
        if time.monotonic() >= deadline:
            print("timeout reached before all jobs finished", file=sys.stderr)
            break
        # Wait up to copy_interval_s for the next round, but wake early (and do a
        # final copy) as soon as the containers finish or the deadline passes.
        wait_until = min(time.monotonic() + copy_interval_s, deadline)
        while True:
            remaining = wait_until - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(poll_s, remaining))
            if all_done(components, args.namespace):
                break

    # Release every sidecar so the Jobs can complete and `helm uninstall` doesn't
    # block on terminationGracePeriodSeconds.
    all_pods = [p for c in components for p in c["pods"]]
    if all_pods:
        with ThreadPoolExecutor(max_workers=20) as pool:
            list(pool.map(
                lambda p: release_sidecar(p, args.namespace), all_pods))

    if not args.keep:
        helm_uninstall(args.release, args.namespace)

    if failed or not components[0]["pods"] or \
            any(r is None for (_, r, _) in producer_results):
        sys.exit(1)


if __name__ == "__main__":
    main()

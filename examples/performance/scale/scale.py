#!/usr/bin/env python3
"""Driver for the ckjs-perf-scale Helm chart.

Runs `helm upgrade --install` against the chart with a user-supplied values
file, waits for the multi-pod producer Job to finish, collects per-pod logs
into a single log file, parses `=== Producer Rate:  <number>` from each pod
(MB/s), and appends average + aggregate throughput to the same log file.
"""

import argparse
import datetime as dt
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

# Files written by performance-primitives*.js into the producer's working
# directory.  scale.py tries to `kubectl cp` each of these from the sidecar
# container after the producer Job completes.  Missing files are silently
# skipped (e.g. only confluent-producer.log is written for a producer-only run).
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
    # wait for the producer *container* ourselves (wait_for_pods /
    # wait_container_done) before copying logs.
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


def container_state(pod, namespace, container):
    """Return the named container's terminated reason, or '' if it is still
    running / not yet started."""
    result = run(
        [
            "kubectl", "-n", namespace, "get", "pod", pod, "-o",
            "jsonpath={.status.containerStatuses[?(@.name=='" + container + "')]"
            ".state.terminated.reason}",
        ],
        capture=True,
        check=False,
    )
    return result.stdout.strip()


def wait_container_done(pod, namespace, container, timeout_s, poll_s=5):
    """Block until the pod's main container (`producer`/`consumer`) has
    terminated (Completed or Error), so its log files are fully written.  The
    log-keeper sidecar keeps the pod alive, so this returns while the pod's
    filesystem is still reachable for `kubectl cp`.  Returns the terminated
    reason, or '' on timeout."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        reason = container_state(pod, namespace, container)
        if reason:
            return reason
        time.sleep(poll_s)
    return ""


def fetch_pod_log(pod, namespace):
    result = run(
        ["kubectl", "-n", namespace, "logs", pod, "--all-containers=true"],
        capture=True,
    )
    return result.stdout


def parse_rate(pod_log):
    """Return the last `=== Producer Rate:` value (MB/s) seen, or None."""
    matches = PRODUCER_RATE_RE.findall(pod_log)
    if not matches:
        return None
    return float(matches[-1])


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


def copy_pod_logs(pod, namespace, out_dir):
    """`kubectl cp` known producer/consumer log files from the pod's sidecar
    container into `out_dir`.  Returns the list of paths that landed locally.

    The sidecar (a native sidecar initContainer with restartPolicy: Always)
    is still up because the pod's terminationGracePeriodSeconds keeps it
    alive after the producer container exits.  Files that do not exist in
    the pod are silently skipped — `kubectl cp` returns non-zero on missing
    sources, so we probe with `kubectl exec test -f` first.
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
        cp = subprocess.run(
            [
                "kubectl", "-n", namespace, "cp",
                "-c", SIDECAR_CONTAINER,
                f"{pod}:{remote}", str(dest),
            ],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
        )
        if cp.returncode == 0 and dest.is_file():
            written.append(dest)
        else:
            print(
                f"kubectl cp failed for {pod}:{remote}: {cp.stderr.strip()}",
                file=sys.stderr,
            )
    return written


def process_pod(pod, namespace, container, timeout_s):
    """Wait for one pod's main container to finish and fetch its console log.
    Returns (pod, rate_or_None, log_text).  Does NOT copy log files or
    release the sidecar — that happens later, after the global log file has
    been written.  Designed to be run concurrently — one pod per worker
    thread — since each call only touches its own pod and is `kubectl` I/O.
    """
    # Wait for the main container to finish (the log-keeper sidecar
    # keeps the pod up) so its log files are complete before we read them.
    reason = wait_container_done(pod, namespace, container, timeout_s)
    if not reason:
        print(
            f"{container} container in {pod} did not terminate within "
            f"{timeout_s}s; reading logs anyway",
            file=sys.stderr,
        )
    try:
        log_text = fetch_pod_log(pod, namespace)
    except subprocess.CalledProcessError as e:
        log_text = f"<failed to fetch logs: {e}>"
    rate = parse_rate(log_text)
    return (pod, rate, log_text)


def copy_and_release_pod(pod, namespace, out_dir):
    """Copy the pod's log files out of its sidecar into `out_dir`, then
    release the sidecar so the Job can complete (and `helm uninstall` doesn't
    block on the terminationGracePeriodSeconds).  Returns the list of copied
    paths.  Run after the global log file is written — one pod per worker
    thread."""
    try:
        copied = copy_pod_logs(pod, namespace, out_dir)
    except Exception as e:  # never let one pod's cp failure abort the run
        print(f"copy_pod_logs failed for {pod}: {e}", file=sys.stderr)
        copied = []
    # Tell the sidecar it can exit now, so helm uninstall doesn't
    # block waiting for terminationGracePeriodSeconds.
    release_sidecar(pod, namespace)
    return copied


def collect_component(component, container, release, namespace, timeout_s,
                      run_dir, log_path, values_file, with_rate_summary):
    """Wait for one Job's pods to finish, write their console logs to
    `log_path`, then copy each pod's log files out of its sidecar and release
    the sidecar.  Returns the list of (pod, rate_or_None, log_text) tuples.

    `with_rate_summary` controls whether `=== Producer Rate:` is parsed per pod
    and an average/aggregate throughput summary is appended (producer only)."""
    pods = wait_for_pods(release, namespace, component, timeout_s)
    if not pods:
        print(
            f"no {component} pods found for release={release} ns={namespace}",
            file=sys.stderr,
        )

    max_workers = 20
    # Phase 1: wait for every pod's main container to finish and fetch its
    # console log, all pods concurrently so a slow pod doesn't hold up the
    # others.  pool.map preserves input order, so pod_results stays in pod order.
    pod_results = []  # list of (pod_name, rate_or_None, log_text)
    if pods:
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            pod_results = list(
                pool.map(
                    lambda p: process_pod(p, namespace, container, timeout_s),
                    pods,
                )
            )

    with log_path.open("w") as f:
        f.write(
            f"# ckjs-perf-scale run ({component})\n"
            f"# release:   {release}\n"
            f"# namespace: {namespace}\n"
            f"# values:    {values_file}\n"
            f"# timestamp: {dt.datetime.now(dt.timezone.utc).isoformat()}\n"
            f"# pods:      {len(pods)}\n\n"
        )
        for pod, rate, log_text in pod_results:
            f.write(f"===== POD {pod} =====\n")
            f.write(log_text)
            if not log_text.endswith("\n"):
                f.write("\n")
            if with_rate_summary:
                f.write(
                    f"--- parsed rate: "
                    f"{'%.4f MB/s' % rate if rate is not None else 'MISSING'}\n"
                )
            f.write("\n")

        f.write("===== SUMMARY =====\n")
        f.write(f"pods: {len(pod_results)}\n")
        if with_rate_summary:
            rates = [r for (_, r, _) in pod_results if r is not None]
            missing = [p for (p, r, _) in pod_results if r is None]
            if pod_results:
                per_pod = ", ".join(
                    f"{r:.4f}" if r is not None else "MISSING"
                    for (_, r, _) in pod_results
                )
                f.write(f"per-pod MB/s: {per_pod}\n")
            if rates:
                avg = sum(rates) / len(rates)
                agg = sum(rates)
                f.write(f"average MB/s: {avg:.4f}\n")
                f.write(f"aggregate MB/s: {agg:.4f}\n")
            else:
                f.write("average MB/s: N/A (no rates parsed)\n")
                f.write("aggregate MB/s: N/A (no rates parsed)\n")
            if missing:
                f.write(f"missing pods: {', '.join(missing)}\n")

    print(f"wrote {log_path}", flush=True)

    # Phase 2: now that the log file is written, copy each pod's log files out
    # of its sidecar and release the sidecar, all pods concurrently.
    if pods:
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            list(pool.map(
                lambda p: copy_and_release_pod(p, namespace, run_dir), pods
            ))

    return pod_results


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("values", help="Path to a values YAML for the Helm chart.")
    ap.add_argument("--release", default="ckjs-perf-scale", help="Helm release name.")
    ap.add_argument("--namespace", default="default", help="Kubernetes namespace.")
    ap.add_argument(
        "--timeout",
        type=int,
        default=3600,
        help="Helm --timeout in seconds (also the producer Job deadline).",
    )
    ap.add_argument(
        "--keep",
        action="store_true",
        help="Don't `helm uninstall` after collecting logs.",
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

    values_file = Path(args.values).resolve()
    if not values_file.is_file():
        sys.exit(f"values file not found: {values_file}")

    # Each run gets its own UTC-timestamped folder under logs/.  Both the
    # global log file and every per-pod log file copied from the pods land
    # there, so runs never overwrite each other.
    ts = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = LOGS_DIR / ts
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / f"scale-{args.release}.log"

    print(f"log folder: {run_dir}", flush=True)
    print(f"log file: {log_path}", flush=True)

    set_overrides = []
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

    failed = False
    try:
        helm_install(
            args.release, args.namespace, values_file, args.timeout, set_overrides
        )
    except subprocess.CalledProcessError as e:
        print(f"helm upgrade --install failed: {e}", file=sys.stderr)
        failed = True
        # Continue anyway — we still want to capture whatever logs exist.

    # Producer logs -> scale-<release>.log, with the throughput summary.
    producer_results = collect_component(
        "producer", "producer", args.release, args.namespace, args.timeout,
        run_dir, log_path, values_file, with_rate_summary=True,
    )

    # Consumer logs -> scale-<release>-consumer.log, only when the optional
    # consumer Job was rendered (values.yaml has a consumer section).  Checked
    # up front so a producer-only run doesn't block waiting for pods that will
    # never appear.
    if job_exists(args.release, args.namespace, "consumer"):
        consumer_log_path = run_dir / f"scale-{args.release}-consumer.log"
        print(f"consumer log file: {consumer_log_path}", flush=True)
        collect_component(
            "consumer", "consumer", args.release, args.namespace, args.timeout,
            run_dir, consumer_log_path, values_file, with_rate_summary=False,
        )

    if not args.keep:
        helm_uninstall(args.release, args.namespace)

    if failed or not producer_results or any(r is None for (_, r, _) in producer_results):
        sys.exit(1)


if __name__ == "__main__":
    main()

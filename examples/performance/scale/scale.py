#!/usr/bin/env python3
"""Driver for the ckjs-perf-scale Helm chart.

Runs `helm upgrade --install` against the chart with a user-supplied values
file, waits for the multi-pod producer Job to finish, collects per-pod logs
into a single log file, parses `=== Producer Rate:  <number>` from each pod
(MB/s), and appends average + aggregate throughput to the same log file.
"""

import argparse
import datetime as dt
import os
import re
import subprocess
import sys
from pathlib import Path

PRODUCER_RATE_RE = re.compile(
    r"^=== Producer Rate:\s+([0-9]+(?:\.[0-9]+)?)", re.MULTILINE
)

CHART_DIR = Path(__file__).resolve().parent


def run(cmd, check=True, capture=False):
    """Thin wrapper around subprocess.run that streams or captures output."""
    print(f"$ {' '.join(cmd)}", flush=True)
    if capture:
        return subprocess.run(
            cmd, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
    return subprocess.run(cmd, check=check)


def helm_install(release, namespace, values_file, timeout_s, set_overrides):
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
        "--wait",
        "--wait-for-jobs",
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


def list_producer_pods(release, namespace):
    job_name = f"{release}-producer"
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


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("values", help="Path to a values YAML for the Helm chart.")
    ap.add_argument("--release", default="perf-scale", help="Helm release name.")
    ap.add_argument("--namespace", default="default", help="Kubernetes namespace.")
    ap.add_argument(
        "--log",
        default=None,
        help="Output log file (default: scale-<release>-<UTC timestamp>.log).",
    )
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
    args = ap.parse_args()

    values_file = Path(args.values).resolve()
    if not values_file.is_file():
        sys.exit(f"values file not found: {values_file}")

    if args.log:
        log_path = Path(args.log).resolve()
    else:
        ts = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        log_path = Path.cwd() / f"scale-{args.release}-{ts}.log"

    print(f"log file: {log_path}", flush=True)

    set_overrides = []
    if args.ref:
        set_overrides.append(f"source.ref={args.ref}")
    if args.source_repo:
        set_overrides.append(f"source.repo={args.source_repo}")

    failed = False
    try:
        helm_install(
            args.release, args.namespace, values_file, args.timeout, set_overrides
        )
    except subprocess.CalledProcessError as e:
        print(f"helm upgrade --install failed: {e}", file=sys.stderr)
        failed = True
        # Continue anyway — we still want to capture whatever logs exist.

    pods = list_producer_pods(args.release, args.namespace)
    if not pods:
        print(
            f"no producer pods found for release={args.release} ns={args.namespace}",
            file=sys.stderr,
        )

    pod_results = []  # list of (pod_name, rate_or_None, log_text)
    for pod in pods:
        try:
            log_text = fetch_pod_log(pod, args.namespace)
        except subprocess.CalledProcessError as e:
            log_text = f"<failed to fetch logs: {e}>"
        rate = parse_rate(log_text)
        pod_results.append((pod, rate, log_text))

    with log_path.open("w") as f:
        f.write(
            f"# ckjs-perf-scale run\n"
            f"# release:   {args.release}\n"
            f"# namespace: {args.namespace}\n"
            f"# values:    {values_file}\n"
            f"# timestamp: {dt.datetime.now(dt.timezone.utc).isoformat()}\n"
            f"# pods:      {len(pods)}\n\n"
        )
        for pod, rate, log_text in pod_results:
            f.write(f"===== POD {pod} =====\n")
            f.write(log_text)
            if not log_text.endswith("\n"):
                f.write("\n")
            f.write(
                f"--- parsed rate: "
                f"{'%.4f MB/s' % rate if rate is not None else 'MISSING'}\n\n"
            )

        rates = [r for (_, r, _) in pod_results if r is not None]
        missing = [p for (p, r, _) in pod_results if r is None]

        f.write("===== SUMMARY =====\n")
        f.write(f"pods: {len(pod_results)}\n")
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

    if not args.keep:
        helm_uninstall(args.release, args.namespace)

    if failed or not pod_results or any(r is None for (_, r, _) in pod_results):
        sys.exit(1)


if __name__ == "__main__":
    main()

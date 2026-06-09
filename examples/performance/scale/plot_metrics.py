#!/usr/bin/env python3
"""Plot the latency metrics from a jsmetrics-*.jsonl file into a Markdown report.

performance-primitives-common.js appends one JSON object per sample (every 5s)
to a per-run-type jsmetrics file — jsmetrics-producer.jsonl (producer send
latency), jsmetrics-consumer-batch.jsonl / jsmetrics-consumer-message.jsonl
(consumer T0->T1 E2E latency) — all with the same schema, e.g.:

    {"ts": 1717..., "avg": 12.3, "p50": 10.1, "p90": 18.0, "p99": 40.2,
     "p999": 90.5, "max": 120.0, "count": 12345}

This script reads that file and writes a Markdown file whose graphs are
embedded as base64-encoded PNGs (no external image files), so the report is
self-contained. The latency graph is labeled from the file name. Graphs:
  1. Latency (avg/p50/p90/p99/p99.9/max) over the test runtime for the given
     file.
  2. Consumer E2E latency over time for each of jsmetrics-consumer-batch.jsonl
     and jsmetrics-consumer-message.jsonl found next to the given file (same
     per-pod prefix), when present.
  3. Broker RTT (max across brokers of avg/p50/p90/p99/p99.99/max), read from
     the sibling <pod>-confluent-*.log librdkafka statistics for the same run.

Usage:
    ./plot_metrics.py <jsmetrics-*.jsonl> [-o report.md] [--title "..."] [--stats <log>]
"""

import argparse
import base64
import io
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # headless: render to memory, never open a window
import matplotlib.pyplot as plt

# Latency series to plot, in order, each with a distinct colour. Series absent
# from the data (e.g. p90 in older runs) are skipped automatically.
LATENCY_SERIES = [
    ("avg", "average", "tab:blue"),
    ("p50", "p50", "tab:green"),
    ("p90", "p90", "tab:orange"),
    ("p99", "p99", "tab:red"),
    ("p999", "p99.9", "tab:purple"),
    ("max", "max", "tab:gray"),
]

# Broker rtt window stats (librdkafka brokers.<b>.rtt, in microseconds) to plot,
# each taken as the maximum across all brokers in a stats snapshot. librdkafka's
# highest rtt percentile is p99_99 (99.99th); there is no p99.9, so it stands in
# for the requested "p999" series.
RTT_SERIES = [
    ("avg", "avg", "tab:blue"),
    ("p50", "p50", "tab:green"),
    ("p90", "p90", "tab:orange"),
    ("p99", "p99", "tab:red"),
    ("p99_99", "p99.99", "tab:purple"),
    ("max", "max", "tab:gray"),
]


def load_samples(path):
    """Read jsonl into a list of dicts, skipping blank/garbled lines."""
    samples = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                samples.append(json.loads(line))
            except json.JSONDecodeError:
                print(f"skipping malformed line: {line[:80]}", file=sys.stderr)
    return samples


def elapsed_seconds(samples):
    """X axis: seconds since the first sample (falls back to sample index)."""
    ts = [s.get("ts") for s in samples]
    if all(t is not None for t in ts) and ts:
        t0 = ts[0]
        return [(t - t0) / 1000.0 for t in ts]
    return list(range(len(samples)))


def load_stats(path):
    """Parse a confluent-producer.log into a list of librdkafka stats
    snapshots (the JSON objects containing a 'brokers' map). Lines are
    'INFO: {json}', possibly with trailing text, so use raw_decode."""
    dec = json.JSONDecoder()
    snapshots = []
    with open(path) as f:
        for line in f:
            i = line.find("{")
            if i < 0:
                continue
            try:
                obj, _ = dec.raw_decode(line[i:])
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and "brokers" in obj:
                snapshots.append(obj)
    return snapshots


def rtt_max_across_brokers(snapshots):
    """For each stats snapshot, return the max-across-brokers of each rtt
    series (in ms), plus the x axis (elapsed seconds from the first snapshot).
    Only brokers that recorded rtt samples (cnt > 0) in that snapshot count.
    Returns (x_seconds, {series_key: [values...]})."""
    x = []
    series = {key: [] for key, _, _ in RTT_SERIES}
    t0 = snapshots[0].get("ts") if snapshots else None
    for idx, snap in enumerate(snapshots):
        rtts = [b.get("rtt", {}) for b in snap.get("brokers", {}).values()]
        rtts = [r for r in rtts if r.get("cnt", 0) > 0]
        for key, _, _ in RTT_SERIES:
            vals = [r.get(key) for r in rtts if r.get(key) is not None]
            # microseconds -> milliseconds; None when no broker had data
            series[key].append((max(vals) / 1000.0) if vals else None)
        ts = snap.get("ts")
        x.append((ts - t0) / 1e6 if (ts is not None and t0 is not None) else idx)
    return x, series


def broker_rtt_over_time_figure(snapshots):
    """Line chart: max-across-brokers rtt percentiles over the run."""
    x, series = rtt_max_across_brokers(snapshots)
    fig, ax = plt.subplots(figsize=(11, 6))
    for key, label, color in RTT_SERIES:
        y = series[key]
        if not any(v is not None for v in y):
            continue
        ax.plot(x, y, label=label, color=color, linewidth=1.5)
    ax.set_xlabel("elapsed time (s)")
    ax.set_ylabel("broker rtt (ms)")
    ax.set_title("Broker RTT over time (max across brokers)")
    ax.grid(True, alpha=0.3)
    ax.legend(title="rtt")
    return fig


def fig_to_base64_png(fig):
    """Render a figure to a base64-encoded PNG string."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def sentence_case(s):
    """Capitalize only the first character, leaving the rest untouched (so
    'consumer E2E latency (eachBatch)' keeps its 'E2E'/'eachBatch' casing)."""
    return s[:1].upper() + s[1:]


def latency_over_time_figure(samples, latency_label="producer send latency"):
    """Line chart: each latency series over the runtime of the test."""
    x = elapsed_seconds(samples)
    fig, ax = plt.subplots(figsize=(11, 6))
    for key, label, color in LATENCY_SERIES:
        if not any(key in s for s in samples):
            continue
        y = [s.get(key) for s in samples]
        ax.plot(x, y, label=label, color=color, marker=".", linewidth=1.5)
    ax.set_xlabel("elapsed time (s)")
    ax.set_ylabel(f"{latency_label} (ms)")
    ax.set_title(f"{sentence_case(latency_label)} over time")
    ax.grid(True, alpha=0.3)
    ax.legend(title="series")
    return fig


def latency_label_for(jsonl_name):
    """Human-readable latency label inferred from the jsmetrics file name, so
    consumer files aren't mislabeled as 'producer send latency'."""
    if "jsmetrics-consumer-batch" in jsonl_name:
        return "consumer E2E latency (eachBatch)"
    if "jsmetrics-consumer-message" in jsonl_name:
        return "consumer E2E latency (eachMessage)"
    return "producer send latency"


# Consumer E2E jsmetrics files, in plot order.
CONSUMER_JSMETRICS = (
    "jsmetrics-consumer-batch.jsonl",
    "jsmetrics-consumer-message.jsonl",
)


def jsmetrics_prefix(name):
    """Return the per-pod prefix of a jsmetrics file name (everything before
    'jsmetrics'), so sibling run files can be found: e.g.
    '<pod>-jsmetrics-producer.jsonl' -> '<pod>-', 'jsmetrics-producer.jsonl' ->
    ''."""
    i = name.find("jsmetrics")
    return name[:i] if i >= 0 else ""


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("jsonl", help="Path to a jsmetrics.jsonl file.")
    ap.add_argument("-o", "--output", default=None,
                    help="Output Markdown file (default: <jsonl>.md).")
    ap.add_argument("--title", default=None,
                    help="Report title (default: the jsonl file name).")
    ap.add_argument("--stats", default=None,
                    help="confluent-producer.log with librdkafka statistics for "
                    "the broker-rtt graph (default: the sibling "
                    "<pod>-confluent-producer.log next to the jsonl).")
    args = ap.parse_args()

    jsonl_path = Path(args.jsonl)
    if not jsonl_path.is_file():
        sys.exit(f"file not found: {jsonl_path}")

    samples = load_samples(jsonl_path)
    if not samples:
        sys.exit(f"no samples parsed from {jsonl_path}")

    # Resolve the librdkafka stats log: explicit --stats, else the sibling
    # confluent log for the same run type, mapping the jsmetrics file name to
    # the matching <prefix>-confluent-*.log written next to it, e.g.
    #   <prefix>-jsmetrics-producer.jsonl        -> <prefix>-confluent-producer.log
    #   <prefix>-jsmetrics-consumer-batch.jsonl  -> <prefix>-confluent-consumer-batch.log
    #   <prefix>-jsmetrics-consumer-message.jsonl-> <prefix>-confluent-consumer-message.log
    if args.stats:
        stats_path = Path(args.stats)
    else:
        name = jsonl_path.name
        for suffix, log_suffix in (
            ("-jsmetrics-producer.jsonl", "-confluent-producer.log"),
            ("-jsmetrics-consumer-batch.jsonl", "-confluent-consumer-batch.log"),
            ("-jsmetrics-consumer-message.jsonl", "-confluent-consumer-message.log"),
            # Fall back to the old single-file name for older runs.
            ("-jsmetrics.jsonl", "-confluent-producer.log"),
        ):
            if name.endswith(suffix):
                name = name[: -len(suffix)] + log_suffix
                break
        stats_path = jsonl_path.with_name(name)

    out_path = Path(args.output) if args.output else jsonl_path.with_suffix(".md")
    title = args.title or jsonl_path.name

    latency_label = latency_label_for(jsonl_path.name)
    figures = [
        (f"{sentence_case(latency_label)} over time",
         latency_over_time_figure(samples, latency_label)),
    ]
    plotted = {jsonl_path.resolve()}

    # Also plot the consumer E2E latency for both modes when sibling files are
    # present (same per-pod prefix, same directory). For a local producer+
    # consumer run these sit next to jsmetrics-producer.jsonl; for per-pod k8s
    # runs each pod is plotted on its own, so the siblings simply aren't found.
    prefix = jsmetrics_prefix(jsonl_path.name)
    for base in CONSUMER_JSMETRICS:
        sibling = jsonl_path.with_name(prefix + base)
        if not sibling.is_file() or sibling.resolve() in plotted:
            continue
        sibling_samples = load_samples(sibling)
        if not sibling_samples:
            print(f"no samples parsed from {sibling}", file=sys.stderr)
            continue
        plotted.add(sibling.resolve())
        label = latency_label_for(sibling.name)
        figures.append((f"{sentence_case(label)} over time",
                        latency_over_time_figure(sibling_samples, label)))

    if stats_path.is_file():
        snapshots = load_stats(stats_path)
        if snapshots:
            figures.append(("Broker RTT over time (max across brokers)",
                            broker_rtt_over_time_figure(snapshots)))
        else:
            print(f"no stats snapshots in {stats_path}", file=sys.stderr)
    else:
        print(f"stats log not found ({stats_path}); skipping rtt graph",
              file=sys.stderr)

    with out_path.open("w") as f:
        f.write(f"# {title}\n\n")
        f.write(f"Samples: {len(samples)}  \n")
        f.write(f"Source: `{jsonl_path}`\n\n")
        for heading, fig in figures:
            b64 = fig_to_base64_png(fig)
            f.write(f"## {heading}\n\n")
            f.write(f"![{heading}](data:image/png;base64,{b64})\n\n")

    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()

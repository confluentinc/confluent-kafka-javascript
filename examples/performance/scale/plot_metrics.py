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

Given a run/log folder instead of a single file, it writes a per-pod report for
every pod's jsmetrics file and then one combined report that groups a per-pod
latency chart under Producers / Consumers sections, each followed by a broker-RTT
chart aggregated (max) across that role's pods.

Usage:
    ./plot_metrics.py <jsmetrics-*.jsonl> [-o report.md] [--title "..."] [--stats <log>]
    ./plot_metrics.py <run-folder> [-o combined-report.md]
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


def rtt_figure(x, series, title):
    """Line chart of rtt percentile series (ms) over elapsed time."""
    fig, ax = plt.subplots(figsize=(11, 6))
    for key, label, color in RTT_SERIES:
        y = series.get(key, [])
        if not any(v is not None for v in y):
            continue
        ax.plot(x, y, label=label, color=color, linewidth=1.5)
    ax.set_xlabel("elapsed time (s)")
    ax.set_ylabel("broker rtt (ms)")
    ax.set_title(title)
    ax.grid(True, alpha=0.3)
    ax.legend(title="rtt")
    return fig


def broker_rtt_over_time_figure(snapshots):
    """Line chart: max-across-brokers rtt percentiles over the run."""
    x, series = rtt_max_across_brokers(snapshots)
    return rtt_figure(x, series, "Broker RTT over time (max across brokers)")


def aggregate_rtt_across_pods(stats_paths, bucket_s=5):
    """Combine several pods' librdkafka stats logs into one rtt series, taking
    the max across brokers (per pod) and then the max across pods within each
    elapsed-time bucket (default 5s, the stats interval). Each pod's elapsed
    time is measured from its own first snapshot. Returns (x_seconds, series)."""
    from collections import defaultdict
    buckets = defaultdict(lambda: {key: None for key, _, _ in RTT_SERIES})
    for path in stats_paths:
        snapshots = load_stats(path)
        if not snapshots:
            continue
        x, series = rtt_max_across_brokers(snapshots)
        for i, t in enumerate(x):
            bucket = round(t / bucket_s) * bucket_s
            for key, _, _ in RTT_SERIES:
                v = series[key][i]
                if v is None:
                    continue
                cur = buckets[bucket][key]
                buckets[bucket][key] = v if cur is None else max(cur, v)
    xs = sorted(buckets.keys())
    out = {key: [buckets[b][key] for b in xs] for key, _, _ in RTT_SERIES}
    return xs, out


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


# Maps a jsmetrics file suffix to the sibling confluent stats log suffix for the
# same run type (the log carries librdkafka statistics for the broker-rtt graph).
JSMETRICS_TO_STATS = (
    ("-jsmetrics-producer.jsonl", "-confluent-producer.log"),
    ("-jsmetrics-consumer-batch.jsonl", "-confluent-consumer-batch.log"),
    ("-jsmetrics-consumer-message.jsonl", "-confluent-consumer-message.log"),
    # Fall back to the old single-file name for older runs.
    ("-jsmetrics.jsonl", "-confluent-producer.log"),
)


def stats_path_for(jsonl_path):
    """Sibling <pod>-confluent-*.log for a jsmetrics file (same run type), or
    None when the name doesn't match a known pattern. Existence is not checked."""
    name = jsonl_path.name
    for suffix, log_suffix in JSMETRICS_TO_STATS:
        if name.endswith(suffix):
            return jsonl_path.with_name(name[: -len(suffix)] + log_suffix)
    return None


def pod_id_from_jsonl(name):
    """Pod identifier inferred from a jsmetrics file name: the per-pod prefix
    with its trailing '-' stripped, e.g.
    'ckjs-perf-scale-producer-6wdr7-jsmetrics-producer.jsonl' ->
    'ckjs-perf-scale-producer-6wdr7'. Empty (local, prefix-less) files yield the
    run-type stem instead."""
    prefix = jsmetrics_prefix(name).rstrip("-")
    return prefix or name.rsplit(".jsonl", 1)[0]


def write_md(out_path, title, intro_lines, sections):
    """Write a Markdown report. `sections` is a list of (level, heading, fig):
    level 2/3 set the '##'/'###' depth; fig is a matplotlib figure embedded as a
    base64 PNG, or None for a heading-only section."""
    with out_path.open("w") as f:
        f.write(f"# {title}\n\n")
        for line in intro_lines:
            f.write(f"{line}  \n")
        if intro_lines:
            f.write("\n")
        for level, heading, fig in sections:
            f.write(f"{'#' * level} {heading}\n\n")
            if fig is not None:
                b64 = fig_to_base64_png(fig)
                f.write(f"![{heading}](data:image/png;base64,{b64})\n\n")


def build_single_report(jsonl_path, out_path=None, title=None, stats_path=None):
    """Write a per-file report: the file's latency graph, any consumer E2E
    siblings sharing its per-pod prefix, and the sibling broker-RTT graph.
    Returns the output path, or None when the file has no samples."""
    samples = load_samples(jsonl_path)
    if not samples:
        print(f"no samples parsed from {jsonl_path}", file=sys.stderr)
        return None

    out_path = Path(out_path) if out_path else jsonl_path.with_suffix(".md")
    title = title or jsonl_path.name

    latency_label = latency_label_for(jsonl_path.name)
    sections = [(2, f"{sentence_case(latency_label)} over time",
                 latency_over_time_figure(samples, latency_label))]
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
        sections.append((2, f"{sentence_case(label)} over time",
                         latency_over_time_figure(sibling_samples, label)))

    # Resolve the librdkafka stats log for the broker-rtt graph: explicit
    # override, else the sibling <pod>-confluent-*.log for the same run type.
    stats = Path(stats_path) if stats_path else stats_path_for(jsonl_path)
    if stats and stats.is_file():
        snapshots = load_stats(stats)
        if snapshots:
            sections.append((2, "Broker RTT over time (max across brokers)",
                             broker_rtt_over_time_figure(snapshots)))
        else:
            print(f"no stats snapshots in {stats}", file=sys.stderr)
    elif stats:
        print(f"stats log not found ({stats}); skipping rtt graph",
              file=sys.stderr)

    write_md(out_path, title, [f"Samples: {len(samples)}",
                               f"Source: `{jsonl_path}`"], sections)
    print(f"wrote {out_path}")
    return out_path


def build_combined_report(folder, out_path):
    """Write one report for a whole run folder: per-pod latency charts grouped
    into Producers / Consumers sections, each followed by a broker-RTT chart
    aggregated (max) across that role's pods. Returns the output path."""
    folder = Path(folder)
    # (section title, glob) for each role; consumer covers both modes.
    roles = [
        ("Producers", sorted(folder.glob("*-jsmetrics-producer.jsonl"))),
        ("Consumers", sorted(folder.glob("*-jsmetrics-consumer-batch.jsonl"))
                      + sorted(folder.glob("*-jsmetrics-consumer-message.jsonl"))),
    ]

    sections = []
    for role, jsonls in roles:
        if not jsonls:
            continue
        sections.append((2, f"{role} ({len(jsonls)} pods)", None))
        for jp in jsonls:
            samples = load_samples(jp)
            if not samples:
                print(f"no samples parsed from {jp}", file=sys.stderr)
                continue
            label = latency_label_for(jp.name)
            heading = f"{pod_id_from_jsonl(jp.name)} — {label}"
            sections.append((3, heading, latency_over_time_figure(samples, label)))

        # Aggregated broker RTT across this role's pods.
        stats_paths = [p for p in (stats_path_for(jp) for jp in jsonls)
                       if p and p.is_file()]
        if stats_paths:
            x, series = aggregate_rtt_across_pods(stats_paths)
            if x:
                sections.append((3,
                    "Broker RTT over time (max across brokers and pods)",
                    rtt_figure(x, series,
                               f"{role}: broker RTT (max across brokers and pods)")))

    if not sections:
        sys.exit(f"no per-pod jsmetrics files found in {folder}")

    write_md(out_path, f"Combined metrics — {folder.name}",
             [f"Source folder: `{folder}`"], sections)
    print(f"wrote {out_path}")
    return out_path


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target", help="A jsmetrics-*.jsonl file, or a run/log "
                    "folder (plots a per-pod report for every pod plus one "
                    "combined report grouped by producers/consumers).")
    ap.add_argument("-o", "--output", default=None,
                    help="Output Markdown file. For a single file defaults to "
                    "<jsonl>.md; for a folder defaults to "
                    "<folder>/combined-report.md.")
    ap.add_argument("--title", default=None,
                    help="Report title (single-file mode; default: file name).")
    ap.add_argument("--stats", default=None,
                    help="confluent-*.log with librdkafka statistics for the "
                    "broker-rtt graph (single-file mode; default: the sibling "
                    "<pod>-confluent-*.log next to the jsonl).")
    args = ap.parse_args()

    target = Path(args.target)

    if target.is_dir():
        # Folder mode: one md per pod, then a combined grouped report.
        pod_jsonls = sorted(target.glob("*-jsmetrics-producer.jsonl")) \
            + sorted(target.glob("*-jsmetrics-consumer-batch.jsonl")) \
            + sorted(target.glob("*-jsmetrics-consumer-message.jsonl"))
        if not pod_jsonls:
            sys.exit(f"no per-pod jsmetrics-*.jsonl files in {target}")
        for jp in pod_jsonls:
            build_single_report(jp)
        out_path = Path(args.output) if args.output else target / "combined-report.md"
        build_combined_report(target, out_path)
        return

    if not target.is_file():
        sys.exit(f"file not found: {target}")
    if build_single_report(target, args.output, args.title, args.stats) is None:
        sys.exit(f"no samples parsed from {target}")


if __name__ == "__main__":
    main()

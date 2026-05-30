#!/usr/bin/env python3
"""Plot the producer metrics from a jsmetrics.jsonl file into a Markdown report.

runProducer in performance-primitives-common.js appends one JSON object per
sample (every 5s) to jsmetrics.jsonl, e.g.:

    {"ts": 1717..., "avg": 12.3, "p50": 10.1, "p90": 18.0, "p99": 40.2,
     "p999": 90.5, "max": 120.0, "count": 12345}

This script reads that file and writes a Markdown file whose graphs are
embedded as base64-encoded PNGs (no external image files), so the report is
self-contained.

Usage:
    ./plot_metrics.py <jsmetrics.jsonl> [-o report.md] [--title "..."]
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


def fig_to_base64_png(fig):
    """Render a figure to a base64-encoded PNG string."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def latency_over_time_figure(samples):
    """Line chart: each latency series over the runtime of the test."""
    x = elapsed_seconds(samples)
    fig, ax = plt.subplots(figsize=(11, 6))
    for key, label, color in LATENCY_SERIES:
        if not any(key in s for s in samples):
            continue
        y = [s.get(key) for s in samples]
        ax.plot(x, y, label=label, color=color, marker=".", linewidth=1.5)
    ax.set_xlabel("elapsed time (s)")
    ax.set_ylabel("producer send latency (ms)")
    ax.set_title("Producer send latency over time")
    ax.grid(True, alpha=0.3)
    ax.legend(title="series")
    return fig


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("jsonl", help="Path to a jsmetrics.jsonl file.")
    ap.add_argument("-o", "--output", default=None,
                    help="Output Markdown file (default: <jsonl>.md).")
    ap.add_argument("--title", default=None,
                    help="Report title (default: the jsonl file name).")
    args = ap.parse_args()

    jsonl_path = Path(args.jsonl)
    if not jsonl_path.is_file():
        sys.exit(f"file not found: {jsonl_path}")

    samples = load_samples(jsonl_path)
    if not samples:
        sys.exit(f"no samples parsed from {jsonl_path}")

    out_path = Path(args.output) if args.output else jsonl_path.with_suffix(".md")
    title = args.title or jsonl_path.name

    figures = [
        ("Producer send latency over time", latency_over_time_figure(samples)),
    ]

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

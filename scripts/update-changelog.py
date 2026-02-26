#!/usr/bin/env python3
"""update-changelog.py - Prepend unreleased commits to CHANGELOG.md

Commits with 'fix' in the title or body go in the Fixes section.
All other commits go in the Enhancements section.

Usage:
    python3 scripts/update-changelog.py [new_version] [--dry-run]

Arguments:
    new_version  Version string for the new release (e.g. "1.8.3" or "v1.8.3").
                 If omitted, the patch version is auto-incremented.
    --dry-run    Print the new CHANGELOG entry without modifying the file.
"""

import re
import subprocess
import sys
from pathlib import Path

CHANGELOG_FILE = Path(__file__).parent.parent / "CHANGELOG.md"

# Stable release tag pattern (e.g. v1.8.0 — no RC, dev, alpha, beta suffixes)
STABLE_TAG_RE = re.compile(r"^v\d+\.\d+\.\d+$")

# Skip purely housekeeping commits (CHANGELOG updates, version bumps, CI chores)
SKIP_SUBJECT_RE = re.compile(
    r"^(update changelog|bump version|update version|chore:)",
    re.IGNORECASE,
)


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return result.stdout


def latest_stable_tag():
    tags = run(["git", "tag", "--sort=-version:refname"]).splitlines()
    for tag in tags:
        if STABLE_TAG_RE.match(tag.strip()):
            return tag.strip()
    sys.exit("Error: no stable release tag found (expected vX.Y.Z)")


def next_version(tag):
    """Auto-increment the patch component of a vX.Y.Z tag, returning without 'v'."""
    major, minor, patch = tag.lstrip("v").split(".")
    return f"{major}.{minor}.{int(patch) + 1}"


def commits_since(tag):
    """Return list of (subject, body) tuples for non-merge commits since tag."""
    raw = run(
        ["git", "log", f"{tag}..HEAD", "--no-merges", "--format=%x1e%s%x1f%b"]
    )
    commits = []
    for record in raw.split("\x1e"):
        record = record.strip()
        if not record:
            continue
        parts = record.split("\x1f", 1)
        subject = parts[0].strip()
        body = parts[1].strip() if len(parts) > 1 else ""
        if not subject:
            continue
        if SKIP_SUBJECT_RE.match(subject):
            continue
        commits.append((subject, body))
    return commits


def is_fix(subject, body):
    return bool(re.search(r"\bfix", subject + " " + body, re.IGNORECASE))


def build_entry(version, enhancements, fixes):
    lines = [
        f"# confluent-kafka-javascript {version}",
        "",
        f"v{version} is a maintenance release. It is supported for all usage.",
    ]

    if enhancements:
        lines += ["", "## Enhancements", ""]
        for i, subj in enumerate(enhancements, 1):
            lines.append(f"{i}. {subj}")

    if fixes:
        lines += ["", "## Fixes", ""]
        for i, subj in enumerate(fixes, 1):
            lines.append(f"{i}. {subj}")

    lines.append("")
    lines.append("")
    return "\n".join(lines)


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry_run = "--dry-run" in sys.argv

    tag = latest_stable_tag()
    print(f"Latest stable tag: {tag}")

    raw_ver = args[0] if args else next_version(tag)
    # Strip v prefix for display in CHANGELOG (JS format uses bare version numbers)
    version = raw_ver.lstrip("v")
    print(f"New version:       {version}")

    all_commits = commits_since(tag)
    if not all_commits:
        print("No commits since last release — nothing to add.")
        return

    enhancements, fixes = [], []
    for subject, body in all_commits:
        (fixes if is_fix(subject, body) else enhancements).append(subject)

    print(f"Enhancements: {len(enhancements)}, Fixes: {len(fixes)}")

    entry = build_entry(version, enhancements, fixes)

    if dry_run:
        print("\n--- CHANGELOG entry (dry run) ---")
        print(entry)
        return

    changelog = CHANGELOG_FILE.read_text()
    # Prepend directly — JS CHANGELOG has no top-level heading to skip past
    CHANGELOG_FILE.write_text(entry + "\n" + changelog)
    print(f"Updated {CHANGELOG_FILE}")


if __name__ == "__main__":
    main()

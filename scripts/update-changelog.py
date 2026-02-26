#!/usr/bin/env python3
"""update-changelog.py - Prepend unreleased commits to CHANGELOG.md

Commits with 'fix' in the title or body go in the Fixes section.
All other commits go in the Enhancements section.

Usage:
    python3 scripts/update-changelog.py [new_version] [--release-type TYPE] [--dry-run]

Arguments:
    new_version           Version string for the new release (e.g. "1.8.3" or "v1.8.3").
                          If omitted, the patch version is auto-incremented.
    --release-type TYPE   Override the release type label: "feature" or "maintenance".
                          If omitted, derived from the version bump:
                            patch bump (X.Y.Z+1) → maintenance release
                            minor or major bump   → feature release
    --dry-run             Print the new CHANGELOG entry without modifying the file.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

CHANGELOG_FILE = Path(__file__).parent.parent / "CHANGELOG.md"

# Stable release tag pattern (e.g. v1.8.0 — no RC, dev, alpha, beta suffixes)
STABLE_TAG_RE = re.compile(r"^v\d+\.\d+\.\d+$")

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")

# Skip purely housekeeping commits (CHANGELOG updates, version bumps, CI chores)
SKIP_SUBJECT_RE = re.compile(
    r"^(update changelog|bump version|update version|chore(\([^)]*\))?:)",
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


def derive_release_type(old_tag, new_version):
    """Return 'feature' for a minor/major bump, 'maintenance' for a patch bump."""
    old = tuple(int(x) for x in old_tag.lstrip("v").split("."))
    new = tuple(int(x) for x in new_version.split("."))
    return "feature" if (new[0] > old[0] or new[1] > old[1]) else "maintenance"


def build_entry(version, release_type, enhancements, fixes):
    lines = [
        f"# confluent-kafka-javascript {version}",
        "",
        f"v{version} is a {release_type} release. It is supported for all usage.",
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
    parser = argparse.ArgumentParser(
        description="Prepend unreleased commits to CHANGELOG.md"
    )
    parser.add_argument(
        "new_version",
        nargs="?",
        help="New version string (e.g. 1.8.3 or v1.8.3). "
        "Defaults to auto-incremented patch version.",
    )
    parser.add_argument(
        "--release-type",
        choices=["feature", "maintenance"],
        help="Release type label. Derived from the version bump if omitted "
        "(patch → maintenance, minor/major → feature).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the new CHANGELOG entry without modifying the file.",
    )
    args = parser.parse_args()

    tag = latest_stable_tag()
    print(f"Latest stable tag: {tag}")

    raw_ver = args.new_version if args.new_version else next_version(tag)
    # Strip v prefix — JS CHANGELOG uses bare version numbers (e.g. 1.8.3)
    version = raw_ver.lstrip("v")
    if not SEMVER_RE.match(version):
        sys.exit(f"Error: {raw_ver!r} is not a valid version; expected X.Y.Z")
    print(f"New version:       {version}")

    rtype = args.release_type or derive_release_type(tag, version)
    print(f"Release type:      {rtype}")

    all_commits = commits_since(tag)
    if not all_commits:
        print("No commits since last release — nothing to add.")
        return

    enhancements, fixes = [], []
    for subject, body in all_commits:
        (fixes if is_fix(subject, body) else enhancements).append(subject)

    print(f"Enhancements: {len(enhancements)}, Fixes: {len(fixes)}")

    entry = build_entry(version, rtype, enhancements, fixes)

    if args.dry_run:
        print("\n--- CHANGELOG entry (dry run) ---")
        print(entry)
        return

    changelog = CHANGELOG_FILE.read_text()
    # Prepend directly — JS CHANGELOG has no top-level heading to skip past
    CHANGELOG_FILE.write_text(entry + "\n" + changelog)
    print(f"Updated {CHANGELOG_FILE}")


if __name__ == "__main__":
    main()

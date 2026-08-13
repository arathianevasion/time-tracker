#!/bin/bash
# Packages the two double-click launchers into a small zip, preserving Unix file permissions
# (a plain HTTP download can't set the executable bit a fresh Mac needs to run
# "Start Time Tracker.command" directly — zip is what carries that through Finder's extraction).
#
# This is a one-time thing per teammate, not a per-release thing: the launcher clones/pulls the
# real app itself, so ordinary code changes never require re-running this or re-sharing anything.
# Only re-run it if the launcher scripts themselves change.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT_DIR="$(pwd)/dist"
ZIP_PATH="$OUT_DIR/time-tracker-launcher.zip"

mkdir -p "$OUT_DIR"
chmod +x "Start Time Tracker.command"

rm -f "$ZIP_PATH"
zip -q "$ZIP_PATH" "Start Time Tracker.command" "Start Time Tracker.bat"

echo "Done: $ZIP_PATH"
echo "Share that file once per teammate (however you like — Slack, email, a GitHub Release, etc)."
echo "They unzip it, pick the file for their OS, and follow GETTING_STARTED.md from there."

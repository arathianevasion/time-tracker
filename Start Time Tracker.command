#!/bin/bash
cd "$(dirname "$0")" || exit 1

REPO_DIR="time-tracker"
REPO_URL="https://github.com/arathianevasion/time-tracker.git"

if ! command -v git >/dev/null 2>&1; then
  echo "======================================="
  echo "  Weekly Time Tracker"
  echo "======================================="
  echo ""
  echo "This app needs Git installed first — it's free, and only takes a couple of minutes."
  echo "(On a Mac, this may instead pop up an \"Install Command Line Tools\" prompt — that's"
  echo "the same thing, just follow that instead.)"
  echo ""
  echo "Opening the download page for you..."
  open "https://git-scm.com/downloads/mac" >/dev/null 2>&1
  echo ""
  echo "After installing it:"
  echo "  1. Close this window"
  echo "  2. Double-click this file again"
  echo ""
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "======================================="
  echo "  Weekly Time Tracker"
  echo "======================================="
  echo ""
  echo "First time here — downloading the app..."
  if ! git clone --quiet "$REPO_URL" "$REPO_DIR"; then
    echo ""
    echo "Download failed. Check your internet connection, then double-click this file again."
    read -r -p "Press Enter to close this window..."
    exit 1
  fi
  echo ""
fi

cd "$REPO_DIR" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "======================================="
  echo "  Weekly Time Tracker"
  echo "======================================="
  echo ""
  echo "This app needs Node.js installed first — it's free, and only takes a couple of minutes."
  echo ""
  echo "Opening the download page for you..."
  open "https://nodejs.org/en/download" >/dev/null 2>&1
  echo ""
  echo "After installing it:"
  echo "  1. Close this window"
  echo "  2. Double-click this file again"
  echo ""
  read -r -p "Press Enter to close this window..."
  exit 1
fi

node scripts/setup.mjs
echo ""
read -r -p "Press Enter to close this window..."

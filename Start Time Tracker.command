#!/bin/bash
cd "$(dirname "$0")" || exit 1

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

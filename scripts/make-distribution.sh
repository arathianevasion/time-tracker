#!/bin/bash
# Builds a clean, teammate-ready zip: no node_modules/.git/.next/local data/credentials, and
# strips out the files that are specific to Andy's own setup (the migration seed script and the
# old prototype reference) rather than the general app.
set -euo pipefail
cd "$(dirname "$0")/.."

DIST_NAME="time-tracker"
OUT_DIR="$(pwd)/dist"
STAGING="$(mktemp -d)"
ZIP_PATH="$OUT_DIR/${DIST_NAME}-team-setup.zip"

mkdir -p "$OUT_DIR"

echo "Staging a clean copy..."
rsync -a \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next' \
  --exclude 'data' \
  --exclude '.env.local' \
  --exclude 'reference' \
  --exclude 'scripts/seed.ts' \
  --exclude 'src/lib/db/seed.ts' \
  --exclude 'dist' \
  --exclude '*.log' \
  --exclude '*.tsbuildinfo' \
  ./ "$STAGING/$DIST_NAME/"

chmod +x "$STAGING/$DIST_NAME/Start Time Tracker.command"

echo "Zipping..."
rm -f "$ZIP_PATH"
(cd "$STAGING" && zip -r -q "$ZIP_PATH" "$DIST_NAME")
rm -rf "$STAGING"

echo ""
echo "Done: $ZIP_PATH"
echo "Share that file — teammates unzip it and follow GETTING_STARTED.md (included inside)."

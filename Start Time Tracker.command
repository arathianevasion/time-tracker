#!/bin/bash
# Double-click entry point. All real logic lives in launcher.mjs, run by the Node binary bundled
# in runtime/ — nothing on this machine needs to be installed first.
cd "$(dirname "$0")" || exit 1

# Clears the Gatekeeper quarantine flag a browser download stamps on every file in the zip.
# Without this, macOS blocks the bundled Node binary and every .node native module from running.
xattr -dr com.apple.quarantine . 2>/dev/null

# --use-system-ca: on a corporate network with a TLS-inspecting proxy, the OS trusts a custom
# root CA that Node's own bundled cert store doesn't — without this, every HTTPS call (update
# checks, Jira itself) would fail with an opaque certificate error.
./runtime/node --use-system-ca launcher.mjs
echo ""
read -r -p "Press Enter to close this window..."

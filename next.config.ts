import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Pins Turbopack's root to this project — otherwise it walks up looking for a workspace root
// and finds an unrelated pnpm-workspace.yaml sitting in the home directory.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Self-contained deploy: server.js + only the node_modules files actually needed, so the
  // packaged app never runs `npm install` on a teammate's machine (see scripts/package.mjs).
  // Verified by inspecting a real build: better-sqlite3 is in Next's default
  // serverExternalPackages list, so its whole package directory — including the dynamically-
  // resolved prebuilds/*.node binaries (lib/binding.js) that static file tracing can't follow —
  // gets copied into .next/standalone wholesale, with no extra config needed.
  output: "standalone",
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Pins Turbopack's root to this project — otherwise it walks up looking for a workspace root
// and finds an unrelated pnpm-workspace.yaml sitting in the home directory.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;

/**
 * Runs once when the Next.js server starts, before it handles any request. Next auto-loads
 * .env.local on its own, but only ever from process.cwd() — in the packaged app that's app/,
 * not the relocated data directory (see src/lib/paths.ts) .env.local actually lives in. Loading
 * it explicitly here covers both the packaged app and plain `next dev`/`next start` in the repo
 * (where getUserDataDir() falls back to cwd and this is a harmless no-op re-load).
 */
export async function register() {
  // instrumentation.ts is compiled for both the Node and Edge runtimes (Next docs: "Specifying
  // the runtime"); loadLocalEnv uses node:fs/node:path, which the Edge runtime doesn't have, so
  // it must only run under Node. This app has no edge routes, but guard it anyway.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadLocalEnv } = await import("@/lib/env");
    loadLocalEnv();
  }
}

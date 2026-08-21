#!/usr/bin/env node
// Builds the zero-dependency distributable bundles for macOS (Apple Silicon) and Windows.
// Run only by Andy, only on his Mac: `node scripts/package.mjs`. Deliberately plain ESM using
// only Node built-ins, same spirit as the old scripts/setup.mjs it replaces.
//
// Produces, under dist/:
//   TimeTracker-mac-arm64.zip  — full first-run bundle for a macOS teammate (unzip + double-click)
//   TimeTracker-windows.zip    — full first-run bundle for a Windows teammate
//   app.zip                    — just app/, the auto-update payload. Platform-independent (it
//                                 carries every better-sqlite3 prebuild, not just one), so it's
//                                 the same asset both platforms' launchers pull on update.
//   VERSION.txt                — plain text version string, matches package.json
//
// Publish with: gh release create v<version> dist/TimeTracker-mac-arm64.zip
//   dist/TimeTracker-windows.zip dist/app.zip dist/VERSION.txt

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = path.join(ROOT, ".cache");
const DIST_DIR = path.join(ROOT, "dist");
const STAGE_DIR = path.join(DIST_DIR, "stage");
const NODE_VERSION = "v24.19.0";

// better-sqlite3's own prebuild name per platform+arch (node_modules/better-sqlite3/prebuilds/*).
const BETTER_SQLITE3_PREBUILDS = ["darwin-arm64.node", "darwin-x64.node", "win32-x64.node", "win32-arm64.node"];

const TARGETS = [
  {
    name: "mac-arm64",
    nodeArchiveName: `node-${NODE_VERSION}-darwin-arm64.tar.gz`,
    nodeBinaryInArchive: `node-${NODE_VERSION}-darwin-arm64/bin/node`,
    runtimeBinaryName: "node",
    zipName: "TimeTracker-mac-arm64.zip",
    launcherFile: "Start Time Tracker.command",
    isArchiveTarGz: true,
    prebuild: "darwin-arm64.node",
  },
  {
    name: "windows-x64",
    nodeArchiveName: `node-${NODE_VERSION}-win-x64.zip`,
    nodeBinaryInArchive: `node-${NODE_VERSION}-win-x64/node.exe`,
    runtimeBinaryName: "node.exe",
    zipName: "TimeTracker-windows.zip",
    launcherFile: "Start Time Tracker.bat",
    isArchiveTarGz: false,
    prebuild: "win32-x64.node",
  },
];

function log(msg) {
  console.log(msg);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
}

function appVersion() {
  return JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
}

// Turbopack's output-file-tracing gives at least one server route its own independently-
// resolved copy of better-sqlite3, in a content-hash-named folder under .next/ — a *relative*
// symlink back to the real node_modules/better-sqlite3 at build time. fs.cpSync doesn't
// preserve that relative target when copying the build around: it re-resolves the symlink to
// an absolute path pointing at THIS checkout's own .next/standalone, so after assembleApp()
// copies things into app/, the link silently keeps pointing at the original, never-patched,
// single-prebuild build output instead of the copy patched two lines below. zip then
// dereferences it at pack time and bakes in whichever one prebuild happened to be on the build
// machine — every other platform's bundle gets a copy of better-sqlite3 that can't load.
function findNestedBetterSqlite3Copies(nextDir) {
  if (!existsSync(nextDir)) return [];
  return readdirSync(nextDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.name.startsWith("better-sqlite3-") && (entry.isDirectory() || entry.isSymbolicLink()))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

/** Swaps each nested copy found under nextDir for a real (non-symlink) copy of canonicalDir, so
 * every later cpSync/prune/zip step treats it as an ordinary, self-contained folder. */
function realizeNestedCopies(nextDir, canonicalDir) {
  for (const nestedCopy of findNestedBetterSqlite3Copies(nextDir)) {
    rmSync(nestedCopy, { recursive: true, force: true });
    cpSync(canonicalDir, nestedCopy, { recursive: true });
  }
}

function pruneToPrebuild(prebuildsDir, keep) {
  for (const prebuild of BETTER_SQLITE3_PREBUILDS) {
    if (prebuild !== keep) rmSync(path.join(prebuildsDir, prebuild), { force: true });
  }
}

// --- 1. Build -------------------------------------------------------------------------------

function buildNext() {
  log("Building Next.js app (output: standalone)...");
  rmSync(path.join(ROOT, ".next"), { recursive: true, force: true });
  run("npm", ["run", "build"]);
  if (!existsSync(path.join(ROOT, ".next", "standalone"))) {
    throw new Error("Expected .next/standalone after build — check next.config.ts has output: 'standalone'.");
  }
}

// --- 2. Assemble app/, shared by both platforms ----------------------------------------------

function assembleApp() {
  log("Assembling app/...");
  const appDir = path.join(STAGE_DIR, "app");
  rmSync(appDir, { recursive: true, force: true });
  mkdirSync(appDir, { recursive: true });

  cpSync(path.join(ROOT, ".next", "standalone"), appDir, { recursive: true });
  // The standalone output doesn't copy these itself (Next expects a CDN to serve them) — the
  // packaged app serves them itself, so they need to be alongside server.js.
  cpSync(path.join(ROOT, ".next", "static"), path.join(appDir, ".next", "static"), { recursive: true });
  if (existsSync(path.join(ROOT, "public"))) {
    cpSync(path.join(ROOT, "public"), path.join(appDir, "public"), { recursive: true });
  }

  // `sharp` (via `@img/*`) gets traced in even though this app never imports next/image —
  // confirmed by grep. It's macOS-only native code (~18 MB of .dylib) that would sit dead in
  // every bundle, including the Windows one. Never used, safe to drop.
  rmSync(path.join(appDir, "node_modules", "sharp"), { recursive: true, force: true });
  rmSync(path.join(appDir, "node_modules", "@img"), { recursive: true, force: true });

  // Verified by inspecting a real build: Next's file tracer only copies the ONE prebuild that
  // was actually require()'d during the trace on the build machine (better-sqlite3's own
  // lib/binding.js picks its target file at require-time based on process.platform/arch) — NOT
  // all platforms' prebuilds. Left alone, the Windows bundle would silently ship the Mac's
  // darwin-arm64.node and be missing win32-x64.node entirely. Force every prebuild in
  // explicitly so app/ (and app.zip, the shared update payload) is complete regardless of what
  // the trace picked up; assembleTarget() below prunes each per-platform first-run bundle back
  // down to the single file it actually needs.
  const prebuildsDir = path.join(appDir, "node_modules", "better-sqlite3", "prebuilds");
  mkdirSync(prebuildsDir, { recursive: true });
  for (const prebuild of BETTER_SQLITE3_PREBUILDS) {
    const src = path.join(ROOT, "node_modules", "better-sqlite3", "prebuilds", prebuild);
    if (existsSync(src)) cpSync(src, path.join(prebuildsDir, prebuild));
  }

  // See findNestedBetterSqlite3Copies() — Turbopack gives some routes their own separately-
  // resolved copy of better-sqlite3 that the loop above never touches.
  realizeNestedCopies(path.join(appDir, ".next"), path.join(appDir, "node_modules", "better-sqlite3"));

  // No codesign step needed: verified `codesign -dvvv` on the darwin-arm64 prebuild shows it's
  // already ad-hoc, linker-signed out of the box, which satisfies Apple Silicon's mandatory-
  // signing rule. Gatekeeper's actual objection to a downloaded bundle is the quarantine flag,
  // which the .command launcher clears on first run — not the module's code signature.

  return appDir;
}

function zipAppForUpdate(appDir) {
  const out = path.join(DIST_DIR, "app.zip");
  rmSync(out, { force: true });
  // Zip app/'s *contents*, not app/ itself — the launcher extracts this directly over app/.
  run("zip", ["-r", "-q", out, "."], { cwd: appDir });
  log(`Wrote ${path.relative(ROOT, out)}`);
  return out;
}

// --- 3. Node runtime download -----------------------------------------------------------------

async function ensureCached(archiveName) {
  const dest = path.join(CACHE_DIR, archiveName);
  if (existsSync(dest)) return dest;
  mkdirSync(CACHE_DIR, { recursive: true });
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${archiveName}`;
  log(`Downloading ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/** Extracts exactly one member from an archive to destPath, without unpacking the rest. */
function extractSingleFile(archivePath, memberPath, destPath, isTarGz) {
  mkdirSync(path.dirname(destPath), { recursive: true });
  const fd = openSync(destPath, "w");
  try {
    const result = isTarGz
      ? spawnSync("tar", ["-xOf", archivePath, memberPath], { stdio: ["ignore", fd, "inherit"] })
      : spawnSync("unzip", ["-p", archivePath, memberPath], { stdio: ["ignore", fd, "inherit"] });
    if (result.status !== 0) throw new Error(`Extracting ${memberPath} from ${archivePath} failed`);
  } finally {
    closeSync(fd);
  }
}

// --- 4. Assemble + zip each platform bundle -----------------------------------------------

/** Writes a copy of the .bat launcher with CRLF line endings — cmd.exe / Notepad expect it. */
function writeCrlf(srcPath, destPath) {
  const content = readFileSync(srcPath, "utf8").replace(/\r?\n/g, "\r\n");
  writeFileSync(destPath, content);
}

async function assembleTarget(target, appDir) {
  log(`Assembling ${target.name}...`);
  const targetStageDir = path.join(STAGE_DIR, target.name);
  rmSync(targetStageDir, { recursive: true, force: true });
  const bundleRoot = path.join(targetStageDir, "Time Tracker");
  mkdirSync(bundleRoot, { recursive: true });

  cpSync(appDir, path.join(bundleRoot, "app"), { recursive: true });
  cpSync(path.join(ROOT, "launcher.mjs"), path.join(bundleRoot, "launcher.mjs"));
  // Ships inside the zip itself — a teammate who only ever gets the zip (not a repo checkout)
  // still needs these instructions, especially the Gatekeeper/SmartScreen first-launch steps.
  cpSync(path.join(ROOT, "GETTING_STARTED.md"), path.join(bundleRoot, "GETTING_STARTED.md"));
  writeFileSync(path.join(bundleRoot, "VERSION"), appVersion() + "\n");

  // Prune every prebuild except this platform's own — each first-run bundle only ever runs on
  // one platform, so shipping the other three saves ~6 MB and removes any ambiguity about which
  // one actually loads. (app.zip, the shared update payload, keeps all of them — see assembleApp.)
  const prebuildsDir = path.join(bundleRoot, "app", "node_modules", "better-sqlite3", "prebuilds");
  pruneToPrebuild(prebuildsDir, target.prebuild);
  if (!existsSync(path.join(prebuildsDir, target.prebuild))) {
    throw new Error(`Missing better-sqlite3 prebuild for ${target.name}: ${target.prebuild}`);
  }

  // Same prune, applied to Turbopack's separately-resolved copy(ies) — see realizeNestedCopies()
  // in assembleApp(). Without this, each first-run bundle would carry all 4 prebuilds a second
  // time at the nested path instead of just the one it actually needs.
  for (const nestedCopy of findNestedBetterSqlite3Copies(path.join(bundleRoot, "app", ".next"))) {
    pruneToPrebuild(path.join(nestedCopy, "prebuilds"), target.prebuild);
  }

  const launcherSrc = path.join(ROOT, target.launcherFile);
  const launcherDest = path.join(bundleRoot, target.launcherFile);
  if (target.launcherFile.endsWith(".bat")) {
    writeCrlf(launcherSrc, launcherDest);
  } else {
    cpSync(launcherSrc, launcherDest);
    chmodSync(launcherDest, 0o755);
  }

  const archivePath = await ensureCached(target.nodeArchiveName);
  const runtimeBinaryPath = path.join(bundleRoot, "runtime", target.runtimeBinaryName);
  extractSingleFile(archivePath, target.nodeBinaryInArchive, runtimeBinaryPath, target.isArchiveTarGz);
  if (target.runtimeBinaryName === "node") {
    chmodSync(runtimeBinaryPath, 0o755);
  }

  return bundleRoot;
}

function zipBundle(bundleRoot, zipName) {
  const out = path.join(DIST_DIR, zipName);
  rmSync(out, { force: true });
  // Run from the bundle's parent so the zip's top-level entry is "Time Tracker/", matching what
  // GETTING_STARTED.md tells teammates to expect after unzipping.
  run("zip", ["-r", "-q", out, "Time Tracker"], { cwd: path.dirname(bundleRoot) });
  log(`Wrote ${path.relative(ROOT, out)}`);
}

// --- main -----------------------------------------------------------------------------------

async function main() {
  mkdirSync(DIST_DIR, { recursive: true });

  buildNext();
  const appDir = assembleApp();
  zipAppForUpdate(appDir);

  for (const target of TARGETS) {
    const bundleRoot = await assembleTarget(target, appDir);
    zipBundle(bundleRoot, target.zipName);
  }

  const version = appVersion();
  writeFileSync(path.join(DIST_DIR, "VERSION.txt"), version + "\n");
  log(`Wrote dist/VERSION.txt (${version})`);

  rmSync(STAGE_DIR, { recursive: true, force: true });

  log("\nDone. Publish with:");
  log(`  gh release create v${version} dist/TimeTracker-mac-arm64.zip dist/TimeTracker-windows.zip dist/app.zip dist/VERSION.txt`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});

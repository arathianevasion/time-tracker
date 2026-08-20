#!/usr/bin/env node
// Everyday launcher for the packaged Weekly Time Tracker. Run by the bundled Node runtime
// (runtime/node or runtime/node.exe) — no system Node, no npm install, no Git required.
// See scripts/package.mjs for how this file ends up next to app/ and runtime/, and
// docs/PRD.md §5.3 for the distribution model.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(BUNDLE_ROOT, "app");
const IS_WINDOWS = process.platform === "win32";
const NODE_BIN = path.join(BUNDLE_ROOT, "runtime", IS_WINDOWS ? "node.exe" : "node");

// Stable CDN-served redirect, not the GitHub REST API — the API's 60 req/hr unauthenticated
// limit is per IP, and a whole team behind one corporate NAT would exhaust it in a morning.
const RELEASE_BASE = "https://github.com/arathianevasion/time-tracker/releases/latest/download";

function log(msg = "") {
  console.log(msg);
}

function currentVersion() {
  try {
    return readFileSync(path.join(BUNDLE_ROOT, "VERSION"), "utf8").trim();
  } catch {
    return "0.0.0";
  }
}

/** Per-user data directory, outside the bundle, so an update can replace app/ without touching it. */
function getUserDataDir() {
  // %LOCALAPPDATA%, not %APPDATA% — APPDATA is the *roaming* profile, which on a domain-joined
  // corporate machine gets synced to a file server on logoff/logon. A WAL-mode SQLite file in
  // there means slow logoffs and real corruption risk. LOCALAPPDATA never roams.
  const dir = IS_WINDOWS
    ? path.join(
        process.env.LOCALAPPDATA ?? process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Local"),
        "WeeklyTimeTracker",
      )
    : path.join(os.homedir(), "Library", "Application Support", "WeeklyTimeTracker");
  mkdirSync(dir, { recursive: true });
  return dir;
}

// --- self-update, over plain HTTPS, never blocking startup on failure ------------------------

async function checkForUpdate() {
  try {
    const res = await fetch(`${RELEASE_BASE}/VERSION.txt`);
    if (!res.ok) return;
    const latest = (await res.text()).trim();
    const current = currentVersion();
    if (!latest || latest === current) {
      log("Already up to date.\n");
      return;
    }
    log(`Found an update (${current} -> ${latest}) — installing...`);
    await applyUpdate();
    writeFileSync(path.join(BUNDLE_ROOT, "VERSION"), latest + "\n");
    log("Updated.\n");
  } catch {
    log("Couldn't check for updates (no internet, or the update itself failed) — continuing with what you have.\n");
  }
}

/** Downloads the new app/ into a staging folder and only swaps it in once fully extracted. */
async function applyUpdate() {
  const zipPath = path.join(os.tmpdir(), `tt-update-${Date.now()}.zip`);
  const res = await fetch(`${RELEASE_BASE}/app.zip`);
  if (!res.ok) throw new Error(`Update download failed: ${res.status}`);
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));

  const newAppDir = path.join(BUNDLE_ROOT, "app.new");
  rmSync(newAppDir, { recursive: true, force: true });
  mkdirSync(newAppDir, { recursive: true });

  // Windows 10 1803+ ships a libarchive-backed tar.exe that auto-detects zip; macOS ships unzip.
  const extract = IS_WINDOWS
    ? spawnSync("tar", ["-xf", zipPath, "-C", newAppDir], { stdio: "inherit" })
    : spawnSync("unzip", ["-q", zipPath, "-d", newAppDir], { stdio: "inherit" });
  rmSync(zipPath, { force: true });
  if (extract.status !== 0) throw new Error("Extracting the update failed");

  const backupDir = path.join(BUNDLE_ROOT, "app.old");
  rmSync(backupDir, { recursive: true, force: true });
  if (existsSync(APP_DIR)) renameSync(APP_DIR, backupDir);
  renameSync(newAppDir, APP_DIR);
  rmSync(backupDir, { recursive: true, force: true });
}

// --- port selection -----------------------------------------------------------------------

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function pickPort() {
  for (let port = 3000; port <= 3010; port++) {
    if (await isPortFree(port)) return port;
  }
  return 3000; // give up gracefully — the server itself will report the conflict if so
}

// --- launch ---------------------------------------------------------------------------------

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status) return true; // any HTTP response at all means the server is up
    } catch {
      // not ready yet — keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function openBrowser(url) {
  try {
    if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore" });
    else if (IS_WINDOWS) spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", shell: true });
    else spawn("xdg-open", [url], { stdio: "ignore" });
  } catch {
    // non-fatal — the URL is printed either way
  }
}

async function main() {
  log("=======================================");
  log("  Weekly Time Tracker");
  log("=======================================\n");

  if (IS_WINDOWS && BUNDLE_ROOT.length > 100) {
    log("Note: this folder is nested pretty deep, which can hit Windows' path-length limit.");
    log("If the app fails to start, try moving this folder somewhere shorter, like your Desktop.\n");
  }

  const dataDir = getUserDataDir();
  await checkForUpdate();

  const port = await pickPort();
  const serverPath = path.join(APP_DIR, "server.js");

  log("Starting the app...");
  // --use-system-ca: this is the process that makes every Jira call (src/lib/jira/client.ts) —
  // on a corporate network with a TLS-inspecting proxy, it needs the OS trust store, not
  // Node's bundled one, or every call to Jira fails with an opaque certificate error.
  const child = spawn(NODE_BIN, ["--use-system-ca", serverPath], {
    cwd: APP_DIR,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", TT_DATA_DIR: dataDir },
  });

  const url = `http://127.0.0.1:${port}`;
  log("\nWaiting for the app to start...");
  const up = await waitForServer(`${url}/api/jira/verify`);
  if (up) {
    log(`\nOpening ${url} in your browser...`);
    openBrowser(url);
    log("\nKeep this window open while you use the app.");
    log("Close it (or press Ctrl+C) when you're done for the day.");
  } else {
    log("\nThe app didn't respond in time — check the messages above for errors, or contact Andy.");
  }

  child.on("exit", (code) => process.exit(code ?? 0));
}

main();

#!/usr/bin/env node
// Guided first-time setup AND everyday launcher for the Weekly Time Tracker.
// Deliberately plain ESM using only Node built-ins (no project deps) so it can run — and can run
// `npm install` itself — before node_modules exists.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const JIRA_BASE_URL = "https://integritymarketing.atlassian.net";
const DEFAULT_PROJECT_KEYS = ["PM"];
const DEFAULT_WEEKLY_HOURS_TARGET = 40;
const PORT = 3000;

function log(msg = "") {
  console.log(msg);
}

function divider() {
  log("─".repeat(60));
}

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

// A single, lazily-created, reused readline interface for the whole script, consumed via the
// 'line' event into a queue rather than repeated .question() calls. readline.question() is only
// reliable for a single prompt against non-TTY (piped/redirected) input — a second .question()
// call never fires its callback even though more input is waiting, a known readline quirk.
let sharedRl = null;
let lineQueue = [];
let lineWaiters = [];

function getReadline() {
  if (sharedRl) return sharedRl;
  sharedRl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  sharedRl.on("line", (line) => {
    if (lineWaiters.length > 0) lineWaiters.shift()(line);
    else lineQueue.push(line);
  });
  return sharedRl;
}

function closeReadline() {
  if (sharedRl) {
    sharedRl.close();
    sharedRl = null;
  }
}

function readLine() {
  getReadline();
  if (lineQueue.length > 0) return Promise.resolve(lineQueue.shift());
  return new Promise((resolve) => lineWaiters.push(resolve));
}

function ask(promptText) {
  process.stdout.write(promptText);
  return readLine().then((line) => line.trim());
}

// Named by char code rather than embedding literal control characters in the source, which are
// invisible in most editors/diffs and easy to mangle by accident.
const KEY_ENTER = 13; // carriage return
const KEY_NEWLINE = 10;
const KEY_CTRL_D = 4; // EOT
const KEY_CTRL_C = 3; // ETX
const KEY_BACKSPACE = 127; // DEL
const KEY_BACKSPACE_ALT = 8;

// Masks each typed character with "*". Falls back to plain readline when stdin isn't a real
// terminal (e.g. piped input during testing) since raw mode isn't available there.
function askHidden(promptText) {
  if (!isInteractive()) return ask(promptText);

  closeReadline(); // release stdin from readline's control before taking it over in raw mode

  return new Promise((resolve) => {
    process.stdout.write(promptText);
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
    };

    const onData = (char) => {
      const code = char.charCodeAt(0);
      if (code === KEY_ENTER || code === KEY_NEWLINE || code === KEY_CTRL_D) {
        cleanup();
        process.stdout.write("\n");
        resolve(value.trim());
      } else if (code === KEY_CTRL_C) {
        cleanup();
        process.stdout.write("\n");
        process.exit(1);
      } else if (code === KEY_BACKSPACE || code === KEY_BACKSPACE_ALT) {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        value += char;
        process.stdout.write("*");
      }
    };
    process.stdin.on("data", onData);
  });
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) {
    log(`This app needs a newer version of Node.js (you have ${process.version}).`);
    log("Please update Node.js from https://nodejs.org and try again.");
    process.exit(1);
  }
}

function ensureDependencies() {
  if (existsSync(path.join(ROOT, "node_modules", "better-sqlite3"))) return;
  log("Installing app dependencies (this can take a minute the first time)...");
  const result = spawnSync("npm", ["install"], { cwd: ROOT, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    log("\nSomething went wrong installing dependencies. Please contact Andy with the message above.");
    process.exit(1);
  }
}

function readExistingCreds() {
  if (!existsSync(ENV_PATH)) return null;
  const contents = readFileSync(ENV_PATH, "utf8");
  const email = /^JIRA_EMAIL=(.*)$/m.exec(contents)?.[1]?.trim();
  const token = /^JIRA_API_TOKEN=(.*)$/m.exec(contents)?.[1]?.trim();
  if (email && token && !email.includes("example.com") && !token.includes("your-api-token")) {
    return { email, token };
  }
  return null;
}

async function verifyJira(email, token) {
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  try {
    const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/myself`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Jira said (${res.status}): ${text.slice(0, 200)}` };
    }
    const me = await res.json();
    return { ok: true, accountId: me.accountId, displayName: me.displayName };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function collectCredentials() {
  divider();
  log("Let's connect this to YOUR Jira account.");
  log("");
  log("1. Open this link in your browser:");
  log("   https://id.atlassian.com/manage-profile/security/api-tokens");
  log('2. Click "Create API token", give it any name (e.g. "Time Tracker"), then copy it.');
  log("3. Come back here and paste it in when asked below.");
  log("   (Tokens expire after a year — if this ever stops working, come back to this step.)");
  divider();
  log("");

  for (let attempt = 1; attempt <= 5; attempt++) {
    const email = await ask("Your Jira email address: ");
    const token = await askHidden("Your Jira API token (hidden as you type): ");
    log("Checking...");
    const result = await verifyJira(email, token);
    if (result.ok) {
      log(`Connected as ${result.displayName}.\n`);
      return { email, token };
    }
    log(`That didn't work: ${result.error}`);
    log("Double check the email and token (watch for extra spaces), then try again.\n");
  }
  log("Still couldn't connect after several tries. Please contact Andy for help.");
  process.exit(1);
}

function writeEnvFile(email, token) {
  writeFileSync(ENV_PATH, `JIRA_BASE_URL=${JIRA_BASE_URL}\nJIRA_EMAIL=${email}\nJIRA_API_TOKEN=${token}\n`, "utf8");
}

function startDevServer() {
  closeReadline(); // hand stdin over to the child cleanly rather than leaving it attached to us
  log("Starting the app...");
  const child = spawn("npm", ["run", "dev"], { cwd: ROOT, stdio: "inherit", shell: true });
  child.on("exit", (code) => process.exit(code ?? 0));
  return child;
}

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

async function configureDefaultSettings() {
  try {
    const current = await fetch(`http://localhost:${PORT}/api/settings`).then((r) => r.json());
    if (current.defaultProjectKeys?.length) return; // already configured — don't stomp on it
    await fetch(`http://localhost:${PORT}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultProjectKeys: DEFAULT_PROJECT_KEYS,
        weeklyHoursTarget: DEFAULT_WEEKLY_HOURS_TARGET,
      }),
    });
  } catch {
    // non-fatal — Settings can always be configured from within the app
  }
}

function openBrowser(url) {
  try {
    if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore" });
    else if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { stdio: "ignore" });
    else spawn("xdg-open", [url], { stdio: "ignore" });
  } catch {
    // non-fatal — the URL is printed either way
  }
}

async function main() {
  log("=======================================");
  log("  Weekly Time Tracker");
  log("=======================================\n");

  checkNodeVersion();
  ensureDependencies();

  let creds = readExistingCreds();
  if (creds) {
    log(`Found a saved login for ${creds.email}. Checking it still works...`);
    const check = await verifyJira(creds.email, creds.token);
    if (check.ok) {
      log(`Still good (connected as ${check.displayName}).\n`);
    } else {
      log(`That saved login isn't working anymore: ${check.error}\n`);
      creds = null;
    }
  }
  if (!creds) {
    creds = await collectCredentials();
    writeEnvFile(creds.email, creds.token);
  }

  startDevServer();

  const url = `http://localhost:${PORT}`;
  log("\nWaiting for the app to start...");
  const up = await waitForServer(`${url}/api/jira/verify`);
  if (!up) {
    log("\nThe app didn't respond in time — check the messages above for errors, or contact Andy.");
    return;
  }

  await configureDefaultSettings();

  log(`\nAll set! Opening ${url} in your browser...`);
  openBrowser(url);
  log("\nKeep this window open while you use the app.");
  log("Close it (or press Ctrl+C) when you're done for the day.");
}

main();

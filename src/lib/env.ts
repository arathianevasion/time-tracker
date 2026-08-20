import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getUserDataDir } from "./paths";

/**
 * Loads .env.local for standalone scripts and for the packaged app (see src/instrumentation.ts)
 * — Next's own automatic env-file loading only ever looks at process.cwd(), which in the
 * packaged app is app/, not the relocated data directory .env.local actually lives in.
 */
export function loadLocalEnv(filename = ".env.local") {
  const path = resolve(getUserDataDir(), filename);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/**
 * Updates KEY=VALUE lines in .env.local, preserving any other lines and their order. Locks the
 * file to owner-only read/write (600) on every write — it's plaintext, so this at least keeps
 * other local accounts on the machine from reading it.
 */
export function writeLocalEnv(updates: Record<string, string>, filename = ".env.local") {
  const dataDir = getUserDataDir();
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const path = resolve(dataDir, filename);
  const remaining = new Map(Object.entries(updates));
  const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];

  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (!remaining.has(key)) return line;
    const value = remaining.get(key)!;
    remaining.delete(key);
    return `${key}=${value}`;
  });

  if (next.length && next[next.length - 1] === "") next.pop();
  for (const [key, value] of remaining) next.push(`${key}=${value}`);

  writeFileSync(path, next.join("\n") + "\n", "utf8");
  chmodSync(path, 0o600);
}

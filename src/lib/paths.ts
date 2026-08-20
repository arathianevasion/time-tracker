/**
 * Where this install keeps its DB and credentials. The packaged launcher sets TT_DATA_DIR to a
 * per-user location outside the app/ folder (e.g. ~/Library/Application Support/WeeklyTimeTracker
 * or %APPDATA%\WeeklyTimeTracker), so a routine update can replace app/ wholesale without
 * touching anyone's data. Unset in development, where cwd is the repo root and data/ +
 * .env.local stay exactly where they've always been.
 */
export function getUserDataDir(): string {
  return process.env.TT_DATA_DIR ?? process.cwd();
}

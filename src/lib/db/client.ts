import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SCHEMA_SQL } from "./schema";

const DB_PATH = resolve(process.cwd(), "data", "time-tracker.db");

// Survive Next.js dev-server hot reload without opening a second connection to the same file.
const globalForDb = globalThis as unknown as { __ttDb?: Database.Database };

function open(): Database.Database {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  db.prepare("INSERT OR IGNORE INTO settings (id) VALUES (1)").run();
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__ttDb) {
    globalForDb.__ttDb = open();
  }
  return globalForDb.__ttDb;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  default_project_keys  TEXT NOT NULL DEFAULT '[]',
  weekly_hours_target   REAL NOT NULL DEFAULT 40,
  account_id            TEXT
);

CREATE TABLE IF NOT EXISTS baseline_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_key         TEXT NOT NULL UNIQUE,
  issue_summary     TEXT NOT NULL,
  pct               REAL NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  issue_type        TEXT,
  expense_category  TEXT
);

CREATE TABLE IF NOT EXISTS weeks (
  week_start  TEXT PRIMARY KEY,          -- 'YYYY-MM-DD', Monday
  workdays    TEXT NOT NULL,             -- JSON array of 'YYYY-MM-DD'
  logged_at   TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS week_rows (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start        TEXT NOT NULL REFERENCES weeks(week_start) ON DELETE CASCADE,
  issue_key         TEXT NOT NULL,
  issue_summary     TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('baseline', 'one_off')),
  pct               REAL,                   -- baseline rows only
  flat_hours        REAL,                   -- one_off rows only
  one_off_date      TEXT,                   -- one_off rows only, 'YYYY-MM-DD' within the week
  sort_order        INTEGER NOT NULL DEFAULT 0,
  issue_type        TEXT,
  expense_category  TEXT
);
CREATE INDEX IF NOT EXISTS idx_week_rows_week_start ON week_rows(week_start);

CREATE TABLE IF NOT EXISTS time_entries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start        TEXT NOT NULL REFERENCES weeks(week_start) ON DELETE CASCADE,
  week_row_ids      TEXT NOT NULL,       -- JSON array of week_rows.id that contributed to this entry
  issue_key         TEXT NOT NULL,
  issue_summary     TEXT NOT NULL,
  entry_date        TEXT NOT NULL,       -- 'YYYY-MM-DD'
  minutes           INTEGER NOT NULL CHECK (minutes > 0),
  jira_worklog_id   TEXT,
  sync_status       TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error', 'deleting')),
  sync_error        TEXT,
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (issue_key, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_time_entries_week_start ON time_entries(week_start);
`;

interface SqliteLike {
  prepare(sql: string): { all(): unknown[] };
  exec(sql: string): unknown;
}

/**
 * Adds columns to already-existing tables that predate them. CREATE TABLE IF NOT EXISTS (above)
 * only affects brand-new databases — an existing table silently keeps its old column set unless
 * migrated explicitly. Idempotent and safe to run on every startup.
 */
export function runMigrations(db: SqliteLike): void {
  const ensureColumn = (table: string, column: string, definition: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  for (const table of ["baseline_items", "week_rows"]) {
    ensureColumn(table, "issue_type", "TEXT");
    ensureColumn(table, "expense_category", "TEXT");
  }
}

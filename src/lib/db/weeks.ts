import { getDb } from "./client";
import { listBaseline } from "./baseline";
import type { WeekRecord, WeekRow } from "./types";

interface WeekMetaRow {
  week_start: string;
  workdays: string;
  logged_at: string | null;
}

interface WeekRowRow {
  id: number;
  week_start: string;
  issue_key: string;
  issue_summary: string;
  kind: "baseline" | "one_off";
  pct: number | null;
  flat_hours: number | null;
  one_off_date: string | null;
  sort_order: number;
  issue_type: string | null;
  expense_category: string | null;
}

function rowFromDb(row: WeekRowRow): WeekRow {
  return {
    id: row.id,
    weekStart: row.week_start,
    issueKey: row.issue_key,
    issueSummary: row.issue_summary,
    kind: row.kind,
    pct: row.pct,
    flatHours: row.flat_hours,
    oneOffDate: row.one_off_date,
    sortOrder: row.sort_order,
    issueType: row.issue_type,
    expenseCategory: row.expense_category,
  };
}

function loadRows(weekStart: string): WeekRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM week_rows WHERE week_start = ? ORDER BY sort_order ASC, id ASC")
    .all(weekStart) as WeekRowRow[];
  return rows.map(rowFromDb);
}

export function getWeek(weekStart: string): WeekRecord | null {
  const meta = getDb().prepare("SELECT * FROM weeks WHERE week_start = ?").get(weekStart) as
    | WeekMetaRow
    | undefined;
  if (!meta) return null;
  return {
    weekStart: meta.week_start,
    workdays: JSON.parse(meta.workdays),
    loggedAt: meta.logged_at,
    rows: loadRows(weekStart),
  };
}

/** Creates the week (seeded from the current baseline) if it doesn't already exist. */
export function ensureWeek(weekStart: string, defaultWorkdays: string[]): WeekRecord {
  const existing = getWeek(weekStart);
  if (existing) return existing;

  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO weeks (week_start, workdays) VALUES (?, ?)").run(
      weekStart,
      JSON.stringify(defaultWorkdays),
    );
    seedBaselineRows(weekStart);
  });
  tx();

  return getWeek(weekStart)!;
}

function seedBaselineRows(weekStart: string) {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO week_rows (week_start, issue_key, issue_summary, kind, pct, sort_order, issue_type, expense_category)
     VALUES (?, ?, ?, 'baseline', ?, ?, ?, ?)`,
  );
  // Copies type/category straight from the baseline rather than re-querying Jira — the baseline
  // is the source of truth for this issue's metadata as of when it was last added/refreshed there.
  listBaseline().forEach((item, i) =>
    insert.run(weekStart, item.issueKey, item.issueSummary, item.pct, i, item.issueType, item.expenseCategory),
  );
}

/** Replaces this week's baseline-kind rows with a fresh copy of the current baseline. One-off rows are untouched. */
export function resetBaselineRows(weekStart: string): WeekRecord {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM week_rows WHERE week_start = ? AND kind = 'baseline'").run(weekStart);
    seedBaselineRows(weekStart);
  });
  tx();
  return getWeek(weekStart)!;
}

export function setWorkdays(weekStart: string, workdays: string[]): void {
  getDb()
    .prepare("UPDATE weeks SET workdays = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE week_start = ?")
    .run(JSON.stringify(workdays), weekStart);
}

export function markLogged(weekStart: string): void {
  getDb()
    .prepare(
      "UPDATE weeks SET logged_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE week_start = ?",
    )
    .run(weekStart);
}

export interface AddRowInput {
  issueKey: string;
  issueSummary: string;
  kind: "baseline" | "one_off";
  pct?: number;
  flatHours?: number;
  oneOffDate?: string;
  issueType?: string | null;
  expenseCategory?: string | null;
}

export function addRow(weekStart: string, input: AddRowInput): WeekRow {
  const db = getDb();
  const maxOrder = (
    db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM week_rows WHERE week_start = ?").get(weekStart) as {
      m: number;
    }
  ).m;
  const result = db
    .prepare(
      `INSERT INTO week_rows
         (week_start, issue_key, issue_summary, kind, pct, flat_hours, one_off_date, sort_order, issue_type, expense_category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      weekStart,
      input.issueKey,
      input.issueSummary,
      input.kind,
      input.pct ?? null,
      input.flatHours ?? null,
      input.oneOffDate ?? null,
      maxOrder + 1,
      input.issueType ?? null,
      input.expenseCategory ?? null,
    );
  return rowFromDb(
    db.prepare("SELECT * FROM week_rows WHERE id = ?").get(result.lastInsertRowid) as WeekRowRow,
  );
}

export interface UpdateRowInput {
  pct?: number;
  flatHours?: number;
  oneOffDate?: string;
}

export function updateRow(rowId: number, patch: UpdateRowInput): void {
  const db = getDb();
  const row = db.prepare("SELECT * FROM week_rows WHERE id = ?").get(rowId) as WeekRowRow | undefined;
  if (!row) throw new Error(`week_row ${rowId} not found`);

  db.prepare("UPDATE week_rows SET pct = ?, flat_hours = ?, one_off_date = ? WHERE id = ?").run(
    patch.pct ?? row.pct,
    patch.flatHours ?? row.flat_hours,
    patch.oneOffDate ?? row.one_off_date,
    rowId,
  );
}

export function removeRow(rowId: number): void {
  getDb().prepare("DELETE FROM week_rows WHERE id = ?").run(rowId);
}

/**
 * Weeks with at least one real worklog actually pushed to Jira — not just any week that has a
 * `weeks` row, which gets created merely from viewing/navigating to a week (including future
 * ones) via ensureWeek(). This is history, so it should only ever show real activity.
 */
export function listWeekStarts(limit = 16): string[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT w.week_start
       FROM weeks w
       JOIN time_entries te ON te.week_start = w.week_start
       WHERE te.jira_worklog_id IS NOT NULL
       ORDER BY w.week_start DESC
       LIMIT ?`,
    )
    .all(limit) as { week_start: string }[];
  return rows.map((r) => r.week_start);
}

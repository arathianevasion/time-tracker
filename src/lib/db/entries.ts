import { getDb } from "./client";
import type { SyncStatus, TimeEntry } from "./types";

interface TimeEntryRow {
  id: number;
  week_start: string;
  week_row_ids: string;
  issue_key: string;
  issue_summary: string;
  entry_date: string;
  minutes: number;
  jira_worklog_id: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  updated_at: string;
}

function fromRow(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    weekStart: row.week_start,
    weekRowIds: JSON.parse(row.week_row_ids),
    issueKey: row.issue_key,
    issueSummary: row.issue_summary,
    entryDate: row.entry_date,
    minutes: row.minutes,
    jiraWorklogId: row.jira_worklog_id,
    syncStatus: row.sync_status,
    syncError: row.sync_error,
    updatedAt: row.updated_at,
  };
}

export function listEntriesForWeek(weekStart: string): TimeEntry[] {
  const rows = getDb()
    .prepare("SELECT * FROM time_entries WHERE week_start = ? ORDER BY issue_key ASC, entry_date ASC")
    .all(weekStart) as TimeEntryRow[];
  return rows.map(fromRow);
}

export function listSyncable(weekStart: string): TimeEntry[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM time_entries WHERE week_start = ? AND sync_status IN ('pending', 'deleting') ORDER BY issue_key ASC, entry_date ASC",
    )
    .all(weekStart) as TimeEntryRow[];
  return rows.map(fromRow);
}

export interface DesiredEntry {
  issueKey: string;
  issueSummary: string;
  entryDate: string;
  minutes: number;
  weekRowIds: number[];
}

/**
 * Reconciles a week's time_entries against a freshly computed desired set (from the allocation engine).
 * Preserves jira_worklog_id on rows that already exist, so the next sync updates in place rather than
 * duplicating. Rows no longer desired are flipped to 'deleting' so sync removes them from Jira first.
 */
function entryKey(issueKey: string, entryDate: string): string {
  return `${issueKey}|${entryDate}`;
}

export function reconcileWeek(weekStart: string, desired: DesiredEntry[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    // Keyed by issueKey+date (matching the table's UNIQUE constraint) — keying by date alone
    // collapses every issue sharing a workday onto one map slot and corrupts other issues' rows.
    // Includes 'deleting' rows too: excluding them meant a removed-then-re-added entry tried to
    // INSERT a fresh row while the old 'deleting' row still occupied that unique slot, crashing
    // with a UNIQUE constraint violation.
    const existing = new Map(
      listEntriesForWeek(weekStart).map((e) => [entryKey(e.issueKey, e.entryDate), e] as const),
    );
    const desiredKeys = new Set(desired.map((d) => entryKey(d.issueKey, d.entryDate)));

    const insert = db.prepare(
      `INSERT INTO time_entries (week_start, week_row_ids, issue_key, issue_summary, entry_date, minutes, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    );
    const update = db.prepare(
      `UPDATE time_entries
       SET week_row_ids = ?, issue_summary = ?, minutes = ?, sync_status = 'pending', sync_error = NULL,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    );

    for (const d of desired) {
      const prior = existing.get(entryKey(d.issueKey, d.entryDate));
      if (!prior) {
        insert.run(weekStart, JSON.stringify(d.weekRowIds), d.issueKey, d.issueSummary, d.entryDate, d.minutes);
      } else if (prior.minutes !== d.minutes || prior.issueSummary !== d.issueSummary || prior.syncStatus === "deleting") {
        // The syncStatus === "deleting" case revives a row that was about to be removed but is
        // wanted again — reusing its id (and jira_worklog_id) so the next sync updates it in place.
        update.run(JSON.stringify(d.weekRowIds), d.issueSummary, d.minutes, prior.id);
      }
    }

    // Anything that existed before but isn't desired anymore gets removed from Jira on next sync.
    const markDeleting = db.prepare(
      "UPDATE time_entries SET sync_status = 'deleting', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    );
    const deleteLocal = db.prepare("DELETE FROM time_entries WHERE id = ?");
    for (const [key, entry] of existing) {
      if (desiredKeys.has(key)) continue;
      if (entry.syncStatus === "deleting") continue; // already correctly marked, don't re-touch
      if (entry.jiraWorklogId) markDeleting.run(entry.id);
      else deleteLocal.run(entry.id); // never synced — safe to drop immediately
    }
  });
  tx();
}

export function markSynced(id: number, worklogId: string): void {
  getDb()
    .prepare(
      "UPDATE time_entries SET jira_worklog_id = ?, sync_status = 'synced', sync_error = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    )
    .run(worklogId, id);
}

export function markError(id: number, message: string): void {
  getDb()
    .prepare(
      "UPDATE time_entries SET sync_status = 'error', sync_error = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    )
    .run(message, id);
}

export function deleteEntry(id: number): void {
  getDb().prepare("DELETE FROM time_entries WHERE id = ?").run(id);
}

export function getWeekTotals(weekStart: string): { totalMinutes: number; entryCount: number; syncedCount: number } {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(minutes), 0) AS total_minutes, COUNT(*) AS entry_count,
              SUM(CASE WHEN sync_status = 'synced' THEN 1 ELSE 0 END) AS synced_count
       FROM time_entries WHERE week_start = ? AND sync_status != 'deleting'`,
    )
    .get(weekStart) as { total_minutes: number; entry_count: number; synced_count: number | null };
  return { totalMinutes: row.total_minutes, entryCount: row.entry_count, syncedCount: row.synced_count ?? 0 };
}

import { getDb } from "./client";
import type { BaselineItem } from "./types";

interface BaselineRow {
  id: number;
  issue_key: string;
  issue_summary: string;
  pct: number;
  sort_order: number;
}

function fromRow(row: BaselineRow): BaselineItem {
  return {
    id: row.id,
    issueKey: row.issue_key,
    issueSummary: row.issue_summary,
    pct: row.pct,
    sortOrder: row.sort_order,
  };
}

export function listBaseline(): BaselineItem[] {
  const rows = getDb()
    .prepare("SELECT * FROM baseline_items ORDER BY sort_order ASC, id ASC")
    .all() as BaselineRow[];
  return rows.map(fromRow);
}

export class BaselineValidationError extends Error {}

/** Replaces the entire baseline. Percentages must sum to exactly 100 (within floating-point tolerance). */
export function replaceBaseline(items: { issueKey: string; issueSummary: string; pct: number }[]): BaselineItem[] {
  const total = items.reduce((sum, i) => sum + i.pct, 0);
  if (items.length === 0 || Math.abs(total - 100) > 0.01) {
    throw new BaselineValidationError(`Baseline percentages must sum to 100 (got ${total})`);
  }

  const db = getDb();
  const tx = db.transaction((rows: typeof items) => {
    db.prepare("DELETE FROM baseline_items").run();
    const insert = db.prepare(
      "INSERT INTO baseline_items (issue_key, issue_summary, pct, sort_order) VALUES (?, ?, ?, ?)",
    );
    rows.forEach((row, i) => insert.run(row.issueKey, row.issueSummary, row.pct, i));
  });
  tx(items);

  return listBaseline();
}

import { loadLocalEnv } from "../src/lib/env";
loadLocalEnv();

import { getDb } from "../src/lib/db/client";
import { fetchIssueMeta } from "../src/lib/jira/issues";

interface Row {
  id: number;
  issue_key: string;
}

async function main() {
  const db = getDb();

  const baselineRows = db.prepare("SELECT id, issue_key FROM baseline_items WHERE issue_type IS NULL").all() as Row[];
  const weekRows = db.prepare("SELECT id, issue_key FROM week_rows WHERE issue_type IS NULL").all() as Row[];

  const allKeys = [...new Set([...baselineRows, ...weekRows].map((r) => r.issue_key))];
  if (allKeys.length === 0) {
    console.log("Nothing to backfill — every row already has issue type / Expense Category set.");
    return;
  }

  console.log(`Fetching metadata for ${allKeys.length} issue(s): ${allKeys.join(", ")}`);
  const meta = await fetchIssueMeta(allKeys);

  const updateBaseline = db.prepare("UPDATE baseline_items SET issue_type = ?, expense_category = ? WHERE id = ?");
  const updateWeekRow = db.prepare("UPDATE week_rows SET issue_type = ?, expense_category = ? WHERE id = ?");

  let updated = 0;
  for (const row of baselineRows) {
    const m = meta.get(row.issue_key);
    if (!m) {
      console.log(`  no metadata found for ${row.issue_key} (baseline_items #${row.id}) — left as-is`);
      continue;
    }
    updateBaseline.run(m.issueType, m.expenseCategory, row.id);
    console.log(`  baseline_items #${row.id} ${row.issue_key}: ${m.issueType ?? "?"} / ${m.expenseCategory ?? "None"}`);
    updated++;
  }
  for (const row of weekRows) {
    const m = meta.get(row.issue_key);
    if (!m) {
      console.log(`  no metadata found for ${row.issue_key} (week_rows #${row.id}) — left as-is`);
      continue;
    }
    updateWeekRow.run(m.issueType, m.expenseCategory, row.id);
    console.log(`  week_rows #${row.id} ${row.issue_key}: ${m.issueType ?? "?"} / ${m.expenseCategory ?? "None"}`);
    updated++;
  }

  console.log(`\nBackfilled ${updated}/${baselineRows.length + weekRows.length} rows.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

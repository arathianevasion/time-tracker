import { reconcileWeek } from "../db/entries";
import { getSettings } from "../db/settings";
import { getWeek } from "../db/weeks";
import { allocateWeek, type AllocateWeekResult, type OneOffRowInput, type PercentRowInput } from "./allocate";

/** Runs the allocation engine for a week. Pure — no DB writes, no sync_status changes. */
export function previewWeek(weekStart: string): AllocateWeekResult {
  const week = getWeek(weekStart);
  if (!week) throw new Error(`Week ${weekStart} not found — call ensureWeek first`);

  const settings = getSettings();

  const percentRows: PercentRowInput[] = week.rows
    .filter((r) => r.kind === "baseline")
    .map((r) => ({ rowId: r.id, issueKey: r.issueKey, issueSummary: r.issueSummary, pct: r.pct ?? 0 }));

  const oneOffRows: OneOffRowInput[] = week.rows
    .filter((r) => r.kind === "one_off")
    .map((r) => ({
      rowId: r.id,
      issueKey: r.issueKey,
      issueSummary: r.issueSummary,
      flatHours: r.flatHours ?? 0,
      date: r.oneOffDate ?? week.workdays[0],
    }));

  return allocateWeek({
    workdays: week.workdays,
    weeklyHoursTarget: settings.weeklyHoursTarget,
    percentRows,
    oneOffRows,
  });
}

/**
 * Runs the allocation engine and reconciles the result into time_entries — use only when the
 * user actually changed something (an edit) or right before a real sync. Merely viewing a week
 * should use previewWeek instead, since persisting here can flip an unrelated, already-synced
 * entry's sync_status back to 'pending' if the computed day-shape differs at all from what's
 * stored, even when the row's weekly total is unchanged.
 */
export function materializeWeek(weekStart: string): AllocateWeekResult {
  const result = previewWeek(weekStart);
  reconcileWeek(weekStart, result.entries);
  return result;
}

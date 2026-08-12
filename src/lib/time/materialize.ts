import { reconcileWeek } from "../db/entries";
import { getSettings } from "../db/settings";
import { getWeek } from "../db/weeks";
import { allocateWeek, type AllocateWeekResult, type OneOffRowInput, type PercentRowInput } from "./allocate";

/** Runs the allocation engine for a week and reconciles the result into time_entries. */
export function materializeWeek(weekStart: string): AllocateWeekResult {
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

  const result = allocateWeek({
    workdays: week.workdays,
    weeklyHoursTarget: settings.weeklyHoursTarget,
    percentRows,
    oneOffRows,
  });

  reconcileWeek(weekStart, result.entries);
  return result;
}

import { getWeekTotals } from "../db/entries";
import { getWeek } from "../db/weeks";
import { currentWeekStart } from "./week";

export type WeekStatus = "unlogged" | "partial" | "logged" | "inprogress";

export function weekStatus(weekStart: string): WeekStatus {
  if (weekStart === currentWeekStart()) return "inprogress";

  const week = getWeek(weekStart);
  const totals = getWeekTotals(weekStart);
  if (!week || totals.entryCount === 0) return "unlogged";
  if (week.loggedAt && totals.syncedCount >= totals.entryCount) return "logged";
  return "partial";
}

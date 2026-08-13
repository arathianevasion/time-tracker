import { currentWeekStart } from "@/lib/time/week";
import type { WeekStatus } from "@/lib/time/status";
import type { WeekWithTotals } from "./api";

export function weekStatusFromRecord(week: WeekWithTotals): WeekStatus {
  const current = currentWeekStart();
  if (week.weekStart > current) return "future";
  if (week.weekStart === current) return "inprogress";
  if (week.totals.entryCount === 0) return "unlogged";
  if (week.loggedAt && week.totals.syncedCount >= week.totals.entryCount) return "logged";
  return "partial";
}

/**
 * Weekly allocation & rounding engine (PRD §6.3).
 *
 * All math is done in integer "quarters" (units of 0.25h) internally so nothing ever drifts —
 * converting a whole number of quarters to minutes (×15) or hours (×0.25) is always exact.
 */

export interface PercentRowInput {
  rowId: number;
  issueKey: string;
  issueSummary: string;
  pct: number;
}

export interface OneOffRowInput {
  rowId: number;
  issueKey: string;
  issueSummary: string;
  flatHours: number;
  date: string; // 'YYYY-MM-DD', must be one of `workdays`
}

export interface AllocateWeekInput {
  workdays: string[]; // 'YYYY-MM-DD', the week's selected working days
  weeklyHoursTarget: number; // e.g. 40 — dailyRate = weeklyHoursTarget / 5
  percentRows: PercentRowInput[];
  oneOffRows: OneOffRowInput[];
}

export interface AllocatedEntry {
  issueKey: string;
  issueSummary: string;
  entryDate: string;
  minutes: number;
  weekRowIds: number[];
}

export interface AllocateWeekResult {
  entries: AllocatedEntry[];
  weekTargetMinutes: number;
  oneOffMinutes: number;
  remainingPoolMinutes: number;
  percentSum: number; // sum of percentRows' pct — caller should validate this is ~100 before trusting the split
}

const QUARTER_HOUR = 15; // minutes

export function roundToQuarterHour(hours: number): number {
  return Math.round(hours * 4) / 4;
}

function hoursToQuarters(hours: number): number {
  return Math.round(hours * 4);
}

function quartersToMinutes(quarters: number): number {
  return quarters * QUARTER_HOUR;
}

/**
 * Largest-remainder apportionment: distributes `totalQuarters` across `weights` proportionally,
 * rounding each share down first, then handing out the leftover quarters one at a time to the
 * rows with the largest fractional remainder (ties broken by original order). Guarantees the
 * shares sum to exactly `totalQuarters`.
 */
function apportion(weights: number[], totalQuarters: number): number[] {
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0 || totalQuarters <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (w / weightSum) * totalQuarters);
  const base = exact.map(Math.floor);
  let leftover = totalQuarters - base.reduce((s, q) => s + q, 0);

  const order = exact
    .map((v, i) => ({ i, remainder: v - base[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

  const result = [...base];
  for (const { i } of order) {
    if (leftover <= 0) break;
    result[i] += 1;
    leftover -= 1;
  }
  return result;
}

export function allocateWeek(input: AllocateWeekInput): AllocateWeekResult {
  const dailyRateHours = roundToQuarterHour(input.weeklyHoursTarget / 5);
  const dailyRateQuarters = hoursToQuarters(dailyRateHours);
  const weekTargetQuarters = input.workdays.length * dailyRateQuarters;

  const oneOffQuarters = input.oneOffRows.map((r) => hoursToQuarters(r.flatHours));
  const oneOffQuartersTotal = oneOffQuarters.reduce((s, q) => s + q, 0);

  // Each workday's own remaining capacity for percent-based work, after that day's one-offs.
  // Floored at 0 rather than going negative — a day over-committed by one-offs alone just shrinks
  // the week's percent-based total; it doesn't borrow capacity from other days.
  const oneOffQuartersByDate = new Map<string, number>();
  input.oneOffRows.forEach((row, i) => {
    oneOffQuartersByDate.set(row.date, (oneOffQuartersByDate.get(row.date) ?? 0) + oneOffQuarters[i]);
  });
  const dayCapacityQuarters = input.workdays.map((date) =>
    Math.max(0, dailyRateQuarters - (oneOffQuartersByDate.get(date) ?? 0)),
  );

  const remainingPoolQuarters = dayCapacityQuarters.reduce((s, q) => s + q, 0);
  const percentSum = input.percentRows.reduce((s, r) => s + r.pct, 0);

  const percentQuarters = apportion(
    input.percentRows.map((r) => r.pct),
    remainingPoolQuarters,
  );

  const entries: AllocatedEntry[] = [];

  // Day-by-day fill: each day's capacity is apportioned across percent rows by their still-
  // unallocated weekly budget, so a reduced-capacity day (because of a one-off) naturally pushes
  // its shortfall onto later days instead of overflowing past the daily rate. Because
  // sum(day capacities) === sum(row weekly totals) by construction, every row's total is
  // guaranteed to land exactly by the last day, regardless of how many days are constrained.
  const remainingRowQuarters = [...percentQuarters];
  input.workdays.forEach((date, dayIndex) => {
    const dayShares = apportion(remainingRowQuarters, dayCapacityQuarters[dayIndex]);
    input.percentRows.forEach((row, i) => {
      remainingRowQuarters[i] -= dayShares[i];
      if (dayShares[i] <= 0) return;
      entries.push({
        issueKey: row.issueKey,
        issueSummary: row.issueSummary,
        entryDate: date,
        minutes: quartersToMinutes(dayShares[i]),
        weekRowIds: [row.rowId],
      });
    });
  });

  input.oneOffRows.forEach((row, i) => {
    if (oneOffQuarters[i] <= 0) return;
    entries.push({
      issueKey: row.issueKey,
      issueSummary: row.issueSummary,
      entryDate: row.date,
      minutes: quartersToMinutes(oneOffQuarters[i]),
      weekRowIds: [row.rowId],
    });
  });

  const merged = mergeSameIssueAndDate(entries);

  return {
    entries: merged,
    weekTargetMinutes: quartersToMinutes(weekTargetQuarters),
    oneOffMinutes: quartersToMinutes(oneOffQuartersTotal),
    remainingPoolMinutes: quartersToMinutes(remainingPoolQuarters),
    percentSum,
  };
}

/** A percent row and a one-off can legitimately target the same issue+date — collapse to one worklog. */
function mergeSameIssueAndDate(entries: AllocatedEntry[]): AllocatedEntry[] {
  const byKey = new Map<string, AllocatedEntry>();
  for (const e of entries) {
    const key = `${e.issueKey}|${e.entryDate}`;
    const prior = byKey.get(key);
    if (!prior) {
      byKey.set(key, { ...e, weekRowIds: [...e.weekRowIds] });
    } else {
      prior.minutes += e.minutes;
      prior.weekRowIds.push(...e.weekRowIds);
    }
  }
  return [...byKey.values()];
}

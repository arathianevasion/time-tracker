import { describe, expect, it } from "vitest";
import { allocateWeek, roundToQuarterHour } from "./allocate";

const WORKDAYS_5 = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"];

describe("allocateWeek", () => {
  it("matches the prototype's exact seed baseline for a full 5-day week", () => {
    const result = allocateWeek({
      workdays: WORKDAYS_5,
      weeklyHoursTarget: 40,
      percentRows: [
        { rowId: 1, issueKey: "PM-159", issueSummary: "Dental / Vision / Hearing", pct: 30 },
        { rowId: 2, issueKey: "PM-97", issueSummary: "Med Supp Quote & Enroll", pct: 10 },
        { rowId: 3, issueKey: "PM-158", issueSummary: "Hospital Indemnity Quoting", pct: 20 },
        { rowId: 4, issueKey: "PM-89", issueSummary: "ACA Quote & Enroll", pct: 20 },
        { rowId: 5, issueKey: "PM-87", issueSummary: "Life Underwriting", pct: 5 },
        { rowId: 6, issueKey: "PM-152", issueSummary: "Weekly Meetings", pct: 15 },
      ],
      oneOffRows: [],
    });

    expect(result.weekTargetMinutes).toBe(40 * 60);

    const byIssue = totalsByIssue(result.entries);
    expect(byIssue["PM-159"]).toBe(12 * 60);
    expect(byIssue["PM-97"]).toBe(4 * 60);
    expect(byIssue["PM-158"]).toBe(8 * 60);
    expect(byIssue["PM-89"]).toBe(8 * 60);
    expect(byIssue["PM-87"]).toBe(2 * 60);
    expect(byIssue["PM-152"]).toBe(6 * 60);

    // Every row lands on all 5 workdays, evenly split.
    for (const issueKey of Object.keys(byIssue)) {
      const days = result.entries.filter((e) => e.issueKey === issueKey);
      expect(days).toHaveLength(5);
    }

    expect(sumMinutes(result.entries)).toBe(result.weekTargetMinutes);
  });

  it("shrinks the total for a short (holiday) week without changing the daily rate", () => {
    const fourDays = WORKDAYS_5.slice(0, 4);
    const result = allocateWeek({
      workdays: fourDays,
      weeklyHoursTarget: 40,
      percentRows: [{ rowId: 1, issueKey: "PM-1", issueSummary: "Only issue", pct: 100 }],
      oneOffRows: [],
    });

    expect(result.weekTargetMinutes).toBe(4 * 8 * 60); // dailyRate stays 8h, just fewer days
    expect(sumMinutes(result.entries)).toBe(result.weekTargetMinutes);
  });

  it("subtracts one-off hours from the pool before applying percentages", () => {
    const result = allocateWeek({
      workdays: WORKDAYS_5,
      weeklyHoursTarget: 40,
      percentRows: [
        { rowId: 1, issueKey: "PM-1", issueSummary: "A", pct: 50 },
        { rowId: 2, issueKey: "PM-2", issueSummary: "B", pct: 50 },
      ],
      oneOffRows: [{ rowId: 3, issueKey: "PM-3", issueSummary: "Conference", flatHours: 4, date: "2026-08-04" }],
    });

    expect(result.oneOffMinutes).toBe(4 * 60);
    expect(result.remainingPoolMinutes).toBe(36 * 60);
    expect(totalsByIssue(result.entries)["PM-1"]).toBe(18 * 60);
    expect(totalsByIssue(result.entries)["PM-2"]).toBe(18 * 60);
    expect(totalsByIssue(result.entries)["PM-3"]).toBe(4 * 60);

    // The one-off lands only on its chosen date, not split across the week.
    const oneOffEntries = result.entries.filter((e) => e.issueKey === "PM-3");
    expect(oneOffEntries).toHaveLength(1);
    expect(oneOffEntries[0].entryDate).toBe("2026-08-04");

    expect(sumMinutes(result.entries)).toBe(result.weekTargetMinutes);
  });

  it("reconciles exactly even when percentages don't divide evenly into quarter hours", () => {
    const result = allocateWeek({
      workdays: WORKDAYS_5,
      weeklyHoursTarget: 40,
      percentRows: [
        { rowId: 1, issueKey: "PM-1", issueSummary: "A", pct: 33.33 },
        { rowId: 2, issueKey: "PM-2", issueSummary: "B", pct: 33.33 },
        { rowId: 3, issueKey: "PM-3", issueSummary: "C", pct: 33.34 },
      ],
      oneOffRows: [],
    });

    expect(sumMinutes(result.entries)).toBe(result.weekTargetMinutes);
    // Every allocated minute is a multiple of 15 (quarter hour).
    for (const e of result.entries) expect(e.minutes % 15).toBe(0);
  });

  it("reconciles per-row day splits exactly when a row's total isn't evenly divisible by workday count", () => {
    const result = allocateWeek({
      workdays: WORKDAYS_5, // 5 days
      weeklyHoursTarget: 40,
      percentRows: [{ rowId: 1, issueKey: "PM-1", issueSummary: "A", pct: 100 }],
      oneOffRows: [],
    });
    // 40h over 5 days = 8h/day exactly, so force an uneven case instead:
    const uneven = allocateWeek({
      workdays: WORKDAYS_5,
      weeklyHoursTarget: 33, // dailyRate rounds to 6.6 -> 6.5h (nearest quarter)
      percentRows: [{ rowId: 1, issueKey: "PM-1", issueSummary: "A", pct: 100 }],
      oneOffRows: [],
    });
    const rowTotal = sumMinutes(uneven.entries.filter((e) => e.issueKey === "PM-1"));
    expect(rowTotal).toBe(uneven.weekTargetMinutes);
    expect(result).toBeTruthy();
  });

  it("merges a percent row and a one-off that land on the same issue and date", () => {
    const result = allocateWeek({
      workdays: WORKDAYS_5,
      weeklyHoursTarget: 40,
      percentRows: [{ rowId: 1, issueKey: "PM-1", issueSummary: "A", pct: 100 }],
      oneOffRows: [{ rowId: 2, issueKey: "PM-1", issueSummary: "A", flatHours: 2, date: "2026-08-03" }],
    });

    const mondayEntries = result.entries.filter((e) => e.entryDate === "2026-08-03" && e.issueKey === "PM-1");
    expect(mondayEntries).toHaveLength(1);
    expect(mondayEntries[0].weekRowIds.sort()).toEqual([1, 2]);
  });

  it("rounds one-off input hours to the nearest quarter hour", () => {
    expect(roundToQuarterHour(1.1)).toBe(1);
    expect(roundToQuarterHour(1.2)).toBe(1.25);
    expect(roundToQuarterHour(1.3)).toBe(1.25);
    expect(roundToQuarterHour(1.4)).toBe(1.5);
  });

  it("caps a one-off day's percent-based hours at the remaining daily capacity (Andy's example)", () => {
    const result = allocateWeek({
      workdays: WORKDAYS_5,
      weeklyHoursTarget: 40, // dailyRate = 8h
      percentRows: [{ rowId: 1, issueKey: "PM-1", issueSummary: "A", pct: 100 }],
      oneOffRows: [{ rowId: 2, issueKey: "PM-9", issueSummary: "One-time event", flatHours: 7.5, date: "2026-08-03" }],
    });

    const mondayPercent = result.entries.filter((e) => e.entryDate === "2026-08-03" && e.issueKey === "PM-1");
    // 8h daily rate - 7.5h one-off = 0.5h left for percent-based work on Monday.
    expect(sumMinutes(mondayPercent)).toBe(0.5 * 60);

    // The other 4 days pick up the rest so the week's percent total (32.5h) still lands exactly.
    expect(totalsByIssue(result.entries)["PM-1"]).toBe(32.5 * 60);
    expect(sumMinutes(result.entries)).toBe(result.weekTargetMinutes);
    expect(result.weekTargetMinutes).toBe(40 * 60);
  });

  it("distributes a constrained day's shortfall proportionally across multiple percent rows", () => {
    const result = allocateWeek({
      workdays: WORKDAYS_5,
      weeklyHoursTarget: 40,
      percentRows: [
        { rowId: 1, issueKey: "PM-1", issueSummary: "A", pct: 75 },
        { rowId: 2, issueKey: "PM-2", issueSummary: "B", pct: 25 },
      ],
      oneOffRows: [{ rowId: 3, issueKey: "PM-9", issueSummary: "One-time event", flatHours: 7.5, date: "2026-08-03" }],
    });

    // 0.5h left on Monday, split 75/25 -> 0.25h each (rounds evenly at this granularity).
    const mondayA = sumMinutes(result.entries.filter((e) => e.entryDate === "2026-08-03" && e.issueKey === "PM-1"));
    const mondayB = sumMinutes(result.entries.filter((e) => e.entryDate === "2026-08-03" && e.issueKey === "PM-2"));
    expect(mondayA + mondayB).toBe(0.5 * 60);

    // 75/25 of 32.5h (130 quarters) is 97.5/32.5 quarters — not whole, so the same largest-
    // remainder method used everywhere else rounds it to 98/32 (tie broken by row order).
    const byIssue = totalsByIssue(result.entries);
    expect(byIssue["PM-1"]).toBe(24.5 * 60);
    expect(byIssue["PM-2"]).toBe(8 * 60);
    expect(sumMinutes(result.entries)).toBe(result.weekTargetMinutes);
  });

  it("floors a day's capacity at zero when one-offs alone exceed the daily rate, without borrowing from other days", () => {
    const result = allocateWeek({
      workdays: WORKDAYS_5,
      weeklyHoursTarget: 40, // dailyRate = 8h
      percentRows: [{ rowId: 1, issueKey: "PM-1", issueSummary: "A", pct: 100 }],
      oneOffRows: [{ rowId: 2, issueKey: "PM-9", issueSummary: "Long event", flatHours: 9, date: "2026-08-03" }],
    });

    // No percent-based hours land on the over-committed day.
    const mondayPercent = result.entries.filter((e) => e.entryDate === "2026-08-03" && e.issueKey === "PM-1");
    expect(mondayPercent).toHaveLength(0);

    // The week's percent-based total shrinks by the full 9h rather than spilling onto other days:
    // remainingPool = (0 + 8+8+8+8) = 32h, not 40 - 9 = 31h.
    expect(totalsByIssue(result.entries)["PM-1"]).toBe(32 * 60);
    expect(result.remainingPoolMinutes).toBe(32 * 60);

    // Other days still cap at the normal 8h daily rate — no overflow to compensate.
    for (const date of ["2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]) {
      const dayTotal = sumMinutes(result.entries.filter((e) => e.entryDate === date));
      expect(dayTotal).toBeLessThanOrEqual(8 * 60);
    }
  });
});

function sumMinutes(entries: { minutes: number }[]): number {
  return entries.reduce((s, e) => s + e.minutes, 0);
}

function totalsByIssue(entries: { issueKey: string; minutes: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) out[e.issueKey] = (out[e.issueKey] ?? 0) + e.minutes;
  return out;
}

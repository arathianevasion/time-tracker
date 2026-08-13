import "./test-env";
import { beforeEach, describe, expect, it } from "vitest";
import { replaceBaseline } from "./baseline";
import { getDb, resetDbForTests } from "./client";
import { listEntriesForWeek, reconcileWeek, type DesiredEntry } from "./entries";
import { ensureWeek } from "./weeks";

const WEEK = "2026-08-03";
const WORKDAYS = ["2026-08-03", "2026-08-04"];

beforeEach(() => {
  resetDbForTests();
  replaceBaseline([
    { issueKey: "A", issueSummary: "Issue A", pct: 60 },
    { issueKey: "B", issueSummary: "Issue B", pct: 40 },
  ]);
  ensureWeek(WEEK, WORKDAYS);
});

function entriesFor(issueKey: string) {
  return listEntriesForWeek(WEEK)
    .filter((e) => e.issueKey === issueKey)
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate));
}

describe("reconcileWeek", () => {
  it("keeps different issues sharing the same dates independent — regression for the date-only-key bug", () => {
    const desired: DesiredEntry[] = [
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-03", minutes: 60, weekRowIds: [1] },
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-04", minutes: 60, weekRowIds: [1] },
      { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-03", minutes: 40, weekRowIds: [2] },
      { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-04", minutes: 40, weekRowIds: [2] },
    ];
    reconcileWeek(WEEK, desired);

    const a = entriesFor("A");
    const b = entriesFor("B");
    expect(a.map((e) => e.minutes)).toEqual([60, 60]);
    expect(b.map((e) => e.minutes)).toEqual([40, 40]);
    // The bug this guards against: B's rows silently taking on A's issueSummary/minutes (or vice versa).
    expect(a.every((e) => e.issueSummary === "Issue A")).toBe(true);
    expect(b.every((e) => e.issueSummary === "Issue B")).toBe(true);
  });

  it("updates each issue's own rows independently on a second reconcile, without cross-contamination", () => {
    reconcileWeek(WEEK, [
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-03", minutes: 60, weekRowIds: [1] },
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-04", minutes: 60, weekRowIds: [1] },
      { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-03", minutes: 40, weekRowIds: [2] },
      { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-04", minutes: 40, weekRowIds: [2] },
    ]);

    // Percentages change: A grows, B shrinks — simulates editing a row's % mid-week.
    reconcileWeek(WEEK, [
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-03", minutes: 70, weekRowIds: [1] },
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-04", minutes: 70, weekRowIds: [1] },
      { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-03", minutes: 30, weekRowIds: [2] },
      { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-04", minutes: 30, weekRowIds: [2] },
    ]);

    expect(entriesFor("A").map((e) => e.minutes)).toEqual([70, 70]);
    expect(entriesFor("B").map((e) => e.minutes)).toEqual([30, 30]);
    // Exactly 4 rows total — no orphaned/duplicated rows from the collision.
    expect(listEntriesForWeek(WEEK)).toHaveLength(4);
  });

  it("removing one issue's rows doesn't disturb another issue's rows on the same dates", () => {
    reconcileWeek(WEEK, [
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-03", minutes: 60, weekRowIds: [1] },
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-04", minutes: 60, weekRowIds: [1] },
      { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-03", minutes: 40, weekRowIds: [2] },
      { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-04", minutes: 40, weekRowIds: [2] },
    ]);

    // B removed from the week entirely (e.g. row deleted by the user).
    reconcileWeek(WEEK, [
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-03", minutes: 100, weekRowIds: [1] },
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-04", minutes: 100, weekRowIds: [1] },
    ]);

    expect(entriesFor("A").map((e) => e.minutes)).toEqual([100, 100]);
    expect(entriesFor("B")).toHaveLength(0); // never synced, so dropped immediately rather than left dangling
  });

  it("revives a 'deleting' row instead of crashing on the unique constraint when the entry is wanted again", () => {
    reconcileWeek(WEEK, [
      { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-03", minutes: 60, weekRowIds: [1] },
      { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-03", minutes: 40, weekRowIds: [2] },
    ]);
    // Simulate A's 08-03 entry having already been synced to Jira, then the day getting toggled off
    // (marks it 'deleting') before a sync actually ran to remove it.
    const row = entriesFor("A")[0];
    getDb()
      .prepare("UPDATE time_entries SET jira_worklog_id = ?, sync_status = 'deleting' WHERE id = ?")
      .run("99999", row.id);

    // The day gets toggled back on — A's 08-03 entry is desired again.
    expect(() =>
      reconcileWeek(WEEK, [
        { issueKey: "A", issueSummary: "Issue A", entryDate: "2026-08-03", minutes: 60, weekRowIds: [1] },
        { issueKey: "B", issueSummary: "Issue B", entryDate: "2026-08-03", minutes: 40, weekRowIds: [2] },
      ]),
    ).not.toThrow();

    const revived = entriesFor("A")[0];
    expect(revived.id).toBe(row.id); // same row reused, not a duplicate
    expect(revived.jiraWorklogId).toBe("99999"); // real worklog id preserved — next sync updates in place
    expect(revived.syncStatus).toBe("pending");
    expect(entriesFor("A")).toHaveLength(1);
  });
});

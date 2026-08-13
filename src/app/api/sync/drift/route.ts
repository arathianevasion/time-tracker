import { NextResponse } from "next/server";
import { resolveAccountId } from "@/lib/account";
import { listEntriesForWeek, markError } from "@/lib/db/entries";
import { listAllWorklogs } from "@/lib/jira/worklogs";
import { addDays, parseYmd } from "@/lib/time/week";

export async function POST(request: Request) {
  const body = await request.json();
  const weekStart = body.weekStart as string | undefined;
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  const accountId = await resolveAccountId();
  const start = parseYmd(weekStart);
  const end = addDays(start, 7);

  // A worklog id existing is the real signal Jira has something for this entry — not the local
  // sync_status, which can drift to 'pending' for benign local reasons (e.g. a recompute) while
  // Jira itself is untouched. Only 'deleting' entries are excluded, since those are intentionally
  // being removed and shouldn't be reported as live.
  const trackedInJira = listEntriesForWeek(weekStart).filter(
    (e) => e.jiraWorklogId && e.syncStatus !== "deleting",
  );
  const issueKeys = [...new Set(trackedInJira.map((e) => e.issueKey))];

  const perIssueLiveMinutes: Record<string, number> = {};
  const flaggedMissing: { issueKey: string; date: string; jiraWorklogId: string }[] = [];

  for (const issueKey of issueKeys) {
    const worklogs = await listAllWorklogs(issueKey);
    const mine = worklogs.filter((w) => w.author?.accountId === accountId);
    const inWeek = mine.filter((w) => {
      const started = new Date(w.started);
      return started >= start && started < end;
    });
    perIssueLiveMinutes[issueKey] = Math.round(inWeek.reduce((s, w) => s + w.timeSpentSeconds, 0) / 60);

    const liveIds = new Set(mine.map((w) => w.id));
    for (const entry of trackedInJira.filter((e) => e.issueKey === issueKey)) {
      if (entry.jiraWorklogId && !liveIds.has(entry.jiraWorklogId)) {
        markError(entry.id, "Worklog no longer found in Jira — re-sync to recreate, or remove this entry.");
        flaggedMissing.push({ issueKey, date: entry.entryDate, jiraWorklogId: entry.jiraWorklogId });
      }
    }
  }

  return NextResponse.json({ perIssueLiveMinutes, flaggedMissing });
}

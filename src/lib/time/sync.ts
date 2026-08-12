import { deleteEntry, listSyncable, markError, markSynced } from "../db/entries";
import { markLogged } from "../db/weeks";
import { createWorklog, deleteWorklog, updateWorklog } from "../jira/worklogs";
import { buildStartedIso } from "./started";

export interface SyncOutcome {
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  errors: { issueKey: string; date: string; message: string }[];
}

/**
 * Pushes a week's pending/deleting time_entries to Jira, one at a time (sequential — not
 * Promise.all — so a 429 backoff on one request doesn't fire a burst of concurrent retries).
 * Every entry is handled independently: one failure doesn't block the rest (PRD §6.4).
 */
export async function syncWeek(weekStart: string): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { created: 0, updated: 0, deleted: 0, failed: 0, errors: [] };

  for (const entry of listSyncable(weekStart)) {
    try {
      if (entry.syncStatus === "deleting") {
        if (entry.jiraWorklogId) await deleteWorklog(entry.issueKey, entry.jiraWorklogId);
        deleteEntry(entry.id);
        outcome.deleted++;
        continue;
      }

      const write = {
        startedIso: buildStartedIso(entry.entryDate),
        timeSpentSeconds: entry.minutes * 60,
        commentText: `Weekly time allocation — ${entry.issueSummary} (week of ${weekStart})`,
      };

      if (entry.jiraWorklogId) {
        await updateWorklog(entry.issueKey, entry.jiraWorklogId, write);
        markSynced(entry.id, entry.jiraWorklogId);
        outcome.updated++;
      } else {
        const created = await createWorklog(entry.issueKey, write);
        markSynced(entry.id, created.id);
        outcome.created++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      markError(entry.id, message);
      outcome.failed++;
      outcome.errors.push({ issueKey: entry.issueKey, date: entry.entryDate, message });
    }
  }

  if (outcome.failed === 0) markLogged(weekStart);
  return outcome;
}

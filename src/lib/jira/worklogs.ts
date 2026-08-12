import { JiraApiError, jiraJson } from "./client";
import { textToAdf } from "./adf";

export interface JiraWorklog {
  id: string;
  started: string;
  timeSpentSeconds: number;
  updated: string;
  author?: { accountId: string };
}

interface WorklogPage {
  startAt: number;
  maxResults: number;
  total: number;
  worklogs: JiraWorklog[];
}

const COMMON_PARAMS = "notifyUsers=false&adjustEstimate=leave";

export interface WorklogWriteInput {
  startedIso: string;
  timeSpentSeconds: number;
  commentText?: string;
}

export async function createWorklog(issueKey: string, input: WorklogWriteInput): Promise<JiraWorklog> {
  return jiraJson<JiraWorklog>(`/rest/api/3/issue/${issueKey}/worklog?${COMMON_PARAMS}`, {
    method: "POST",
    body: JSON.stringify(toBody(input)),
  });
}

export async function updateWorklog(
  issueKey: string,
  worklogId: string,
  input: WorklogWriteInput,
): Promise<JiraWorklog> {
  return jiraJson<JiraWorklog>(`/rest/api/3/issue/${issueKey}/worklog/${worklogId}?${COMMON_PARAMS}`, {
    method: "PUT",
    body: JSON.stringify(toBody(input)),
  });
}

export async function deleteWorklog(issueKey: string, worklogId: string): Promise<void> {
  await jiraJson<void>(`/rest/api/3/issue/${issueKey}/worklog/${worklogId}?${COMMON_PARAMS}`, {
    method: "DELETE",
  });
}

/** Fetches every worklog on an issue, paginating past Jira's page size — no 20-item cap. */
export async function listAllWorklogs(issueKey: string): Promise<JiraWorklog[]> {
  const all: JiraWorklog[] = [];
  let startAt = 0;
  const maxResults = 100;

  for (;;) {
    const page = await jiraJson<WorklogPage>(
      `/rest/api/3/issue/${issueKey}/worklog?startAt=${startAt}&maxResults=${maxResults}`,
    );
    all.push(...page.worklogs);
    if (startAt + page.worklogs.length >= page.total || page.worklogs.length === 0) break;
    startAt += page.worklogs.length;
  }
  return all;
}

/** Returns null only on a real 404 (worklog gone/never existed) — other failures (auth, network) rethrow. */
export async function getWorklog(issueKey: string, worklogId: string): Promise<JiraWorklog | null> {
  try {
    return await jiraJson<JiraWorklog>(`/rest/api/3/issue/${issueKey}/worklog/${worklogId}`);
  } catch (err) {
    if (err instanceof JiraApiError && err.status === 404) return null;
    throw err;
  }
}

function toBody(input: WorklogWriteInput) {
  return {
    started: input.startedIso,
    timeSpentSeconds: input.timeSpentSeconds,
    ...(input.commentText ? { comment: textToAdf(input.commentText) } : {}),
  };
}

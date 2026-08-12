import { jiraJson } from "./client";

export interface JiraMyself {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

let cachedAccountId: string | null = null;

export async function getMyself(): Promise<JiraMyself> {
  return jiraJson<JiraMyself>("/rest/api/3/myself");
}

/** Cached for the life of the process — call once, reuse everywhere "my worklogs" filtering is needed. */
export async function getMyAccountId(): Promise<string> {
  if (cachedAccountId) return cachedAccountId;
  const me = await getMyself();
  cachedAccountId = me.accountId;
  return cachedAccountId;
}

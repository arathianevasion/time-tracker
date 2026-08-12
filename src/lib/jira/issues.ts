import { jiraJson } from "./client";

export interface IssueSuggestion {
  key: string;
  summary: string;
}

interface PickerIssue {
  key: string;
  summary?: string;
  summaryText?: string;
}

interface PickerSection {
  id: string;
  label: string;
  issues: PickerIssue[];
}

interface PickerResponse {
  sections: PickerSection[];
}

/**
 * Issue typeahead, scoped to `projectKeys`. Uses the issue-picker endpoint (purpose-built for
 * autocomplete) rather than JQL search. `currentJQL` scopes the "Current Search" section;
 * results are also post-filtered by project key since the "History Search" section (recently
 * viewed issues) isn't guaranteed to respect currentJQL.
 */
export async function searchIssues(query: string, projectKeys: string[]): Promise<IssueSuggestion[]> {
  const currentJQL = [
    projectKeys.length ? `project in (${projectKeys.map((k) => `"${k}"`).join(",")})` : "",
    "ORDER BY updated DESC",
  ]
    .filter(Boolean)
    .join(" ");

  const params = new URLSearchParams({ query, currentJQL });
  const res = await jiraJson<PickerResponse>(`/rest/api/3/issue/picker?${params.toString()}`);

  const projectSet = new Set(projectKeys.map((k) => k.toUpperCase()));
  const seen = new Map<string, IssueSuggestion>();

  for (const section of res.sections ?? []) {
    for (const issue of section.issues ?? []) {
      if (seen.has(issue.key)) continue;
      if (projectSet.size > 0 && !projectSet.has(issue.key.split("-")[0].toUpperCase())) continue;
      seen.set(issue.key, { key: issue.key, summary: issue.summaryText ?? issue.summary ?? issue.key });
    }
  }
  return [...seen.values()];
}

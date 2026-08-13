import { jiraJson } from "./client";

// Andy's org-specific single-select custom field for cost classification (OpEx/CapEx/Time Off/
// One Time Cost). Not discoverable from the issue picker endpoint, so it needs its own enrichment
// lookup. Field id confirmed live against integritymarketing.atlassian.net's /rest/api/3/field.
const EXPENSE_CATEGORY_FIELD = "customfield_10713";

export interface IssueSuggestion {
  key: string;
  summary: string;
  issueType: string | null;
  issueTypeIconUrl: string | null;
  expenseCategory: string | null; // raw Jira option value, e.g. "CAPEX"; null if unset
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

export interface IssueMeta {
  issueType: string | null;
  issueTypeIconUrl: string | null;
  expenseCategory: string | null;
}

interface SearchJqlResponse {
  issues: {
    key: string;
    fields: {
      issuetype?: { name?: string; iconUrl?: string };
      [EXPENSE_CATEGORY_FIELD]?: { value?: string } | null;
    };
  }[];
}

/**
 * Batch-fetches issue type + Expense Category for a known set of keys. Uses the modern
 * search/jql endpoint (the old /search was removed from Jira Cloud) since the issue-picker
 * endpoint used for the actual typeahead doesn't return either field. Degrades to empty
 * (no badges) on any failure rather than blocking issue selection.
 */
export async function fetchIssueMeta(keys: string[]): Promise<Map<string, IssueMeta>> {
  const meta = new Map<string, IssueMeta>();
  if (keys.length === 0) return meta;

  try {
    const jql = `key in (${keys.map((k) => `"${k}"`).join(",")})`;
    const res = await jiraJson<SearchJqlResponse>("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({ jql, fields: ["issuetype", EXPENSE_CATEGORY_FIELD], maxResults: keys.length }),
    });
    for (const issue of res.issues ?? []) {
      meta.set(issue.key, {
        issueType: issue.fields.issuetype?.name ?? null,
        issueTypeIconUrl: issue.fields.issuetype?.iconUrl ?? null,
        expenseCategory: issue.fields[EXPENSE_CATEGORY_FIELD]?.value ?? null,
      });
    }
  } catch {
    // non-fatal — picker still works, just without type/category badges for this search
  }
  return meta;
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
  const seen = new Map<string, { key: string; summary: string }>();

  for (const section of res.sections ?? []) {
    for (const issue of section.issues ?? []) {
      if (seen.has(issue.key)) continue;
      if (projectSet.size > 0 && !projectSet.has(issue.key.split("-")[0].toUpperCase())) continue;
      seen.set(issue.key, { key: issue.key, summary: issue.summaryText ?? issue.summary ?? issue.key });
    }
  }

  const meta = await fetchIssueMeta([...seen.keys()]);

  return [...seen.values()].map((issue) => {
    const m = meta.get(issue.key);
    return {
      ...issue,
      issueType: m?.issueType ?? null,
      issueTypeIconUrl: m?.issueTypeIconUrl ?? null,
      expenseCategory: m?.expenseCategory ?? null,
    };
  });
}

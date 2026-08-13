"use client";

import { useEffect, useState } from "react";

export const JIRA_BASE_URL = "https://integritymarketing.atlassian.net";

export function jiraIssueUrl(issueKey: string, baseUrl = JIRA_BASE_URL): string {
  return `${baseUrl}/browse/${issueKey}`;
}

// Module-level cache so every ViewInJiraLink instance on a page (one per row) shares a single
// fetch instead of each firing its own request against /api/jira/credentials.
let cachedBaseUrl: string | null = null;
let baseUrlRequest: Promise<string> | null = null;

function loadBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return Promise.resolve(cachedBaseUrl);
  baseUrlRequest ??= fetch("/api/jira/credentials")
    .then((r) => r.json())
    .then((d) => (cachedBaseUrl = d.baseUrl || JIRA_BASE_URL))
    .catch(() => JIRA_BASE_URL);
  return baseUrlRequest;
}

export function IssueTypeBadge({ issueType, iconUrl }: { issueType: string | null; iconUrl?: string | null }) {
  if (!issueType) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500" title={issueType}>
      {iconUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external Jira-hosted icon, not worth next/image config for this
        <img src={iconUrl} alt="" className="h-3.5 w-3.5" />
      )}
      {issueType}
    </span>
  );
}

// Andy's org uses this exact casing (OpEx/CapEx) for the category names; Jira's raw option
// values come back upper-cased ("OPEX"), so map explicitly rather than generic title-casing.
const EXPENSE_CATEGORY_DISPLAY: Record<string, string> = {
  OPEX: "OpEx",
  CAPEX: "CapEx",
  "TIME OFF": "Time Off",
  "ONE TIME COST": "One Time Cost",
};

const EXPENSE_CATEGORY_CLASS: Record<string, string> = {
  OPEX: "bg-blue-100 text-blue-800",
  CAPEX: "bg-purple-100 text-purple-800",
  "TIME OFF": "bg-green-100 text-green-800",
  "ONE TIME COST": "bg-amber-100 text-amber-800",
};

export function ExpenseCategoryBadge({ expenseCategory }: { expenseCategory: string | null }) {
  const normalized = expenseCategory?.trim().toUpperCase() ?? null;
  const label = normalized ? (EXPENSE_CATEGORY_DISPLAY[normalized] ?? expenseCategory) : "None";
  const className = normalized ? (EXPENSE_CATEGORY_CLASS[normalized] ?? "bg-gray-100 text-gray-600") : "bg-gray-100 text-gray-400";

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}

export function ViewInJiraLink({ issueKey }: { issueKey: string }) {
  const [baseUrl, setBaseUrl] = useState(cachedBaseUrl ?? JIRA_BASE_URL);

  useEffect(() => {
    loadBaseUrl().then(setBaseUrl);
  }, []);

  return (
    <a
      href={jiraIssueUrl(issueKey, baseUrl)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs whitespace-nowrap text-blue-600 hover:underline"
      title={`Open ${issueKey} in Jira`}
    >
      View in Jira ↗
    </a>
  );
}

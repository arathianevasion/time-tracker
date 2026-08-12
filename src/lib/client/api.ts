import type { BaselineItem, Settings, TimeEntry, WeekRecord } from "@/lib/db/types";
import type { AllocateWeekResult } from "@/lib/time/allocate";
import type { SyncOutcome } from "@/lib/time/sync";
import type { WeekStatus } from "@/lib/time/status";

async function json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed: ${res.status}`);
  return body as T;
}

export interface WeekTotals {
  totalMinutes: number;
  entryCount: number;
  syncedCount: number;
}

export type WeekWithTotals = WeekRecord & { totals: WeekTotals };

export const api = {
  verifyJira: () =>
    json<{ ok: boolean; accountId?: string; displayName?: string; error?: string }>("/api/jira/verify"),

  searchIssues: (q: string) =>
    json<{ issues: { key: string; summary: string }[] }>(`/api/jira/issues/search?q=${encodeURIComponent(q)}`),

  getSettings: () => json<Settings>("/api/settings"),
  updateSettings: (patch: Partial<Settings>) =>
    json<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),

  getBaseline: () => json<{ items: BaselineItem[] }>("/api/baseline"),
  saveBaseline: (items: { issueKey: string; issueSummary: string; pct: number }[]) =>
    json<{ items: BaselineItem[] }>("/api/baseline", { method: "PUT", body: JSON.stringify({ items }) }),

  getWeek: (weekStart: string) => json<WeekWithTotals>(`/api/weeks/${weekStart}`),
  setWorkdays: (weekStart: string, workdays: string[]) =>
    json<{ ok: true }>(`/api/weeks/${weekStart}`, { method: "PATCH", body: JSON.stringify({ workdays }) }),
  resetToBaseline: (weekStart: string) =>
    json<WeekRecord>(`/api/weeks/${weekStart}/reset`, { method: "POST" }),

  addRow: (
    weekStart: string,
    input: {
      issueKey: string;
      issueSummary: string;
      kind: "baseline" | "one_off";
      pct?: number;
      flatHours?: number;
      oneOffDate?: string;
    },
  ) => json(`/api/weeks/${weekStart}/rows`, { method: "POST", body: JSON.stringify(input) }),
  updateRow: (weekStart: string, rowId: number, patch: { pct?: number; flatHours?: number; oneOffDate?: string }) =>
    json(`/api/weeks/${weekStart}/rows/${rowId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  removeRow: (weekStart: string, rowId: number) =>
    json(`/api/weeks/${weekStart}/rows/${rowId}`, { method: "DELETE" }),

  materialize: (weekStart: string) =>
    json<AllocateWeekResult & { savedEntries: TimeEntry[] }>(`/api/weeks/${weekStart}/materialize`, {
      method: "POST",
    }),
  sync: (weekStart: string) => json<SyncOutcome>("/api/sync", { method: "POST", body: JSON.stringify({ weekStart }) }),
  checkDrift: (weekStart: string) =>
    json<{ perIssueLiveMinutes: Record<string, number>; flaggedMissing: unknown[] }>("/api/sync/drift", {
      method: "POST",
      body: JSON.stringify({ weekStart }),
    }),

  listWeeks: (limit = 16) =>
    json<{ weeks: { weekStart: string; status: WeekStatus; totals: WeekTotals; workdayCount: number }[] }>(
      `/api/weeks?limit=${limit}`,
    ),
};

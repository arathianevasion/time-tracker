export interface Settings {
  defaultProjectKeys: string[];
  weeklyHoursTarget: number;
  accountId: string | null;
}

export interface BaselineItem {
  id: number;
  issueKey: string;
  issueSummary: string;
  pct: number;
  sortOrder: number;
  issueType: string | null;
  expenseCategory: string | null;
}

export type WeekRowKind = "baseline" | "one_off";

export interface WeekRow {
  id: number;
  weekStart: string;
  issueKey: string;
  issueSummary: string;
  kind: WeekRowKind;
  pct: number | null;
  flatHours: number | null;
  oneOffDate: string | null;
  sortOrder: number;
  issueType: string | null;
  expenseCategory: string | null;
}

export interface WeekRecord {
  weekStart: string;
  workdays: string[];
  loggedAt: string | null;
  rows: WeekRow[];
}

export type SyncStatus = "pending" | "synced" | "error" | "deleting";

export interface TimeEntry {
  id: number;
  weekStart: string;
  weekRowIds: number[];
  issueKey: string;
  issueSummary: string;
  entryDate: string;
  minutes: number;
  jiraWorklogId: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  updatedAt: string;
}

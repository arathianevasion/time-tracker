import { getDb } from "./client";
import type { Settings } from "./types";

interface SettingsRow {
  default_project_keys: string;
  weekly_hours_target: number;
  account_id: string | null;
}

export function getSettings(): Settings {
  const row = getDb().prepare("SELECT * FROM settings WHERE id = 1").get() as SettingsRow;
  return {
    defaultProjectKeys: JSON.parse(row.default_project_keys),
    weeklyHoursTarget: row.weekly_hours_target,
    accountId: row.account_id,
  };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const current = getSettings();
  const next: Settings = { ...current, ...patch };
  getDb()
    .prepare(
      "UPDATE settings SET default_project_keys = ?, weekly_hours_target = ?, account_id = ? WHERE id = 1",
    )
    .run(JSON.stringify(next.defaultProjectKeys), next.weeklyHoursTarget, next.accountId);
  return next;
}

import { getSettings, updateSettings } from "./db/settings";
import { getMyself } from "./jira/me";

/** DB-cached account id — avoids a live /myself round trip on every drift-check call. */
export async function resolveAccountId(): Promise<string> {
  const settings = getSettings();
  if (settings.accountId) return settings.accountId;

  const me = await getMyself();
  updateSettings({ accountId: me.accountId });
  return me.accountId;
}

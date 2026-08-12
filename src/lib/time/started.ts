function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Builds the ISO-8601 timestamp Jira's `started` worklog field requires:
 * 'YYYY-MM-DDTHH:mm:ss.SSS+HHMM' — milliseconds, no colon in the offset, no trailing 'Z'.
 * Uses this machine's real local offset *for that date* (not today's), so it stays correct
 * across DST transitions.
 */
export function buildStartedIso(dateStr: string, hour = 9): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, hour, 0, 0, 0);

  const offsetMin = -dt.getTimezoneOffset(); // minutes east of UTC
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);

  return `${dateStr}T${pad(hour)}:00:00.000${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

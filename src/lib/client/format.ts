import { addDays, parseYmd, ymd } from "@/lib/time/week";

export function fmtHours(minutes: number): string {
  return (Math.round((minutes / 60) * 100) / 100).toString();
}

export function prettyDate(dateStr: string): string {
  return parseYmd(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function weekLabel(weekStart: string): string {
  const end = ymd(addDays(parseYmd(weekStart), 6));
  return `${prettyDate(weekStart)} – ${prettyDate(end)}, ${parseYmd(weekStart).getFullYear()}`;
}

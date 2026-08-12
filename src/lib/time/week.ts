function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function mondayOf(d: Date): Date {
  const dow = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  return addDays(d, -dow);
}

export function currentWeekStart(): string {
  return ymd(mondayOf(new Date()));
}

/** Andy's default landing week — time is normally logged for a completed week, not the current one. */
export function defaultViewWeek(): string {
  return ymd(addDays(mondayOf(new Date()), -7));
}

// ---- US federal holidays, computed (no hardcoded year list) — ported from the prototype ----

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const day = 1 + (((weekday - first.getDay()) + 7) % 7) + (n - 1) * 7;
  return new Date(year, month, day);
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  return addDays(last, -(((last.getDay() - weekday) + 7) % 7));
}

function observed(d: Date): Date {
  if (d.getDay() === 6) return addDays(d, -1); // Sat -> Fri before
  if (d.getDay() === 0) return addDays(d, 1); // Sun -> Mon after
  return d;
}

export function usHolidays(year: number): Record<string, string> {
  const h: Record<string, string> = {};
  const put = (d: Date, name: string) => {
    h[ymd(observed(d))] = name;
  };
  put(new Date(year, 0, 1), "New Year's Day");
  put(nthWeekday(year, 0, 1, 3), "MLK Jr. Day");
  put(nthWeekday(year, 1, 1, 3), "Presidents' Day");
  put(lastWeekday(year, 4, 1), "Memorial Day");
  put(new Date(year, 5, 19), "Juneteenth");
  put(new Date(year, 6, 4), "Independence Day");
  put(nthWeekday(year, 8, 1, 1), "Labor Day");
  put(nthWeekday(year, 9, 1, 2), "Columbus Day");
  put(new Date(year, 10, 11), "Veterans Day");
  put(nthWeekday(year, 10, 4, 4), "Thanksgiving");
  put(new Date(year, 11, 25), "Christmas Day");
  return h;
}

export function holidayFor(dateStr: string): string | null {
  return usHolidays(parseYmd(dateStr).getFullYear())[dateStr] ?? null;
}

/** Mon–Fri minus computed US federal holidays. Any day remains manually toggleable per week. */
export function defaultWorkdays(weekStart: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const ds = ymd(addDays(parseYmd(weekStart), i));
    if (!holidayFor(ds)) out.push(ds);
  }
  return out;
}

export function isValidWeekStart(weekStart: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(weekStart) && ymd(mondayOf(parseYmd(weekStart))) === weekStart;
}

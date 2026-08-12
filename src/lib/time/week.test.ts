import { describe, expect, it } from "vitest";
import { defaultWorkdays, isValidWeekStart, mondayOf, parseYmd, usHolidays, ymd } from "./week";

describe("week helpers", () => {
  it("computes Monday of a given date", () => {
    expect(ymd(mondayOf(parseYmd("2026-08-06")))).toBe("2026-08-03"); // Thursday -> that week's Monday
    expect(ymd(mondayOf(parseYmd("2026-08-03")))).toBe("2026-08-03"); // Monday -> itself
  });

  it("has no holiday the week of Aug 3 2026, so all 5 weekdays are default workdays", () => {
    expect(defaultWorkdays("2026-08-03")).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
  });

  it("excludes Labor Day (first Monday of September) from that week's default workdays", () => {
    const holidays2026 = usHolidays(2026);
    const laborDay = Object.entries(holidays2026).find(([, name]) => name === "Labor Day")?.[0];
    expect(laborDay).toBeDefined();
    const weekStart = ymd(mondayOf(parseYmd(laborDay!)));
    expect(defaultWorkdays(weekStart)).not.toContain(laborDay);
    expect(defaultWorkdays(weekStart)).toHaveLength(4);
  });

  it("validates a week start must be an actual Monday", () => {
    expect(isValidWeekStart("2026-08-03")).toBe(true);
    expect(isValidWeekStart("2026-08-04")).toBe(false);
  });
});

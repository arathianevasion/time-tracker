import { NextResponse } from "next/server";
import { getWeekTotals } from "@/lib/db/entries";
import { getWeek, listWeekStarts } from "@/lib/db/weeks";
import { weekStatus } from "@/lib/time/status";

export async function GET(request: Request) {
  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 16;

  const weeks = listWeekStarts(limit).map((weekStart) => ({
    weekStart,
    status: weekStatus(weekStart),
    totals: getWeekTotals(weekStart),
    workdayCount: getWeek(weekStart)?.workdays.length ?? 0,
  }));

  return NextResponse.json({ weeks });
}

import { NextResponse } from "next/server";
import { getWeekTotals } from "@/lib/db/entries";
import { ensureWeek, setWorkdays } from "@/lib/db/weeks";
import { defaultWorkdays, isValidWeekStart } from "@/lib/time/week";

interface RouteParams {
  params: Promise<{ weekStart: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { weekStart } = await params;
  if (!isValidWeekStart(weekStart)) {
    return NextResponse.json({ error: "weekStart must be a Monday, YYYY-MM-DD" }, { status: 400 });
  }

  const week = ensureWeek(weekStart, defaultWorkdays(weekStart));
  const totals = getWeekTotals(weekStart);
  return NextResponse.json({ ...week, totals });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { weekStart } = await params;
  if (!isValidWeekStart(weekStart)) {
    return NextResponse.json({ error: "weekStart must be a Monday, YYYY-MM-DD" }, { status: 400 });
  }

  const body = await request.json();
  ensureWeek(weekStart, defaultWorkdays(weekStart));
  if (Array.isArray(body.workdays)) {
    setWorkdays(weekStart, body.workdays);
  }
  return NextResponse.json({ ok: true });
}

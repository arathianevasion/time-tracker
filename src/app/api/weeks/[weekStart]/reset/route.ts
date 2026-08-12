import { NextResponse } from "next/server";
import { resetBaselineRows } from "@/lib/db/weeks";

interface RouteParams {
  params: Promise<{ weekStart: string }>;
}

/** Replaces this week's baseline-kind rows with a fresh copy of the current baseline. One-offs untouched. */
export async function POST(_request: Request, { params }: RouteParams) {
  const { weekStart } = await params;
  const week = resetBaselineRows(weekStart);
  return NextResponse.json(week);
}

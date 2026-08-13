import { NextResponse } from "next/server";
import { previewWeek } from "@/lib/time/materialize";

interface RouteParams {
  params: Promise<{ weekStart: string }>;
}

/** Computes the allocation for a week for display only — no DB writes, no sync_status changes. */
export async function POST(_request: Request, { params }: RouteParams) {
  const { weekStart } = await params;
  const result = previewWeek(weekStart);
  return NextResponse.json(result);
}

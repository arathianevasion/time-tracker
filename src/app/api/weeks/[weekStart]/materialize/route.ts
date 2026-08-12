import { NextResponse } from "next/server";
import { listEntriesForWeek } from "@/lib/db/entries";
import { materializeWeek } from "@/lib/time/materialize";

interface RouteParams {
  params: Promise<{ weekStart: string }>;
}

/** Recomputes the allocation for a week and reconciles it into time_entries — no Jira calls. */
export async function POST(_request: Request, { params }: RouteParams) {
  const { weekStart } = await params;
  const result = materializeWeek(weekStart);
  const entries = listEntriesForWeek(weekStart);
  return NextResponse.json({ ...result, savedEntries: entries });
}

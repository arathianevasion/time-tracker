import { NextResponse } from "next/server";
import { materializeWeek } from "@/lib/time/materialize";
import { syncWeek } from "@/lib/time/sync";

export async function POST(request: Request) {
  const body = await request.json();
  const weekStart = body.weekStart as string | undefined;
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  materializeWeek(weekStart);
  const outcome = await syncWeek(weekStart);
  return NextResponse.json(outcome);
}

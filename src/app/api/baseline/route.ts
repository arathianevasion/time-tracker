import { NextResponse } from "next/server";
import { BaselineValidationError, listBaseline, replaceBaseline } from "@/lib/db/baseline";

export async function GET() {
  return NextResponse.json({ items: listBaseline() });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const items = body.items as { issueKey: string; issueSummary: string; pct: number }[];

  try {
    const saved = replaceBaseline(items);
    return NextResponse.json({ items: saved });
  } catch (err) {
    if (err instanceof BaselineValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

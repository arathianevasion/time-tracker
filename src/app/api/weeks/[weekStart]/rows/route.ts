import { NextResponse } from "next/server";
import { addRow, ensureWeek, type AddRowInput } from "@/lib/db/weeks";
import { defaultWorkdays } from "@/lib/time/week";

interface RouteParams {
  params: Promise<{ weekStart: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { weekStart } = await params;
  ensureWeek(weekStart, defaultWorkdays(weekStart));

  const body = (await request.json()) as AddRowInput;
  if (!body.issueKey || !body.kind) {
    return NextResponse.json({ error: "issueKey and kind are required" }, { status: 400 });
  }
  if (body.kind === "one_off" && (!body.flatHours || !body.oneOffDate)) {
    return NextResponse.json({ error: "one_off rows require flatHours and oneOffDate" }, { status: 400 });
  }
  if (body.kind === "baseline" && body.pct == null) {
    return NextResponse.json({ error: "baseline rows require pct" }, { status: 400 });
  }

  const row = addRow(weekStart, {
    issueKey: body.issueKey,
    issueSummary: body.issueSummary,
    kind: body.kind,
    pct: body.pct,
    flatHours: body.flatHours,
    oneOffDate: body.oneOffDate,
    issueType: body.issueType,
    expenseCategory: body.expenseCategory,
  });
  return NextResponse.json(row, { status: 201 });
}

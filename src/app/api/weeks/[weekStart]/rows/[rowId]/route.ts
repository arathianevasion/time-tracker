import { NextResponse } from "next/server";
import { removeRow, updateRow, type UpdateRowInput } from "@/lib/db/weeks";

interface RouteParams {
  params: Promise<{ weekStart: string; rowId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { rowId } = await params;
  const patch = (await request.json()) as UpdateRowInput;
  updateRow(Number(rowId), patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { rowId } = await params;
  removeRow(Number(rowId));
  return NextResponse.json({ ok: true });
}

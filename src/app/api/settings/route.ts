import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db/settings";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(request: Request) {
  const patch = await request.json();
  const next = updateSettings(patch);
  return NextResponse.json(next);
}

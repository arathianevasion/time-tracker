import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db/settings";
import { searchIssues } from "@/lib/jira/issues";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const { defaultProjectKeys } = getSettings();

  try {
    const results = await searchIssues(q, defaultProjectKeys);
    return NextResponse.json({ issues: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

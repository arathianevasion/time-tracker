import { NextResponse } from "next/server";
import { updateSettings } from "@/lib/db/settings";
import { JiraApiError } from "@/lib/jira/client";
import { getMyself } from "@/lib/jira/me";

export async function GET() {
  try {
    const me = await getMyself();
    updateSettings({ accountId: me.accountId });
    return NextResponse.json({ ok: true, accountId: me.accountId, displayName: me.displayName });
  } catch (err) {
    const status = err instanceof JiraApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: status === 401 ? 401 : 502 });
  }
}

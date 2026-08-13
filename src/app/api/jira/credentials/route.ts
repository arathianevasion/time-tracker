import { NextResponse } from "next/server";
import { writeLocalEnv } from "@/lib/env";
import { updateSettings } from "@/lib/db/settings";
import { JiraApiError } from "@/lib/jira/client";
import { getMyself } from "@/lib/jira/me";

export async function GET() {
  return NextResponse.json({
    baseUrl: process.env.JIRA_BASE_URL ?? "",
    email: process.env.JIRA_EMAIL ?? "",
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { baseUrl?: string; email?: string; apiToken?: string };
  const baseUrl = body.baseUrl?.trim().replace(/\/$/, "");
  const email = body.email?.trim();
  const apiToken = body.apiToken?.trim() || process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    return NextResponse.json({ ok: false, error: "Base URL, email, and an API token are all required" }, { status: 400 });
  }

  try {
    const me = await getMyself({ baseUrl, email, apiToken });

    writeLocalEnv({ JIRA_BASE_URL: baseUrl, JIRA_EMAIL: email, JIRA_API_TOKEN: apiToken });
    process.env.JIRA_BASE_URL = baseUrl;
    process.env.JIRA_EMAIL = email;
    process.env.JIRA_API_TOKEN = apiToken;
    updateSettings({ accountId: me.accountId });

    return NextResponse.json({ ok: true, accountId: me.accountId, displayName: me.displayName });
  } catch (err) {
    const status = err instanceof JiraApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: status === 401 ? 401 : 502 });
  }
}

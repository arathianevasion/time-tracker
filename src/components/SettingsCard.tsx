"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

export function SettingsCard() {
  const [projectKeysText, setProjectKeysText] = useState("");
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState(40);
  const [saved, setSaved] = useState(false);
  const [verify, setVerify] = useState<{ ok: boolean; accountId?: string; displayName?: string; error?: string } | null>(
    null,
  );
  const [checking, setChecking] = useState(false);

  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [savingConnection, setSavingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    ok: boolean;
    accountId?: string;
    displayName?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      setProjectKeysText(s.defaultProjectKeys.join(", "));
      setWeeklyHoursTarget(s.weeklyHoursTarget);
    });
    api.getJiraCredentials().then((c) => {
      setJiraBaseUrl(c.baseUrl);
      setJiraEmail(c.email);
    });
  }, []);

  async function save() {
    const defaultProjectKeys = projectKeysText
      .split(",")
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean);
    await api.updateSettings({ defaultProjectKeys, weeklyHoursTarget });
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  async function checkConnection() {
    setChecking(true);
    setVerify(null);
    try {
      setVerify(await api.verifyJira());
    } catch (err) {
      setVerify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setChecking(false);
    }
  }

  async function saveConnection() {
    setSavingConnection(true);
    setConnectionResult(null);
    try {
      const result = await api.updateJiraCredentials({
        baseUrl: jiraBaseUrl,
        email: jiraEmail,
        apiToken: jiraApiToken || undefined,
      });
      setConnectionResult(result);
    } catch (err) {
      setConnectionResult({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setJiraApiToken("");
      setSavingConnection(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2.5">
        <h2 className="text-base font-semibold">Settings</h2>
        <div className="flex-1" />
        {saved && <span className="text-xs font-medium text-green-600">Saved</span>}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-xs text-gray-500">Default project keys (comma-separated)</span>
          <input
            type="text"
            value={projectKeysText}
            onChange={(e) => setProjectKeysText(e.target.value)}
            onBlur={save}
            placeholder="PM"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-gray-500">Weekly hours target (5-day week)</span>
          <input
            type="number"
            min={1}
            max={80}
            step={0.5}
            value={weeklyHoursTarget}
            onChange={(e) => setWeeklyHoursTarget(parseFloat(e.target.value) || 40)}
            onBlur={save}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-secondary" disabled={checking} onClick={checkConnection}>
          {checking ? "Checking…" : "Check Jira connection"}
        </button>
        {verify?.ok && (
          <span className="text-xs text-green-700">
            Connected as {verify.displayName} ({verify.accountId})
          </span>
        )}
        {verify && !verify.ok && <span className="text-xs text-red-700">{verify.error}</span>}
      </div>

      <div className="mt-5 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold">Jira Connection</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs text-gray-500">Jira base URL</span>
            <input
              type="text"
              value={jiraBaseUrl}
              onChange={(e) => setJiraBaseUrl(e.target.value)}
              placeholder="https://your-org.atlassian.net"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-gray-500">Jira email</span>
            <input
              type="email"
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs text-gray-500">Jira API token</span>
            <input
              type="password"
              value={jiraApiToken}
              onChange={(e) => setJiraApiToken(e.target.value)}
              placeholder="Leave blank to keep the current token"
              autoComplete="new-password"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" className="btn-secondary" disabled={savingConnection} onClick={saveConnection}>
            {savingConnection ? "Saving…" : "Save connection"}
          </button>
          {connectionResult?.ok && (
            <span className="text-xs text-green-700">
              Connected as {connectionResult.displayName} ({connectionResult.accountId})
            </span>
          )}
          {connectionResult && !connectionResult.ok && (
            <span className="text-xs text-red-700">{connectionResult.error}</span>
          )}
        </div>
      </div>
    </div>
  );
}

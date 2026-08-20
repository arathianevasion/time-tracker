"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

const DEFAULT_JIRA_BASE_URL = "https://integritymarketing.atlassian.net";
const JIRA_TOKEN_URL = "https://id.atlassian.com/manage-profile/security/api-tokens";

export function SettingsCard({ onConnected }: { onConnected?: (email: string) => void } = {}) {
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
  const [showTokenHelp, setShowTokenHelp] = useState(false);

  useEffect(() => {
    if (!showTokenHelp) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTokenHelp(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showTokenHelp]);

  useEffect(() => {
    api.getSettings().then((s) => {
      setProjectKeysText(s.defaultProjectKeys.join(", "));
      setWeeklyHoursTarget(s.weeklyHoursTarget);
    });
    api.getJiraCredentials().then((c) => {
      setJiraBaseUrl(c.baseUrl || DEFAULT_JIRA_BASE_URL);
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
      if (result.ok) onConnected?.(jiraEmail);
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
            <span className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Jira API token</span>
              <button
                type="button"
                onClick={() => setShowTokenHelp(true)}
                className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800"
              >
                How do I get this?
              </button>
            </span>
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

      {showTokenHelp && <TokenHelpModal onClose={() => setShowTokenHelp(false)} />}
    </div>
  );
}

function TokenHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-help-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-lg"
      >
        <div className="flex items-center gap-2.5">
          <h3 id="token-help-title" className="text-base font-semibold">
            Getting a Jira API token
          </h3>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>
            Open{" "}
            <a href={JIRA_TOKEN_URL} target="_blank" rel="noreferrer" className="text-blue-600 underline">
              id.atlassian.com
            </a>
            .
          </li>
          <li>
            Click <strong>Create API token</strong>, and give it any name (e.g. &quot;Time Tracker&quot;).
          </li>
          <li>Copy the token it gives you.</li>
          <li>Paste it into the field here and click Save connection.</li>
        </ol>
        <p className="mt-3 text-xs text-gray-500">Tokens expire after about a year — come back here if this ever stops working.</p>
        <button type="button" className="btn-secondary mt-4 w-full" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

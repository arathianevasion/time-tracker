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

  useEffect(() => {
    api.getSettings().then((s) => {
      setProjectKeysText(s.defaultProjectKeys.join(", "));
      setWeeklyHoursTarget(s.weeklyHoursTarget);
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
    } finally {
      setChecking(false);
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
    </div>
  );
}

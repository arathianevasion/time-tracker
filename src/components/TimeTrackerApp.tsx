"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { defaultViewWeek } from "@/lib/time/week";
import { BaselineCard } from "./BaselineCard";
import { HistoryCard } from "./HistoryCard";
import { SettingsCard } from "./SettingsCard";
import { WeeklyGrid } from "./WeeklyGrid";

export function TimeTrackerApp() {
  const [weekStart, setWeekStart] = useState(defaultViewWeek());
  // null = still checking, "" = no saved credentials, otherwise the connected email.
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  useEffect(() => {
    api.getJiraCredentials().then((c) => setConnectedEmail(c.email));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold">Time Tracking Manager</h1>
        <p className="text-sm text-gray-500">Writes worklogs directly to integritymarketing.atlassian.net</p>
      </div>
      {connectedEmail === null ? null : connectedEmail === "" ? (
        <WelcomePanel onConnected={(email) => setConnectedEmail(email)} />
      ) : (
        <>
          {/* key={weekStart} remounts on week change so per-week UI state (banner, live-check) resets cleanly */}
          <WeeklyGrid key={weekStart} weekStart={weekStart} onNavigate={setWeekStart} />
          <SettingsCard />
          <BaselineCard />
          <HistoryCard onOpenWeek={setWeekStart} />
        </>
      )}
    </div>
  );
}

/** First-run screen for a brand-new install with no saved Jira login yet. */
function WelcomePanel({ onConnected }: { onConnected: (email: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h2 className="text-base font-semibold">Connect to Jira to get started</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter your Jira email and API token below — click &quot;How do I get this?&quot; next to the token field
          if you don&apos;t have one yet.
        </p>
      </div>
      <SettingsCard
        onConnected={(email) => {
          onConnected(email);
        }}
      />
    </div>
  );
}

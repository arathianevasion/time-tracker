"use client";

import { useState } from "react";
import { defaultViewWeek } from "@/lib/time/week";
import { BaselineCard } from "./BaselineCard";
import { HistoryCard } from "./HistoryCard";
import { SettingsCard } from "./SettingsCard";
import { WeeklyGrid } from "./WeeklyGrid";

export function TimeTrackerApp() {
  const [weekStart, setWeekStart] = useState(defaultViewWeek());

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold">Time Tracking Manager</h1>
        <p className="text-sm text-gray-500">Writes worklogs directly to integritymarketing.atlassian.net</p>
      </div>
      {/* key={weekStart} remounts on week change so per-week UI state (banner, live-check) resets cleanly */}
      <WeeklyGrid key={weekStart} weekStart={weekStart} onNavigate={setWeekStart} />
      <SettingsCard />
      <BaselineCard />
      <HistoryCard onOpenWeek={setWeekStart} />
    </div>
  );
}

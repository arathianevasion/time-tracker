"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { fmtHours, weekLabel } from "@/lib/client/format";
import type { WeekStatus } from "@/lib/time/status";
import { StatusBadge } from "./StatusBadge";

interface HistoryRow {
  weekStart: string;
  status: WeekStatus;
  totals: { totalMinutes: number; entryCount: number; syncedCount: number };
  workdayCount: number;
}

export function HistoryCard({ onOpenWeek }: { onOpenWeek: (weekStart: string) => void }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);

  useEffect(() => {
    api.listWeeks().then((res) => setRows(res.weeks));
  }, []);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-base font-semibold">History</h2>
      <div className="mt-1 text-xs text-gray-500">Weeks this app has touched.</div>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-gray-500 uppercase">
            <th className="pb-1.5">Week</th>
            <th className="pb-1.5 text-right">Days</th>
            <th className="pb-1.5 text-right">Hours</th>
            <th className="pb-1.5 text-right">Entries</th>
            <th className="pb-1.5">Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.weekStart} className="border-t border-gray-100">
              <td className="py-1.5">{weekLabel(row.weekStart)}</td>
              <td className="py-1.5 text-right">{row.workdayCount}</td>
              <td className="py-1.5 text-right">{fmtHours(row.totals.totalMinutes)}h</td>
              <td className="py-1.5 text-right">{row.totals.entryCount}</td>
              <td className="py-1.5">
                <StatusBadge status={row.status} />
              </td>
              <td className="py-1.5 text-right">
                <button type="button" className="btn-secondary" onClick={() => onOpenWeek(row.weekStart)}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

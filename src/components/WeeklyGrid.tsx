"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type WeekWithTotals } from "@/lib/client/api";
import { fmtHours, weekLabel } from "@/lib/client/format";
import { weekStatusFromRecord } from "@/lib/client/status";
import type { AllocateWeekResult } from "@/lib/time/allocate";
import { addDays, holidayFor, parseYmd, ymd } from "@/lib/time/week";
import { ExpenseCategoryBadge, IssueTypeBadge, ViewInJiraLink } from "./IssueMetaBadges";
import { IssuePicker } from "./IssuePicker";
import { StatusBadge } from "./StatusBadge";

type Banner = { type: "ok" | "err"; text: string } | null;

export function WeeklyGrid({
  weekStart,
  onNavigate,
}: {
  weekStart: string;
  onNavigate: (weekStart: string) => void;
}) {
  const [week, setWeek] = useState<WeekWithTotals | null>(null);
  const [alloc, setAlloc] = useState<AllocateWeekResult | null>(null);
  const [liveMinutes, setLiveMinutes] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [addingKind, setAddingKind] = useState<"baseline" | "one_off">("baseline");

  // persist=false (preview, read-only) for merely viewing a week; persist=true (materialize) only
  // after an actual edit or sync, since persisting can flip an unrelated already-synced entry's
  // sync_status back to 'pending' if the computed day-shape differs at all from what's stored —
  // even when nothing the user controls actually changed.
  const reload = useCallback(
    async (persist = false) => {
      const w = await api.getWeek(weekStart);
      setWeek(w);
      const m = persist ? await api.materialize(weekStart) : await api.preview(weekStart);
      setAlloc(m);
    },
    [weekStart],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch-on-weekStart-change, not a render loop
    reload(false);
  }, [reload]);

  if (!week || !alloc) return <div className="text-sm text-gray-400">Loading…</div>;

  const status = weekStatusFromRecord(week);
  const percentRows = week.rows.filter((r) => r.kind === "baseline");
  const oneOffRows = week.rows.filter((r) => r.kind === "one_off");

  const minutesForIssue = (issueKey: string) =>
    alloc.entries.filter((e) => e.issueKey === issueKey).reduce((s, e) => s + e.minutes, 0);

  async function toggleWorkday(date: string) {
    if (!week) return;
    const next = week.workdays.includes(date)
      ? week.workdays.filter((d) => d !== date)
      : [...week.workdays, date].sort();
    await api.setWorkdays(weekStart, next);
    await reload(true);
  }

  async function updatePct(rowId: number, pct: number) {
    await api.updateRow(weekStart, rowId, { pct });
    await reload(true);
  }

  async function updateOneOff(rowId: number, patch: { flatHours?: number; oneOffDate?: string }) {
    await api.updateRow(weekStart, rowId, patch);
    await reload(true);
  }

  async function removeRow(rowId: number) {
    await api.removeRow(weekStart, rowId);
    await reload(true);
  }

  async function addIssue(issue: {
    key: string;
    summary: string;
    issueType: string | null;
    expenseCategory: string | null;
  }) {
    const meta = { issueType: issue.issueType, expenseCategory: issue.expenseCategory };
    if (addingKind === "baseline") {
      await api.addRow(weekStart, {
        issueKey: issue.key,
        issueSummary: issue.summary,
        kind: "baseline",
        pct: 0,
        ...meta,
      });
    } else {
      await api.addRow(weekStart, {
        issueKey: issue.key,
        issueSummary: issue.summary,
        kind: "one_off",
        flatHours: 1,
        oneOffDate: week!.workdays[0],
        ...meta,
      });
    }
    await reload(true);
  }

  async function resetToBaseline() {
    await api.resetToBaseline(weekStart);
    await reload(true);
  }

  async function doSync() {
    setBusy(true);
    setBanner(null);
    try {
      const outcome = await api.sync(weekStart);
      if (outcome.failed > 0) {
        setBanner({
          type: "err",
          text: `${outcome.created} created, ${outcome.updated} updated, ${outcome.deleted} deleted, ${outcome.failed} failed — ${outcome.errors
            .slice(0, 3)
            .map((e) => `${e.issueKey} ${e.date}: ${e.message}`)
            .join("; ")}`,
        });
      } else {
        setBanner({
          type: "ok",
          text: `Done — ${outcome.created} created, ${outcome.updated} updated, ${outcome.deleted} deleted. Nothing duplicated.`,
        });
      }
    } catch (err) {
      setBanner({ type: "err", text: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setBusy(false);
      await reload();
    }
  }

  async function checkJira() {
    const res = await api.checkDrift(weekStart);
    setLiveMinutes(res.perIssueLiveMinutes);
  }

  const pctTotal = percentRows.reduce((s, r) => s + (r.pct ?? 0), 0);
  const pctOk = percentRows.length === 0 || Math.abs(pctTotal - 100) < 0.01;

  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-base font-semibold">Week of {weekLabel(weekStart)}</h2>
        <StatusBadge status={status} />
        <div className="flex-1" />
        <button type="button" className="btn-secondary" onClick={() => onNavigate(ymd(addDays(parseYmd(weekStart), -7)))}>
          ← Earlier
        </button>
        <button type="button" className="btn-secondary" onClick={() => onNavigate(ymd(addDays(parseYmd(weekStart), 7)))}>
          Later →
        </button>
      </div>

      {status === "inprogress" && (
        <div className="warn">
          This week hasn&apos;t finished yet. Time is normally logged for a completed week — use ← Earlier for last
          week.
        </div>
      )}
      {banner && <div className={banner.type === "ok" ? "ok-msg" : "err-msg"}>{banner.text}</div>}

      <div className="mt-3 text-xs text-gray-500">Working days (click to toggle):</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {Array.from({ length: 7 }, (_, i) => ymd(addDays(parseYmd(weekStart), i))).map((date) => {
          const dow = parseYmd(date).getDay();
          const on = week.workdays.includes(date);
          const holiday = holidayFor(date);
          if ((dow === 0 || dow === 6) && !on) return null;
          return (
            <button
              key={date}
              type="button"
              onClick={() => toggleWorkday(date)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                on ? "border-blue-300 bg-blue-50 font-semibold text-blue-800" : "border-gray-300 bg-white"
              }`}
            >
              {parseYmd(date).toLocaleDateString(undefined, { weekday: "short" })} {parseYmd(date).getDate()}
              <span className="block text-[10px] font-normal text-gray-400">
                {holiday ?? (dow === 0 || dow === 6 ? "weekend" : on ? "working" : "off")}
              </span>
            </button>
          );
        })}
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-gray-500 uppercase">
            <th className="pb-1.5">Issue</th>
            <th className="pb-1.5 text-right">%</th>
            <th className="pb-1.5 text-right">Week hours</th>
            <th className="pb-1.5 text-right">In Jira</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {percentRows.map((row) => (
            <tr key={row.id} className="border-t border-gray-100">
              <td className="py-1.5 align-top">
                <div>
                  {row.issueKey} — {row.issueSummary}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <IssueTypeBadge issueType={row.issueType} />
                  <ExpenseCategoryBadge expenseCategory={row.expenseCategory} />
                  <ViewInJiraLink issueKey={row.issueKey} />
                </div>
              </td>
              <td className="py-1.5 text-right align-top">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  defaultValue={row.pct ?? 0}
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
                  onBlur={(e) => updatePct(row.id, parseFloat(e.target.value) || 0)}
                />
              </td>
              <td className="py-1.5 text-right align-top text-gray-600">{fmtHours(minutesForIssue(row.issueKey))}h</td>
              <td className="py-1.5 text-right align-top text-gray-500">
                {liveMinutes ? `${fmtHours(liveMinutes[row.issueKey] ?? 0)}h` : "–"}
              </td>
              <td className="py-1.5 text-right align-top">
                <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => removeRow(row.id)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300 font-semibold">
            <td className="pt-1.5">Total</td>
            <td className={`pt-1.5 text-right ${pctOk ? "text-green-600" : "text-red-600"}`}>{pctTotal}%</td>
            <td className="pt-1.5 text-right">{fmtHours(alloc.remainingPoolMinutes)}h</td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
      {!pctOk && (
        <div className="warn">Recurring percentages must total 100% of the remaining pool (currently {pctTotal}%).</div>
      )}

      {oneOffRows.length > 0 && (
        <>
          <div className="mt-4 text-xs font-semibold text-gray-500">One-offs</div>
          <table className="mt-1 w-full text-sm">
            <tbody>
              {oneOffRows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="py-1.5 align-top">
                    <div>
                      {row.issueKey} — {row.issueSummary}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <IssueTypeBadge issueType={row.issueType} />
                      <ExpenseCategoryBadge expenseCategory={row.expenseCategory} />
                      <ViewInJiraLink issueKey={row.issueKey} />
                    </div>
                  </td>
                  <td className="py-1.5 text-right align-top">
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      defaultValue={row.flatHours ?? 0}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
                      onBlur={(e) => updateOneOff(row.id, { flatHours: parseFloat(e.target.value) || 0 })}
                    />
                    h
                  </td>
                  <td className="py-1.5 text-right align-top">
                    <select
                      defaultValue={row.oneOffDate ?? week.workdays[0]}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                      onChange={(e) => updateOneOff(row.id, { oneOffDate: e.target.value })}
                    >
                      {week.workdays.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 text-right align-top">
                    <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => removeRow(row.id)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1">
          <IssuePicker
            excludeKeys={addingKind === "baseline" ? percentRows.map((r) => r.issueKey) : []}
            onSelect={addIssue}
            placeholder={addingKind === "baseline" ? "Add a recurring issue…" : "Add a one-off issue…"}
          />
        </div>
        <select
          value={addingKind}
          onChange={(e) => setAddingKind(e.target.value as "baseline" | "one_off")}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="baseline">Recurring (%)</option>
          <option value="one_off">One-off (hours)</option>
        </select>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Week target {fmtHours(alloc.weekTargetMinutes)}h · one-offs {fmtHours(alloc.oneOffMinutes)}h · remaining pool{" "}
        {fmtHours(alloc.remainingPoolMinutes)}h
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" className="btn-primary" disabled={busy || !pctOk} onClick={doSync}>
          {busy
            ? "Writing to Jira…"
            : status === "logged" || status === "partial"
              ? "Re-log this week (updates in place)"
              : "Log this week to Jira"}
        </button>
        <button type="button" className="btn-secondary" onClick={resetToBaseline}>
          Reset to baseline
        </button>
        <button type="button" className="btn-secondary" onClick={checkJira}>
          Re-check Jira
        </button>
      </div>
    </div>
  );
}

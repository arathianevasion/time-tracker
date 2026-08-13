"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { BaselineItem } from "@/lib/db/types";
import { ExpenseCategoryBadge, IssueTypeBadge, ViewInJiraLink } from "./IssueMetaBadges";
import { IssuePicker } from "./IssuePicker";

interface DraftRow {
  issueKey: string;
  issueSummary: string;
  pct: number;
  issueType: string | null;
  expenseCategory: string | null;
}

export function BaselineCard() {
  const [items, setItems] = useState<BaselineItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [saved, setSaved] = useState(false);

  const load = () => api.getBaseline().then((res) => setItems(res.items));

  useEffect(() => {
    load();
  }, []);

  function startEdit() {
    setDraft(
      items.map((i) => ({
        issueKey: i.issueKey,
        issueSummary: i.issueSummary,
        pct: i.pct,
        issueType: i.issueType,
        expenseCategory: i.expenseCategory,
      })),
    );
    setEditing(true);
  }

  async function save() {
    await api.saveBaseline(draft);
    await load();
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  const total = draft.reduce((s, r) => s + (r.pct || 0), 0);
  const ok = draft.length > 0 && Math.abs(total - 100) < 0.01;

  if (editing) {
    return (
      <div className="rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold">Edit baseline</h2>
        <div className="mt-1 text-xs text-gray-500">
          Percentages must total 100. This is the recurring split every new week starts from.
        </div>

        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-gray-500 uppercase">
              <th className="pb-1.5">Issue</th>
              <th className="pb-1.5 text-right">%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draft.map((row, i) => (
              <tr key={row.issueKey} className="border-t border-gray-100">
                <td className="py-1.5">
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
                    step={1}
                    value={row.pct}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value) || 0;
                      setDraft((d) => d.map((r, j) => (j === i ? { ...r, pct } : r)));
                    }}
                  />
                </td>
                <td className="py-1.5 text-right align-top">
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3">
          <IssuePicker
            excludeKeys={draft.map((r) => r.issueKey)}
            onSelect={(issue) =>
              setDraft((d) => [
                ...d,
                {
                  issueKey: issue.key,
                  issueSummary: issue.summary,
                  pct: 0,
                  issueType: issue.issueType,
                  expenseCategory: issue.expenseCategory,
                },
              ])
            }
            placeholder="Add an issue to the baseline…"
          />
        </div>

        <div className={`mt-2.5 text-sm font-medium ${ok ? "text-green-600" : "text-red-600"}`}>
          Total: {total}% {ok ? "" : "(must total 100%)"}
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-primary" disabled={!ok} onClick={save}>
            Save baseline
          </button>
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2.5">
        <h2 className="text-base font-semibold">Baseline split</h2>
        <div className="flex-1" />
        {saved && <span className="text-xs font-medium text-green-600">Saved</span>}
      </div>
      <div className="mt-1 text-xs text-gray-500">Stored only on this machine — never written to Jira.</div>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-gray-500 uppercase">
            <th className="pb-1.5">Issue</th>
            <th className="pb-1.5 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-t border-gray-100">
              <td className="py-1.5">
                <div>
                  {row.issueKey} — {row.issueSummary}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <IssueTypeBadge issueType={row.issueType} />
                  <ExpenseCategoryBadge expenseCategory={row.expenseCategory} />
                  <ViewInJiraLink issueKey={row.issueKey} />
                </div>
              </td>
              <td className="py-1.5 text-right align-top">{row.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4">
        <button type="button" className="btn-secondary" onClick={startEdit}>
          Edit baseline
        </button>
      </div>
    </div>
  );
}

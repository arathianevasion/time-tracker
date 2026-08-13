"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { IssueSuggestion } from "@/lib/jira/issues";
import { ExpenseCategoryBadge, IssueTypeBadge } from "./IssueMetaBadges";

type IssueOption = IssueSuggestion;

export function IssuePicker({
  onSelect,
  excludeKeys = [],
  placeholder = "Search issues…",
}: {
  onSelect: (issue: IssueOption) => void;
  excludeKeys?: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<IssueOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.searchIssues(query);
        setOptions(res.issues.filter((i) => !excludeKeys.includes(i.key)));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>}
          {!loading && options.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No matching issues</div>
          )}
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(opt);
                setQuery("");
                setOptions([]);
                setOpen(false);
              }}
            >
              <div>
                <span className="font-medium">{opt.key}</span>{" "}
                <span className="text-gray-500">— {opt.summary}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <IssueTypeBadge issueType={opt.issueType} iconUrl={opt.issueTypeIconUrl} />
                <ExpenseCategoryBadge expenseCategory={opt.expenseCategory} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

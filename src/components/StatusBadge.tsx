import type { WeekStatus } from "@/lib/time/status";

const LABEL: Record<WeekStatus, string> = {
  unlogged: "Not logged yet",
  logged: "Logged to Jira",
  partial: "Partially logged",
  inprogress: "Week in progress",
  future: "Future week",
};

const CLASS: Record<WeekStatus, string> = {
  unlogged: "bg-gray-100 text-gray-500",
  logged: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-800",
  inprogress: "bg-blue-100 text-blue-800",
  future: "bg-slate-100 text-slate-600",
};

export function StatusBadge({ status }: { status: WeekStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASS[status]}`}>
      {LABEL[status]}
    </span>
  );
}

**WEEKLY JIRA TIME TRACKER**

Product Requirements Document

Version 1.0 — Draft for review

August 12, 2026

Prepared for Andy

# Contents

# 1. Executive Summary

A local, single-user app that logs weekly time against Jira issues on `integritymarketing.atlassian.net`. Each week, Andy allocates his time across a small set of recurring Jira issues by percentage (seeded from an editable baseline), adds any one-off exceptions in flat hours, and the app computes exact hour allocations — reconciled to the week's target and rounded to the quarter-hour — then syncs them to Jira as one worklog per issue per workday. Re-opening and re-logging a week updates existing worklogs in place via a locally tracked worklog-ID ledger, so nothing is ever duplicated.

This replaces `time-tracking-manager.html` (see §4), a working prototype that ran inside a Claude Cowork/local-agent-mode session and has already been used to log real time — including 30 real worklogs written for the week of Aug 3–7, 2026. That prototype called Jira through an MCP connection (`window.cowork.callMcpTool`) available only inside that specific Claude runtime. This app reproduces and refines the same behavior as a standalone, durable, version-controlled tool that talks to Jira's REST API directly.

## 1.1 Decisions already locked

- **Scope:** single user (just Andy). No multi-user, no OAuth, no org-admin approval needed.
- **Runtime:** local only — `npm run dev`, no hosting or deployment.
- **Direction:** time entries sync to Jira as real worklogs (one-way write; Jira is the system of record for logged time itself).
- **Auth:** personal Jira API token (Basic Auth).
- **Issue scope:** a configurable list of Jira project keys ("primary projects"), not literal Agile board objects.
- **Weekly editing:** by percent, not raw hours — plus one-off flat-hour entries for exceptions, which carve hours out of the week before percentages are applied.
- **Rounding:** everything rounds to the nearest 0.25h; totals always reconcile exactly to the week's target (workdays × 8h).
- **Continuity:** the app inherits the prototype's real data (baseline + the Aug 3–7 worklog-ID ledger) so re-opening that week updates existing worklogs instead of duplicating them.

# 2. Objectives & Success Metrics

## 2.1 Objective

Make weekly time logging near-zero-effort while keeping Jira worklogs complete and accurate for Andy's configured projects.

## 2.2 Success metrics

| Metric | Definition |
| --- | --- |
| Time to log a week | Open the week, adjust % / one-offs if needed, hit log — a couple of minutes, not a reconstruction exercise |
| Reconciliation accuracy | Every week's logged total equals `workdays × 8h` exactly, no rounding drift |
| Duplicate rate | Zero duplicate worklogs, ever — including across restarts and repeated re-logging of the same week |
| Migration correctness | The Aug 3–7 week (already logged by the prototype) is recognized as already-synced on first run, not re-created |

## 2.3 Non-goals for v1

- Multi-user support or any hosting/deployment.
- Tempo Timesheets or any other Jira time-tracking add-on integration.
- Categories/tags on entries independent of the Jira issue itself.
- Non-US holiday calendars.
- Literal Jira Agile board scoping (project-key scoping is sufficient).

# 3. Users & Roles

Just Andy — owner, sole user, sole author of every worklog this app creates.

# 4. Prototype Reference — What `time-tracking-manager.html` Establishes

The existing prototype (preserved at `reference/time-tracking-manager.html`) is a remarkably complete specification of the allocation and sync mechanics. This section records what production adopts as-is, and what changes for the standalone app.

## 4.1 Adopted as-is

- **Baseline model:** a list of `{issueKey, summary, pct}` that must sum to 100%, edited in a dedicated baseline editor, stored independently of any given week.
- **Week view defaults to the prior week** (not the current, in-progress one), with a warning banner if you navigate to the current week anyway — time is normally logged for a completed week.
- **Workday chips:** Mon–Fri pre-toggled on, auto-excluding computed US federal holidays (Columbus Day/Veterans Day may need manual re-enabling if Integrity works those days); any day is manually toggleable.
- **Daily rate is fixed** at `weeklyHoursTarget / 5` (default 8h) regardless of how many workdays are selected — so a short week (holiday) genuinely totals fewer hours; it doesn't compress the same total into fewer days.
- **Per-day even split** of each row's weekly hours across the selected workdays, with a remainder-distribution step so the days sum exactly to the row's weekly total.
- **Upsert-by-ledger duplicate prevention:** every `(issueKey, date)` pair that's been logged before has its Jira worklog ID recorded locally; re-logging a week always updates those exact worklogs (`PUT`) instead of creating new ones, and IDs for days dropped from the week are pruned from the ledger.
- **Live Jira cross-check:** an "in Jira" column per issue showing hours actually found on Jira for that week, filtered to Andy's own `accountId` and the week's date range.
- **History view:** a list of past weeks with status (unlogged / partial / logged / in-progress) and one click back into any of them.

## 4.2 Prototype → production deltas

| Area | Prototype | Production |
| --- | --- | --- |
| Jira access | `window.cowork.callMcpTool(...)` — only works inside a Claude Cowork session | Direct Jira REST API v3 calls from server-side Next.js Route Handlers, authenticated with a personal API token |
| Persistence | `localStorage`, single browser profile | SQLite file (`better-sqlite3`), survives restarts, inspectable/backup-able |
| Project scope | Hardcoded `project = PM` | Configurable list of project keys in Settings; issue search/JQL scoped to `project in (...)` |
| Identity | Hardcoded account ID | Fetched live via `GET /rest/api/3/myself` on startup, cached |
| Weekly edit unit | Raw hours per issue, directly overridable | Percent per issue, plus one-off flat-hour line items for exceptions (§6.3) |
| Rounding | Whole-minute, remainder distributed across days within a row | 0.25h (15-minute) granularity, remainder reconciled both across rows (week total is exact) and across days within a row |
| Cross-check accuracy | Reads the issue's embedded `worklog` field, capped at 20 entries — truncation flagged but not fixed | Uses the dedicated paginated worklog endpoint — no cap, no truncation |
| Data continuity | N/A | Seeded on first run from the prototype's exact baseline + the Aug 3–7 worklog-ID ledger (§11) |

# 5. System Architecture

## 5.1 Components

| Component | Responsibility | Technology |
| --- | --- | --- |
| App | Weekly grid UI, baseline editor, settings, history | Next.js (App Router), React, Tailwind |
| API proxy | Keeps the Jira API token server-side; all Jira calls go through here | Next.js Route Handlers (Node runtime) |
| Local store | Baseline, week rows, materialized daily entries, sync ledger | SQLite via `better-sqlite3`, no ORM |
| Jira | Issue search, worklog CRUD, identity, live cross-check | Jira Cloud REST API v3 (`integritymarketing.atlassian.net`) |

## 5.2 Build principles

- **Server-side token only.** Jira Cloud's REST API does not support browser CORS for arbitrary origins, so a server-side proxy is required regardless of stack; this also guarantees the token never reaches a client bundle.
- **Local-first, Jira-second.** The weekly grid reads/writes SQLite directly and works offline; syncing to Jira is an explicit, separate step.
- **Verify before building.** Atlassian enforces a 1-year API token expiry — a live auth check against `integritymarketing.atlassian.net` is the first implementation step, before any other app code.
- **Independent repo.** This project is its own git repository, not nested inside any other project's history.

# 6. Feature Requirements

## 6.1 Baseline management

CRUD list of `{issueKey, summary (cached from Jira), pct}`. Percentages must sum to exactly 100% to save. Issue picker is scoped to the configured default project keys (§6.7). The picker also shows each candidate issue's type (Epic/Story/Task, with Jira's own icon) and Andy's org-specific "Expense Category" custom field (OpEx/CapEx/Time Off/One Time Cost, or "None" if unset) so he can tell what he's adding — both are fetched live per search (issue-picker endpoint doesn't return them, so a follow-up batched lookup enriches the results) and persisted on the baseline/week row once added, rather than re-fetched on every view. Every baseline and weekly-grid row also has a "View in Jira ↗" link that opens the real issue in a new tab.

## 6.2 Weekly allocation

Opening a week seeds it from the current baseline (or from that week's own previously-saved state, if it's been opened/logged before). Per week, Andy can — without touching the baseline:

- Edit an issue's percent for that week only.
- Add or remove an issue for that week only.
- Add a **one-off** line item: an issue + a flat hour amount (not a percent) + a specific date within the week — for exceptions like a meeting, PTO, or ad hoc task that doesn't belong in the recurring baseline and shouldn't be smeared across every workday.
- Toggle which days count as workdays for that week (defaults per §6.7).

## 6.3 Allocation & rounding engine (new — not in the prototype)

1. Week target total = `workdays_selected × dailyRate` (`dailyRate = weeklyHoursTarget / 5`, default 8h).
2. One-off rows: each has its own flat hour amount, rounded to the nearest 0.25h, and its own specific date (must be one of the week's selected workdays) — no splitting, one worklog per one-off.
3. **Each workday's own remaining capacity** for percent-based work = `dailyRate − (sum of one-off hours pinned to that date)`, floored at 0. A day with no one-offs has the full daily rate available; a day whose one-offs alone exceed the daily rate floors at 0 and does not borrow capacity from other days (the week's percent-based total simply shrinks by that day's overage).
4. Remaining pool = **sum of every workday's capacity** (equivalent to `week target − one-off total` unless a single day's one-offs exceed its own daily rate, per the floor above).
5. Percent-based rows' weekly hours = `pct% × remaining pool`, rounded to the nearest 0.25h with row-level drift reconciled (largest row(s) absorb ±0.25h) so they sum to exactly the remaining pool. Percent rows must sum to exactly 100% of the remaining pool — validated the same way the baseline itself is.
6. **Day-by-day fill** (replaces a flat even split across all workdays): processing workdays in order, each day's capacity is apportioned across the percent rows by each row's still-unallocated weekly budget, using the same largest-remainder method as step 5. A day with reduced capacity (because of a one-off) receives proportionally less percent-based work that day; the shortfall is automatically picked up by later days, since a row's full weekly total is only guaranteed to land by the last workday. This means a given day may have no hours logged against some percent rows at all — expected behavior, not a gap.
7. Each `(issue, date)` pair with hours > 0 — whether a percent row's day-fill share or a one-off's single date — becomes a worklog create-or-update, keyed off the local ledger.

## 6.4 Sync to Jira

Sequential (not parallel) requests per row/day, respecting `Retry-After` on 429. `notifyUsers=false` so routine logging doesn't notify project watchers. Templated worklog comment ("Weekly time allocation — {summary} (week of {date})"), in Atlassian Document Format. Ledger keyed by `issueKey|date` → `worklogId`; re-logging a week updates in place; days dropped from a week have their ledger entries pruned and their worklogs deleted from Jira.

## 6.5 Live Jira cross-check

Per baseline/week issue, sum worklogs authored by Andy's `accountId` within the viewed week's date range, using the paginated worklog endpoint (no 20-item cap). Shown alongside the computed allocation so drift (e.g. a worklog edited or deleted directly in Jira) is visible.

## 6.6 History

List of past weeks with status (unlogged / partial / logged / in-progress), total hours, entry count, and a jump-to-week action.

## 6.7 Settings

- Default project keys (list) — scopes issue search everywhere in the app.
- Work week definition — which weekdays count by default (Mon–Fri minus computed US federal holidays; per-week override always available via the day chips).
- Weekly hours target (default 40 → 8h/day).

# 7. Data Model (SQLite)

- `settings` (single row): `default_project_keys` (JSON array), `weekly_hours_target`, `account_id` (cached from `/myself`).
- `baseline_items`: `id, issue_key, issue_summary, pct, sort_order, issue_type (nullable), expense_category (nullable)`.
- `week_rows`: `id, week_start, issue_key, issue_summary, kind ('baseline'|'one_off'), pct (nullable, one-offs have none), flat_hours (nullable, only one-offs), one_off_date (nullable, only one-offs — a single date within the week), workdays (JSON array for that week), issue_type (nullable), expense_category (nullable)`.

`issue_type`/`expense_category` were added via a small idempotent migration (`ALTER TABLE ... ADD COLUMN` guarded by `PRAGMA table_info`, run on every startup) rather than a full migration framework — this is the app's first schema change since launch, and establishes the pattern for the next one. A new week's baseline-kind rows copy these straight from `baseline_items` rather than re-querying Jira (`seedBaselineRows`). Existing rows created before this feature are backfilled once via `npm run backfill-issue-metadata`.
- `time_entries` (computed/materialized per issue+day): `id, week_row_id, entry_date, minutes (0.25h-rounded), jira_worklog_id (nullable), sync_status ('pending'|'synced'|'error'|'deleting'), sync_error, updated_at`.

# 8. API Design

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/jira/verify` | `/myself` health check; used at startup and as a manual "check my token" action |
| GET | `/api/jira/issues/search?q=` | Issue typeahead, scoped to configured project keys |
| GET/PUT | `/api/baseline` | Read/replace the baseline (percent list, must sum to 100) |
| GET/POST/PATCH/DELETE | `/api/weeks/:weekStart/rows` | Manage a week's rows (baseline-seeded, edited, one-off) |
| POST | `/api/weeks/:weekStart/preview` | Read-only recompute for display — used whenever a week is merely viewed/navigated to. Never writes to `time_entries` or touches `sync_status`. |
| POST | `/api/weeks/:weekStart/materialize` | Recomputes **and persists** into `time_entries`, flipping affected rows' `sync_status` back to `pending`. Used only after an actual edit (row/workday change) or immediately before `/api/sync` — never on mere navigation, since persisting an unedited week can flip an already-synced entry to `pending` if the computed day-shape differs at all from what's stored, even when the row's weekly total is unchanged. |
| POST | `/api/sync` | Run the allocation engine for a week and push create/update/delete worklogs to Jira |
| POST | `/api/sync/drift` | Live cross-check: paginated worklog read per issue for the viewed week. Checks any entry with a `jira_worklog_id`, regardless of local `sync_status` — a worklog id existing is the real signal Jira has something for it. |
| GET/PUT | `/api/settings` | Default project keys, work week definition, weekly hours target |

Full route contracts (request/response shapes) are finalized in the technical design doc that follows this PRD.

# 9. Security & Privacy

- Jira API token lives only in `.env.local` (gitignored); never reaches a client bundle — enforced by Next.js's server/client boundary.
- SQLite data file is gitignored.
- Nothing leaves the local machine except calls to Jira itself; no analytics, no third-party services.

# 10. Non-Functional Requirements

- Rounding must be exact: every week's logged total equals `workdays × 8h` to the quarter-hour — no silent drift.
- Never duplicate a worklog, including across process restarts.
- Correctly handle issues with more than 20 worklogs (paginated cross-check, not the prototype's capped read).
- `started` timestamps are DST-safe — computed from the real local offset at that date, not a hardcoded offset.

# 11. Scope & Roadmap

## 11.1 v1

Everything in §6.

## 11.2 v1.5 — fast follows

- Promote a one-off row to a permanent baseline entry.
- CSV/copyable weekly summary export.
- Configurable (non-US) holiday calendar.

## 11.3 v2

Revisit hosting only if a second user is ever needed.

## 11.4 Migration note

First run seeds `baseline_items` from the prototype's exact 6-issue baseline (PM-159, PM-97, PM-158, PM-89, PM-87, PM-152) and creates `week_rows`/`time_entries` for the week of 2026-08-03, pre-populated with the 30 real worklog IDs already recorded in `time-tracking-manager.html`'s `SEED` constant, so that week is recognized as already-synced. The first live sync of that week should re-verify — not blindly trust — that those IDs still exist on Jira before treating them as current.

# 12. Open Decisions & Risks

## 12.1 Resolved

- **One-off distribution:** one-offs are logged against a single specific date the user picks (§6.2, §6.3), not split across the week.
- **Percent-row validation scope:** percent rows must sum to exactly 100% of the remaining pool (post-one-offs) each week, same rule the baseline itself uses.

## 12.2 Risks

- **Token expiry:** Atlassian enforces a 1-year API token expiry. Verify a live token works against `integritymarketing.atlassian.net` before writing any other code — if the org blocks classic API tokens entirely, the auth approach needs to pivot before more time is invested.
- **Seed data trust:** the inherited Aug 3–7 ledger should be live-verified against Jira on first run rather than assumed correct, in case anything changed since it was written.

## 12.3 Immediate next steps

Implementation is underway directly from this PRD (no separate technical design doc for a project this size).

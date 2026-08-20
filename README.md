# Weekly Jira Time Tracker

Local, single-user app that logs weekly time against Jira issues on `integritymarketing.atlassian.net` as real worklogs. See `docs/PRD.md` for the full spec and `reference/time-tracking-manager.html` for the prototype this replaces.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` (already done if you're continuing this session) and fill in:
   - `JIRA_BASE_URL` — `https://integritymarketing.atlassian.net`
   - `JIRA_EMAIL` — your Atlassian account email
   - `JIRA_API_TOKEN` — generate at https://id.atlassian.com/manage-profile/security/api-tokens (tokens expire after 1 year)
3. `npm run verify-auth` — confirms the token works before you rely on anything else. If you hand-edit `.env.local` directly, restart `npm run dev` afterward (Next only reads env files at process start) — but you generally shouldn't need to: once the app is running, Settings → Jira Connection lets you update the base URL, email, or token in place, and it takes effect immediately (no restart).
4. `npm run dev` — open http://localhost:3000

Andy-only, one-time: `npm run seed` loads the baseline and the already-logged Aug 3–7 2026 week from the prototype's data, so this app doesn't re-create those worklogs. It reads `scripts/seed.ts` and `src/lib/db/seed.ts`, which are deliberately gitignored (real Jira baseline + worklog IDs) and won't exist on a fresh clone — this step is a no-op for anyone else.

## Scripts

- `npm run dev` / `build` / `start` — standard Next.js
- `npm run package` — builds the zero-dependency distributable bundles (see Distribution below)
- `npm run verify-auth` — standalone Jira auth check (`scripts/verify-auth.ts`)
- `npm run seed` — one-time migration from the prototype's data (`scripts/seed.ts`, Andy-only — see Setup above)
- `npm test` — Vitest unit tests (allocation/rounding engine, date/holiday helpers)
- `npm run lint` — ESLint

## How it works

- **Baseline**: a recurring split of your time across Jira issues, by percent, summing to 100.
- **Each week** starts from the baseline; you can add/remove/edit percentages for that week only, or add **one-off** entries (a flat hour amount on a specific date) that carve hours out of the week before percentages are applied to what's left.
- **Allocation**: each workday's capacity is `8h` minus whatever one-offs land on it that day; percentages are applied to what's left and filled in day by day, so a day with a big one-off gets less percent-based work and the rest of the week picks up the difference — the weekly total still always reconciles exactly. Rounds to the nearest quarter hour. See `src/lib/time/allocate.ts`.
- **Sync**: "Log this week to Jira" writes one worklog per issue per day. Re-logging updates existing worklogs in place (tracked by a local worklog-ID ledger keyed on issue + date) instead of duplicating.
- **Data lives locally only**: SQLite in `data/time-tracker.db` (gitignored) when running from a repo checkout via `npm run dev`. In a packaged install (see Distribution below) it lives outside the app bundle entirely, in a per-user data directory, so an update never touches it. Nothing leaves your machine except calls to Jira itself.

## Notes

- Jira Cloud's REST API doesn't support browser CORS, so all Jira calls go through server-side Next.js route handlers — the API token never reaches the browser.
- Issue search is scoped to the project keys configured in Settings (default: `PM`).
- Jira base URL, email, and API token are all editable from Settings → Jira Connection. The token field is write-only — it's never prefilled or returned by any API response, only replaceable. A save validates the new credentials live against Jira before committing; a bad value leaves the previous working credentials untouched. `.env.local` is locked to owner-only permissions (`600`) every time it's written.

## Distribution

Teammates run a packaged, zero-dependency bundle — no Node, no Git, no `npm install`, no admin rights. See `GETTING_STARTED.md` for the teammate-facing instructions and `docs/PRD.md` §5.3 for the full design.

To build and publish a new release (macOS arm64 only, run from a repo checkout with `gh` authenticated):

1. Bump `"version"` in `package.json`.
2. `npm run package` — runs `next build` (`output: "standalone"`), then assembles and zips `dist/TimeTracker-mac-arm64.zip`, `dist/TimeTracker-windows.zip` (bundling a pinned Node 24 LTS runtime for each target from nodejs.org), `dist/app.zip` (the platform-independent auto-update payload), and `dist/VERSION.txt`.
3. `gh release create v<version> dist/TimeTracker-mac-arm64.zip dist/TimeTracker-windows.zip dist/app.zip dist/VERSION.txt`

Every teammate's launcher checks `.../releases/latest/download/VERSION.txt` on each run and self-updates from `app.zip` if it's behind — nothing needs to be re-shared for ordinary code changes. A bump to the bundled Node runtime or to `launcher.mjs` itself does need a fresh full-bundle download, since neither is part of the auto-update payload.

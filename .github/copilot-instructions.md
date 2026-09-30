# Copilot Instructions

## Build, test, and lint commands

This project is a vanilla HTML/CSS/JS app with no package manager, build step, or CI workflow.

- Run locally (from `tournament_software/`): `py -m http.server 8080`
- Admin UI: `http://localhost:8080/index.html`
- Teams summary UI: `http://localhost:8080/summary.html`

Regression tests use Node built-ins with isolated VM/browser-like sandboxes; no dependencies or package manager are needed.

- Full regression suite: `node --test --test-concurrency=1 "tests/*.test.js"`
- Focused file: `node --test tests/02-timer.test.js`
- Read the final pass/fail counts and assertion locations; a clean run has no failed, cancelled, skipped, or todo tests.

No formal lint runner is configured.

- Single-file JS syntax check: `node --check .\js\actions.js`
- Full JS syntax sweep: `Get-ChildItem .\js\*.js | ForEach-Object { node --check $_.FullName }`
- JS and test syntax sweep: `Get-ChildItem .\js\*.js, .\tests\*.js | ForEach-Object { node --check $_.FullName }`

## High-level architecture

- The app has two pages over a shared client-side state:
  - `index.html`: admin workflow (teams, terrains, config, phase generation, scoring, corrections)
  - `summary.html`: read-only teams view (match schedule/results)
- Shared persistence is `localStorage` under key `tournament_software_state_v1`.
- `index.html` and `summary.html` use relative local assets/scripts and work when opened directly via `file://`; `py -m http.server` is a convenience, not a requirement
- Admin runtime is split into IIFE-style global modules loaded in this order:
  1. `js/state.js` - canonical state shape, import/export/sanitize, pub-sub updates
  2. `js/timer.js` - shared round/match elapsed-time and countdown calculations
  3. `js/rules.js` - standings and winner/loser helpers
  4. `js/scheduler.js` - phase 1 pairing generation and terrain-aware round grouping
  5. `js/bracket.js` - seeded power-of-two knockout creation, BYE handling, propagation, and recomputation
  6. `js/actions.js` - all state mutations and guardrails (validation, resets, score updates, timers)
  7. `js/render.js` - HTML rendering, stage gating, preference persistence, and event wiring
     using `data-action` / `data-role`
  8. `js/main.js` - bootstrap, state subscription, and one-second timer ticks
- `js/summary.js` is a separate read-only renderer. It shares `rules.js`, `bracket.js`, `timer.js`, and the state storage key, but does not load the admin state/actions/render modules.

## Key conventions in this codebase

- Keep module pattern consistent: browser IIFE + `window.Tournament*` namespace exports.
- Keep script load order in `index.html`; modules depend on earlier globals.
- Treat `state.js` as the source of truth for state schema and migration-safe defaults.
- Preserve the shared storage key (`tournament_software_state_v1`) across admin and summary pages.
- `state.js` owns the update pipeline: mutate through `TournamentState.update`, which appends an audit entry when supplied, saves to `localStorage`, and notifies subscribers. Export/import covers config/rules, teams, terrains, schedules, scores, timers, and audit; a valid import replaces current state after sanitization, `Reset all` restores the default tournament state, and malformed stored JSON falls back to a new default state.
- Config form values apply only when `Save config` is submitted; generating phase 1 locks config, teams, and terrains until `Reset phases`.
- `Reset phases` clears phase 1 and knockout schedules and timers while preserving teams, terrains, and config so a fresh phase 1 schedule can be generated.
- Phase integrity convention: phase 1 score/reopen changes invalidate knockout data; knockout score/reopen changes clear dependent downstream matches and recompute propagation. Use the existing reset/recompute paths in `actions.js` and `bracket.js` rather than ad-hoc updates.
- Match objects use stable shape and status contract:
  - `status` is `"scheduled"` or `"completed"`
  - scores are `null` until completion
  - timer fields include `pausedAt`, `pausedTotalMs`, and `finalElapsedMs`; knockout matches also carry source/next-match links
- Scheduler rule: phase 1 generation uses configured `phase1MatchesPerTeam` and rejects impossible setups (`team_count * phase1MatchesPerTeam` must be even).
- With no terrains, a phase 1 round has unlimited capacity; with terrains, a round is capped at one match per terrain and avoids team collisions.
- Knockout generation is gated until every phase 1 match has status `"completed"`.
- Standings sort by points, then goal average (`ga`) descending, then goals conceded (`gc`) ascending, then team name. `gt` is goals scored, `gd` is `gt - gc`; Best and Last are informational only, not tie-breaks.
- Operator, summary, and print standings share one column set (`# Team P W D L GT GC GA GD Last Best Pts`); keep the three in sync. `ga` is stored raw and formatted with `toFixed(2)` at render time only.
- Best-value highlighting comes from `TournamentRules.getStandingsBestValues`, which lives in `rules.js` because that module is the only one both pages load. It returns `null` for a column when nothing should be highlighted (no match played yet, or every row sharing the same value).
- Standings signals are cell backgrounds, never text color or pills: `.standings-qualified` (rank + team cells of the top N) and `.stat-best`, both in `css/style.css` with `print-color-adjust: exact` so they survive printing. Their tints (`--qualified-bg`, `--best-bg`) are chosen to land on distinct grey levels in B&W print; keep that property if retuning them.
- Config form durations are entered in minutes and converted to seconds before storage; timer logic uses seconds in state and milliseconds in calculations.
- Pause/break duration is informational only: it drives the visible break countdown and never automatically pauses or stops matches.
- Each round has one shared timer start for all its matches; an individual match can be paused/resumed while the round is active, and clocks show overtime past configured match duration.
- Completed matches lock their score and team controls until `Reopen` is used. Phase 1 allows draws; knockout score validation rejects draws.
- Rendered HTML escapes user-controlled names and IDs with the local `esc` helper. Dynamic controls use delegated `data-action` clicks under `#app-root`; inputs and clocks are addressed with `data-role` plus `data-match-id`.
- Operator section/round open state is stored separately under `tournament_software_operator_ui_prefs_v1`. Summary visibility and auto-scroll controls use `tournament_software_summary_prefs_v1`; these preferences are not tournament state.
- Summary page is strictly read-only: it reads persisted state, listens for cross-tab `storage` events, and refreshes once per second. It may locally run its configured auto-scroll behavior, but does not mutate tournament state.

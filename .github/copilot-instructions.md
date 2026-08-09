# Copilot Instructions

## Build, test, and lint commands

This project is a vanilla HTML/CSS/JS app with no package manager scripts.

- Run locally (from `tournament_software/`): `py -m http.server 8080`
- Admin UI: `http://localhost:8080/index.html`
- Teams summary UI: `http://localhost:8080/summary.html`

No formal lint/test runner is configured.

- Single-file JS syntax check: `node --check .\js\actions.js`
- Full JS syntax sweep: `Get-ChildItem .\js\*.js | ForEach-Object { node --check $_.FullName }`

## High-level architecture

- The app has two pages over a shared client-side state:
  - `index.html`: admin workflow (teams, terrains, config, phase generation, scoring, corrections)
  - `summary.html`: read-only teams view (match schedule/results)
- Shared persistence is `localStorage` under key `tournament_software_state_v1`.
- Admin runtime is split into IIFE-style global modules loaded in order:
  1. `js/state.js` - canonical state shape, import/export/sanitize, pub-sub updates
  2. `js/rules.js` - standings and tie-break logic (points, goal difference, goals for)
  3. `js/scheduler.js` - phase 1 pairing generation from `phase1MatchesPerTeam`
  4. `js/bracket.js` - knockout bracket creation, BYE handling, propagation, recomputation
  5. `js/actions.js` - all state mutations and guardrails (validation, resets, score updates)
  6. `js/render.js` - HTML rendering + event wiring using `data-action` / `data-role`
  7. `js/main.js` - bootstrap and subscription wiring
- `js/summary.js` is independent from admin modules and reads the same stored state to render team-facing info.

## Key conventions in this codebase

- Keep module pattern consistent: browser IIFE + `window.Tournament*` namespace exports.
- Keep script load order in `index.html`; modules depend on earlier globals.
- Treat `state.js` as the source of truth for state schema and migration-safe defaults.
- Preserve the shared storage key (`tournament_software_state_v1`) across admin and summary pages.
- Phase integrity convention: any phase 1 structural/score change invalidates knockout data; use existing reset/recompute paths in `actions.js` and `bracket.js` rather than ad-hoc updates.
- Match objects use stable shape and status contract:
  - `status` is `"scheduled"` or `"completed"`
  - scores are `null` until completion
- Scheduler rule: phase 1 generation uses configured `phase1MatchesPerTeam` and rejects impossible setups (`team_count * phase1MatchesPerTeam` must be even).
- Summary page is strictly read-only: no admin mutations, only rendering from persisted state.



# main

# develop

## changes since merge #5

### knockout qualification policy and validation
date : 03-10-2026

- changes : knockout qualifiers must be powers of two from 2 up to the
  registered team count; the config select offers only supported values,
  preserves invalid saved values visibly, and shows warnings below the
  overview; config saving and both phase-generation actions enforce the
  same rule; new brackets have full rounds without BYEs, with Round of 16
  and Round of 32 labels where applicable.
- impact files : `index.html`, `bracket.js`, `actions.js`, `render.js`,
  `summary.js`, regression tests, `README.md`, `HOW.md`.
- fix : replaced the interim six-qualifier BYE workaround with one general
  policy; unsupported counts are rejected instead of silently clamped or
  padded; existing imported BYE brackets remain readable and are not rewritten.

### searchable team pickers and independent participant changes
date : 03-10-2026

- changes : phase 1 and first-round knockout team fields are searchable
  comboboxes with a black dropdown arrow; typing filters registered teams,
  click or arrows and Enter saves the selection immediately, and Escape
  or dismissal restores the assigned name; completed matches require
  Reopen; changing a participant clears that match's old score without
  completing it, preserves timers and unrelated score drafts, and uses
  existing downstream invalidation paths.
- impact files : `actions.js`, `render.js`, `style.css`,
  `page-tournament.css`, `HOW.md`, `README.md`, `DESIGN.md`.
- fix : removed the need to save and reopen a score merely to change a team;
  readable input values replace the tiny mirrored text used for browser Find;
  typed labels cannot replace committed team IDs.

### participant-edit regression coverage
date : 03-10-2026

- changes : the suite now contains 64 tests, adding participant-only action
  validation, score clearing, timer preservation, keyboard and mouse
  selection, cancellation, duplicate imported labels, persistence,
  unrelated score drafts, summary updates and a score-free edit followed
  by a full 50-team / 20-terrain tournament.
- impact files : `tests/06-actions.test.js`, `tests/07-operator-page.test.js`,
  `tests/08-summary-page.test.js`, `tests/09-full-flow.test.js`,
  `tests/harness.js`, `tests/oracles.js`, `tests/README.md`.
- fix : automated checks now cover the new qualification and participant
  editing behavior; browser Find and popup layout remain separate browser checks.

### illustrated README and scheduling limitations
date : 04-10-2026

- changes : added a public-screen preview and six captioned screenshots
  illustrating setup, group matches, standings and knockout progression;
  paired tall images link to full-size views; clarified launch instructions
  and documented that knockout rounds may reuse terrains when capacity
  is insufficient.
- impact files : `README.md`, `HOW.md`, `imgs/`.
- fix : documented that manual team edits do not rebalance match counts or
  prevent round collisions, and that knockout matches may need to be
  staggered manually; noted that the operator match screenshot predates
  searchable pickers.

# fix/correct_client_implementation
## context
Client-side (browser-only) tournament manager. This branch corrects match and
team scheduling logic, adds a match/round timer system, applies a shared
visual style (borrowed from race_lap_software), and reworks the viewer-facing
summary page for TV display with a stage-aware layout and a proper bracket
tree.

## changes

### client-side correctness and UX cleanup
date : 09-08-2026

- changes : phase 1 pairing is now randomized on every generation; operators
  can reassign a team on a match directly from the score-save dropdown
  instead of a separate action; team/terrain rename removed in favor of
  delete + recreate (IDs already prevent collisions); buttons now grey out
  when their action isn't valid for the current stage (add team/terrain
  after phase 1 is generated, save config once locked); phase 2 can only be
  generated once every phase 1 match is completed.
- impact files : `scheduler.js` (shuffled tie-break in pairing), `actions.js`
  (score actions accept team overrides, rename functions removed,
  completeness guard on `startKnockout`, config lock), `render.js`
  (team-select dropdowns, stage-gating, removed rename UI), `style.css`
  (disabled-button/input styling).
- fix : none.

### match and round timer system
date : 09-08-2026

- changes : added configurable match duration and pause/break duration; a
  round's timer starts once for every match in it so they stay in sync
  unless individually paused; per-match pause/resume; live countdown with an
  overtime indicator; final elapsed time freezes on save and survives
  reopening a match; standings now track best/last score per team, with the
  tie-break order changed to points -> total score -> best score (goal
  difference kept for display only).
- impact files : new `timer.js` (elapsed/countdown helpers); timer fields and
  actions added across `state.js` / `scheduler.js` / `bracket.js` /
  `actions.js`; `render.js` / `page-tournament.css` for the operator timer
  controls; `rules.js` for the tie-break and best/last score; `summary.js` /
  `summary.html` / `index.html` for the read-only display and new config
  fields.
- fix : none.

### stop-round-timer control
date : 10-08-2026

- changes : added an explicit control to stop a round's reference clock once
  it's no longer needed, instead of it ticking forever with no purpose.
- impact files : `actions.js` (stop actions), `render.js` (button, skips
  ticking a stopped clock), `bracket.js` (`stoppedAt` field).
- fix : none.

### visual style transfer from race_lap_software
date : 10-08-2026

- changes : adopted race_lap_software's palette, fonts and button system
  (navy/blue/red, Barlow / Barlow Condensed / Roboto Mono, square corners,
  solid-fill buttons with hover-dim and active-press feedback); redesigned
  the summary page header as a scoreboard shell (brand block, stage pill,
  live strip) and added a Standings section reusing the existing standings
  logic.
- impact files : `style.css` (shared tokens/fonts/buttons), `page-summary.css`
  (scoreboard header, standings), `summary.html` (header markup, standings
  container, new script includes), `summary.js` (header/standings rendering,
  font-role class hooks).
- fix : none.

### design polish: button colors, spacing, list borders
date : 10-08-2026

- changes : Reopen buttons recolored to a muted purple, Pause/Stop-timer
  buttons to a muted orange (both intentionally low-key); added breathing
  room around the add-team/add-terrain forms and button rows; team/terrain
  list rows are now bordered boxes instead of bare text rows.
- impact files : `style.css` (`.reopen` / `.timer-action` classes),
  `page-tournament.css` (spacing, list-row border), `render.js` (class hooks
  on the affected buttons).
- fix : none.

### terrain scheduling correctness
date : 12-08-2026

- changes : phase 1 round-grouping now caps matches per round at the number
  of registered terrains, so a round is never scheduled with more
  simultaneous matches than terrains available.
- impact files : `scheduler.js` (`groupPairsIntoRounds` capacity + call
  site).
- fix : fixed a real bug where a round with more matches than terrains would
  silently reuse the same terrain twice at the same time; this also
  maximizes terrain usage per round instead of splitting rounds arbitrarily.

### stage-aware TV layout for the summary page
date : 14-08-2026

- changes : the summary page now shows one focused view per tournament stage
  - a team-name grid during setup, the current round's matches plus a
  compact multi-column standings table during phase 1 (fits ~60 teams
  without scrolling), and a full connected bracket tree during knockout
  (current round highlighted, auto-scrolls to it on round change); page
  width widened for TV displays.
- impact files : `summary.html` (stage view containers), `summary.js` (stage
  detection, per-stage renderers, first version of the bracket renderer),
  `page-summary.css` (team-chip grid, two-column phase 1 layout,
  multi-column standings, bracket styles, widened max-width).
- fix : the `hidden` attribute was silently overridden by a class also
  setting `display`, so a hidden view still rendered; fixed with a global
  `[hidden] { display: none !important; }` rule.

### bracket connector alignment fix
date : 14-08-2026

- changes : replaced the bracket's flexbox-based match spacing (only
  visually correct for the very first round) with the standard row-doubling
  percentage formula, so every round's connectors line up with their feeder
  pairs regardless of bracket size; verified at 60 teams / 32 qualified.
- impact files : `summary.js` (`renderBracket` rewritten to position matches
  and connectors by computed percentage), `page-summary.css` (bracket CSS
  switched from flex/pair wrappers to absolute positioning).
- fix : fixed misaligned connectors from round 2 onward; also fixed match
  boxes overlapping in the densest round by increasing the row height past
  the actual rendered match-box height.


Screen real estate: .summary-main/.summary-top-main/.summary-live-inner widened from 1200px to 1800px; the bracket scrolls internally regardless.

Bug caught and fixed during verification: the hidden attribute wasn't actually hiding #view-phase1 because its own class (display: grid) out-specificities the [hidden] UA rule. Added a global [hidden] { display: none !important; } in style.css — noted in repo memory since it'll bite again if more toggleable sections are added.

Verified live in-browser at all four stages (setup/phase1/knockout/champion) with seeded data (10, 24, and 8-team scenarios) — view switching, current-round filtering, standings columns, bracket propagation, and the champion box all behaved correctly. node --check passes on all JS files.

# feature/fix_design
## context
Continues the `fix/correct_client_implementation` work: finalizes the flat
bordered visual system (favicon, project docs, license), reworks the
operator console into collapsible sections with a workflow progress bar and
a config overview card, cleans up the public summary screen (header,
terrain chip, round status pills, champion box), fixes several bracket
display bugs (overlap, sticky round titles, auto-scroll to the current
round), and adds a sticky footer with a QR code linking to the repository.

## changes

### knockout matches now get a terrain assigned
date : 02-09-2026

- changes : knockout matches are now assigned a terrain the same way phase 1
  matches are, instead of running with no terrain at all.
- impact files : `bracket.js` (terrain assignment on bracket generation),
  `actions.js`, `render.js`, `summary.js` (display the assigned terrain).
- fix : fixed knockout matches showing no terrain, leaving the operator with
  no way to tell teams where to play.

### summary screen header and remote-control cleanup
date : 04-09-2026

- changes : reworked the summary page header (brand block, stage pill and
  round clock rearranged, phase moved to the right, round timer centered);
  every round/match now shows an explicit status pill (upcoming / current /
  completed) instead of relying on position alone; removed admin-only
  controls that had leaked onto the public-facing summary screen; the
  Standings / Auto-scroll remote toggles are now recolored green/red to make
  their ON/OFF state obvious at a glance.
- impact files : `summary.html`, `page-summary.css`, `summary.js`,
  `index.html`, `render.js`, `style.css`.
- fix : fixed admin-only controls being visible on the public summary
  screen.

### operator console: collapsible sections, sticky progress bar, overview card
date : 04-09-2026

- changes : setup / phase 1 / standings / knockout / audit sections are now
  native `<details>`/`<summary>` collapsibles with a chevron indicator and
  auto-expand the phase the operator is actively working on; individual
  rounds also stack as collapsible bars, with the current round
  auto-expanded; added an operator toolbar with expand-all/collapse-all
  buttons; added a sticky mini progress bar (Setup -> Group Matches ->
  Knockout -> Champion) that jumps to and expands the target section on
  click; added an overview card summarizing the locked-in config (win/draw/
  loss points, phase 1 matches per team, qualified count, seeding, third
  place, match/pause duration); added a short explanatory message on the
  terrains panel.
- impact files : `index.html`, `page-tournament.css`, `render.js`.
- fix : none.

### visual design finalization: square corners, favicon, project docs
date : 04-09-2026

- changes : removed the last remaining rounded corners so every surface
  matches the flat/bordered style; added a favicon; added `DESIGN.md` /
  `PRODUCT.md` (design system and product scope references) and a
  `LICENSE`; removed the per-team match timer display, redundant once round
  timers were introduced.
- impact files : `page-tournament.css`, `assets/logo_charneux.svg`,
  `index.html`, `summary.html`, `DESIGN.md`, `PRODUCT.md`, `LICENSE`,
  `summary.js`.
- fix : none.

### bracket terrain chip, overlap fix, round-name display
date : 04-09-2026

- changes : bracket-match boxes now show a prominent "Terrain: N" chip
  before a score is entered, which disappears once the match is completed;
  removed the "upcoming" status label per team on the summary view; removed
  the separate round-name element on the summary header in favor of showing
  "Round X of Y" (or the knockout stage name) directly on the round clock
  label.
- impact files : `page-summary.css`, `summary.js`, `summary.html`.
- fix : fixed bracket-match boxes overlapping in rounds where the terrain
  chip was present.

### bracket tree: sticky round titles, responsive column width, name tooltips
date : 08-09-2026

- changes : round titles now stick to the top of the bracket view
  independently of the horizontal scroll instead of scrolling away with the
  matches; each round column is now sized to the longest registered team
  name instead of a fixed width, with a full-name tooltip for any name that
  still needs to truncate.
- impact files : `page-summary.css`, `summary.js`.
- fix : none.

### champion box relocated + responsive bracket layout
date : 11-09-2026

- changes : moved the champion announcement out of the bracket's title row
  into its own block above the tree, and made the bracket column layout
  responsive to viewport width so it degrades better on narrower screens.
- impact files : `page-summary.css`, `page-tournament.css`, `style.css`,
  `summary.js`, `summary.html`.
- fix : none.

### round label consistency, fixed-height match-cards, sticky footer with QR code
date : 12-09-2026

- changes : the operator and summary pages now derive knockout round labels
  (Round of N / Quarterfinal / Semifinal / Final) the same way in both
  places instead of drifting apart; knockout match-cards with an
  already-decided pairing (i.e. every round after the first) now render the
  two team names as two fixed lines instead of one wrapping line, so every
  match-card in a round keeps the same height regardless of name length;
  added a sticky footer to the summary screen with a QR code and link to
  the project's repository plus the live round countdown, mirroring the
  equivalent footer on race_lap_software's scoreboard.
- impact files : `render.js`, `summary.js`, `page-tournament.css`,
  `assets/qr-repo.png`, `summary.html`.
- fix : fixed the knockout round label falling back to the generic
  "Round of N" wording even for the Quarterfinal/Semifinal/Final rounds,
  because of a casing mismatch against the stored round name.

### bracket auto-scroll to the current round
date : 12-09-2026 to 15-09-2026

- changes : the bracket view now auto-scrolls horizontally to keep the
  current round visible as the tournament progresses, clamped so it never
  scrolls past the last column; clock placeholders now read "waiting"
  instead of "--:--", and the summary header shows an explicit "Setup"
  label before phase 1 is generated.
- impact files : `summary.js`, `timer.js`.
- fix : fixed the auto-scroll position being silently reset every second
  (the bracket is fully rebuilt on every live refresh), so it never
  actually reached later rounds; fixed the scroll offset being computed
  relative to the wrong ancestor element, which made it overshoot straight
  to the far right and hide whichever round was actually current.

# fix/backend_crowned_timer_f
## context
Improves tournament reporting and maintenance: standings now use clear
football statistics and consistent highlighting, operator printouts include
the same information as the live tables, the project has a comprehensive
automated regression suite, and all required fonts are embedded for fully
offline use.

## changes

### printable standings and match sheets
date : 30-09-2026

- changes : added an Export / Print panel for full standings or phase match
  sheets, with selectable A3, A4 and A5 paper sizes; completed matches print
  their saved scores while pending matches leave blank score cells for
  handwritten results.
- impact files : `index.html`, `render.js`, `page-tournament.css`,
  `print.css`.
- fix : phase 1 printouts now include every match without orphaned round
  headings, and dense tables fit the selected paper format more reliably.

### standings statistics, tie-breaks and highlights
date : 30-09-2026

- changes : renamed goals for to GT (Goal Total), renamed goals against to
  GC (Goal Conceded), added GA (Goal Average = GT / matches played), and
  aligned operator, summary and print tables on the full column set
  `# Team P W D L GT GC GA GD Last Best Pts`; qualification now sorts by
  points, GA, GC, then team name; qualified rank/team cells use a light
  green background and each meaningful best statistic uses a purple
  background, both preserved in black-and-white printing; numeric columns
  are centered while team names remain left-aligned.
- impact files : `rules.js`, `render.js`, `summary.js`, `style.css`,
  `print.css`, `HOW.md`, `DESIGN.md`.
- fix : corrected confusing goals terminology, stale tie-break behavior,
  incomplete printed standings columns, space-consuming qualification
  markers, and left-aligned numeric standings cells.

### automated regression test suite
date : 01-10-2026

- changes : added 53 dependency-free Node tests covering public contracts,
  state and imports, timers, standings, scheduling, brackets, actions,
  operator and summary page behavior, plus a complete deterministic
  50-team / 20-terrain tournament; tests load the unchanged production
  scripts in isolated browser-like VM contexts and compare them with
  handwritten contracts and independent oracles; added an exhaustive test
  reference in `tests/README.md`.
- impact files : new `tests/` directory, `README.md`,
  `.github/copilot-instructions.md`.
- fix : development now has one repeatable command that exits nonzero on a
  regression and identifies the failing behavior.

### embedded offline fonts
date : 01-10-2026

- changes : replaced the Google Fonts import with local Barlow, Barlow
  Condensed and Roboto Mono files for only the weights used by the design;
  included the OFL licenses and strengthened the offline contract test so
  remote CSS assets fail.
- impact files : `style.css`, new `assets/fonts/`, contract tests and test
  documentation.
- fix : the intended typography now works without an internet connection
  when either page is opened directly through `file://`.

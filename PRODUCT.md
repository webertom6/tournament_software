# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two distinct user groups in a live, single-event tournament context:

- **Operator**: one non-technical organizer running the whole event from a
  laptop, registering teams and terrains, entering scores, managing round
  timers, and correcting mistakes, under live time pressure at the event
- **Players/public**: participants and spectators watching a second screen
  (TV, projector, or tablet) they never touch - a read-only, auto-updating
  view of the schedule, live scores, standings, and bracket

## Product Purpose

A free, offline, browser-only tool to run a single team tournament from a
laptop: register teams and terrains, auto-generate a round-robin group
stage, track scores and per-round timers, then auto-generate a knockout
bracket up to the champion. It was built for and used at a real event, with
an operator console for event management and a separate read-only public
display.

## Positioning

Same offline/no-install/no-account positioning as its sister project
race_lap_software: nothing to install, nothing to pay for, no internet
connection needed - just open `index.html` in a browser. Where race_lap_software
times a continuous lap race, this product runs a discrete team
tournament (group stage -> knockout bracket -> champion) with the same
two-screen split (operator console + public read-only display) and the same
"community-built, not corporate SaaS" stance.

## Operating Context

A single live event, operator on one laptop, public display on a second
screen (TV/projector/tablet) with no interaction:
- Everything runs entirely client-side (`index.html` + `summary.html`),
  no server, no build step, no internet required
- State persists in `localStorage` (`tournament_software_state_v1`), shared
  between the two pages/tabs on the same browser/machine
- Tournament proceeds through phases in order: setup (teams/terrains/rules)
  -> phase 1 group stage (round-robin, one shared timer per round) -> phase 2
  knockout bracket (seeded from standings or random) -> champion
- A completed match can be reopened to correct a mistake; phase 1
  structure/score changes invalidate and require regenerating the knockout

## Capabilities and Constraints

- Confirmed: register/remove teams and terrains before generation locks them;
  configurable win/draw/loss points, matches-per-team, qualified-team count,
  ranked-or-random seeding, optional third place match
- Confirmed: match duration and pause/break duration are informational only
  for the operator - no automatic stop logic
- Confirmed: standings use `GT` (goals total), `GC` (goals conceded),
  `GA` (GT per match), and `GD`; ranking is by points, then GA, GC, and
  team name. Last and Best are informational stats
- Confirmed: state can be exported to a file and re-imported; "Reset all" and
  "Reset phases" (keeps teams/terrains/rules) are both supported
- Confirmed: operator can remote-control the public screen (show/hide
  standings, start/stop auto-scroll) from the setup panel
- Confirmed: operator can print standings or match sheets in A3, A4, or A5;
  completed scores print, and pending scores are left blank for handwriting
- Confirmed: fonts are embedded locally, and both pages work offline when
  opened directly with `file://`
- Confirmed: a dependency-free Node regression suite covers core modules,
  both pages, and a deterministic 50-team / 20-terrain tournament
- Confirmed: no authentication, no multi-tournament isolation - a single
  tournament state per browser's localStorage
- No formal WCAG target (see Accessibility & Inclusion)
- Undecided: no plan yet for concurrent/multi-tournament support

## Brand Commitments

Practical, community-built, no corporate-SaaS gloss - matches race_lap_software's
stance. The current branch already borrows race_lap_software's flat/bordered
visual style (per CHANGELOG.md: "applies a shared visual style (borrowed
from race_lap_software)").

Anti-references: generic AI-templated SaaS dashboards, decorative gradients,
soft-shadow card elevation, and anything requiring an account or internet
connection. Small blue state halos are used to identify the current round.

## Evidence on Hand

- README.md documents install/run steps ("download ZIP, open index.html")
  and the full feature list/workflow
- `LICENSE` is present; local Barlow, Barlow Condensed, and Roboto Mono
  font files and their OFL licenses are in `assets/fonts/`
- `logo_charneux.svg` and the repository QR image are included under
  `assets/`
- No testimonials, case studies, or usage data on hand beyond "used at one
  real event" (per README); none should be invented

## Product Principles

- Operator clarity under time pressure - one non-technical person runs the
  whole event live, so the console must stay scannable, not dense
- Public screen is strictly read-only and glanceable - players/spectators
  never interact with it
- Works fully offline - no install, no account, no internet dependency
- Solid logic first, visual polish second - functional correctness
  (scheduling, scoring, bracket propagation) is never traded for looks
- Shares its visual identity with race_lap_software rather than inventing a
  new one, since both are the same community-built, non-corporate family

## Accessibility & Inclusion

No formal WCAG target; keep the interface usable and legible (sufficient
color contrast, readable text sizes) without dedicated colorblind or
reduced-motion accommodations at this time.

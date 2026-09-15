---
name: Tournament Software
description: Offline-first tournament console and public bracket/standings display for community-run team tournaments
colors:
  navy: "#061534"
  action-blue: "#005eff"
  alert-red: "#e11d22"
  success-green: "#00b33c"
  spectrum-purple: "#8b35ff"
  ink: "#04122f"
  muted-slate: "#5f6f86"
  grid-line: "#d9e6f4"
  page-bg: "#f5f7fa"
  surface: "#ffffff"
  warn-amber: "#b45309"
  danger-red: "#b91c1c"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.04em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.14em"
  mono:
    fontFamily: "Roboto Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  none: "0px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "10.4px 16px"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10.4px 16px"
  button-important:
    backgroundColor: "{colors.alert-red}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "10.4px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "14px"
---

# Design System: Tournament Software

## 1. Overview

**Creative North Star: "The Tournament Control Booth"**

Same family as race_lap_software's "Timing Booth Console": flat surfaces, hard
corners, thin borders instead of shadows, uppercase condensed/mono labels like
a scoreboard display. The operator is one non-technical person running an
entire live event alone; the public screen is read-only and glanceable from
across a room. Nothing here tries to look "designed" - it tries to look like
it is doing a job reliably, exactly like its sister project.

This system explicitly rejects the generic AI-templated SaaS look: no
gradients, no soft drop shadows, no rounded-pill everything, no decorative
color for its own sake. Color is functional (blue = primary action, red =
destructive/urgent, green = success/on-state, purple = ranking signal) and
never purely aesthetic. `css/style.css` already sets `border-radius: 0` on
button/input/select globally; this document extends that rule to every
remaining surface (`css/page-tournament.css` still has leftover rounded
cards/panels from before the shared style was adopted - those are the last
gap between this project and race_lap_software's finished flat aesthetic).

**Key Characteristics:**
- Flat, bordered surfaces - zero border-radius, zero box-shadow anywhere
- Condensed uppercase display type for headings/labels, monospace for every
  number that changes (round timers, scores)
- A tight, functional color palette identical to race_lap_software's, since
  both are the same community-built family and should read as siblings
- Two distinct surfaces for two distinct audiences: a dense operator console
  and a large-type public summary/bracket display

## 2. Colors

Identical palette to race_lap_software - a restrained, functional set where
navy anchors structural chrome, blue carries primary actions, and
red/green/purple are reserved for meaning rather than decoration.

### Primary
- **Action Blue** (#005eff): primary buttons, links, the "current round"
  highlight border/halo, "ON" toggle state. The one color used for "click
  this" and "this is happening now".

### Secondary
- **Navy** (#061534): brand/header chrome, table headings (`--font-display`
  on `th`). Reserved for structural elements, never body text or buttons.

### Tertiary
- **Alert Red** (#e11d22): "important"-class actions (destructive/urgent
  buttons like Reset all) - always urgent or destructive, never neutral.

### Neutral
- **Ink** (#04122f): all body text.
- **Muted Slate** (#5f6f86): labels, secondary/meta text.
- **Grid Line** (#d9e6f4): borders on cards, inputs, panels, table rules.
- **Page Background** (#f5f7fa): page background behind white surfaces.
- **Surface** (#ffffff): card, panel, and table backgrounds.

### Named Rules
**The Function-Only Color Rule.** Success green (#00b33c) marks an "ON"
toggle state (e.g. summary auto-scroll/standings remote controls) and
positive standings signals; spectrum purple (#8b35ff) is reserved for
ranking/bracket emphasis. Neither is used as general decoration. Danger red
(#b91c1c) and warn amber (#b45309) are reserved for destructive confirmations
and warnings, kept visually distinct from the brighter alert red used for
urgent-but-routine actions.

## 3. Typography

**Display Font:** Barlow Condensed (with sans-serif fallback)
**Body Font:** Barlow (with system-ui, sans-serif fallback)
**Label/Mono Font:** Roboto Mono (with ui-monospace, SFMono-Regular, Menlo fallback)

Same instrument-panel pairing as race_lap_software: a condensed uppercase
display face, a workmanlike grotesque body face, and a monospace for every
number that is live data rather than static chrome.

### Hierarchy
- **Display** (700, uses `--font-display`, uppercase-leaning): card/section
  headings (`.card h2`), table headings (`th`).
- **Body** (400-700, `--font-body`): form labels, buttons, general UI copy.
- **Label** (`.text-label`, uppercase, letter-spacing 0.14em): field labels
  and small status captions.
- **Mono** (`.text-mono`, `--font-mono`): every value that represents live
  data - round/match countdowns, scores.

### Named Rules
**The Numbers-Are-Mono Rule.** Any value that changes during the event
(round timers, match countdowns, scores) renders in Roboto Mono via
`.text-mono`. Static labels never use mono; this is the only visual cue
distinguishing "live data" from "chrome" at a glance - same rule as
race_lap_software.

## 4. Elevation

No shadows anywhere. Depth and hierarchy come entirely from flat color
blocks and 1px borders (`border: 1px solid var(--border)`), never
`box-shadow`. A card is "elevated" only in the sense that it sits on a
`--surface` white block against the `--bg` page background, bordered, with
hard corners.

### Named Rules
**The Flat-By-Default Rule.** No `box-shadow` declarations exist anywhere in
the stylesheets, and `border-radius: 0` applies globally - including the
`.card`, `.panel`, `.round-card`, `.match-card`, `.champion-box`, and
`.audit-item` surfaces in `css/page-tournament.css` that still carried
leftover rounded corners from before this rule was adopted project-wide. If
a future component needs to imply depth, use a border or a background-color
tint change, never a shadow or a rounded corner.

## 5. Components

### Buttons
- **Shape:** hard corners (`border-radius: 0`), uppercase text,
  `letter-spacing: 0.08em`, `min-height: 42px`.
- **Primary:** action-blue background, white text.
- **Secondary:** white background, grid-line border, ink text - used for
  non-destructive toggles (standings/auto-scroll remote control) and
  secondary actions.
- **Important:** alert-red background, white text - destructive/urgent
  actions (Reset all, Reset phases).
- **Toggle state (ON/OFF):** a secondary-shaped button whose background
  swaps to success-green when the controlled state is active/shown ("ON")
  and to action-blue when inactive/hidden ("OFF") - text always states the
  controlled thing plus the explicit word ON or OFF, never a verb pair like
  "Start/Stop" or "Show/Hide", so the state reads correctly even out of
  context on the public screen's remote-control panel.
- **Hover / Active:** hover darkens via `filter: brightness(0.88)`; active
  darkens further (`brightness(0.75)`) and scales down slightly
  (`transform: scale(0.97)`). Disabled buttons drop opacity and block
  actions invalid for the current stage (add team after phase 1 generated,
  etc.).

### Cards / Containers
- **Corner Style:** none - `border-radius: 0` throughout, including
  round-cards and match-cards.
- **Background:** white (`--surface`) against the `--bg` page background.
- **Shadow Strategy:** none (see Elevation) - a single 1px `--border` border
  is the only surface delineation.
- **Collapsible sections:** top-level operator sections (Setup, Phase 1
  matches, Standings, Knockout, Audit log) use native `<details>/<summary>`
  with a custom rotating chevron, not a JS-only accordion - keeps keyboard/
  screen-reader behavior free. Default open/closed state tracks the current
  phase of work; a manual toggle by the operator overrides that default and
  persists across reloads.

### Inputs / Fields
- **Style:** flat, 1px grid-line border, white background, hard corners,
  `min-height: 42px`.
- **Focus / Error:** no dedicated focus-ring styling defined yet; disabled
  inputs use reduced opacity to signal a stage-gated field.

### Round / Match Cards (signature component)
Rounds render as a vertical stack of collapsed title bars (round number +
status pill: upcoming/current/completed) with only the current round
expanded full-width; its match-cards lay out horizontally so entering scores
for a busy round needs far less scrolling than a single long vertical list.

### Public Summary Screen
Large-type, read-only, auto-refreshing display. The current round is marked
by an action-blue border/halo on its block rather than redundant status
text; the round/clock label combines round context and the live countdown
in one place instead of two separate near-duplicate labels.

## 6. Do's and Don'ts

### Do:
- **Do** keep `border-radius: 0` and no `box-shadow` on every surface,
  including the leftover rounded cards this redesign flattens.
- **Do** render any live/changing number in Roboto Mono; keep static labels
  in Barlow/Barlow Condensed.
- **Do** use the exact same palette as race_lap_software - both are the same
  community-built family and should read as siblings, not near-misses.
- **Do** state ON/OFF explicitly in toggle button labels rather than a verb
  pair, and pair it with a color change (never color alone).

### Don't:
- **Don't** introduce gradients, soft drop shadows, or rounded-pill
  buttons/cards - that reads as generic AI-templated SaaS, which this
  project explicitly rejects.
- **Don't** add decorative color; every hue in this palette has exactly one
  functional job.
- **Don't** duplicate the same piece of information in two adjacent labels
  (e.g. a separate round-name label next to a round-clock label) - fold
  redundant labels into one.

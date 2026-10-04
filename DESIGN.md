---
name: Tournament Software
description: Offline tournament control console and public scoreboard for community team events
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
  qualified-bg: "#d3f3de"
  best-bg: "#dcc8ff"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 600
    letterSpacing: "0.14em"
  mono:
    fontFamily: "Roboto Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontWeight: 700
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
    backgroundColor: "{colors.surface}"
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
    padding: "16px"
---

# Design System: Tournament Software

## Overview

**Creative North Star: "The Tournament Control Booth"**

This is a practical event console, not a SaaS dashboard. The operator screen
supports one organizer making quick, confident changes under live event
pressure. A separate public screen presents the current round, standings, and
knockout bracket so they can be read across a room.

The shared visual identity with race_lap_software is community-built and
instrument-like: strong navy structure, square bordered surfaces, condensed
headings, and monospace live data. Color is functional, and hierarchy comes
from spacing, borders, and restrained status highlights rather than ornament.
The app and its fonts are self-contained and work offline.

**Key Characteristics:**
- Dense, scannable operator controls and a large-type public scoreboard
- Barlow Condensed headings, Barlow interface text, and Roboto Mono live values
- Square white surfaces on a pale page, with thin blue-grey borders
- Color reserved for actions, status, qualification, and best-stat signals

## Colors

The palette pairs a navy structure and bright blue action color with restrained
status colors and cool neutral surfaces.

### Primary
- **Action Blue** (#005eff): primary controls, links, and current-round state.

### Secondary
- **Navy** (#061534): page chrome, public scoreboard header, and table headings.

### Tertiary
- **Alert Red** (#e11d22): urgent or important actions and the summary live strip.

### Neutral
- **Ink** (#04122f): primary text.
- **Muted Slate** (#5f6f86): helper text and secondary labels.
- **Grid Line** (#d9e6f4): card, field, and table borders.
- **Page Background** (#f5f7fa): background behind white surfaces.
- **Surface** (#ffffff): cards, panels, inputs, and table bodies.

### Functional signals
- **Success Green** (#00b33c): active ON states and positive status.
- **Spectrum Purple** (#8b35ff): ranking emphasis and best-stat signaling.
- **Qualified Green** (#d3f3de): qualified rank and team cells.
- **Best Purple** (#dcc8ff): meaningful best-stat cells.
- **Warn Amber** (#b45309) and **Danger Red** (#b91c1c): warning and destructive
  confirmation roles.

### Named Rules
**The Function-Only Color Rule.** Use color to signal action or state, never as
decoration. State is also named in text; color alone does not carry meaning.

**The Standings Shading Rule.** Shade qualified rank/team cells green and best
stat cells purple. Keep text readable, and preserve these backgrounds in print
so the distinctions remain visible in grayscale.

## Typography

**Display Font:** Barlow Condensed (with sans-serif fallback)
**Body Font:** Barlow (with system-ui, sans-serif fallback)
**Label/Mono Font:** Roboto Mono (with ui-monospace, SFMono-Regular, Menlo fallback)

The pairing is compact and operational: condensed display type gives section
headings scoreboard character, body text stays readable, and mono figures make
live values easy to scan.

### Hierarchy
- **Display** (Barlow Condensed): section and table headings; the public brand
  title is 3.5rem, weight 800, with a 0.95 line height.
- **Body** (400, 16px base, line-height 1.45): explanatory copy, buttons, and
  forms.
- **Label** (600, 0.7rem, 0.14em tracking): compact field and status labels.
- **Mono** (Roboto Mono, weight 700): scores and changing timer values; sizes
  vary by context, including the large public countdown.

### Named Rules
**The Numbers-Are-Mono Rule.** Render scores and live/changing numbers in
Roboto Mono; keep static labels in the Barlow families.

## Layout

The operator page uses a centered content area capped at 1200px, with roughly
16px page gutters and a one-column flow of cards. Setup forms can use compact
grids, while round match cards scroll horizontally when a round contains many
matches. The operator header and navigation wrap on narrow screens; layouts
adapt at 480px and 740px.

The public page is deliberately wider: its header and content cap at 1800px
with 24px gutters. Large stage and clock typography prioritizes viewing
distance. The standings and bracket retain their own scroll regions when
dense, and the bracket grows horizontally as rounds progress. Standings tables
stack below 768px and keep horizontal scrolling inside each table; the default
team-count split threshold is the `STANDINGS_SPLIT_THRESHOLD` constant in
`js/summary.js`. The public footer stacks below 768px. The bracket preserves
manual horizontal browsing and focuses a round only when the active round
changes. The summary header adapts below 900px and has a wide-display adjustment
at 2560px.

Use a consistent 8/12/16px spacing rhythm where it fits the established
components; preserve extra space around large public-display values.

## Elevation & Depth

Cards do not use ambient elevation shadows. White surfaces sit on the pale
page background and are separated by a 1px border. The only box shadows are
subtle blue state halos around the current operator round, current public
round, and current bracket round; they indicate live focus in the workflow,
not floating surfaces.

### Named Rules
**The State-Halo Rule.** Keep blue halos limited to the current-round state;
do not add shadows to ordinary cards or controls.

## Shapes

The form language is square and bordered. Buttons, inputs, cards, round
containers, and status chips use 0px corner radius; borders are generally
1px solid grid-line. Avoid pills and soft card silhouettes. The small status
chips remain compact rectangular labels.

## Components

### Buttons
- **Shape:** square corners (0px radius), minimum height 42px.
- **Primary:** action-blue fill with white text for the main available action.
- **Secondary:** white fill, ink text, and grid-line border for supporting
  actions.
- **Important:** alert-red fill with white text for urgent or destructive
  actions.
- **Hover / Active:** hover darkens; active darkens further and scales down
  slightly. Disabled controls are visibly muted and unavailable.
- **Focus:** retain the browser's visible keyboard-focus treatment.

### Cards / Containers
- **Corner Style:** square (0px radius).
- **Background:** white against the pale page background.
- **Border:** 1px grid-line border; no ambient shadow.
- **Internal Padding:** typically 16px, with denser nested components where
  required.
- Operator workflow sections and rounds use native collapsible
  `<details>/<summary>` elements.

### Inputs / Fields
Inputs use a white background, 1px grid-line border, square corners, and a
minimum height of 42px. Stage-locked values are disabled and visibly muted.

Phase 1 and first-round knockout team fields are searchable comboboxes. Typing
filters an on-demand list; clicking an option or using arrows and Enter saves
the participant immediately without completing the match. Escape or dismissal
restores the assigned name. Completed matches require Reopen; changing a team
clears its old score. Keep selected names readable and searchable with browser
Find, rather than duplicating them in tiny text.

### Status Chips
Compact rectangular labels communicate upcoming, current, and completed
states. Keep their wording explicit; color reinforces rather than replaces it.

### Round Cards
The operator's signature workflow pattern is a vertical stack of collapsible
round bars. The current round opens by default and receives a restrained blue
halo; its match cards remain side-by-side in a horizontal scroller where space
is limited.

### Standings
The operator, public, and printed standings share the columns
`# Team P W D L GT GC GA GD Last Best Pts`. Numeric columns are centered;
team names remain left aligned. Qualified rank/team cells use the green
background, and meaningful best-stat cells use purple. Preserve those fills
when printing, including grayscale output.

### Public Summary Header and Bracket
The summary header uses navy structure, a prominent condensed brand title,
large centered monospace countdown, and a red live strip. Bracket columns have
sticky round headings and connect feeder matches; the current round is
highlighted with the state halo. Keep the champion announcement distinct and
easy to find.

## Do's and Don'ts

### Do:
- **Do** keep the palette and font families aligned with the documented tokens.
- **Do** use Barlow Condensed for display headings and Roboto Mono for live
  figures.
- **Do** state ON/OFF and match status in text as well as color.
- **Do** use green and purple cell backgrounds for qualification and best
  standings values, and preserve them in print.
- **Do** reserve blue halos for the current round.

### Don't:
- **Don't** add gradients, decorative color, ambient card shadows, or rounded
  dashboard surfaces.
- **Don't** use color as the only signal for an action or status.
- **Don't** change the two-screen split: the operator page mutates tournament
  state; the public summary remains read-only.
- **Don't** introduce remote fonts or assets; both pages must remain usable
  offline.

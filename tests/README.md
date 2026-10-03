# Automated test reference

The suite contains 56 tests and loads the production JavaScript files in
isolated Node VM sandboxes using the same script order as the browser pages.

Run every test from the repository root:

```sh
node --test --test-concurrency=1 "tests/*.test.js"
```

Run one suite by replacing the wildcard with its file name:

```sh
node --test tests/02-timer.test.js
```

A successful run exits with code 0 and ends with 53 passed tests and no failed,
cancelled, skipped or todo tests. A failure exits nonzero and reports the test
name, assertion location, and expected and actual values.

## Test infrastructure

### `harness.js`

Purpose: Load unchanged production scripts inside deterministic browser-like
environments.

Inside:

- reads script order from `index.html` and `summary.html`
- creates a fresh VM context with isolated state for each test
- provides controlled time, seeded randomness, timers, dialogs and storage
- provides a minimal DOM used by the operator and summary page tests
- records alerts, confirmations, printing, downloads, scrolling and events
- exposes helpers for fixtures, action clicks and rejected-state checks

### `oracles.js`

Purpose: Provide expected results independently from the production functions
being tested.

Inside:

- declares handwritten default-state, export, header and action contracts
- computes reference standings with an independent algorithm
- verifies schedule counts, collisions, terrains and participation
- verifies bracket sizes, links, qualifiers, BYEs and third-place sources
- provides the fixed four-team standings fixture

## 00 - Contracts

File: `00-contracts.test.js`

### Handwritten script order, including CRLF parsing

Description: Confirms both pages load their JavaScript files in the required
order regardless of Windows line endings.

Inside:

- parses external script tags from both HTML files
- compares the results with handwritten admin and summary order lists
- confirms the logic-only order stops before the render module

### Exact namespaces and export keys, isolated contexts

Description: Detects accidental additions, removals or renames in the public
browser API.

Inside:

- loads the real scripts in fresh VM contexts
- compares every `Tournament*` namespace with handwritten export lists
- confirms the admin exposes only its seven expected namespaces
- confirms the summary script adds no extra public namespace

### File protocol safe scripts, links and referenced assets

Description: Protects direct offline use through `file://`.

Inside:

- checks page script and link references are relative local paths
- checks every referenced local file exists
- rejects module scripts, remote page assets and network-loading JavaScript
- checks assets referenced by production JavaScript exist

Limitation: Embedded data URLs remain allowed, but every HTTP or
protocol-relative CSS asset is rejected.

## 01 - State

File: `01-state.test.js`

### Defaults and 1000 unique frozen-clock IDs

Description: Confirms the canonical blank tournament and ID generation contract.

Inside:

- compares every default config and state section with handwritten values
- freezes time and generates 1000 IDs
- checks the prefix format and uniqueness despite the frozen clock

### Update, save, notify, unsubscribe, audit trimming and 300 cap

Description: Verifies the complete state update and audit pipeline.

Inside:

- checks mutations are saved as JSON and subscribers run once
- checks trimmed audit messages contain deterministic IDs and timestamps
- checks unsubscribed listeners stop receiving updates
- checks an update without a message creates no audit entry
- fills the audit and verifies only the newest 300 entries remain

### Missing, valid and malformed load plus two-space export

Description: Verifies startup recovery and exported JSON formatting.

Inside:

- checks missing storage returns defaults without writing
- checks valid storage is loaded without rewriting it
- checks malformed storage reports one error and returns defaults
- checks malformed stored text is left untouched
- checks exported JSON uses two-space indentation

### Invalid import atomicity and valid import audit, save and notify

Description: Confirms imports reject invalid JSON and publish valid replacement
state.

Inside:

- snapshots state, storage and notifications before invalid import
- checks invalid JSON changes none of them
- imports valid JSON and checks sanitization, persistence and notification
- checks the import audit message and timestamp

### Sanitization of numeric types, enums, coercions, arrays and unknown fields

Description: Exercises migration-safe cleanup of imported state.

Inside:

- checks non-objects and missing sections receive defaults
- checks finite numbers are kept while numeric strings and non-finite values fall back
- checks seeding and third-place values are normalized
- checks falsy array entries are removed
- checks unknown properties are discarded and version is forced to 1

### Legacy shape remains operable and reset preserves preferences

Description: Confirms older saved tournaments still work and reset only clears
tournament data.

Inside:

- imports legacy timer and knockout objects without newer pause fields
- performs operations after import to prove the state remains usable
- resets to defaults with one reset audit entry
- checks operator and summary preference keys are unchanged

Limitation: Importing a state without a config can still leave the production
seeding policy undefined; the suite does not approve that existing defect.

## 02 - Timer

File: `02-timer.test.js`

### Exact round elapsed table

Description: Checks round elapsed time for waiting, running, stopped, paused and
invalid future-start cases.

Inside:

- uses literal timestamps and expected millisecond values
- verifies stopped or paused endpoints freeze elapsed time
- verifies accumulated pauses are deducted
- verifies negative elapsed time clamps to zero

### Exact match elapsed table and stop or pause priority

Description: Checks per-match elapsed time against round and match pause state.

Inside:

- covers running, round-stopped, round-paused and match-paused matches
- checks a stopped round takes priority over later wall-clock time
- deducts both round and match accumulated pauses
- verifies excessive pause totals clamp the result to zero

### Break remaining table

Description: Checks informational break countdown calculations.

Inside:

- verifies no active pause returns no countdown
- checks positive remaining time and negative overtime
- checks invalid duration conversion follows the production fallback

### Duration and countdown literal formatting

Description: Locks the displayed waiting, clock and overtime text formats.

Inside:

- covers null, undefined, non-finite, zero and sub-second values
- checks minute and hour boundaries
- checks negative duration and overtime prefixes

## 03 - Rules

File: `03-rules.test.js`

### Names and winner or loser edge cases

Description: Checks team lookup and completed-match winner and loser resolution.

Inside:

- checks known names and the `TBD` fallback
- rejects scheduled, drawn and non-finite results
- handles a completed match with one missing participant

### Hand-computed four-team standings and best values

Description: Compares standings and highlighted best statistics with a manually
calculated fixture.

Inside:

- uses four completed matches and one scheduled match
- compares every rank and P, W, D, L, GT, GC, GA, GD, Last, Best and Pts value
- compares the best-value map with handwritten expected values
- confirms the scheduled match is ignored

### Tie order by GA, GC and ASCII name with equal ratios using GC

Description: Verifies the complete documented qualification tie-break order.

Inside:

- creates separate ties decided by goal average, goals conceded and name
- checks equal goal-average ratios fall through to goals conceded
- uses predictable same-case ASCII names to avoid locale differences

### Custom or nonnumeric points, invalid IDs or scores and schedule-order Last

Description: Checks configurable points and invalid match-data handling.

Inside:

- applies custom win, draw and loss values
- checks nonnumeric point values use the production fallback
- ignores unknown team IDs and invalid scores
- proves Last follows schedule order rather than score-entry time

### Highlighting empty, unplayed, identical, null Last and tied maxima

Description: Checks when best-stat backgrounds should and should not appear.

Inside:

- checks empty and entirely unplayed standings return no highlights
- suppresses a highlight when every row has the same value
- ignores null Last values when finding the best result
- allows every row tied for a real best value to be highlighted

Limitation: The suite preserves the current raw GA tie-break and current
all-ties highlighting behavior while those product decisions remain open.

## 04 - Scheduler

File: `04-scheduler.test.js`

### Exact validation errors

Description: Checks scheduler rejection messages for impossible setup values.

Inside:

- rejects fewer than one match per team
- rejects fewer than two teams
- rejects an odd total number of team match slots

### Independent invariant sweep

Description: Stress-checks valid schedules across many small configurations and
random seeds.

Inside:

- sweeps 2 through 12 teams and 1 through 4 matches per team when mathematically valid
- tests zero, one and three terrains with five seeds each
- independently checks match count and exact participation per team
- checks no team appears twice in one round
- checks terrain capacity, uniqueness and match shape

Limitation: Repeated opponents are not prohibited because the production
scheduler does not guarantee unique pairings for every configuration.

### Same seed is byte-identical and another seed changes pair order

Description: Confirms seeded generation is reproducible without becoming fixed.

Inside:

- generates schedules twice with the same seed and compares complete JSON
- generates another schedule with a different seed
- checks the changed seed changes the pairing order

## 05 - Bracket

File: `05-bracket.test.js`

### Qualified-count normalization literal table

Description: Checks minimum, maximum, truncation and invalid-value handling for
qualified team counts.

Inside:

- covers numeric, string, fractional, zero and oversized values
- includes events with fewer teams than requested qualifiers
- compares every result with a handwritten table

### Handwritten seed pairs for Q2, Q3, Q5, Q6, Q8, Q12 and Q20

Description: Verifies seeded pairings, including compact Q6 BYE handling.

Inside:

- compares first-round seed numbers with literal expected pair lists
- checks both exact power-of-two and partially filled brackets
- confirms six qualifiers become three real quarterfinal matches
- covers the realistic 20-team bracket used by the full flow

### Six qualifiers play three quarterfinals and advance coherently

Description: Reproduces the reported six-qualifier case and follows it to a champion.

Inside:

- generates phase 1 for eight teams, completes all scores and starts a six-team knockout
- verifies each qualifier appears once across three playable quarterfinals
- confirms one explicit semifinal bye, no impossible third-place match and a valid final winner

### Round names and structure sweep Q2 through Q33

Description: Checks bracket structure over qualifier counts, third-place modes
and terrain availability.

Inside:

- compares round names for one, two, three and five rounds
- sweeps every qualifier count from 2 through 33
- checks bracket size, match IDs, source and next-match links
- checks qualifier and BYE counts with zero or three terrains
- checks third-place creation only when enough semifinals exist

### Random seeding is deterministic and preserves qualifier set

Description: Checks random seeding changes order without losing or duplicating
teams.

Inside:

- repeats random generation with a fixed seed
- compares deterministic bracket output
- checks every qualified team occurs exactly once in the first round

### Recompute no-op, BYEs, propagation and idempotence

Description: Checks automatic bracket recomputation for empty slots and
completed feeder matches.

Inside:

- checks ungenerated and no-round brackets safely do nothing
- covers home-only, away-only and fully empty matches
- checks BYEs complete with the expected score and advance winners
- runs recomputation twice and compares unchanged results

### Q4 third-place losers, champion and downstream chain isolation

Description: Checks a playable four-team bracket through final correction paths.

Inside:

- advances semifinal winners and sends semifinal losers to third place
- completes final and third-place matches and checks the champion
- clears one downstream result chain
- checks the sibling branch and third-place result remain untouched

Limitation: A three-qualified-team third-place match can be unplayable in
production and is not asserted as correct behavior.

## 06 - Actions

File: `06-actions.test.js`

### Setup names, required or duplicate validation, lock and reset unlock

Description: Checks team and terrain editing rules before and after generation.

Inside:

- normalizes repeated whitespace in names
- rejects blank and case-insensitive duplicate names
- removes known entries and rejects unknown IDs
- locks edits after phase 1 generation
- confirms Reset phases unlocks setup

### Config coercions and exact boundary errors

Description: Checks every configuration field at valid and invalid boundaries.

Inside:

- covers point values, matches per team, qualifier count and durations
- accepts intended numeric strings and zero point values
- rejects fractions, nonnumbers and values below required limits
- checks seeding and third-place coercion
- compares exact error messages

### Phase generation and scoring atomicity, substitutions, invalidation and reopen

Description: Checks phase 1 generation, score validation and correction effects.

Inside:

- rejects insufficient teams and odd match-slot setups
- rejects invalid scores, matches and team selections without state changes
- changes first-phase participants and verifies standings use them
- confirms scoring or reopening a phase match removes generated knockout data
- checks reopening retains goals but clears completion timing

### Knockout generation requires every score and selects top N

Description: Checks qualification gating and ranking-based participant selection.

Inside:

- rejects generation while any phase match is incomplete
- completes the phase and builds standings
- checks only the configured top-ranked teams enter the bracket

### Knockout guards, substitution, winner, champion and reopen chain

Description: Checks knockout score entry and dependent-result correction.

Inside:

- rejects draws, missing participants and invalid later-round substitutions
- permits intended first-round substitution
- checks winners advance and the final sets the champion
- reopens matches and verifies only dependent later results clear
- checks semifinal reopening clears the third-place result
- checks reopening the final clears the champion

### Phase timer snapshots and all round or match guards

Description: Checks phase timer actions against exact elapsed-time snapshots.

Inside:

- starts, pauses, resumes and stops a round
- independently pauses and resumes one match
- records expected final elapsed values of 320000, 680000 and 780000 ms
- checks overtime and reopening behavior
- compares every invalid timer action with its expected error

### Knockout and third-place timer lifecycle and guards

Description: Checks timer controls for bracket rounds and the third-place match.

Inside:

- starts, pauses, resumes and stops knockout round timers
- exercises match pauses inside bracket timing
- checks third-place timing without a parent round pause
- verifies invalid identifiers and lifecycle transitions are rejected

### Back or reset preservation, import and download lifecycle

Description: Checks high-level recovery actions and browser download preparation.

Inside:

- confirms Back to phase 1 keeps phase matches and timers
- confirms Reset phases keeps teams, terrains and config
- confirms Reset all restores defaults
- imports text through the action layer
- checks the download name, Blob content, anchor click and URL revocation

Limitation: The download is tested through recorded browser APIs, not a physical
file written by a real browser.

## 07 - Operator page

File: `07-operator-page.test.js`

### Empty or malformed boot, one 1000 ms interval and subscription rerender

Description: Checks operator startup, recovery and render subscription wiring.

Inside:

- boots with empty and malformed local storage
- checks malformed data reports one console error and renders defaults
- checks exactly one one-second timer drives timer updates
- confirms a state action triggers a subscribed rerender

### Forms, config minute conversion and validation alerts

Description: Checks setup form submission and user-facing configuration errors.

Inside:

- submits team and config forms through real event listeners
- checks duplicate teams produce an alert without changing state
- checks displayed minutes are stored as seconds and rendered back as minutes
- checks invalid configuration produces an alert

### Every emitted data action, page scoring and stage gates

Description: Checks delegated click wiring for every control emitted by the
operator renderer.

Inside:

- compares emitted `data-action` values with a handwritten contract
- triggers each action through the root click listener
- saves phase and knockout scores using rendered inputs
- checks setup, phase, knockout and champion button gating
- checks locked team deletion reports an alert
- verifies six qualifiers render three playable quarterfinal cards and one semifinal bye card

### Escaping hostile names and completed or scheduled control locks

Description: Checks HTML escaping and match-editing controls against injection
and accidental resubmission.

Inside:

- renders a name containing tags, ampersands and quotes
- confirms only escaped text appears in rendered containers
- checks completed match controls are disabled and Reopen is enabled
- checks scheduled match controls have the opposite state
- checks only first-round knockout matches expose team selectors

### Shared standings headers, qualified cells and GA decimals

Description: Keeps operator, summary and print standings presentation in sync.

Inside:

- compares all three header sets with the handwritten 13-column contract
- checks qualified shading applies to the configured number of rank and team cells
- checks goal average always renders with two decimals

### A5 print, saved scores, blank pending scores and one print call

Description: Checks printable content selection and paper configuration.

Inside:

- selects A5 output and checks its page size
- verifies completed matches show their saved score
- verifies pending matches leave score space blank
- checks the browser print function is called exactly once

Limitation: This checks generated print markup and settings, not physical printer
output or browser print-preview layout.

### Ticking clocks preserve pauses, freeze states and overtime

Description: Checks live clock updates agree with a fresh render at the same
instant.

Inside:

- covers running, match-paused, round-paused and round-stopped states
- checks completed matches retain final elapsed time
- checks round and match pause totals are both deducted
- checks overtime text and class changes

### Confirmation cancel or apply and preferences survive reset

Description: Checks destructive confirmations and separation of UI preferences
from tournament state.

Inside:

- cancels and confirms Back to phase 1, Reset phases and Reset all
- verifies cancellation changes nothing
- verifies confirmation performs the requested reset
- checks operator and summary preferences use separate storage keys
- checks preferences survive Reset all and do not enter exported state

### Invalid or valid import, empty chooser and export event

Description: Checks operator file controls for import and export outcomes.

Inside:

- submits an empty file selection without changing state
- checks invalid JSON produces an alert and preserves state
- checks valid JSON replaces tournament state
- triggers export through the page event and checks download preparation

## 08 - Summary page

File: `08-summary-page.test.js`

### All stage views never write tournament storage

Description: Confirms the public page is read-only in every tournament stage.

Inside:

- boots empty, malformed, setup, phase 1, knockout and champion states
- checks the correct stage label and visible view
- runs refresh timers and storage events
- confirms storage text and write count never change

### Running, stopped, paused and waiting header clock

Description: Checks the public round clock display and frozen states.

Inside:

- checks waiting before a round starts
- checks the countdown after known elapsed time
- checks paused and stopped clocks no longer advance
- compares literal displayed values

### Shared-storage live events and unrelated key no-op

Description: Checks cross-tab refresh only reacts to relevant persisted changes.

Inside:

- shares one fake storage instance between contexts
- updates tournament state and dispatches the real storage key event
- checks the summary rerenders new content
- dispatches an unrelated key and checks no rerender occurs

### Hidden standings and 40 px/s automatic scrolling

Description: Checks summary display preferences and scroll lifecycle.

Inside:

- applies the `standings-hidden` class from stored preferences
- checks a 16 ms interval controls automatic scrolling
- advances one second and checks a 40-pixel movement
- checks top and bottom direction changes
- turns scrolling off and checks the interval is cleared

### Large standings split, escaping and standings parity

Description: Checks readable table splitting and safe output for large events.

Inside:

- checks more than 30 teams create two tables
- checks more than 80 teams create three tables
- compares summary standings values with production standings
- verifies hostile team names render escaped

### Third place visibility, live bracket progression and scrolling

Description: Checks bracket rendering as participants and rounds become known.

Inside:

- hides third place until both teams are available
- renders live round progression and current-round emphasis
- checks bracket title and horizontal scroll synchronization
- verifies the compact six-qualifier bracket's source-linked positions and semifinal bye

Limitation: The fake DOM checks generated content and events, not pixel layout,
responsive behavior, CSS appearance or real display performance.

## 09 - Full flow

File: `09-full-flow.test.js`

### Realistic 50-team schedule invariants and locked editing

Description: Generates a production-sized phase with 50 teams and 20 terrains
and checks its complete schedule contract.

Inside:

- configures three matches per team and 20 qualifiers
- checks 75 matches across rounds of 20, 20, 20 and 15
- checks exact participation, no team collisions and unique terrains per round
- checks this realistic fixture has no repeated opponent pair
- checks setup, config and early knockout actions are locked

### Full tournament, timers, oracle, upset, backup replay, correction and resets

Description: Runs a complete deterministic tournament through multiple
corrections, backup restore and every reset level.

Inside:

- scores all 75 phase matches with round and match pauses
- compares midpoint and final standings with the independent oracle
- verifies a real points tie occurs
- generates a 20-team knockout with five rounds and 12 BYEs
- checks seed sums, semifinal and final pairings, champion and third place
- reopens a quarterfinal, applies a seed-8 upset and checks only dependent results clear
- imports a quarterfinal backup in a fresh sandbox and reproduces the outcome
- corrects a phase result that changes the top 20 and regenerates the bracket
- checks operator and summary pages show the champion while summary writes nothing
- checks Back to phase 1, Reset phases and Reset all preservation rules

### Seed reproducibility, schedule variation and random knockout completeness

Description: Checks complete exported tournaments remain deterministic while
different seeds and seeding policies still vary intended ordering.

Inside:

- compares same-seed schedules and final exports byte for byte
- checks another seed changes the phase schedule
- checks random seeding still includes every top-20 team exactly once
- checks random seeding still creates 12 BYEs
- completes the random bracket and confirms rank 1 wins under the chosen scoring rule

## Global limitations

- The VM and minimal DOM exercise application logic, rendered HTML and event
  wiring but not real browser layout, CSS rendering or device compatibility
- Download and print tests verify prepared content and browser API calls, not
  physical files, print preview or printer output
- Optional remote font availability and network behavior are outside the suite
- The suite uses deterministic fake time and randomness; browser clock drift and
  runtime performance on event hardware are outside its scope
- A state mutator that changes the live object and then throws is not fully
  atomic in production; tests cover guarded rejection paths without approving
  that defect
- Some action protections are enforced by disabled UI controls rather than the
  action functions; page tests cover those locks
- Known unsupported configurations are documented as limitations instead of
  being asserted as desired behavior
- The suite focuses on supported imports and representative malformed data, not
  every possible historical or manually edited JSON shape
- Private production helpers that cannot be reached through public behavior are
  not instrumented solely to increase function coverage

## Suite integrity checks

During creation, the suite was also checked by:

- three complete deterministic runs with identical counters
- running every test file alone
- production-source coverage measurement
- syntax and ASCII checks
- verifying all 53 production exports are referenced
- applying 27 temporary mutations in an external scratch copy and confirming
  every mutation caused at least one test failure

These integrity checks are development evidence, not additional tests stored in
this directory.

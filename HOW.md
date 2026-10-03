# Screens
index.html = operator screen, summary.html = separate read-only screen for players and public

# Operator controls
Auto scroll : scroll auto on summary page if too many info
Show standings : show the standings table or the matches
Expand/Collapse all : expand or collapse all container on the page

# Import/Export state
Export a .json file with the current state so it can be resumed at this exact point

# print
Print the full standings columns or the current phase matches. Saved scores are printed; unsaved scores are blank to fill by hand. Paper size A3/A4/A5 is selectable

# Quick navigation
The progress bar jumps to the current round/phase
Click a stage to collapse all sections and expand the useful section
Top or double-up-chevron goes back to the top

# Config setup
Only modifiable in the setup phase
Knockout qualifiers must be a power of two (2, 4, 8, 16, ...) and cannot
exceed the registered team count. For example, 10 registered teams allow 2,
4 or 8 qualifiers; 10 qualifiers is not supported. If removing a team makes
the saved count invalid, choose a valid value before saving the config or
generating phase 1.

# Timer
Trigger the round timer to trigger all match timers
The round is in progress while matches still need saved scores

# Status
In progress changes only when the previous round has all scores saved
Phase 2 knockout cannot be generated until every phase 1 match has a saved score

# Changes
In phase 1 or the first knockout round, type in a team field to filter teams
Choose an option by click, or arrows and Enter: the team saves immediately without completing the match
Changing a team clears that match's old score; completed matches must be reopened first
Escape or leaving the field cancels unselected text; clearing text does not remove a team
Browser Find (Ctrl+F, then F3) can locate assigned names in these fields
Manual edits do not rebalance the schedule or filter teams by their configured match count

# Reset
## reset all
- remove all data: phases and setup
## reset phases
- reset all phases and keep setup
## Back to phase 1
- reset only phase 2 and keep phase 1 and its results

# Standings
Columns:
- P: matches played
- W: wins
- D: draws
- L: losses
- GT: Goal Total - total goals scored
- GC: Goal Conceded - total goals conceded
- GA: Goal Average - goals scored per played match
- GD: Goal Difference - GT minus GC
- Last: score in the most recent match
- Best: highest single-match score
- Pts: total points from wins/draws/losses

Top N qualified teams: rank and team cells shaded light green
Best value of each stat: cell shaded purple and bold
Both shadings are also printed, and stay readable on a B&W printer (two different grey levels)

## Decision making for qualification
1. Points descending
2. GA descending
3. GC ascending
4. Team name ascending

Best and Last are informational only and are not tie-breaks

# Audit log
Actions by the operator/user are printed there as a trace of every decisions

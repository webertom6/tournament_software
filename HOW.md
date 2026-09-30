# Screens
index.html = operator screen, summary.html = separate read-only screen for players and public

# Operator controls
Auto scroll : scroll auto on summary page if too many info
Show standings : show the standings table or the matches
Expand/Collapse all : expand or collapse all container on the page

# Import/Export state
Export a .json file with the current state so it can be retrieved at this exact point

# print
Print the full standings columns or the current phase matches. Saved scores are printed; unsaved scores are blank to fill by hand. Paper size A3/A4/A5 is selectable

# Quick navigation
The progress bar jumps to the current round/phase
Click a stage to collapse all sections and expand the useful section
Top or double-up-chevron goes back to the top

# Config setup
Only modifiable in the setup phase

# Timer
Trigger the round timer to trigger all match timers
The round is in progress while matches still need saved scores

# Status
In progress changes only when the previous round has all scores saved
Phase 2 knockout cannot be generated until every phase 1 match has a saved score

# Changes
To change a team in a match: change the dropdown, save the score, then reopen the match
For a completed match: reopen it, change the dropdown, then save the score

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

Best values for each info stat are highlighted in purple on the operator and summary tables

## Decision making for qualification
1. Points descending
2. GA descending
3. GC ascending
4. Team name ascending

Best and Last are informational only and are not tie-breaks

# Audit log
Actions by the operator/user are printed there as a trace of decisions

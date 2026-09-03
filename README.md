# Tournament Software

Tool to run a team tournament from a laptop: register teams and
terrains, schedule the group stage, track scores and timers, then generate a
knockout bracket up to the champion. It runs entirely in the browser, nothing
is installed and nothing needs an internet connection. It was built for and
used at one real event; the logic behind it is solid but the look and feel is
still a bit rough and will keep improving.

## Getting it

1. On the GitHub page, click the green "Code" button, then "Download ZIP"
2. Extract the ZIP anywhere on your computer
3. Open `index.html` in a browser: this is the operator screen, used to run
   the tournament
4. Connect your laptop to a big screen or TV or prjector to extand your your desktop
5. Open `summary.html` on new tab and move it on a second screen (TV, projector, tablet): this is
   the read-only screen for players and public, it updates itself

Both files work offline, no install and no server needed

## What it can do

- **Register teams and terrains** (playing fields), remove them before the
  tournament starts
- **Set the rules**: points for win/draw/loss, number of matches per team in the
  group stage, number of qualified teams, seeding (ranked or random),
  optional third place match
- Set the **match duration** and the pause/break duration (just for information of operator, no logic of automatic stops)
- **Auto-generate the group stage schedule**, matches spread across terrains and
  rounds
- Enter scores match by match, standings update by themselves (ranked by
  points, then total score, then best score)
- Start one shared timer per round for every match in it, pause/resume a
  single match if it gets interrupted, see an overtime indicator if a match
  runs past its duration
- Reopen a completed match to correct a mistake
- **Auto-generate the knockout bracket randomly or seeding policy** once every group stage match is
  completed
- Run the knockout bracket round by round, with a third place match if
  enabled, up to the champion
- Save the whole tournament to a file, or load one back
- Reset everything, or only reset the phases while keeping teams, terrains
  and rules
- Remote-control the public screen: show/hide its standings table, start or
  stop it auto-scrolling

## How to run a tournament

1. Press **Reset all** if a previous tournament is still loaded.
2. Register the **teams** and **terrains** in the Setup section.
3. Fill in the **rules and qualification** form and press **Save config**.
   Nothing is applied until this button is pressed.
4. Press **Generate phase 1 schedule**. From this point the rules and the
   team/terrain list are locked; use **Reset phases** if you need to change
   them and redo the schedule.
5. For each round, press its **Start round timer** once: it starts the same
   countdown for every match in that round. Enter each match's score as it
   finishes; a running match can be paused if it's interrupted, and a
   completed match can be reopened if a score was entered wrong.
6. Once every group stage match has a score, press **Generate phase 2
   knockout**. Teams are seeded into the bracket from the standings (or
   randomly, depending on the seeding setting).
7. Run the knockout rounds the same way (round timer, scores, reopen if
   needed). The bracket updates itself after every score, and the summary
   screen shows the tree live. The champion is announced once the final is
   completed.

## Setup panel buttons

- **Hide/show summary standings**: shows or hides the standings table on the
  public summary screen.
- **Start/stop summary auto-scroll**: makes the public summary screen scroll
  up and down on its own, useful when its content doesn't fit the screen.
- **Export state**: downloads a file with the entire tournament (teams,
  terrains, rules, scores). Keep it as a backup or to move to another
  computer.
- **Import state**: loads a previously exported file, replacing whatever is
  currently open.
- **Reset all**: wipes everything and starts from a blank tournament.

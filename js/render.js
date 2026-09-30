(function () {
    const SUMMARY_PREFS_KEY = "tournament_software_summary_prefs_v1";

    function getSummaryPrefs() {
        try {
            const raw = localStorage.getItem(SUMMARY_PREFS_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return {
                standingsHidden: Boolean(parsed.standingsHidden),
                autoScrollActive: Boolean(parsed.autoScrollActive)
            };
        } catch (error) {
            return { standingsHidden: false, autoScrollActive: false };
        }
    }

    function setSummaryPrefs(partial) {
        const next = Object.assign(getSummaryPrefs(), partial);
        localStorage.setItem(SUMMARY_PREFS_KEY, JSON.stringify(next));
        return next;
    }

    function setToggleButtonState(button, isOn, label) {
        button.textContent = label + ": " + (isOn ? "ON" : "OFF");
        button.classList.toggle("toggle-on", isOn);
        button.classList.toggle("toggle-off", !isOn);
    }

    function updateSummaryControlButtons() {
        const prefs = getSummaryPrefs();
        setToggleButtonState(document.getElementById("btn-toggle-summary-standings"), !prefs.standingsHidden, "Standings");
        setToggleButtonState(document.getElementById("btn-toggle-summary-scroll"), prefs.autoScrollActive, "Auto-scroll");
    }

    function esc(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    const OPERATOR_UI_PREFS_KEY = "tournament_software_operator_ui_prefs_v1";
    const COLLAPSIBLE_SECTION_IDS = ["setup", "phase1", "standings", "knockout", "audit"];

    function getOperatorUiPrefs() {
        try {
            const raw = localStorage.getItem(OPERATOR_UI_PREFS_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return {
                sections: (parsed.sections && typeof parsed.sections === "object") ? parsed.sections : {},
                rounds: (parsed.rounds && typeof parsed.rounds === "object") ? parsed.rounds : {}
            };
        } catch (error) {
            return { sections: {}, rounds: {} };
        }
    }

    function setSectionOverride(sectionId, isOpen) {
        const prefs = getOperatorUiPrefs();
        prefs.sections[sectionId] = isOpen;
        localStorage.setItem(OPERATOR_UI_PREFS_KEY, JSON.stringify(prefs));
    }

    function setRoundOverride(roundKey, isOpen) {
        const prefs = getOperatorUiPrefs();
        prefs.rounds[roundKey] = isOpen;
        localStorage.setItem(OPERATOR_UI_PREFS_KEY, JSON.stringify(prefs));
    }

    function isRoundOpen(roundKey, defaultOpen) {
        const override = getOperatorUiPrefs().rounds[roundKey];
        return typeof override === "boolean" ? override : defaultOpen;
    }

    // default open/closed tracks whichever phase the operator is actively working on
    function getDefaultSectionOpen(sectionId, state) {
        const phase1Generated = Boolean(state && state.phase1 && state.phase1.generated);
        const knockoutGenerated = Boolean(state && state.knockout && state.knockout.generated);
        if (sectionId === "setup") {
            return !phase1Generated;
        }
        if (sectionId === "phase1") {
            return phase1Generated && !knockoutGenerated;
        }
        if (sectionId === "knockout") {
            return knockoutGenerated;
        }
        return false;
    }

    const PROGRESS_STEPS = [
        { key: "setup", label: "Setup", targetSection: "setup" },
        { key: "phase1", label: "Group Matches", targetSection: "phase1" },
        { key: "knockout", label: "Knockout", targetSection: "knockout" },
        { key: "champion", label: "Champion", targetSection: "knockout" }
    ];

    function getCurrentWorkflowStep(state) {
        if (state && state.knockout && state.knockout.championTeamId) {
            return "champion";
        }
        if (state && state.knockout && state.knockout.generated) {
            return "knockout";
        }
        if (state && state.phase1 && state.phase1.generated) {
            return "phase1";
        }
        return "setup";
    }


    function applyCollapsibleSections(state) {
        const prefs = getOperatorUiPrefs();
        COLLAPSIBLE_SECTION_IDS.forEach((sectionId) => {
            const details = document.getElementById("section-" + sectionId);
            if (!details) {
                return;
            }
            const override = prefs.sections[sectionId];
            details.open = typeof override === "boolean" ? override : getDefaultSectionOpen(sectionId, state);
        });
    }

    // every round-level <details class="round-card"> currently in the DOM, regardless of
    // which section it lives in - used so "expand/collapse all" and "jump to current round"
    // share one enumeration instead of drifting apart
    function forEachRoundCard(callback) {
        document.querySelectorAll("details.round-card").forEach((details) => {
            const summary = details.querySelector(":scope > summary[data-round-key]");
            const roundKey = summary ? summary.getAttribute("data-round-key") : null;
            if (roundKey) {
                callback(details, roundKey);
            }
        });
    }

    function setAllSectionsOpen(isOpen) {
        COLLAPSIBLE_SECTION_IDS.forEach((sectionId) => {
            setSectionOverride(sectionId, isOpen);
            const details = document.getElementById("section-" + sectionId);
            if (details) {
                details.open = isOpen;
            }
        });
        forEachRoundCard((details, roundKey) => {
            setRoundOverride(roundKey, isOpen);
            details.open = isOpen;
        });
    }

    function bindCollapsibleSections() {
        COLLAPSIBLE_SECTION_IDS.forEach((sectionId) => {
            const details = document.getElementById("section-" + sectionId);
            if (!details) {
                return;
            }
            const summary = details.querySelector(":scope > summary");
            summary.addEventListener("click", () => {
                setSectionOverride(sectionId, !details.open);
            });
        });
        document.getElementById("btn-expand-all").addEventListener("click", () => setAllSectionsOpen(true));
        document.getElementById("btn-collapse-all").addEventListener("click", () => setAllSectionsOpen(false));
    }

    function renderTeams(state) {
        const target = document.getElementById("teams-list");
        if (!state.teams.length) {
            target.innerHTML = '<p class="muted">No teams yet</p>';
            return;
        }

        target.innerHTML = '<div class="list-rows">' + state.teams.map((team) => {
            return '' +
                '<div class="list-row">' +
                '<span>' + esc(team.name) + '</span>' +
                '<button type="button" data-action="team-remove" data-team-id="' + esc(team.id) + '" class="danger">Delete</button>' +
                '</div>';
        }).join("") + '</div>';
    }

    function renderTerrains(state) {
        const target = document.getElementById("terrains-list");
        if (!state.terrains.length) {
            target.innerHTML = '<p class="muted">No terrains yet - a round can then hold any number of simultaneous matches; add terrains to cap each round at one match per terrain</p>';
            return;
        }

        target.innerHTML = '<div class="list-rows">' + state.terrains.map((terrain) => {
            return '' +
                '<div class="list-row">' +
                '<span>' + esc(terrain.name) + '</span>' +
                '<button type="button" data-action="terrain-remove" data-terrain-id="' + esc(terrain.id) + '" class="danger">Delete</button>' +
                '</div>';
        }).join("") + '</div>';
    }

    // a completed match is fully locked (score + team) until Reopen is clicked; a
    // not-yet-completed match can't be reopened (nothing to reopen), guiding the
    // operator through Reopen -> edit -> Save instead of editing in place
    function buildScoreRow(match, homeRole, awayRole, saveAction, reopenAction) {
        const isCompleted = match.status === "completed";
        const lockedAttr = isCompleted ? ' disabled' : '';
        const reopenAttr = isCompleted ? '' : ' disabled title="Only a completed match can be reopened"';
        return '<div class="match-row">' +
            '<input type="number" min="0" step="1" data-role="' + homeRole + '" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.homeGoals) ? match.homeGoals : "") + '" placeholder="Home goals" aria-label="Home goals"' + lockedAttr + '>' +
            '<input type="number" min="0" step="1" data-role="' + awayRole + '" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.awayGoals) ? match.awayGoals : "") + '" placeholder="Away goals" aria-label="Away goals"' + lockedAttr + '>' +
            '<button type="button" data-action="' + esc(saveAction) + '" data-match-id="' + esc(match.id) + '"' + lockedAttr + '>Save score</button>' +
            '<button type="button" class="reopen" data-action="' + esc(reopenAction) + '" data-match-id="' + esc(match.id) + '"' + reopenAttr + '>Reopen</button>' +
            '</div>';
    }

    function buildTeamSelect(state, role, matchId, currentTeamId, otherTeamId, allowEmpty, isLocked) {
        const options = [];
        if (allowEmpty) {
            options.push('<option value=""' + (!currentTeamId ? ' selected' : '') + '>BYE / none</option>');
        }
        state.teams.forEach((team) => {
            if (team.id === otherTeamId) {
                return;
            }
            const selected = team.id === currentTeamId ? ' selected' : '';
            options.push('<option value="' + esc(team.id) + '"' + selected + '>' + esc(team.name) + '</option>');
        });
        // locked once a match is completed, so a team swap can't silently go unnoticed -
        // reopening the match (which keeps the score, see reopenPhase1Match/reopenKnockoutMatch)
        // unlocks it again
        const lockedAttr = isLocked ? ' disabled title="Reopen the match to change teams"' : '';
        return '<select data-role="' + role + '" data-match-id="' + esc(matchId) + '" aria-label="' + role + '"' + lockedAttr + '>' + options.join("") + '</select>';
    }

    function renderMatchTeamsStatic(home, away) {
        return '' +
            '<div class="match-teams-static">' +
            '<span class="team-line" title="' + esc(home) + '">' + esc(home) + '</span>' +
            '<span class="team-line" title="' + esc(away) + '"><span class="vs-label">vs</span> ' + esc(away) + '</span>' +
            '</div>';
    }

    // <select>/<option> text isn't reachable by the browser's find-in-page (Ctrl+F);
    // this mirrors only the currently assigned team names as small real text (not
    // clipped-hidden) so a Ctrl+F match is actually visible, not just jumped-to
    function buildSearchableTeamNames(home, away) {
        return '<p class="match-search-label">' + esc(home) + ' vs ' + esc(away) + '</p>';
    }

    // round: {startedAt, stoppedAt, pausedAt, pausedTotalMs}; opts.pauseAction/resumeAction are
    // omitted for third place (it has no separate round-pause layer, see getRoundTimerInfo)
    function renderRoundTimerControls(round, opts) {
        const timer = window.TournamentTimer;
        const startedAt = round.startedAt;
        const stoppedAt = round.stoppedAt;
        const pausedAt = round.pausedAt;
        const pausedTotalMs = round.pausedTotalMs || 0;
        const durationMs = Number(opts.matchDurationSeconds) * 1000;
        const canPauseRound = Boolean(opts.pauseAction && opts.resumeAction);

        if (!startedAt) {
            const disabledAttr = opts.isUpcoming ? ' disabled title="Finish or reach the current round first"' : '';
            return '<div class="round-timer-controls">' +
                '<button type="button" data-action="' + esc(opts.startAction) + '" data-round-key="' + esc(opts.roundKey) + '"' + disabledAttr + '>Start round timer</button>' +
                '</div>';
        }

        if (stoppedAt) {
            const stoppedElapsed = timer.computeRoundElapsedMs(startedAt, null, pausedTotalMs, stoppedAt);
            return '<div class="round-timer-controls">' +
                '<span class="muted">Round timer stopped at:</span> ' +
                '<span class="round-clock" data-role="round-clock">' + esc(timer.formatDuration(stoppedElapsed)) + '</span>' +
                '</div>';
        }

        if (canPauseRound && pausedAt) {
            const frozenElapsed = timer.computeRoundElapsedMs(startedAt, pausedAt, pausedTotalMs, Date.now());
            const remaining = durationMs - frozenElapsed;
            return '<div class="round-timer-controls">' +
                '<span class="muted">Round timer paused:</span> ' +
                '<span class="round-clock' + (remaining < 0 ? " overtime" : "") + '" data-role="round-clock">' + esc(timer.formatCountdown(remaining)) + '</span>' +
                '<button type="button" class="timer-action" data-action="' + esc(opts.resumeAction) + '" data-round-key="' + esc(opts.roundKey) + '">Resume round timer</button>' +
                '</div>';
        }

        const liveElapsed = timer.computeRoundElapsedMs(startedAt, null, pausedTotalMs, Date.now());
        const liveRemaining = durationMs - liveElapsed;
        const clockAttrs = 'data-started-at="' + startedAt + '" data-paused-total-ms="' + pausedTotalMs + '" data-match-duration-ms="' + durationMs + '"';
        const pauseButtonHtml = canPauseRound ?
            '<button type="button" class="timer-action" data-action="' + esc(opts.pauseAction) + '" data-round-key="' + esc(opts.roundKey) + '">Pause round timer</button>' :
            '';
        return '<div class="round-timer-controls">' +
            '<span class="muted">Round timer:</span> ' +
            '<span class="round-clock' + (liveRemaining < 0 ? " overtime" : "") + '" data-role="round-clock" ' + clockAttrs + '>' + esc(timer.formatCountdown(liveRemaining)) + '</span>' +
            pauseButtonHtml +
            '<button type="button" class="danger" data-action="' + esc(opts.stopAction) + '" data-round-key="' + esc(opts.roundKey) + '">Stop round timer</button>' +
            '</div>';
    }

    // round: {startedAt, pausedAt, pausedTotalMs, stoppedAt} - the round-level pause layer
    // (see js/timer.js); for third place, callers pass pausedAt:null/pausedTotalMs:0 (no
    // separate round layer there) but DO pass its own stoppedAt
    function renderMatchTimerBlock(round, match, matchDurationSeconds, pauseDurationSeconds) {
        const timer = window.TournamentTimer;
        const now = Date.now();
        const roundStartedAt = round.startedAt;
        const roundPausedAt = round.pausedAt || null;
        const roundPausedTotalMs = round.pausedTotalMs || 0;
        const roundStoppedAt = round.stoppedAt || null;

        if (match.finalElapsedMs !== null && match.finalElapsedMs !== undefined) {
            return '<div class="match-timer">' +
                '<span class="match-clock" data-role="match-clock" data-final-elapsed-ms="' + match.finalElapsedMs + '">' +
                esc(timer.formatDuration(match.finalElapsedMs)) + '</span>' +
                '<span class="muted">Final time</span>' +
                '</div>';
        }

        if (!roundStartedAt) {
            return '<div class="match-timer"><span class="muted">Round timer not started</span></div>';
        }

        const matchDurationMs = Number(matchDurationSeconds) * 1000;
        const pausedTotalMs = match.pausedTotalMs || 0;
        const pausedAttr = match.pausedAt ? ' data-paused-at="' + match.pausedAt + '"' : '';
        const roundPausedAttr = roundPausedAt ? ' data-round-paused-at="' + roundPausedAt + '"' : '';
        const roundStoppedAttr = roundStoppedAt ? ' data-round-stopped-at="' + roundStoppedAt + '"' : '';
        const clockAttrs = 'data-started-at="' + roundStartedAt + '" data-paused-total-ms="' + pausedTotalMs +
            '" data-round-paused-total-ms="' + roundPausedTotalMs +
            '" data-match-duration-ms="' + matchDurationMs + '"' + pausedAttr + roundPausedAttr + roundStoppedAttr;
        const elapsed = timer.computeElapsedMs(roundStartedAt, roundPausedAt, roundPausedTotalMs, roundStoppedAt, match, now);
        const remaining = matchDurationMs - elapsed;
        const overtimeClass = remaining < 0 ? " overtime" : "";
        const clockHtml = '<span class="match-clock' + overtimeClass + '" data-role="match-clock" ' + clockAttrs + '>' + esc(timer.formatCountdown(remaining)) + '</span>';

        // a stopped round freezes everyone's clock for good (no resume possible); a paused
        // round freezes it temporarily. Either way, per-match pause/resume is blocked (see
        // actions.js guards) to avoid double-counting time, so just show the frozen clock
        // instead of a button that would error if clicked
        if (roundStoppedAt) {
            return '<div class="match-timer">' +
                clockHtml +
                '<span class="muted">Round timer stopped</span>' +
                '</div>';
        }

        if (roundPausedAt) {
            return '<div class="match-timer">' +
                clockHtml +
                '<span class="muted">Round paused</span>' +
                '</div>';
        }

        if (match.pausedAt) {
            const breakRemaining = timer.computeBreakRemainingMs(match, pauseDurationSeconds, now);
            return '<div class="match-timer">' +
                clockHtml +
                '<span class="break-clock" data-role="match-break" data-paused-at="' + match.pausedAt + '" data-pause-duration-ms="' + (Number(pauseDurationSeconds) * 1000) + '">' +
                esc("Break: " + timer.formatDuration(breakRemaining)) +
                '</span>' +
                '<button type="button" data-action="match-resume" data-match-id="' + esc(match.id) + '">Resume</button>' +
                '</div>';
        }

        return '<div class="match-timer">' +
            clockHtml +
            '<button type="button" class="timer-action" data-action="match-pause" data-match-id="' + esc(match.id) + '">Pause</button>' +
            '</div>';
    }

    function tickTimers() {
        const timer = window.TournamentTimer;
        const now = Date.now();

        document.querySelectorAll('[data-role="match-clock"]').forEach((el) => {
            if (el.hasAttribute("data-final-elapsed-ms")) {
                return;
            }
            const startedAt = Number(el.getAttribute("data-started-at"));
            if (!startedAt) {
                return;
            }
            const pausedTotalMs = Number(el.getAttribute("data-paused-total-ms") || 0);
            const roundPausedTotalMs = Number(el.getAttribute("data-round-paused-total-ms") || 0);
            const pausedAtRaw = el.getAttribute("data-paused-at");
            const roundPausedAtRaw = el.getAttribute("data-round-paused-at");
            const roundStoppedAtRaw = el.getAttribute("data-round-stopped-at");
            const roundActiveEnd = roundStoppedAtRaw ? Number(roundStoppedAtRaw) : (roundPausedAtRaw ? Number(roundPausedAtRaw) : now);
            const activeEnd = pausedAtRaw ? Number(pausedAtRaw) : roundActiveEnd;
            const elapsed = Math.max(0, activeEnd - startedAt - pausedTotalMs - roundPausedTotalMs);
            const matchDurationMs = Number(el.getAttribute("data-match-duration-ms") || 0);
            const remaining = matchDurationMs - elapsed;
            el.classList.toggle("overtime", remaining < 0);
            el.textContent = timer.formatCountdown(remaining);
        });

        document.querySelectorAll('[data-role="match-break"]').forEach((el) => {
            const pausedAt = Number(el.getAttribute("data-paused-at"));
            const pauseDurationMs = Number(el.getAttribute("data-pause-duration-ms"));
            el.textContent = "Break: " + timer.formatDuration(pauseDurationMs - (now - pausedAt));
        });

        document.querySelectorAll('[data-role="round-clock"]').forEach((el) => {
            if (!el.hasAttribute("data-started-at")) {
                return;
            }
            const startedAt = Number(el.getAttribute("data-started-at"));
            const pausedTotalMs = Number(el.getAttribute("data-paused-total-ms") || 0);
            const durationMs = Number(el.getAttribute("data-match-duration-ms") || 0);
            const elapsed = Math.max(0, now - startedAt - pausedTotalMs);
            const remaining = durationMs - elapsed;
            el.classList.toggle("overtime", remaining < 0);
            el.textContent = timer.formatCountdown(remaining);
        });
    }

    function getTerrainName(state, terrainId) {
        const terrain = state.terrains.find((item) => item.id === terrainId);
        return terrain ? terrain.name : "No terrain";
    }

    function groupPhase1ByRound(matches) {
        const map = new Map();
        matches.forEach((match) => {
            const key = String(match.roundIndex);
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key).push(match);
        });
        return Array.from(map.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
    }

    // first round with an unfinished match is "current"; if every round is done, keep the last one open
    function getCurrentPhase1RoundIndex(rounds) {
        for (let i = 0; i < rounds.length; i += 1) {
            if (rounds[i][1].some((match) => match.status !== "completed")) {
                return Number(rounds[i][0]);
            }
        }
        return rounds.length ? Number(rounds[rounds.length - 1][0]) : 0;
    }

    function getCurrentKnockoutRoundIndex(rounds) {
        for (let i = 0; i < rounds.length; i += 1) {
            const hasPlayable = rounds[i].matches.some((match) => match.homeTeamId && match.awayTeamId && match.status !== "completed");
            if (hasPlayable) {
                return i;
            }
        }
        return Math.max(0, rounds.length - 1);
    }

    // reuses the exact same "which round is current" logic renderPhase1/renderKnockout use for
    // their own auto-expand, so "jump to current round" can never disagree with what auto-expands
    function getCurrentRoundKeyForSection(sectionId, state) {
        if (sectionId === "phase1") {
            if (!state.phase1.generated || !state.phase1.matches.length) {
                return null;
            }
            const rounds = groupPhase1ByRound(state.phase1.matches);
            return "phase1:" + getCurrentPhase1RoundIndex(rounds);
        }
        if (sectionId === "knockout") {
            if (!state.knockout.generated || !state.knockout.rounds.length) {
                return null;
            }
            const currentRoundIndex = getCurrentKnockoutRoundIndex(state.knockout.rounds);
            const round = state.knockout.rounds[currentRoundIndex];
            return round ? "knockout:" + round.id : null;
        }
        return null;
    }

    // bracket.js only names the last 3 rounds (Quarterfinal/Semifinal/Final); earlier
    // rounds keep a generic stored name, so derive "Round of N" from the round's own match count
    // (mirrors js/summary.js's getKnockoutRoundLabel so both pages label rounds the same way)
    function getKnockoutRoundLabel(round) {
        if (round.name === "Quarterfinal" || round.name === "Semifinal" || round.name === "Final") {
            return round.name;
        }
        return "Round of " + (round.matches.length * 2);
    }

    // physical page dimensions in millimeters - not all of these are native CSS @page
    // size keywords (only A3/A4/A5 are), so every size is spelled out explicitly here
    const PAPER_SIZES_MM = {
        A0: [841, 1189],
        A1: [594, 841],
        A2: [420, 594],
        A3: [297, 420],
        A4: [210, 297],
        A5: [148, 210]
    };

    // one content shape per print kind, decoupled from HTML so "what to show" stays a
    // single decision point even though each kind renders very differently on paper
    function pluralize(count, singular) {
        return count + " " + singular + (count === 1 ? "" : "s");
    }

    function getExportModel(kind, state) {
        const generatedAt = new Date().toLocaleString();
        const meta = pluralize(state.teams.length, "team") + " - " + pluralize(state.terrains.length, "terrain") + " - Generated " + generatedAt;

        if (kind === "standings") {
            const standings = window.TournamentRules.buildStandings(state);
            return {
                type: "standings",
                title: "Standings",
                meta: meta,
                standings: standings,
                qualifiedCount: window.TournamentBracket.normalizeQualifiedCount(standings.length, state.config.qualifiedCount),
                bestValues: window.TournamentRules.getStandingsBestValues(standings)
            };
        }

        const step = getCurrentWorkflowStep(state);

        if (step === "phase1" && state.phase1.generated && state.phase1.matches.length) {
            const rounds = groupPhase1ByRound(state.phase1.matches);
            const isCompleted = state.phase1.matches.every((match) => match.status === "completed");
            return {
                type: "phase1",
                title: "Phase 1 - Group Matches",
                meta: meta,
                statusKey: isCompleted ? "completed" : "current",
                statusLabel: isCompleted ? "Completed" : "In progress",
                rounds: rounds
            };
        }

        if ((step === "knockout" || step === "champion") && state.knockout.generated && state.knockout.rounds.length) {
            return {
                type: "knockout",
                title: "Knockout Bracket",
                meta: meta,
                statusKey: step === "champion" ? "completed" : "current",
                statusLabel: step === "champion" ? "Champion decided" : "In progress",
                rounds: state.knockout.rounds,
                thirdPlace: state.config.thirdPlaceMatch ? state.knockout.thirdPlace : null
            };
        }

        // setup stage, or a later stage with nothing generated yet - fall back to the team list
        return { type: "teams", title: "Registered Teams", meta: meta, teams: state.teams };
    }

    function buildExportHeaderHtml(model) {
        const statusHtml = model.statusKey ?
            '<span class="print-status-pill ' + model.statusKey + '">' + esc(model.statusLabel) + '</span>' : "";
        return '' +
            '<div class="print-banner">' +
            '<div>' +
            '<p class="print-brand-small">Tournament Software</p>' +
            '<h1 class="print-title">' + esc(model.title) + '</h1>' +
            '<p class="print-meta">' + esc(model.meta) + '</p>' +
            '</div>' +
            statusHtml +
            '</div>';
    }

    function buildTeamsPrintHtml(model) {
        if (!model.teams.length) {
            return '<p class="print-empty">No teams registered yet</p>';
        }
        return '<div class="print-chip-grid">' +
            model.teams.map((team) => '<span class="print-chip">' + esc(team.name) + '</span>').join("") +
            '</div>';
    }

    // shows the real score when recorded, otherwise a blank line to fill in by hand -
    // shared by every match card so "pending result" always looks the same on paper
    function buildScoreLineHtml(match) {
        if (Number.isFinite(match.homeGoals) && Number.isFinite(match.awayGoals)) {
            return '<p class="print-match-score">' + match.homeGoals + " - " + match.awayGoals + '</p>';
        }
        return '<p class="print-match-score print-match-score--blank"><span class="print-blank-score"></span> - <span class="print-blank-score"></span></p>';
    }

    // teamsKnown is true for phase 1 (teams always assigned upfront) and knockout round 1
    // (seeded from qualifiers); later knockout rounds pass false since the printout is made
    // once ahead of time - blank writing lines beat "TBD" there. The terrain is always known
    // (fixed at generation time) so it's always printed even when the teams aren't yet
    function buildMatchCardHtml(state, match, teamsKnown) {
        const teamsHtml = teamsKnown ?
            esc(match.homeTeamId ? window.TournamentRules.getTeamNameById(state, match.homeTeamId) : "TBD") +
            ' <span class="print-vs">vs</span> ' +
            esc(match.awayTeamId ? window.TournamentRules.getTeamNameById(state, match.awayTeamId) : "TBD") :
            '<span class="print-blank-line"></span><span class="print-vs">vs</span><span class="print-blank-line"></span>';
        return '' +
            '<article class="print-match' + (teamsKnown ? '' : ' print-match--blank') + '">' +
            '<p class="print-match-teams' + (teamsKnown ? '' : ' print-match-teams--blank') + '">' + teamsHtml + '</p>' +
            buildScoreLineHtml(match) +
            '<p class="print-match-terrain">Terrain: ' + esc(getTerrainName(state, match.terrainId)) + '</p>' +
            '</article>';
    }

    function buildPhase1PrintHtml(state, model) {
        if (!model.rounds.length) {
            return '<p class="print-empty">No matches yet</p>';
        }
        return '<div class="print-bracket">' + model.rounds.map((entry) => {
            const roundIndex = Number(entry[0]);
            const cards = entry[1].map((match) => buildMatchCardHtml(state, match, true)).join("");
            return '' +
                '<section class="print-round-section">' +
                '<h2>Round ' + (roundIndex + 1) + '</h2>' +
                '<div class="print-match-grid">' + cards + '</div>' +
                '</section>';
        }).join("") + '</div>';
    }

    function buildKnockoutPrintHtml(state, model) {
        const roundsHtml = model.rounds.map((round, roundIndex) => {
            const cards = round.matches.map((match) => buildMatchCardHtml(state, match, roundIndex === 0)).join("");
            return '' +
                '<section class="print-round-section">' +
                '<h2>' + esc(getKnockoutRoundLabel(round)) + '</h2>' +
                '<div class="print-match-grid">' + cards + '</div>' +
                '</section>';
        }).join("");
        const thirdPlaceHtml = model.thirdPlace ?
            '<section class="print-round-section">' +
            '<h2>Third place</h2>' +
            '<div class="print-match-grid">' + buildMatchCardHtml(state, model.thirdPlace, false) + '</div>' +
            '</section>' : "";
        return '<div class="print-bracket">' + roundsHtml + thirdPlaceHtml + '</div>';
    }

    function buildStandingsPrintHtml(model) {
        if (!model.standings.length) {
            return '<p class="print-empty">No standings yet</p>';
        }
        return '<table class="print-table standings-table">' +
            '<thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GT</th><th>GC</th><th>GA</th><th>GD</th><th>Last</th><th>Best</th><th>Pts</th></tr></thead>' +
            '<tbody>' +
            model.standings.map((row) => {
                const qualifiedAttr = row.rank <= model.qualifiedCount ? ' class="standings-qualified"' : "";
                // shading is the one exception to the low-ink rule: it is what makes the
                // qualified cut and the best stats readable on a B&W printout
                const cell = (value, key) => {
                    const isBest = model.bestValues[key] !== null && row[key] === model.bestValues[key];
                    return '<td' + (isBest ? ' class="stat-best"' : "") + '>' + value + '</td>';
                };
                return '' +
                    '<tr>' +
                    '<td' + qualifiedAttr + '>' + row.rank + '</td>' +
                    '<td' + qualifiedAttr + '>' + esc(row.teamName) + '</td>' +
                    '<td>' + row.played + '</td>' +
                    cell(row.wins, "wins") +
                    '<td>' + row.draws + '</td>' +
                    cell(row.losses, "losses") +
                    cell(row.gt, "gt") +
                    cell(row.gc, "gc") +
                    cell(row.ga.toFixed(2), "ga") +
                    cell(row.gd, "gd") +
                    cell(row.lastScore === null ? "-" : row.lastScore, "lastScore") +
                    cell(row.bestScore, "bestScore") +
                    cell(row.points, "points") +
                    '</tr>';
            }).join("") +
            '</tbody></table>';
    }

    // deliberately plain: white page, navy text, thin rules, no live strip/timer/full-color
    // banner - this is meant to be read on paper by a table with no screen, not glanced at
    // from across a room like summary.html, so it favors low ink use over scoreboard drama
    function buildExportHtml(model, state) {
        let contentHtml;
        if (model.type === "standings") {
            contentHtml = buildStandingsPrintHtml(model);
        } else if (model.type === "phase1") {
            contentHtml = buildPhase1PrintHtml(state, model);
        } else if (model.type === "knockout") {
            contentHtml = buildKnockoutPrintHtml(state, model);
        } else {
            contentHtml = buildTeamsPrintHtml(model);
        }
        return '<div class="print-page">' + buildExportHeaderHtml(model) + contentHtml + '</div>';
    }

    function setPrintPageSize(paperKey) {
        const size = PAPER_SIZES_MM[paperKey] || PAPER_SIZES_MM.A4;
        let styleTag = document.getElementById("print-page-size-style");
        if (!styleTag) {
            styleTag = document.createElement("style");
            styleTag.id = "print-page-size-style";
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = "@page { size: " + size[0] + "mm " + size[1] + "mm; margin: 10mm; }";
    }

    function generateExport() {
        const state = window.TournamentState.getState();
        const kind = document.getElementById("export-print-content").value;
        const paperKey = document.getElementById("export-print-paper").value;
        const model = getExportModel(kind, state);

        document.getElementById("print-root").innerHTML = buildExportHtml(model, state);
        setPrintPageSize(paperKey);
        window.print();
    }

    function renderRoundStatusPill(statusKey) {
        const label = statusKey === "completed" ? "Completed" : (statusKey === "current" ? "In progress" : "Upcoming");
        return '<span class="status-pill ' + statusKey + '">' + label + '</span>';
    }

    function renderPhase1(state) {
        const summary = document.getElementById("phase1-summary");
        const target = document.getElementById("phase1-matches");
        if (!state.phase1.generated) {
            summary.innerHTML = '<p class="muted">Phase 1 not generated yet</p>';
            target.innerHTML = "";
            return;
        }

        const completed = state.phase1.matches.filter((match) => match.status === "completed").length;
        summary.innerHTML =
            '<p><strong>' + completed + '</strong> / <strong>' + state.phase1.matches.length + '</strong> matches completed</p>' +
            '<p class="muted">Configured phase 1 matches per team: <strong>' + state.config.phase1MatchesPerTeam + "</strong></p>";

        const rounds = groupPhase1ByRound(state.phase1.matches);
        const currentRoundIndex = getCurrentPhase1RoundIndex(rounds);
        target.innerHTML = '<div class="round-stack">' + rounds.map((entry) => {
            const roundIndex = Number(entry[0]);
            const matches = entry[1];
            const roundTimer = state.phase1.roundTimers[String(roundIndex)] || null;
            const roundTimerSafe = roundTimer || { startedAt: null, stoppedAt: null, pausedAt: null, pausedTotalMs: 0 };
            const roundStartedAt = roundTimerSafe.startedAt;
            const isCompleted = matches.every((match) => match.status === "completed");
            const isCurrent = !isCompleted && roundIndex === currentRoundIndex;
            const statusKey = isCompleted ? "completed" : (isCurrent ? "current" : "upcoming");
            const roundKey = "phase1:" + roundIndex;
            const isOpen = isRoundOpen(roundKey, isCurrent);
            return '' +
                '<details class="round-card round-card--' + statusKey + '"' + (isOpen ? " open" : "") + '>' +
                '<summary class="round-summary" data-action="round-toggle" data-round-key="' + esc(roundKey) + '">' +
                '<h3>Round ' + (roundIndex + 1) + '</h3>' +
                renderRoundStatusPill(statusKey) +
                '<span class="chevron" aria-hidden="true"></span>' +
                '</summary>' +
                '<div class="round-body">' +
                renderRoundTimerControls(roundTimerSafe, {
                    startAction: "phase1-start-round",
                    stopAction: "phase1-stop-round",
                    pauseAction: "phase1-pause-round",
                    resumeAction: "phase1-resume-round",
                    roundKey: String(roundIndex),
                    matchDurationSeconds: state.config.matchDurationSeconds,
                    isUpcoming: statusKey === "upcoming"
                }) +
                '<div class="match-row-scroller">' +
                matches.map((match) => {
                    return '' +
                        '<div class="match-card">' +
                        '<div class="match-head">' +
                        '<span class="status-pill ' + esc(match.status) + '">' + esc(match.status) + '</span>' +
                        '</div>' +
                        '<p class="muted">Terrain: ' + esc(getTerrainName(state, match.terrainId)) + '</p>' +
                        buildSearchableTeamNames(
                            match.homeTeamId ? window.TournamentRules.getTeamNameById(state, match.homeTeamId) : "TBD",
                            match.awayTeamId ? window.TournamentRules.getTeamNameById(state, match.awayTeamId) : "TBD"
                        ) +
                        '<div class="match-teams">' +
                        buildTeamSelect(state, "phase1-home-team", match.id, match.homeTeamId, match.awayTeamId, false, match.status === "completed") +
                        '<span class="vs-label">vs</span>' +
                        buildTeamSelect(state, "phase1-away-team", match.id, match.awayTeamId, match.homeTeamId, false, match.status === "completed") +
                        '</div>' +
                        renderMatchTimerBlock(roundTimerSafe, match, state.config.matchDurationSeconds, state.config.pauseDurationSeconds) +
                        buildScoreRow(match, "phase1-home", "phase1-away", "phase1-save", "phase1-reopen") +
                        '</div>';
                }).join("") +
                '</div>' +
                '</div>' +
                '</details>';
        }).join("") + '</div>';
    }

    function renderStandings(state) {
        const target = document.getElementById("phase1-standings");
        const standings = window.TournamentRules.buildStandings(state);
        if (!standings.length) {
            target.innerHTML = '<p class="muted">No standings yet</p>';
            return;
        }

        const normalizedQualified = window.TournamentBracket.normalizeQualifiedCount(standings.length, state.config.qualifiedCount);
        const bestValues = window.TournamentRules.getStandingsBestValues(standings);
        target.innerHTML =
            '<p class="muted">Qualified for knockout: top ' + normalizedQualified + " teams</p>" +
            '<table class="standings-table">' +
            "<thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GT</th><th>GC</th><th>GA</th><th>GD</th><th>Last</th><th>Best</th><th>Pts</th></tr></thead>" +
            "<tbody>" +
            standings.map((row, index) => {
                const isQualified = index < normalizedQualified;
                const qualifiedAttr = isQualified ? ' class="standings-qualified"' : "";
                // value is what gets printed, key is the raw field the best-value check reads
                const cell = (value, key) => {
                    const isBest = bestValues[key] !== null && row[key] === bestValues[key];
                    return "<td" + (isBest ? ' class="stat-best"' : "") + ">" + value + "</td>";
                };
                return '' +
                    "<tr>" +
                    "<td" + qualifiedAttr + ">" + row.rank + "</td>" +
                    "<td" + qualifiedAttr + ">" + esc(row.teamName) + "</td>" +
                    "<td>" + row.played + "</td>" +
                    cell(row.wins, "wins") +
                    "<td>" + row.draws + "</td>" +
                    cell(row.losses, "losses") +
                    cell(row.gt, "gt") +
                    cell(row.gc, "gc") +
                    cell(row.ga.toFixed(2), "ga") +
                    cell(row.gd, "gd") +
                    cell(row.lastScore === null ? "-" : row.lastScore, "lastScore") +
                    cell(row.bestScore, "bestScore") +
                    cell("<strong>" + row.points + "</strong>", "points") +
                    "</tr>";
            }).join("") +
            "</tbody>" +
            "</table>";
    }

    function renderKnockout(state) {
        const summary = document.getElementById("knockout-summary");
        const roundsTarget = document.getElementById("knockout-rounds");
        const champion = document.getElementById("champion-block");
        const thirdPlace = document.getElementById("third-place-block");

        if (!state.knockout.generated) {
            summary.innerHTML = '<p class="muted">Knockout not generated yet</p>';
            roundsTarget.innerHTML = "";
            champion.innerHTML = "";
            thirdPlace.innerHTML = "";
            return;
        }

        summary.innerHTML = '<p>Seeding policy: <strong>' + esc(state.config.seedingPolicy) + "</strong></p>";

        const currentKnockoutRoundIndex = getCurrentKnockoutRoundIndex(state.knockout.rounds);
        roundsTarget.innerHTML = '<div class="round-stack">' + state.knockout.rounds.map((round, roundIndex) => {
            const isCompleted = round.matches.every((match) => match.status === "completed");
            const isCurrent = !isCompleted && roundIndex === currentKnockoutRoundIndex;
            const statusKey = isCompleted ? "completed" : (isCurrent ? "current" : "upcoming");
            const roundKey = "knockout:" + round.id;
            const isOpen = isRoundOpen(roundKey, isCurrent);
            return '' +
                '<details class="round-card round-card--' + statusKey + '"' + (isOpen ? " open" : "") + '>' +
                '<summary class="round-summary" data-action="round-toggle" data-round-key="' + esc(roundKey) + '">' +
                '<h3>' + esc(getKnockoutRoundLabel(round)) + '</h3>' +
                renderRoundStatusPill(statusKey) +
                '<span class="chevron" aria-hidden="true"></span>' +
                '</summary>' +
                '<div class="round-body">' +
                renderRoundTimerControls(round, {
                    startAction: "ko-start-round",
                    stopAction: "ko-stop-round",
                    pauseAction: "ko-pause-round",
                    resumeAction: "ko-resume-round",
                    roundKey: round.id,
                    matchDurationSeconds: state.config.matchDurationSeconds,
                    isUpcoming: statusKey === "upcoming"
                }) +
                '<div class="match-row-scroller">' +
                round.matches.map((match) => {
                    const isFirstRound = !match.homeSourceMatchId && !match.awaySourceMatchId;
                    const home = match.homeTeamId ? window.TournamentRules.getTeamNameById(state, match.homeTeamId) : "TBD";
                    const away = match.awayTeamId ? window.TournamentRules.getTeamNameById(state, match.awayTeamId) : "TBD";
                    const teamsHtml = isFirstRound ?
                        buildSearchableTeamNames(home, away) +
                        '<div class="match-teams">' +
                        buildTeamSelect(state, "ko-home-team", match.id, match.homeTeamId, match.awayTeamId, true, match.status === "completed") +
                        '<span class="vs-label">vs</span>' +
                        buildTeamSelect(state, "ko-away-team", match.id, match.awayTeamId, match.homeTeamId, true, match.status === "completed") +
                        '</div>' :
                        renderMatchTeamsStatic(home, away);
                    return '' +
                        '<div class="match-card">' +
                        '<div class="match-head">' +
                        '<span class="status-pill ' + esc(match.status) + '">' + esc(match.status) + '</span>' +
                        '</div>' +
                        teamsHtml +
                        '<p class="muted">Terrain: ' + esc(getTerrainName(state, match.terrainId)) + '</p>' +
                        renderMatchTimerBlock(round, match, state.config.matchDurationSeconds, state.config.pauseDurationSeconds) +
                        buildScoreRow(match, "ko-home", "ko-away", "ko-save", "ko-reopen") +
                        '</div>';
                }).join("") +
                '</div>' +
                '</div>' +
                '</details>';
        }).join("") + '</div>';

        if (state.knockout.thirdPlace) {
            const tp = state.knockout.thirdPlace;
            const home = tp.homeTeamId ? window.TournamentRules.getTeamNameById(state, tp.homeTeamId) : "TBD";
            const away = tp.awayTeamId ? window.TournamentRules.getTeamNameById(state, tp.awayTeamId) : "TBD";
            thirdPlace.innerHTML = '' +
                '<div class="round-card">' +
                '<div class="round-head">' +
                '<h3>Third place</h3>' +
                renderRoundTimerControls(
                    { startedAt: tp.startedAt, stoppedAt: tp.stoppedAt, pausedAt: null, pausedTotalMs: 0 },
                    { startAction: "ko-start-round", stopAction: "ko-stop-round", roundKey: "thirdPlace", matchDurationSeconds: state.config.matchDurationSeconds }
                ) +
                '</div>' +
                '<div class="match-card">' +
                '<div class="match-head">' +
                '<span class="status-pill ' + esc(tp.status) + '">' + esc(tp.status) + '</span>' +
                '</div>' +
                renderMatchTeamsStatic(home, away) +
                '<p class="muted">Terrain: ' + esc(getTerrainName(state, tp.terrainId)) + '</p>' +
                renderMatchTimerBlock({ startedAt: tp.startedAt, pausedAt: null, pausedTotalMs: 0, stoppedAt: tp.stoppedAt }, tp, state.config.matchDurationSeconds, state.config.pauseDurationSeconds) +
                buildScoreRow(tp, "ko-home", "ko-away", "ko-save", "ko-reopen") +
                '</div>' +
                '</div>';
        } else {
            thirdPlace.innerHTML = "";
        }

        if (state.knockout.championTeamId) {
            champion.innerHTML = '<div class="champion-box"><strong>Champion:</strong> ' + esc(window.TournamentRules.getTeamNameById(state, state.knockout.championTeamId)) + "</div>";
        } else {
            champion.innerHTML = '<p class="muted">Champion will appear when final is completed</p>';
        }
    }

    function renderAudit(state) {
        const target = document.getElementById("audit-log");
        if (!state.audit.length) {
            target.innerHTML = '<p class="muted">No actions logged yet</p>';
            return;
        }
        target.innerHTML = '<div class="audit-items">' + state.audit.map((entry) => {
            return '' +
                '<article class="audit-item">' +
                '<time datetime="' + esc(entry.at) + '">' + esc(new Date(entry.at).toLocaleString()) + '</time>' +
                '<div>' + esc(entry.message) + '</div>' +
                '</article>';
        }).join("") + '</div>';
    }

    function renderProgressBar(state) {
        const target = document.getElementById("progress-bar");
        const currentStep = getCurrentWorkflowStep(state);
        const stepsHtml = PROGRESS_STEPS.map((step) => {
            const isCurrent = step.key === currentStep;
            return '<button type="button" class="progress-step' + (isCurrent ? " progress-step--current" : "") + '" data-action="progress-jump" data-target-section="' + esc(step.targetSection) + '">' + esc(step.label) + '</button>';
        }).join("");
        target.innerHTML = '<button type="button" class="progress-back-to-top" data-action="scroll-top" title="Back to top of page" aria-label="Back to top of page"><img src="assets/chevron-double-up.svg" alt=""></button>' + stepsHtml;
    }

    function renderOverview(state) {
        const target = document.getElementById("config-overview");
        const config = state.config;
        const seedingLabel = config.seedingPolicy === "random" ? "Randomized" : "Ranking order";
        target.innerHTML = '<div class="overview-grid">' +
            '<div><span class="text-label">Win / draw / loss</span><strong>' + config.POINT_VICTORY_PHASE1 + " / " + config.POINT_DRAW_PHASE1 + " / " + config.POINT_LOSS_PHASE1 + '</strong></div>' +
            '<div><span class="text-label">Group matches per team</span><strong>' + config.phase1MatchesPerTeam + '</strong></div>' +
            '<div><span class="text-label">Qualified for knockout</span><strong>' + config.qualifiedCount + '</strong></div>' +
            '<div><span class="text-label">Seeding</span><strong>' + esc(seedingLabel) + '</strong></div>' +
            '<div><span class="text-label">Third place match</span><strong>' + (config.thirdPlaceMatch ? "Yes" : "No") + '</strong></div>' +
            '<div><span class="text-label">Match / pause duration</span><strong>' + Math.round(config.matchDurationSeconds / 60) + " min / " + Math.round(config.pauseDurationSeconds / 60) + ' min</strong></div>' +
            '</div>';
    }

    function syncConfigForm(state) {
        document.getElementById("cfg-win").value = state.config.POINT_VICTORY_PHASE1;
        document.getElementById("cfg-draw").value = state.config.POINT_DRAW_PHASE1;
        document.getElementById("cfg-loss").value = state.config.POINT_LOSS_PHASE1;
        document.getElementById("cfg-phase1-matches").value = state.config.phase1MatchesPerTeam;
        document.getElementById("cfg-qualified").value = state.config.qualifiedCount;
        document.getElementById("cfg-seeding").value = state.config.seedingPolicy;
        document.getElementById("cfg-third-place").checked = Boolean(state.config.thirdPlaceMatch);
        document.getElementById("cfg-match-duration").value = Math.round(state.config.matchDurationSeconds / 60);
        document.getElementById("cfg-pause-duration").value = Math.round(state.config.pauseDurationSeconds / 60);
    }

    function handleError(error) {
        const message = error && error.message ? error.message : String(error);
        alert(message);
        console.error(error);
    }

    function getSiblingScoreInput(role, matchId) {
        return document.querySelector('input[data-role="' + role + '"][data-match-id="' + matchId + '"]');
    }

    function getSiblingTeamId(role, matchId) {
        // undefined means "no dropdown rendered, keep whatever team is already stored"
        // null means "dropdown rendered but set to BYE / none"
        const select = document.querySelector('select[data-role="' + role + '"][data-match-id="' + matchId + '"]');
        if (!select) {
            return undefined;
        }
        return select.value || null;
    }

    function applyStageGating(state) {
        const setupLocked = Boolean(state.phase1.generated);
        const phase1AllCompleted = state.phase1.matches.length > 0 &&
            state.phase1.matches.every((match) => match.status === "completed");

        document.getElementById("team-name").disabled = setupLocked;
        document.querySelector("#form-add-team button[type='submit']").disabled = setupLocked;
        document.getElementById("terrain-name").disabled = setupLocked;
        document.querySelector("#form-add-terrain button[type='submit']").disabled = setupLocked;

        document.querySelectorAll("#form-config input, #form-config select").forEach((field) => {
            field.disabled = setupLocked;
        });
        document.querySelector("#form-config button[type='submit']").disabled = setupLocked;

        document.getElementById("btn-generate-phase1").disabled = setupLocked;
        document.getElementById("btn-start-knockout").disabled = !state.phase1.generated || !phase1AllCompleted || state.knockout.generated;
        document.getElementById("btn-back-to-phase1").disabled = !state.knockout.generated;
    }

    function bindEvents() {
        updateSummaryControlButtons();
        bindCollapsibleSections();

        document.getElementById("form-add-team").addEventListener("submit", (event) => {
            event.preventDefault();
            try {
                const input = document.getElementById("team-name");
                window.TournamentActions.addTeam(input.value);
                input.value = "";
            } catch (error) {
                handleError(error);
            }
        });

        document.getElementById("form-add-terrain").addEventListener("submit", (event) => {
            event.preventDefault();
            try {
                const input = document.getElementById("terrain-name");
                window.TournamentActions.addTerrain(input.value);
                input.value = "";
            } catch (error) {
                handleError(error);
            }
        });

        document.getElementById("form-config").addEventListener("submit", (event) => {
            event.preventDefault();
            try {
                window.TournamentActions.updateConfig({
                    POINT_VICTORY_PHASE1: document.getElementById("cfg-win").value,
                    POINT_DRAW_PHASE1: document.getElementById("cfg-draw").value,
                    POINT_LOSS_PHASE1: document.getElementById("cfg-loss").value,
                    phase1MatchesPerTeam: document.getElementById("cfg-phase1-matches").value,
                    qualifiedCount: document.getElementById("cfg-qualified").value,
                    seedingPolicy: document.getElementById("cfg-seeding").value,
                    thirdPlaceMatch: document.getElementById("cfg-third-place").checked,
                    matchDurationSeconds: Number(document.getElementById("cfg-match-duration").value) * 60,
                    pauseDurationSeconds: Number(document.getElementById("cfg-pause-duration").value) * 60
                });
            } catch (error) {
                handleError(error);
            }
        });

        document.getElementById("btn-generate-phase1").addEventListener("click", () => {
            try {
                window.TournamentActions.generatePhase1();
            } catch (error) {
                handleError(error);
            }
        });

        document.getElementById("btn-start-knockout").addEventListener("click", () => {
            try {
                window.TournamentActions.startKnockout();
            } catch (error) {
                handleError(error);
            }
        });

        document.getElementById("btn-back-to-phase1").addEventListener("click", () => {
            const ok = confirm("Clear the knockout bracket and go back to phase 1? Phase 1 scores are kept.");
            if (!ok) {
                return;
            }
            try {
                window.TournamentActions.backToPhase1();
            } catch (error) {
                handleError(error);
            }
        });

        document.getElementById("btn-reset-phases").addEventListener("click", () => {
            const ok = confirm("Reset phase 1 and knockout data while keeping teams and terrains?");
            if (!ok) {
                return;
            }
            try {
                window.TournamentActions.resetPhases();
            } catch (error) {
                handleError(error);
            }
        });

        document.getElementById("btn-toggle-summary-standings").addEventListener("click", () => {
            const nextHidden = !getSummaryPrefs().standingsHidden;
            setSummaryPrefs({ standingsHidden: nextHidden });
            updateSummaryControlButtons();
            window.TournamentState.update(() => {}, nextHidden ? "Hid summary standings" : "Showed summary standings");
        });

        document.getElementById("btn-toggle-summary-scroll").addEventListener("click", () => {
            const nextActive = !getSummaryPrefs().autoScrollActive;
            setSummaryPrefs({ autoScrollActive: nextActive });
            updateSummaryControlButtons();
            window.TournamentState.update(() => {}, nextActive ? "Started summary auto-scroll" : "Stopped summary auto-scroll");
        });

        document.getElementById("btn-export-state").addEventListener("click", () => {
            window.TournamentActions.exportStateToDownload();
        });

        document.getElementById("btn-export-print").addEventListener("click", () => {
            const panel = document.getElementById("export-print-panel");
            panel.hidden = !panel.hidden;
        });

        document.getElementById("btn-export-print-generate").addEventListener("click", () => {
            try {
                generateExport();
            } catch (error) {
                handleError(error);
            }
        });

        const importInput = document.getElementById("import-state-input");
        document.getElementById("btn-import-state").addEventListener("click", () => {
            importInput.click();
        });

        importInput.addEventListener("change", async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }
            try {
                const text = await file.text();
                window.TournamentActions.importStateFromText(text);
                importInput.value = "";
            } catch (error) {
                handleError(error);
            }
        });

        document.getElementById("btn-reset-state").addEventListener("click", () => {
            const ok = confirm("Reset all tournament data?");
            if (!ok) {
                return;
            }
            window.TournamentActions.resetAll();
        });

        document.getElementById("app-root").addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const action = target.getAttribute("data-action");
            if (!action) {
                return;
            }

            if (action === "round-toggle") {
                const details = target.closest("details.round-card");
                if (details) {
                    setRoundOverride(target.getAttribute("data-round-key"), !details.open);
                }
                return;
            }

            if (action === "progress-jump") {
                const sectionId = target.getAttribute("data-target-section");
                // collapse everything first so jumping to a step always leaves a clean,
                // focused view instead of piling on top of whatever was already open
                setAllSectionsOpen(false);
                setSectionOverride(sectionId, true);
                const sectionDetails = document.getElementById("section-" + sectionId);
                if (sectionDetails) {
                    sectionDetails.open = true;
                }
                let scrollTarget = sectionDetails;
                const roundKey = getCurrentRoundKeyForSection(sectionId, window.TournamentState.getState());
                if (roundKey) {
                    setRoundOverride(roundKey, true);
                    const roundSummary = document.querySelector('summary[data-round-key="' + roundKey + '"]');
                    const roundDetails = roundSummary ? roundSummary.closest("details.round-card") : null;
                    if (roundDetails) {
                        roundDetails.open = true;
                        scrollTarget = roundDetails;
                    }
                }
                if (scrollTarget) {
                    scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
                }
                return;
            }

            if (action === "scroll-top") {
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }

            try {
                if (action === "team-remove") {
                    window.TournamentActions.removeTeam(target.getAttribute("data-team-id"));
                    return;
                }

                if (action === "terrain-remove") {
                    window.TournamentActions.removeTerrain(target.getAttribute("data-terrain-id"));
                    return;
                }

                if (action === "phase1-save") {
                    const matchId = target.getAttribute("data-match-id");
                    const homeInput = getSiblingScoreInput("phase1-home", matchId);
                    const awayInput = getSiblingScoreInput("phase1-away", matchId);
                    const homeTeamId = getSiblingTeamId("phase1-home-team", matchId);
                    const awayTeamId = getSiblingTeamId("phase1-away-team", matchId);
                    window.TournamentActions.applyPhase1Score(matchId, homeTeamId, awayTeamId, homeInput ? homeInput.value : "", awayInput ? awayInput.value : "");
                    return;
                }

                if (action === "phase1-reopen") {
                    window.TournamentActions.reopenPhase1Match(target.getAttribute("data-match-id"));
                    return;
                }

                if (action === "ko-save") {
                    const matchId = target.getAttribute("data-match-id");
                    const homeInput = getSiblingScoreInput("ko-home", matchId);
                    const awayInput = getSiblingScoreInput("ko-away", matchId);
                    const homeTeamId = getSiblingTeamId("ko-home-team", matchId);
                    const awayTeamId = getSiblingTeamId("ko-away-team", matchId);
                    window.TournamentActions.applyKnockoutScore(matchId, homeTeamId, awayTeamId, homeInput ? homeInput.value : "", awayInput ? awayInput.value : "");
                    return;
                }

                if (action === "ko-reopen") {
                    window.TournamentActions.reopenKnockoutMatch(target.getAttribute("data-match-id"));
                }

                if (action === "phase1-start-round") {
                    window.TournamentActions.startPhase1RoundTimer(Number(target.getAttribute("data-round-key")));
                    return;
                }

                if (action === "phase1-stop-round") {
                    window.TournamentActions.stopPhase1RoundTimer(Number(target.getAttribute("data-round-key")));
                    return;
                }

                if (action === "ko-start-round") {
                    window.TournamentActions.startKnockoutRoundTimer(target.getAttribute("data-round-key"));
                    return;
                }

                if (action === "ko-stop-round") {
                    window.TournamentActions.stopKnockoutRoundTimer(target.getAttribute("data-round-key"));
                    return;
                }

                if (action === "phase1-pause-round") {
                    window.TournamentActions.pausePhase1RoundTimer(Number(target.getAttribute("data-round-key")));
                    return;
                }

                if (action === "phase1-resume-round") {
                    window.TournamentActions.resumePhase1RoundTimer(Number(target.getAttribute("data-round-key")));
                    return;
                }

                if (action === "ko-pause-round") {
                    window.TournamentActions.pauseKnockoutRoundTimer(target.getAttribute("data-round-key"));
                    return;
                }

                if (action === "ko-resume-round") {
                    window.TournamentActions.resumeKnockoutRoundTimer(target.getAttribute("data-round-key"));
                    return;
                }

                if (action === "match-pause") {
                    window.TournamentActions.pauseMatchTimer(target.getAttribute("data-match-id"));
                    return;
                }

                if (action === "match-resume") {
                    window.TournamentActions.resumeMatchTimer(target.getAttribute("data-match-id"));
                }
            } catch (error) {
                handleError(error);
            }
        });
    }

    function renderApp(state) {
        syncConfigForm(state);
        renderProgressBar(state);
        renderOverview(state);
        renderTeams(state);
        renderTerrains(state);
        renderPhase1(state);
        renderStandings(state);
        renderKnockout(state);
        renderAudit(state);
        applyStageGating(state);
        applyCollapsibleSections(state);
    }

    window.TournamentRender = {
        bindEvents: bindEvents,
        renderApp: renderApp,
        tickTimers: tickTimers
    };
})();

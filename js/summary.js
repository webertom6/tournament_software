(function () {
    const STORAGE_KEY = "tournament_software_state_v1";

    function esc(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function loadState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.error("Cannot parse tournament state:", error);
            return null;
        }
    }

    function getTeamName(state, teamId) {
        const team = (state.teams || []).find((item) => item.id === teamId);
        return team ? team.name : "TBD";
    }

    function getTerrainName(state, terrainId) {
        const terrain = (state.terrains || []).find((item) => item.id === terrainId);
        return terrain ? terrain.name : "No terrain";
    }

    function renderMatchScoreLine(match) {
        if (match.status !== "completed") {
            return '<p class="muted">Status: upcoming</p>';
        }
        const home = Number.isFinite(match.homeGoals) ? match.homeGoals : 0;
        const away = Number.isFinite(match.awayGoals) ? match.awayGoals : 0;
        return '<p><strong>Score: ' + home + " - " + away + '</strong></p>';
    }

    function renderMatchTimerLine(roundStartedAt, match, matchDurationSeconds, pauseDurationSeconds) {
        const timer = window.TournamentTimer;
        if (match.finalElapsedMs !== null && match.finalElapsedMs !== undefined) {
            return '<p class="muted">Time: ' + esc(timer.formatDuration(match.finalElapsedMs)) + ' (final)</p>';
        }
        if (!roundStartedAt) {
            return "";
        }
        const now = Date.now();
        const elapsed = timer.computeElapsedMs(roundStartedAt, match, now);
        const remaining = Number(matchDurationSeconds) * 1000 - elapsed;
        if (match.pausedAt) {
            const breakRemaining = timer.computeBreakRemainingMs(match, pauseDurationSeconds, now);
            return '<p class="muted">Time left: ' + esc(timer.formatCountdown(remaining)) + " - Paused (break " + esc(timer.formatDuration(breakRemaining)) + ')</p>';
        }
        return '<p class="muted">Time left: ' + esc(timer.formatCountdown(remaining)) + '</p>';
    }

    function renderPhase1(state) {
        const target = document.getElementById("summary-phase1");
        if (!state || !state.phase1 || !state.phase1.generated) {
            target.innerHTML = '<p class="summary-empty">Phase 1 is not generated yet</p>';
            return;
        }

        const allMatches = state.phase1.matches || [];
        if (!allMatches.length) {
            target.innerHTML = '<p class="summary-empty">No phase 1 matches</p>';
            return;
        }

        const byRound = new Map();
        allMatches.forEach((match) => {
            const key = String(match.roundIndex);
            if (!byRound.has(key)) {
                byRound.set(key, []);
            }
            byRound.get(key).push(match);
        });

        const rounds = Array.from(byRound.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
        target.innerHTML = '<div class="summary-round-grid">' + rounds.map((entry) => {
            const roundIndex = Number(entry[0]);
            const matches = entry[1];
            return '' +
                '<div class="summary-round">' +
                '<h3>Round ' + (roundIndex + 1) + '</h3>' +
                matches.map((match) => {
                    const home = getTeamName(state, match.homeTeamId);
                    const away = getTeamName(state, match.awayTeamId);
                    const roundStartedAt = (state.phase1.roundTimers || {})[String(match.roundIndex)] ?
                        (state.phase1.roundTimers || {})[String(match.roundIndex)].startedAt : null;
                    return '' +
                        '<article class="summary-match">' +
                        '<p><strong>' + esc(home) + " vs " + esc(away) + '</strong></p>' +
                        renderMatchScoreLine(match) +
                        renderMatchTimerLine(roundStartedAt, match, (state.config || {}).matchDurationSeconds, (state.config || {}).pauseDurationSeconds) +
                        '<p class="muted">Terrain: ' + esc(getTerrainName(state, match.terrainId)) + '</p>' +
                        '</article>';
                }).join("") +
                '</div>';
        }).join("") + '</div>';
    }

    function renderKnockout(state) {
        const target = document.getElementById("summary-knockout");
        if (!state || !state.knockout || !state.knockout.generated) {
            target.innerHTML = '<p class="summary-empty">Knockout phase is not generated yet</p>';
            return;
        }

        const roundBlocks = [];
        (state.knockout.rounds || []).forEach((round) => {
            const matches = (round.matches || []).filter((match) => {
                return match.homeTeamId && match.awayTeamId;
            });
            if (!matches.length) {
                return;
            }
            roundBlocks.push({
                name: round.name || ("Round " + (Number(round.roundIndex || 0) + 1)),
                startedAt: round.startedAt,
                matches: matches
            });
        });

        if (state.knockout.thirdPlace &&
            state.knockout.thirdPlace.homeTeamId &&
            state.knockout.thirdPlace.awayTeamId) {
            roundBlocks.push({
                name: "Third place",
                startedAt: state.knockout.thirdPlace.startedAt,
                matches: [state.knockout.thirdPlace]
            });
        }

        if (!roundBlocks.length) {
            target.innerHTML = '<p class="summary-empty">No upcoming knockout matches</p>';
            return;
        }

        target.innerHTML = '<div class="summary-round-grid">' + roundBlocks.map((round) => {
            return '' +
                '<div class="summary-round">' +
                '<h3>' + esc(round.name) + '</h3>' +
                round.matches.map((match) => {
                    const home = getTeamName(state, match.homeTeamId);
                    const away = getTeamName(state, match.awayTeamId);
                    return '' +
                        '<article class="summary-match">' +
                        '<p><strong>' + esc(home) + " vs " + esc(away) + '</strong></p>' +
                        renderMatchScoreLine(match) +
                        renderMatchTimerLine(round.startedAt, match, (state.config || {}).matchDurationSeconds, (state.config || {}).pauseDurationSeconds) +
                        '</article>';
                }).join("") +
                '</div>';
        }).join("") + '</div>';
    }

    function renderSummary() {
        const state = loadState();
        renderPhase1(state);
        renderKnockout(state);
        const timestamp = new Date().toLocaleString();
        document.getElementById("summary-last-update").textContent = "Last refresh: " + timestamp;
    }

    window.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY) {
            renderSummary();
        }
    });

    setInterval(renderSummary, 1000);
    renderSummary();
})();

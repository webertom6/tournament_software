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
            return { sections: (parsed.sections && typeof parsed.sections === "object") ? parsed.sections : {} };
        } catch (error) {
            return { sections: {} };
        }
    }

    function setSectionOverride(sectionId, isOpen) {
        const prefs = getOperatorUiPrefs();
        prefs.sections[sectionId] = isOpen;
        localStorage.setItem(OPERATOR_UI_PREFS_KEY, JSON.stringify(prefs));
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
            target.innerHTML = '<p class="muted">No terrains yet, matches will still be generated</p>';
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

    function buildTeamSelect(state, role, matchId, currentTeamId, otherTeamId, allowEmpty) {
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
        return '<select data-role="' + role + '" data-match-id="' + esc(matchId) + '" aria-label="' + role + '">' + options.join("") + '</select>';
    }

    function renderRoundTimerControls(startedAt, stoppedAt, startAction, stopAction, roundKey) {
        if (!startedAt) {
            return '<div class="round-timer-controls">' +
                '<button type="button" data-action="' + esc(startAction) + '" data-round-key="' + esc(roundKey) + '">Start round timer</button>' +
                '</div>';
        }
        if (stoppedAt) {
            return '<div class="round-timer-controls">' +
                '<span class="muted">Round timer stopped at:</span> ' +
                '<span class="round-clock" data-role="round-clock">' + esc(window.TournamentTimer.formatDuration(stoppedAt - startedAt)) + '</span>' +
                '</div>';
        }
        return '<div class="round-timer-controls">' +
            '<span class="muted">Round timer:</span> ' +
            '<span class="round-clock" data-role="round-clock" data-started-at="' + startedAt + '">' +
            esc(window.TournamentTimer.formatDuration(Date.now() - startedAt)) +
            '</span>' +
            '<button type="button" class="timer-action" data-action="' + esc(stopAction) + '" data-round-key="' + esc(roundKey) + '">Stop round timer</button>' +
            '</div>';
    }

    function renderMatchTimerBlock(roundStartedAt, match, matchDurationSeconds, pauseDurationSeconds) {
        const timer = window.TournamentTimer;
        const now = Date.now();

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
        const clockAttrs = 'data-started-at="' + roundStartedAt + '" data-paused-total-ms="' + pausedTotalMs +
            '" data-match-duration-ms="' + matchDurationMs + '"' + pausedAttr;
        const elapsed = timer.computeElapsedMs(roundStartedAt, match, now);
        const remaining = matchDurationMs - elapsed;
        const overtimeClass = remaining < 0 ? " overtime" : "";
        const clockHtml = '<span class="match-clock' + overtimeClass + '" data-role="match-clock" ' + clockAttrs + '>' + esc(timer.formatCountdown(remaining)) + '</span>';

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
            const pausedAtRaw = el.getAttribute("data-paused-at");
            const activeEnd = pausedAtRaw ? Number(pausedAtRaw) : now;
            const elapsed = Math.max(0, activeEnd - startedAt - pausedTotalMs);
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
            el.textContent = timer.formatDuration(now - startedAt);
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
        target.innerHTML = '<div class="round-grid">' + rounds.map((entry) => {
            const roundIndex = Number(entry[0]);
            const matches = entry[1];
            const roundTimer = state.phase1.roundTimers[String(roundIndex)] || null;
            const roundStartedAt = roundTimer ? roundTimer.startedAt : null;
            const roundStoppedAt = roundTimer ? roundTimer.stoppedAt : null;
            return '' +
                '<div class="round-card">' +
                '<div class="round-head">' +
                '<h3>Round ' + (roundIndex + 1) + '</h3>' +
                renderRoundTimerControls(roundStartedAt, roundStoppedAt, "phase1-start-round", "phase1-stop-round", String(roundIndex)) +
                '</div>' +
                matches.map((match) => {
                    return '' +
                        '<div class="match-card">' +
                        '<div class="match-head">' +
                        '<span class="status-pill ' + esc(match.status) + '">' + esc(match.status) + '</span>' +
                        '</div>' +
                        '<p class="muted">Terrain: ' + esc(getTerrainName(state, match.terrainId)) + '</p>' +
                        '<div class="match-teams">' +
                        buildTeamSelect(state, "phase1-home-team", match.id, match.homeTeamId, match.awayTeamId, false) +
                        '<span class="vs-label">vs</span>' +
                        buildTeamSelect(state, "phase1-away-team", match.id, match.awayTeamId, match.homeTeamId, false) +
                        '</div>' +
                        renderMatchTimerBlock(roundStartedAt, match, state.config.matchDurationSeconds, state.config.pauseDurationSeconds) +
                        '<div class="match-row">' +
                        '<input type="number" min="0" step="1" data-role="phase1-home" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.homeGoals) ? match.homeGoals : "") + '" placeholder="Home goals" aria-label="Home goals">' +
                        '<input type="number" min="0" step="1" data-role="phase1-away" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.awayGoals) ? match.awayGoals : "") + '" placeholder="Away goals" aria-label="Away goals">' +
                        '<button type="button" data-action="phase1-save" data-match-id="' + esc(match.id) + '">Save score</button>' +
                        '<button type="button" class="reopen" data-action="phase1-reopen" data-match-id="' + esc(match.id) + '">Reopen</button>' +
                        '</div>' +
                        '</div>';
                }).join("") +
                '</div>';
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
        target.innerHTML =
            '<p class="muted">Qualified for knockout: top ' + normalizedQualified + " teams</p>" +
            "<table>" +
            "<thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Last</th><th>Best</th><th>Pts</th></tr></thead>" +
            "<tbody>" +
            standings.map((row, index) => {
                const isQualified = index < normalizedQualified;
                return '' +
                    "<tr>" +
                    "<td>" + row.rank + "</td>" +
                    "<td>" + esc(row.teamName) + (isQualified ? ' <span class="status-pill completed">Q</span>' : "") + "</td>" +
                    "<td>" + row.played + "</td>" +
                    "<td>" + row.wins + "</td>" +
                    "<td>" + row.draws + "</td>" +
                    "<td>" + row.losses + "</td>" +
                    "<td>" + row.gf + "</td>" +
                    "<td>" + row.ga + "</td>" +
                    "<td>" + row.gd + "</td>" +
                    "<td>" + (row.lastScore === null ? "-" : row.lastScore) + "</td>" +
                    "<td>" + row.bestScore + "</td>" +
                    "<td><strong>" + row.points + "</strong></td>" +
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

        roundsTarget.innerHTML = '<div class="round-grid">' + state.knockout.rounds.map((round) => {
            return '' +
                '<div class="round-card">' +
                '<div class="round-head">' +
                '<h3>' + esc(round.name) + '</h3>' +
                renderRoundTimerControls(round.startedAt, round.stoppedAt, "ko-start-round", "ko-stop-round", round.id) +
                '</div>' +
                round.matches.map((match) => {
                    const isFirstRound = !match.homeSourceMatchId && !match.awaySourceMatchId;
                    const home = match.homeTeamId ? window.TournamentRules.getTeamNameById(state, match.homeTeamId) : "TBD";
                    const away = match.awayTeamId ? window.TournamentRules.getTeamNameById(state, match.awayTeamId) : "TBD";
                    const teamsHtml = isFirstRound ?
                        '<div class="match-teams">' +
                        buildTeamSelect(state, "ko-home-team", match.id, match.homeTeamId, match.awayTeamId, true) +
                        '<span class="vs-label">vs</span>' +
                        buildTeamSelect(state, "ko-away-team", match.id, match.awayTeamId, match.homeTeamId, true) +
                        '</div>' :
                        '<div class="match-head"><span>' + esc(home) + " vs " + esc(away) + '</span></div>';
                    return '' +
                        '<div class="match-card">' +
                        '<div class="match-head">' +
                        '<span class="status-pill ' + esc(match.status) + '">' + esc(match.status) + '</span>' +
                        '</div>' +
                        teamsHtml +
                        '<p class="muted">Terrain: ' + esc(getTerrainName(state, match.terrainId)) + '</p>' +
                        renderMatchTimerBlock(round.startedAt, match, state.config.matchDurationSeconds, state.config.pauseDurationSeconds) +
                        '<div class="match-row">' +
                        '<input type="number" min="0" step="1" data-role="ko-home" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.homeGoals) ? match.homeGoals : "") + '" placeholder="Home goals" aria-label="Home goals">' +
                        '<input type="number" min="0" step="1" data-role="ko-away" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.awayGoals) ? match.awayGoals : "") + '" placeholder="Away goals" aria-label="Away goals">' +
                        '<button type="button" data-action="ko-save" data-match-id="' + esc(match.id) + '">Save score</button>' +
                        '<button type="button" class="reopen" data-action="ko-reopen" data-match-id="' + esc(match.id) + '">Reopen</button>' +
                        '</div>' +
                        '</div>';
                }).join("") +
                '</div>';
        }).join("") + '</div>';

        if (state.knockout.thirdPlace) {
            const tp = state.knockout.thirdPlace;
            const home = tp.homeTeamId ? window.TournamentRules.getTeamNameById(state, tp.homeTeamId) : "TBD";
            const away = tp.awayTeamId ? window.TournamentRules.getTeamNameById(state, tp.awayTeamId) : "TBD";
            thirdPlace.innerHTML = '' +
                '<div class="round-card">' +
                '<div class="round-head">' +
                '<h3>Third place</h3>' +
                renderRoundTimerControls(tp.startedAt, tp.stoppedAt, "ko-start-round", "ko-stop-round", "thirdPlace") +
                '</div>' +
                '<div class="match-card">' +
                '<div class="match-head">' +
                '<span>' + esc(home) + " vs " + esc(away) + '</span>' +
                '<span class="status-pill ' + esc(tp.status) + '">' + esc(tp.status) + '</span>' +
                '</div>' +
                '<p class="muted">Terrain: ' + esc(getTerrainName(state, tp.terrainId)) + '</p>' +
                renderMatchTimerBlock(tp.startedAt, tp, state.config.matchDurationSeconds, state.config.pauseDurationSeconds) +
                '<div class="match-row">' +
                '<input type="number" min="0" step="1" data-role="ko-home" data-match-id="' + esc(tp.id) + '" value="' + (Number.isFinite(tp.homeGoals) ? tp.homeGoals : "") + '" placeholder="Home goals" aria-label="Home goals">' +
                '<input type="number" min="0" step="1" data-role="ko-away" data-match-id="' + esc(tp.id) + '" value="' + (Number.isFinite(tp.awayGoals) ? tp.awayGoals : "") + '" placeholder="Away goals" aria-label="Away goals">' +
                '<button type="button" data-action="ko-save" data-match-id="' + esc(tp.id) + '">Save score</button>' +
                '<button type="button" class="reopen" data-action="ko-reopen" data-match-id="' + esc(tp.id) + '">Reopen</button>' +
                '</div>' +
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

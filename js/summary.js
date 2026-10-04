(function () {
    const STORAGE_KEY = "tournament_software_state_v1";
    const STANDINGS_SPLIT_THRESHOLD = 100;

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
            return "";
        }
        const home = Number.isFinite(match.homeGoals) ? match.homeGoals : 0;
        const away = Number.isFinite(match.awayGoals) ? match.awayGoals : 0;
        return '<p>Score: <strong class="text-mono">' + home + " - " + away + '</strong></p>';
    }

    // terrain only matters before the score is in - once saved, the score is the only thing worth a glance
    function renderTerrainLine(state, match) {
        if (match.status === "completed") {
            return "";
        }
        return '<p class="summary-terrain"> Terrain: ' + esc(getTerrainName(state, match.terrainId)) + '</p>';
    }

    function getStageLabel(state) {
        if (!state) {
            return "No data";
        }
        if (state.knockout && state.knockout.championTeamId) {
            return "Champion crowned";
        }
        if (state.knockout && state.knockout.generated) {
            return "Knockout";
        }
        if (state.phase1 && state.phase1.generated) {
            return "Phase 1";
        }
        return "Setup";
    }

    function getStageKey(state) {
        if (!state) {
            return "setup";
        }
        if (state.knockout && (state.knockout.generated || state.knockout.championTeamId)) {
            return "knockout";
        }
        if (state.phase1 && state.phase1.generated) {
            return "phase1";
        }
        return "setup";
    }

    function getCurrentPhase1RoundIndex(state) {
        const matches = (state.phase1 && state.phase1.matches) || [];
        if (!matches.length) {
            return 0;
        }
        let maxRound = 0;
        matches.forEach((match) => {
            maxRound = Math.max(maxRound, match.roundIndex);
        });
        for (let roundIndex = 0; roundIndex <= maxRound; roundIndex += 1) {
            const roundMatches = matches.filter((match) => match.roundIndex === roundIndex);
            if (roundMatches.some((match) => match.status !== "completed")) {
                return roundIndex;
            }
        }
        return maxRound;
    }

    function getPhase1TotalRounds(state) {
        const matches = (state.phase1 && state.phase1.matches) || [];
        let maxRound = 0;
        matches.forEach((match) => {
            maxRound = Math.max(maxRound, match.roundIndex);
        });
        return maxRound + 1;
    }

    function getCurrentKnockoutRoundIndex(state) {
        const rounds = (state.knockout && state.knockout.rounds) || [];
        for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
            const hasPlayable = rounds[roundIndex].matches.some((match) => {
                return match.homeTeamId && match.awayTeamId && match.status !== "completed";
            });
            if (hasPlayable) {
                return roundIndex;
            }
        }
        return Math.max(0, rounds.length - 1);
    }

    // bracket.js only names the last 3 rounds (Quarterfinal/Semifinal/Final); earlier
    // rounds keep a generic stored name, so derive "Round of N" from the round's own match count
    function getKnockoutRoundLabel(round) {
        if (!round) {
            return "-";
        }
        if (round.name === "Quarterfinal" || round.name === "Semifinal" || round.name === "Final") {
            return round.name;
        }
        return "Round of " + (round.matches.length * 2);
    }

    // only one round is ever live at a time, so the header shows a single round-level
    // clock even though matches carry their own pause state for scheduling flexibility
    function getCurrentRoundInfo(state, stage) {
        if (stage === "setup") {
            return {
                label: "Setup",
                startedAt: null,
                stoppedAt: null,
                pausedAt: null,
                pausedTotalMs: 0
            };
        }
        if (stage === "phase1") {
            const currentRoundIndex = getCurrentPhase1RoundIndex(state);
            const roundTimer = (state.phase1.roundTimers || {})[String(currentRoundIndex)];
            return {
                label: "Round " + (currentRoundIndex + 1) + "/" + getPhase1TotalRounds(state),
                startedAt: roundTimer ? roundTimer.startedAt : null,
                stoppedAt: roundTimer ? (roundTimer.stoppedAt || null) : null,
                pausedAt: roundTimer ? (roundTimer.pausedAt || null) : null,
                pausedTotalMs: roundTimer ? (roundTimer.pausedTotalMs || 0) : 0
            };
        }
        if (stage === "knockout") {
            const rounds = (state.knockout && state.knockout.rounds) || [];
            const round = rounds[getCurrentKnockoutRoundIndex(state)];
            return {
                label: getKnockoutRoundLabel(round),
                startedAt: round ? round.startedAt : null,
                stoppedAt: round ? (round.stoppedAt || null) : null,
                pausedAt: round ? (round.pausedAt || null) : null,
                pausedTotalMs: round ? (round.pausedTotalMs || 0) : 0
            };
        }
        return { label: "-", startedAt: null, stoppedAt: null, pausedAt: null, pausedTotalMs: 0 };
    }

    function renderHeader(state) {
        const stage = getStageKey(state);
        document.getElementById("summary-stage-pill").textContent = getStageLabel(state);

        const roundInfo = state ? getCurrentRoundInfo(state, stage) : { label: "-", startedAt: null, stoppedAt: null, pausedAt: null, pausedTotalMs: 0 };
        document.getElementById("summary-clock-label").textContent = roundInfo.label;

        const matchDurationSeconds = state ? (state.config || {}).matchDurationSeconds : null;
        let clockText = "waiting";
        if (roundInfo.startedAt && Number.isFinite(Number(matchDurationSeconds))) {
            // same formula as the operator page's round countdown (js/timer.js) - never reimplement
            // this inline, that's how the two pages drifted apart before (round-label casing bug)
            // a stopped round timer must freeze at stoppedAt, not keep computing against Date.now()
            // forever (that produced a nonsensical, ever-growing overtime for long-finished rounds)
            const atTime = roundInfo.stoppedAt || Date.now();
            const elapsed = window.TournamentTimer.computeRoundElapsedMs(roundInfo.startedAt, roundInfo.pausedAt, roundInfo.pausedTotalMs, atTime);
            const remaining = Number(matchDurationSeconds) * 1000 - elapsed;
            clockText = window.TournamentTimer.formatCountdown(remaining);
        }
        document.querySelectorAll(".js-round-clock").forEach(function (el) {
            el.textContent = clockText;
        });

        const teamCount = state ? (state.teams || []).length : 0;
        const terrainCount = state ? (state.terrains || []).length : 0;
        document.getElementById("summary-meta").textContent = teamCount + " teams - " + terrainCount + " terrains";
    }

    function getStandingsColumnCount(teamCount) {
        if (teamCount > 80) {
            return 3;
        }
        if (teamCount > STANDINGS_SPLIT_THRESHOLD) {
            return 2;
        }
        return 1;
    }

    function chunkStandings(standings, columns) {
        const perColumn = Math.ceil(standings.length / columns);
        const chunks = [];
        for (let index = 0; index < columns; index += 1) {
            const chunk = standings.slice(index * perColumn, (index + 1) * perColumn);
            if (chunk.length) {
                chunks.push(chunk);
            }
        }
        return chunks;
    }

    function renderStandingsTable(rows, qualifiedCount, bestValues) {
        return '<table class="standings-table">' +
            "<thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GT</th><th>GC</th><th>GA</th><th>GD</th><th>Last</th><th>Best</th><th>Pts</th></tr></thead>" +
            "<tbody>" +
            rows.map((row) => {
                const isQualified = row.rank <= qualifiedCount;
                const cell = (value, key, classes) => {
                    const isBest = bestValues[key] !== null && row[key] === bestValues[key];
                    return '<td class="' + classes + (isBest ? " stat-best" : "") + '">' + value + "</td>";
                };
                return '' +
                    "<tr>" +
                    '<td class="rank text-mono' + (isQualified ? " standings-qualified" : "") + '">' + row.rank + "</td>" +
                    "<td" + (isQualified ? ' class="standings-qualified"' : "") + ">" + esc(row.teamName) + "</td>" +
                    "<td>" + row.played + "</td>" +
                    cell(row.wins, "wins", "text-mono") +
                    '<td class="text-mono">' + row.draws + "</td>" +
                    cell(row.losses, "losses", "text-mono") +
                    cell(row.gt, "gt", "text-mono") +
                    cell(row.gc, "gc", "text-mono") +
                    cell(row.ga.toFixed(2), "ga", "text-mono") +
                    cell(row.gd, "gd", "text-mono") +
                    cell(row.lastScore === null ? "-" : row.lastScore, "lastScore", "text-mono") +
                    cell(row.bestScore, "bestScore", "text-mono") +
                    '<td class="text-mono' + (bestValues.points !== null && row.points === bestValues.points ? " stat-best" : "") + '"><strong>' + row.points + "</strong></td>" +
                    "</tr>";
            }).join("") +
            "</tbody></table>";
    }

    function renderStandings(state) {
        const target = document.getElementById("summary-standings");
        const previousScrollPositions = Array.from(
            target.querySelectorAll(".standings-columns .table-wrap"),
            (tableWrap) => tableWrap.scrollLeft
        );
        if (!state || !state.phase1 || !state.phase1.generated) {
            target.innerHTML = '<p class="summary-empty">Standings not available yet</p>';
            return;
        }

        const standings = window.TournamentRules.buildStandings(state);
        if (!standings.length) {
            target.innerHTML = '<p class="summary-empty">No standings yet</p>';
            return;
        }

        const configuredCount = Number(state.config.qualifiedCount);
        const qualifiedCounts = window.TournamentBracket.getAllowedQualifiedCounts(state.teams.length);
        const qualifiedCount = qualifiedCounts.includes(configuredCount) ? configuredCount : 0;
        const bestValues = window.TournamentRules.getStandingsBestValues(standings);
        const columnCount = getStandingsColumnCount(standings.length);
        const columns = chunkStandings(standings, columnCount);

        target.innerHTML = (qualifiedCount ? "" :
            '<p class="summary-empty">Knockout qualification is invalid for the registered team count</p>') +
            '<div class="standings-columns">' +
            columns.map((rows) => '<div class="table-wrap">' + renderStandingsTable(rows, qualifiedCount, bestValues) + '</div>').join("") +
            '</div>';
        target.querySelectorAll(".standings-columns .table-wrap").forEach((tableWrap, index) => {
            tableWrap.scrollLeft = previousScrollPositions[index] || 0;
        });
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

        const currentRoundIndex = getCurrentPhase1RoundIndex(state);
        let maxRoundIndex = 0;
        allMatches.forEach((match) => {
            maxRoundIndex = Math.max(maxRoundIndex, match.roundIndex);
        });

        const roundBlocks = [];
        for (let roundIndex = 0; roundIndex <= maxRoundIndex; roundIndex += 1) {
            const matches = allMatches.filter((match) => match.roundIndex === roundIndex);
            const isCompleted = matches.every((match) => match.status === "completed");
            const isCurrent = !isCompleted && roundIndex === currentRoundIndex;
            const statusKey = isCompleted ? "completed" : (isCurrent ? "current" : "upcoming");
            const statusLabel = isCompleted ? "Completed" : (isCurrent ? "In progress" : "Upcoming");
            roundBlocks.push('' +
                '<section class="summary-round-block summary-round-block--' + statusKey + '">' +
                '<div class="summary-round-block-head">' +
                '<h3 class="text-display">Round ' + (roundIndex + 1) + '</h3>' +
                '<span class="summary-round-status ' + statusKey + '">' + statusLabel + '</span>' +
                '</div>' +
                '<div class="summary-round-grid">' +
                matches.map((match) => {
                    const home = getTeamName(state, match.homeTeamId);
                    const away = getTeamName(state, match.awayTeamId);
                    return '' +
                        '<article class="summary-match">' +
                        '<p><strong>' + esc(home) + " vs " + esc(away) + '</strong></p>' +
                        renderMatchScoreLine(match) +
                        renderTerrainLine(state, match) +
                        '</article>';
                }).join("") +
                '</div>' +
                '</section>');
        }

        target.innerHTML = '<div class="summary-phase1-rounds">' + roundBlocks.join("") + '</div>';
    }

    function renderTeamsSetup(state) {
        const target = document.getElementById("summary-teams-setup");
        const teams = state ? (state.teams || []) : [];
        if (!teams.length) {
            target.innerHTML = '<p class="summary-empty">No teams registered yet</p>';
            return;
        }
        target.innerHTML = '<div class="teams-setup-grid">' +
            teams.map((team) => '<span class="team-chip text-display">' + esc(team.name) + '</span>').join("") +
            '</div>';
    }

    let lastScrolledKnockoutRound = null;

    function renderBracketMatch(state, match) {
        if (match.isBye) {
            const teamId = match.homeTeamId || match.awayTeamId;
            const team = teamId ? getTeamName(state, teamId) : "Waiting for winner";
            const message = match.status === "completed" ? "Advances to next round" : "Waiting for previous round";
            return '<p class="bracket-team" title="' + esc(team) + '">' + esc(team) + '</p>' +
                '<p class="muted">Bye - ' + esc(message) + '</p>';
        }
        const home = match.homeTeamId ? getTeamName(state, match.homeTeamId) : "TBD";
        const away = match.awayTeamId ? getTeamName(state, match.awayTeamId) : "TBD";
        const scoreLine = match.status === "completed" ?
            '<p class="text-mono">' + (Number.isFinite(match.homeGoals) ? match.homeGoals : 0) + " - " + (Number.isFinite(match.awayGoals) ? match.awayGoals : 0) + '</p>' :
            '<p class="muted">vs</p>';
        return '<p class="bracket-team" title="' + esc(home) + '">' + esc(home) + '</p>' +
            scoreLine +
            '<p class="bracket-team" title="' + esc(away) + '">' + esc(away) + '</p>' +
            renderTerrainLine(state, match);
    }

    // measured worst-case (pre-score, terrain chip shown) match-box height + a visible
    // gap, per breakpoint - must stay taller than the actual rendered box or boxes
    // touch/overlap in the densest round (row-doubling math itself is unaffected by
    // this value, it only scales the container's total pixel height)
    function getBracketRowHeight() {
        return window.matchMedia("(min-width: 2560px)").matches ? 190 : 145;
    }

    // sized so every bracket-match column fits the longest registered team name without
    // truncating - measured via canvas instead of the DOM so it doesn't depend on layout
    let bracketMeasureCanvas = null;
    function measureLongestTeamNameWidth(state) {
        if (!bracketMeasureCanvas) {
            bracketMeasureCanvas = document.createElement("canvas");
        }
        const ctx = bracketMeasureCanvas.getContext("2d");
        ctx.font = "600 1.05rem Barlow, system-ui, sans-serif";
        let max = 0;
        (state.teams || []).forEach((team) => {
            const width = ctx.measureText(team.name || "").width;
            if (width > max) {
                max = width;
            }
        });
        return max;
    }

    function getBracketColumnWidth(state) {
        const MATCH_CARD_PADDING = 22; // .bracket-match padding, both sides
        const MIN_WIDTH = 200;
        return Math.max(MIN_WIDTH, Math.ceil(measureLongestTeamNameWidth(state)) + MATCH_CARD_PADDING);
    }

    function renderChampion(state) {
        const target = document.getElementById("summary-champion");
        if (state && state.knockout && state.knockout.championTeamId) {
            target.innerHTML = '<div class="bracket-champion text-display">Champion: ' + esc(getTeamName(state, state.knockout.championTeamId)) + '</div>';
        } else {
            target.innerHTML = "";
        }
    }

    function renderBracket(state) {
        const target = document.getElementById("summary-bracket");
        if (!state || !state.knockout || !state.knockout.generated) {
            lastScrolledKnockoutRound = null;
            target.innerHTML = '<p class="summary-empty">Knockout phase is not generated yet</p>';
            return;
        }

        const rounds = state.knockout.rounds || [];
        if (!rounds.length) {
            lastScrolledKnockoutRound = null;
            target.innerHTML = '<p class="summary-empty">No knockout rounds</p>';
            return;
        }

        const leafCount = rounds[0].matches.length;
        const bodyHeight = leafCount * getBracketRowHeight();
        const currentRoundIndex = getCurrentKnockoutRoundIndex(state);
        const columnWidth = getBracketColumnWidth(state);
        const TREE_GAP = 40; // px, matches .bracket-tree's 2.5rem gap
        const titleColumnWidth = columnWidth + TREE_GAP;
        const roundCenters = [rounds[0].matches.map((match, index) => ((index + 0.5) / leafCount) * 100)];

        for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
            const previousRound = rounds[roundIndex - 1];
            const previousCenters = roundCenters[roundIndex - 1];
            const previousIndexes = new Map(previousRound.matches.map((match, index) => [match.id, index]));
            roundCenters.push(rounds[roundIndex].matches.map((match, index) => {
                const sourceIndexes = [match.homeSourceMatchId, match.awaySourceMatchId]
                    .filter(Boolean)
                    .map((sourceId) => previousIndexes.get(sourceId))
                    .filter((sourceIndex) => sourceIndex !== undefined);
                if (!sourceIndexes.length) {
                    return ((index + 0.5) / rounds[roundIndex].matches.length) * 100;
                }
                return sourceIndexes.reduce((total, sourceIndex) => total + previousCenters[sourceIndex], 0) / sourceIndexes.length;
            }));
        }

        const roundColumns = rounds.map((round, roundIndex) => {
            const isCurrent = roundIndex === currentRoundIndex;
            const isLast = roundIndex === rounds.length - 1;
            const centers = roundCenters[roundIndex];
            const centerOf = (index) => centers[index];

            const matchesHtml = round.matches.map((match, k) => {
                return '<div class="bracket-match" style="top:' + centerOf(k) + '%">' + renderBracketMatch(state, match) + '</div>';
            }).join("");

            let connectorsHtml = "";
            if (!isLast) {
                const nextRound = rounds[roundIndex + 1];
                const currentIndexes = new Map(round.matches.map((match, index) => [match.id, index]));
                nextRound.matches.forEach((nextMatch, nextIndex) => {
                    const sourceCenters = [nextMatch.homeSourceMatchId, nextMatch.awaySourceMatchId]
                        .filter(Boolean)
                        .map((sourceId) => currentIndexes.get(sourceId))
                        .filter((sourceIndex) => sourceIndex !== undefined)
                        .map(centerOf);
                    if (!sourceCenters.length) {
                        return;
                    }
                    const targetCenter = roundCenters[roundIndex + 1][nextIndex];
                    const top = Math.min(targetCenter, ...sourceCenters);
                    const bottom = Math.max(targetCenter, ...sourceCenters);
                    connectorsHtml += '<div class="bracket-connector" style="top:' + top + '%; height:' + (bottom - top) + '%"></div>';
                    connectorsHtml += '<div class="bracket-connector-tick" style="top:' + targetCenter + '%"></div>';
                });
            }

            return '<div class="bracket-round' + (isCurrent ? " bracket-round--current" : "") + '" data-round-index="' + roundIndex + '" style="width:' + columnWidth + 'px">' +
                '<div class="bracket-round-body" style="height:' + bodyHeight + 'px">' +
                matchesHtml + connectorsHtml +
                '</div>' +
                '</div>';
        });

        // titles live in their own row, outside the horizontally-scrolling container, so
        // they can be position:sticky to the viewport (sticky breaks once nested inside an
        // overflow-x:auto ancestor) - kept in horizontal sync with the columns below via scroll mirroring
        const titleColumns = rounds.map((round) => '<div class="bracket-title-col text-display" style="width:' + titleColumnWidth + 'px">' + esc(getKnockoutRoundLabel(round)) + '</div>');

        let thirdPlaceHtml = "";
        const thirdPlace = state.knockout.thirdPlace;
        if (thirdPlace && thirdPlace.homeTeamId && thirdPlace.awayTeamId) {
            thirdPlaceHtml = '<div class="bracket-third-place">' +
                '<h3 class="text-display">Third place</h3>' +
                '<div class="bracket-match bracket-match--static">' + renderBracketMatch(state, thirdPlace) + '</div>' +
                '</div>';
        }

        const previousScroll = document.getElementById("bracket-scroll");
        const previousScrollLeft = previousScroll ? previousScroll.scrollLeft : 0;
        target.innerHTML =
            '<div class="bracket-titles-sticky"><div class="bracket-titles-inner" id="bracket-titles-inner">' +
            titleColumns.join("") +
            '</div></div>' +
            '<div class="bracket-scroll" id="bracket-scroll">' +
            '<div class="bracket-tree">' +
            roundColumns.join("") +
            '</div></div>' + thirdPlaceHtml;

        const scrollEl = document.getElementById("bracket-scroll");
        const titlesInner = document.getElementById("bracket-titles-inner");
        scrollEl.addEventListener("scroll", () => {
            titlesInner.style.transform = "translateX(" + (-scrollEl.scrollLeft) + "px)";
        });

        const isNewCurrentRound = lastScrolledKnockoutRound !== currentRoundIndex;
        lastScrolledKnockoutRound = currentRoundIndex;
        const columnEl = target.querySelector('.bracket-round[data-round-index="' + currentRoundIndex + '"]');
        if (columnEl) {
            const maxScrollLeft = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
            if (isNewCurrentRound) {
                const columnOffset = columnEl.getBoundingClientRect().left - scrollEl.getBoundingClientRect().left + scrollEl.scrollLeft;
                const desiredScrollLeft = Math.min(Math.max(0, columnOffset), maxScrollLeft);
                scrollEl.scrollTo({ left: desiredScrollLeft, behavior: "smooth" });
            } else {
                scrollEl.scrollLeft = Math.min(previousScrollLeft, maxScrollLeft);
            }
            titlesInner.style.transform = "translateX(" + (-scrollEl.scrollLeft) + "px)";
        }
    }

    function toggleViews(stage) {
        document.getElementById("view-setup").hidden = stage !== "setup";
        document.getElementById("view-phase1").hidden = stage !== "phase1";
        document.getElementById("view-knockout").hidden = stage !== "knockout";
    }

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

    // pixels per second - tune to taste, kept as one named constant
    const AUTO_SCROLL_SPEED = 40;
    const AUTO_SCROLL_TICK_MS = 16;

    let autoScrollActive = false;
    let autoScrollDirection = 1;
    let autoScrollLastTime = null;
    let autoScrollIntervalId = null;

    function autoScrollTick() {
        const now = Date.now();
        if (autoScrollLastTime === null) {
            autoScrollLastTime = now;
            return;
        }
        const deltaSeconds = (now - autoScrollLastTime) / 1000;
        autoScrollLastTime = now;

        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll <= 0) {
            return;
        }

        let next = window.scrollY + autoScrollDirection * AUTO_SCROLL_SPEED * deltaSeconds;
        if (next >= maxScroll) {
            next = maxScroll;
            autoScrollDirection = -1;
        } else if (next <= 0) {
            next = 0;
            autoScrollDirection = 1;
        }
        window.scrollTo(0, next);
    }

    function setAutoScroll(active) {
        if (active === autoScrollActive) {
            return;
        }
        autoScrollActive = active;

        if (active) {
            autoScrollLastTime = null;
            if (!autoScrollIntervalId) {
                autoScrollIntervalId = setInterval(autoScrollTick, AUTO_SCROLL_TICK_MS);
            }
        } else if (autoScrollIntervalId) {
            clearInterval(autoScrollIntervalId);
            autoScrollIntervalId = null;
        }
    }

    function applySummaryPrefs() {
        const prefs = getSummaryPrefs();
        document.getElementById("view-phase1").classList.toggle("standings-hidden", prefs.standingsHidden);
        setAutoScroll(prefs.autoScrollActive);
        return prefs;
    }

    let lastStandingsHidden = null;

    function renderSummary(refreshStandings = false) {
        const state = loadState();
        const stage = getStageKey(state);
        renderHeader(state);
        toggleViews(stage);
        const prefs = applySummaryPrefs();
        if (stage === "setup") {
            renderTeamsSetup(state);
        } else if (stage === "phase1") {
            if (refreshStandings && !prefs.standingsHidden) {
                renderStandings(state);
            }
            renderPhase1(state);
        } else if (stage === "knockout") {
            renderChampion(state);
            renderBracket(state);
        }
        if (stage !== "knockout") {
            lastScrolledKnockoutRound = null;
        }
        lastStandingsHidden = prefs.standingsHidden;
        const timestamp = new Date().toLocaleString();
        document.getElementById("summary-last-update").textContent = "Last refresh: " + timestamp;
    }

    window.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY) {
            renderSummary(true);
        } else if (event.key === SUMMARY_PREFS_KEY) {
            const prefs = getSummaryPrefs();
            const standingsShown = lastStandingsHidden && !prefs.standingsHidden;
            renderSummary(standingsShown);
        }
    });

    setInterval(renderSummary, 1000);
    renderSummary(true);
})();

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
        if (stage === "phase1") {
            const currentRoundIndex = getCurrentPhase1RoundIndex(state);
            const roundTimer = (state.phase1.roundTimers || {})[String(currentRoundIndex)];
            return {
                label: "Round " + (currentRoundIndex + 1) + "/" + getPhase1TotalRounds(state),
                startedAt: roundTimer ? roundTimer.startedAt : null
            };
        }
        if (stage === "knockout") {
            const rounds = (state.knockout && state.knockout.rounds) || [];
            const round = rounds[getCurrentKnockoutRoundIndex(state)];
            return {
                label: getKnockoutRoundLabel(round),
                startedAt: round ? round.startedAt : null
            };
        }
        return { label: "-", startedAt: null };
    }

    function renderHeader(state) {
        const stage = getStageKey(state);
        document.getElementById("summary-stage-pill").textContent = getStageLabel(state);

        const roundInfo = state ? getCurrentRoundInfo(state, stage) : { label: "-", startedAt: null };
        document.getElementById("summary-clock-label").textContent = roundInfo.label;

        const matchDurationSeconds = state ? (state.config || {}).matchDurationSeconds : null;
        let clockText = "--:--";
        if (roundInfo.startedAt && Number.isFinite(Number(matchDurationSeconds))) {
            const remaining = Number(matchDurationSeconds) * 1000 - (Date.now() - roundInfo.startedAt);
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
        if (teamCount > 40) {
            return 3;
        }
        if (teamCount > 15) {
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

    function renderStandingsTable(rows, qualifiedCount, topBest) {
        return '<table>' +
            "<thead><tr><th>#</th><th>Team</th><th>P</th><th>GD</th><th>Best</th><th>Pts</th></tr></thead>" +
            "<tbody>" +
            rows.map((row) => {
                const isQualified = row.rank <= qualifiedCount;
                const bestClass = row.bestScore > 0 && row.bestScore === topBest ? "text-mono best-score-top" : "text-mono";
                return '' +
                    "<tr>" +
                    '<td class="rank text-mono">' + row.rank + "</td>" +
                    "<td>" + esc(row.teamName) + (isQualified ? ' <span class="status-pill completed">Q</span>' : "") + "</td>" +
                    "<td>" + row.played + "</td>" +
                    "<td>" + row.gd + "</td>" +
                    '<td class="' + bestClass + '">' + row.bestScore + "</td>" +
                    '<td class="text-mono"><strong>' + row.points + "</strong></td>" +
                    "</tr>";
            }).join("") +
            "</tbody></table>";
    }

    function renderStandings(state) {
        const target = document.getElementById("summary-standings");
        if (!state || !state.phase1 || !state.phase1.generated) {
            target.innerHTML = '<p class="summary-empty">Standings not available yet</p>';
            return;
        }

        const standings = window.TournamentRules.buildStandings(state);
        if (!standings.length) {
            target.innerHTML = '<p class="summary-empty">No standings yet</p>';
            return;
        }

        const qualifiedCount = window.TournamentBracket.normalizeQualifiedCount(standings.length, state.config.qualifiedCount);
        const topBest = Math.max(0, ...standings.map((row) => row.bestScore));
        const columnCount = getStandingsColumnCount(standings.length);
        const columns = chunkStandings(standings, columnCount);

        target.innerHTML = '<div class="standings-columns">' +
            columns.map((rows) => '<div class="table-wrap">' + renderStandingsTable(rows, qualifiedCount, topBest) + '</div>').join("") +
            '</div>';
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
            target.innerHTML = '<p class="summary-empty">Knockout phase is not generated yet</p>';
            return;
        }

        const rounds = state.knockout.rounds || [];
        if (!rounds.length) {
            target.innerHTML = '<p class="summary-empty">No knockout rounds</p>';
            return;
        }

        const leafCount = rounds[0].matches.length;
        const bodyHeight = leafCount * getBracketRowHeight();
        const currentRoundIndex = getCurrentKnockoutRoundIndex(state);
        const columnWidth = getBracketColumnWidth(state);
        const TREE_GAP = 40; // px, matches .bracket-tree's 2.5rem gap
        const titleColumnWidth = columnWidth + TREE_GAP;

        // match k in round R is centered at (k + 0.5) * 2^R / leafCount, so a pair's
        // midpoint always lands exactly on the next round's slot - standard bracket row-doubling math
        const roundColumns = rounds.map((round, roundIndex) => {
            const isCurrent = roundIndex === currentRoundIndex;
            const isLast = roundIndex === rounds.length - 1;
            const spacing = Math.pow(2, roundIndex);

            const centerOf = (k) => ((k + 0.5) * spacing / leafCount) * 100;

            const matchesHtml = round.matches.map((match, k) => {
                return '<div class="bracket-match" style="top:' + centerOf(k) + '%">' + renderBracketMatch(state, match) + '</div>';
            }).join("");

            let connectorsHtml = "";
            if (!isLast) {
                for (let pairIndex = 0; pairIndex * 2 < round.matches.length; pairIndex += 1) {
                    const top = centerOf(pairIndex * 2);
                    const bottom = centerOf(pairIndex * 2 + 1);
                    const mid = (top + bottom) / 2;
                    connectorsHtml += '<div class="bracket-connector" style="top:' + top + '%; height:' + (bottom - top) + '%"></div>';
                    // mid always lands on the next round's match center, so the tick points straight into it
                    connectorsHtml += '<div class="bracket-connector-tick" style="top:' + mid + '%"></div>';
                }
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
            // the whole bracket is rebuilt on every 1s re-render (fresh scrollLeft=0 node each
            // time), so the scroll position must be re-applied every tick, not just on round change
            const maxScrollLeft = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
            // offsetLeft is relative to the nearest POSITIONED ancestor, which here is nothing
            // closer than <body> (neither .bracket-scroll nor .bracket-tree are positioned), so
            // it's the wrong reference frame and way overshoots; measure via bounding rects
            // relative to the scroll container itself instead
            const columnOffset = columnEl.getBoundingClientRect().left - scrollEl.getBoundingClientRect().left + scrollEl.scrollLeft;
            const desiredScrollLeft = Math.min(Math.max(0, columnOffset), maxScrollLeft);
            if (isNewCurrentRound) {
                scrollEl.scrollTo({ left: desiredScrollLeft, behavior: "smooth" });
            } else {
                scrollEl.scrollLeft = desiredScrollLeft;
            }
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
    }

    function renderSummary() {
        const state = loadState();
        const stage = getStageKey(state);
        renderHeader(state);
        toggleViews(stage);
        applySummaryPrefs();
        if (stage === "setup") {
            renderTeamsSetup(state);
        } else if (stage === "phase1") {
            renderStandings(state);
            renderPhase1(state);
        } else if (stage === "knockout") {
            renderChampion(state);
            renderBracket(state);
        }
        const timestamp = new Date().toLocaleString();
        document.getElementById("summary-last-update").textContent = "Last refresh: " + timestamp;
    }

    window.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY || event.key === SUMMARY_PREFS_KEY) {
            renderSummary();
        }
    });

    setInterval(renderSummary, 1000);
    renderSummary();
})();

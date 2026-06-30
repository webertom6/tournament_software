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

    function renderPhase1(state) {
        const target = document.getElementById("summary-phase1");
        if (!state || !state.phase1 || !state.phase1.generated) {
            target.innerHTML = '<p class="summary-empty">Phase 1 is not generated yet</p>';
            return;
        }

        const upcoming = (state.phase1.matches || []).filter((match) => match.status !== "completed");
        if (!upcoming.length) {
            target.innerHTML = '<p class="summary-empty">No upcoming phase 1 matches</p>';
            return;
        }

        const byRound = new Map();
        upcoming.forEach((match) => {
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
                    return '' +
                        '<article class="summary-match">' +
                        '<p><strong>' + esc(home) + " vs " + esc(away) + '</strong></p>' +
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
            const upcoming = (round.matches || []).filter((match) => {
                return match.status !== "completed" && match.homeTeamId && match.awayTeamId;
            });
            if (!upcoming.length) {
                return;
            }
            roundBlocks.push({
                name: round.name || ("Round " + (Number(round.roundIndex || 0) + 1)),
                matches: upcoming
            });
        });

        if (state.knockout.thirdPlace &&
            state.knockout.thirdPlace.status !== "completed" &&
            state.knockout.thirdPlace.homeTeamId &&
            state.knockout.thirdPlace.awayTeamId) {
            roundBlocks.push({
                name: "Third place",
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

    setInterval(renderSummary, 5000);
    renderSummary();
})();

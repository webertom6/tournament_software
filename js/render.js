(function () {
    function esc(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
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
                '<input type="text" data-role="team-name" data-team-id="' + esc(team.id) + '" value="' + esc(team.name) + '" placeholder="Team name">' +
                '<button type="button" data-action="team-rename" data-team-id="' + esc(team.id) + '">Save</button>' +
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
                '<input type="text" data-role="terrain-name" data-terrain-id="' + esc(terrain.id) + '" value="' + esc(terrain.name) + '" placeholder="Terrain name">' +
                '<button type="button" data-action="terrain-rename" data-terrain-id="' + esc(terrain.id) + '">Save</button>' +
                '<button type="button" data-action="terrain-remove" data-terrain-id="' + esc(terrain.id) + '" class="danger">Delete</button>' +
                '</div>';
        }).join("") + '</div>';
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
        summary.innerHTML = '<p><strong>' + completed + '</strong> / <strong>' + state.phase1.matches.length + '</strong> matches completed</p>';

        const rounds = groupPhase1ByRound(state.phase1.matches);
        target.innerHTML = '<div class="round-grid">' + rounds.map((entry) => {
            const roundIndex = Number(entry[0]);
            const matches = entry[1];
            return '' +
                '<div class="round-card">' +
                '<h3>Round ' + (roundIndex + 1) + '</h3>' +
                matches.map((match) => {
                    const homeName = window.TournamentRules.getTeamNameById(state, match.homeTeamId);
                    const awayName = window.TournamentRules.getTeamNameById(state, match.awayTeamId);
                    return '' +
                        '<div class="match-card">' +
                        '<div class="match-head">' +
                        '<span>' + esc(homeName) + " vs " + esc(awayName) + '</span>' +
                        '<span class="status-pill ' + esc(match.status) + '">' + esc(match.status) + '</span>' +
                        '</div>' +
                        '<p class="muted">Terrain: ' + esc(getTerrainName(state, match.terrainId)) + '</p>' +
                        '<div class="match-row">' +
                        '<input type="number" min="0" step="1" data-role="phase1-home" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.homeGoals) ? match.homeGoals : "") + '" placeholder="Home goals" aria-label="Home goals">' +
                        '<input type="number" min="0" step="1" data-role="phase1-away" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.awayGoals) ? match.awayGoals : "") + '" placeholder="Away goals" aria-label="Away goals">' +
                        '<button type="button" data-action="phase1-save" data-match-id="' + esc(match.id) + '">Save score</button>' +
                        '<button type="button" data-action="phase1-reopen" data-match-id="' + esc(match.id) + '">Reopen</button>' +
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
            "<thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>" +
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
                '<h3>' + esc(round.name) + '</h3>' +
                round.matches.map((match) => {
                    const home = match.homeTeamId ? window.TournamentRules.getTeamNameById(state, match.homeTeamId) : "TBD";
                    const away = match.awayTeamId ? window.TournamentRules.getTeamNameById(state, match.awayTeamId) : "TBD";
                    return '' +
                        '<div class="match-card">' +
                        '<div class="match-head">' +
                        '<span>' + esc(home) + " vs " + esc(away) + '</span>' +
                        '<span class="status-pill ' + esc(match.status) + '">' + esc(match.status) + '</span>' +
                        '</div>' +
                        '<div class="match-row">' +
                        '<input type="number" min="0" step="1" data-role="ko-home" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.homeGoals) ? match.homeGoals : "") + '" placeholder="Home goals" aria-label="Home goals">' +
                        '<input type="number" min="0" step="1" data-role="ko-away" data-match-id="' + esc(match.id) + '" value="' + (Number.isFinite(match.awayGoals) ? match.awayGoals : "") + '" placeholder="Away goals" aria-label="Away goals">' +
                        '<button type="button" data-action="ko-save" data-match-id="' + esc(match.id) + '">Save score</button>' +
                        '<button type="button" data-action="ko-reopen" data-match-id="' + esc(match.id) + '">Reopen</button>' +
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
                '<h3>Third place</h3>' +
                '<div class="match-card">' +
                '<div class="match-head">' +
                '<span>' + esc(home) + " vs " + esc(away) + '</span>' +
                '<span class="status-pill ' + esc(tp.status) + '">' + esc(tp.status) + '</span>' +
                '</div>' +
                '<div class="match-row">' +
                '<input type="number" min="0" step="1" data-role="ko-home" data-match-id="' + esc(tp.id) + '" value="' + (Number.isFinite(tp.homeGoals) ? tp.homeGoals : "") + '" placeholder="Home goals" aria-label="Home goals">' +
                '<input type="number" min="0" step="1" data-role="ko-away" data-match-id="' + esc(tp.id) + '" value="' + (Number.isFinite(tp.awayGoals) ? tp.awayGoals : "") + '" placeholder="Away goals" aria-label="Away goals">' +
                '<button type="button" data-action="ko-save" data-match-id="' + esc(tp.id) + '">Save score</button>' +
                '<button type="button" data-action="ko-reopen" data-match-id="' + esc(tp.id) + '">Reopen</button>' +
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
        document.getElementById("cfg-qualified").value = state.config.qualifiedCount;
        document.getElementById("cfg-seeding").value = state.config.seedingPolicy;
        document.getElementById("cfg-third-place").checked = Boolean(state.config.thirdPlaceMatch);
    }

    function handleError(error) {
        const message = error && error.message ? error.message : String(error);
        alert(message);
        console.error(error);
    }

    function getSiblingScoreInput(role, matchId) {
        return document.querySelector('input[data-role="' + role + '"][data-match-id="' + matchId + '"]');
    }

    function bindEvents() {
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
                    qualifiedCount: document.getElementById("cfg-qualified").value,
                    seedingPolicy: document.getElementById("cfg-seeding").value,
                    thirdPlaceMatch: document.getElementById("cfg-third-place").checked
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
                if (action === "team-rename") {
                    const id = target.getAttribute("data-team-id");
                    const input = document.querySelector('input[data-role="team-name"][data-team-id="' + id + '"]');
                    window.TournamentActions.renameTeam(id, input ? input.value : "");
                    return;
                }

                if (action === "team-remove") {
                    window.TournamentActions.removeTeam(target.getAttribute("data-team-id"));
                    return;
                }

                if (action === "terrain-rename") {
                    const id = target.getAttribute("data-terrain-id");
                    const input = document.querySelector('input[data-role="terrain-name"][data-terrain-id="' + id + '"]');
                    window.TournamentActions.renameTerrain(id, input ? input.value : "");
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
                    window.TournamentActions.applyPhase1Score(matchId, homeInput ? homeInput.value : "", awayInput ? awayInput.value : "");
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
                    window.TournamentActions.applyKnockoutScore(matchId, homeInput ? homeInput.value : "", awayInput ? awayInput.value : "");
                    return;
                }

                if (action === "ko-reopen") {
                    window.TournamentActions.reopenKnockoutMatch(target.getAttribute("data-match-id"));
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
    }

    window.TournamentRender = {
        bindEvents: bindEvents,
        renderApp: renderApp
    };
})();

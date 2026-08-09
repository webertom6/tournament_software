(function () {
    function normalizeName(name) {
        return String(name || "").trim().replace(/\s+/g, " ");
    }

    function findTeam(state, id) {
        return state.teams.find((team) => team.id === id);
    }

    function findTerrain(state, id) {
        return state.terrains.find((terrain) => terrain.id === id);
    }

    function clearKnockoutState(state) {
        state.knockout.generated = false;
        state.knockout.rounds = [];
        state.knockout.thirdPlace = null;
        state.knockout.championTeamId = null;
    }

    function assertCanEditSetup(state) {
        if (state.phase1.generated) {
            throw new Error("Cannot edit teams or terrains after phase 1 is generated. Reset state to restart.");
        }
    }

    function addTeam(name) {
        const normalized = normalizeName(name);
        if (!normalized) {
            throw new Error("Team name is required");
        }

        window.TournamentState.update((state) => {
            assertCanEditSetup(state);
            const exists = state.teams.some((team) => team.name.toLowerCase() === normalized.toLowerCase());
            if (exists) {
                throw new Error("Team name already exists");
            }
            state.teams.push({
                id: window.TournamentState.uid("team"),
                name: normalized
            });
        }, 'Added team "' + normalized + '"');
    }

    function removeTeam(teamId) {
        window.TournamentState.update((state) => {
            assertCanEditSetup(state);
            const before = state.teams.length;
            state.teams = state.teams.filter((team) => team.id !== teamId);
            if (state.teams.length === before) {
                throw new Error("Team not found");
            }
        }, "Removed one team");
    }

    function addTerrain(name) {
        const normalized = normalizeName(name);
        if (!normalized) {
            throw new Error("Terrain name is required");
        }

        window.TournamentState.update((state) => {
            assertCanEditSetup(state);
            const exists = state.terrains.some((terrain) => terrain.name.toLowerCase() === normalized.toLowerCase());
            if (exists) {
                throw new Error("Terrain name already exists");
            }
            state.terrains.push({
                id: window.TournamentState.uid("terrain"),
                name: normalized
            });
        }, 'Added terrain "' + normalized + '"');
    }

    function removeTerrain(terrainId) {
        window.TournamentState.update((state) => {
            assertCanEditSetup(state);
            const before = state.terrains.length;
            state.terrains = state.terrains.filter((terrain) => terrain.id !== terrainId);
            if (state.terrains.length === before) {
                throw new Error("Terrain not found");
            }
        }, "Removed one terrain");
    }

    function updateConfig(rawConfig) {
        window.TournamentState.update((state) => {
            if (state.phase1.generated) {
                throw new Error("Cannot change config after phase 1 is generated. Reset phases to restart.");
            }

            const parsed = {
                POINT_VICTORY_PHASE1: Number(rawConfig.POINT_VICTORY_PHASE1),
                POINT_DRAW_PHASE1: Number(rawConfig.POINT_DRAW_PHASE1),
                POINT_LOSS_PHASE1: Number(rawConfig.POINT_LOSS_PHASE1),
                phase1MatchesPerTeam: Number(rawConfig.phase1MatchesPerTeam),
                qualifiedCount: Number(rawConfig.qualifiedCount),
                seedingPolicy: rawConfig.seedingPolicy === "random" ? "random" : "ranking",
                thirdPlaceMatch: Boolean(rawConfig.thirdPlaceMatch),
                matchDurationSeconds: Number(rawConfig.matchDurationSeconds),
                pauseDurationSeconds: Number(rawConfig.pauseDurationSeconds)
            };

            if (!Number.isFinite(parsed.POINT_VICTORY_PHASE1) || parsed.POINT_VICTORY_PHASE1 < 0) {
                throw new Error("POINT_VICTORY_PHASE1 must be >= 0");
            }
            if (!Number.isFinite(parsed.POINT_DRAW_PHASE1) || parsed.POINT_DRAW_PHASE1 < 0) {
                throw new Error("POINT_DRAW_PHASE1 must be >= 0");
            }
            if (!Number.isFinite(parsed.POINT_LOSS_PHASE1) || parsed.POINT_LOSS_PHASE1 < 0) {
                throw new Error("POINT_LOSS_PHASE1 must be >= 0");
            }
            if (!Number.isFinite(parsed.phase1MatchesPerTeam) || parsed.phase1MatchesPerTeam < 1 || Math.floor(parsed.phase1MatchesPerTeam) !== parsed.phase1MatchesPerTeam) {
                throw new Error("Phase 1 matches per team must be an integer >= 1");
            }
            if (!Number.isFinite(parsed.qualifiedCount) || parsed.qualifiedCount < 2) {
                throw new Error("Qualified count must be >= 2");
            }
            if (!Number.isFinite(parsed.matchDurationSeconds) || parsed.matchDurationSeconds < 1) {
                throw new Error("Match duration must be >= 1 second");
            }
            if (!Number.isFinite(parsed.pauseDurationSeconds) || parsed.pauseDurationSeconds < 1) {
                throw new Error("Pause duration must be >= 1 second");
            }

            state.config = parsed;
            if (state.knockout.generated) {
                clearKnockoutState(state);
            }
        }, "Updated tournament config");
    }

    function generatePhase1() {
        window.TournamentState.update((state) => {
            if (state.teams.length < 2) {
                throw new Error("Need at least 2 teams");
            }
            const teamIds = state.teams.map((team) => team.id);
            const terrainIds = state.terrains.map((terrain) => terrain.id);
            state.phase1.matches = window.TournamentScheduler.buildPhase1Matches(
                teamIds,
                terrainIds,
                window.TournamentState.uid,
                state.config.phase1MatchesPerTeam
            );
            state.phase1.generated = true;
            state.phase1.roundTimers = {};
            clearKnockoutState(state);
        }, "Generated phase 1 schedule with configured matches per team");
    }

    function findPhase1Match(state, matchId) {
        return state.phase1.matches.find((match) => match.id === matchId);
    }

    function parseGoal(value, fieldName) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0 || Math.floor(parsed) !== parsed) {
            throw new Error(fieldName + " must be an integer >= 0");
        }
        return parsed;
    }

    function getPhase1RoundStartedAt(state, roundIndex) {
        const timer = state.phase1.roundTimers[String(roundIndex)];
        return timer ? timer.startedAt : null;
    }

    function getRoundStartedAt(state, matchId) {
        const phase1Match = findPhase1Match(state, matchId);
        if (phase1Match) {
            return getPhase1RoundStartedAt(state, phase1Match.roundIndex);
        }
        if (state.knockout.thirdPlace && state.knockout.thirdPlace.id === matchId) {
            return state.knockout.thirdPlace.startedAt;
        }
        for (const round of state.knockout.rounds) {
            if (round.matches.some((match) => match.id === matchId)) {
                return round.startedAt;
            }
        }
        return null;
    }

    function findAnyMatch(state, matchId) {
        return findPhase1Match(state, matchId) || findKnockoutMatch(state, matchId);
    }

    function applyPhase1Score(matchId, homeTeamIdRaw, awayTeamIdRaw, homeGoalsRaw, awayGoalsRaw) {
        const homeGoals = parseGoal(homeGoalsRaw, "Home goals");
        const awayGoals = parseGoal(awayGoalsRaw, "Away goals");

        window.TournamentState.update((state) => {
            const match = findPhase1Match(state, matchId);
            if (!match) {
                throw new Error("Phase 1 match not found");
            }

            const homeTeamId = homeTeamIdRaw === undefined ? match.homeTeamId : homeTeamIdRaw;
            const awayTeamId = awayTeamIdRaw === undefined ? match.awayTeamId : awayTeamIdRaw;
            if (!homeTeamId || !awayTeamId) {
                throw new Error("Both teams must be assigned");
            }
            if (homeTeamId === awayTeamId) {
                throw new Error("Home and away teams must be different");
            }
            if (!findTeam(state, homeTeamId) || !findTeam(state, awayTeamId)) {
                throw new Error("Selected team not found");
            }

            match.homeTeamId = homeTeamId;
            match.awayTeamId = awayTeamId;
            match.homeGoals = homeGoals;
            match.awayGoals = awayGoals;
            match.status = "completed";
            match.finalElapsedMs = window.TournamentTimer.computeElapsedMs(
                getPhase1RoundStartedAt(state, match.roundIndex),
                match,
                Date.now()
            );

            if (state.knockout.generated) {
                clearKnockoutState(state);
            }
        }, "Updated phase 1 score and recomputed standings");
    }

    function reopenPhase1Match(matchId) {
        window.TournamentState.update((state) => {
            const match = findPhase1Match(state, matchId);
            if (!match) {
                throw new Error("Phase 1 match not found");
            }
            match.homeGoals = null;
            match.awayGoals = null;
            match.status = "scheduled";

            if (state.knockout.generated) {
                clearKnockoutState(state);
            }
        }, "Reopened phase 1 match and reset knockout");
    }

    function resetPhases() {
        window.TournamentState.update((state) => {
            state.phase1.generated = false;
            state.phase1.matches = [];
            state.phase1.roundTimers = {};
            clearKnockoutState(state);
        }, "Reset phase 1 and knockout while preserving teams and terrains");
    }

    function startKnockout() {
        window.TournamentState.update((state) => {
            if (!state.phase1.generated) {
                throw new Error("Generate phase 1 first");
            }
            const allCompleted = state.phase1.matches.length > 0 &&
                state.phase1.matches.every((match) => match.status === "completed");
            if (!allCompleted) {
                throw new Error("All phase 1 matches must be completed before generating phase 2");
            }
            const standings = window.TournamentRules.buildStandings(state);
            if (standings.length < 2) {
                throw new Error("Need standings for at least 2 teams");
            }
            const qualifiedCount = window.TournamentBracket.normalizeQualifiedCount(standings.length, state.config.qualifiedCount);
            const qualified = standings.slice(0, qualifiedCount).map((row) => row.teamId);
            const knockout = window.TournamentBracket.generateKnockoutStructure(qualified, state.config, window.TournamentState.uid);
            state.knockout.generated = true;
            state.knockout.rounds = knockout.rounds;
            state.knockout.thirdPlace = knockout.thirdPlace;
            state.knockout.championTeamId = knockout.championTeamId;
            window.TournamentBracket.recomputeKnockout(state);
        }, "Generated knockout phase from phase 1 standings");
    }

    function findKnockoutMatch(state, matchId) {
        for (const round of state.knockout.rounds) {
            const found = round.matches.find((match) => match.id === matchId);
            if (found) {
                return found;
            }
        }
        if (state.knockout.thirdPlace && state.knockout.thirdPlace.id === matchId) {
            return state.knockout.thirdPlace;
        }
        return null;
    }

    function applyKnockoutScore(matchId, homeTeamIdRaw, awayTeamIdRaw, homeGoalsRaw, awayGoalsRaw) {
        const homeGoals = parseGoal(homeGoalsRaw, "Home goals");
        const awayGoals = parseGoal(awayGoalsRaw, "Away goals");
        if (homeGoals === awayGoals) {
            throw new Error("Knockout matches cannot end in a draw");
        }

        window.TournamentState.update((state) => {
            if (!state.knockout.generated) {
                throw new Error("Knockout not generated");
            }
            const match = findKnockoutMatch(state, matchId);
            if (!match) {
                throw new Error("Knockout match not found");
            }

            const homeTeamId = homeTeamIdRaw === undefined ? match.homeTeamId : homeTeamIdRaw;
            const awayTeamId = awayTeamIdRaw === undefined ? match.awayTeamId : awayTeamIdRaw;
            if (!homeTeamId || !awayTeamId) {
                throw new Error("Match participants are not both defined");
            }
            if (homeTeamId === awayTeamId) {
                throw new Error("Home and away teams must be different");
            }
            if ((homeTeamId !== match.homeTeamId || awayTeamId !== match.awayTeamId) &&
                (match.homeSourceMatchId || match.awaySourceMatchId)) {
                throw new Error("Only first round matches can have their teams changed manually");
            }
            if (!findTeam(state, homeTeamId) || !findTeam(state, awayTeamId)) {
                throw new Error("Selected team not found");
            }

            match.homeTeamId = homeTeamId;
            match.awayTeamId = awayTeamId;
            match.homeGoals = homeGoals;
            match.awayGoals = awayGoals;
            match.status = "completed";
            match.finalElapsedMs = window.TournamentTimer.computeElapsedMs(getRoundStartedAt(state, match.id), match, Date.now());
            window.TournamentBracket.recomputeKnockout(state);
            window.TournamentBracket.clearDownstreamFromMatch(state, match.id);
        }, "Updated knockout score");
    }

    function reopenKnockoutMatch(matchId) {
        window.TournamentState.update((state) => {
            const match = findKnockoutMatch(state, matchId);
            if (!match) {
                throw new Error("Knockout match not found");
            }
            match.homeGoals = null;
            match.awayGoals = null;
            match.status = "scheduled";
            window.TournamentBracket.clearDownstreamFromMatch(state, match.id);
        }, "Reopened knockout match and cleared dependent rounds");
    }

    function startPhase1RoundTimer(roundIndex) {
        window.TournamentState.update((state) => {
            if (!state.phase1.generated) {
                throw new Error("Generate phase 1 first");
            }
            const key = String(roundIndex);
            if (state.phase1.roundTimers[key]) {
                throw new Error("Round timer already started");
            }
            const hasRound = state.phase1.matches.some((match) => String(match.roundIndex) === key);
            if (!hasRound) {
                throw new Error("Round not found");
            }
            state.phase1.roundTimers[key] = { startedAt: Date.now() };
        }, "Started phase 1 round timer");
    }

    function stopPhase1RoundTimer(roundIndex) {
        window.TournamentState.update((state) => {
            const key = String(roundIndex);
            const timer = state.phase1.roundTimers[key];
            if (!timer || !timer.startedAt) {
                throw new Error("Round timer not started");
            }
            if (timer.stoppedAt) {
                throw new Error("Round timer already stopped");
            }
            timer.stoppedAt = Date.now();
        }, "Stopped phase 1 round timer");
    }

    function startKnockoutRoundTimer(roundKey) {
        window.TournamentState.update((state) => {
            if (!state.knockout.generated) {
                throw new Error("Knockout not generated");
            }
            const target = roundKey === "thirdPlace"
                ? state.knockout.thirdPlace
                : state.knockout.rounds.find((round) => round.id === roundKey);
            if (!target) {
                throw new Error("Round not found");
            }
            if (target.startedAt) {
                throw new Error("Round timer already started");
            }
            target.startedAt = Date.now();
        }, "Started knockout round timer");
    }

    function stopKnockoutRoundTimer(roundKey) {
        window.TournamentState.update((state) => {
            if (!state.knockout.generated) {
                throw new Error("Knockout not generated");
            }
            const target = roundKey === "thirdPlace"
                ? state.knockout.thirdPlace
                : state.knockout.rounds.find((round) => round.id === roundKey);
            if (!target || !target.startedAt) {
                throw new Error("Round timer not started");
            }
            if (target.stoppedAt) {
                throw new Error("Round timer already stopped");
            }
            target.stoppedAt = Date.now();
        }, "Stopped knockout round timer");
    }

    function pauseMatchTimer(matchId) {
        window.TournamentState.update((state) => {
            const match = findAnyMatch(state, matchId);
            if (!match) {
                throw new Error("Match not found");
            }
            if (!getRoundStartedAt(state, matchId)) {
                throw new Error("Start the round timer before pausing a match");
            }
            if (match.pausedAt) {
                throw new Error("Match timer is already paused");
            }
            if (match.status === "completed" || match.finalElapsedMs !== null) {
                throw new Error("Match timer is already stopped");
            }
            match.pausedAt = Date.now();
        }, "Paused match timer");
    }

    function resumeMatchTimer(matchId) {
        window.TournamentState.update((state) => {
            const match = findAnyMatch(state, matchId);
            if (!match) {
                throw new Error("Match not found");
            }
            if (!match.pausedAt) {
                throw new Error("Match timer is not paused");
            }
            match.pausedTotalMs = (match.pausedTotalMs || 0) + (Date.now() - match.pausedAt);
            match.pausedAt = null;
        }, "Resumed match timer");
    }

    function exportStateToDownload() {
        const json = window.TournamentState.exportState();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "tournament-state.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    function importStateFromText(jsonText) {
        window.TournamentState.importState(jsonText);
    }

    function resetAll() {
        window.TournamentState.resetAll();
    }

    window.TournamentActions = {
        addTeam: addTeam,
        removeTeam: removeTeam,
        addTerrain: addTerrain,
        removeTerrain: removeTerrain,
        updateConfig: updateConfig,
        generatePhase1: generatePhase1,
        applyPhase1Score: applyPhase1Score,
        reopenPhase1Match: reopenPhase1Match,
        resetPhases: resetPhases,
        startKnockout: startKnockout,
        applyKnockoutScore: applyKnockoutScore,
        reopenKnockoutMatch: reopenKnockoutMatch,
        startPhase1RoundTimer: startPhase1RoundTimer,
        startKnockoutRoundTimer: startKnockoutRoundTimer,
        stopPhase1RoundTimer: stopPhase1RoundTimer,
        stopKnockoutRoundTimer: stopKnockoutRoundTimer,
        pauseMatchTimer: pauseMatchTimer,
        resumeMatchTimer: resumeMatchTimer,
        exportStateToDownload: exportStateToDownload,
        importStateFromText: importStateFromText,
        resetAll: resetAll
    };
})();

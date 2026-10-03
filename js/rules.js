(function () {
    function getTeamNameById(state, teamId) {
        const team = state.teams.find((item) => item.id === teamId);
        return team ? team.name : "TBD";
    }

    function getWinnerTeamId(match) {
        if (!match || match.status !== "completed") {
            return null;
        }
        if (!Number.isFinite(match.homeGoals) || !Number.isFinite(match.awayGoals)) {
            return null;
        }
        if (match.homeGoals === match.awayGoals) {
            return null;
        }
        return match.homeGoals > match.awayGoals ? match.homeTeamId : match.awayTeamId;
    }

    function getLoserTeamId(match) {
        if (!match || match.status !== "completed") {
            return null;
        }
        if (!Number.isFinite(match.homeGoals) || !Number.isFinite(match.awayGoals)) {
            return null;
        }
        if (match.homeGoals === match.awayGoals) {
            return null;
        }
        return match.homeGoals < match.awayGoals ? match.homeTeamId : match.awayTeamId;
    }

    function buildStandings(state) {
        const table = new Map();

        for (const team of state.teams) {
            table.set(team.id, {
                teamId: team.id,
                teamName: team.name,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                gt: 0,
                gc: 0,
                ga: 0,
                gd: 0,
                bestScore: 0,
                lastScore: null,
                points: 0
            });
        }

        const matches = state.phase1.matches.filter((match) => {
            return match.status === "completed" && Number.isFinite(match.homeGoals) && Number.isFinite(match.awayGoals);
        });

        for (const match of matches) {
            if (!table.has(match.homeTeamId) || !table.has(match.awayTeamId)) {
                continue;
            }
            const home = table.get(match.homeTeamId);
            const away = table.get(match.awayTeamId);

            home.played += 1;
            away.played += 1;
            home.gt += match.homeGoals;
            home.gc += match.awayGoals;
            away.gt += match.awayGoals;
            away.gc += match.homeGoals;
            home.bestScore = Math.max(home.bestScore, match.homeGoals);
            away.bestScore = Math.max(away.bestScore, match.awayGoals);
            home.lastScore = match.homeGoals;
            away.lastScore = match.awayGoals;

            if (match.homeGoals > match.awayGoals) {
                home.wins += 1;
                away.losses += 1;
                home.points += Number(state.config.POINT_VICTORY_PHASE1) || 0;
                away.points += Number(state.config.POINT_LOSS_PHASE1) || 0;
            } else if (match.homeGoals < match.awayGoals) {
                away.wins += 1;
                home.losses += 1;
                away.points += Number(state.config.POINT_VICTORY_PHASE1) || 0;
                home.points += Number(state.config.POINT_LOSS_PHASE1) || 0;
            } else {
                home.draws += 1;
                away.draws += 1;
                home.points += Number(state.config.POINT_DRAW_PHASE1) || 0;
                away.points += Number(state.config.POINT_DRAW_PHASE1) || 0;
            }
        }

        const standings = Array.from(table.values()).map((row) => {
            row.ga = row.played > 0 ? row.gt / row.played : 0;
            row.gd = row.gt - row.gc;
            return row;
        });

        standings.sort((a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points;
            }
            if (Math.abs(b.ga - a.ga) >= 1e-9) {
                return b.ga - a.ga;
            }
            if (b.gc !== a.gc) {
                return a.gc - b.gc;
            }
            return a.teamName.localeCompare(b.teamName);
        });

        standings.forEach((row, index) => {
            row.rank = index + 1;
        });

        return standings;
    }

    function getStandingsBestValues(standings) {
        const result = {
            wins: null,
            losses: null,
            gt: null,
            gc: null,
            ga: null,
            gd: null,
            lastScore: null,
            bestScore: null,
            points: null
        };
        if (!standings.length || standings.every((row) => row.played === 0)) {
            return result;
        }

        const directions = {
            wins: "max",
            losses: "min",
            gt: "max",
            gc: "min",
            ga: "max",
            gd: "max",
            lastScore: "max",
            bestScore: "max",
            points: "max"
        };
        Object.keys(directions).forEach((key) => {
            const values = standings.map((row) => row[key]).filter((value) => key !== "lastScore" || value !== null);
            const allValues = standings.map((row) => row[key]);
            if (!values.length || new Set(allValues).size === 1) {
                return;
            }
            result[key] = directions[key] === "min" ? Math.min(...values) : Math.max(...values);
        });
        return result;
    }

    window.TournamentRules = {
        getTeamNameById: getTeamNameById,
        getWinnerTeamId: getWinnerTeamId,
        getLoserTeamId: getLoserTeamId,
        buildStandings: buildStandings,
        getStandingsBestValues: getStandingsBestValues
    };
})();

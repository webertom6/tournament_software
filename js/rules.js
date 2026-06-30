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
                gf: 0,
                ga: 0,
                gd: 0,
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
            home.gf += match.homeGoals;
            home.ga += match.awayGoals;
            away.gf += match.awayGoals;
            away.ga += match.homeGoals;

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
            row.gd = row.gf - row.ga;
            return row;
        });

        standings.sort((a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points;
            }
            if (b.gd !== a.gd) {
                return b.gd - a.gd;
            }
            if (b.gf !== a.gf) {
                return b.gf - a.gf;
            }
            return a.teamName.localeCompare(b.teamName);
        });

        standings.forEach((row, index) => {
            row.rank = index + 1;
        });

        return standings;
    }

    window.TournamentRules = {
        getTeamNameById: getTeamNameById,
        getWinnerTeamId: getWinnerTeamId,
        getLoserTeamId: getLoserTeamId,
        buildStandings: buildStandings
    };
})();

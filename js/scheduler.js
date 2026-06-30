(function () {
    function rotateRoundRobin(list) {
        if (list.length <= 2) {
            return list.slice();
        }

        const fixed = list[0];
        const moving = list.slice(1);
        moving.unshift(moving.pop());
        return [fixed].concat(moving);
    }

    function buildRoundRobinPairs(teamIds) {
        const ids = teamIds.slice();
        const bye = null;

        if (ids.length % 2 !== 0) {
            ids.push(bye);
        }

        let current = ids.slice();
        const rounds = [];
        const roundsCount = current.length - 1;
        const half = current.length / 2;

        for (let roundIndex = 0; roundIndex < roundsCount; roundIndex += 1) {
            const pairs = [];
            for (let i = 0; i < half; i += 1) {
                const home = current[i];
                const away = current[current.length - 1 - i];
                if (home && away) {
                    pairs.push({ homeTeamId: home, awayTeamId: away });
                }
            }
            rounds.push(pairs);
            current = rotateRoundRobin(current);
        }

        return rounds;
    }

    function buildPhase1Matches(teamIds, terrainIds, uid) {
        const rounds = buildRoundRobinPairs(teamIds);
        const matches = [];
        let terrainIndex = 0;

        rounds.forEach((pairs, roundIndex) => {
            pairs.forEach((pair, slotIndex) => {
                const terrainId = terrainIds.length > 0 ? terrainIds[terrainIndex % terrainIds.length] : null;
                terrainIndex += 1;

                matches.push({
                    id: uid("p1m"),
                    phase: "phase1",
                    roundIndex: roundIndex,
                    slotIndex: slotIndex,
                    homeTeamId: pair.homeTeamId,
                    awayTeamId: pair.awayTeamId,
                    terrainId: terrainId,
                    homeGoals: null,
                    awayGoals: null,
                    status: "scheduled"
                });
            });
        });

        return matches;
    }

    window.TournamentScheduler = {
        buildPhase1Matches: buildPhase1Matches
    };
})();

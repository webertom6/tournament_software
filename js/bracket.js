(function () {
    function nextPowerOfTwo(value) {
        let p = 1;
        while (p < value) {
            p *= 2;
        }
        return p;
    }

    function seedPositions(size) {
        if (size === 1) {
            return [1];
        }
        const prev = seedPositions(size / 2);
        const result = [];
        for (const item of prev) {
            result.push(item);
            result.push(size + 1 - item);
        }
        return result;
    }

    function getRoundName(index, totalRounds) {
        const left = totalRounds - index;
        if (left === 1) {
            return "Final";
        }
        if (left === 2) {
            return "Semifinal";
        }
        if (left === 3) {
            return "Quarterfinal";
        }
        return "Round " + (index + 1);
    }

    function normalizeQualifiedCount(teamsCount, requested) {
        const count = Math.max(2, Math.floor(Number(requested) || 2));
        return Math.min(count, teamsCount);
    }

    function buildSeededTeams(qualifiedTeamIds, seedingPolicy) {
        const seeds = qualifiedTeamIds.slice();
        if (seedingPolicy === "random") {
            for (let i = seeds.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                const temp = seeds[i];
                seeds[i] = seeds[j];
                seeds[j] = temp;
            }
        }
        return seeds;
    }

    function generateKnockoutStructure(qualifiedTeamIds, config, uid) {
        const normalizedCount = normalizeQualifiedCount(qualifiedTeamIds.length, config.qualifiedCount);
        const selected = qualifiedTeamIds.slice(0, normalizedCount);
        const seededTeams = buildSeededTeams(selected, config.seedingPolicy);
        const bracketSize = nextPowerOfTwo(Math.max(2, seededTeams.length));
        const positions = seedPositions(bracketSize);
        const slots = new Array(bracketSize).fill(null);

        positions.forEach((seedNumber, positionIndex) => {
            if (seedNumber <= seededTeams.length) {
                slots[positionIndex] = seededTeams[seedNumber - 1];
            }
        });

        const totalRounds = Math.log2(bracketSize);
        const rounds = [];

        for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
            const matchCount = bracketSize / Math.pow(2, roundIndex + 1);
            const round = {
                id: uid("ko_round"),
                roundIndex: roundIndex,
                name: getRoundName(roundIndex, totalRounds),
                startedAt: null,
                stoppedAt: null,
                matches: []
            };

            for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
                round.matches.push({
                    id: uid("kom"),
                    phase: "knockout",
                    roundIndex: roundIndex,
                    slotIndex: matchIndex,
                    homeTeamId: null,
                    awayTeamId: null,
                    homeGoals: null,
                    awayGoals: null,
                    status: "scheduled",
                    nextMatchId: null,
                    nextSlot: null,
                    homeSourceMatchId: null,
                    awaySourceMatchId: null,
                    pausedAt: null,
                    pausedTotalMs: 0,
                    finalElapsedMs: null
                });
            }

            rounds.push(round);
        }

        const firstRound = rounds[0];
        for (let i = 0; i < firstRound.matches.length; i += 1) {
            const home = slots[i * 2];
            const away = slots[i * 2 + 1];
            firstRound.matches[i].homeTeamId = home;
            firstRound.matches[i].awayTeamId = away;
        }

        for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex += 1) {
            const currentRound = rounds[roundIndex];
            const nextRound = rounds[roundIndex + 1];
            for (let i = 0; i < currentRound.matches.length; i += 1) {
                const currentMatch = currentRound.matches[i];
                const targetIndex = Math.floor(i / 2);
                currentMatch.nextMatchId = nextRound.matches[targetIndex].id;
                currentMatch.nextSlot = i % 2 === 0 ? "home" : "away";
            }
        }

        for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
            const prevRound = rounds[roundIndex - 1];
            const currentRound = rounds[roundIndex];
            for (let i = 0; i < currentRound.matches.length; i += 1) {
                currentRound.matches[i].homeSourceMatchId = prevRound.matches[i * 2].id;
                currentRound.matches[i].awaySourceMatchId = prevRound.matches[i * 2 + 1].id;
            }
        }

        let thirdPlace = null;
        if (config.thirdPlaceMatch && rounds.length >= 2) {
            const semiRound = rounds[rounds.length - 2];
            if (semiRound.matches.length === 2) {
                thirdPlace = {
                    id: uid("third"),
                    phase: "knockout",
                    roundIndex: rounds.length,
                    slotIndex: 0,
                    name: "Third place",
                    startedAt: null,
                    stoppedAt: null,
                    homeSourceMatchId: semiRound.matches[0].id,
                    awaySourceMatchId: semiRound.matches[1].id,
                    homeTeamId: null,
                    awayTeamId: null,
                    homeGoals: null,
                    awayGoals: null,
                    status: "scheduled",
                    pausedAt: null,
                    pausedTotalMs: 0,
                    finalElapsedMs: null
                };
            }
        }

        return {
            rounds: rounds,
            thirdPlace: thirdPlace,
            championTeamId: null
        };
    }

    function flattenMatches(rounds) {
        const list = [];
        rounds.forEach((round) => {
            round.matches.forEach((match) => list.push(match));
        });
        return list;
    }

    function getWinnerId(match) {
        return window.TournamentRules.getWinnerTeamId(match);
    }

    function getLoserId(match) {
        return window.TournamentRules.getLoserTeamId(match);
    }

    function clearMatchResult(match) {
        match.homeGoals = null;
        match.awayGoals = null;
        match.status = "scheduled";
        // a changed pairing invalidates any timing recorded for the old one
        match.pausedAt = null;
        match.pausedTotalMs = 0;
        match.finalElapsedMs = null;
    }

    function autoCompleteBye(match) {
        if (!match.homeTeamId && !match.awayTeamId) {
            clearMatchResult(match);
            return;
        }
        if (match.homeTeamId && !match.awayTeamId) {
            match.homeGoals = 1;
            match.awayGoals = 0;
            match.status = "completed";
            return;
        }
        if (!match.homeTeamId && match.awayTeamId) {
            match.homeGoals = 0;
            match.awayGoals = 1;
            match.status = "completed";
            return;
        }
        if (match.status === "completed" && Number.isFinite(match.homeGoals) && Number.isFinite(match.awayGoals)) {
            return;
        }
        clearMatchResult(match);
    }

    function propagateRoundWinners(rounds) {
        const map = new Map();
        flattenMatches(rounds).forEach((match) => map.set(match.id, match));

        for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
            rounds[roundIndex].matches.forEach((match) => {
                const homeSrc = map.get(match.homeSourceMatchId);
                const awaySrc = map.get(match.awaySourceMatchId);
                const homeWinner = homeSrc ? getWinnerId(homeSrc) : null;
                const awayWinner = awaySrc ? getWinnerId(awaySrc) : null;

                if (match.homeTeamId !== homeWinner || match.awayTeamId !== awayWinner) {
                    match.homeTeamId = homeWinner;
                    match.awayTeamId = awayWinner;
                    clearMatchResult(match);
                }
                autoCompleteBye(match);
            });
        }
    }

    function recomputeKnockout(state) {
        if (!state.knockout.generated) {
            return;
        }

        const rounds = state.knockout.rounds;
        if (!rounds.length) {
            state.knockout.championTeamId = null;
            return;
        }

        rounds[0].matches.forEach((match) => autoCompleteBye(match));
        propagateRoundWinners(rounds);

        const finalRound = rounds[rounds.length - 1];
        const finalMatch = finalRound.matches[0];
        state.knockout.championTeamId = getWinnerId(finalMatch);

        if (state.knockout.thirdPlace) {
            const third = state.knockout.thirdPlace;
            const allMatches = new Map();
            flattenMatches(rounds).forEach((match) => allMatches.set(match.id, match));
            const homeSrc = allMatches.get(third.homeSourceMatchId);
            const awaySrc = allMatches.get(third.awaySourceMatchId);
            const homeLoser = homeSrc ? getLoserId(homeSrc) : null;
            const awayLoser = awaySrc ? getLoserId(awaySrc) : null;

            if (third.homeTeamId !== homeLoser || third.awayTeamId !== awayLoser) {
                third.homeTeamId = homeLoser;
                third.awayTeamId = awayLoser;
                clearMatchResult(third);
            }
            autoCompleteBye(third);
        }
    }

    function clearDownstreamFromMatch(state, matchId) {
        if (!state.knockout.generated) {
            return;
        }
        const all = flattenMatches(state.knockout.rounds);
        const map = new Map();
        all.forEach((match) => map.set(match.id, match));

        let queue = [matchId];
        let seen = new Set();

        while (queue.length) {
            const currentId = queue.pop();
            if (seen.has(currentId)) {
                continue;
            }
            seen.add(currentId);
            const current = map.get(currentId);
            if (!current || !current.nextMatchId) {
                continue;
            }
            const next = map.get(current.nextMatchId);
            if (!next) {
                continue;
            }
            clearMatchResult(next);
            queue.push(next.id);
        }

        recomputeKnockout(state);
    }

    window.TournamentBracket = {
        normalizeQualifiedCount: normalizeQualifiedCount,
        generateKnockoutStructure: generateKnockoutStructure,
        recomputeKnockout: recomputeKnockout,
        clearDownstreamFromMatch: clearDownstreamFromMatch
    };
})();

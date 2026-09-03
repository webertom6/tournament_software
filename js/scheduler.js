(function () {
    function getPairKey(teamA, teamB) {
        return teamA < teamB ? teamA + "::" + teamB : teamB + "::" + teamA;
    }

    function shuffle(items) {
        const result = items.slice();
        for (let i = result.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = result[i];
            result[i] = result[j];
            result[j] = temp;
        }
        return result;
    }

    function buildPairSequence(teamIds, matchesPerTeam) {
        if (matchesPerTeam < 1) {
            throw new Error("Phase 1 matches per team must be >= 1");
        }
        if (teamIds.length < 2) {
            throw new Error("Need at least 2 teams for phase 1");
        }

        const totalMatchSlots = teamIds.length * matchesPerTeam;
        if (totalMatchSlots % 2 !== 0) {
            throw new Error("Invalid setup: team count (" + teamIds.length + ") x phase 1 matches per team (" + matchesPerTeam + ") must be even");
        }

        // shuffled once per call so every generation produces a different pairing order
        const randomOrder = new Map();
        shuffle(teamIds).forEach((teamId, index) => randomOrder.set(teamId, index));

        const remaining = new Map();
        const meetings = new Map();
        teamIds.forEach((teamId) => remaining.set(teamId, matchesPerTeam));

        const pairs = [];
        let guard = 0;
        const maxGuard = totalMatchSlots * 8;

        while (true) {
            const active = teamIds.filter((teamId) => (remaining.get(teamId) || 0) > 0);
            if (!active.length) {
                break;
            }
            if (active.length === 1) {
                throw new Error("Invalid setup: one team has remaining matches but cannot be paired");
            }

            active.sort((a, b) => {
                const remDiff = (remaining.get(b) || 0) - (remaining.get(a) || 0);
                if (remDiff !== 0) {
                    return remDiff;
                }
                return randomOrder.get(a) - randomOrder.get(b);
            });

            const homeTeamId = active[0];
            const candidates = active.slice(1).sort((a, b) => {
                const keyA = getPairKey(homeTeamId, a);
                const keyB = getPairKey(homeTeamId, b);
                const meetingsDiff = (meetings.get(keyA) || 0) - (meetings.get(keyB) || 0);
                if (meetingsDiff !== 0) {
                    return meetingsDiff;
                }
                const remDiff = (remaining.get(b) || 0) - (remaining.get(a) || 0);
                if (remDiff !== 0) {
                    return remDiff;
                }
                return randomOrder.get(a) - randomOrder.get(b);
            });

            const awayTeamId = candidates[0];
            if (!awayTeamId) {
                throw new Error("Could not build phase 1 pairings with current setup");
            }

            pairs.push({ homeTeamId: homeTeamId, awayTeamId: awayTeamId });
            remaining.set(homeTeamId, (remaining.get(homeTeamId) || 0) - 1);
            remaining.set(awayTeamId, (remaining.get(awayTeamId) || 0) - 1);
            const pairKey = getPairKey(homeTeamId, awayTeamId);
            meetings.set(pairKey, (meetings.get(pairKey) || 0) + 1);

            guard += 1;
            if (guard > maxGuard) {
                throw new Error("Scheduler guard reached, unable to generate phase 1 schedule");
            }
        }
        return pairs;
    }

    function groupPairsIntoRounds(pairs, terrainCount) {
        const rounds = [];
        // a round is matches played at the same time, so it can never have more matches than terrains
        const capacity = terrainCount > 0 ? terrainCount : Infinity;

        pairs.forEach((pair) => {
            let placed = false;
            for (let index = 0; index < rounds.length; index += 1) {
                const round = rounds[index];
                if (round.length >= capacity) {
                    continue;
                }
                const collision = round.some((existing) => {
                    return existing.homeTeamId === pair.homeTeamId ||
                        existing.homeTeamId === pair.awayTeamId ||
                        existing.awayTeamId === pair.homeTeamId ||
                        existing.awayTeamId === pair.awayTeamId;
                });
                if (!collision) {
                    round.push(pair);
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                rounds.push([pair]);
            }
        });
        return rounds;
    }

    function buildPhase1Matches(teamIds, terrainIds, uid, matchesPerTeam) {
        const pairSequence = buildPairSequence(teamIds, matchesPerTeam);
        const rounds = groupPairsIntoRounds(pairSequence, terrainIds.length);
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
                    status: "scheduled",
                    pausedAt: null,
                    pausedTotalMs: 0,
                    finalElapsedMs: null
                });
            });
        });

        return matches;
    }

    window.TournamentScheduler = {
        buildPhase1Matches: buildPhase1Matches
    };
})();

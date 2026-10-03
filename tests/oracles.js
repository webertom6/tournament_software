"use strict";

const assert = require("node:assert/strict");
const DEFAULT = {
    version: 1,
    config: {
        POINT_VICTORY_PHASE1: 3, POINT_DRAW_PHASE1: 1, POINT_LOSS_PHASE1: 0,
        phase1MatchesPerTeam: 3, qualifiedCount: 4, seedingPolicy: "ranking", thirdPlaceMatch: false,
        matchDurationSeconds: 600, pauseDurationSeconds: 180
    },
    teams: [], terrains: [],
    phase1: { generated: false, matches: [], roundTimers: {} },
    knockout: { generated: false, rounds: [], thirdPlace: null, championTeamId: null },
    audit: []
};
const EXPORTS = {
    TournamentState: ["uid", "load", "save", "resetAll", "subscribe", "update", "getState", "exportState", "importState"],
    TournamentTimer: ["computeRoundElapsedMs", "computeElapsedMs", "computeBreakRemainingMs", "formatDuration", "formatCountdown"],
    TournamentRules: ["getTeamNameById", "getWinnerTeamId", "getLoserTeamId", "buildStandings", "getStandingsBestValues"],
    TournamentScheduler: ["buildPhase1Matches"],
    TournamentBracket: ["normalizeQualifiedCount", "generateKnockoutStructure", "recomputeKnockout", "clearDownstreamFromMatch"],
    TournamentActions: ["addTeam", "removeTeam", "addTerrain", "removeTerrain", "updateConfig", "generatePhase1", "applyPhase1Score",
        "reopenPhase1Match", "resetPhases", "backToPhase1", "startKnockout", "applyKnockoutScore", "reopenKnockoutMatch",
        "startPhase1RoundTimer", "startKnockoutRoundTimer", "stopPhase1RoundTimer", "stopKnockoutRoundTimer",
        "pausePhase1RoundTimer", "resumePhase1RoundTimer", "pauseKnockoutRoundTimer", "resumeKnockoutRoundTimer",
        "pauseMatchTimer", "resumeMatchTimer", "exportStateToDownload", "importStateFromText", "resetAll"],
    TournamentRender: ["bindEvents", "renderApp", "tickTimers"]
};
const HEADERS = ["#", "Team", "P", "W", "D", "L", "GT", "GC", "GA", "GD", "Last", "Best", "Pts"];
const ACTIONS = ["scroll-top", "progress-jump", "round-toggle", "team-remove", "terrain-remove",
    "phase1-save", "phase1-reopen", "ko-save", "ko-reopen", "phase1-start-round", "phase1-stop-round",
    "phase1-pause-round", "phase1-resume-round", "ko-start-round", "ko-stop-round", "ko-pause-round",
    "ko-resume-round", "match-pause", "match-resume"];
function referenceStandings(state) {
    const rows = state.teams.map((team) => ({
        teamId: team.id, teamName: team.name, played: 0, wins: 0, draws: 0, losses: 0,
        gt: 0, gc: 0, ga: 0, gd: 0, bestScore: 0, lastScore: null, points: 0
    }));
    for (const match of state.phase1.matches) {
        if (match.status !== "completed" || !Number.isFinite(match.homeGoals) || !Number.isFinite(match.awayGoals)) continue;
        const home = rows.find((row) => row.teamId === match.homeTeamId);
        const away = rows.find((row) => row.teamId === match.awayTeamId);
        if (!home || !away) continue;
        for (const [row, goals, conceded] of [[home, match.homeGoals, match.awayGoals], [away, match.awayGoals, match.homeGoals]]) {
            row.played++;
            row.gt += goals;
            row.gc += conceded;
            row.lastScore = goals;
            row.bestScore = Math.max(row.bestScore, goals);
            const outcome = goals === conceded ? "draws" : goals > conceded ? "wins" : "losses";
            row[outcome]++;
            const configKey = { wins: "POINT_VICTORY_PHASE1", draws: "POINT_DRAW_PHASE1", losses: "POINT_LOSS_PHASE1" }[outcome];
            row.points += Number(state.config[configKey]) || 0;
        }
    }
    rows.sort((a, b) => b.points - a.points ||
        b.gt * (a.played || 1) - a.gt * (b.played || 1) ||
        a.gc - b.gc || (a.teamName < b.teamName ? -1 : a.teamName > b.teamName ? 1 : 0));
    return rows.map((row, index) => Object.assign(row, {
        ga: row.played ? row.gt / row.played : 0, gd: row.gt - row.gc, rank: index + 1
    }));
}
function scheduleInvariants(matches, teamIds, terrainIds, perTeam, uniquePairs = false) {
    assert.equal(matches.length, teamIds.length * perTeam / 2);
    assert.equal(new Set(matches.map((match) => match.id)).size, matches.length);
    const counts = new Map(teamIds.map((id) => [id, 0]));
    const rounds = new Map();
    const pairs = new Set();
    for (const match of matches) {
        assert.ok(counts.has(match.homeTeamId) && counts.has(match.awayTeamId));
        assert.notEqual(match.homeTeamId, match.awayTeamId);
        counts.set(match.homeTeamId, counts.get(match.homeTeamId) + 1);
        counts.set(match.awayTeamId, counts.get(match.awayTeamId) + 1);
        if (!rounds.has(match.roundIndex)) rounds.set(match.roundIndex, []);
        rounds.get(match.roundIndex).push(match);
        assert.ok(terrainIds.length ? terrainIds.includes(match.terrainId) : match.terrainId === null);
        const pair = [match.homeTeamId, match.awayTeamId].sort().join("/");
        if (uniquePairs) assert.ok(!pairs.has(pair), "Repeated pair " + pair);
        pairs.add(pair);
        assert.equal(match.phase, "phase1");
        assert.equal(match.status, "scheduled");
        assert.equal(match.homeGoals, null);
        assert.equal(match.awayGoals, null);
        assert.equal(match.pausedAt, null);
        assert.equal(match.pausedTotalMs, 0);
        assert.equal(match.finalElapsedMs, null);
    }
    for (const count of counts.values()) assert.equal(count, perTeam);
    assert.deepEqual([...rounds.keys()], Array.from({ length: rounds.size }, (_, i) => i));
    for (const round of rounds.values()) {
        if (terrainIds.length) assert.ok(round.length <= terrainIds.length);
        assert.equal(new Set(round.flatMap((match) => [match.homeTeamId, match.awayTeamId])).size, round.length * 2);
        assert.equal(new Set(round.map((match) => match.slotIndex)).size, round.length);
        if (terrainIds.length) assert.equal(new Set(round.map((match) => match.terrainId)).size, round.length);
    }
    return rounds;
}
function bracketInvariants(knockout, qualified, thirdPlace, terrains) {
    let size = 2;
    while (size < qualified.length) size *= 2;
    const rounds = knockout.rounds;
    const compactByes = size - qualified.length === 2;
    assert.equal(rounds.length, Math.log2(size));
    const expectedRoundSizes = [compactByes ? size / 2 - 1 : size / 2];
    while (expectedRoundSizes.length < rounds.length) {
        const previousSize = expectedRoundSizes.at(-1);
        expectedRoundSizes.push(compactByes ? Math.ceil(previousSize / 2) : previousSize / 2);
    }
    assert.deepEqual(rounds.map((round) => round.matches.length), expectedRoundSizes);
    const all = rounds.flatMap((round) => round.matches);
    assert.equal(new Set(all.map((match) => match.id)).size, all.length);
    const participants = rounds[0].matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean);
    assert.deepEqual([...participants].sort(), [...qualified].sort());
    assert.equal(rounds[0].matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter((id) => id === null).length,
        compactByes ? 0 : size - qualified.length);
    for (let r = 0; r < rounds.length; r++) {
        const round = rounds[r];
        assert.equal(round.roundIndex, r);
        assert.equal(round.startedAt, null);
        assert.equal(round.stoppedAt, null);
        assert.equal(round.pausedAt, null);
        assert.equal(round.pausedTotalMs, 0);
        round.matches.forEach((match, slot) => {
            assert.equal(match.roundIndex, r);
            assert.equal(match.slotIndex, slot);
            assert.equal(match.phase, "knockout");
            assert.ok(terrains.length ? terrains.includes(match.terrainId) : match.terrainId === null);
            if (r + 1 < rounds.length) {
                const nextRound = rounds[r + 1];
                const next = nextRound.matches.find((candidate) =>
                    candidate.homeSourceMatchId === match.id || candidate.awaySourceMatchId === match.id);
                assert.ok(next);
                assert.equal(match.nextMatchId, next.id);
                assert.equal(match.nextSlot, next.homeSourceMatchId === match.id ? "home" : "away");
            } else assert.equal(match.nextMatchId, null);
            if (r) {
                const sources = [match.homeSourceMatchId, match.awaySourceMatchId].filter(Boolean);
                assert.equal(sources.length, match.isBye ? 1 : 2);
                assert.ok(sources.every((sourceId) => rounds[r - 1].matches.some((source) => source.id === sourceId)));
                assert.equal(Boolean(match.isBye), sources.length === 1);
            } else if (!compactByes) {
                assert.equal(Boolean(match.isBye), Boolean(match.homeTeamId) !== Boolean(match.awayTeamId));
            } else {
                assert.equal(match.isBye, false);
            }
        });
    }
    const semiRound = rounds.length >= 2 ? rounds.at(-2) : null;
    const hasPlayableSemifinals = semiRound && semiRound.matches.length === 2 && semiRound.matches.every((match) => !match.isBye);
    assert.equal(Boolean(knockout.thirdPlace), Boolean(thirdPlace && hasPlayableSemifinals));
    if (knockout.thirdPlace) {
        assert.equal(knockout.thirdPlace.homeSourceMatchId, rounds.at(-2).matches[0].id);
        assert.equal(knockout.thirdPlace.awaySourceMatchId, rounds.at(-2).matches[1].id);
    }
}
function handFixture(sandbox) {
    const state = sandbox.state();
    state.teams = ["A", "B", "C", "D"].map((name) => ({ id: name, name }));
    state.phase1.generated = true;
    state.phase1.matches = [["A", "B", 2, 0], ["C", "D", 1, 1], ["A", "C", 0, 3], ["B", "D", 4, 4], ["A", "D", null, null]]
        .map(([homeTeamId, awayTeamId, homeGoals, awayGoals], index) => ({
            id: "h" + index, phase: "phase1", roundIndex: index, slotIndex: 0, terrainId: null,
            homeTeamId, awayTeamId, homeGoals, awayGoals, status: homeGoals === null ? "scheduled" : "completed",
            pausedAt: null, pausedTotalMs: 0, finalElapsedMs: null
        }));
    return state;
}
module.exports = { DEFAULT, EXPORTS, HEADERS, ACTIONS, referenceStandings, scheduleInvariants, bracketInvariants, handFixture };

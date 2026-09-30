"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSandbox, plain } = require("./harness");
const { scheduleInvariants } = require("./oracles");

test("scheduler: exact validation errors", () => {
    const s = createSandbox();
    const build = (ids, count) => s.window.TournamentScheduler.buildPhase1Matches(ids, [], s.S.uid, count);
    for (const [ids, count, message] of [
        [["a", "b"], 0, "Phase 1 matches per team must be >= 1"],
        [["a"], 1, "Need at least 2 teams for phase 1"],
        [["a", "b", "c"], 1, "Invalid setup: team count (3) x phase 1 matches per team (1) must be even"]
    ]) assert.throws(() => build(ids, count), (error) => error.message === message);
});
test("scheduler: independent invariant sweep n2..12, per-team1..4, fields0/1/3, seeds1..5", () => {
    const s = createSandbox();
    for (let n = 2; n <= 12; n++) for (let per = 1; per <= 4; per++) {
        if (n * per % 2) continue;
        for (const fieldCount of [0, 1, 3]) for (let seed = 1; seed <= 5; seed++) {
            s.seed(seed);
            const teams = Array.from({ length: n }, (_, i) => "t" + i);
            const fields = Array.from({ length: fieldCount }, (_, i) => "f" + i);
            const matches = plain(s.window.TournamentScheduler.buildPhase1Matches(teams, fields, s.S.uid, per));
            const rounds = scheduleInvariants(matches, teams, fields, per);
            if (fieldCount === 1) assert.equal(rounds.size, matches.length);
            for (const match of matches) {
                assert.match(match.id, /^p1m_[a-z0-9]+_[a-z0-9]{1,6}$/);
                assert.deepEqual(Object.keys(match), ["id", "phase", "roundIndex", "slotIndex", "homeTeamId", "awayTeamId",
                    "terrainId", "homeGoals", "awayGoals", "status", "pausedAt", "pausedTotalMs", "finalElapsedMs"]);
            }
        }
    }
});
test("scheduler: same seed byte-identical; different seed changes pair order", () => {
    const generate = (seed) => {
        const s = createSandbox({ seed });
        return JSON.stringify(s.window.TournamentScheduler.buildPhase1Matches(["a", "b", "c", "d", "e", "f", "g", "h"], ["f1", "f2", "f3"], s.S.uid, 3));
    };
    assert.equal(generate(12), generate(12));
    assert.notEqual(generate(12), generate(13));
});

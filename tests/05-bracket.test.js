"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSandbox, plain, knockoutFixture, scoreWinner } = require("./harness");
const { bracketInvariants } = require("./oracles");

test("bracket: normalizeQualifiedCount literal table", () => {
    const s = createSandbox();
    for (const [teams, requested, expected] of [[0, 4, 0], [1, 4, 1], [2, 4, 2], [10, 4, 4],
        [10, 3.9, 3], [10, "5", 5], [10, 1, 2], [10, -5, 2], [10, 0, 2],
        [10, null, 2], [10, undefined, 2], [10, "x", 2], [10, NaN, 2], [10, Infinity, 10], [10, 99, 10]]) {
        assert.equal(s.B.normalizeQualifiedCount(teams, requested), expected);
    }
});
test("bracket: handwritten seed pairs Q2/3/5/6/8/12/20", () => {
    const s = createSandbox();
    const pairs = {
        2: [[1, 2]], 3: [[1, null], [2, 3]],
        5: [[1, null], [4, 5], [2, null], [3, null]],
        6: [[1, null], [4, 5], [2, null], [3, 6]],
        8: [[1, 8], [4, 5], [2, 7], [3, 6]],
        12: [[1, null], [8, 9], [4, null], [5, 12], [2, null], [7, 10], [3, null], [6, 11]],
        20: [[1, null], [16, 17], [8, null], [9, null], [4, null], [13, 20], [5, null], [12, null],
            [2, null], [15, 18], [7, null], [10, null], [3, null], [14, 19], [6, null], [11, null]]
    };
    for (const [count, expected] of Object.entries(pairs)) {
        const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
        const ko = s.B.generateKnockoutStructure(ids, { qualifiedCount: Number(count), seedingPolicy: "ranking" }, s.S.uid);
        assert.deepEqual(plain(ko.rounds[0].matches.map((match) => [match.homeTeamId, match.awayTeamId])), expected);
    }
});
test("bracket: round name literals and structure sweep Q2..33, third on/off, fields0/3", () => {
    const s = createSandbox();
    const names = { 1: ["Final"], 2: ["Semifinal", "Final"], 3: ["Quarterfinal", "Semifinal", "Final"],
        5: ["Round 1", "Round 2", "Quarterfinal", "Semifinal", "Final"] };
    for (let q = 2; q <= 33; q++) for (const third of [false, true]) for (const fields of [[], ["f1", "f2", "f3"]]) {
        const ids = Array.from({ length: q }, (_, i) => "t" + i);
        const ko = plain(s.B.generateKnockoutStructure(ids, { qualifiedCount: q, thirdPlaceMatch: third }, s.S.uid, fields));
        bracketInvariants(ko, ids, third, fields);
        if (names[ko.rounds.length]) assert.deepEqual(ko.rounds.map((round) => round.name), names[ko.rounds.length]);
    }
});
test("bracket: random seeding deterministic and preserves qualifier set", () => {
    const generate = (seed, policy) => {
        const s = createSandbox({ seed });
        return plain(s.B.generateKnockoutStructure(["a", "b", "c", "d", "e", "f"], { qualifiedCount: 5, seedingPolicy: policy }, s.S.uid, []));
    };
    assert.deepEqual(generate(1, "random"), generate(1, "random"));
    assert.notDeepEqual(generate(1, "random"), generate(2, "random"));
    bracketInvariants(generate(1, "random"), ["a", "b", "c", "d", "e"], false, []);
});
test("bracket: recompute no-op/no-round, home/away/empty BYEs and propagation idempotence", () => {
    const s = createSandbox();
    s.state().knockout.championTeamId = "sentinel";
    s.B.recomputeKnockout(s.state());
    assert.equal(s.state().knockout.championTeamId, "sentinel");
    s.B.clearDownstreamFromMatch(s.state(), "missing");
    s.state().knockout.generated = true;
    s.B.recomputeKnockout(s.state());
    assert.equal(s.state().knockout.championTeamId, null);
    const ko = s.B.generateKnockoutStructure(["a", "b", "c", "d", "e"], { qualifiedCount: 5 }, s.S.uid, []);
    s.state().knockout = { generated: true, ...ko };
    const first = ko.rounds[0].matches;
    first[2].awayTeamId = first[2].homeTeamId; first[2].homeTeamId = null;
    first[3].homeTeamId = null; first[3].awayTeamId = null;
    s.B.recomputeKnockout(s.state());
    assert.deepEqual(plain(first.map((m) => [m.status, m.homeGoals, m.awayGoals])), [
        ["completed", 1, 0], ["scheduled", null, null], ["completed", 0, 1], ["scheduled", null, null]
    ]);
    assert.equal(ko.rounds[1].matches[0].homeTeamId, "a");
    assert.equal(ko.rounds[1].matches[0].awayTeamId, null);
    assert.equal(ko.rounds[1].matches[0].status, "scheduled");
    const before = JSON.stringify(s.state());
    s.B.recomputeKnockout(s.state());
    s.B.clearDownstreamFromMatch(s.state(), "missing");
    assert.equal(JSON.stringify(s.state()), before);
});
test("bracket: Q4 third place losers, champion, and downstream chain excludes siblings/third", () => {
    const s = knockoutFixture();
    const [left, right] = s.state().knockout.rounds[0].matches;
    scoreWinner(s, left, left.homeTeamId); scoreWinner(s, right, right.awayTeamId);
    const third = s.state().knockout.thirdPlace;
    assert.equal(third.homeTeamId, left.awayTeamId);
    assert.equal(third.awayTeamId, right.homeTeamId);
    assert.ok(third.homeTeamId && third.awayTeamId);
    scoreWinner(s, third, third.homeTeamId);
    const final = s.state().knockout.rounds[1].matches[0];
    scoreWinner(s, final, final.homeTeamId);
    assert.equal(s.state().knockout.championTeamId, final.homeTeamId);
    const sibling = JSON.stringify(right);
    const tp = JSON.stringify(third);
    s.B.clearDownstreamFromMatch(s.state(), left.id);
    assert.equal(final.status, "scheduled");
    assert.equal(final.homeGoals, null);
    assert.equal(final.awayGoals, null);
    assert.equal(final.pausedAt, null);
    assert.equal(final.pausedTotalMs, 0);
    assert.equal(final.finalElapsedMs, null);
    assert.equal(s.state().knockout.championTeamId, null);
    assert.equal(JSON.stringify(right), sibling);
    assert.equal(JSON.stringify(third), tp);
});

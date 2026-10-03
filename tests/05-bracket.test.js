"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSandbox, setup, plain, knockoutFixture, scoreWinner } = require("./harness");
const { bracketInvariants } = require("./oracles");

test("bracket: power-of-two qualifier choices and strict validation", () => {
    const s = createSandbox();
    for (const [teams, expected] of [[0, []], [1, []], [2, [2]], [3, [2]], [8, [2, 4, 8]], [10, [2, 4, 8]], [16, [2, 4, 8, 16]]]) {
        assert.deepEqual(plain(s.B.getAllowedQualifiedCounts(teams)), expected);
    }
    for (const [teams, requested] of [[10, 2], [10, 4], [10, 8], [8, "4"]]) {
        assert.equal(s.B.normalizeQualifiedCount(teams, requested), Number(requested));
    }
    for (const [teams, requested] of [[10, 0], [10, 1], [10, 3], [10, 5], [10, 6], [10, 10],
        [10, 11], [10, 4.5], [10, "x"], [10, NaN], [10, Infinity], [1, 2]]) {
        assert.throws(() => s.B.normalizeQualifiedCount(teams, requested), /power of two/);
    }
});
test("bracket: handwritten seed pairs Q2/4/8/16", () => {
    const s = createSandbox();
    const pairs = {
        2: [[1, 2]],
        4: [[1, 4], [2, 3]],
        8: [[1, 8], [4, 5], [2, 7], [3, 6]],
        16: [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]]
    };
    for (const [count, expected] of Object.entries(pairs)) {
        const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
        const ko = s.B.generateKnockoutStructure(ids, { qualifiedCount: Number(count), seedingPolicy: "ranking" }, s.S.uid);
        assert.deepEqual(plain(ko.rounds[0].matches.map((match) => [match.homeTeamId, match.awayTeamId])), expected);
    }
});
test("bracket: rejects non-power-of-two qualifiers before starting phase 1", () => {
    const s = createSandbox();
    setup(s, 8, 2, { qualifiedCount: 6, thirdPlaceMatch: true });
    assert.throws(() => s.A.generatePhase1(), /power of two/);
    assert.equal(s.state().phase1.generated, false);
});
test("bracket: round name literals and structure sweep Q2..33, third on/off, fields0/3", () => {
    const s = createSandbox();
    const names = {
        1: ["Final"],
        2: ["Semifinal", "Final"],
        3: ["Quarterfinal", "Semifinal", "Final"],
        4: ["Round of 16", "Quarterfinal", "Semifinal", "Final"],
        5: ["Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final"]
    };
    for (let q = 2; q <= 32; q *= 2) for (const third of [false, true]) for (const fields of [[], ["f1", "f2", "f3"]]) {
        const ids = Array.from({ length: q }, (_, i) => "t" + i);
        const ko = plain(s.B.generateKnockoutStructure(ids, { qualifiedCount: q, thirdPlaceMatch: third }, s.S.uid, fields));
        bracketInvariants(ko, ids, third, fields);
        if (names[ko.rounds.length]) assert.deepEqual(ko.rounds.map((round) => round.name), names[ko.rounds.length]);
    }
    for (const q of [3, 5, 6, 7, 9, 10, 12, 14, 15, 17, 20]) {
        const ids = Array.from({ length: q }, (_, i) => "t" + i);
        assert.throws(() => s.B.generateKnockoutStructure(ids, { qualifiedCount: q }, s.S.uid, []), /power of two/);
    }
});
test("bracket: random seeding deterministic and preserves qualifier set", () => {
    const generate = (seed, policy) => {
        const s = createSandbox({ seed });
        return plain(s.B.generateKnockoutStructure(["a", "b", "c", "d", "e", "f", "g", "h"],
            { qualifiedCount: 8, seedingPolicy: policy }, s.S.uid, []));
    };
    assert.deepEqual(generate(1, "random"), generate(1, "random"));
    assert.notDeepEqual(generate(1, "random"), generate(2, "random"));
    bracketInvariants(generate(1, "random"), ["a", "b", "c", "d", "e", "f", "g", "h"], false, []);
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
    const ko = s.B.generateKnockoutStructure(["a", "b", "c", "d", "e", "f", "g", "h"], { qualifiedCount: 8 }, s.S.uid, []);
    s.state().knockout = { generated: true, ...ko };
    const first = ko.rounds[0].matches;
    first[0].homeTeamId = "a"; first[0].awayTeamId = null;
    first[2].homeTeamId = "c"; first[2].awayTeamId = null;
    first[3].homeTeamId = null; first[3].awayTeamId = null;
    first[0].isBye = true; first[2].isBye = true; first[3].isBye = true;
    s.B.recomputeKnockout(s.state());
    assert.deepEqual(plain(first.map((m) => [m.status, m.homeGoals, m.awayGoals])), [
        ["completed", 1, 0], ["scheduled", null, null], ["completed", 1, 0], ["scheduled", null, null]
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

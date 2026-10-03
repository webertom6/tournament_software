"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSandbox, plain, setup } = require("./harness");
const { handFixture, referenceStandings } = require("./oracles");

test("rules: names and winner/loser edge cases", () => {
    const s = createSandbox(); setup(s);
    assert.equal(s.R.getTeamNameById(s.state(), "t1"), "Team 01");
    assert.equal(s.R.getTeamNameById(s.state(), "missing"), "TBD");
    for (const match of [null, {}, { status: "scheduled", homeGoals: 2, awayGoals: 1 },
        { status: "completed", homeGoals: 1, awayGoals: 1 },
        { status: "completed", homeGoals: NaN, awayGoals: 1 },
        { status: "completed", homeGoals: 1, awayGoals: Infinity }]) {
        assert.equal(s.R.getWinnerTeamId(match), null);
        assert.equal(s.R.getLoserTeamId(match), null);
    }
    for (const [home, away, winner, loser] of [[2, 1, "a", "b"], [1, 2, "b", "a"]]) {
        const match = { status: "completed", homeGoals: home, awayGoals: away, homeTeamId: "a", awayTeamId: "b" };
        assert.equal(s.R.getWinnerTeamId(match), winner);
        assert.equal(s.R.getLoserTeamId(match), loser);
        match.homeTeamId = null;
        assert.equal(s.R.getWinnerTeamId(match), winner === "a" ? null : "b");
        assert.equal(s.R.getLoserTeamId(match), loser === "a" ? null : "b");
    }
});
test("rules: hand-computed four-team standings and best values", () => {
    const s = createSandbox(); handFixture(s);
    const expected = [
        ["C", 2, 1, 1, 0, 4, 1, 2, 3, 3, 3, 4],
        ["A", 2, 1, 0, 1, 2, 3, 1, -1, 0, 2, 3],
        ["D", 2, 0, 2, 0, 5, 5, 2.5, 0, 4, 4, 2],
        ["B", 2, 0, 1, 1, 4, 6, 2, -2, 4, 4, 1]
    ].map(([teamId, played, wins, draws, losses, gt, gc, ga, gd, lastScore, bestScore, points], i) => ({
        teamId, teamName: teamId, played, wins, draws, losses, gt, gc, ga, gd, bestScore, lastScore, points, rank: i + 1
    }));
    assert.deepEqual(plain(s.R.buildStandings(s.state())), expected);
    assert.deepEqual(referenceStandings(s.state()), expected);
    assert.deepEqual(plain(s.R.getStandingsBestValues(expected)), {
        wins: 1, losses: 0, gt: 5, gc: 1, ga: 2.5, gd: 3, lastScore: 4, bestScore: 4, points: 4
    });
});
test("rules: tie order GA then GC then ASCII name; equal ratios use GC", () => {
    const s = createSandbox();
    const state = s.state();
    state.config.POINT_VICTORY_PHASE1 = state.config.POINT_DRAW_PHASE1 = state.config.POINT_LOSS_PHASE1 = 0;
    state.teams = ["P", "Q", "S", "R", "Y", "X", "Z"].map((name) => ({ id: name, name }));
    const literals = [["X", 6, 0], ["Y", 5, 0], ["R", 4, 0], ["S", 4, 0], ["Q", 4, 1], ["P", 4, 2]];
    state.phase1.matches = literals.map(([homeTeamId, homeGoals, awayGoals]) => ({
        homeTeamId, awayTeamId: "Z", homeGoals, awayGoals, status: "completed"
    }));
    // X: 12/2 = 6; everyone else has one match. Same ratio, different played count.
    state.phase1.matches.push({ homeTeamId: "X", awayTeamId: "Z", homeGoals: 6, awayGoals: 0, status: "completed" });
    assert.deepEqual(plain(s.R.buildStandings(state)).slice(0, 6).map((row) => row.teamId), ["X", "Y", "R", "S", "Q", "P"]);
    assert.deepEqual(plain(s.R.buildStandings(state)), referenceStandings(state));
    state.phase1.matches[0].homeGoals = 2;
    state.phase1.matches.at(-1).homeGoals = 6; // X 8/2 = 4, ties R/S/Q/P, GC decides.
    assert.deepEqual(plain(s.R.buildStandings(state)).slice(0, 6).map((row) => row.teamId), ["Y", "R", "S", "X", "Q", "P"]);
});
test("rules: custom/nonnumeric points, invalid IDs/scores and schedule-order Last", () => {
    const s = createSandbox(); handFixture(s);
    Object.assign(s.state().config, { POINT_VICTORY_PHASE1: "7", POINT_DRAW_PHASE1: "x", POINT_LOSS_PHASE1: "2" });
    s.state().phase1.matches.push(
        { homeTeamId: "unknown", awayTeamId: "A", homeGoals: 99, awayGoals: 0, status: "completed" },
        { homeTeamId: "A", awayTeamId: "B", homeGoals: Infinity, awayGoals: 0, status: "completed" });
    assert.deepEqual(plain(s.R.buildStandings(s.state())), referenceStandings(s.state()));
    const rows = s.R.buildStandings(s.state());
    assert.equal(rows.find((row) => row.teamId === "A").points, 9);
    assert.equal(rows.find((row) => row.teamId === "D").points, 0);
    s.state().phase1.matches.reverse();
    assert.equal(s.R.buildStandings(s.state()).find((row) => row.teamId === "A").lastScore, 2);
});
test("rules: highlighting empty/unplayed/identical/null Last and tied maxima", () => {
    const s = createSandbox();
    const empty = { wins: null, losses: null, gt: null, gc: null, ga: null, gd: null, lastScore: null, bestScore: null, points: null };
    assert.deepEqual(plain(s.R.getStandingsBestValues([])), empty);
    setup(s);
    assert.deepEqual(plain(s.R.getStandingsBestValues(s.R.buildStandings(s.state()))), empty);
    handFixture(s);
    const row = s.R.buildStandings(s.state())[0];
    assert.deepEqual(plain(s.R.getStandingsBestValues([row, row])), empty);
    const tied = [{ ...row, lastScore: null }, { ...row, gt: 8, lastScore: null }, { ...row, gt: 8, lastScore: 0 }];
    const values = s.R.getStandingsBestValues(tied);
    assert.equal(values.gt, 8);
    assert.equal(values.lastScore, 0);
    assert.equal(values.wins, null);
    assert.equal(s.R.getStandingsBestValues(tied.slice(0, 2)).lastScore, null);
});

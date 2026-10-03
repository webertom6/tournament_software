"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSandbox, plain, setup, completePhase1, knockoutFixture, scoreWinner, expectRejected, STATE_KEY } = require("./harness");
const { DEFAULT, referenceStandings } = require("./oracles");

test("actions: setup names, required/duplicate/unknown, lock and reset unlock", () => {
    const s = createSandbox();
    for (const [method, noun] of [["addTeam", "Team"], ["addTerrain", "Terrain"]]) {
        expectRejected(s, () => s.A[method](" \t "), noun + " name is required");
        s.A[method]("  Red \t Tigers  ");
        expectRejected(s, () => s.A[method]("red tigers"), noun + " name already exists");
    }
    assert.equal(s.state().teams[0].name, "Red Tigers");
    assert.equal(s.state().terrains[0].name, "Red Tigers");
    expectRejected(s, () => s.A.removeTeam("missing"), "Team not found");
    expectRejected(s, () => s.A.removeTerrain("missing"), "Terrain not found");
    s.A.removeTeam(s.state().teams[0].id); s.A.removeTerrain(s.state().terrains[0].id);
    assert.equal(s.state().teams.length, 0); assert.equal(s.state().terrains.length, 0);
    setup(s);
    s.A.generatePhase1();
    const locked = "Cannot edit teams or terrains after phase 1 is generated. Reset state to restart.";
    for (const fn of [() => s.A.addTeam("New"), () => s.A.addTerrain("New"), () => s.A.removeTeam("t1"), () => s.A.removeTerrain("f1")]) {
        expectRejected(s, fn, locked);
    }
    expectRejected(s, () => s.A.updateConfig(DEFAULT.config), "Cannot change config after phase 1 is generated. Reset phases to restart.");
    s.A.resetPhases(); s.A.addTeam("Unlocked"); s.A.addTerrain("Unlocked");
    assert.equal(s.state().teams.length, 5);
});
test("actions: config coercions and exact boundary errors", () => {
    const s = createSandbox();
    setup(s, 10, 2, { qualifiedCount: 8 });
    const cases = [
        ["POINT_VICTORY_PHASE1", "POINT_VICTORY_PHASE1 must be >= 0", [-1, "x", Infinity]],
        ["POINT_DRAW_PHASE1", "POINT_DRAW_PHASE1 must be >= 0", [-1, NaN]],
        ["POINT_LOSS_PHASE1", "POINT_LOSS_PHASE1 must be >= 0", [-1, undefined]],
        ["phase1MatchesPerTeam", "Phase 1 matches per team must be an integer >= 1", [0, -1, 1.5, "x"]],
        ["qualifiedCount", /Qualified count must be a power of two/, [1, 3, 5, 6, 10, 11, 4.5, "x"]],
        ["matchDurationSeconds", "Match duration must be >= 1 second", [0, "x"]],
        ["pauseDurationSeconds", "Pause duration must be >= 1 second", [0, "x"]]
    ];
    for (const [key, message, values] of cases) for (const value of values) {
        expectRejected(s, () => s.A.updateConfig({ ...DEFAULT.config, [key]: value }), message);
    }
    s.A.updateConfig({ ...DEFAULT.config, POINT_VICTORY_PHASE1: "0", POINT_DRAW_PHASE1: "0", POINT_LOSS_PHASE1: "0",
        phase1MatchesPerTeam: "1", qualifiedCount: "2", seedingPolicy: "unknown", thirdPlaceMatch: 1,
        matchDurationSeconds: "1", pauseDurationSeconds: "1" });
    assert.deepEqual(plain(s.state().config), { ...DEFAULT.config, POINT_VICTORY_PHASE1: 0, POINT_DRAW_PHASE1: 0,
        POINT_LOSS_PHASE1: 0, phase1MatchesPerTeam: 1, qualifiedCount: 2, seedingPolicy: "ranking",
        thirdPlaceMatch: true, matchDurationSeconds: 1, pauseDurationSeconds: 1 });
    s.state().knockout.generated = true;
    s.A.updateConfig({ ...DEFAULT.config, seedingPolicy: "random" });
    assert.equal(s.state().config.seedingPolicy, "random");
    assert.deepEqual(plain(s.state().knockout), DEFAULT.knockout);
});
test("actions: phase generation/scoring rejection atomicity, substitutions, invalidation and reopen", () => {
    const s = createSandbox();
    expectRejected(s, () => s.A.generatePhase1(), "Need at least 2 teams");
    setup(s, 3, 1, { qualifiedCount: 2, phase1MatchesPerTeam: 1 });
    expectRejected(s, () => s.A.generatePhase1(), "Invalid setup: team count (3) x phase 1 matches per team (1) must be even");
    setup(s); s.A.generatePhase1();
    const m = s.state().phase1.matches[0];
    for (const value of [-1, 0.5, "x", Infinity]) {
        expectRejected(s, () => s.A.applyPhase1Score(m.id, undefined, undefined, value, 0), "Home goals must be an integer >= 0");
        expectRejected(s, () => s.A.applyPhase1Score(m.id, undefined, undefined, 0, value), "Away goals must be an integer >= 0");
    }
    expectRejected(s, () => s.A.applyPhase1Score("missing", undefined, undefined, 1, 0), "Phase 1 match not found");
    expectRejected(s, () => s.A.applyPhase1Score(m.id, null, m.awayTeamId, 1, 0), "Both teams must be assigned");
    expectRejected(s, () => s.A.applyPhase1Score(m.id, "t1", "t1", 1, 0), "Home and away teams must be different");
    expectRejected(s, () => s.A.applyPhase1Score(m.id, "unknown", "t1", 1, 0), "Selected team not found");
    expectRejected(s, () => s.A.reopenPhase1Match("missing"), "Phase 1 match not found");
    s.A.applyPhase1Score(m.id, "t1", "t2", "4", "4");
    assert.equal(m.homeTeamId, "t1"); assert.equal(m.awayTeamId, "t2");
    assert.equal(m.finalElapsedMs, null);
    assert.deepEqual(plain(s.R.buildStandings(s.state())), referenceStandings(s.state()));
    completePhase1(s); s.A.startKnockout();
    s.A.reopenPhase1Match(m.id);
    assert.equal(m.status, "scheduled"); assert.equal(m.homeGoals, 2); assert.equal(m.finalElapsedMs, null);
    assert.deepEqual(plain(s.state().knockout), DEFAULT.knockout);
    s.A.applyPhase1Score(m.id, undefined, undefined, 0, 1); s.A.startKnockout();
    s.A.applyPhase1Score(m.id, undefined, undefined, 2, 1);
    assert.deepEqual(plain(s.state().knockout), DEFAULT.knockout);
});
test("actions: invalid saved qualification blocks generation until corrected", () => {
    const s = createSandbox();
    setup(s, 10, 2, { qualifiedCount: 8 });
    s.state().config.qualifiedCount = 10;
    expectRejected(s, () => s.A.generatePhase1(), /power of two/);
    s.A.updateConfig({ ...s.state().config, qualifiedCount: 8 });
    s.A.generatePhase1();
    completePhase1(s);
    s.state().config.qualifiedCount = 6;
    expectRejected(s, () => s.A.startKnockout(), /power of two/);
});
test("actions: knockout generation requires every score and selects top N", () => {
    const s = createSandbox();
    expectRejected(s, () => s.A.startKnockout(), "Generate phase 1 first");
    s.state().phase1.generated = true;
    expectRejected(s, () => s.A.startKnockout(), "All phase 1 matches must be completed before generating phase 2");
    setup(s, 6, 2, { qualifiedCount: 4 }); s.A.generatePhase1();
    const m = s.state().phase1.matches[0]; s.A.applyPhase1Score(m.id, undefined, undefined, 2, 0);
    expectRejected(s, () => s.A.startKnockout(), "All phase 1 matches must be completed before generating phase 2");
    completePhase1(s);
    const qualified = referenceStandings(s.state()).slice(0, 4).map((row) => row.teamId).sort();
    s.A.startKnockout();
    assert.deepEqual(plain(s.state().knockout.rounds[0].matches).flatMap((match) => [match.homeTeamId, match.awayTeamId]).sort(), qualified);
    const empty = createSandbox();
    empty.state().phase1 = { generated: true, matches: [{ status: "completed" }], roundTimers: {} };
    expectRejected(empty, () => empty.A.startKnockout(), "Need standings for at least 2 teams");
});
test("actions: knockout score guards, first-round substitution, winner/champion and reopen chain", () => {
    const s = createSandbox();
    expectRejected(s, () => s.A.applyKnockoutScore("missing", undefined, undefined, -1, 0), "Home goals must be an integer >= 0");
    expectRejected(s, () => s.A.applyKnockoutScore("missing", undefined, undefined, 1, -1), "Away goals must be an integer >= 0");
    expectRejected(s, () => s.A.applyKnockoutScore("missing", undefined, undefined, 1, 1), "Knockout matches cannot end in a draw");
    expectRejected(s, () => s.A.applyKnockoutScore("missing", undefined, undefined, 1, 0), "Knockout not generated");
    const k = knockoutFixture({ count: 8 });
    const first = k.state().knockout.rounds[0].matches[0];
    const next = k.state().knockout.rounds[1].matches[0];
    expectRejected(k, () => k.A.applyKnockoutScore("missing", undefined, undefined, 1, 0), "Knockout match not found");
    expectRejected(k, () => k.A.reopenKnockoutMatch("missing"), "Knockout match not found");
    expectRejected(k, () => k.A.applyKnockoutScore(next.id, undefined, undefined, 1, 0), "Match participants are not both defined");
    expectRejected(k, () => k.A.applyKnockoutScore(first.id, "t1", "t1", 1, 0), "Home and away teams must be different");
    expectRejected(k, () => k.A.applyKnockoutScore(first.id, null, first.awayTeamId, 1, 0), "Match participants are not both defined");
    expectRejected(k, () => k.A.applyKnockoutScore(first.id, "unknown", "t1", 1, 0), "Selected team not found");
    k.A.applyKnockoutScore(first.id, first.awayTeamId, first.homeTeamId, 1, 0);
    assert.equal(k.R.getWinnerTeamId(first), first.homeTeamId);
    for (const round of k.state().knockout.rounds) for (const match of round.matches) {
        if (match.status !== "completed" && match.homeTeamId && match.awayTeamId) scoreWinner(k, match, match.homeTeamId);
    }
    expectRejected(k, () => k.A.applyKnockoutScore(next.id, next.awayTeamId, next.homeTeamId, 1, 0), "Only first round matches can have their teams changed manually");
    assert.equal(k.state().knockout.championTeamId, k.state().knockout.rounds.at(-1).matches[0].homeTeamId);
    const third = k.state().knockout.thirdPlace;
    scoreWinner(k, third, third.homeTeamId);
    k.A.reopenKnockoutMatch(first.id);
    assert.equal(first.status, "scheduled"); assert.equal(first.finalElapsedMs, null);
    assert.equal(next.status, "scheduled"); assert.equal(next.homeTeamId, null);
    assert.equal(k.state().knockout.championTeamId, null);
    assert.equal(third.status, "scheduled"); assert.equal(third.homeTeamId, null);
    const bye = knockoutFixture({ count: 4 });
    const byeMatch = bye.state().knockout.rounds[0].matches[0];
    byeMatch.awayTeamId = null;
    byeMatch.isBye = true;
    bye.B.recomputeKnockout(bye.state());
    bye.A.reopenKnockoutMatch(byeMatch.id);
    assert.equal(byeMatch.status, "completed");
    assert.equal(bye.R.getWinnerTeamId(byeMatch), byeMatch.homeTeamId);
});
test("actions: phase timer timeline snapshots 320000,680000,780000 and all round/match guards", () => {
    const s = createSandbox({ now: 1000 });
    expectRejected(s, () => s.A.startPhase1RoundTimer(0), "Generate phase 1 first");
    setup(s); s.A.generatePhase1();
    const m = s.state().phase1.matches[0];
    expectRejected(s, () => s.A.startPhase1RoundTimer(99), "Round not found");
    expectRejected(s, () => s.A.pauseMatchTimer(m.id), "Start the round timer before pausing a match");
    for (const method of ["pausePhase1RoundTimer", "stopPhase1RoundTimer"]) expectRejected(s, () => s.A[method](0), "Round timer not started");
    expectRejected(s, () => s.A.resumePhase1RoundTimer(0), "Round timer is not paused");
    expectRejected(s, () => s.A.pauseMatchTimer("missing"), "Match not found");
    expectRejected(s, () => s.A.resumeMatchTimer("missing"), "Match not found");
    expectRejected(s, () => s.A.resumeMatchTimer(m.id), "Match timer is not paused");
    s.A.startPhase1RoundTimer(0);
    expectRejected(s, () => s.A.startPhase1RoundTimer(0), "Round timer already started");
    s.setNow(101000); s.A.pausePhase1RoundTimer(0);
    expectRejected(s, () => s.A.pausePhase1RoundTimer(0), "Round timer already paused");
    expectRejected(s, () => s.A.stopPhase1RoundTimer(0), "Resume the round timer before stopping it");
    expectRejected(s, () => s.A.pauseMatchTimer(m.id), "Resume the round timer before pausing an individual match");
    s.setNow(121000); s.A.resumePhase1RoundTimer(0);
    assert.equal(s.state().phase1.roundTimers["0"].pausedTotalMs, 20000);
    s.setNow(201000); s.A.pauseMatchTimer(m.id);
    expectRejected(s, () => s.A.pauseMatchTimer(m.id), "Match timer is already paused");
    // The round is frozen without advancing the clock here; no overlapping-pause accounting.
    s.A.pausePhase1RoundTimer(0);
    expectRejected(s, () => s.A.resumeMatchTimer(m.id), "Resume the round timer before resuming an individual match");
    s.A.resumePhase1RoundTimer(0);
    s.setNow(261000); s.A.resumeMatchTimer(m.id);
    assert.equal(m.pausedTotalMs, 60000);
    s.setNow(401000); s.A.applyPhase1Score(m.id, undefined, undefined, 2, 0);
    assert.equal(m.finalElapsedMs, 320000);
    expectRejected(s, () => s.A.pauseMatchTimer(m.id), "Match timer is already stopped");
    s.A.reopenPhase1Match(m.id); s.setNow(761000);
    s.A.applyPhase1Score(m.id, undefined, undefined, 2, 0);
    assert.equal(m.finalElapsedMs, 680000);
    s.A.reopenPhase1Match(m.id); s.setNow(861000); s.A.stopPhase1RoundTimer(0);
    s.setNow(990000); s.A.applyPhase1Score(m.id, undefined, undefined, 2, 0);
    assert.equal(m.finalElapsedMs, 780000);
    expectRejected(s, () => s.A.stopPhase1RoundTimer(0), "Round timer already stopped");
    expectRejected(s, () => s.A.pausePhase1RoundTimer(0), "Round timer already stopped");
});
test("actions: knockout/third-place timer lifecycle and guards", () => {
    const s = createSandbox();
    for (const method of ["startKnockoutRoundTimer", "stopKnockoutRoundTimer", "pauseKnockoutRoundTimer", "resumeKnockoutRoundTimer"]) {
        expectRejected(s, () => s.A[method]("missing"), "Knockout not generated");
    }
    const k = knockoutFixture({ now: 1000 });
    const round = k.state().knockout.rounds[0];
    const m = round.matches[0];
    expectRejected(k, () => k.A.startKnockoutRoundTimer("missing"), "Round not found");
    expectRejected(k, () => k.A.stopKnockoutRoundTimer("missing"), "Round timer not started");
    expectRejected(k, () => k.A.pauseKnockoutRoundTimer("missing"), "Round timer not started");
    expectRejected(k, () => k.A.resumeKnockoutRoundTimer("missing"), "Round timer is not paused");
    expectRejected(k, () => k.A.stopKnockoutRoundTimer(round.id), "Round timer not started");
    expectRejected(k, () => k.A.pauseKnockoutRoundTimer(round.id), "Round timer not started");
    expectRejected(k, () => k.A.resumeKnockoutRoundTimer(round.id), "Round timer is not paused");
    k.A.startKnockoutRoundTimer(round.id);
    expectRejected(k, () => k.A.startKnockoutRoundTimer(round.id), "Round timer already started");
    k.advance(10000); k.A.pauseKnockoutRoundTimer(round.id);
    expectRejected(k, () => k.A.pauseKnockoutRoundTimer(round.id), "Round timer already paused");
    expectRejected(k, () => k.A.stopKnockoutRoundTimer(round.id), "Resume the round timer before stopping it");
    k.advance(5000); k.A.resumeKnockoutRoundTimer(round.id);
    k.advance(2000); k.A.pauseMatchTimer(m.id);
    k.advance(3000); k.A.resumeMatchTimer(m.id);
    k.advance(10000); k.A.stopKnockoutRoundTimer(round.id);
    k.advance(99999); scoreWinner(k, m, m.homeTeamId);
    assert.equal(m.finalElapsedMs, 22000);
    expectRejected(k, () => k.A.stopKnockoutRoundTimer(round.id), "Round timer already stopped");
    expectRejected(k, () => k.A.pauseKnockoutRoundTimer(round.id), "Round timer already stopped");
    const other = round.matches[1]; scoreWinner(k, other, other.homeTeamId);
    const tp = k.state().knockout.thirdPlace;
    for (const method of ["pauseKnockoutRoundTimer", "resumeKnockoutRoundTimer"]) {
        expectRejected(k, () => k.A[method]("thirdPlace"), "Third place uses its own match pause, not a round pause");
    }
    k.A.startKnockoutRoundTimer("thirdPlace");
    k.advance(10000); k.A.pauseMatchTimer(tp.id);
    k.advance(4000); k.A.resumeMatchTimer(tp.id);
    k.advance(10000); k.A.stopKnockoutRoundTimer("thirdPlace");
    k.advance(10000); scoreWinner(k, tp, tp.homeTeamId);
    assert.equal(tp.finalElapsedMs, 20000);
});
test("actions: back/reset preservation, import, download anchor/blob/revoke", () => {
    const s = knockoutFixture();
    const phase1 = JSON.stringify(s.state().phase1);
    s.A.backToPhase1();
    assert.equal(JSON.stringify(s.state().phase1), phase1);
    assert.deepEqual(plain(s.state().knockout), DEFAULT.knockout);
    expectRejected(s, () => s.A.backToPhase1(), "Knockout is not generated");
    const teams = plain(s.state().teams), terrains = plain(s.state().terrains), config = plain(s.state().config);
    s.A.resetPhases();
    assert.deepEqual(plain(s.state().teams), teams);
    assert.deepEqual(plain(s.state().terrains), terrains);
    assert.deepEqual(plain(s.state().config), config);
    assert.deepEqual(plain(s.state().phase1), DEFAULT.phase1);
    s.A.exportStateToDownload();
    const anchor = s.document.clicks.at(-1);
    assert.equal(anchor.tagName, "A");
    assert.equal(anchor.download, "tournament-state.json");
    assert.equal(anchor.href, "blob:test/1");
    assert.equal(s.blobs[0].type, "application/json");
    assert.equal(s.blobs[0].parts[0], s.S.exportState());
    assert.deepEqual(s.revoked, ["blob:test/1"]);
    s.A.importStateFromText(s.blobs[0].parts[0]);
    assert.equal(s.state().audit[0].message, "Imported tournament state");
    assert.deepEqual(JSON.parse(s.storage.getItem(STATE_KEY)), plain(s.state()));
    s.A.resetAll();
    assert.deepEqual(plain(s.state().teams), []);
    assert.equal(s.state().audit[0].message, "Reset tournament state");
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSandbox, setup, plain, scoreWinner, expectRejected, STATE_KEY, SUMMARY_KEY } = require("./harness");
const { DEFAULT, referenceStandings, scheduleInvariants, bracketInvariants } = require("./oracles");

function realistic(seed = 1, policy = "ranking") {
    const s = createSandbox({ seed, now: 1700000000000 });
    setup(s, 50, 20, {
        POINT_VICTORY_PHASE1: 3, POINT_DRAW_PHASE1: 1, POINT_LOSS_PHASE1: 0,
        phase1MatchesPerTeam: 3, qualifiedCount: 16, thirdPlaceMatch: true, seedingPolicy: policy,
        matchDurationSeconds: 600, pauseDurationSeconds: 120
    });
    s.A.generatePhase1();
    return s;
}
function playPhase1(s) {
    const rounds = [...new Set(s.state().phase1.matches.map((m) => m.roundIndex))];
    for (const index of rounds) {
        const matches = s.state().phase1.matches.filter((m) => m.roundIndex === index);
        const start = s.now;
        s.A.startPhase1RoundTimer(index);
        s.setNow(start + 60000); s.A.pausePhase1RoundTimer(index);
        s.setNow(start + 80000); s.A.resumePhase1RoundTimer(index);
        s.setNow(start + 120000); s.A.pauseMatchTimer(matches[0].id);
        s.setNow(start + 130000); s.A.resumeMatchTimer(matches[0].id);
        s.setNow(start + 150000); s.A.pauseMatchTimer(matches[1].id);
        s.setNow(start + 155000); s.A.resumeMatchTimer(matches[1].id);
        s.setNow(start + 540000);
        for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            const home = Number(m.homeTeamId.slice(1)) % 5;
            const away = Number(m.awayTeamId.slice(1)) % 5;
            s.A.applyPhase1Score(m.id, undefined, undefined, home, away);
            assert.equal(m.finalElapsedMs, 540000 - 20000 - (i === 0 ? 10000 : i === 1 ? 5000 : 0));
            if (index === 0 && i === 0) expectRejected(s, () => s.A.startKnockout(), "All phase 1 matches must be completed before generating phase 2");
        }
        s.A.stopPhase1RoundTimer(index);
        if (index === 1) assert.deepEqual(plain(s.R.buildStandings(s.state())), referenceStandings(s.state()));
        s.advance(120000);
    }
    const rows = referenceStandings(s.state());
    assert.deepEqual(plain(s.R.buildStandings(s.state())), rows);
    assert.ok(rows.some((row, i) => i && row.points === rows[i - 1].points), "Fixture must exercise points ties");
    return rows;
}
function seedMap(rows) { return new Map(rows.slice(0, 16).map((row, i) => [row.teamId, i + 1])); }
test("full-flow: score-free participant edit persists, restores schedule and completes a 50-team event", () => {
    const s = realistic();
    const m = s.state().phase1.matches[0];
    const home = m.homeTeamId;
    const replacement = s.state().teams.find((team) => team.id !== home && team.id !== m.awayTeamId).id;
    s.A.updatePhase1Team(m.id, "home", replacement);
    assert.equal(m.status, "scheduled");
    assert.equal(m.homeGoals, null);
    const loaded = createSandbox({ initial: { [STATE_KEY]: s.S.exportState() } });
    loaded.S.load();
    assert.equal(loaded.state().phase1.matches[0].homeTeamId, replacement);
    s.A.updatePhase1Team(m.id, "home", home);
    scheduleInvariants(s.state().phase1.matches, s.state().teams.map((team) => team.id),
        s.state().terrains.map((terrain) => terrain.id), 3);
    playPhase1(s);
    s.A.startKnockout();
    for (const round of s.state().knockout.rounds) {
        for (const match of round.matches) scoreWinner(s, match, match.homeTeamId);
    }
    assert.ok(s.state().knockout.championTeamId);
});
function better(s, match, seeds) {
    assert.ok(match.homeTeamId && match.awayTeamId);
    scoreWinner(s, match, seeds.get(match.homeTeamId) < seeds.get(match.awayTeamId) ? match.homeTeamId : match.awayTeamId);
}
function playRounds(s, seeds, from = 0, through = s.state().knockout.rounds.length - 1) {
    for (let index = from; index <= through; index++) {
        const round = s.state().knockout.rounds[index];
        if (!round.startedAt) s.A.startKnockoutRoundTimer(round.id);
        s.advance(10000);
        for (const match of round.matches) if (match.status !== "completed") better(s, match, seeds);
        if (!round.stoppedAt) s.A.stopKnockoutRoundTimer(round.id);
    }
}
function playThird(s, seeds) {
    const third = s.state().knockout.thirdPlace;
    if (!third.startedAt) s.A.startKnockoutRoundTimer("thirdPlace");
    s.advance(1000); s.A.pauseMatchTimer(third.id);
    s.advance(2000); s.A.resumeMatchTimer(third.id);
    s.advance(10000); better(s, third, seeds);
    if (!third.stoppedAt) s.A.stopKnockoutRoundTimer("thirdPlace");
}
function ranks(match, seeds) { return [seeds.get(match.homeTeamId), seeds.get(match.awayTeamId)].sort((a, b) => a - b); }
function assertOutcome(s, seeds, champion, runner, third, fourth) {
    const final = s.state().knockout.rounds.at(-1).matches[0];
    const tp = s.state().knockout.thirdPlace;
    assert.equal(seeds.get(s.state().knockout.championTeamId), champion);
    assert.equal(seeds.get(s.R.getLoserTeamId(final)), runner);
    assert.equal(seeds.get(s.R.getWinnerTeamId(tp)), third);
    assert.equal(seeds.get(s.R.getLoserTeamId(tp)), fourth);
}
function reopenUpset(s, seeds) {
    const qf = s.state().knockout.rounds[1].matches.find((m) => ranks(m, seeds).join(",") === "1,8");
    assert.ok(qf);
    const otherQfs = s.state().knockout.rounds[1].matches.filter((m) => m !== qf).map((m) => JSON.stringify(m));
    const siblingSemi = JSON.stringify(s.state().knockout.rounds[2].matches[1]);
    s.A.reopenKnockoutMatch(qf.id);
    assert.equal(qf.status, "scheduled");
    assert.equal(s.state().knockout.rounds[2].matches[0].status, "scheduled");
    assert.equal(s.state().knockout.rounds[3].matches[0].status, "scheduled");
    assert.equal(s.state().knockout.championTeamId, null);
    assert.deepEqual(s.state().knockout.rounds[1].matches.filter((m) => m !== qf).map((m) => JSON.stringify(m)), otherQfs);
    assert.equal(JSON.stringify(s.state().knockout.rounds[2].matches[1]), siblingSemi);
    const rank8 = [...seeds].find(([, rank]) => rank === 8)[0];
    scoreWinner(s, qf, rank8);
    playRounds(s, seeds, 2);
    playThird(s, seeds);
    assertOutcome(s, seeds, 2, 4, 3, 8);
}
function withoutAudit(state) { const copy = plain(state); delete copy.audit; return copy; }

test("full-flow: realistic 50-team schedule invariants and locked editing", () => {
    const s = realistic();
    const rounds = scheduleInvariants(plain(s.state().phase1.matches), s.state().teams.map((t) => t.id), s.state().terrains.map((t) => t.id), 3, true);
    assert.equal(rounds.size, 4);
    assert.deepEqual([...rounds.values()].map((matches) => matches.length), [20, 20, 20, 15]);
    expectRejected(s, () => s.A.addTeam("Late entrant"), "Cannot edit teams or terrains after phase 1 is generated. Reset state to restart.");
    expectRejected(s, () => s.A.updateConfig(DEFAULT.config), "Cannot change config after phase 1 is generated. Reset phases to restart.");
    expectRejected(s, () => s.A.startKnockout(), "All phase 1 matches must be completed before generating phase 2");
});
test("full-flow: phase timers/oracle, seeded title, QF upset, export/import replay, correction and resets", () => {
    const s = realistic();
    const rows = playPhase1(s);
    const seeds = seedMap(rows);
    const phaseExport = s.S.exportState();
    s.A.startKnockout();
    const ko = s.state().knockout;
    assert.deepEqual(plain(ko.rounds.map((round) => round.matches.length)), [8, 4, 2, 1]);
    assert.deepEqual(plain(ko.rounds.map((round) => round.name)), ["Round of 16", "Quarterfinal", "Semifinal", "Final"]);
    bracketInvariants(plain(ko), rows.slice(0, 16).map((row) => row.teamId), true, s.state().terrains.map((field) => field.id));
    assert.equal(ko.rounds[0].matches.filter((m) => m.homeTeamId && m.awayTeamId).length, 8);
    for (const match of ko.rounds[0].matches) {
        assert.equal(seeds.get(match.homeTeamId) + seeds.get(match.awayTeamId), 17);
    }
    for (const round of ko.rounds) assert.equal(new Set(round.matches.map((m) => m.terrainId)).size, round.matches.length);
    playRounds(s, seeds, 0, 1);
    assert.deepEqual(plain(ko.rounds[2].matches.map((m) => ranks(m, seeds))), [[1, 4], [2, 3]]);
    const quarterExport = s.S.exportState();
    playRounds(s, seeds, 2); playThird(s, seeds);
    assert.deepEqual(ranks(ko.rounds[3].matches[0], seeds), [1, 2]);
    assertOutcome(s, seeds, 1, 2, 3, 4);
    reopenUpset(s, seeds);
    const replay = createSandbox({ now: s.now });
    replay.A.importStateFromText(quarterExport);
    assert.deepEqual(withoutAudit(replay.state()), withoutAudit(JSON.parse(quarterExport)));
    assert.equal(replay.state().audit.length, JSON.parse(quarterExport).audit.length + 1);
    // The same correction applied to a fresh quarterfinal backup has the same sporting outcome.
    reopenUpset(replay, seeds);
    assert.equal(replay.state().knockout.championTeamId, s.state().knockout.championTeamId);
    const finalExport = s.S.exportState();
    const admin = createSandbox({ page: "admin", initial: { [STATE_KEY]: finalExport } });
    const summary = createSandbox({ page: "summary", initial: { [STATE_KEY]: finalExport } });
    const championName = rows.find((row) => row.teamId === s.state().knockout.championTeamId).teamName;
    assert.match(admin.el("champion-block").innerHTML, new RegExp(championName));
    assert.match(summary.el("summary-champion").innerHTML, new RegExp(championName));
    summary.advance(1000); summary.runTimers(1000); summary.dispatchWindow("storage", { key: STATE_KEY });
    assert.equal(summary.storage.writes.length, 0);
    // Find a correction using only the independent standings oracle.
    const oldTop = rows.slice(0, 16).map((row) => row.teamId).sort().join(",");
    let correction;
    for (const match of s.state().phase1.matches) {
        for (const homeGoals of [10000, 0]) {
            const candidate = plain(s.state());
            const changed = candidate.phase1.matches.find((m) => m.id === match.id);
            changed.homeGoals = homeGoals; changed.awayGoals = homeGoals ? 0 : 10000;
            const top = referenceStandings(candidate).slice(0, 16).map((row) => row.teamId).sort().join(",");
            if (top !== oldTop) { correction = { id: match.id, homeGoals, awayGoals: homeGoals ? 0 : 10000 }; break; }
        }
        if (correction) break;
    }
    assert.ok(correction, "Correction fixture changes the qualifier set");
    s.A.reopenPhase1Match(correction.id);
    assert.deepEqual(plain(s.state().knockout), DEFAULT.knockout);
    expectRejected(s, () => s.A.startKnockout(), "All phase 1 matches must be completed before generating phase 2");
    s.A.applyPhase1Score(correction.id, undefined, undefined, correction.homeGoals, correction.awayGoals);
    const revised = referenceStandings(s.state());
    assert.deepEqual(plain(s.R.buildStandings(s.state())), revised);
    assert.notEqual(revised.slice(0, 16).map((row) => row.teamId).sort().join(","), oldTop);
    s.A.startKnockout();
    const newSeeds = seedMap(revised);
    playRounds(s, newSeeds); playThird(s, newSeeds);
    assertOutcome(s, newSeeds, 1, 2, 3, 4);
    const keepPhase = JSON.stringify(s.state().phase1);
    s.A.backToPhase1();
    assert.equal(JSON.stringify(s.state().phase1), keepPhase);
    const keepTeams = plain(s.state().teams), keepTerrains = plain(s.state().terrains), keepConfig = plain(s.state().config);
    s.A.resetPhases();
    assert.deepEqual(plain(s.state().phase1), DEFAULT.phase1);
    assert.deepEqual(plain(s.state().teams), keepTeams);
    assert.deepEqual(plain(s.state().terrains), keepTerrains);
    assert.deepEqual(plain(s.state().config), keepConfig);
    s.storage.setItem(SUMMARY_KEY, '{"standingsHidden":true}');
    s.A.resetAll();
    const reset = plain(s.state()); reset.audit = [];
    assert.deepEqual(reset, DEFAULT);
    assert.equal(s.state().audit[0].message, "Reset tournament state");
    assert.equal(s.storage.getItem(SUMMARY_KEY), '{"standingsHidden":true}');
    assert.equal(JSON.parse(phaseExport).phase1.matches.length, 75);
});
test("full-flow: same seeds byte-identical exports, random top16 no-BYE bracket and rank1 champion", () => {
    const a = realistic(), b = realistic(), different = realistic(2);
    assert.equal(a.S.exportState(), b.S.exportState());
    assert.notEqual(JSON.stringify(a.state().phase1.matches), JSON.stringify(different.state().phase1.matches));
    playPhase1(a); playPhase1(b);
    a.A.startKnockout(); b.A.startKnockout();
    const seeds = seedMap(referenceStandings(a.state()));
    playRounds(a, seeds); playThird(a, seeds);
    playRounds(b, seeds); playThird(b, seeds);
    assert.equal(a.S.exportState(), b.S.exportState());
    const random = realistic(1, "random");
    const rows = playPhase1(random), randomSeeds = seedMap(rows);
    random.A.startKnockout();
    const first = random.state().knockout.rounds[0].matches;
    assert.ok(first.every((m) => m.homeTeamId && m.awayTeamId));
    assert.deepEqual(plain(first).flatMap((m) => [m.homeTeamId, m.awayTeamId]).sort(), rows.slice(0, 16).map((row) => row.teamId).sort());
    assert.notDeepEqual(plain(first).flatMap((m) => [m.homeTeamId, m.awayTeamId]),
        plain(a.state().knockout.rounds[0].matches).flatMap((m) => [m.homeTeamId, m.awayTeamId]));
    playRounds(random, randomSeeds); playThird(random, randomSeeds);
    assert.equal(randomSeeds.get(random.state().knockout.championTeamId), 1);
});

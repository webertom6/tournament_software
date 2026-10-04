"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSandbox, setup, completePhase1, knockoutFixture, scoreWinner, FakeStorage, STATE_KEY, SUMMARY_KEY } = require("./harness");
const { handFixture, HEADERS } = require("./oracles");

test("summary-page: team-only edits appear through storage without completing matches or writing", () => {
    const operator = createSandbox();
    setup(operator, 50, 20, { phase1MatchesPerTeam: 3, qualifiedCount: 16 });
    operator.A.generatePhase1();
    const summary = createSandbox({ page: "summary", storage: operator.storage });
    const m = operator.state().phase1.matches[0];
    const replacement = operator.state().teams.find((team) => team.id !== m.homeTeamId && team.id !== m.awayTeamId);
    operator.S.update((state) => { state.teams.find((team) => team.id === replacement.id).name = "Unique updated participant"; });
    operator.A.updatePhase1Team(m.id, "home", replacement.id);
    const writes = operator.storage.writes.length;
    summary.dispatchWindow("storage", { key: STATE_KEY });
    const card = summary.el("view-phase1").querySelectorAll(".summary-match")[0];
    assert.match(card.textContent, /Unique updated participant/);
    assert.doesNotMatch(card.textContent, /Score:/);
    assert.equal(m.status, "scheduled");
    assert.equal(operator.storage.writes.length, writes);
});

test("summary-page: no data/malformed/setup/phase1/knockout/champion views never write", () => {
    const fixture = knockoutFixture();
    const stages = [null, "{", JSON.stringify({ teams: [], terrains: [], config: {} })];
    const p1 = createSandbox(); handFixture(p1); stages.push(p1.S.exportState());
    stages.push(fixture.S.exportState());
    for (const round of fixture.state().knockout.rounds) for (const match of round.matches) scoreWinner(fixture, match, match.homeTeamId);
    stages.push(fixture.S.exportState());
    const labels = ["No data", "No data", "Setup", "Phase 1", "Knockout", "Champion crowned"];
    const views = ["setup", "setup", "setup", "phase1", "knockout", "knockout"];
    stages.forEach((raw, index) => {
        const s = createSandbox({ page: "summary", initial: raw === null ? {} : { [STATE_KEY]: raw } });
        assert.equal(s.el("summary-stage-pill").textContent, labels[index]);
        for (const view of ["setup", "phase1", "knockout"]) assert.equal(s.el("view-" + view).hidden, view !== views[index]);
        s.advance(1000); s.runTimers(1000);
        s.dispatchWindow("storage", { key: STATE_KEY });
        assert.equal(s.storage.writes.length, 0);
        if (index === 5) assert.match(s.el("summary-champion").innerHTML, /Champion: Team/);
        if (index < 3) assert.match(s.el("summary-teams-setup").innerHTML, /No teams registered/);
    });
});
test("summary-page: header running/stopped/paused/waiting clock table, stopped freeze", () => {
    const fixture = createSandbox(); handFixture(fixture);
    fixture.state().phase1.matches.forEach((m) => { m.roundIndex = 0; });
    const scenarios = [
        [null, "waiting"], [{ startedAt: 1000, pausedAt: null, pausedTotalMs: 0 }, "09:00"],
        [{ startedAt: 1000, stoppedAt: 41000, pausedTotalMs: 0 }, "09:20"],
        [{ startedAt: 1000, pausedAt: 31000, pausedTotalMs: 0 }, "09:30"],
        [{ startedAt: 1000, pausedAt: null, pausedTotalMs: 10000 }, "09:10"]
    ];
    for (const [timer, expected] of scenarios) {
        fixture.state().phase1.roundTimers = timer ? { 0: timer } : {};
        const s = createSandbox({ page: "summary", now: 61000, initial: { [STATE_KEY]: fixture.S.exportState() } });
        assert.equal(s.el("summary-clock-label").textContent, "Round 1/1");
        assert.equal(s.el("summary-round-clock").textContent, expected);
        assert.ok(s.document.querySelectorAll(".js-round-clock").every((el) => el.textContent === expected));
        if (timer && (timer.stoppedAt || timer.pausedAt)) {
            s.advance(600000); s.runTimers(1000);
            assert.equal(s.el("summary-round-clock").textContent, expected);
        }
        assert.equal(s.storage.writes.length, 0);
    }
    const k = knockoutFixture();
    k.state().knockout.rounds[0].startedAt = 1000;
    const s = createSandbox({ page: "summary", now: 661000, initial: { [STATE_KEY]: k.S.exportState() } });
    assert.equal(s.el("summary-clock-label").textContent, "Semifinal");
    assert.equal(s.el("summary-round-clock").textContent, "+01:00");
});
test("summary-page: shared storage live events and unrelated key no-op", () => {
    const storage = new FakeStorage();
    const admin = createSandbox({ page: "admin", storage });
    const summary = createSandbox({ page: "summary", storage });
    const count = summary.document.renderCount;
    summary.dispatchWindow("storage", { key: "unrelated" });
    assert.equal(summary.document.renderCount, count);
    admin.A.addTeam("Live Team");
    const writes = storage.writes.length;
    summary.dispatchWindow("storage", { key: STATE_KEY });
    assert.match(summary.el("summary-teams-setup").innerHTML, /Live Team/);
    assert.equal(storage.writes.length, writes);
    admin.A.addTeam("Live Other"); admin.A.updateConfig({ ...admin.state().config, qualifiedCount: 2, phase1MatchesPerTeam: 1 });
    admin.A.generatePhase1(); summary.dispatchWindow("storage", { key: STATE_KEY });
    assert.equal(summary.el("summary-stage-pill").textContent, "Phase 1");
    assert.match(summary.el("summary-phase1").innerHTML, /In progress/);
    summary.advance(1000); summary.runTimers(1000);
    assert.equal(storage.writes.length, writes + 3);
});
test("summary-page: standings refresh on state/show changes and preserve horizontal scroll", () => {
    const fixture = createSandbox();
    setup(fixture, 4, 0);
    fixture.A.generatePhase1();
    const storage = new FakeStorage({ [STATE_KEY]: fixture.S.exportState() });
    const s = createSandbox({ page: "summary", storage });
    const originalWrap = s.el("summary-standings").querySelector(".table-wrap");
    originalWrap.scrollLeft = 145;

    s.advance(1000); s.runTimers(1000);
    assert.equal(s.el("summary-standings").querySelector(".table-wrap"), originalWrap);
    assert.equal(originalWrap.scrollLeft, 145);

    const updated = JSON.parse(fixture.S.exportState());
    updated.teams[0].name = "Updated team name";
    storage.setItem(STATE_KEY, JSON.stringify(updated));
    s.dispatchWindow("storage", { key: STATE_KEY });
    let tableWrap = s.el("summary-standings").querySelector(".table-wrap");
    assert.notEqual(tableWrap, originalWrap);
    assert.equal(tableWrap.scrollLeft, 145);
    assert.match(s.el("summary-standings").innerHTML, /Updated team name/);

    storage.setItem(SUMMARY_KEY, '{"standingsHidden":true,"autoScrollActive":false}');
    s.dispatchWindow("storage", { key: SUMMARY_KEY });
    const hiddenWrap = s.el("summary-standings").querySelector(".table-wrap");
    updated.teams[0].name = "Updated while hidden";
    storage.setItem(STATE_KEY, JSON.stringify(updated));
    s.dispatchWindow("storage", { key: STATE_KEY });
    assert.equal(s.el("summary-standings").querySelector(".table-wrap"), hiddenWrap);

    storage.setItem(SUMMARY_KEY, '{"standingsHidden":false,"autoScrollActive":false}');
    s.dispatchWindow("storage", { key: SUMMARY_KEY });
    tableWrap = s.el("summary-standings").querySelector(".table-wrap");
    assert.notEqual(tableWrap, hiddenWrap);
    assert.equal(tableWrap.scrollLeft, 145);
    assert.match(s.el("summary-standings").innerHTML, /Updated while hidden/);
});
test("summary-page: standingsHidden, 16ms 40px/s scrolling, boundaries and clear when off", () => {
    const storage = new FakeStorage({ [SUMMARY_KEY]: '{"standingsHidden":true,"autoScrollActive":true}' });
    const s = createSandbox({ page: "summary", storage, now: 1000 });
    assert.equal(s.el("view-phase1").classList.contains("standings-hidden"), true);
    assert.deepEqual([...s.timers.values()].map((t) => t.delay), [1000, 16]);
    s.runTimers(16); s.advance(1000); s.runTimers(16);
    assert.equal(s.window.scrollY, 40);
    s.window.scrollY = 1190; s.advance(1000); s.runTimers(16);
    assert.equal(s.window.scrollY, 1200);
    s.advance(1000); s.runTimers(16); assert.equal(s.window.scrollY, 1160);
    s.window.scrollY = 10; s.advance(1000); s.runTimers(16); assert.equal(s.window.scrollY, 0);
    s.document.documentElement.scrollHeight = 700;
    s.advance(1000); s.runTimers(16); assert.equal(s.window.scrollY, 0);
    const writes = storage.writes.length;
    storage.setItem(SUMMARY_KEY, '{"standingsHidden":false,"autoScrollActive":false}');
    s.dispatchWindow("storage", { key: SUMMARY_KEY });
    assert.equal(s.el("view-phase1").classList.contains("standings-hidden"), false);
    assert.equal([...s.timers.values()].find((timer) => timer.delay === 16).active, false);
    assert.equal(storage.writes.length, writes + 1);
    s.advance(1000); s.runTimers(16); assert.equal(s.window.scrollY, 0);
});
test("summary-page: >30 split two tables, >80 three, escaping and standings parity", () => {
    for (const [count, columns] of [[4, 1], [30, 1], [31, 2], [80, 2], [81, 3]]) {
        const fixture = createSandbox(); setup(fixture, count, 0);
        fixture.state().phase1.generated = true;
        fixture.state().teams[0].name = '<img src="x">&\'';
        const s = createSandbox({ page: "summary", initial: { [STATE_KEY]: fixture.S.exportState() } });
        const tables = s.el("summary-standings").querySelectorAll("table");
        assert.equal(tables.length, columns);
        assert.equal(s.el("summary-standings").querySelectorAll("tbody tr").length, count);
        for (const table of tables) assert.deepEqual(table.querySelectorAll("th").map((el) => el.textContent), HEADERS);
        assert.match(s.el("summary-standings").innerHTML, /&lt;img src=&quot;x&quot;&gt;&amp;&#39;/);
        assert.doesNotMatch(s.el("summary-standings").innerHTML, /<img/);
        assert.match(s.el("summary-phase1").innerHTML, /No phase 1 matches/);
        assert.equal(s.storage.writes.length, 0);
    }
    const fixture = createSandbox(); setup(fixture);
    fixture.state().teams[0].name = "<b>setup</b>";
    const s = createSandbox({ page: "summary", initial: { [STATE_KEY]: fixture.S.exportState(), [SUMMARY_KEY]: "{" } });
    assert.match(s.el("summary-teams-setup").innerHTML, /&lt;b&gt;setup&lt;\/b&gt;/);
    assert.equal(s.storage.writes.length, 0);
});
test("summary-page: third place only both known, live bracket progression and scrolling", () => {
    const fixture = knockoutFixture({ count: 8 });
    fixture.state().teams[0].name = '<b>"KO"&\'</b>';
    const storage = new FakeStorage({ [STATE_KEY]: fixture.S.exportState() });
    const s = createSandbox({ page: "summary", storage, wide: true });
    assert.match(s.el("summary-bracket").innerHTML, /Quarterfinal/);
    assert.doesNotMatch(s.el("summary-bracket").innerHTML, /bracket-third-place/);
    assert.match(s.el("summary-bracket").innerHTML, /&lt;b&gt;&quot;KO&quot;&amp;&#39;&lt;\/b&gt;/);
    for (const match of fixture.state().knockout.rounds[0].matches) scoreWinner(fixture, match, match.homeTeamId);
    const semis = fixture.state().knockout.rounds[1].matches;
    scoreWinner(fixture, semis[0], semis[0].homeTeamId);
    storage.setItem(STATE_KEY, fixture.S.exportState()); s.dispatchWindow("storage", { key: STATE_KEY });
    assert.doesNotMatch(s.el("summary-bracket").innerHTML, /bracket-third-place/);
    scoreWinner(fixture, semis[1], semis[1].awayTeamId);
    storage.setItem(STATE_KEY, fixture.S.exportState()); s.dispatchWindow("storage", { key: STATE_KEY });
    assert.match(s.el("summary-bracket").innerHTML, /bracket-third-place/);
    assert.equal(s.el("summary-clock-label").textContent, "Final");
    let scroll = s.el("bracket-scroll");
    assert.equal(scroll.scrollLeft, 480);
    scroll.scrollLeft = 100; scroll.dispatch("scroll");
    assert.equal(s.el("bracket-titles-inner").style.transform, "translateX(-100px)");
    const updated = JSON.parse(fixture.S.exportState());
    updated.teams[0].name = "Updated bracket team";
    storage.setItem(STATE_KEY, JSON.stringify(updated)); s.dispatchWindow("storage", { key: STATE_KEY });
    scroll = s.el("bracket-scroll");
    assert.equal(scroll.scrollLeft, 100);
    assert.equal(s.el("bracket-titles-inner").style.transform, "translateX(-100px)");
    const writes = storage.writes.length;
    s.advance(1000); s.runTimers(1000);
    assert.equal(storage.writes.length, writes);
    assert.equal(s.el("bracket-scroll").scrollLeft, 100);

    fixture.A.reopenKnockoutMatch(semis[1].id);
    storage.setItem(STATE_KEY, fixture.S.exportState()); s.dispatchWindow("storage", { key: STATE_KEY });
    assert.equal(s.el("bracket-scroll").scrollLeft, 240);
    scoreWinner(fixture, semis[1], semis[1].awayTeamId);
    storage.setItem(STATE_KEY, fixture.S.exportState()); s.dispatchWindow("storage", { key: STATE_KEY });
    assert.equal(s.el("bracket-scroll").scrollLeft, 480);
});
test("summary-page: power-of-two bracket maps real feeders without BYEs", () => {
    const fixture = createSandbox();
    setup(fixture, 8, 2, { qualifiedCount: 8, thirdPlaceMatch: true });
    fixture.A.generatePhase1();
    completePhase1(fixture);
    fixture.A.startKnockout();

    const s = createSandbox({ page: "summary", initial: { [STATE_KEY]: fixture.S.exportState() } });
    const bracket = s.el("summary-bracket");
    assert.equal(bracket.querySelectorAll(".bracket-match").length, 7);
    assert.equal(bracket.querySelectorAll(".bracket-connector").length, 3);
    assert.equal(bracket.querySelectorAll(".bracket-connector-tick").length, 3);
    assert.equal(bracket.querySelectorAll(".bracket-team").length, 14);
    assert.doesNotMatch(bracket.innerHTML, /Bye/);
    assert.doesNotMatch(bracket.innerHTML, /bracket-third-place/);
    assert.equal(s.storage.writes.length, 0);

    const invalid = createSandbox();
    setup(invalid, 10, 2, { qualifiedCount: 10 });
    invalid.state().phase1.generated = true;
    const invalidSummary = createSandbox({ page: "summary", initial: { [STATE_KEY]: invalid.S.exportState() } });
    assert.match(invalidSummary.el("summary-standings").innerHTML, /qualification is invalid/);
    assert.equal(invalidSummary.storage.writes.length, 0);
});
test("summary-page: imported legacy BYE bracket remains readable", () => {
    const fixture = createSandbox();
    setup(fixture, 8, 2, { qualifiedCount: 8 });
    fixture.A.generatePhase1();
    completePhase1(fixture);
    fixture.A.startKnockout();

    const state = fixture.state();
    state.config.qualifiedCount = 6;
    const [t1, t2, t3, t4, t5, t6] = state.teams.map((team) => team.id);
    const [first, second, third, fourth] = state.knockout.rounds[0].matches;
    first.homeTeamId = t1; first.awayTeamId = null; first.isBye = true;
    second.homeTeamId = t4; second.awayTeamId = t5; second.isBye = false;
    third.homeTeamId = t2; third.awayTeamId = null; third.isBye = true;
    fourth.homeTeamId = t3; fourth.awayTeamId = t6; fourth.isBye = false;
    fixture.B.recomputeKnockout(state);

    const summary = createSandbox({ page: "summary", initial: { [STATE_KEY]: fixture.S.exportState() } });
    assert.match(summary.el("summary-bracket").innerHTML, /Bye - Advances to next round/);
    assert.equal(summary.el("summary-bracket").querySelectorAll(".bracket-match").length, 7);
    assert.equal(summary.storage.writes.length, 0);
});

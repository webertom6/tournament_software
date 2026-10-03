"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSandbox, plain, STATE_KEY, SUMMARY_KEY, OPERATOR_KEY, expectRejected, setup } = require("./harness");
const { DEFAULT } = require("./oracles");

test("state: defaults and 1000 unique frozen-clock IDs", () => {
    const s = createSandbox();
    assert.deepEqual(plain(s.state()), DEFAULT);
    const ids = Array.from({ length: 1000 }, () => s.S.uid("team"));
    assert.equal(new Set(ids).size, 1000);
    for (const id of ids) assert.match(id, /^team_[a-z0-9]+_[a-z0-9]{1,6}$/);
    assert.ok(ids.every((id) => id.split("_")[1] === s.now.toString(36)));
});
test("state: update/save/notify/unsubscribe, audit trimming and 300 cap", () => {
    const s = createSandbox();
    let notices = 0;
    const stop = s.S.subscribe((state) => { assert.equal(state, s.state()); notices++; });
    s.S.update((state) => state.teams.push({ id: "a", name: "A" }), "  Created A  ");
    assert.equal(notices, 1);
    assert.equal(s.state().audit[0].message, "Created A");
    assert.equal(s.state().audit[0].at, new Date(s.now).toISOString());
    assert.deepEqual(JSON.parse(s.storage.getItem(STATE_KEY)), plain(s.state()));
    stop(); stop();
    s.S.save();
    assert.equal(notices, 1);
    expectRejected(s, () => s.S.update(() => { throw new Error("abort"); }, "must not audit"), "abort");
    const liveAudit = s.state().audit;
    for (let i = 0; i < 310; i++) {
        s.S.update(() => {}, "entry " + i);
        // Consumers of getState() retain the live audit list until cap pruning is needed.
        if (i < 299) assert.equal(s.state().audit, liveAudit, "Audit was pruned before reaching its 300-entry cap");
    }
    assert.equal(s.state().audit.length, 300);
    assert.equal(s.state().audit[0].message, "entry 309");
    assert.equal(s.state().audit.at(-1).message, "entry 10");
    s.S.update(() => {});
    assert.equal(s.state().audit.length, 300);
});
test("state: missing/valid/malformed load and two-space export", () => {
    const s = createSandbox();
    s.A.addTeam("Gone"); s.storage.removeItem(STATE_KEY); s.S.load();
    assert.deepEqual(plain(s.state()), DEFAULT);
    s.storage.setItem(STATE_KEY, JSON.stringify({ ...DEFAULT, teams: [{ id: "a", name: "A" }] }));
    s.S.load();
    assert.equal(s.state().teams[0].name, "A");
    assert.equal(s.S.exportState(), JSON.stringify(plain(s.state()), null, 2));
    s.storage.setItem(STATE_KEY, "{");
    const before = s.storage.writes.length;
    s.S.load();
    assert.deepEqual(plain(s.state()), DEFAULT);
    assert.equal(s.storage.writes.length, before);
    assert.equal(s.logs[0][0], "error");
});
test("state: import invalid atomicity and valid audit/save/notify", () => {
    const s = createSandbox(); setup(s);
    expectRejected(s, () => s.S.importState("{"), /JSON/);
    let notices = 0;
    s.S.subscribe(() => notices++);
    s.S.importState(JSON.stringify(DEFAULT));
    assert.equal(notices, 1);
    assert.equal(s.state().audit.length, 1);
    assert.equal(s.state().audit[0].message, "Imported tournament state");
    assert.deepEqual(JSON.parse(s.storage.getItem(STATE_KEY)), plain(s.state()));
});
test("state: sanitization finite numeric types, enums, coercions, arrays and unknown fields", () => {
    const s = createSandbox();
    for (const raw of [null, false, 7, "text", []]) {
        s.S.importState(JSON.stringify(raw));
        const actual = plain(s.state()); actual.audit = [];
        // Missing seeding in an object is a known migration gap; do not prescribe it.
        if (Array.isArray(raw)) delete actual.config.seedingPolicy;
        const expected = plain(DEFAULT);
        if (Array.isArray(raw)) delete expected.config.seedingPolicy;
        assert.deepEqual(actual, expected);
    }
    const config = { ...DEFAULT.config, seedingPolicy: "unknown", thirdPlaceMatch: "yes" };
    for (const key of Object.keys(config).filter((key) => typeof DEFAULT.config[key] === "number")) config[key] = "12";
    s.S.importState(JSON.stringify({ version: 99, unknown: "discard", config, teams: [null, false, { id: "x", name: "X" }],
        terrains: [0, { id: "f", name: "F" }], phase1: { generated: 1, matches: [null, { id: "m" }], roundTimers: null },
        knockout: { generated: "", rounds: [false, { matches: [] }], thirdPlace: false, championTeamId: "" }, audit: [null, { message: "old" }] }));
    assert.deepEqual(plain(s.state().config), { ...DEFAULT.config, thirdPlaceMatch: true });
    assert.equal(s.state().version, 1);
    assert.equal(s.state().unknown, undefined);
    assert.equal(s.state().teams.length, 1);
    assert.equal(s.state().terrains.length, 1);
    assert.deepEqual(plain(s.state().phase1), { generated: true, matches: [{ id: "m" }], roundTimers: {} });
    assert.deepEqual(plain(s.state().knockout), { generated: false, rounds: [{ matches: [] }], thirdPlace: null, championTeamId: null });
    assert.equal(s.state().audit.length, 2);
    for (const value of [NaN, Infinity, -Infinity, undefined]) {
        const raw = { config: { ...DEFAULT.config, POINT_VICTORY_PHASE1: value }, teams: {}, terrains: "bad", phase1: 1, knockout: null, audit: {} };
        s.storage.setItem(STATE_KEY, JSON.stringify(raw)); s.S.load();
        assert.equal(s.state().config.POINT_VICTORY_PHASE1, 3);
        assert.deepEqual(plain(s.state().teams), []);
        assert.deepEqual(plain(s.state().terrains), []);
        assert.deepEqual(plain(s.state().phase1), DEFAULT.phase1);
        assert.deepEqual(plain(s.state().knockout), DEFAULT.knockout);
        assert.deepEqual(plain(s.state().audit), []);
    }
    s.S.importState(JSON.stringify({ config: { ...DEFAULT.config, seedingPolicy: "random" }, phase1: { roundTimers: { 0: { startedAt: 1 } } },
        knockout: { thirdPlace: { id: "third" }, championTeamId: "x" } }));
    assert.equal(s.state().config.seedingPolicy, "random");
    assert.equal(s.state().knockout.thirdPlace.id, "third");
    assert.equal(s.state().phase1.roundTimers["0"].startedAt, 1);
});
test("state: legacy shape remains operable; reset default plus audit preserves preferences", () => {
    const s = createSandbox();
    s.S.importState(JSON.stringify({ teams: [{ id: "a", name: "A" }, { id: "b", name: "B" }], terrains: [] }));
    s.A.updateConfig({ ...s.state().config, qualifiedCount: 2 });
    s.A.generatePhase1();
    for (const m of s.state().phase1.matches) s.A.applyPhase1Score(m.id, undefined, undefined, 1, 0);
    s.A.startKnockout();
    assert.ok(s.state().knockout.generated);
    s.storage.setItem(SUMMARY_KEY, '{"standingsHidden":true}');
    s.storage.setItem(OPERATOR_KEY, '{"sections":{"setup":false}}');
    s.S.resetAll();
    const actual = plain(s.state()); actual.audit = [];
    assert.deepEqual(actual, DEFAULT);
    assert.equal(s.state().audit[0].message, "Reset tournament state");
    assert.equal(s.storage.getItem(SUMMARY_KEY), '{"standingsHidden":true}');
    assert.equal(s.storage.getItem(OPERATOR_KEY), '{"sections":{"setup":false}}');
});

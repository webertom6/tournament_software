"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSandbox } = require("./harness");

test("timer: exact round elapsed table", () => {
    const t = createSandbox().T;
    for (const [args, expected] of [
        [[null, null, 0, 5000], null], [[1000, null, 0, 61000], 60000],
        [[1000, 31000, 0, 99000], 30000], [[1000, null, 20000, 61000], 40000],
        [[10000, null, 0, 5000], 0]
    ]) assert.equal(t.computeRoundElapsedMs(...args), expected);
});
test("timer: exact match elapsed table and stop/pause priority", () => {
    const t = createSandbox().T;
    for (const [start, pause, total, stop, match, now, expected] of [
        [null, null, 0, null, {}, 61000, null],
        [1000, null, 0, null, {}, 61000, 60000],
        [1000, null, 0, 41000, {}, 99000, 40000],
        [1000, 31000, 0, null, {}, 99000, 30000],
        [1000, 31000, 0, 41000, {}, 99000, 40000],
        [1000, null, 0, null, { pausedAt: 21000 }, 61000, 20000],
        [1000, null, 10000, null, { pausedTotalMs: 5000 }, 61000, 45000],
        [1000, null, 70000, null, { pausedTotalMs: 5000 }, 61000, 0]
    ]) assert.equal(t.computeElapsedMs(start, pause, total, stop, match, now), expected);
});
test("timer: break remaining table", () => {
    const t = createSandbox().T;
    for (const [match, duration, now, expected] of [
        [{}, 120, 61000, null], [{ pausedAt: 1000 }, 120, 61000, 60000],
        [{ pausedAt: 1000 }, 120, 181000, -60000], [{ pausedAt: 1000 }, "x", 11000, -10000]
    ]) assert.equal(t.computeBreakRemainingMs(match, duration, now), expected);
});
test("timer: duration and countdown literal formatting", () => {
    const t = createSandbox().T;
    for (const [input, expected] of [[null, "waiting"], [undefined, "waiting"], [NaN, "waiting"], [Infinity, "waiting"],
        [0, "00:00"], [999, "00:00"], [59999, "00:59"], [61000, "01:01"], [3599000, "59:59"],
        [3600000, "01:00:00"], [3661000, "01:01:01"], [-5000, "-00:05"]]) assert.equal(t.formatDuration(input), expected);
    for (const [input, expected] of [[null, "waiting"], [undefined, "waiting"], [NaN, "waiting"], [Infinity, "waiting"],
        [90000, "01:30"], [-1, "+00:00"], [-61000, "+01:01"]]) assert.equal(t.formatCountdown(input), expected);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, read, scriptOrder, ADMIN_SCRIPTS, LOGIC_SCRIPTS, SUMMARY_SCRIPTS, createSandbox } = require("./harness");
const { EXPORTS } = require("./oracles");

test("contracts: handwritten script order, including CRLF parsing", () => {
    assert.deepEqual(ADMIN_SCRIPTS, ["js/state.js", "js/timer.js", "js/rules.js", "js/scheduler.js", "js/bracket.js", "js/actions.js", "js/render.js", "js/main.js"]);
    assert.deepEqual(LOGIC_SCRIPTS, ADMIN_SCRIPTS.slice(0, 6));
    assert.deepEqual(SUMMARY_SCRIPTS, ["js/rules.js", "js/bracket.js", "js/timer.js", "js/summary.js"]);
    assert.deepEqual(scriptOrder("<script\r\n src='./js/rules.js'></script>\r\n<script src=\"./js/timer.js\"></script>"), ["js/rules.js", "js/timer.js"]);
});
test("contracts: exact namespaces and export keys, isolated contexts", () => {
    for (const page of ["admin", "summary"]) {
        const sandbox = createSandbox({ page });
        const expected = page === "admin" ? Object.keys(EXPORTS) : ["TournamentRules", "TournamentBracket", "TournamentTimer"];
        assert.deepEqual(Object.keys(sandbox.window).filter((key) => key.startsWith("Tournament")).sort(), expected.sort());
        for (const name of expected) {
            assert.deepEqual(Object.keys(sandbox.window[name]), EXPORTS[name]);
            for (const fn of Object.values(sandbox.window[name])) assert.equal(typeof fn, "function");
        }
    }
    const a = createSandbox();
    const b = createSandbox();
    a.A.addTeam("Only A");
    assert.equal(b.state().teams.length, 0);
    assert.equal(b.storage.length, 0);
});
test("contracts: file protocol safe scripts, links and referenced assets", () => {
    const files = ["index.html", "summary.html", ...new Set([...ADMIN_SCRIPTS, ...SUMMARY_SCRIPTS]),
        ...fs.readdirSync(path.join(ROOT, "css")).filter((name) => name.endsWith(".css")).map((name) => "css/" + name)];
    for (const file of files) {
        const source = read(file);
        if (file.endsWith(".html")) {
            assert.doesNotMatch(source, /<script[^>]*type\s*=\s*["']module/i);
            for (const [, ref] of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
                assert.doesNotMatch(ref, /^(?:[a-z]+:|\/\/|\/)/i);
                assert.ok(fs.existsSync(path.resolve(ROOT, path.dirname(file), ref)), file + ": " + ref);
            }
        }
        if (file.endsWith(".js")) assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|\bimport\s*\(/);
        for (const [, ref] of source.matchAll(/["']((?:\.\/)?assets\/[^"']+)["']/g)) assert.ok(fs.existsSync(path.join(ROOT, ref)));
        if (file.endsWith(".css")) {
            for (const [, ref] of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
                assert.doesNotMatch(ref, /^(?:https?:|\/\/)/);
                if (ref.startsWith("data:")) continue;
                assert.ok(fs.existsSync(path.resolve(ROOT, "css", ref)), ref);
            }
        }
    }
});

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(process.env.TOURNAMENT_TEST_ROOT || path.join(__dirname, ".."));
const STATE_KEY = "tournament_software_state_v1";
const SUMMARY_KEY = "tournament_software_summary_prefs_v1";
const OPERATOR_KEY = "tournament_software_operator_ui_prefs_v1";
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
function scriptOrder(html) {
    return Array.from(html.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi), (match) => {
        const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(match[1]);
        assert.ok(src, "All scripts must be external");
        return src[1].replace(/^\.\//, "");
    });
}
const ADMIN_SCRIPTS = scriptOrder(read("index.html"));
const LOGIC_SCRIPTS = ADMIN_SCRIPTS.slice(0, ADMIN_SCRIPTS.indexOf("js/render.js"));
const SUMMARY_SCRIPTS = scriptOrder(read("summary.html"));
const scripts = new Map();
const plain = (value) => JSON.parse(JSON.stringify(value));

class FakeStorage {
    constructor(initial = {}) {
        this.data = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
        this.writes = [];
    }
    getItem(key) { return this.data.has(String(key)) ? this.data.get(String(key)) : null; }
    setItem(key, value) {
        this.data.set(String(key), String(value));
        this.writes.push([String(key), String(value)]);
    }
    removeItem(key) { this.data.delete(String(key)); this.writes.push([String(key), null]); }
    clear() { this.data.clear(); this.writes.push(["*", null]); }
    key(index) { return Array.from(this.data.keys())[index] || null; }
    get length() { return this.data.size; }
}

function mulberry32(seed) {
    return () => {
        let n = seed += 0x6D2B79F5;
        n = Math.imul(n ^ n >>> 15, n | 1);
        n ^= n + Math.imul(n ^ n >>> 7, n | 61);
        return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
}
const decode = (text) => String(text).replace(/&(?:amp|lt|gt|quot|#39);/g,
    (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[entity]);
function matches(element, selector) {
    const attrs = [...selector.matchAll(/\[([^\]=]+)(?:\s*=\s*["']?([^"'\]]*)["']?)?\]/g)];
    for (const [, key, value] of attrs) {
        if (!element.hasAttribute(key) || (value !== undefined && element.getAttribute(key) !== value)) return false;
    }
    const basic = selector.replace(/\[[^\]]*\]/g, "");
    const tag = /^[\w-]+/.exec(basic);
    if (tag && element.tagName !== tag[0].toUpperCase()) return false;
    const id = /#([\w-]+)/.exec(basic);
    if (id && element.id !== id[1]) return false;
    return [...basic.matchAll(/\.([\w-]+)/g)].every(([, name]) => element.classList.contains(name));
}
class Element {
    constructor(tag, doc) {
        this.tagName = tag.toUpperCase();
        this.ownerDocument = doc;
        this.attributes = {};
        this.children = [];
        this.listeners = new Map();
        this.style = {};
        this._text = "";
        this._html = "";
        this._value = undefined;
        this.hidden = false;
        this.disabled = false;
        this.checked = false;
        this.open = false;
        this.scrollLeft = 0;
        this.scrollWidth = 2000;
        this.clientWidth = 800;
        this.scrollHeight = 2000;
        this.classList = {
            contains: (name) => (this.attributes.class || "").split(/\s+/).includes(name),
            toggle: (name, force) => {
                const names = new Set((this.attributes.class || "").split(/\s+/).filter(Boolean));
                const add = force === undefined ? !names.has(name) : force;
                if (add) names.add(name); else names.delete(name);
                this.attributes.class = [...names].join(" ");
                return add;
            },
            add: (name) => this.classList.toggle(name, true),
            remove: (name) => this.classList.toggle(name, false)
        };
    }
    get id() { return this.attributes.id || ""; }
    set id(value) { this.setAttribute("id", value); }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
        this._html = String(value);
        this._text = "";
        this.children = [];
        parseInto(this, this._html);
        this.ownerDocument.renderCount += 1;
    }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
    set textContent(value) { this._text = String(value); this.children = []; this._html = ""; }
    get value() {
        if (this._value !== undefined) return this._value;
        if (this.tagName === "SELECT") {
            const options = this.querySelectorAll("option");
            const option = options.find((item) => item.hasAttribute("selected")) || options[0];
            return option ? option.getAttribute("value") || "" : "";
        }
        return this.getAttribute("value") || "";
    }
    set value(value) { this._value = String(value); }
    setAttribute(key, value) {
        this.attributes[key] = String(value);
        if (["disabled", "hidden", "checked", "open"].includes(key)) this[key] = true;
    }
    getAttribute(key) { return Object.hasOwn(this.attributes, key) ? this.attributes[key] : null; }
    hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
    removeAttribute(key) { delete this.attributes[key]; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    remove() {
        if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
    }
    querySelectorAll(selector) {
        const result = [];
        for (const part of selector.split(/\s*,\s*/)) {
            if (part.startsWith(":scope > ")) {
                result.push(...this.children.filter((child) => matches(child, part.slice(9))));
                continue;
            }
            const segments = part.trim().split(/\s+(?![^\[]*\])/);
            const walk = (node) => {
                for (const child of node.children) {
                    if (matches(child, segments[segments.length - 1])) {
                        let ancestor = child.parentElement;
                        let index = segments.length - 2;
                        while (index >= 0 && ancestor) {
                            if (matches(ancestor, segments[index])) index -= 1;
                            ancestor = ancestor.parentElement;
                        }
                        if (index < 0) result.push(child);
                    }
                    walk(child);
                }
            };
            walk(this);
        }
        return [...new Set(result)];
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    matches(selector) { return matches(this, selector); }
    closest(selector) {
        for (let element = this; element; element = element.parentElement) if (matches(element, selector)) return element;
        return null;
    }
    addEventListener(type, fn) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(fn);
    }
    async dispatch(type, extra = {}) {
        const event = Object.assign({ target: this, preventDefault() {} }, extra);
        const pending = (this.listeners.get(type) || []).map((fn) => fn(event));
        if (["click", "input", "focusin", "focusout", "keydown", "pointerdown"].includes(type) && this.parentElement) {
            pending.push(this.parentElement.dispatch(type, event));
        }
        await Promise.all(pending);
    }
    click() { this.ownerDocument.clicks.push(this); return this.dispatch("click"); }
    focus() {
        this.ownerDocument.activeElement = this;
        return this.dispatch("focusin");
    }
    select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
    scrollIntoView(options) { this.ownerDocument.scrolls.push([this, options]); }
    scrollTo(options) { this.scrollLeft = options.left || 0; }
    getBoundingClientRect() { return { left: Number(this.getAttribute("data-round-index") || 0) * 240, top: 0 }; }
    getContext() { return { font: "", measureText: (text) => ({ width: String(text).length * 8 }) }; }
}
function parseInto(parent, html) {
    const stack = [parent];
    const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "wbr"]);
    for (const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[\w-]+\b[^>]*>|[^<]+/g)) {
        const text = token[0];
        if (text.startsWith("<!")) continue;
        if (text.startsWith("</")) {
            const tag = text.slice(2).match(/^[\w-]+/)[0].toUpperCase();
            const index = stack.findLastIndex((element) => element.tagName === tag);
            if (index > 0) stack.length = index;
        } else if (text.startsWith("<")) {
            const tag = /^<([\w-]+)/.exec(text)[1];
            const element = new Element(tag, parent.ownerDocument);
            const attrs = text.slice(tag.length + 1, -1);
            for (const [, name, double, single, bare] of attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
                element.setAttribute(name, decode(double ?? single ?? bare ?? ""));
            }
            stack[stack.length - 1].appendChild(element);
            if (!voidTags.has(tag.toLowerCase()) && !text.endsWith("/>")) stack.push(element);
        } else {
            const node = new Element("text", parent.ownerDocument);
            node._text = decode(text);
            stack[stack.length - 1].appendChild(node);
        }
    }
}
function createDocument(html) {
    const doc = { clicks: [], scrolls: [], renderCount: 0 };
    const root = new Element("document", doc);
    parseInto(root, html);
    doc.querySelectorAll = (selector) => root.querySelectorAll(selector);
    doc.querySelector = (selector) => root.querySelector(selector);
    doc.getElementById = (id) => root.querySelector("#" + id);
    doc.createElement = (tag) => new Element(tag, doc);
    doc.addEventListener = (type, fn) => root.addEventListener(type, fn);
    doc.documentElement = doc.querySelector("html");
    doc.head = doc.querySelector("head");
    doc.body = doc.querySelector("body");
    return doc;
}
function createSandbox(options = {}) {
    const page = options.page || "logic";
    const storage = options.storage || new FakeStorage(options.initial);
    let now = options.now ?? 1700000000000;
    let random = mulberry32(options.seed ?? 1);
    class FakeDate extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    const document = createDocument(read(page === "summary" ? "summary.html" : "index.html"));
    const timers = new Map();
    const listeners = new Map();
    const logs = [];
    const alerts = [];
    const confirms = [];
    const blobs = [];
    const revoked = [];
    let timerId = 0;
    let prints = 0;
    const recordTimer = (kind) => (fn, delay) => {
        const id = ++timerId;
        timers.set(id, { kind, fn, delay, active: true });
        return id;
    };
    const context = vm.createContext({
        document, localStorage: storage, Date: FakeDate,
        Math: Object.assign(Object.create(Math), { random: () => random() }),
        console: Object.fromEntries(["log", "warn", "error", "info"].map((name) => [name, (...args) => logs.push([name, ...args])])),
        HTMLElement: Element,
        setInterval: recordTimer("interval"), setTimeout: recordTimer("timeout"),
        clearInterval: (id) => { if (timers.has(id)) timers.get(id).active = false; },
        clearTimeout: (id) => { if (timers.has(id)) timers.get(id).active = false; },
        alert: (message) => alerts.push(String(message)),
        confirm: (message) => { confirms.push(String(message)); return sandbox.confirmResult; },
        print: () => { prints += 1; },
        Blob: class { constructor(parts, config) { this.parts = parts; this.type = config.type; } },
        URL: {
            createObjectURL: (blob) => { blobs.push(blob); return "blob:test/" + blobs.length; },
            revokeObjectURL: (url) => revoked.push(url)
        },
        innerHeight: 800, scrollY: 0,
        scrollTo: (x, y) => { context.scrollY = typeof x === "object" ? x.top : y; },
        matchMedia: () => ({ matches: Boolean(options.wide) }),
        addEventListener: (type, fn) => {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(fn);
        },
        removeEventListener: (type, fn) => listeners.set(type, (listeners.get(type) || []).filter((item) => item !== fn))
    });
    context.window = context;
    const sandbox = {
        window: context, document, storage, timers, listeners, logs, alerts, confirms, blobs, revoked,
        confirmResult: true,
        get prints() { return prints; },
        get now() { return now; },
        setNow(value) { now = value; },
        advance(ms) { now += ms; },
        seed(value) { random = mulberry32(value); },
        runTimers(delay) {
            for (const timer of [...timers.values()]) if (timer.active && timer.delay === delay) {
                if (timer.kind === "timeout") timer.active = false;
                timer.fn();
            }
        },
        dispatchWindow(type, event) { for (const fn of listeners.get(type) || []) fn(event); },
        load(files) {
            for (const file of files) {
                if (!scripts.has(file)) scripts.set(file, new vm.Script(read(file), { filename: path.join(ROOT, file) }));
                scripts.get(file).runInContext(context);
            }
        }
    };
    sandbox.load(options.scripts || (page === "summary" ? SUMMARY_SCRIPTS : page === "admin" ? ADMIN_SCRIPTS : LOGIC_SCRIPTS));
    sandbox.S = context.TournamentState;
    sandbox.A = context.TournamentActions;
    sandbox.R = context.TournamentRules;
    sandbox.B = context.TournamentBracket;
    sandbox.T = context.TournamentTimer;
    sandbox.state = () => sandbox.S.getState();
    sandbox.el = (id) => document.getElementById(id);
    return sandbox;
}
function expectRejected(sandbox, fn, message) {
    const before = sandbox.S.exportState();
    const storage = [...sandbox.storage.data];
    const writes = sandbox.storage.writes.length;
    let notifications = 0;
    const unsubscribe = sandbox.S.subscribe(() => notifications++);
    assert.throws(fn, (error) => message instanceof RegExp ? message.test(error.message) : error.message === message);
    unsubscribe();
    assert.equal(sandbox.S.exportState(), before, "Rejected action changed state");
    assert.deepEqual([...sandbox.storage.data], storage);
    assert.equal(sandbox.storage.writes.length, writes);
    assert.equal(notifications, 0);
}
async function clickAction(sandbox, action, attrs = {}) {
    const selector = '[data-action="' + action + '"]' + Object.entries(attrs).map(([key, value]) => '[' + key + '="' + value + '"]').join("");
    const target = sandbox.document.querySelector(selector);
    assert.ok(target, "Missing action " + selector);
    await target.click();
}
function setup(sandbox, count = 4, terrains = 2, config = {}) {
    const qualifiedCount = count >= 2 ? Math.pow(2, Math.floor(Math.log2(count))) : 2;
    sandbox.S.update((state) => {
        state.teams = Array.from({ length: count }, (_, index) => ({ id: "t" + (index + 1), name: "Team " + String(index + 1).padStart(2, "0") }));
        state.terrains = Array.from({ length: terrains }, (_, index) => ({ id: "f" + (index + 1), name: "Field " + (index + 1) }));
        Object.assign(state.config, { phase1MatchesPerTeam: 1, qualifiedCount }, config);
    });
    return sandbox.state();
}
function completePhase1(sandbox) {
    for (const match of sandbox.state().phase1.matches) sandbox.A.applyPhase1Score(match.id, undefined, undefined, 2, 0);
}
function knockoutFixture(options = {}) {
    const sandbox = createSandbox(options);
    const count = options.count || 4;
    setup(sandbox, count, 2, { thirdPlaceMatch: true, phase1MatchesPerTeam: count % 2 ? 2 : 1 });
    sandbox.A.generatePhase1();
    completePhase1(sandbox);
    sandbox.A.startKnockout();
    return sandbox;
}
function scoreWinner(sandbox, match, teamId) {
    sandbox.A.applyKnockoutScore(match.id, undefined, undefined, teamId === match.homeTeamId ? 2 : 0, teamId === match.awayTeamId ? 2 : 0);
}
module.exports = {
    ROOT, STATE_KEY, SUMMARY_KEY, OPERATOR_KEY, read, scriptOrder, ADMIN_SCRIPTS, LOGIC_SCRIPTS, SUMMARY_SCRIPTS,
    FakeStorage, plain, createSandbox, expectRejected, clickAction, setup, completePhase1, knockoutFixture, scoreWinner
};

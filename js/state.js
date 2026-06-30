(function () {
    const STORAGE_KEY = "tournament_software_state_v1";
    const VERSION = 1;

    function uid(prefix) {
        return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    }

    function createDefaultState() {
        return {
            version: VERSION,
            config: {
                POINT_VICTORY_PHASE1: 3,
                POINT_DRAW_PHASE1: 1,
                POINT_LOSS_PHASE1: 0,
                qualifiedCount: 4,
                seedingPolicy: "ranking",
                thirdPlaceMatch: false
            },
            teams: [],
            terrains: [],
            phase1: {
                generated: false,
                matches: []
            },
            knockout: {
                generated: false,
                rounds: [],
                thirdPlace: null,
                championTeamId: null
            },
            audit: []
        };
    }

    function sanitizeImportedState(raw) {
        const fallback = createDefaultState();
        if (!raw || typeof raw !== "object") {
            return fallback;
        }

        const safe = {
            version: VERSION,
            config: {
                POINT_VICTORY_PHASE1: Number.isFinite(raw.config && raw.config.POINT_VICTORY_PHASE1) ? raw.config.POINT_VICTORY_PHASE1 : fallback.config.POINT_VICTORY_PHASE1,
                POINT_DRAW_PHASE1: Number.isFinite(raw.config && raw.config.POINT_DRAW_PHASE1) ? raw.config.POINT_DRAW_PHASE1 : fallback.config.POINT_DRAW_PHASE1,
                POINT_LOSS_PHASE1: Number.isFinite(raw.config && raw.config.POINT_LOSS_PHASE1) ? raw.config.POINT_LOSS_PHASE1 : fallback.config.POINT_LOSS_PHASE1,
                qualifiedCount: Number.isFinite(raw.config && raw.config.qualifiedCount) ? raw.config.qualifiedCount : fallback.config.qualifiedCount,
                seedingPolicy: raw.config && (raw.config.seedingPolicy === "random" ? "random" : "ranking"),
                thirdPlaceMatch: Boolean(raw.config && raw.config.thirdPlaceMatch)
            },
            teams: Array.isArray(raw.teams) ? raw.teams.filter(Boolean) : [],
            terrains: Array.isArray(raw.terrains) ? raw.terrains.filter(Boolean) : [],
            phase1: raw.phase1 && typeof raw.phase1 === "object" ? {
                generated: Boolean(raw.phase1.generated),
                matches: Array.isArray(raw.phase1.matches) ? raw.phase1.matches.filter(Boolean) : []
            } : fallback.phase1,
            knockout: raw.knockout && typeof raw.knockout === "object" ? {
                generated: Boolean(raw.knockout.generated),
                rounds: Array.isArray(raw.knockout.rounds) ? raw.knockout.rounds.filter(Boolean) : [],
                thirdPlace: raw.knockout.thirdPlace || null,
                championTeamId: raw.knockout.championTeamId || null
            } : fallback.knockout,
            audit: Array.isArray(raw.audit) ? raw.audit.filter(Boolean) : []
        };

        return safe;
    }

    let state = createDefaultState();
    const subscribers = [];

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            state = createDefaultState();
            return;
        }

        try {
            state = sanitizeImportedState(JSON.parse(raw));
        } catch (error) {
            console.error("Failed to parse state:", error);
            state = createDefaultState();
        }
    }

    function notify() {
        subscribers.forEach((fn) => fn(state));
    }

    function subscribe(fn) {
        subscribers.push(fn);
        return function unsubscribe() {
            const index = subscribers.indexOf(fn);
            if (index >= 0) {
                subscribers.splice(index, 1);
            }
        };
    }

    function addAudit(message) {
        state.audit.unshift({
            id: uid("audit"),
            at: new Date().toISOString(),
            message: String(message || "").trim()
        });

        if (state.audit.length > 300) {
            state.audit = state.audit.slice(0, 300);
        }
    }

    function update(mutator, auditMessage) {
        mutator(state);
        if (auditMessage) {
            addAudit(auditMessage);
        }
        save();
        notify();
    }

    function resetAll() {
        state = createDefaultState();
        addAudit("Reset tournament state");
        save();
        notify();
    }

    function getState() {
        return state;
    }

    function exportState() {
        return JSON.stringify(state, null, 2);
    }

    function importState(jsonText) {
        const parsed = JSON.parse(jsonText);
        state = sanitizeImportedState(parsed);
        addAudit("Imported tournament state");
        save();
        notify();
    }

    window.TournamentState = {
        uid: uid,
        load: load,
        save: save,
        resetAll: resetAll,
        subscribe: subscribe,
        update: update,
        getState: getState,
        exportState: exportState,
        importState: importState
    };
})();

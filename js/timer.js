(function () {
    // round-level elapsed: time since round start, minus whatever the round itself has
    // been paused for; freezes at roundPausedAt while the round is currently paused
    function computeRoundElapsedMs(roundStartedAt, roundPausedAt, roundPausedTotalMs, atTime) {
        if (!roundStartedAt) {
            return null;
        }
        const activeEnd = roundPausedAt || atTime;
        return Math.max(0, activeEnd - roundStartedAt - (roundPausedTotalMs || 0));
    }

    // match-level elapsed: same as the round's, further frozen at the match's own
    // pausedAt if it's individually paused (round-level pause always takes priority,
    // since nothing progresses for anyone while the whole round is paused)
    function computeElapsedMs(roundStartedAt, roundPausedAt, roundPausedTotalMs, match, atTime) {
        if (!roundStartedAt) {
            return null;
        }
        const roundActiveEnd = roundPausedAt || atTime;
        const activeEnd = match.pausedAt || roundActiveEnd;
        const pausedTotal = (roundPausedTotalMs || 0) + (match.pausedTotalMs || 0);
        return Math.max(0, activeEnd - roundStartedAt - pausedTotal);
    }

    // reference countdown shown while paused (half-time/timeout), purely informational
    function computeBreakRemainingMs(match, pauseDurationSeconds, atTime) {
        if (!match.pausedAt) {
            return null;
        }
        const elapsedPause = atTime - match.pausedAt;
        return (Number(pauseDurationSeconds) || 0) * 1000 - elapsedPause;
    }

    function formatDuration(ms) {
        if (ms === null || ms === undefined || !Number.isFinite(ms)) {
            return "waiting";
        }
        const sign = ms < 0 ? "-" : "";
        const totalSeconds = Math.floor(Math.abs(ms) / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const pad = (value) => String(value).padStart(2, "0");
        return sign + (h > 0 ? pad(h) + ":" : "") + pad(m) + ":" + pad(s);
    }

    // remaining time counting down to the configured match duration; goes negative (shown as "+overtime") past it
    function formatCountdown(remainingMs) {
        if (remainingMs === null || remainingMs === undefined || !Number.isFinite(remainingMs)) {
            return "waiting";
        }
        if (remainingMs < 0) {
            return "+" + formatDuration(-remainingMs);
        }
        return formatDuration(remainingMs);
    }

    window.TournamentTimer = {
        computeRoundElapsedMs: computeRoundElapsedMs,
        computeElapsedMs: computeElapsedMs,
        computeBreakRemainingMs: computeBreakRemainingMs,
        formatDuration: formatDuration,
        formatCountdown: formatCountdown
    };
})();


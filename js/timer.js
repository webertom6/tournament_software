(function () {
    // elapsed = time since round start, minus whatever this match has been paused for
    function computeElapsedMs(roundStartedAt, match, atTime) {
        if (!roundStartedAt) {
            return null;
        }
        const pausedTotal = match.pausedTotalMs || 0;
        const activeEnd = match.pausedAt || atTime;
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
            return "--:--";
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
            return "--:--";
        }
        if (remainingMs < 0) {
            return "+" + formatDuration(-remainingMs);
        }
        return formatDuration(remainingMs);
    }

    window.TournamentTimer = {
        computeElapsedMs: computeElapsedMs,
        computeBreakRemainingMs: computeBreakRemainingMs,
        formatDuration: formatDuration,
        formatCountdown: formatCountdown
    };
})();

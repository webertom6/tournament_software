(function () {
    function main() {
        window.TournamentState.load();
        window.TournamentRender.bindEvents();
        window.TournamentRender.renderApp(window.TournamentState.getState());
        window.TournamentState.subscribe((state) => {
            window.TournamentRender.renderApp(state);
        });
        window.setInterval(window.TournamentRender.tickTimers, 1000);
    }

    main();
})();

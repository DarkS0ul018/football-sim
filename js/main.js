// ===== ТОЧКА ВХОДА =====
// Порядок подключения скриптов задан в index.html:
// data → core (state, engine, tournament, storage) → ui → main

initStatTabs();
initSetupScreens();
initMatchScreen();
initTacticsScreen();

$('btn-next-season').addEventListener('click', () => {
    startNextSeason();
    renderTeamsList();
    showScreen('teamsList');
});

$('btn-restart').addEventListener('click', () => {
    clearSave();
    location.reload();
});

// ===== ТОЧКА ВХОДА =====
// Порядок подключения скриптов задан в index.html:
// data → core (state, engine, tournament, storage) → ui → main

applyCustomData(); // правки из редактора команд — до всего остального
initStatTabs();
initEditorScreen();
initSetupScreens();
initMatchScreen();
initTacticsScreen();
initSound();

$('btn-next-season').addEventListener('click', () => {
    startNextSeason();
    renderTeamsList();
    showScreen('teamsList');
});

$('btn-restart').addEventListener('click', () => {
    clearSave();
    location.reload();
});

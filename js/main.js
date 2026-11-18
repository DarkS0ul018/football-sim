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
initTransfersScreen();

// Следующий сезон начинается с трансферного окна
$('btn-next-season').addEventListener('click', openTransferWindow);

$('btn-restart').addEventListener('click', () => {
    clearSave();
    location.reload();
});

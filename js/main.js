// ===== ТОЧКА ВХОДА =====
// Порядок подключения скриптов задан в index.html:
// data → core (state, engine, tournament, storage) → ui → main

applyCustomData(); // правки из редактора команд — до всего остального
// Свежий опубликованный стандарт с сайта: если изменился — обновляем открытые экраны
fetchPublishedData(() => {
    if (screens.editor && screens.editor.classList.contains("active")) { renderEditorList(); renderEditorForm(); }
    if (screens.setup && screens.setup.classList.contains("active") && typeof onTeamTypeChange === "function") onTeamTypeChange();
    if (screens.home.classList.contains("active")) renderHome();
});
initStatTabs();
initEditorScreen();
initSetupScreens();
initHome();
initSeriesScreen();
initPickerScreen();
initMatchScreen();
initTacticsScreen();
initSound();
initTransfersScreen();

// Следующий сезон начинается с трансферного окна
$('btn-next-season').onclick = openTransferWindow; // для сборной результаты ставят «Следующий турнир»

$('btn-restart').addEventListener('click', () => {
    clearSave();
    location.reload();
});

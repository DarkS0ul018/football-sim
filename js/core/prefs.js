// ===== НАСТРОЙКИ ИГРЫ (этого устройства) =====
// Тема, цвет, скорость матча по умолчанию и правила: погода, травмы, дисквалификации, экран перед матчем.
// Хранятся в localStorage; движок читает только правила (здесь нет DOM).

const PREFS_KEY = 'footballSimPro.prefs';
const PREFS_DEFAULT = { theme: 'dark', accent: 'lime', speed: 5, weather: true, injuries: true, bans: true, preview: true };

let prefs = (() => {
    try { return { ...PREFS_DEFAULT, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) }; } catch (e) { return { ...PREFS_DEFAULT }; }
})();

function setPref(key, value) {
    prefs = { ...prefs, [key]: value };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
}

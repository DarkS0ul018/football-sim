// ===== ОКНО НАСТРОЕК И ОФОРМЛЕНИЕ =====
// Тема (тёмная/светлая), цвет акцента, скорость матча, звук и правила игры. Всё — в prefs (js/core/prefs.js).

const ACCENTS = {
    lime:   { name: 'Лайм',    dark: ['#b8f24a', '#8fd22a', '#0a1405'], light: ['#5f9e12', '#4c8509', '#ffffff'] },
    blue:   { name: 'Синий',   dark: ['#4fa8ff', '#2f86e0', '#04121f'], light: ['#1f6fd1', '#1759ad', '#ffffff'] },
    red:    { name: 'Красный', dark: ['#ff5468', '#e0303f', '#1f0306'], light: ['#d42a3c', '#b01e2e', '#ffffff'] },
    gold:   { name: 'Золото',  dark: ['#f5c84b', '#d9a92a', '#1f1603'], light: ['#b8860b', '#996f05', '#ffffff'] },
    purple: { name: 'Фиолет',  dark: ['#b98aff', '#9356f0', '#12061f'], light: ['#7a3fd6', '#632fb5', '#ffffff'] }
};

// Применяет тему и акцент. В еврокубках своё оформление важнее — светлая тема там не включается.
function applyPrefs() {
    const body = document.body;
    const cup = ['theme-ucl', 'theme-uel', 'theme-uecl'].some(c => body.classList.contains(c));
    const light = prefs.theme === 'light' && !cup;
    body.classList.toggle('theme-light', light);
    const a = (ACCENTS[prefs.accent] || ACCENTS.lime)[light ? 'light' : 'dark'];
    const root = document.documentElement.style;
    root.setProperty('--accent', a[0]);
    root.setProperty('--accent-2', a[1]);
    root.setProperty('--accent-ink', a[2]);
    root.setProperty('--accent-glow', a[0] + '59');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f3f6fb' : '#070d1a');
}

function openSettings() {
    document.querySelector('.settings-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay settings-overlay';
    const toggle = (key, label, hint) => `<label class="set-toggle"><span><b>${label}</b><small class="muted">${hint}</small></span>
        <input type="checkbox" data-pref="${key}" ${prefs[key] ? 'checked' : ''}><i></i></label>`;
    el.innerHTML = `<div class="confirm-box settings-box" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <h3>⚙️ Настройки</h3>
        <div class="set-group">
            <div class="set-label">Тема</div>
            <div class="set-seg">${[['dark', '🌙 Тёмная'], ['light', '☀️ Светлая']].map(([v, l]) => `<button type="button" data-theme="${v}" class="${prefs.theme === v ? 'active' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div class="set-group">
            <div class="set-label">Цвет акцента</div>
            <div class="set-swatches">${Object.entries(ACCENTS).map(([k, a]) => `<button type="button" data-accent="${k}" class="${prefs.accent === k ? 'active' : ''}" style="--sw:${a.dark[0]}" title="${a.name}"><i></i><span>${a.name}</span></button>`).join('')}</div>
        </div>
        <div class="set-group">
            <div class="set-label">Скорость матча по умолчанию: <b id="set-speed-val">${prefs.speed}</b></div>
            <input type="range" min="1" max="10" value="${prefs.speed}" id="set-speed">
        </div>
        <div class="set-group">
            <div class="set-label">Штрафные и угловые в живом матче</div>
            <div class="set-seg">${[['show', '🎬 Подробно'], ['normal', '⚖️ Обычно'], ['fast', '⚡ Быстро']].map(([v, l]) => `<button type="button" data-sp="${v}" class="${(prefs.spMode || 'normal') === v ? 'active' : ''}">${l}</button>`).join('')}</div>
            <small class="muted set-note">Подробно — матч притормаживает на стандартах, камера показывает из-за спины бьющего. Обычно — ракурс только на спокойной скорости. Быстро — без остановок и смены ракурса.</small>
        </div>
        <div class="set-group">
            <div class="set-label">Звук</div>
            <div class="set-seg">${[['on', '🔊 Стадион'], ['nocrowd', '🔉 Без трибун'], ['off', '🔇 Выкл']].map(([v, l]) => `<button type="button" data-sound="${v}" class="${sound.mode === v ? 'active' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div class="set-group">
            <div class="set-label">Правила и экраны</div>
            ${toggle('camera', 'ТВ-камера по умолчанию', 'поле крупнее, камера ведёт мяч; выкл — всё поле целиком. В матче: кнопка на поле или клавиша C')}
            ${toggle('preview', 'Экран перед матчем', 'составы, форма, прогноз, погода')}
            ${toggle('weather', 'Погода', 'дождь, снег, жара влияют на игру')}
            ${toggle('injuries', 'Травмы', 'игроки могут выбыть на несколько матчей')}
            ${toggle('bans', 'Дисквалификации', 'за красные и накопленные жёлтые')}
            <div class="muted set-note">Правила действуют на матчи, сыгранные после изменения.</div>
        </div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('.pc-close')) { el.remove(); return; }
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.theme) { setPref('theme', b.dataset.theme); applyPrefs(); }
        else if (b.dataset.accent) { setPref('accent', b.dataset.accent); applyPrefs(); }
        else if (b.dataset.sound) setSoundMode(b.dataset.sound);
        else if (b.dataset.sp) setPref('spMode', b.dataset.sp);
        else return;
        const group = b.parentElement;
        group.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    el.querySelectorAll('[data-pref]').forEach(inp => inp.onchange = () => { setPref(inp.dataset.pref, inp.checked); if (inp.dataset.pref === 'camera' && typeof renderCameraToggle === 'function') renderCameraToggle(); });
    const sp = el.querySelector('#set-speed');
    sp.oninput = () => {
        setPref('speed', Number(sp.value));
        setText('set-speed-val', sp.value);
        const ms = $('match-speed');
        if (ms && !simStep) { ms.value = sp.value; ms.dispatchEvent(new Event('input')); }
    };
}

function initSettings() {
    applyPrefs();
    $('btn-settings').onclick = openSettings;
    const ms = $('match-speed');
    if (ms) {
        ms.value = prefs.speed;
        ms.addEventListener('change', () => setPref('speed', Number(ms.value)));
    }
}

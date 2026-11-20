// ===== ГЛАВНОЕ МЕНЮ =====
// Плитки турниров (в один клик) и режимов. Подробные настройки — экран «Свой турнир» (setup).

const HOME_CUPS = [
    { id: 'worldcup', icon: '🌍', title: 'Чемпионат мира', cls: 'tile-wc', type: 'worldcup', nations: true },
    { id: 'euro', icon: '⭐', title: 'Чемпионат Европы', cls: 'tile-euro', type: 'euro', nations: true },
    { id: 'copa', icon: '🌎', title: 'Кубок Америки', cls: 'tile-copa', type: 'copa', nations: true },
    { id: 'clubs', icon: '🏆', title: 'Еврокубок', cls: 'tile-clubs', type: 'world', sub: '32 клуба · группы и плей-офф в два матча',
      settings: { mode: 'groups', count: 32, groupLegs: 2, playoffLegs: 2 } },
    { id: 'rpl', icon: '🏟️', title: 'Российская Премьер-лига', cls: 'tile-rpl', type: 'russia', sub: '16 клубов · два круга',
      settings: { mode: 'league', count: 16, groupLegs: 2, playoffLegs: 1 } },
    { id: 'mixed', icon: '⚔️', title: 'Россия против Европы', cls: 'tile-mixed', type: 'mixed', sub: '16 клубов РПЛ и Европы · группы и плей-офф',
      settings: { mode: 'groups', count: 16, groupLegs: 1, playoffLegs: 2 } }
];

const HOME_MODES = {
    simulator: { icon: '📺', title: 'Смотреть турнир', text: 'Все матчи — вы зритель: вживую или быстрым результатом' },
    career: { icon: '👔', title: 'Играть за команду', text: 'Выбираете клуб: состав, тактика, решения по ходу матча' },
    duo: { icon: '👥', title: 'Вдвоём', text: 'Две команды на одном устройстве — по очереди' }
};

function homeCupInfo(c) {
    if (c.nations) {
        const cup = NATION_CUPS[c.type];
        return { sub: `${cup.count} ${cup.count === 24 || cup.count === 32 ? 'сборные' : 'сборных'} · группы и плей-офф`,
            teams: [...cup.names].sort((a, b) => (teamRatings[b] ?? 0) - (teamRatings[a] ?? 0)) };
    }
    const data = getTeamsData(c.type);
    return { sub: c.sub, teams: [...data.names].sort((a, b) => (teamRatings[b] ?? 0) - (teamRatings[a] ?? 0)) };
}

function homeCrestRow(names) {
    return names.slice(0, 5).map(name => {
        const emoji = (worldTeams.names.includes(name) ? worldTeams.emojis[worldTeams.names.indexOf(name)]
            : russianTeams.emojis[russianTeams.names.indexOf(name)]) || '';
        return `<span class="ht-crest" title="${escapeHtml(name)}">${crestHtml({ name, emoji }, 'sm')}</span>`;
    }).join('');
}

function renderHome() {
    // Шапка: сколько всего в игре
    const nations = typeof NATIONS !== 'undefined' ? Object.keys(NATIONS).length : 0;
    const clubs = worldTeams.names.length + russianTeams.names.length;
    const players = ['world', 'russia'].reduce((a, t) => a + Object.values(SQUADS[t] || {}).reduce((s, sq) => s + Object.values(sq).flat().length, 0), 0);
    $('home-chips').innerHTML = [`${clubs} клубов`, `${nations} сборных`, `${players}+ игроков`].map(t => `<span>${t}</span>`).join('');

    // Продолжить
    const save = readSave();
    $('home-resume').style.display = save ? '' : 'none';
    if (save) {
        const info = describeSave(save);
        setText('home-resume-title', info.title);
        setText('home-resume-details', info.details);
    }

    // Турниры
    $('home-cups').innerHTML = HOME_CUPS.map(c => {
        const info = homeCupInfo(c);
        return `<button type="button" class="home-tile ${c.cls}" data-cup="${c.id}">
            <span class="ht-icon">${c.icon}</span>
            <span class="ht-title">${c.title}</span>
            <span class="ht-sub">${info.sub}</span>
            <span class="ht-crests">${homeCrestRow(info.teams)}</span>
            <span class="ht-go">→</span>
        </button>`;
    }).join('');

    // Режимы
    const modes = [
        { id: 'career', icon: '👔', title: 'Карьера', sub: 'Ведите клуб сезон за сезоном: трансферы, кубок, рост игроков' },
        { id: 'duo', icon: '👥', title: 'Вдвоём', sub: 'Каждый за свою команду на одном устройстве' },
        { id: 'custom', icon: '⚙️', title: 'Свой турнир', sub: 'Любой формат, число команд, свои участники' },
        { id: 'editor', icon: '✏️', title: 'Редактор', sub: 'Составы, рейтинги, эмблемы, свои команды и сборные' }
    ];
    $('home-modes').innerHTML = modes.map(m => `<button type="button" class="home-tile home-mode" data-mode="${m.id}">
        <span class="ht-icon">${m.icon}</span>
        <span class="ht-title">${m.title}</span>
        <span class="ht-sub">${m.sub}</span>
        <span class="ht-go">→</span>
    </button>`).join('');

    // Зал славы — на главной
    const hall = $('hall-card');
    if (hall && hall.parentElement !== $('home-hall-slot')) $('home-hall-slot').appendChild(hall);
    renderHall();
}

// ----- Окно «Как играем?» -----
function openHomeSheet(title, items) {
    document.querySelector('.home-sheet-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay home-sheet-overlay';
    el.innerHTML = `<div class="confirm-box home-sheet" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <h3>${title}</h3>
        <div class="hs-list">${items.map((it, i) => `<button type="button" class="hs-item ${it.minor ? 'hs-minor' : ''}" data-i="${i}">
            <span class="hs-icon">${it.icon}</span>
            <span class="hs-text"><b>${it.title}</b>${it.text ? `<small>${it.text}</small>` : ''}</span>
        </button>`).join('')}</div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('.pc-close')) { el.remove(); return; }
        const b = e.target.closest('.hs-item');
        if (!b) return;
        el.remove();
        items[Number(b.dataset.i)].run();
    });
}

function setSelect(id, value) {
    const s = $(id);
    if (!s || value === undefined) return;
    s.value = String(value);
}

// Заполняет экран «Свой турнир» под выбранный турнир
function applyHomePreset(cup, gameMode) {
    setSelect('team-type', cup.type);
    onTeamTypeChange();                     // для сборных сам ставит настоящий формат
    const s = cup.settings || { groupLegs: 1, playoffLegs: 1 };
    setSelect('tournament-mode', s.mode);
    setSelect('team-count', s.count);
    setSelect('group-legs', s.groupLegs);
    setSelect('playoff-legs', s.playoffLegs);
    setSelect('team-pick', 'random');
    setSelect('game-mode', gameMode);
    validateSettings();
}

function startHomePreset(cup, gameMode) {
    applyHomePreset(cup, gameMode);
    onStartClick();
}

function openCupSheet(cup) {
    const modes = cup.nations ? ['simulator', 'duo'] : ['simulator', 'career', 'duo'];
    openHomeSheet(`${cup.icon} ${cup.title}`, [
        ...modes.map(m => ({ ...HOME_MODES[m], run: () => startHomePreset(cup, m) })),
        { icon: '⚙️', title: 'Настроить подробно', text: 'Формат, участники, число матчей', minor: true,
          run: () => { applyHomePreset(cup, 'simulator'); showScreen('setup'); } }
    ]);
}

function openModeSheet(gameMode) {
    const list = HOME_CUPS.filter(c => gameMode !== 'career' || !c.nations);
    openHomeSheet(gameMode === 'career' ? '👔 Где начнём карьеру?' : '👥 Во что играем вдвоём?',
        list.map(c => ({ icon: c.icon, title: c.title, text: homeCupInfo(c).sub, run: () => startHomePreset(c, gameMode) })));
}

function goHome() {
    renderHome();
    showScreen('home');
}

function initHome() {
    $('home-cups').addEventListener('click', e => {
        const t = e.target.closest('[data-cup]');
        if (t) openCupSheet(HOME_CUPS.find(c => c.id === t.dataset.cup));
    });
    $('home-modes').addEventListener('click', e => {
        const t = e.target.closest('[data-mode]');
        if (!t) return;
        const m = t.dataset.mode;
        if (m === 'career' || m === 'duo') openModeSheet(m);
        else if (m === 'custom') showScreen('setup');
        else if (m === 'editor') { editor.returnTo = 'home'; openEditor(); }
    });
    $('btn-home-resume').onclick = resumeTournament;
    $('btn-home-discard').onclick = async () => { await discardSave(); renderHome(); };
    $('btn-setup-home').onclick = goHome;
    renderHome();
}

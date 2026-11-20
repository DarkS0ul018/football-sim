// ===== ГЛАВНОЕ МЕНЮ =====
// Плитки турниров (в один клик) и режимов. Подробные настройки — экран «Свой турнир» (setup).

const HOME_CUPS = [
    { id: 'ucl', icon: '★', title: 'Лига чемпионов', cls: 'tile-ucl', type: 'world', ucl: true, euroCup: 'ucl',
      sub: 'Новый формат: 36 клубов в общей таблице, 8 соперников, стыки за 1/8 и плей-офф до финала' },
    { id: 'uel', icon: '🟠', title: 'Лига Европы', cls: 'tile-uel', type: 'mixed', euroCup: 'uel',
      sub: '36 клубов: сильные клубы Европы и 9 лучших клубов РПЛ · общий этап и плей-офф' },
    { id: 'uecl', icon: '🟢', title: 'Лига конференций', cls: 'tile-uecl', type: 'mixed', euroCup: 'uecl',
      sub: '36 клубов: вся РПЛ, лучшие клубы Первой лиги и Европы · общий этап и плей-офф' },
    { id: 'ruscup', icon: '🏆', title: 'Кубок России', cls: 'tile-ruscup', type: 'rusall', rusCup: true,
      sub: '16 клубов РПЛ и 16 клубов Первой лиги · один матч, хозяин — клуб из лиги ниже' },
    { id: 'worldcup', icon: '🌍', title: 'Чемпионат мира', cls: 'tile-wc', type: 'worldcup', nations: true },
    { id: 'euro', icon: '⭐', title: 'Чемпионат Европы', cls: 'tile-euro', type: 'euro', nations: true },
    { id: 'copa', icon: '🌎', title: 'Кубок Америки', cls: 'tile-copa', type: 'copa', nations: true },
    { id: 'clubs', icon: '🏆', title: 'Еврокубок', cls: 'tile-clubs', type: 'world', sub: '32 европейских клуба · группы и плей-офф в два матча',
      settings: { mode: 'groups', count: 32, groupLegs: 2, playoffLegs: 2 } },
    { id: 'clubwc', icon: '🌐', title: 'Клубный чемпионат мира', cls: 'tile-cwc', type: 'clubwc', sub: '32 клуба со всех континентов · Месси, Роналду и Европа',
      settings: { mode: 'groups', count: 32, groupLegs: 1, playoffLegs: 1 } },
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
    if (c.euroCup) return { sub: c.sub, teams: euroCupParticipants(c.euroCup) };
    if (c.rusCup) return { sub: c.sub, teams: getTeamsData('russia').names };
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

    // Продолжить — последнее сохранение; все остальные — в «Моих сохранениях» ниже
    const slots = readSlotIndex();
    const last = slots[0];
    $('home-resume').style.display = last ? '' : 'none';
    if (last) {
        setText('home-resume-title', last.title);
        setText('home-resume-details', last.details);
    }
    const when = t => {
        const d = new Date(t);
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };
    $('home-saves').innerHTML = slots.length > 1 ? `<h2 class="home-section-title">Мои сохранения</h2>
        <div class="home-saves">${slots.map(s => `<div class="hs-save" data-slot="${s.id}">
            <span class="hss-icon">${s.series ? '🔁' : '🏆'}</span>
            <span class="hss-text"><b>${escapeHtml(s.title)}</b><small class="muted">${escapeHtml(s.details || '')} · ${when(s.savedAt)}</small></span>
            <button type="button" class="btn-primary hss-go" data-act="go">▶</button>
            <button type="button" class="btn-secondary hss-del" data-act="del" title="Удалить">🗑️</button>
        </div>`).join('')}</div>` : '';

    // Турниры
    $('home-cups').innerHTML = HOME_CUPS.map(c => {
        const info = homeCupInfo(c);
        return `<button type="button" class="home-tile ${c.cls}" data-cup="${c.id}">
            <span class="ht-icon">${c.icon}</span>
            <span class="ht-title">${c.title}</span>
            <span class="ht-sub">${info.sub}</span>
            <span class="ht-crests">${homeCrestRow(info.teams)}</span>
            ${c.ucl ? '<span class="ucl-stars">✦★✦</span>' : ''}
            <span class="ht-go">→</span>
        </button>`;
    }).join('');

    // Серии
    $('home-series').innerHTML = Object.entries(SERIES_TYPES).map(([id, t]) => `<button type="button" class="home-tile tile-series-${id}" data-series="${id}">
        <span class="ht-icon">${t.icon}</span>
        <span class="ht-title">${t.title}</span>
        <span class="ht-sub">${{ rpl: 'Сезон за сезоном: 15–16 места вылетают, 13–14 играют стыки с Первой лигой', euro: 'Лучшие остаются, остальные проходят отборочные стыки', nations: 'Отбор по континентам → стыки → ЧЕ и ЧМ по очереди' }[id]}</span>
        <span class="ht-go">→</span>
    </button>`).join('');

    // Режимы
    const modes = [
        { id: 'career', icon: '👔', title: 'Карьера', sub: 'Клуб сезон за сезоном или сборная на ЧМ и ЧЕ' },
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
    if (cup.euroCup) { startEuroCup(cup.euroCup, gameMode); return; }
    if (cup.rusCup) { startRussianCup(gameMode); return; }
    applyHomePreset(cup, gameMode);
    onStartClick();
}

function openCupSheet(cup) {
    const modes = ['simulator', 'career', 'duo'];
    openHomeSheet(`${cup.icon} ${cup.title}`, [
        ...modes.map(m => ({ ...HOME_MODES[m], ...(cup.nations && m === 'career' ? { title: 'Играть за сборную', text: 'Выберите сборную: состав, тактика, решения по ходу матча' } : {}), run: () => startHomePreset(cup, m) })),
        ...(cup.euroCup || cup.rusCup ? [] : [{ icon: '⚙️', title: 'Настроить подробно', text: 'Формат, участники, число матчей', minor: true,
          run: () => { applyHomePreset(cup, 'simulator'); showScreen('setup'); } }])
    ]);
}

function openModeSheet(gameMode) {
    const list = HOME_CUPS;
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
    $('home-series').addEventListener('click', e => {
        const t = e.target.closest('[data-series]');
        if (t) openSeriesStart(t.dataset.series);
    });
    $('home-modes').addEventListener('click', e => {
        const t = e.target.closest('[data-mode]');
        if (!t) return;
        const m = t.dataset.mode;
        if (m === 'career' || m === 'duo') openModeSheet(m);
        else if (m === 'custom') showScreen('setup');
        else if (m === 'editor') { editor.returnTo = 'home'; openEditor(); }
    });
    $('btn-home-resume').onclick = () => resumeTournament();
    $('home-saves').addEventListener('click', async e => {
        const b = e.target.closest('[data-act]'), row = e.target.closest('[data-slot]');
        if (!b || !row) return;
        if (b.dataset.act === 'go') resumeTournament(row.dataset.slot);
        else if (await discardSave(row.dataset.slot)) renderHome();
    });
    $('btn-home-discard').onclick = async () => { if (await discardSave()) renderHome(); };
    $('btn-setup-home').onclick = goHome;
    renderHome();
}

function teamEmojiOf(name) {
    let i = worldTeams.names.indexOf(name);
    if (i !== -1) return worldTeams.emojis[i];
    i = russianTeams.names.indexOf(name);
    return i !== -1 ? russianTeams.emojis[i] : '⚽';
}

function poolOf(names) {
    return names.map(name => ({ name, emoji: teamEmojiOf(name), rating: teamRatings[name] ?? 75 }));
}

// Еврокубки в формате Лиги чемпионов: формат задан — без экрана настроек
function startEuroCup(id, gameMode) {
    const names = euroCupParticipants(id);
    const settings = { count: UCL_TEAMS, mode: 'ucl', teamType: id === 'ucl' ? 'world' : 'mixed', gameMode, simMode: 'realistic',
        groupLegs: 1, playoffLegs: 2, playoffSize: 8, teamPick: 'random', euroCup: id, title: EURO_CUPS[id].title };
    startNewSlot();
    proceedWithPool(settings, poolOf(names));
}

// Кубок России: 16 клубов РПЛ + 16 сильнейших клубов Первой лиги, один матч, хозяин — клуб из лиги ниже
function startRussianCup(gameMode) {
    const fnl = [...getTeamsData('fnl').names].sort((a, b) => (teamRatings[b] ?? 60) - (teamRatings[a] ?? 60)).slice(0, 16);
    const settings = { count: 32, mode: 'knockout', teamType: 'rusall', gameMode, simMode: 'realistic',
        groupLegs: 1, playoffLegs: 1, playoffSize: 8, teamPick: 'random', lowerHosts: true, title: '🏆 Кубок России' };
    startNewSlot();
    proceedWithPool(settings, poolOf([...getTeamsData('russia').names, ...fnl]));
}

// ===== ЭКРАН СЕРИИ =====
// Старт серии с главной, экран «что дальше», карточка итогов этапа на экране результатов.

function seriesTeamEmoji(name) {
    let i = worldTeams.names.indexOf(name);
    if (i !== -1) return worldTeams.emojis[i];
    i = russianTeams.names.indexOf(name);
    return i !== -1 ? russianTeams.emojis[i] : '';
}

// ----- Старт с главной -----
function openSeriesStart(type) {
    const t = SERIES_TYPES[type];
    const text = {
        rpl: '16 клубов РПЛ и 18 клубов Первой лиги. Вылет, подъём и стыки каждый сезон.',
        euro: '24 лучших клуба остаются, 8 мест — через отборочные стыки.',
        nations: 'Отбор по континентам → стыки → ЧЕ или ЧМ. Каждые два года — новый турнир.'
    }[type];
    openHomeSheet(`${t.icon} ${t.title}`, [
        { icon: '📺', title: 'Смотреть серию', text, run: () => beginSeries(type, 'simulator', null) },
        { icon: type === 'nations' ? '🎽' : '👔', title: type === 'nations' ? 'Играть за сборную' : 'Играть за клуб',
          text: 'Вы ведёте свою команду через все этапы', run: () => pickSeriesTeam(type) }
    ]);
}

function seriesTeamPool(type) {
    if (type === 'rpl') return [...getTeamsData('russia').names, ...getTeamsData('fnl').names];
    if (type === 'euro') return getTeamsData('world').names;
    return Object.keys(CONFEDS).flatMap(confedMembers);
}

// Выбор своей команды: список по силе
function pickSeriesTeam(type) {
    const names = byRating(seriesTeamPool(type));
    document.querySelector('.home-sheet-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay home-sheet-overlay';
    el.innerHTML = `<div class="confirm-box home-sheet series-pick" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <h3>Выберите команду</h3>
        <div class="series-pick-list">${names.map(n => `<button type="button" class="series-pick-item" data-name="${escapeHtml(n)}">
            ${crestHtml({ name: n, emoji: seriesTeamEmoji(n) }, 'sm')}<span>${escapeHtml(n)}</span>
            ${type === 'rpl' && FNL_CLUBS.has(n) ? '<small class="muted">Первая лига</small>' : ''}
            ${type === 'nations' ? `<small class="muted">${CONFED_NAMES[confedOf(n)]}</small>` : ''}
            <b>${ratingOf(n)}</b></button>`).join('')}</div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('.pc-close')) { el.remove(); return; }
        const b = e.target.closest('.series-pick-item');
        if (!b) return;
        el.remove();
        beginSeries(type, 'career', b.dataset.name);
    });
}

function beginSeries(type, gameMode, userTeam) {
    const s = createSeries(type, gameMode, userTeam);
    writeSeries(s);
    openSeries();
}

// ----- Экран серии -----
function openSeries() {
    const s = readSeries();
    if (!s) { goHome(); return; }
    const t = SERIES_TYPES[s.type];
    setText('series-kicker', `${t.icon} Серия`);
    setText('series-title', t.title);
    setText('series-subtitle', s.userTeam ? `Ваша команда: ${s.userTeam}` : 'Вы смотрите серию');
    setText('series-next-label', seriesStageLabel(s));
    const st = seriesStage(s);
    setText('series-next-hint', st.user ? `«${st.user}» играет на этом этапе — ваши матчи вживую` :
        (s.userTeam ? `«${s.userTeam}» на этом этапе не играет — матчи досчитаются автоматически` : `${st.names.length} команд`));

    const last = $('series-last');
    if (s.last) {
        last.style.display = '';
        last.innerHTML = `<h3>${escapeHtml(s.last.title)}</h3>${seriesLinesHtml(s.last.lines)}`;
    } else last.style.display = 'none';

    // Таблицы прошлого этапа (РПЛ и Первая лига, группы отбора)
    const tables = [];
    if (s.last && s.last.tables) Object.entries(s.last.tables).forEach(([name, list]) => tables.push(seriesListHtml(name, list, s)));
    $('series-tables').innerHTML = tables.join('');

    // Текущий состав лиг / участники
    const now = [];
    if (s.type === 'rpl') {
        now.push(seriesListHtml('РПЛ сейчас', byRating(s.rpl), s, true));
        now.push(seriesListHtml('Первая лига сейчас', byRating(s.fnl), s, true));
    } else if (s.type === 'euro') {
        now.push(seriesListHtml(s.phase === 'qual' ? 'Уже в турнире' : 'Участники', byRating(s.phase === 'qual' ? s.direct : s.main), s, true));
        if (s.phase === 'qual') now.push(seriesListHtml('Отбор', byRating(s.qual), s, true));
    } else if (s.pending && s.pending.qualified && s.phase === 'final') {
        now.push(seriesListHtml('Участники турнира', byRating(s.pending.qualified), s, true));
    }
    $('series-tables').innerHTML += now.join('');

    $('series-history').innerHTML = s.history.length
        ? s.history.map(h => `<div class="sh-item"><b>${escapeHtml(h.title)}</b>${h.lines.map(l => `<div>${escapeHtml(l)}</div>`).join('')}</div>`).join('')
        : '<div class="muted">Пока пусто — сыграйте первый этап.</div>';
    showScreen('series');
}

function seriesLinesHtml(lines) {
    return `<div class="series-lines">${lines.map(l => `<div><span>${l.icon}</span> ${escapeHtml(l.text)}</div>`).join('')}</div>`;
}

function seriesListHtml(title, list, s, compact = false) {
    return `<div class="card series-table"><h4>${escapeHtml(title)}</h4><ol>${list.map(n => `<li class="${n === s.userTeam ? 'mine' : ''}">
        ${crestHtml({ name: n, emoji: seriesTeamEmoji(n) }, 'sm')} ${escapeHtml(n)}${compact ? ` <small class="muted">${ratingOf(n)}</small>` : ''}</li>`).join('')}</ol></div>`;
}

function startSeriesStage() {
    const s = readSeries();
    if (!s) return;
    currentSlotId = s.id;
    const st = seriesStage(s);
    const pool = st.names.map(n => ({ name: n, emoji: seriesTeamEmoji(n) || '⚽', rating: ratingOf(n) }));
    startTournament(st.settings, pool, st.user);
}

// ----- Итоги этапа на экране результатов -----
function renderSeriesResult() {
    const card = $('series-result-card');
    const head = document.querySelector('#screen-results .champion-box-v2 h2');
    if (head) head.textContent = state.settings.stageOnly ? 'Этап завершён' : (state.settings.ucl ? (EURO_CUPS[state.settings.euroCup || 'ucl'] || EURO_CUPS.ucl).winner : 'Чемпион турнира');
    document.querySelector('#screen-results .champion-box-v2').style.display = state.settings.stageOnly ? 'none' : '';
    if (!state.settings.seriesId) { card.style.display = 'none'; return; }
    let s = readSeries(state.settings.seriesId);
    if (!s) { card.style.display = 'none'; return; }
    currentSlotId = s.id;
    if (!state.seriesProcessed && s.phase === state.settings.seriesPhase) {
        seriesFinishStage(s);
        writeSeries(s);
        state.seriesProcessed = true;
    }
    card.innerHTML = `<div class="hr-label">${SERIES_TYPES[s.type].icon} ${SERIES_TYPES[s.type].title}</div>
        <h3>${escapeHtml(s.last ? s.last.title : '')}</h3>
        ${s.last ? seriesLinesHtml(s.last.lines) : ''}
        <button type="button" class="btn-primary" id="btn-series-continue"><span class="btn-text">▶ Дальше: ${escapeHtml(seriesStageLabel(s))}</span></button>`;
    card.style.display = '';
    $('btn-series-continue').onclick = openSeries;
}

function initSeriesScreen() {
    $('btn-series-home').onclick = goHome;
    $('btn-series-play').onclick = startSeriesStage;
}

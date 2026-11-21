// ===== ДАШБОРД: группы, сетка плей-офф, список матчей =====

function openDashboard() {
    stopHighlights(); // ушли с экрана матча посреди обзора голов
    showScreen('dashboard');
    renderDashboard();
}

function renderDashboard() {
    repairEmptyStage();
    // Кубок (карьера): сыгранный раунд — жеребьёвка следующего; раунды без игрока досчитываются сами
    if (state.cup) catchUpCup();
    newsBetweenRounds();   // лидер, рубежи бомбардиров, настроение
    markNewsSeen();
    // Карьера: если у команды игрока нет матчей в этом этапе — досчитываем остальные автоматически
    if (hasHumans() && !state.matches.some(m => !m.isFinished && isUserMatch(m))) {
        autoSimulateAllRemainingMatches();
    }
    saveGame();

    setText('dashboard-title', getStageTitle());
    const natCup = typeof NATION_CUPS !== 'undefined' ? NATION_CUPS[state.settings.teamType] : null;
    setText('dashboard-kicker', state.settings.seriesTitle ? `🔁 ${state.settings.seriesTitle}` : state.settings.title ? state.settings.title : (natCup ? `${natCup.icon} ${natCup.title}` : 'Турнир'));
    renderUserBadge();

    const isPlayoff = !isRoundRobinStage();
    $('playoff-bracket').style.display = isPlayoff ? 'block' : 'none';
    $('content-area').style.display = isPlayoff ? 'none' : 'block';

    if (isPlayoff) renderBracket();
    else if (state.settings.mode === 'league') renderLeagueTable();
    else renderGroupTables();

    renderNews();
    renderRoundCover();
    renderTopScorers();
    renderMatchesList(isPlayoff);
    renderNextRoundButton();
    renderQuickActions();
}

function renderUserBadge() {
    const badge = $('user-team-badge');
    if (hasHumans() && humanTeams().length) {
        badge.style.display = 'inline-block';
        // Карьера — одна команда; «Вдвоём» — обе, с ярлыками игроков
        badge.innerHTML = humanTeams().map(t => {
            const mi = moraleInfo(teamMorale(t));
            const tag = isDuo() ? `<span class="duo-tag p${humanIndex(t) + 1}">${humanLabel(t)}</span> ` : '';
            return `<span class="ub-team">${tag}${teamLabel(t)}${isEliminated(t) ? ' · выбыла' : ''} <span class="badge-morale" title="Мораль команды: ${mi.label.toLowerCase()}">${mi.icon}</span></span>`;
        }).join(isDuo() ? '<span class="ub-vs">vs</span>' : '');
    } else {
        badge.style.display = 'none';
    }
    renderAbsentees();
}

// Лазарет и дисквалифицированные своей команды (карьера)
function renderAbsentees() {
    let box = $('user-absent');
    if (!box) {
        box = document.createElement('div');
        box.id = 'user-absent';
        box.className = 'user-absent';
        $('user-team-badge').insertAdjacentElement('afterend', box);
    }
    const out = humanTeams().filter(t => getSquad(t)).flatMap(t =>
        getSquadPlayers(t).filter(p => !isAvailable(p)).sort((a, b) => b.rating - a.rating).map(p => ({ p, t })));
    box.style.display = out.length ? 'flex' : 'none';
    box.innerHTML = out.map(({ p, t }) => `<span class="ua-item ${isInjured(p) ? 'inj' : 'susp'}" title="${isDuo() ? t.name + ': ' : ''}${absenceText(p)}">${isInjured(p) ? '🚑' : '🚫'} ${isDuo() ? `<i class="ua-p p${humanIndex(t) + 1}">${humanIndex(t) + 1}</i>` : ''}${p.name}${isInjured(p) ? ` <b>${p.injury.matches}</b>` : ''}</span>`).join('');
}

// ----- Лига -----
// Последние результаты команды: В/Н/П за 5 матчей
function teamFormHtml(team) {
    const form = team.stats && team.stats.form;
    if (form) return form.map(f => {
        const [cls, letter] = { W: ['win', 'В'], D: ['draw', 'Н'], L: ['loss', 'П'] }[f[0]];
        return `<span class="form-pill ${cls}" title="${letter === 'В' ? 'Победа' : letter === 'Н' ? 'Ничья' : 'Поражение'} ${f.slice(1)}">${letter}</span>`;
    }).join('');
    // Старое сохранение без истории формы — по матчам текущего этапа
    const played = state.matches.filter(m => m.isFinished && m.involves(team)).slice(-5);
    return played.map(m => {
        const agg = m.aggregateScore;
        const my = m.team1.id === team.id ? agg.t1 : agg.t2, their = m.team1.id === team.id ? agg.t2 : agg.t1;
        const r = my > their ? ['В', 'win'] : my === their ? ['Н', 'draw'] : ['П', 'loss'];
        return `<span class="form-pill ${r[1]}" title="${m.team1.name} ${agg.t1}:${agg.t2} ${m.team2.name}">${r[0]}</span>`;
    }).join('');
}

// Лига чемпионов: одна таблица на 36 с тремя зонами
function renderUclTable() {
    const table = sortGroup([...state.teams]);
    const zoneCls = { r16: 'ucl-r16', playoff: 'ucl-po', out: 'ucl-out' };
    $('content-area').innerHTML = `
        <div class="group-legend ucl-legend">
            <span><i class="qualify-dot ucl-r16"></i> 1–8: сразу в 1/8 финала</span>
            <span><i class="qualify-dot ucl-po"></i> 9–24: стыковой раунд</span>
            <span><i class="qualify-dot ucl-out"></i> 25–36: выбывают</span>
            <span class="group-legend-note">8 матчей против 8 разных соперников, по два из каждой корзины</span>
        </div>
        <div class="table-container league-table ucl-table">
            <h4>⭐ Общий этап</h4>
            <table>
                <tr><th>#</th><th>Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>Мячи</th><th>РМ</th><th>О</th><th>Форма</th></tr>
                ${table.map((t, i) => `
                    <tr data-team-id="${t.id}" class="${zoneCls[uclZone(i + 1)]}${i === 7 || i === 23 ? ' ucl-cut' : ''}" style="${userRowStyle(t.id)}">
                        <td>${i + 1}</td><td>${teamLabel(t)}</td>
                        <td>${t.stats.played}</td><td>${t.stats.won}</td><td>${t.stats.drawn}</td><td>${t.stats.lost}</td>
                        <td>${t.stats.gf}:${t.stats.ga}</td><td>${t.stats.gf - t.stats.ga > 0 ? '+' : ''}${t.stats.gf - t.stats.ga}</td><td><b>${t.stats.points}</b></td>
                        <td class="form-cell">${teamFormHtml(t)}</td>
                    </tr>`).join('')}
            </table>
        </div>`;
}

function renderLeagueTable() {
    if (isUcl()) { renderUclTable(); return; }
    const table = sortGroup([...state.teams]);
    const withPlayoff = isLeagueWithPlayoff();
    const playoffSize = withPlayoff ? getLeaguePlayoffSize() : 0;
    const note = withPlayoff
        ? `<span><i class="qualify-dot winner"></i> места 1–${playoffSize} выходят в плей-офф (1-й играет с ${playoffSize}-м, 2-й — с ${playoffSize - 1}-м…)</span>`
        : '<span><i class="qualify-dot third"></i> чемпион — первое место</span>';
    $('content-area').innerHTML = `
        <div class="group-legend">${note}<span class="group-legend-note">При равенстве очков: личные встречи → разница мячей → забитые</span></div>
        <div class="table-container league-table">
            <h4>${withPlayoff ? 'Таблица чемпионата' : 'Турнирная таблица'}</h4>
            <table>
                <tr><th>#</th><th>Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>Мячи</th><th>О</th><th>Форма</th></tr>
                ${table.map((t, i) => `
                    <tr data-team-id="${t.id}" class="${withPlayoff ? (i < playoffSize ? 'qualify-winner' : '') : (i === 0 ? 'qualify-third' : '')}" style="${userRowStyle(t.id)}">
                        <td>${i + 1}</td><td>${teamLabel(t)}</td>
                        <td>${t.stats.played}</td><td>${t.stats.won}</td><td>${t.stats.drawn}</td><td>${t.stats.lost}</td>
                        <td>${t.stats.gf}:${t.stats.ga}</td><td><b>${t.stats.points}</b></td>
                        <td class="form-cell">${teamFormHtml(t)}</td>
                    </tr>`).join('')}
            </table>
        </div>`;
}

// ----- Группы -----
const QUALIFY_LABELS = { winner: 'Выход в плей-офф', runner: 'Выход в плей-офф', third: 'Проходит как лучшая третья команда' };

function renderGroupTables() {
    const format = getGroupFormat(state.settings.count);
    const q = getQualification();
    const legend = `<div class="group-legend">
        <span><i class="qualify-dot winner"></i> выходят в плей-офф</span>
        ${format && format.thirds ? `<span><i class="qualify-dot third"></i> лучшие третьи (${format.thirds} из ${format.groups})</span>` : ''}
        <span class="group-legend-note">При равенстве очков: личные встречи → разница мячей → забитые</span>
    </div>`;
    $('content-area').innerHTML = legend + state.groups.map((group, idx) => `
        <div class="table-container">
            <h4>Группа ${String.fromCharCode(65 + idx)}</h4>
            <table>
                <tr><th>Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>О</th><th>РМ</th><th class="col-form">Форма</th></tr>
                ${sortGroup(group).map(t => `
                    <tr data-team-id="${t.id}" class="${q[t.id] ? 'qualify-' + q[t.id] : ''}" style="${userRowStyle(t.id)}" title="${QUALIFY_LABELS[q[t.id]] || ''}">
                        <td>${teamLabel(t)}</td>
                        <td>${t.stats.played}</td><td>${t.stats.won}</td><td>${t.stats.drawn}</td><td>${t.stats.lost}</td>
                        <td><b>${t.stats.points}</b></td><td>${t.stats.gf - t.stats.ga}</td>
                        <td class="form-cell col-form">${teamFormHtml(t)}</td>
                    </tr>`).join('')}
            </table>
        </div>`).join('');
}

// ----- Сетка плей-офф -----
const ROUND_ICONS = { '-1': '⚡', 0: '🏟️', 1: '🔥', 2: '⚔️', 3: '🏆' };

function renderPenaltyKicks(m, side) {
    return m.penalties.kicks.filter(k => k.side === side)
        .map(k => `<span class="penalty-kick ${k.scored ? 'penalty-goal' : 'penalty-miss'}">${k.scored ? '⚽' : '❌'}</span>`).join('');
}

// ----- Сетка плей-офф: две половины сходятся к финалу в центре -----
function bracketMatchEl(m, idx) {
    const agg = m.aggregateScore;
    const el = document.createElement('div');
    el.className = 'bracket-match';
    el.style.setProperty('--i', idx);
    el.dataset.teams = `${m.team1.name}|${m.team2.name}`;
    if (isUserMatch(m)) el.classList.add('user-team');
    if (m.isFinished) el.classList.add('played');
    if (m.isFinal) el.classList.add('final');
    const cls = team => m.winner === team ? 'winner' : (m.isFinished ? 'loser' : '');
    const sub = [];
    if (m.legs === 2 && m.isFinished) sub.push(`${m.leg1.t1}:${m.leg1.t2}, ${m.leg2.t1}:${m.leg2.t2}`);
    if (m.extraTime) sub.push('д.в.');
    if (m.penalties.kicks.length) sub.push(`пен. ${m.penalties.t1}:${m.penalties.t2}`);
    if (m.isAutoSimulated) sub.push('🤖');
    el.innerHTML = `
        <div class="bracket-team ${cls(m.team1)}"><span class="bt-name">${teamLabel(m.team1)}</span><span class="bracket-score">${m.isFinished ? agg.t1 : '–'}</span></div>
        <div class="bracket-team ${cls(m.team2)}"><span class="bt-name">${teamLabel(m.team2)}</span><span class="bracket-score">${m.isFinished ? agg.t2 : '–'}</span></div>
        ${sub.length ? `<div class="bm-sub">${sub.join(' · ')}</div>` : ''}`;
    if (m.isFinished) { el.dataset.report = reportIndex(m); el.classList.add('clickable'); el.title = 'Протокол матча'; }
    else if (!hasHumans() || isUserMatch(m)) { el.onclick = () => openMatch(m); el.title = 'Сыграть матч'; el.classList.add('playable'); }
    return el;
}

// Будущий матч: известные участники или «победитель пары»
function bracketPlaceholderEl(a, b, idx) {
    const el = document.createElement('div');
    el.className = 'bracket-match placeholder';
    el.style.setProperty('--i', idx);
    const row = t => `<div class="bracket-team">${t ? `<span class="bt-name">${teamLabel(t)}</span>` : '<span class="bt-name muted">победитель пары</span>'}<span class="bracket-score">–</span></div>`;
    el.innerHTML = row(a) + row(b);
    if (a && b) el.dataset.teams = `${a.name}|${b.name}`;
    return el;
}

function renderBracket() {
    const bracketDiv = $('playoff-bracket');
    const container = $('bracket-container');
    const history = state.tournamentHistory;
    bracketDiv.querySelector('.tournament-progress')?.remove();
    bracketDiv.insertAdjacentHTML('afterbegin', `<div class="tournament-progress">${history.map((r, i) =>
        `<div class="progress-step active ${i < history.length - 1 ? 'completed' : ''}">${r.round}</div>`).join('')}</div>`);

    container.innerHTML = '';
    bracketDiv.querySelector('.bracket-auto')?.remove();
    bracketDiv.querySelector('.bracket-pre')?.remove();
    const pending = state.matches.filter(m => !m.isFinished && (!hasHumans() || !isUserMatch(m)));
    if (pending.length && !hasHumans()) {
        const cur = history[history.length - 1];
        const auto = document.createElement('button');
        auto.className = 'btn-secondary bracket-auto';
        auto.innerHTML = `🤖 Сыграть «${cur ? cur.round : 'раунд'}» автоматически <small class="muted">(${pending.length})</small>`;
        auto.onclick = () => { autoSimulateAllRemainingMatches(); renderDashboard(); };
        container.parentElement.insertBefore(auto, container);
    }

    // Дерево — с того раунда, после которого каждый следующий вдвое меньше (стыковой раунд ЛЧ — отдельно)
    // Стыки серии и стыковой раунд ЛЧ (пока не сыгран) — просто список пар, без дерева
    let start = state.settings.stageOnly || state.uclPhase === 'playoff' ? history.length : 0;
    for (let i = history.length - 2; i >= 0; i--) {
        if (history[i].matches.length !== history[i + 1].matches.length * 2) { start = i + 1; break; }
    }
    const pre = history.slice(0, start);
    if (pre.length) {
        const box = document.createElement('div');
        box.className = 'bracket-pre';
        pre.forEach(r => {
            box.insertAdjacentHTML('beforeend', `<div class="bracket-round-title">${ROUND_ICONS[r.roundIndex] || '⚡'} ${r.round}</div>`);
            const list = document.createElement('div');
            list.className = 'bracket-pre-list';
            r.matches.forEach((m, i) => list.appendChild(bracketMatchEl(m, i)));
            box.appendChild(list);
        });
        container.parentElement.insertBefore(box, container);
    }

    // Раунды дерева + будущие (участники — победители соседних пар)
    const tree = history.slice(start).map(r => ({ title: r.round, idx: r.roundIndex, items: r.matches.map(m => ({ m })) }));
    if (!tree.length) { container.className = 'bracket'; return; }
    while (tree[tree.length - 1].items.length > 1) {
        const prev = tree[tree.length - 1].items;
        const items = [];
        for (let i = 0; i + 1 < prev.length; i += 2) {
            const w = x => (x.m && x.m.isFinished ? x.m.winner : null);
            items.push({ a: w(prev[i]), b: w(prev[i + 1]) });
        }
        const n = items.length * 2;
        tree.push({ title: getRoundName(n), idx: getRoundIndex(n), items, future: true });
    }

    let k = 0;
    const make = item => item.m ? bracketMatchEl(item.m, k++) : bracketPlaceholderEl(item.a, item.b, k++);
    const column = (round, items, sideCls) => {
        const col = document.createElement('div');
        col.className = `bk-col ${sideCls}${round.future ? ' future' : ''}`;
        col.innerHTML = `<div class="bracket-round-title">${ROUND_ICONS[round.idx] || '🎮'} ${round.title}</div>`;
        const body = document.createElement('div');
        body.className = 'bk-body';
        for (let i = 0; i < items.length; i += (items.length > 1 ? 2 : 1)) {
            const g = document.createElement('div');
            g.className = `bk-group ${items.length > 1 ? 'two' : 'one'}`;
            items.slice(i, i + (items.length > 1 ? 2 : 1)).forEach(it => g.appendChild(make(it)));
            body.appendChild(g);
        }
        col.appendChild(body);
        return col;
    };
    const final = tree[tree.length - 1];
    const sides = tree.slice(0, -1);
    container.className = 'bracket bk-tree';
    sides.forEach(r => container.appendChild(column(r, r.items.slice(0, r.items.length / 2), 'left')));
    const fc = column(final, final.items, 'center');
    fc.querySelector('.bracket-round-title').innerHTML = '🏆 Финал';
    container.appendChild(fc);
    [...sides].reverse().forEach(r => container.appendChild(column(r, r.items.slice(r.items.length / 2), 'right')));
    decorateBracket();
}

// ----- Список матчей (группы и лига): прошлый и текущий тур -----
function matchResultHtml(m) {
    const agg = m.aggregateScore;
    return `<div class="match-result clickable"${reportAttr(m)}>
        <b>${teamLabel(m.team1)}</b> ${agg.t1}:${agg.t2} <b>${teamLabel(m.team2)}</b>${m.isAutoSimulated ? ' 🤖' : ''}
        <br><small>${m.roundName}</small>
        ${scorersMiniHtml(m)}
    </div>`;
}

function renderMatchesList(isPlayoff) {
    const list = $('matches-list');
    list.innerHTML = '';
    if (isPlayoff) return;

    // Кубковый матч «созрел» — сначала он, тур лиги ждёт
    const cupMatch = state.cup ? userCupMatch() : null;
    if (cupMatch) {
        list.insertAdjacentHTML('beforeend', cupPanelHtml());
        list.appendChild(cupMatchButton(cupMatch));
    }

    const current = getCurrentMatchday();
    const finished = state.matches.filter(m => m.isFinished);
    const lastPlayed = finished.length ? Math.max(...finished.map(m => m.matchday || 0)) : null;

    // Результаты последнего сыгранного тура
    if (lastPlayed) {
        const shown = finished.filter(m => m.matchday === lastPlayed);
        list.insertAdjacentHTML('beforeend', `<h3>Результаты · тур ${lastPlayed}</h3>` + shown.map(matchResultHtml).join(''));
    }
    if (!current) { if (state.cup && !cupMatch) list.insertAdjacentHTML('beforeend', cupPanelHtml()); return; }
    if (cupMatch) {
        list.insertAdjacentHTML('beforeend', `<div class="muted" style="margin:6px 0 12px">Тур ${current} лиги — после кубкового матча.</div>`);
        return;
    }

    // Матчи текущего тура
    const upcoming = state.matches.filter(m => !m.isFinished && m.matchday === current);
    list.insertAdjacentHTML('beforeend', `<h4>Тур ${current}${getTotalMatchdays() ? ' из ' + getTotalMatchdays() : ''}:</h4>`);
    upcoming.filter(m => !hasHumans() || isUserMatch(m)).forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'btn-secondary';
        btn.style.marginBottom = '10px';
        const tags = isDuo() ? humanTeams().filter(t => m.involves(t)).map(t => ` <span class="duo-tag p${humanIndex(t) + 1}">${humanLabel(t)}</span>`).join('') : (isUserMatch(m) ? ' ⚽ ВАШ МАТЧ' : '');
        btn.innerHTML = `⚽ ${teamLabel(m.team1)} vs ${teamLabel(m.team2)} <small>(${m.roundName})</small>${tags}`;
        btn.onclick = () => openMatch(m);
        list.appendChild(btn);
    });
    if (hasHumans()) {
        const others = upcoming.filter(m => !isUserMatch(m));
        if (others.length) list.insertAdjacentHTML('beforeend', `<div class="muted" style="margin:6px 0 12px">Остальные матчи тура (${others.length}) сыграются после вашего.</div>`);
    } else {
        // Симулятор: можно досчитать тур целиком
        const auto = document.createElement('button');
        auto.className = 'btn-secondary';
        auto.style.marginBottom = '10px';
        auto.innerHTML = `🤖 Сыграть тур ${current} автоматически`;
        auto.onclick = () => { autoSimulateAllRemainingMatches(m => m.matchday === current); renderDashboard(); };
        list.appendChild(auto);
    }
    if (state.cup) list.insertAdjacentHTML('beforeend', cupPanelHtml());
}

// ----- Кнопка следующего этапа -----
function renderNextRoundButton() {
    const btn = $('btn-next-round');
    if (!isStageComplete() || (state.cup && userCupMatch())) { btn.style.display = 'none'; return; }
    btn.style.display = 'block';
    const toPlayoff = (state.settings.mode === 'league' && isLeagueWithPlayoff()) || state.settings.mode === 'groups';
    const isLast = !!state.settings.stageOnly || (!toPlayoff && (state.settings.mode === 'league' || state.matches.length === 1));
    btn.innerHTML = isLast ? '<span>🏆 Результаты</span>' : (toPlayoff ? '<span>К плей-офф →</span>' : '<span>Следующий раунд →</span>');
    btn.onclick = goToNextStage;
}

function goToNextStage() {
    // Повторное нажатие (или кнопка с экрана матча, когда этап уже сменился) не должно двигать турнир дальше:
    // иначе из недоигранного раунда создавался пустой и турнир «зависал»
    if (!isStageComplete()) { openDashboard(); return; }
    const champion = advanceStage();
    if (champion) showResults(champion);
    else openDashboard(); // с экрана матча — сразу в сетку нового этапа
}

// ----- Выход в меню: турнир сохраняется, на стартовом экране — «Продолжить / Удалить / Начать новый» -----
function goToMenu() {
    stopHighlights();
    saveGame();
    renderResumeCard();
    renderHall();
    goHome();
}
$('btn-to-menu').onclick = goToMenu;
document.querySelector('.topbar .brand')?.addEventListener('click', () => {
    // Логотип — тоже в меню (кроме живого матча: там сначала нужно доиграть)
    if (screens.match.classList.contains('active') && simStep) return;
    goToMenu();
});

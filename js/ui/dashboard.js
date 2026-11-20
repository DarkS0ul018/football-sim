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
    setText('dashboard-kicker', state.settings.seriesTitle ? `🔁 ${state.settings.seriesTitle}` : (natCup ? `${natCup.icon} ${natCup.title}` : 'Турнир'));
    renderUserBadge();

    const isPlayoff = !isRoundRobinStage();
    $('playoff-bracket').style.display = isPlayoff ? 'block' : 'none';
    $('content-area').style.display = isPlayoff ? 'none' : 'block';

    if (isPlayoff) renderBracket();
    else if (state.settings.mode === 'league') renderLeagueTable();
    else renderGroupTables();

    renderNews();
    renderTopScorers();
    renderMatchesList(isPlayoff);
    renderNextRoundButton();
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

function renderLeagueTable() {
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
                    <tr class="${withPlayoff ? (i < playoffSize ? 'qualify-winner' : '') : (i === 0 ? 'qualify-third' : '')}" style="${userRowStyle(t.id)}">
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
                    <tr class="${q[t.id] ? 'qualify-' + q[t.id] : ''}" style="${userRowStyle(t.id)}" title="${QUALIFY_LABELS[q[t.id]] || ''}">
                        <td>${teamLabel(t)}</td>
                        <td>${t.stats.played}</td><td>${t.stats.won}</td><td>${t.stats.drawn}</td><td>${t.stats.lost}</td>
                        <td><b>${t.stats.points}</b></td><td>${t.stats.gf - t.stats.ga}</td>
                        <td class="form-cell col-form">${teamFormHtml(t)}</td>
                    </tr>`).join('')}
            </table>
        </div>`).join('');
}

// ----- Сетка плей-офф -----
const ROUND_ICONS = { 0: '🏟️', 1: '🔥', 2: '⚔️', 3: '🏆' };

function renderPenaltyKicks(m, side) {
    return m.penalties.kicks.filter(k => k.side === side)
        .map(k => `<span class="penalty-kick ${k.scored ? 'penalty-goal' : 'penalty-miss'}">${k.scored ? '⚽' : '❌'}</span>`).join('');
}

function renderBracket() {
    const bracketDiv = $('playoff-bracket');
    const container = $('bracket-container');

    bracketDiv.querySelector('.tournament-progress')?.remove();
    const rounds = state.tournamentHistory;
    bracketDiv.insertAdjacentHTML('afterbegin', `<div class="tournament-progress">${rounds.map((r, i) =>
        `<div class="progress-step active ${i < rounds.length - 1 ? 'completed' : ''}">${r.round}</div>`).join('')}</div>`);

    container.innerHTML = '';
    rounds.forEach(round => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'bracket-round';
        roundDiv.innerHTML = `<div class="bracket-round-title">${ROUND_ICONS[round.roundIndex] || '🎮'} ${round.round}</div>`;

        round.matches.forEach(m => {
            const agg = m.aggregateScore;
            const el = document.createElement('div');
            el.className = 'bracket-match';
            if (isUserMatch(m)) el.classList.add('user-team');
            if (m.isFinished) el.classList.add('played');
            if (m.isFinal) el.classList.add('final');

            const cls = team => m.winner === team ? 'winner' : (m.isFinished ? 'loser' : '');
            const pens = m.penalties.kicks.length ? `
                <div class="penalty-details">
                    <div style="margin-bottom:8px;font-size:12px;font-weight:bold;color:#e94560">⚽ Пенальти ${m.penalties.t1}:${m.penalties.t2}</div>
                    <div style="font-size:11px;color:#888">${m.team1.name}: ${renderPenaltyKicks(m, 'team1')}</div>
                    <div style="font-size:11px;color:#888">${m.team2.name}: ${renderPenaltyKicks(m, 'team2')}</div>
                </div>` : '';
            const legs = m.legs === 2 && m.isFinished
                ? `<div class="bracket-match-info"><div>1-й: ${m.leg1.t1}:${m.leg1.t2}</div><div>2-й: ${m.leg2.t1}:${m.leg2.t2}</div><div style="margin-top:5px;font-weight:bold;color:var(--gold)">Итого: ${agg.t1}:${agg.t2}</div></div>`
                : (m.isFinal ? '<div class="bracket-match-info final-label">🏆 ГЛАВНЫЙ МАТЧ</div>' : '');
            const auto = (m.extraTime ? '<span style="font-size:10px;color:var(--gold);margin-right:6px">⏱️ д.в.</span>' : '')
                + (m.isAutoSimulated ? '<span style="font-size:10px;color:#888">🤖 Авто</span>' : '');

            el.innerHTML = `
                <div class="bracket-team ${cls(m.team1)}"><span style="flex:1">${teamLabel(m.team1)}</span><span class="bracket-score">${m.isFinished ? agg.t1 : '-'}</span></div>
                <div class="bracket-team ${cls(m.team2)}"><span style="flex:1">${teamLabel(m.team2)}</span><span class="bracket-score">${m.isFinished ? agg.t2 : '-'}</span></div>
                ${legs}${pens}${auto}${scorersMiniHtml(m)}`;
            if (m.isFinished) { el.dataset.report = reportIndex(m); el.classList.add('clickable'); el.title = 'Протокол матча'; }

            if (!m.isFinished && (!hasHumans() || isUserMatch(m))) el.onclick = () => openMatch(m);
            roundDiv.appendChild(el);
        });
        container.appendChild(roundDiv);
    });
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

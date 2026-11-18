// ===== ДАШБОРД: группы, сетка плей-офф, список матчей =====

function openDashboard() {
    showScreen('dashboard');
    renderDashboard();
}

function renderDashboard() {
    // Карьера: если у команды игрока нет матчей в этом этапе — досчитываем остальные автоматически
    if (isCareer() && !state.matches.some(m => !m.isFinished && isUserMatch(m))) {
        autoSimulateAllRemainingMatches();
    }
    saveGame();

    setText('dashboard-title', getStageTitle());
    renderUserBadge();

    const isPlayoff = state.settings.mode !== 'groups';
    $('playoff-bracket').style.display = isPlayoff ? 'block' : 'none';
    $('content-area').style.display = isPlayoff ? 'none' : 'block';

    if (isPlayoff) renderBracket();
    else renderGroupTables();

    renderTopScorers();
    renderMatchesList(isPlayoff);
    renderNextRoundButton();
}

function renderUserBadge() {
    const badge = $('user-team-badge');
    if (isCareer() && state.userTeam) {
        badge.style.display = 'inline-block';
        badge.innerText = `${teamLabel(state.userTeam)}${state.userTeamEliminated ? ' · выбыла' : ''}`;
    } else {
        badge.style.display = 'none';
    }
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
                <tr><th>Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>О</th><th>РМ</th></tr>
                ${sortGroup(group).map(t => `
                    <tr class="${q[t.id] ? 'qualify-' + q[t.id] : ''}" style="${userRowStyle(t.id)}" title="${QUALIFY_LABELS[q[t.id]] || ''}">
                        <td>${teamLabel(t)}</td>
                        <td>${t.stats.played}</td><td>${t.stats.won}</td><td>${t.stats.drawn}</td><td>${t.stats.lost}</td>
                        <td><b>${t.stats.points}</b></td><td>${t.stats.gf - t.stats.ga}</td>
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
                ${legs}${pens}${auto}`;

            if (!m.isFinished && (!isCareer() || isUserMatch(m))) el.onclick = () => openMatchScreen(m);
            roundDiv.appendChild(el);
        });
        container.appendChild(roundDiv);
    });
}

// ----- Список матчей (групповой этап) -----
function renderMatchesList(isPlayoff) {
    const list = $('matches-list');
    list.innerHTML = '';
    if (isPlayoff) return;

    list.innerHTML = '<h3>Матчи:</h3>' + state.matches.filter(m => m.isFinished).map(m => {
        const agg = m.aggregateScore;
        const isDraw = agg.t1 === agg.t2;
        return `<div class="match-result">
            <b>${teamLabel(m.team1)}</b> ${agg.t1}:${agg.t2} <b>${teamLabel(m.team2)}</b>${m.isAutoSimulated ? ' 🤖' : ''}
            <br><small>${m.roundName} · ${isDraw ? 'Ничья' : 'Победитель: ' + m.winner.name}</small>
        </div>`;
    }).join('');

    const upcoming = state.matches.filter(m => !m.isFinished && (!isCareer() || isUserMatch(m)));
    if (!upcoming.length) return;
    list.insertAdjacentHTML('beforeend', '<h4>Предстоящие:</h4>');
    upcoming.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'btn-secondary';
        btn.style.marginBottom = '10px';
        btn.innerHTML = `⚽ ${teamLabel(m.team1)} vs ${teamLabel(m.team2)} <small>(${m.roundName})</small>${isUserMatch(m) ? ' ⚽ ВАШ МАТЧ' : ''}`;
        btn.onclick = () => openMatchScreen(m);
        list.appendChild(btn);
    });
}

// ----- Кнопка следующего этапа -----
function renderNextRoundButton() {
    const btn = $('btn-next-round');
    if (!isStageComplete()) { btn.style.display = 'none'; return; }
    btn.style.display = 'block';
    const isLast = state.settings.mode !== 'groups' && state.matches.length === 1;
    btn.innerHTML = isLast ? '<span>🏆 Результаты</span>' : '<span>➡️ Следующий раунд</span>';
    btn.onclick = goToNextStage;
}

function goToNextStage() {
    const champion = advanceStage();
    if (champion) showResults(champion);
    else renderDashboard();
}

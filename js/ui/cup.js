// ===== КУБОК НА ГЛАВНОМ ЭКРАНЕ (карьера) =====

const CUP_STEP_LABEL = { 'Предварительный раунд': 'Предв.', 'Финал': 'Финал', 'Полуфинал': '1/2' };

function cupScoreLine(m) {
    const agg = m.aggregateScore;
    const pens = m.penalties.kicks.length ? ` <small>(пен. ${m.penalties.t1}:${m.penalties.t2})</small>` : '';
    const et = m.extraTime && !m.penalties.kicks.length ? ' <small>д.в.</small>' : '';
    const cls = t => m.isFinished ? (m.winner === t ? 'cw' : 'cl') : '';
    return `<div class="cup-line ${isUserMatch(m) ? 'user' : ''}">
        <span class="${cls(m.team1)}">${teamLabel(m.team1)}</span>
        <b>${m.isFinished ? `${agg.t1}:${agg.t2}` : '–'}</b>
        <span class="${cls(m.team2)}">${teamLabel(m.team2)}</span>${pens}${et}
    </div>`;
}

// Панель кубка: путь по раундам, статус команды, текущий/следующий раунд, бомбардиры
function cupPanelHtml() {
    const c = state.cup;
    if (!c) return '';
    const user = state.userTeam;
    const res = userCupResult();
    const current = currentCupRound();
    const due = cupDueRound();

    // Шаги: сыгранные + текущий + ещё не разыгранные
    const names = c.rounds.map(r => r.name);
    let next = c.rounds[c.rounds.length - 1].matches.length + c.byes.length; // участников следующего раунда
    while (!c.winner && next >= 2) { names.push(getRoundName(next)); next /= 2; }
    const reached = new Set(c.rounds.filter(r => r.matches.some(m => m.involves(user))).map(r => r.name));
    const steps = names.map((n, i) => {
        const done = i < c.rounds.length && c.rounds[i].matches.every(m => m.isFinished);
        const now = current && n === current.name;
        return `<span class="cup-step ${done ? 'done' : ''} ${now ? 'now' : ''} ${reached.has(n) ? 'mine' : ''}">${CUP_STEP_LABEL[n] || n.replace(' финала', '')}</span>`;
    }).join('<i class="cup-arrow">›</i>');

    let status;
    if (c.winner) status = c.winner.id === user.id ? '🏆 Кубок ваш!' : `Обладатель: ${teamLabel(c.winner)}`;
    else if (c.userOut) status = res ? res.text.replace('Кубок: в', 'В') : 'Выбыли';
    else if (c.byes.includes(user.id)) status = 'Ждёт соперника в следующем раунде';
    else status = `В борьбе: ${current.name}`;

    let body = '';
    const myMatch = due && due.matches.find(m => m.involves(user) && !m.isFinished);
    if (myMatch) body += `<div class="cup-due">Сейчас — кубковый матч. Тур лиги подождёт.</div>`;
    else if (current && !c.winner) body += `<div class="muted cup-next">${current.name}${state.settings.mode === 'league' ? ` — после ${current.after}-го тура лиги` : ''}</div>`;

    // Последний сыгранный раунд
    const lastDone = [...c.rounds].reverse().find(r => r.matches.every(m => m.isFinished));
    if (lastDone) body += `<div class="cup-sub">${lastDone.name}</div>` + lastDone.matches
        .slice().sort((a, b) => isUserMatch(b) - isUserMatch(a)).slice(0, 4).map(cupScoreLine).join('')
        + (lastDone.matches.length > 4 ? `<div class="muted cup-more">и ещё ${lastDone.matches.length - 4}</div>` : '');

    const top = Object.values(c.scorers).filter(s => s.goals).sort((a, b) => b.goals - a.goals).slice(0, 3);
    if (top.length) body += `<div class="cup-sub">Бомбардиры кубка</div><div class="cup-scorers">${top.map(s => {
        const t = getTeamById(s.teamId);
        return `<span>${s.name}${t ? ' · ' + t.name : ''} <b>${s.goals}</b></span>`;
    }).join('')}</div>`;

    return `<div class="cup-panel ${c.winner && c.winner.id === user.id ? 'won' : ''}">
        <div class="cup-head"><span class="cup-title">🏆 ${CUP_NAME}</span><span class="cup-status">${status}</span></div>
        <div class="cup-steps">${steps}</div>
        ${body}
    </div>`;
}

// Кнопка кубкового матча игрока
function cupMatchButton(m) {
    const btn = document.createElement('button');
    btn.className = 'btn-primary cup-btn';
    btn.style.marginBottom = '10px';
    btn.innerHTML = `🏆 ${teamLabel(m.team1)} vs ${teamLabel(m.team2)} <small>(${m.roundName})</small>`;
    btn.onclick = () => openMatch(m);
    return btn;
}

// Итог кубкового матча игрока — строка в ленте
function cupMatchOutcome(m, winner) {
    const user = state.userTeam;
    if (!user || !m.involves(user)) return;
    if (winner && winner.id === user.id) {
        if (m.isFinal) {
            addMatchEvent(m, '', 'finish', `🏆 ${user.name} — обладатель кубка!`, null);
            const sb = document.querySelector('.scoreboard-v2');
            if (sb) { const r = sb.getBoundingClientRect(); [0, 400, 800].forEach(d => setTimeout(() => createConfetti(r.left + r.width * (0.3 + Math.random() * 0.4), r.top), d)); }
        } else {
            const next = currentCupRound();
            addMatchEvent(m, '', 'finish', `✅ ${user.name} проходит дальше${next ? ': ' + next.name : ''}`, null);
        }
    } else {
        addMatchEvent(m, '', 'finish', `😔 ${user.name} выбывает из кубка`, null);
    }
}

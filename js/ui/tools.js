// ===== ИНСТРУМЕНТЫ ТУРНИРА: быстрые кнопки, календарь, страница команды, нижнее меню на телефоне =====

// ----- Быстрые кнопки над таблицей -----
function nextUserMatch() {
    if (!hasHumans()) return null;
    return (state.cup ? userCupMatch() : null) || state.matches.find(m => !m.isFinished && isUserMatch(m)) || null;
}

function renderQuickActions() {
    const box = $('quick-actions');
    if (!box) return;
    const btn = (id, icon, text, title = '') => `<button type="button" class="qa-btn" data-qa="${id}" title="${escapeHtml(title)}">${icon} <span>${text}</span></button>`;
    const out = [];
    const next = nextUserMatch();
    if (next) out.push(btn('mine', '▶', 'Мой матч', `${next.team1.name} — ${next.team2.name} · ${next.roundName}`));
    if (!hasHumans()) {
        if (isRoundRobinStage() && getCurrentMatchday()) out.push(btn('round', '⏩', 'Досчитать тур'));
        if (state.matches.some(m => !m.isFinished)) out.push(btn('stage', '⏭️', 'Досчитать этап'));
    }
    if (!state.champion) out.push(btn('all', '🏁', 'Досчитать турнир', 'Все оставшиеся матчи — сразу, до итогов'));
    out.push(btn('calendar', '📅', 'Календарь'));
    box.innerHTML = out.join('');
}

async function onQuickAction(id) {
    if (id === 'mine') { const m = nextUserMatch(); if (m) (m.cup ? openMatch(m) : openMatch(m)); return; }
    if (id === 'calendar') { openCalendar(); return; }
    if (id === 'round') { const md = getCurrentMatchday(); autoSimulateAllRemainingMatches(m => m.matchday === md); renderDashboard(); return; }
    if (id === 'stage') { autoSimulateAllRemainingMatches(); renderDashboard(); return; }
    if (id === 'all') {
        const mine = hasHumans() && !state.userTeamEliminated;
        const ok = await askConfirm(mine ? 'Досчитать весь турнир? Ваши матчи тоже сыграются автоматически.' : 'Досчитать все оставшиеся матчи до итогов турнира?', { ok: 'Досчитать' });
        if (!ok) return;
        const champion = autoFinishTournament();
        if (champion) showResults(champion);
        else renderDashboard();
    }
}

// ----- Календарь: все матчи турнира по турам и раундам -----
let calendarMine = false;

function calendarSections() {
    const seen = new Set();
    const all = [...(state.groupMatches || []), ...state.matches, ...state.tournamentHistory.flatMap(r => r.matches)].filter(m => !seen.has(m) && seen.add(m));
    const sections = [];
    const bySection = new Map();
    const add = (key, title, m) => {
        if (!bySection.has(key)) { const s = { title, matches: [] }; bySection.set(key, s); sections.push(s); }
        bySection.get(key).matches.push(m);
    };
    const round = m => m.stage === 'playoff' || !m.matchday ? null : m.matchday;
    all.filter(m => round(m)).sort((a, b) => a.matchday - b.matchday).forEach(m => add('md' + m.matchday, state.settings.ucl ? `Общий этап · тур ${m.matchday}` : `Тур ${m.matchday}`, m));
    state.tournamentHistory.forEach(r => r.matches.forEach(m => add('r' + r.round, r.round, m)));
    if (state.cup) state.cup.rounds.forEach(r => r.matches.forEach(m => add('cup' + r.name, `🏆 Кубок · ${r.name}`, m)));
    return sections;
}

function calendarRow(m) {
    const a = m.aggregateScore;
    const mine = isUserMatch(m);
    const playable = !m.isFinished && (!hasHumans() || mine);
    const score = m.isFinished ? `${a.t1}:${a.t2}${m.penalties && m.penalties.kicks && m.penalties.kicks.length ? '<small> пен.</small>' : ''}` : '— : —';
    return `<div class="cal-row ${mine ? 'mine' : ''} ${m.isFinished ? 'done' : ''} ${playable ? 'playable' : ''}" data-cal="${state.matches.includes(m) ? 'cur' : 'old'}">
        <span class="cal-team">${teamLabel(m.team1)}</span>
        <b class="cal-score">${score}</b>
        <span class="cal-team right">${teamLabel(m.team2)}</span>
    </div>`;
}

function openCalendar() {
    document.querySelector('.calendar-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay calendar-overlay';
    const render = () => {
        const sections = calendarSections().map(s => ({ ...s, matches: calendarMine ? s.matches.filter(isUserMatch) : s.matches })).filter(s => s.matches.length);
        const left = state.settings.mode === 'knockout' || isRoundRobinStage() ? '' : '';
        const rowsRef = [];
        const html = sections.map(s => `<div class="cal-section"><h4>${escapeHtml(s.title)}</h4>${s.matches.map(m => { rowsRef.push(m); return calendarRow(m); }).join('')}</div>`).join('');
        el.innerHTML = `<div class="confirm-box calendar-box" role="dialog" aria-modal="true">
            <button type="button" class="pc-close" title="Закрыть">✕</button>
            <h3>📅 Календарь${left}</h3>
            ${hasHumans() ? `<label class="cal-filter"><input type="checkbox" ${calendarMine ? 'checked' : ''}> Только мои матчи</label>` : ''}
            <div class="cal-list">${html || '<div class="muted">Матчей пока нет</div>'}</div>
            ${!state.champion && state.settings.mode === 'knockout' ? '<div class="muted cal-note">Пары следующих раундов появятся после жеребьёвки.</div>' : ''}
        </div>`;
        el.querySelectorAll('.cal-row').forEach((row, i) => row.onclick = () => {
            const m = rowsRef[i];
            if (m.isFinished) { openMatchReport(m); return; }
            if (!hasHumans() || isUserMatch(m)) { el.remove(); openMatch(m); }
        });
        const f = el.querySelector('.cal-filter input');
        if (f) f.onchange = () => { calendarMine = f.checked; render(); };
        // Прокрутка к первому несыгранному
        setTimeout(() => el.querySelector('.cal-row:not(.done)')?.scrollIntoView({ block: 'center' }), 50);
    };
    render();
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.pc-close')) el.remove(); });
}

// ----- Страница команды -----
function teamMatches(team) {
    const seen = new Set();
    return [...(state.groupMatches || []), ...state.matches, ...state.tournamentHistory.flatMap(r => r.matches)]
        .filter(m => !seen.has(m) && seen.add(m) && m.involves(team));
}

function openTeamPage(teamId) {
    const team = state.teams.find(t => t.id === Number(teamId));
    if (!team) return;
    const squad = state.squads && state.squads[team.id];
    const players = squad ? getSquadPlayers(team) : [];
    const st = team.stats;
    const statOf = p => playerStats[`${team.id}-${p.number}`] || {};
    const lineup = squad ? new Set(squad.lineup) : new Set();
    const pos = { GK: 'ВР', DEF: 'ЗЩ', MID: 'ПЗ', FWD: 'НП' };
    const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
    const rows = [...players].sort((a, b) => order[a.natPos || a.position] - order[b.natPos || b.position] || b.rating - a.rating).map(p => {
        const s = statOf(p);
        const avg = s.rated ? (s.ratingSum / s.rated).toFixed(1) : '—';
        const badge = isInjured(p) ? ' 🚑' : (p.suspended ? ' 🚫' : '');
        return `<tr class="player-row ${lineup.has(p.number) ? 'tp-start' : ''}" data-player="${team.id}-${p.number}">
            <td>${p.number}</td><td>${pos[p.natPos || p.position] || ''}</td>
            <td>${escapeHtml(p.name)}${badge}</td><td>${p.age || ''}</td><td><b>${p.rating}</b></td>
            <td>${s.matches || 0}</td><td>${s.goals || 0}</td><td>${s.assists || 0}</td><td>${avg}</td>
        </tr>`;
    }).join('');
    const games = teamMatches(team).filter(m => m.isFinished).map(m => {
        const a = m.aggregateScore;
        const home = m.team1.id === team.id;
        const my = home ? a.t1 : a.t2, their = home ? a.t2 : a.t1;
        const res = m.winner ? (m.winner.id === team.id ? 'W' : 'L') : (my > their ? 'W' : my < their ? 'L' : 'D');
        const opp = home ? m.team2 : m.team1;
        return `<div class="tm-game"><span class="pc-res pc-${res}">${my}:${their}</span> ${teamLabel(opp)} <small class="muted">${escapeHtml(m.roundName || '')}</small></div>`;
    }).reverse().join('');
    const sq = squad ? `${squad.formation} · ${(STYLES[squad.style] || {}).label || squad.style}` : '';

    document.querySelector('.team-page-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay team-page-overlay';
    el.innerHTML = `<div class="confirm-box team-page" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <div class="pc-head">${crestHtml(team, 'lg')}<div>
            <div class="pc-name">${escapeHtml(team.name)}</div>
            <div class="muted">Рейтинг ${team.rating}${sq ? ' · ' + escapeHtml(sq) : ''}${isHuman(team) ? ' · ваша команда' : ''}</div>
            <div class="tm-form">${teamFormHtml(team)}</div>
        </div></div>
        <div class="pc-tiles">
            ${[[st.played, 'матчей'], [`${st.won}-${st.drawn}-${st.lost}`, 'В-Н-П'], [`${st.gf}:${st.ga}`, 'мячи'], [st.points, 'очков']].map(([v, l]) => `<div class="pc-tile"><b>${v}</b><span>${l}</span></div>`).join('')}
        </div>
        <h4>Состав <small class="muted">· выделены игроки старта</small></h4>
        <div class="tm-squad"><table class="stats-table"><thead><tr><th>№</th><th></th><th>Игрок</th><th>Возр.</th><th>Рейт.</th><th>И</th><th>Г</th><th>П</th><th>Оц.</th></tr></thead><tbody>${rows}</tbody></table></div>
        <h4>Матчи турнира</h4>
        <div class="tm-games">${games || '<div class="muted">Ещё не играла</div>'}</div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.pc-close')) el.remove(); });
}

// Клик по строке таблицы с командой (таблицы групп и лиги, участники, итоги) открывает её страницу
document.addEventListener('click', e => {
    const row = e.target.closest('[data-team-id]');
    if (!row || e.target.closest('.player-row')) return;
    if (!state.teams || !state.teams.length) return;
    openTeamPage(row.dataset.teamId);
});

// ----- Нижнее меню на телефоне -----
function tournamentActive() {
    return !!(state.teams && state.teams.length && !state.champion);
}

function renderMobileNav() {
    const nav = $('mobile-nav');
    if (!nav) return;
    const active = document.querySelector('.screen.active');
    const id = active ? active.id : '';
    nav.querySelectorAll('[data-nav]').forEach(b => {
        const k = b.dataset.nav;
        b.classList.toggle('active', (k === 'home' && id === 'screen-home') || (k === 'tournament' && ['screen-dashboard', 'screen-match', 'screen-tactics'].includes(id)));
        if (k === 'tournament' || k === 'calendar') b.disabled = !tournamentActive();
    });
}

function initTools() {
    $('quick-actions').addEventListener('click', e => { const b = e.target.closest('[data-qa]'); if (b) onQuickAction(b.dataset.qa); });
    const nav = $('mobile-nav');
    if (nav) nav.addEventListener('click', e => {
        const b = e.target.closest('[data-nav]');
        if (!b || b.disabled) return;
        const k = b.dataset.nav;
        if (typeof simStep !== 'undefined' && simStep) { notify('Сначала доиграйте матч или поставьте паузу'); return; }
        if (k === 'home') { if (tournamentActive()) goToMenu(); else goHome(); }
        else if (k === 'tournament') openDashboard();
        else if (k === 'calendar') openCalendar();
        else if (k === 'hall') { goHome(); const h = $('hall-card'); if (h) { h.open = true; h.scrollIntoView({ behavior: 'smooth' }); } }
        else if (k === 'settings') openSettings();
    });
    renderMobileNav();
}

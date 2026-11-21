// ===== ПОДАЧА: экран перед матчем, церемония награждения, «живая» сетка плей-офф =====

// ----- Экран перед матчем -----
function matchPrediction(sim) {
    const s1 = sim.strength('team1'), s2 = sim.strength('team2');
    const home = sim.homeSide === 'team1' ? 2 : (sim.homeSide === 'team2' ? -2 : 0);
    const d = s1 - s2 + home;
    const draw = Math.max(0.12, 0.28 - Math.abs(d) * 0.012);
    const p1 = (1 - draw) / (1 + Math.pow(10, -d / 9));
    return [p1, draw, 1 - draw - p1].map(p => Math.round(p * 100));
}

function previewSide(sim, side) {
    const s = sim.sides[side];
    const t = s.team;
    const stars = [...s.onPitch].sort((a, b) => b.rating - a.rating).slice(0, 3);
    const absent = (s.absent || []).slice(0, 3);
    return `<div class="pv-side">
        ${crestHtml(t, 'lg')}
        <div class="pv-name">${escapeHtml(t.name)}</div>
        <div class="pv-meta">рейтинг ${t.rating} · ${s.formation} · ${(STYLES[s.style] || {}).label || ''}</div>
        <div class="pv-form">${teamFormHtml(t) || '<span class="muted">первый матч</span>'}</div>
        <div class="pv-stars">${stars.map(p => `<span title="рейтинг ${p.rating}">⭐ ${escapeHtml(shortName(p.name))} <b>${p.rating}</b></span>`).join('')}</div>
        ${absent.length ? `<div class="pv-absent">${absent.map(a => `<span>${a.injured ? '🚑' : '🚫'} ${escapeHtml(shortName(a.name))}</span>`).join('')}</div>` : ''}
    </div>`;
}

function renderMatchPreview(m, sim) {
    const box = $('match-preview');
    if (!box) return;
    if (!prefs.preview || !sim) { box.style.display = 'none'; return; }
    const [p1, pd, p2] = matchPrediction(sim);
    const w = WEATHER[sim.weather];
    const venue = sim.homeSide ? `дома у «${sim.sides[sim.homeSide].team.name}»` : 'нейтральное поле';
    const h2h = teamMatches(m.team1).filter(x => x !== m && x.isFinished && x.involves(m.team2)).map(x => {
        const a = x.aggregateScore;
        return `${escapeHtml(x.team1.name)} ${a.t1}:${a.t2} ${escapeHtml(x.team2.name)}`;
    });
    box.innerHTML = `
        <div class="pv-head"><span>${escapeHtml(m.roundName || '')}</span><button type="button" class="pv-hide" title="Скрыть">✕</button></div>
        <div class="pv-teams">${previewSide(sim, 'team1')}<div class="pv-vs">VS</div>${previewSide(sim, 'team2')}</div>
        <div class="pv-bar" title="Прогноз по силе составов, фактору поля и форме">
            <span style="flex:${p1}">${p1}%</span><span class="pv-draw" style="flex:${pd}">${pd}%</span><span style="flex:${p2}">${p2}%</span>
        </div>
        <div class="pv-legend"><span>победа</span><span>ничья</span><span>победа</span></div>
        <div class="pv-info"><span>${w.icon} ${escapeHtml(w.label)}</span><span>🏟️ ${escapeHtml(venue)}</span>
            ${h2h.length ? `<span>🤝 В этом турнире: ${h2h.join(', ')}</span>` : ''}</div>`;
    box.style.display = '';
    box.querySelector('.pv-hide').onclick = () => { box.style.display = 'none'; };
}

function hideMatchPreview() {
    const box = $('match-preview');
    if (box) box.style.display = 'none';
}

// ----- Церемония: пьедестал и конфетти в цветах чемпиона -----
const CHAMP_EMOJI_COLORS = { '🔴': '#e5323b', '⚪': '#f4f4f4', '🔵': '#2d6fe8', '🔷': '#6ab4ff', '🟢': '#21a453', '🟡': '#f6cc2a', '🟠': '#f58a1f', '🟣': '#8e44d6', '⚫': '#222222', '🟤': '#8b5a2b' };

function championColors(team) {
    if (typeof NATIONS !== 'undefined' && NATIONS[team.name]) return [...NATIONS[team.name].kit, '#ffd700'];
    const c = Array.from(team.emoji || '').map(ch => CHAMP_EMOJI_COLORS[ch]).filter(Boolean);
    return [...(c.length ? c : ['#ffd700']), '#ffd700'];
}

function podiumTeams(champion) {
    if (state.settings.mode === 'league' && !state.settings.ucl) return sortGroup([...state.teams]).slice(0, 4);
    const out = [champion];
    const rounds = state.tournamentHistory;
    const final = rounds.length ? rounds[rounds.length - 1].matches[0] : null;
    if (final && final.winner) out.push(final.winner === final.team1 ? final.team2 : final.team1);
    const semi = rounds.length > 1 ? rounds[rounds.length - 2] : null;
    if (semi && semi.matches.length === 2) semi.matches.forEach(m => { if (m.winner) out.push(m.winner === m.team1 ? m.team2 : m.team1); });
    return out.filter(Boolean);
}

function renderPodium(champion) {
    const box = $('podium');
    if (!box) return;
    if (state.settings.stageOnly) { box.innerHTML = ''; return; }
    const [first, second, ...thirds] = podiumTeams(champion);
    const step = (t, place, medal) => t ? `<div class="pod-step pod-${place}">
        ${crestHtml(t, place === 1 ? 'lg' : 'md')}<div class="pod-name">${escapeHtml(t.name)}</div>
        <div class="pod-block"><span>${medal}</span></div></div>` : '';
    const league = state.settings.mode === 'league' && !state.settings.ucl;
    box.innerHTML = `<div class="podium-row">
        ${step(second, 2, '🥈')}${step(first, 1, '🥇')}
        <div class="pod-step pod-3">${thirds.slice(0, league ? 1 : 2).map(t => `${crestHtml(t, 'md')}<div class="pod-name">${escapeHtml(t.name)}</div>`).join('')}
            ${thirds.length ? '<div class="pod-block"><span>🥉</span></div>' : ''}</div>
    </div>`;
    // Конфетти в цветах чемпиона
    window.confettiColors = championColors(champion);
}

// ----- Сетка плей-офф: путь команды подсвечивается -----
function highlightPath(teamName) {
    document.querySelectorAll('#playoff-bracket .bracket-match').forEach(el => {
        el.classList.toggle('bm-path', !!teamName && el.dataset.teams && el.dataset.teams.split('|').includes(teamName));
    });
}

// Путь чемпиона (после финала) или своей команды — подсвечен сразу (data-teams ставит renderBracket)
function decorateBracket() {
    const focus = state.champion ? state.champion.name : (humanTeams()[0] || {}).name;
    highlightPath(focus || null);
}

function initShowcase() {
    const container = $('bracket-container');
    if (container) {
        container.parentElement.addEventListener('mouseover', e => {
            const row = e.target.closest('.bracket-team');
            if (!row) return;
            const name = row.querySelector('.team-label-name');
            if (name) highlightPath(name.textContent);
        });
        container.parentElement.addEventListener('mouseleave', () => decorateBracket());
    }
}

// ===== ЭКРАН РЕЗУЛЬТАТОВ: путь к победе, награды, достижения =====


function calculateTournamentAwards() {
    const players = Object.values(playerStats);
    const best = (score, list = players) => [...list].sort((a, b) => score(b) - score(a))[0] || null;

    // Лучший вратарь: меньше всего пропущенных за матч
    const gaPerMatch = p => { const t = getTeamById(p.teamId); return t.stats.ga / (t.stats.played || 1); };
    const keepers = players.filter(p => p.position === 'GK' && p.matches > 0);
    const playedTeams = state.teams.filter(t => t.stats.played > 0);

    return {
        bestPlayer: best(p => p.goals + p.assists),
        topScorer: best(p => p.goals),
        topAssister: best(p => p.assists),
        bestGoalkeeper: best(p => -gaPerMatch(p) * 100 + p.matches * 0.01, keepers),
        bestAttack: [...playedTeams].sort((a, b) => b.stats.gf - a.stats.gf)[0] || null,
        bestDefense: [...playedTeams].sort((a, b) => a.stats.ga / a.stats.played - b.stats.ga / b.stats.played)[0] || null
    };
}

function awardCard(icon, title, name, teamText, stat) {
    return `<div class="award-card">
        <span class="award-icon">${icon}</span>
        <div class="award-title">${title}</div>
        <div class="award-player">${name || 'N/A'}</div>
        <div class="award-team">${teamText || ''}</div>
        <div class="award-stat">${stat}</div>
    </div>`;
}

function renderTournamentAwards() {
    const a = calculateTournamentAwards();
    const playerTeam = p => { const t = p && getTeamById(p.teamId); return t ? teamLabel(t) : ''; };
    const gkTeam = a.bestGoalkeeper && getTeamById(a.bestGoalkeeper.teamId);

    $('tournament-awards').innerHTML = [
        awardCard('👑', 'ЛУЧШИЙ ИГРОК', a.bestPlayer?.name, playerTeam(a.bestPlayer), `${a.bestPlayer?.goals || 0} голов + ${a.bestPlayer?.assists || 0} ассистов`),
        awardCard('⚽', 'БОМБАРДИР', a.topScorer?.name, playerTeam(a.topScorer), `${a.topScorer?.goals || 0} голов`),
        awardCard('🎯', 'ЛУЧШИЙ АССИСТЕНТ', a.topAssister?.name, playerTeam(a.topAssister), `${a.topAssister?.assists || 0} ассистов`),
        awardCard('🧤', 'ВРАТАРЬ', a.bestGoalkeeper?.name, playerTeam(a.bestGoalkeeper), `${gkTeam ? gkTeam.stats.ga : 0} пропущено`),
        awardCard('🔥', 'ЛУЧШАЯ АТАКА', a.bestAttack?.name, a.bestAttack && teamLabel(a.bestAttack), `${a.bestAttack?.stats.gf || 0} забито`),
        awardCard('🛡️', 'ЛУЧШАЯ ЗАЩИТА', a.bestDefense?.name, a.bestDefense && teamLabel(a.bestDefense), `${a.bestDefense?.stats.ga || 0} пропущено`)
    ].join('');
}

function renderTournamentPath() {
    const penDots = m => m.penalties.kicks.map(k =>
        `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin:1px;font-size:10px;${k.scored ? 'background:#4cc9f0;color:#1a1a2e' : 'background:#e94560;color:white'}">${k.scored ? '⚽' : '❌'}</span>`).join('');

    $('tournament-path').innerHTML = state.tournamentHistory.map(r => `
        <div style="margin:10px 0;padding:10px;background:rgba(26,26,62,0.8);border-radius:5px">
            <b>${r.round}</b><br>
            ${r.matches.map(m => {
                const agg = m.aggregateScore;
                const info = m.isFinal ? '🏆 ФИНАЛ' : (m.legs === 2 ? `(${m.leg1.t1}:${m.leg1.t2}, ${m.leg2.t1}:${m.leg2.t2})` : '');
                const pen = m.penalties.kicks.length ? `<div style="font-size:11px;margin-top:5px">Пенальти: ${m.team1.name} ${m.penalties.t1} - ${m.team2.name} ${m.penalties.t2}<div>${penDots(m)}</div></div>` : '';
                return `<span class="clickable"${reportAttr(m)}>${teamLabel(m.team1)} ${agg.t1}:${agg.t2} ${teamLabel(m.team2)} ${info}${pen}${m.isAutoSimulated ? ' 🤖' : ''}</span>${scorersMiniHtml(m)}`;
            }).join('<br>')}
        </div>`).join('');
}

// ----- «Вдвоём»: итог дуэли -----
// Кто выше: чемпион > финалист > дальше в плей-офф > выше в таблице
function duoRank(team) {
    if (state.champion && state.champion.id === team.id) return 1000;
    const rounds = state.tournamentHistory.filter(r => r.matches.some(m => m.involves(team)));
    const deepest = rounds.length ? Math.max(...rounds.map(r => r.roundIndex)) + 10 : 0;
    const table = sortGroup([...(state.groups.find(g => g.some(t => t.id === team.id)) || state.teams)]);
    const place = table.findIndex(t => t.id === team.id) + 1;
    return deepest * 100 + (100 - place) + team.stats.points / 1000;
}

function renderDuoCard() {
    const card = $('career-card');
    const [a, b] = humanTeams();
    if (!a || !b) { card.style.display = 'none'; return; }
    const ra = duoRank(a), rb = duoRank(b);
    const winner = ra === rb ? null : (ra > rb ? a : b);
    // Очные встречи: все этапы
    const all = [...(state.groupMatches || []), ...state.matches, ...state.tournamentHistory.flatMap(r => r.matches)];
    const h2h = [...new Set(all)].filter(m => m.isFinished && m.involves(a) && m.involves(b));
    const side = (t, res) => {
        const r = getUserResult(t);
        return `<div class="duo-side ${winner === t ? 'win' : ''}">
            <span class="duo-tag p${humanIndex(t) + 1}">${humanLabel(t)}</span>
            <div class="duo-crest">${crestHtml(t, 'xl')}</div>
            <div class="duo-name">${t.name}</div>
            <div class="duo-res">${r ? r.text : ''}</div>
            <div class="muted">${t.stats.won}-${t.stats.drawn}-${t.stats.lost} · мячи ${t.stats.gf}:${t.stats.ga}</div>
        </div>`;
    };
    card.querySelector('h3').textContent = 'Итог дуэли';
    $('career-result').innerHTML = `
        <div class="duo-verdict">${winner ? `🏆 Побеждает ${humanLabel(winner)} — «${winner.name}»` : 'Ничья в дуэли — одинаковый результат'}</div>
        <div class="duo-board">${side(a)}<div class="duo-vs">VS</div>${side(b)}</div>
        <div class="duo-h2h"><b>Личные встречи</b>${h2h.length ? h2h.map(m => {
            const g = m.aggregateScore;
            return `<div>${teamLabel(m.team1)} ${g.t1}:${g.t2}${m.penalties.kicks.length ? ` (пен. ${m.penalties.t1}:${m.penalties.t2})` : ''} ${teamLabel(m.team2)} <small class="muted">${m.roundName}</small></div>`;
        }).join('') : '<div class="muted">Команды не встретились</div>'}</div>`;
    card.querySelector('table').style.display = 'none';
    $('btn-next-season').style.display = 'none';
    card.style.display = 'block';
}

// ----- Карьера за сборную: история всех турниров сборных и следующий турнир -----
function renderNationCareerCard(card) {
    recordCareerSeason();
    const team = state.userTeam;
    const result = getUserResult();
    const d = readNationCareer();
    const mine = d.tournaments.filter(t => t.team === team.name);
    const titles = mine.filter(t => t.trophy).length;
    card.querySelector('h3').textContent = 'Карьера сборной';
    card.querySelector('thead tr').innerHTML = '<th>№</th><th>Турнир</th><th>Результат</th><th>В-Н-П</th><th>Мячи</th><th>Бомбардир</th>';
    $('career-result').innerHTML = `
        <div class="career-team">${teamLabel(team)}</div>
        <div class="career-outcome ${result.trophy ? 'trophy' : ''}">${result.trophy ? `🏆 ${NATION_CUPS[state.settings.teamType].title} — ваш!` : result.text}</div>
        <div class="muted">Турниров за «${escapeHtml(team.name)}»: ${mine.length} · титулов: ${titles} ${'🏆'.repeat(Math.min(titles, 10))}</div>`;
    $('career-history').innerHTML = [...d.tournaments].reverse().slice(0, 20).map(t => `
        <tr class="${t.trophy ? 'qualify-third' : ''}">
            <td>${t.n}</td><td>${t.icon} ${t.cup}<br><small class="muted">${escapeHtml(t.team)} · ${t.date}</small></td>
            <td><b>${t.result}</b></td><td>${t.record}</td><td>${t.goals}</td><td>${t.topScorer}</td>
        </tr>`).join('');
    const btn = $('btn-next-season');
    btn.innerHTML = `<span class="btn-text">▶ Следующий турнир за «${escapeHtml(team.name)}»</span>`;
    btn.onclick = () => openNextNationTournament(team.name);
    card.style.display = 'block';
}

// Выбор следующего турнира: только те, где играет эта сборная
function openNextNationTournament(teamName) {
    const cups = HOME_CUPS.filter(c => c.nations && NATION_CUPS[c.type].names.includes(teamName));
    if (!cups.length) { notify('Эта сборная больше не участвует в турнирах — добавьте её в редакторе'); return; }
    openHomeSheet(`Следующий турнир · ${teamName}`, [
        ...cups.map(c => ({ icon: c.icon, title: c.title, text: homeCupInfo(c).sub, run: () => startNationCareer(c, teamName) })),
        { icon: '🔁', title: 'Сменить сборную', text: 'Выбрать другую команду', minor: true, run: () => openModeSheet('career') }
    ]);
}

function startNationCareer(cup, teamName) {
    applyHomePreset(cup, 'career');
    const settings = readSettings();
    startNewSlot();
    const pool = pickRandomTeams(settings.teamType, getTeamsData(settings.teamType).names.length);
    startTournament(settings, trimPool(pool, [teamName], settings.count), teamName);
}

function renderCareerCard() {
    const card = $('career-card');
    if (isDuo()) { renderDuoCard(); return; }
    card.querySelector('h3').textContent = 'Ваша карьера';
    card.querySelector('table').style.display = '';
    card.querySelector('thead tr').innerHTML = '<th>Сезон</th><th>Формат</th><th>Результат</th><th>В-Н-П</th><th>Мячи</th><th>Бомбардир</th>';
    $('btn-next-season').style.display = '';
    $('btn-next-season').innerHTML = '<span class="btn-text">Следующий сезон →</span>';
    $('btn-next-season').onclick = openTransferWindow;
    if (!isCareer() || !state.userTeam || state.settings.seriesId) { card.style.display = 'none'; return; }
    if (isNationCareer()) { renderNationCareerCard(card); return; }
    recordCareerSeason();
    const result = getUserResult();
    const career = readCareer();
    const trophies = career.seasons.reduce((a, s) => a + (s.trophy ? 1 : 0) + (s.cupTrophy ? 1 : 0), 0);
    const cup = userCupResult();
    const double = result.trophy && cup && cup.trophy;
    $('career-result').innerHTML = `
        <div class="career-team">${teamLabel(state.userTeam)}</div>
        ${double ? '<div class="career-double">🏆🏆 ЗОЛОТОЙ ДУБЛЬ: лига и кубок!</div>' : ''}
        <div class="career-outcome ${result.trophy ? 'trophy' : ''}">${result.text}</div>
        ${cup ? `<div class="career-outcome career-cup ${cup.trophy ? 'trophy' : ''}">${cup.text}${state.cup && state.cup.winner && !cup.trophy ? ` <small class="muted">· кубок взял ${state.cup.winner.name}</small>` : ''}</div>` : ''}
        <div class="muted">Сезонов: ${career.seasons.length} · трофеев: ${trophies} ${'🏆'.repeat(Math.min(trophies, 10))}</div>`;
    $('career-history').innerHTML = [...career.seasons].reverse().map(s => `
        <tr class="${s.trophy || s.cupTrophy ? 'qualify-third' : ''}">
            <td>${s.season}</td><td>${s.format}</td><td><b>${s.result}</b>${s.cup ? `<br><small>${s.cup}</small>` : ''}</td><td>${s.record}</td><td>${s.goals}</td><td>${s.topScorer}</td>
        </tr>`).join('');
    card.style.display = 'block';
}

function showResults(champion) {
    state.champion = champion;
    clearSave(); // турнир завершён — продолжать нечего (у серии в слоте остаётся сама серия)
    if (!state.settings.stageOnly) recordTournamentInHall(champion); // отбор и стыки — не «турнир с чемпионом»
    playSound('whistle-end');

    setHtml('champion-name', crestHtml(champion, 'xl') + ' ' + champion.name);
    const isLeague = state.settings.mode === 'league';
    $('tournament-path-card').style.display = isLeague || state.settings.stageOnly ? 'none' : 'block';
    renderTournamentPath();
    renderCareerCard();
    renderSeriesResult();
    renderPodium(champion);

    $('teams-stats').innerHTML = [...state.teams].sort((a, b) => b.stats.points - a.stats.points).map(t => `
        <tr data-team-id="${t.id}" style="${userRowStyle(t.id)}">
            <td>${teamLabel(t)} ${t.id === champion.id ? '👑' : ''}</td>
            <td>${t.stats.played}</td><td>${t.stats.won}</td><td>${t.stats.points}</td><td>${t.stats.gf}-${t.stats.ga}</td>
        </tr>`).join('');

    renderFullScorers();
    renderTournamentAwards();
    renderSeasonAwards();
    achOnTournament(champion);
    museumRecord(champion);
    renderWhatsNext();
    renderAchievements();
    showScreen('results');
}

// ----- «Что дальше» после отдельного турнира: следующий сезон, цикл сборных, серия -----
function renderWhatsNext() {
    const card = $('next-card');
    if (!card) return;
    const st = state.settings;
    if (st.seriesId || st.stageOnly) { card.style.display = 'none'; return; }
    const user = state.userTeam ? state.userTeam.name : null;
    const mode = isCareer() ? 'career' : (isDuo() ? 'duo' : 'simulator');
    const nationCup = typeof NATION_CUPS !== 'undefined' && NATION_CUPS[st.teamType];
    let tileId = null;
    try { tileId = localStorage.getItem('footballSimPro.lastTile'); } catch (e) { /* ignore */ }
    const tile = HOME_CUPS.find(c => c.id === tileId);
    const opts = [];
    if (nationCup && mode !== 'duo') {
        const next = st.teamType === 'worldcup' ? 'Чемпионат Европы и Кубок Америки' : 'Чемпионат мира';
        opts.push({ id: 'nations', icon: '🌍', title: 'Продолжить цикл сборных', text: `Дальше — отбор и ${next}; чемпионаты чередуются, как в жизни` });
    }
    if (st.euroCup === 'ucl' && mode !== 'duo') opts.push({ id: 'ucl', icon: '★', title: 'Лига чемпионов по сезонам', text: 'Отборочные стыки, общий этап, плей-офф — сезон за сезоном' });
    if (st.teamType === 'russia' && (st.originalMode || st.mode) === 'league' && mode !== 'duo')
        opts.push({ id: 'rpl', icon: '🏟️', title: 'РПЛ: сезон по календарю', text: 'Чемпионат и Кубок, вылет и стыки, Суперкубок и еврокубки для лучших' });
    if (tile && mode === 'simulator') opts.push({ id: 'again', icon: '🔁', title: `Следующий сезон: ${tile.title}`, text: 'Новая жеребьёвка, рекорды и музей сохраняются' });
    if (!opts.length) { card.style.display = 'none'; return; }
    card.innerHTML = `<div class="hr-label">Что дальше</div>
        <div class="next-opts">${opts.map(o => `<button type="button" class="next-opt" data-next="${o.id}"><span class="no-icon">${o.icon}</span><span><b>${escapeHtml(o.title)}</b><small class="muted">${escapeHtml(o.text)}</small></span></button>`).join('')}</div>`;
    card.style.display = '';
    card.querySelectorAll('[data-next]').forEach(b => b.onclick = () => {
        const id = b.dataset.next;
        if (id === 'again') { startHomePreset(tile, 'simulator'); return; }
        if (id === 'ucl') { beginSeries('euro', mode, user); return; }
        if (id === 'rpl') { beginSeries('rpl', mode, user); return; }
        if (id === 'nations') {
            // Следующий турнир цикла — другой: после ЧМ — ЧЕ (а для Америки — Кубок Америки), после них — ЧМ
            const s = createSeries('nations', mode, user && confedOf(user) ? user : null);
            const after = st.teamType === 'worldcup';
            s.cycle = after ? 'euro' : 'wc';
            s.year = after ? 2028 : 2030;
            writeSeries(s);
            openSeries();
        }
    });
}

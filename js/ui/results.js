// ===== ЭКРАН РЕЗУЛЬТАТОВ: путь к победе, награды, достижения =====

const achievements = [
    { title: 'Первый гол', desc: 'Забейте первый гол', icon: '⚽', check: () => Object.values(playerStats).some(p => p.goals >= 1) },
    { title: 'Хет-трик', desc: '3+ гола игроком', icon: '🎯', check: () => Object.values(playerStats).some(p => p.goals >= 3) },
    { title: '5 побед', desc: '5 побед за турнир', icon: '🔥', check: () => !!state.userTeam && state.userTeam.stats.won >= 5 },
    { title: 'Чемпион!', desc: 'Выиграйте турнир в карьере', icon: '🏆', check: () => !!(state.champion && state.userTeam && state.champion.id === state.userTeam.id) }
];

function renderAchievements() {
    $('achievements-list').innerHTML = achievements.map(a => {
        const unlocked = a.check();
        return `<div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
            <span class="achievement-icon">${a.icon}</span>
            <div class="achievement-title">${a.title}</div>
            <div class="achievement-desc">${a.desc}</div>
            ${unlocked ? '<div class="achievement-progress">✅</div>' : ''}
        </div>`;
    }).join('');
}

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
                return `${teamLabel(m.team1)} ${agg.t1}:${agg.t2} ${teamLabel(m.team2)} ${info}${pen}${m.isAutoSimulated ? ' 🤖' : ''}`;
            }).join('<br>')}
        </div>`).join('');
}

function renderCareerCard() {
    const card = $('career-card');
    if (!isCareer() || !state.userTeam) { card.style.display = 'none'; return; }
    recordCareerSeason();
    const result = getUserResult();
    const career = readCareer();
    const trophies = career.seasons.filter(s => s.trophy).length;
    $('career-result').innerHTML = `
        <div class="career-team">${teamLabel(state.userTeam)}</div>
        <div class="career-outcome ${result.trophy ? 'trophy' : ''}">${result.text}</div>
        <div class="muted">Сезонов: ${career.seasons.length} · трофеев: ${trophies} ${'🏆'.repeat(Math.min(trophies, 10))}</div>`;
    $('career-history').innerHTML = [...career.seasons].reverse().map(s => `
        <tr class="${s.trophy ? 'qualify-third' : ''}">
            <td>${s.season}</td><td>${s.format}</td><td><b>${s.result}</b></td><td>${s.record}</td><td>${s.goals}</td><td>${s.topScorer}</td>
        </tr>`).join('');
    card.style.display = 'block';
}

function showResults(champion) {
    state.champion = champion;
    clearSave(); // турнир завершён — продолжать нечего
    recordTournamentInHall(champion);
    playSound('whistle-end');

    setHtml('champion-name', crestHtml(champion, 'xl') + ' ' + champion.name);
    const isLeague = state.settings.mode === 'league';
    $('tournament-path-card').style.display = isLeague ? 'none' : 'block';
    renderTournamentPath();
    renderCareerCard();

    $('teams-stats').innerHTML = [...state.teams].sort((a, b) => b.stats.points - a.stats.points).map(t => `
        <tr style="${userRowStyle(t.id)}">
            <td>${teamLabel(t)} ${t.id === champion.id ? '👑' : ''}</td>
            <td>${t.stats.played}</td><td>${t.stats.won}</td><td>${t.stats.points}</td><td>${t.stats.gf}-${t.stats.ga}</td>
        </tr>`).join('');

    renderFullScorers();
    renderTournamentAwards();
    renderAchievements();
    showScreen('results');
}

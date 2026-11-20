// ===== ЗАЛ СЛАВЫ: чемпионы всех турниров и рекорды =====
// Хранится в localStorage отдельно от турнира и карьеры.

const HALL_KEY = 'footballSimPro.hall';
const HALL_LIMIT = 50;

function readHall() {
    try {
        const data = JSON.parse(localStorage.getItem(HALL_KEY));
        if (data && Array.isArray(data.tournaments)) return data;
    } catch (e) { /* ignore */ }
    return { tournaments: [], titles: {}, records: {} };
}

function writeHall(data) {
    try { localStorage.setItem(HALL_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

function clearHall() {
    try { localStorage.removeItem(HALL_KEY); } catch (e) { /* ignore */ }
}

// Все сыгранные матчи турнира (группы/лига + плей-офф), без повторов
function allPlayedMatches() {
    const set = new Set([...(state.groupMatches || []), ...state.matches, ...state.tournamentHistory.flatMap(r => r.matches)]);
    return [...set].filter(m => m.isFinished);
}

const teamRef = t => t ? { name: t.name, emoji: t.emoji } : null;

// Записывает завершённый турнир (вызывается один раз на экране результатов)
function recordTournamentInHall(champion) {
    if (state.hallRecorded) return;
    state.hallRecorded = true;
    const hall = readHall();

    const players = Object.values(playerStats);
    const top = [...players].sort((a, b) => b.goals - a.goals)[0];
    const topTeam = top && getTeamById(top.teamId);
    let runnerUp = null;
    if (state.settings.mode === 'league') runnerUp = sortGroup([...state.teams])[1];
    else {
        const final = state.tournamentHistory[state.tournamentHistory.length - 1]?.matches[0];
        if (final) runnerUp = final.winner === final.team1 ? final.team2 : final.team1;
    }

    hall.tournaments.unshift({
        date: new Date().toLocaleDateString('ru-RU'),
        format: formatLabel(state.settings),
        champion: teamRef(champion),
        runnerUp: teamRef(runnerUp),
        topScorer: top && top.goals ? { name: top.name, team: topTeam ? topTeam.name : '', goals: top.goals } : null,
        userTeam: isCareer() && state.userTeam ? teamRef(state.userTeam) : null
    });
    hall.tournaments = hall.tournaments.slice(0, HALL_LIMIT);
    hall.titles[champion.name] = (hall.titles[champion.name] || 0) + 1;
    hall.emojis = { ...(hall.emojis || {}), [champion.name]: champion.emoji };

    // Рекорды: крупнейшая победа, самый результативный матч, лучший бомбардир турнира
    const describe = (m, s1, s2) => `${m.team1.name} ${s1}:${s2} ${m.team2.name}`;
    allPlayedMatches().forEach(m => {
        const games = m.legs === 2 ? [m.leg1, m.leg2] : [{ t1: m.score1, t2: m.score2 }];
        games.forEach(g => {
            const diff = Math.abs(g.t1 - g.t2), total = g.t1 + g.t2;
            if (!hall.records.biggestWin || diff > hall.records.biggestWin.value) {
                hall.records.biggestWin = { value: diff, text: describe(m, g.t1, g.t2) };
            }
            if (!hall.records.mostGoals || total > hall.records.mostGoals.value) {
                hall.records.mostGoals = { value: total, text: describe(m, g.t1, g.t2) };
            }
        });
    });
    if (top && (!hall.records.topScorer || top.goals > hall.records.topScorer.value)) {
        hall.records.topScorer = { value: top.goals, text: `${top.name} (${topTeam ? topTeam.name : ''}) — ${top.goals} гол.` };
    }
    recordAllTime(hall, champion);
    writeHall(hall);
}

// ----- Рекорды за все турниры -----
// players: «Игрок|Команда» → суммы за все турниры; топ-5 матчей и сезонов игроков; титулы по турнирам
function recordAllTime(hall, champion) {
    const tournament = formatLabel(state.settings);
    hall.players = hall.players || {};
    Object.values(playerStats).forEach(p => {
        if (!p.matches) return;
        const team = getTeamById(p.teamId);
        const key = `${p.name}|${team ? team.name : ''}`;
        const r = hall.players[key] || (hall.players[key] = { name: p.name, team: team ? team.name : '', goals: 0, assists: 0, matches: 0, motm: 0, tournaments: 0, titles: 0 });
        r.goals += p.goals; r.assists += p.assists; r.matches += p.matches; r.motm += p.motm || 0; r.tournaments++;
        if (champion && team && team.id === champion.id) r.titles++;
    });
    // Не раздуваем хранилище: оставляем 400 самых результативных
    const keys = Object.keys(hall.players);
    if (keys.length > 400) {
        keys.sort((a, b) => (hall.players[b].goals + hall.players[b].assists) - (hall.players[a].goals + hall.players[a].assists))
            .slice(400).forEach(k => delete hall.players[k]);
    }

    const top5 = (list, item, by) => [...(list || []), item].sort((a, b) => b[by] - a[by]).slice(0, 5);
    const describe = (m, s1, s2) => `${m.team1.name} ${s1}:${s2} ${m.team2.name}`;
    allPlayedMatches().forEach(m => {
        const games = m.legs === 2 ? [m.leg1, m.leg2] : [{ t1: m.score1, t2: m.score2 }];
        games.forEach(g => {
            const text = describe(m, g.t1, g.t2);
            const diff = Math.abs(g.t1 - g.t2), total = g.t1 + g.t2;
            if (diff >= 3 && !(hall.bigWins || []).some(x => x.text === text)) hall.bigWins = top5(hall.bigWins, { value: diff, total, text, where: tournament }, 'value');
            if (total >= 5 && !(hall.highScoring || []).some(x => x.text === text)) hall.highScoring = top5(hall.highScoring, { value: total, text, where: tournament }, 'value');
        });
    });
    Object.values(playerStats).filter(p => p.goals >= 3).forEach(p => {
        const team = getTeamById(p.teamId);
        hall.bestSeasons = top5(hall.bestSeasons, { value: p.goals, text: `${p.name} (${team ? team.name : ''})`, where: tournament }, 'value');
    });
    if (champion) {
        hall.byCompetition = hall.byCompetition || {};
        const c = hall.byCompetition[tournament] || (hall.byCompetition[tournament] = {});
        c[champion.name] = (c[champion.name] || 0) + 1;
    }
}

// Таблица «за все время»: goals | assists | total | motm
function allTimeLeaders(hall, by = 'goals', n = 10) {
    const val = p => by === 'total' ? p.goals + p.assists : p[by];
    return Object.values(hall.players || {}).filter(p => val(p) > 0).sort((a, b) => val(b) - val(a) || b.matches - a.matches).slice(0, n);
}

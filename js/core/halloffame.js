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
    writeHall(hall);
}

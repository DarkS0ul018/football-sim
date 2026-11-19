// ===== СОХРАНЕНИЕ ТУРНИРА В localStorage =====
// Матчи и команды ссылаются друг на друга, поэтому сохраняем их по id и при загрузке связываем обратно.
// Сохраняем только «между матчами»: живой матч, прерванный перезагрузкой, просто начнётся заново.

const SAVE_KEY = 'footballSimPro.save';
const SAVE_VERSION = 3; // v3: составы (схема, свежесть, дисквалификации), туры, лига

function serializeMatch(m) {
    return {
        id: m.id, t1: m.team1.id, t2: m.team2.id, legs: m.legs, stage: m.stage,
        roundName: m.roundName, roundIndex: m.roundIndex,
        isFinished: m.isFinished, isFinal: m.isFinal,
        leg1: m.leg1, leg2: m.leg2, currentLeg: m.currentLeg,
        score1: m.score1, score2: m.score2, penalties: m.penalties,
        winner: m.winner ? m.winner.id : null, isAutoSimulated: m.isAutoSimulated, extraTime: m.extraTime, matchday: m.matchday || null,
        goals: m.goals || [], reds: m.reds || [], motms: m.motms || []
    };
}

function deserializeMatch(d, teamById) {
    const m = new Match(d.id, teamById(d.t1), teamById(d.t2), d.legs, d.stage, d.roundName, d.roundIndex);
    Object.assign(m, {
        isFinished: d.isFinished, isFinal: d.isFinal,
        leg1: d.leg1, leg2: d.leg2, currentLeg: d.currentLeg,
        score1: d.score1, score2: d.score2, penalties: d.penalties,
        winner: d.winner === null ? null : teamById(d.winner),
        isAutoSimulated: d.isAutoSimulated, extraTime: !!d.extraTime, matchday: d.matchday || undefined,
        goals: d.goals || [], reds: d.reds || [], motms: d.motms || []
    });
    return m;
}

function saveGame() {
    if (!state.teams.length || state.champion) return;
    // Матч, не доигранный до конца, не сохраняем — его счёт ещё не окончательный
    const cupMatches = state.cup ? state.cup.rounds.flatMap(r => r.matches) : [];
    const live = [...state.matches, ...cupMatches].find(m => !m.isFinished && (m.score1 || m.score2 || m.leg1.t1 || m.leg1.t2 || m.currentLeg === 2));
    if (live) return;

    // Плей-офф: текущие матчи лежат и в state.matches, и в истории. Храним каждый один раз.
    const all = [];
    const indexOf = new Map();
    const ref = m => {
        if (!indexOf.has(m)) { indexOf.set(m, all.length); all.push(serializeMatch(m)); }
        return indexOf.get(m);
    };
    const data = {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        settings: state.settings,
        teams: state.teams.map(t => ({ id: t.id, name: t.name, emoji: t.emoji, rating: t.rating, stats: t.stats })),
        groups: state.groups.map(g => g.map(t => t.id)),
        groupMatches: state.settings.mode === 'groups' ? [] : state.groupMatches.map(ref),
        currentMatches: state.matches.map(ref),
        history: state.tournamentHistory.map(r => ({ round: r.round, roundIndex: r.roundIndex, matches: r.matches.map(ref) })),
        matches: all,
        currentRound: state.currentRound,
        userTeam: state.userTeam ? state.userTeam.id : null,
        userTeamEliminated: state.userTeamEliminated,
        userTeams: (state.userTeams || []).map(t => t.id),
        eliminated: state.eliminated || [],
        squads: state.squads,
        rosters: state.rosters,
        playerStats,
        cup: serializeCup(),
        news: state.news || [],
        newsMeta: state.newsMeta || null
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* хранилище недоступно — играем без сохранения */ }
}

function readSave() {
    try {
        const data = JSON.parse(localStorage.getItem(SAVE_KEY));
        return data && data.version === SAVE_VERSION ? data : null;
    } catch (e) {
        return null;
    }
}

function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

function loadGame() {
    const data = readSave();
    if (!data) return false;

    state.settings = data.settings;
    state.teams = data.teams.map(d => Object.assign(new Team(d.id, d.name, d.emoji, d.rating), { stats: d.stats }));
    const teamById = id => state.teams.find(t => t.id === id);

    const matches = data.matches.map(d => deserializeMatch(d, teamById));
    state.groups = data.groups.map(g => g.map(teamById));
    state.groupMatches = (data.groupMatches || []).map(i => matches[i]);
    state.tournamentHistory = data.history.map(r => ({ round: r.round, roundIndex: r.roundIndex, matches: r.matches.map(i => matches[i]) }));
    // Если текущий этап — раунд плей-офф, state.matches должен быть тем же массивом, что и в истории
    const last = state.tournamentHistory[state.tournamentHistory.length - 1];
    const current = data.currentMatches.map(i => matches[i]);
    state.matches = last && current.length && last.matches[0] === current[0] ? last.matches : current;

    state.currentRound = data.currentRound;
    state.userTeam = data.userTeam === null ? null : teamById(data.userTeam);
    state.userTeamEliminated = data.userTeamEliminated;
    state.userTeams = (data.userTeams || []).map(teamById).filter(Boolean);
    state.eliminated = data.eliminated || (data.userTeamEliminated && state.userTeam ? [state.userTeam.id] : []);
    state.champion = null;
    state.activeMatch = null;
    playerStats = data.playerStats;
    state.squads = data.squads;
    state.rosters = data.rosters || null; // в старых сохранениях составов нет — берутся текущие
    state.cup = deserializeCup(data.cup, teamById);
    state.news = data.news || [];
    state.newsMeta = data.newsMeta || null;
    state.seasonRecorded = false;
    return true;
}

// Краткое описание сохранения для кнопки «Продолжить»
function describeSave(data) {
    const user = data.userTeam !== null ? data.teams.find(t => t.id === data.userTeam) : null;
    const stage = data.settings.mode === 'league' ? (data.settings.originalMode === 'leaguePlayoff' ? 'Чемпионат' : 'Лига')
        : data.settings.mode === 'groups' ? 'Групповой этап'
        : (data.history[data.history.length - 1] || {}).round || '';
    const played = data.currentMatches.filter(i => data.matches[i].isFinished).length;
    return {
        title: data.settings.gameMode === 'duo' && (data.userTeams || []).length === 2
            ? `Вдвоём: ${data.userTeams.map(id => data.teams.find(t => t.id === id).name).join(' vs ')}`
            : user ? `Карьера: ${user.emoji} ${user.name}` : `Симулятор: ${data.settings.count} команд`,
        details: `${stage} · сыграно ${played} из ${data.currentMatches.length}`
    };
}

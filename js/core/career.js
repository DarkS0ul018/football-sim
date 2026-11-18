// ===== КАРЬЕРА: итог сезона, история, следующий сезон =====
// История карьеры хранится отдельно от сохранения турнира и переживает новые турниры.

const CAREER_KEY = 'footballSimPro.career';

function readCareer() {
    try {
        const data = JSON.parse(localStorage.getItem(CAREER_KEY));
        return data && Array.isArray(data.seasons) ? data : { seasons: [] };
    } catch (e) {
        return { seasons: [] };
    }
}

function writeCareer(data) {
    try { localStorage.setItem(CAREER_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

function clearCareer() {
    try { localStorage.removeItem(CAREER_KEY); } catch (e) { /* ignore */ }
}

// Насколько далеко прошла команда игрока: { text, place, trophy }
function getUserResult() {
    const team = state.userTeam;
    if (!team) return null;
    if (state.settings.mode === 'league') {
        const table = sortGroup([...state.teams]);
        const place = table.findIndex(t => t.id === team.id) + 1;
        return { text: place === 1 ? '🏆 Чемпион лиги' : `${place} место из ${table.length}`, place, trophy: place === 1 };
    }
    if (state.champion && state.champion.id === team.id) return { text: '🏆 Чемпион', place: 1, trophy: true };
    if (isLeagueWithPlayoff() && !state.tournamentHistory.some(r => r.matches.some(m => m.involves(team)))) {
        const table = sortGroup([...state.teams]);
        return { text: `Чемпионат: ${table.findIndex(t => t.id === team.id) + 1} место, без плей-офф`, place: null, trophy: false };
    }
    const rounds = state.tournamentHistory.filter(r => r.matches.some(m => m.involves(team)));
    if (!rounds.length) return { text: 'Групповой этап', place: null, trophy: false };
    const last = rounds[rounds.length - 1];
    if (last.roundIndex === 3) return { text: '🥈 Финал', place: 2, trophy: false };
    return { text: `Вылет: ${last.round}`, place: null, trophy: false };
}

function formatLabel(settings) {
    const mode = settings.originalMode || settings.mode; // после групп mode меняется на knockout
    if (mode === 'league') return `Лига, ${settings.count} команд`;
    if (mode === 'leaguePlayoff') return `Чемпионат + плей-офф, ${settings.count} команд`;
    if (mode === 'groups') return `Группы + плей-офф, ${settings.count} команд`;
    return `Плей-офф, ${settings.count} команд`;
}

// Записывает сезон в историю (один раз за турнир)
function recordCareerSeason() {
    if (!isCareer() || !state.userTeam || state.seasonRecorded) return;
    const result = getUserResult();
    const career = readCareer();
    const team = state.userTeam;
    // Новая команда — новая карьера
    if (career.teamName && career.teamName !== team.name) career.seasons = [];
    career.teamName = team.name;
    career.teamEmoji = team.emoji;
    const goals = Object.values(playerStats).filter(p => p.teamId === team.id);
    const top = [...goals].sort((a, b) => b.goals - a.goals)[0];
    career.seasons.push({
        season: career.seasons.length + 1,
        format: formatLabel(state.settings),
        result: result.text,
        trophy: result.trophy,
        champion: state.champion ? `${state.champion.emoji} ${state.champion.name}` : '',
        record: `${team.stats.won}-${team.stats.drawn}-${team.stats.lost}`,
        goals: `${team.stats.gf}:${team.stats.ga}`,
        topScorer: top && top.goals ? `${top.name} (${top.goals})` : '—'
    });
    writeCareer(career);
    state.seasonRecorded = true;
}

// Следующий сезон с той же командой: лига — те же соперники, кубок — новые случайные
function startNextSeason() {
    const settings = { ...state.settings, mode: state.settings.originalMode || state.settings.mode };
    const userName = state.userTeam.name;
    let pool;
    if (settings.mode === 'league' || settings.mode === 'leaguePlayoff') {
        pool = state.teams.map(t => ({ name: t.name, emoji: t.emoji, rating: t.rating }));
    } else {
        const user = state.teams.find(t => t.name === userName);
        pool = [{ name: user.name, emoji: user.emoji, rating: user.rating },
            ...pickRandomTeams(settings.teamType, settings.count + 1).filter(t => t.name !== userName).slice(0, settings.count - 1)];
    }
    createTournament(settings, pool, userName);
    saveGame();
}

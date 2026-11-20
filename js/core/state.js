// ===== СОСТОЯНИЕ ИГРЫ И МОДЕЛИ =====

const state = {
    teams: [],              // все команды турнира (Team)
    matches: [],            // матчи текущего этапа (Match)
    groups: [],             // группы: массивы Team
    groupMatches: [],       // матчи группового этапа (нужны для тай-брейков и после выхода из групп)
    settings: {},           // count, mode, teamType, gameMode, simMode, groupLegs, playoffLegs
    tournamentHistory: [],  // раунды плей-офф: { round, roundIndex, matches }
    currentRound: 0,
    userTeam: null,         // команда игрока в карьере (Team)
    userTeamEliminated: false,  // все команды людей выбыли
    userTeams: [],          // «Вдвоём»: две команды игроков (Team)
    eliminated: [],         // id выбывших команд людей
    champion: null,
    activeMatch: null,      // открытый на экране матч (не сохраняется)
    cup: null               // кубок в карьере (js/core/cup.js)
};

class Team {
    constructor(id, name, emoji = '⚽', rating = null) {
        this.id = id;
        this.name = name;
        this.emoji = emoji;
        this.rating = rating ?? teamRatings[name] ?? Math.floor(Math.random() * 20) + 70;
        this.stats = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
    }
}

class Match {
    constructor(id, t1, t2, legs = 1, stage = 'group', roundName = '', roundIndex = 0) {
        this.id = id;
        this.team1 = t1;
        this.team2 = t2;
        this.legs = legs;
        this.stage = stage;           // 'group' | 'playoff'
        this.roundName = roundName;
        this.roundIndex = roundIndex;
        this.isFinished = false;
        this.isFinal = false;
        this.leg1 = { t1: 0, t2: 0 };
        this.leg2 = { t1: 0, t2: 0 };
        this.currentLeg = 1;
        this.score1 = 0;
        this.score2 = 0;
        this.penalties = { t1: 0, t2: 0, kicks: [] };
        this.winner = null;
        this.extraTime = false;
        this.isAutoSimulated = false;
        this.lastSims = null; // симуляции игр, только на время матча (не сохраняются)
    }

    get aggregateScore() {
        if (this.legs === 2) return { t1: this.leg1.t1 + this.leg2.t1, t2: this.leg1.t2 + this.leg2.t2 };
        return { t1: this.score1, t2: this.score2 };
    }

    involves(team) {
        return !!team && (this.team1.id === team.id || this.team2.id === team.id);
    }
}

function isCareer() {
    return state.settings.gameMode === 'career';
}

// ----- Команды людей -----
// Карьера — одна команда игрока; «Вдвоём» — две команды на одном устройстве (по очереди).
function isDuo() {
    return state.settings.gameMode === 'duo';
}

function hasHumans() {
    return isCareer() || isDuo();
}

function humanTeams() {
    if (!hasHumans()) return [];
    if (state.userTeams && state.userTeams.length) return state.userTeams;
    return state.userTeam ? [state.userTeam] : [];
}

function isHuman(team) {
    return !!team && humanTeams().some(t => t.id === team.id);
}

function isUserMatch(m) {
    return humanTeams().some(t => m.involves(t));
}

// Номер игрока (0, 1) или −1; ярлык «Игрок 1» — только во «Вдвоём»
function humanIndex(team) {
    return team ? humanTeams().findIndex(t => t.id === team.id) : -1;
}

function humanLabel(team) {
    const i = humanIndex(team);
    return isDuo() && i >= 0 ? `Игрок ${i + 1}` : '';
}

function isEliminated(team) {
    return !!team && (state.eliminated || []).includes(team.id);
}

// Команда человека выбыла; турнир для людей окончен, когда выбыли все
function markEliminated(team) {
    if (!isHuman(team) || isEliminated(team)) return;
    state.eliminated = [...(state.eliminated || []), team.id];
    state.userTeamEliminated = humanTeams().every(isEliminated);
}

function updateTeamStats(team, gf, ga, win) {
    updateTeamForm(team, gf, ga, win);
    team.stats.played++;
    team.stats.gf += gf;
    team.stats.ga += ga;
    if (win === true) { team.stats.won++; team.stats.points += 3; }
    else if (win === false) team.stats.lost++;
    else { team.stats.drawn++; team.stats.points += 1; }
}

// Последние 5 результатов (через все этапы и кубок): «W2:1», «D0:0», «L1:3»
function updateTeamForm(team, gf, ga, win) {
    team.stats.form = [...(team.stats.form || []), (win === true ? 'W' : win === false ? 'L' : 'D') + gf + ':' + ga].slice(-5);
}

// Матчи группового этапа (во время групп — текущие матчи, потом — сохранённая копия)
function getGroupMatches() {
    return isRoundRobinStage() ? state.matches : (state.groupMatches || []);
}

// Мини-таблица личных встреч между командами teams
function headToHead(teams, matches) {
    const ids = new Set(teams.map(t => t.id));
    const table = {};
    teams.forEach(t => { table[t.id] = { pts: 0, gd: 0, gf: 0 }; });
    matches.forEach(m => {
        if (!m.isFinished || !ids.has(m.team1.id) || !ids.has(m.team2.id)) return;
        const { t1, t2 } = m.aggregateScore;
        const a = table[m.team1.id], b = table[m.team2.id];
        a.gf += t1; a.gd += t1 - t2;
        b.gf += t2; b.gd += t2 - t1;
        if (t1 > t2) a.pts += 3; else if (t2 > t1) b.pts += 3; else { a.pts++; b.pts++; }
    });
    return table;
}

// Порядок в группе: очки → личные встречи (очки, разница, забитые) → общая разница → забитые → рейтинг
function sortGroup(group, matches = getGroupMatches()) {
    group.sort((a, b) => b.stats.points - a.stats.points);
    const result = [];
    for (let i = 0; i < group.length;) {
        let j = i;
        while (j < group.length && group[j].stats.points === group[i].stats.points) j++;
        const tied = group.slice(i, j);
        if (tied.length > 1) {
            const h2h = headToHead(tied, matches);
            tied.sort((a, b) =>
                (h2h[b.id].pts - h2h[a.id].pts) ||
                (h2h[b.id].gd - h2h[a.id].gd) ||
                (h2h[b.id].gf - h2h[a.id].gf) ||
                ((b.stats.gf - b.stats.ga) - (a.stats.gf - a.stats.ga)) ||
                (b.stats.gf - a.stats.gf) ||
                (b.rating - a.rating));
        }
        result.push(...tied);
        i = j;
    }
    group.splice(0, group.length, ...result);
    return group;
}

// Сравнение команд из разных групп (для лучших третьих мест)
function compareAcrossGroups(a, b) {
    return (b.stats.points - a.stats.points) ||
        ((b.stats.gf - b.stats.ga) - (a.stats.gf - a.stats.ga)) ||
        (b.stats.gf - a.stats.gf) ||
        (b.stats.won - a.stats.won) ||
        (b.rating - a.rating);
}

// ===== СТАТИСТИКА ИГРОКОВ =====
// ключ: `${teamId}-${номер}`
let playerStats = {};

function initPlayerStats() {
    playerStats = {};
    state.teams.forEach(team => {
        generateTeamSquad(team.name, team.id).forEach(player => {
            const id = `${team.id}-${player.number}`;
            playerStats[id] = {
                id, number: player.number, name: player.name, position: player.position, rating: player.rating,
                teamId: team.id, goals: 0, assists: 0, matches: 0, yellowCards: 0, redCards: 0,
                ratingSum: 0, rated: 0, motm: 0, log: []
            };
        });
    });
}

function getTeamById(id) {
    return state.teams.find(t => t.id === id) || null;
}

function addPlayerStat(teamId, playerNumber, field) {
    const p = playerStats[`${teamId}-${playerNumber}`];
    if (p) p[field]++;
}

// Матч игрока для его карточки: соперник, счёт, оценка, голы, передачи, карточки.
// Средняя оценка и «лучший игрок матча» считаются только по матчам турнира (кубок — отдельно).
function recordPlayerMatch(teamId, playerNumber, entry) {
    const p = playerStats[`${teamId}-${playerNumber}`];
    if (!p) return;
    (p.log || (p.log = [])).push(entry);
    if (entry.cup) return;
    p.ratingSum = (p.ratingSum || 0) + entry.rt;
    p.rated = (p.rated || 0) + 1;
    if (entry.motm) p.motm = (p.motm || 0) + 1;
}

function avgRating(p) {
    return p.rated ? p.ratingSum / p.rated : null;
}

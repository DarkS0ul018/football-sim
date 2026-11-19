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
    userTeamEliminated: false,
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

function isUserMatch(m) {
    return isCareer() && m.involves(state.userTeam);
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
                teamId: team.id, goals: 0, assists: 0, matches: 0, yellowCards: 0, redCards: 0
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

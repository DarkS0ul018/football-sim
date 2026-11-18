// ===== СОСТОЯНИЕ ИГРЫ И МОДЕЛИ =====

const state = {
    teams: [],              // все команды турнира (Team)
    matches: [],            // матчи текущего этапа (Match)
    groups: [],             // группы: массивы Team
    settings: {},           // count, mode, teamType, gameMode, simMode, groupLegs, playoffLegs
    tournamentHistory: [],  // раунды плей-офф: { round, roundIndex, matches }
    currentRound: 0,
    userTeam: null,         // команда игрока в карьере (Team)
    userTeamEliminated: false,
    champion: null,
    activeMatch: null       // открытый на экране матч (не сохраняется)
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
        this.isAutoSimulated = false;
        // Только на время матча, не сохраняются:
        this.squad1 = null;
        this.squad2 = null;
        this.stats = null;
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
    team.stats.played++;
    team.stats.gf += gf;
    team.stats.ga += ga;
    if (win === true) { team.stats.won++; team.stats.points += 3; }
    else if (win === false) team.stats.lost++;
    else { team.stats.drawn++; team.stats.points += 1; }
}

function sortGroup(group) {
    return group.sort((a, b) =>
        (b.stats.points - a.stats.points) ||
        ((b.stats.gf - b.stats.ga) - (a.stats.gf - a.stats.ga)) ||
        (b.stats.gf - a.stats.gf));
}

// ===== СТАТИСТИКА ИГРОКОВ =====
// ключ: `${teamId}-${номер}`
let playerStats = {};

function initPlayerStats() {
    playerStats = {};
    state.teams.forEach(team => {
        generateTeamSquad(team.name, team.id, true).forEach(player => {
            const id = `${team.id}-${player.number}`;
            playerStats[id] = {
                id, number: player.number, name: player.name, position: player.position,
                teamId: team.id, goals: 0, assists: 0, matches: 0
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

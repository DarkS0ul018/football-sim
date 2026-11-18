// ===== ТУРНИР: группы, плей-офф, переход между этапами =====

function getRoundName(count) {
    if (count === 2) return "Финал";
    if (count === 4) return "Полуфинал";
    if (count === 8) return "1/4 финала";
    if (count === 16) return "1/8 финала";
    if (count === 32) return "1/16 финала";
    return "1/" + (count / 2) + " финала";
}

function getRoundIndex(count) {
    // 3 = финал, 2 = полуфинал, 1 = 1/4, 0 = 1/8, -1 = 1/16
    return 3 - Math.log2(count / 2);
}

function getStageTitle() {
    if (state.settings.mode === 'groups') return 'Групповой этап';
    const last = state.tournamentHistory[state.tournamentHistory.length - 1];
    return last ? last.round : '';
}

// settings: { count, mode, teamType, gameMode, simMode, groupLegs, playoffLegs }
// teamsPool: [{ name, emoji, rating }]
function createTournament(settings, teamsPool, userTeamName = null) {
    state.settings = { ...settings };
    state.teams = teamsPool.map((d, i) => new Team(i, d.name, d.emoji, d.rating));
    state.matches = [];
    state.groups = [];
    state.groupMatches = [];
    state.tournamentHistory = [];
    state.currentRound = 0;
    state.userTeamEliminated = false;
    state.champion = null;
    state.activeMatch = null;
    state.userTeam = settings.gameMode === 'career'
        ? state.teams.find(t => t.name === userTeamName) || null
        : null;

    initPlayerStats();

    if (settings.mode === 'groups') createGroups();
    else createKnockoutRound(state.teams);
}

function createGroups() {
    const groupCount = state.settings.count / 4;
    state.groups = Array.from({ length: groupCount }, () => []);
    const shuffled = [...state.teams].sort(() => 0.5 - Math.random());
    shuffled.forEach((team, i) => state.groups[i % groupCount].push(team));

    state.matches = [];
    let id = 0;
    state.groups.forEach((group, gi) => {
        const letter = String.fromCharCode(65 + gi);
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                if (state.settings.groupLegs === 1) {
                    state.matches.push(new Match(id++, group[i], group[j], 1, 'group', `Группа ${letter}`, 0));
                } else {
                    state.matches.push(new Match(id++, group[i], group[j], 1, 'group', `Группа ${letter} (1)`, 0));
                    state.matches.push(new Match(id++, group[j], group[i], 1, 'group', `Группа ${letter} (2)`, 0));
                }
            }
        }
    });
}

// pairs: массив пар [Team, Team]; если не задан — команды перемешиваются
function createKnockoutRound(teams, pairs = null) {
    if (!pairs) {
        const shuffled = [...teams].sort(() => Math.random() - 0.5);
        pairs = [];
        for (let i = 0; i < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
    }
    const count = pairs.length * 2;
    const roundName = getRoundName(count);
    const roundIndex = getRoundIndex(count);
    const isFinal = count === 2;
    const legs = isFinal ? 1 : state.settings.playoffLegs;

    state.currentRound = roundIndex;
    state.matches = pairs.map((pair, i) => {
        const match = new Match(i, pair[0], pair[1], legs, 'playoff', roundName, roundIndex);
        match.isFinal = isFinal;
        return match;
    });
    state.tournamentHistory.push({ round: roundName, roundIndex, matches: state.matches });
}

// ----- Формат группового этапа -----
// Из групп по 4 выходят двое лучших + (если нужно) лучшие третьи, чтобы в плей-офф было 4/8/16 команд.
// 8 → 2 группы, 4 в плей-офф; 12 → 3 группы, 6 + 2 третьих = 8; 24 → 6 групп, 12 + 4 третьих = 16.
function getGroupFormat(count) {
    if (count < 8 || count % 4 !== 0) return null;
    const groups = count / 4;
    let qualifiers = 1;
    while (qualifiers < groups * 2) qualifiers *= 2;
    const thirds = qualifiers - groups * 2;
    if (thirds > groups) return null;
    return { groups, qualifiers, thirds };
}

// Кто проходит дальше: { [teamId]: 'winner' | 'runner' | 'third' }
function getQualification() {
    const format = getGroupFormat(state.settings.count) || { thirds: 0 };
    const result = {};
    const thirds = [];
    state.groups.forEach(group => {
        const sorted = sortGroup([...group]);
        result[sorted[0].id] = 'winner';
        result[sorted[1].id] = 'runner';
        if (sorted[2]) thirds.push(sorted[2]);
    });
    thirds.sort(compareAcrossGroups).slice(0, format.thirds).forEach(t => { result[t.id] = 'third'; });
    return result;
}

// Посев: победители групп играют с вторыми/третьими местами, команды из одной группы по возможности не встречаются
function createPlayoffPairsFromGroups() {
    state.groups.forEach(g => sortGroup(g));
    const groupOf = new Map();
    state.groups.forEach((g, i) => g.forEach(t => groupOf.set(t.id, i)));

    const q = getQualification();
    const byPlace = place => state.teams.filter(t => q[t.id] === place).sort(compareAcrossGroups);
    const seeds = [...byPlace('winner'), ...byPlace('runner'), ...byPlace('third')];

    const half = seeds.length / 2;
    const high = seeds.slice(0, half);
    const low = seeds.slice(half).reverse(); // сильнейший играет со слабейшим
    const clash = (i) => groupOf.get(high[i].id) === groupOf.get(low[i].id);
    for (let i = 0; i < half; i++) {
        if (!clash(i)) continue;
        for (let j = 0; j < half; j++) {
            if (j === i) continue;
            [low[i], low[j]] = [low[j], low[i]];
            if (!clash(i) && !clash(j)) break;
            [low[i], low[j]] = [low[j], low[i]];
        }
    }
    return high.map((t, i) => [t, low[i]]);
}

// Переходит к следующему этапу. Возвращает чемпиона, если турнир завершён.
function advanceStage() {
    if (state.settings.mode === 'groups') {
        const pairs = createPlayoffPairsFromGroups();
        state.groupMatches = state.matches;
        state.settings.mode = 'knockout';
        createKnockoutRound(null, pairs);
    } else {
        const winners = state.matches.map(m => m.winner).filter(Boolean);
        if (winners.length === 1) {
            state.champion = winners[0];
            return winners[0];
        }
        createKnockoutRound(winners);
    }
    // Если команда игрока не попала в новый этап — она выбыла
    if (isCareer() && state.userTeam && !state.matches.some(isUserMatch)) {
        state.userTeamEliminated = true;
    }
    return null;
}

// Доигрывает все оставшиеся этапы. Возвращает чемпиона.
function autoFinishTournament() {
    for (let guard = 0; guard < 20; guard++) {
        autoSimulateAllRemainingMatches();
        const champion = advanceStage();
        if (champion) return champion;
    }
    return null;
}

function isStageComplete() {
    return state.matches.length > 0 && state.matches.every(m => m.isFinished);
}

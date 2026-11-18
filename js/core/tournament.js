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

// Победитель группы X играет со вторым местом группы X+1
function createPlayoffPairsFromGroups() {
    state.groups.forEach(sortGroup);
    const n = state.groups.length;
    return state.groups.map((group, i) => [group[0], state.groups[(i + 1) % n][1]]);
}

// Переходит к следующему этапу. Возвращает чемпиона, если турнир завершён.
function advanceStage() {
    if (state.settings.mode === 'groups') {
        const pairs = createPlayoffPairsFromGroups();
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

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

// Текущий тур (для лиги и групп): наименьший тур с несыгранными матчами
function getCurrentMatchday() {
    const pending = state.matches.filter(m => !m.isFinished && m.matchday);
    return pending.length ? Math.min(...pending.map(m => m.matchday)) : null;
}

function getTotalMatchdays() {
    return Math.max(0, ...state.matches.map(m => m.matchday || 0));
}

function isRoundRobinStage() {
    return state.settings.mode === 'groups' || state.settings.mode === 'league';
}

// Формат «Чемпионат + плей-офф»: сначала лига, потом лучшие играют на вылет
function isLeagueWithPlayoff() {
    return state.settings.originalMode === 'leaguePlayoff' || state.settings.originalMode === 'ucl';
}

function getStageTitle() {
    if (state.settings.mode === 'league') {
        const md = getCurrentMatchday();
        const name = state.settings.ucl ? 'Общий этап' : (isLeagueWithPlayoff() ? 'Чемпионат' : 'Лига');
        return md ? `${name} · тур ${md} из ${getTotalMatchdays()}` : `${name} · завершён`;
    }
    if (state.settings.mode === 'groups') {
        const md = getCurrentMatchday();
        return md ? `Групповой этап · тур ${md}` : 'Групповой этап';
    }
    const last = state.tournamentHistory[state.tournamentHistory.length - 1];
    return last ? last.round : '';
}

// settings: { count, mode, teamType, gameMode, simMode, groupLegs, playoffLegs }
// teamsPool: [{ name, emoji, rating }]
function createTournament(settings, teamsPool, userTeamName = null) {
    state.settings = { ...settings, originalMode: settings.originalMode || settings.mode };
    state.seasonRecorded = false;
    state.hallRecorded = false;
    state.seriesProcessed = false;
    state.stageDone = false;
    state.uclPhase = null;
    state.uclRanking = null;
    state.teams = teamsPool.map((d, i) => new Team(i, d.name, d.emoji, d.rating));
    state.matches = [];
    state.groups = [];
    state.groupMatches = [];
    state.tournamentHistory = [];
    state.currentRound = 0;
    state.userTeamEliminated = false;
    state.champion = null;
    state.activeMatch = null;
    // userTeamName: имя команды игрока (карьера) или массив из двух имён («Вдвоём»)
    const names = Array.isArray(userTeamName) ? userTeamName : (userTeamName ? [userTeamName] : []);
    const humans = settings.gameMode === 'career' || settings.gameMode === 'duo'
        ? names.map(n => state.teams.find(t => t.name === n)).filter(Boolean) : [];
    state.userTeams = settings.gameMode === 'duo' ? humans : [];
    state.userTeam = humans[0] || null;
    state.eliminated = [];

    // Фиксируем составы участников на весь турнир
    // (в карьере — с учётом развития игроков и трансферов из прошлых сезонов)
    // Сборные: составы из редактора, без трансферов и развития клубной карьеры
    if (settings.gameMode === 'career' && names[0] && !settings.seriesId && !(typeof NATION_CUPS !== 'undefined' && NATION_CUPS[settings.teamType])) activateCareerPlayers(names[0]);
    else careerPlayers = null;
    state.rosters = null;
    const rosters = {};
    state.teams.forEach(t => { rosters[t.name] = getTeamRoster(t.name, teamRatings[t.name] ?? t.rating); });
    state.rosters = rosters;
    // Рейтинг команды в турнире — по её лучшим одиннадцати (звёзды поднимают, без лидеров — ниже)
    state.teams.forEach(t => { if (rosters[t.name] && rosters[t.name].length) t.rating = rosterTeamRating(rosters[t.name]); });

    initPlayerStats();
    initSquads();

    if (settings.mode === 'ucl') {
        // Лига чемпионов: общий этап на 36 клубов (js/core/ucl.js)
        state.settings.mode = 'league';
        state.settings.ucl = true;
        createUclLeague();
    }
    else if (settings.mode === 'leaguePlayoff') {
        state.settings.mode = 'league';
        state.settings.seeded = true;
        createLeague();
    }
    else if (settings.mode === 'groups') createGroups();
    else if (settings.mode === 'league') createLeague();
    else if (settings.presetPairs) {
        // Серия: стыковые пары заданы заранее (первая команда принимает во втором матче)
        const byName = n => state.teams.find(t => t.name === n);
        createKnockoutRound(null, settings.presetPairs.map(([a, b]) => [byName(a), byName(b)]));
    }
    else createKnockoutRound(state.teams);

    // Карьера в лиге: параллельно с чемпионатом разыгрывается кубок
    state.cup = null;
    if (cupEnabled(state.settings)) createCup();
    newsSeasonStart();
}

// Круговая система «каждый с каждым» (метод вращения): массив туров, в каждом — пары [хозяин, гость]
function roundRobinRounds(teams, legs = 1) {
    const list = [...teams];
    if (list.length % 2) list.push(null);
    const n = list.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
        const pairs = [];
        for (let i = 0; i < n / 2; i++) {
            const a = list[i], b = list[n - 1 - i];
            if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]); // чередуем хозяев
        }
        rounds.push(pairs);
        list.splice(1, 0, list.pop());
    }
    if (legs === 2) rounds.push(...rounds.map(pairs => pairs.map(([a, b]) => [b, a])));
    return rounds;
}

function createGroups() {
    // Серия: группы заданы заранее (посев по корзинам, группы могут быть по 3–5 команд)
    if (state.settings.presetGroups) {
        const byName = n => state.teams.find(t => t.name === n);
        state.groups = state.settings.presetGroups.map(g => g.map(byName).filter(Boolean));
    } else {
        const groupCount = state.settings.count / 4;
        state.groups = Array.from({ length: groupCount }, () => []);
        const shuffled = [...state.teams].sort(() => 0.5 - Math.random());
        shuffled.forEach((team, i) => state.groups[i % groupCount].push(team));
    }

    state.matches = [];
    let id = 0;
    state.groups.forEach((group, gi) => {
        const letter = String.fromCharCode(65 + gi);
        roundRobinRounds(group, state.settings.groupLegs).forEach((pairs, r) => {
            pairs.forEach(([home, away]) => {
                const m = new Match(id++, home, away, 1, 'group', `Группа ${letter} · тур ${r + 1}`, 0);
                m.matchday = r + 1;
                state.matches.push(m);
            });
        });
    });
    state.matches.sort((a, b) => a.matchday - b.matchday);
}

// Лига: одна таблица на всех, без плей-офф
function createLeague() {
    state.groups = [[...state.teams]];
    state.matches = [];
    let id = 0;
    roundRobinRounds(state.teams, state.settings.groupLegs).forEach((pairs, r) => {
        pairs.forEach(([home, away]) => {
            const m = new Match(id++, home, away, 1, 'group', `Тур ${r + 1}`, 0);
            m.matchday = r + 1;
            state.matches.push(m);
        });
    });
}

// pairs: массив пар [Team, Team]; если не задан — команды перемешиваются
function createKnockoutRound(teams, pairs = null, title = null) {
    if (!pairs && state.settings.seeded) {
        // Посеянная сетка: победители соседних пар встречаются друг с другом
        pairs = [];
        for (let i = 0; i < teams.length; i += 2) pairs.push([teams[i], teams[i + 1]]);
    }
    if (!pairs) {
        const shuffled = [...teams].sort(() => Math.random() - 0.5);
        pairs = [];
        for (let i = 0; i < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
    }
    // Кубок: клуб из лиги ниже принимает у себя
    if (state.settings.lowerHosts) pairs = pairs.map(([a, b]) => (FNL_CLUBS.has(b.name) && !FNL_CLUBS.has(a.name) ? [b, a] : [a, b]));
    const count = pairs.length * 2;
    const roundName = title || (state.settings.pairsTitle && state.settings.presetPairs && !state.tournamentHistory.length ? state.settings.pairsTitle : getRoundName(count));
    const roundIndex = getRoundIndex(count);
    const isFinal = count === 2 && !state.settings.stageOnly;
    const legs = isFinal ? 1 : state.settings.playoffLegs;

    // Как на ЧМ и ЧЕ: перед полуфиналами накопленные жёлтые сгорают (дисквалификации остаются)
    if (count === 4 && state.squads) {
        Object.values(state.squads).forEach(sq => Object.values(sq.players || {}).forEach(p => { p.yellowAcc = 0; }));
    }

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

// Порядок посева для сетки на n команд: [1, 8, 4, 5, 2, 7, 3, 6] — сильнейшие встречаются как можно позже
function seedOrder(n) {
    let order = [1, 2];
    while (order.length < n) {
        const size = order.length * 2;
        order = order.flatMap(s => [s, size + 1 - s]);
    }
    return order;
}

// Сколько команд из чемпионата выходит в плей-офф (4, 8 или 16, но не больше половины участников)
function getLeaguePlayoffSize(count = state.settings.count, wanted = state.settings.playoffSize) {
    let size = wanted || 8;
    while (size > 2 && size > count / 2 + 0.01 && size > 4) size /= 2;
    return Math.min(size, count);
}

// Пары плей-офф по итогам чемпионата: 1-й против последнего прошедшего и т.д.
function createPlayoffPairsFromLeague() {
    const table = sortGroup([...state.teams]);
    const size = getLeaguePlayoffSize();
    const order = seedOrder(size).map(seed => table[seed - 1]);
    const pairs = [];
    for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
    return pairs;
}

// Переходит к следующему этапу. Возвращает чемпиона, если турнир завершён.
function advanceStage() {
    // Этап серии (отбор, стыки): после него турнир заканчивается — дальше решает серия
    if (state.settings.stageOnly) {
        state.stageDone = true;
        const w = state.settings.mode === 'knockout' ? (state.matches.find(m => m.winner) || {}).winner : sortGroup([...state.groups[0]])[0];
        state.champion = w || state.teams[0];
        return state.champion;
    }
    // Лига чемпионов: общий этап → стыковой раунд → 1/8 по местам в таблице
    if (isUcl() && state.settings.mode === 'league') { uclStartPlayoffRound(); return null; }
    if (isUcl() && state.uclPhase === 'playoff') { uclStartRoundOf16(); return null; }
    if (state.settings.mode === 'league' && isLeagueWithPlayoff()) {
        const pairs = createPlayoffPairsFromLeague();
        state.groupMatches = state.matches;
        state.settings.mode = 'knockout';
        createKnockoutRound(null, pairs);
        humanTeams().forEach(t => { if (!state.matches.some(m => m.involves(t))) markEliminated(t); });
        return null;
    }
    if (state.settings.mode === 'league') {
        finishCupAuto(); // сезон заканчивается — кубок доигран
        state.champion = sortGroup([...state.teams])[0];
        return state.champion;
    }
    if (state.settings.mode === 'groups') {
        const pairs = createPlayoffPairsFromGroups();
        state.groupMatches = state.matches;
        state.settings.mode = 'knockout';
        createKnockoutRound(null, pairs);
    } else {
        const winners = state.matches.map(m => m.winner).filter(Boolean);
        if (winners.length === 1) {
            finishCupAuto();
            state.champion = winners[0];
            return winners[0];
        }
        // Сетка без новой жеребьёвки: победители соседних пар встречаются друг с другом
        const next = [];
        for (let i = 0; i + 1 < winners.length; i += 2) next.push([winners[i], winners[i + 1]]);
        createKnockoutRound(null, next);
    }
    // Если команда игрока не попала в новый этап — она выбыла
    humanTeams().forEach(t => { if (!state.matches.some(m => m.involves(t))) markEliminated(t); });
    return null;
}

// Доигрывает все оставшиеся этапы. Возвращает чемпиона.
function autoFinishTournament() {
    finishCupAuto();
    for (let guard = 0; guard < 20; guard++) {
        autoSimulateAllRemainingMatches();
        const champion = advanceStage();
        if (champion) return champion;
    }
    return null;
}

// Починка сохранений, «зависших» из-за двойного нажатия «Следующий раунд» (пустой раунд плей-офф):
// возвращаемся к последнему настоящему раунду, дальше турнир идёт как обычно
function repairEmptyStage() {
    if (state.champion || state.settings.mode !== 'knockout' || state.matches.length) return;
    const hist = state.tournamentHistory || [];
    while (hist.length && !hist[hist.length - 1].matches.length) hist.pop();
    const last = hist[hist.length - 1];
    if (!last) return;
    state.matches = last.matches;
    state.currentRound = last.roundIndex;
}

function isStageComplete() {
    return state.matches.length > 0 && state.matches.every(m => m.isFinished);
}

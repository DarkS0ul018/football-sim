// ===== КУБОК (карьера): турнир на вылет параллельно с чемпионатом =====
// Участвуют все команды лиги. Раунды вставлены между турами чемпионата: пока раунд кубка
// «созрел», следующий тур лиги не начинается. Составы, усталость, травмы и мораль — общие с лигой;
// очки, таблица и бомбардиры лиги кубковые матчи не затрагивают.

const CUP_NAME = 'Кубок';

function cupEnabled(settings) {
    const mode = settings.originalMode || settings.mode;
    // В серии РПЛ кубок тоже идёт параллельно с чемпионатом (сезон по календарю)
    const seriesOk = !settings.seriesId || (settings.seriesType === 'rpl' && settings.seriesPhase === 'league' && settings.teamType === 'russia');
    return settings.gameMode === 'career' && seriesOk && (mode === 'league' || mode === 'leaguePlayoff') && state.teams.length >= 6;
}

function createCup() {
    const teams = [...state.teams];
    const n = teams.length;
    let size = 1;
    while (size * 2 <= n) size *= 2;
    const prelim = n > size;
    state.cup = {
        rounds: [],
        byes: [],                 // сильнейшие пропускают предварительный раунд
        winner: null,
        userOut: false,
        scorers: {},              // бомбардиры кубка: «teamId-номер» → { name, teamId, goals, assists }
        totalRounds: Math.log2(size) + (prelim ? 1 : 0),
        leagueDays: getTotalMatchdays()
    };
    if (prelim) {
        // Предварительный раунд: слабейшие 2·(n − size) команд, остальные ждут в 1/… финала
        const sorted = teams.sort((a, b) => b.rating - a.rating);
        const playIn = 2 * (n - size);
        state.cup.byes = sorted.slice(0, n - playIn).map(t => t.id);
        createCupRound(sorted.slice(n - playIn), 'Предварительный раунд', -2);
    } else {
        createCupRound(teams, getRoundName(size), getRoundIndex(size));
    }
}

// После какого тура лиги играется раунд кубка: раунды равномерно по сезону, финал — до последнего тура
function cupRoundAfter(k) {
    const c = state.cup;
    return Math.max(1, Math.floor(c.leagueDays * (k + 1) / (c.totalRounds + 1)));
}

function createCupRound(teams, name, roundIndex) {
    const c = state.cup;
    const shuffled = [...teams].sort(() => Math.random() - 0.5); // жеребьёвка
    const isFinal = teams.length === 2;
    const k = c.rounds.length;
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
        const m = new Match(1000 + k * 100 + i / 2, shuffled[i], shuffled[i + 1], 1, 'playoff', `${CUP_NAME} · ${name}`, roundIndex);
        m.cup = true;
        m.isFinal = isFinal;
        matches.push(m);
    }
    c.rounds.push({ name, roundIndex, after: cupRoundAfter(k), matches });
}

function currentCupRound() {
    const c = state.cup;
    return c && !c.winner ? c.rounds[c.rounds.length - 1] : null;
}

// Раунд кубка, который пора играть (иначе — null)
function cupDueRound() {
    const r = currentCupRound();
    if (!r || r.matches.every(m => m.isFinished)) return null;
    if (state.settings.mode === 'league') {
        const md = getCurrentMatchday();
        if (md !== null && md <= r.after) return null; // ещё не доиграны туры до этого раунда
    }
    return r;
}

function userCupMatch() {
    const r = cupDueRound();
    return r && state.userTeam ? r.matches.find(m => !m.isFinished && m.involves(state.userTeam)) || null : null;
}

// Раунд сыгран — жеребьёвка следующего (или кубок разыгран)
function advanceCup() {
    const c = state.cup;
    const r = currentCupRound();
    if (!r || !r.matches.every(m => m.isFinished)) return;
    const user = state.userTeam;
    if (user && r.matches.some(m => m.involves(user) && m.winner !== user)) c.userOut = true;
    let winners = r.matches.map(m => m.winner).filter(Boolean);
    if (c.byes.length) {
        winners = [...c.byes.map(id => state.teams.find(t => t.id === id)), ...winners];
        c.byes = [];
    }
    if (winners.length <= 1) { c.winner = winners[0] || null; return; } // новость о победителе — в newsFromMatch
    createCupRound(winners, getRoundName(winners.length), getRoundIndex(winners.length));
    try { newsCupDraw(); } catch (e) { /* ignore */ }
}

// Досчитывает матчи раунда без команды игрока
function playCupAI() {
    const r = cupDueRound();
    if (!r) return;
    r.matches.forEach(m => { if (!m.isFinished && !(isCareer() && m.involves(state.userTeam))) autoSimulateMatch(m); });
    advanceCup();
}

// Догоняет кубок: раунды без игрока играются сами, пока не дойдёт до его матча или до будущих туров
function catchUpCup() {
    if (!state.cup) return;
    advanceCup();
    for (let guard = 0; guard < 10 && cupDueRound() && !userCupMatch(); guard++) playCupAI();
}

// Доиграть кубок целиком (конец сезона, автодосчёт)
function finishCupAuto() {
    const c = state.cup;
    for (let guard = 0; c && !c.winner && guard < 12; guard++) {
        const r = currentCupRound();
        r.matches.forEach(m => { if (!m.isFinished) autoSimulateMatch(m); });
        advanceCup();
    }
}

function addCupStat(teamId, number, field) {
    if (field !== 'goals' && field !== 'assists') return;
    const c = state.cup;
    const key = `${teamId}-${number}`;
    if (!c.scorers[key]) {
        const base = playerStats[key] || {};
        c.scorers[key] = { name: base.name || `#${number}`, teamId, number, goals: 0, assists: 0 };
    }
    c.scorers[key][field]++;
}

// Как команда игрока выступила в кубке: { text, trophy, final }
function userCupResult() {
    const c = state.cup;
    const user = state.userTeam;
    if (!c || !user) return null;
    if (c.winner && c.winner.id === user.id) return { text: '🏆 Обладатель кубка', trophy: true, final: true };
    const played = c.rounds.filter(r => r.matches.some(m => m.involves(user)));
    const last = played[played.length - 1];
    if (!last) return { text: 'Кубок: не играли', trophy: false, final: false };
    const m = last.matches.find(x => x.involves(user));
    if (!m.isFinished) return { text: `Кубок: ${last.name}`, trophy: false, final: false };
    if (last.matches.length === 1) return { text: '🥈 Финал кубка', trophy: false, final: true };
    return { text: `Кубок: вылет, ${last.name}`, trophy: false, final: false };
}

// ----- Сохранение -----
function serializeCup() {
    const c = state.cup;
    if (!c) return null;
    return { ...c, winner: c.winner ? c.winner.id : null, rounds: c.rounds.map(r => ({ ...r, matches: r.matches.map(serializeMatch) })) };
}

function deserializeCup(d, teamById) {
    if (!d) return null;
    return {
        ...d,
        winner: d.winner === null || d.winner === undefined ? null : teamById(d.winner),
        rounds: d.rounds.map(r => ({ ...r, matches: r.matches.map(md => Object.assign(deserializeMatch(md, teamById), { cup: true })) }))
    };
}

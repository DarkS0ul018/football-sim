// ===== ЛИГА ЧЕМПИОНОВ: формат с 2024 года =====
// Общий этап: 36 клубов в одной таблице, 4 корзины по 9. У каждого 8 разных соперников — по два из каждой корзины
// (один дома, один в гостях), с клубами своей страны не играет. Туры: в каждом все 36 играют по матчу.
// Плей-офф: 1–8 места — сразу в 1/8 финала, 9–24 — стыковой раунд (два матча), 25–36 выбывают.
// Пары 1/8: 1–2 места против победителей стыков 15/16–17/18, 3–4 — 13/14–19/20, 5–6 — 11/12–21/22, 7–8 — 9/10–23/24.
// Дальше сетка без новой жеребьёвки, финал — один матч.

const UCL_TEAMS = 36;
const CLUB_COUNTRY = {
    'Арсенал': 'ENG', 'Ливерпуль': 'ENG', 'Тоттенхэм': 'ENG', 'Челси': 'ENG', 'Манчестер Сити': 'ENG', 'Манчестер Юнайтед': 'ENG',
    'Астон Вилла': 'ENG', 'Ньюкасл': 'ENG',
    'Барселона': 'ESP', 'Реал Мадрид': 'ESP', 'Атлетико': 'ESP', 'Бетис': 'ESP', 'Севилья': 'ESP', 'Валенсия': 'ESP', 'Осасуна': 'ESP',
    'Жирона': 'ESP', 'Вильярреал': 'ESP', 'Атлетик': 'ESP',
    'Бавария': 'GER', 'Боруссия Д': 'GER', 'Айнтрахт': 'GER', 'Байер': 'GER', 'РБ Лейпциг': 'GER',
    'Интер': 'ITA', 'Рома': 'ITA', 'Наполи': 'ITA', 'Аталанта': 'ITA', 'Фиорентина': 'ITA', 'Милан': 'ITA', 'Ювентус': 'ITA', 'Лацио': 'ITA',
    'ПСЖ': 'FRA', 'Ницца': 'FRA', 'Марсель': 'FRA', 'Монако': 'FRA',
    'Бенфика': 'POR', 'Спортинг': 'POR', 'Порту': 'POR',
    'Аякс': 'NED', 'Фейеноорд': 'NED', 'ПСВ': 'NED',
    'Брюгге': 'BEL', 'Галатасарай': 'TUR', 'Фенербахче': 'TUR', 'Селтик': 'SCO'
};
const countryOf = name => CLUB_COUNTRY[name] || ('X:' + name); // своя команда — «отдельная страна»

// Участники: сильнейшие европейские клубы, не больше 5 от страны (как по квотам), остаток — по рейтингу
function uclParticipants() {
    const pool = [...getTeamsData('world').names].sort((a, b) => (teamRatings[b] ?? 70) - (teamRatings[a] ?? 70));
    const out = [], per = {};
    for (const limit of [5, 6, 99]) {
        for (const n of pool) {
            if (out.length >= UCL_TEAMS) break;
            const c = countryOf(n);
            if (out.includes(n) || (per[c] || 0) >= limit) continue;
            out.push(n);
            per[c] = (per[c] || 0) + 1;
        }
    }
    return out.slice(0, UCL_TEAMS);
}

function uclShuffle(a) {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

// Жеребьёвка: список матчей [хозяин, гость] (объекты Team)
function uclDraw(teams) {
    const sorted = [...teams].sort((a, b) => b.rating - a.rating);
    const pots = [0, 1, 2, 3].map(i => sorted.slice(i * 9, i * 9 + 9));
    for (let attempt = 0; attempt < 400; attempt++) {
        const strict = attempt < 300; // сначала — без матчей клубов одной страны
        const games = [];
        let ok = true;
        const clash = (a, b) => strict && countryOf(a.name) === countryOf(b.name);
        for (let i = 0; i < 4 && ok; i++) {
            for (let j = i; j < 4 && ok; j++) {
                const A = pots[i], B = pots[j];
                if (i === j) {
                    // Внутри корзины: перестановка без неподвижных точек и без пар «туда-обратно»
                    let found = null;
                    for (let t = 0; t < 300 && !found; t++) {
                        const p = uclShuffle([...Array(9).keys()]);
                        if (p.every((x, k) => x !== k && p[x] !== k && !clash(A[k], A[x]))) found = p;
                    }
                    if (!found) { ok = false; break; }
                    found.forEach((x, k) => games.push([A[k], A[x]]));
                } else {
                    // Между корзинами: две перестановки — кому из B клуб A ездит в гости и кого принимает
                    let found = null;
                    for (let t = 0; t < 400 && !found; t++) {
                        const s = uclShuffle([...Array(9).keys()]), r = uclShuffle([...Array(9).keys()]);
                        if (s.every((x, k) => x !== r[k] && !clash(A[k], B[x]) && !clash(A[k], B[r[k]]))) found = [s, r];
                    }
                    if (!found) { ok = false; break; }
                    const [s, r] = found;
                    s.forEach((x, k) => games.push([A[k], B[x]]));   // A принимает
                    r.forEach((x, k) => games.push([B[x], A[k]]));   // A в гостях
                }
            }
        }
        if (ok) return games;
    }
    return null;
}

// Расписание: в каждом туре все 36 играют по одному матчу (8 туров).
// Тур за туром подбираем пары: первой ставим команду, у которой меньше всего вариантов, — так не «застреваем».
function uclSchedule(games) {
    const n = new Set(games.flat().map(t => t.id)).size;
    const free = (used, i) => !used.has(games[i][0].id) && !used.has(games[i][1].id);
    for (let attempt = 0; attempt < 600; attempt++) {
        let left = games.map((g, i) => i);
        const plan = [];
        let ok = true;
        for (let day = 1; left.length && ok; day++) {
            let found = null;
            for (let t = 0; t < 60 && !found; t++) {
                const adj = new Map();
                left.forEach(i => games[i].forEach(team => { if (!adj.has(team.id)) adj.set(team.id, []); adj.get(team.id).push(i); }));
                const used = new Set(), chosen = [];
                let fail = false;
                while (used.size < adj.size) {
                    let best = null, bestCnt = Infinity;
                    for (const [v, es] of adj) {
                        if (used.has(v)) continue;
                        const c = es.filter(i => free(used, i)).length;
                        if (c < bestCnt || (c === bestCnt && Math.random() < 0.5)) { best = v; bestCnt = c; }
                    }
                    if (best === null) break;
                    if (bestCnt === 0) { fail = true; break; }
                    const other = i => (games[i][0].id === best ? games[i][1] : games[i][0]).id;
                    const score = i => adj.get(other(i)).filter(j => free(used, j)).length + Math.random() * 0.5;
                    const e = adj.get(best).filter(i => free(used, i)).sort((x, y) => score(x) - score(y))[0];
                    used.add(games[e][0].id); used.add(games[e][1].id);
                    chosen.push(e);
                }
                if (!fail && chosen.length * 2 === adj.size) found = chosen;
            }
            if (!found || day > 8) { ok = false; break; }
            const set = new Set(found);
            found.forEach(i => plan.push([games[i], day]));
            left = left.filter(i => !set.has(i));
        }
        if (ok) return plan;
    }
    // Запасной вариант (почти не бывает): жадно, туров может быть больше восьми
    const busy = [];
    return games.map(g => {
        let d = busy.findIndex(s => !s.has(g[0].id) && !s.has(g[1].id));
        if (d === -1) { busy.push(new Set()); d = busy.length - 1; }
        busy[d].add(g[0].id); busy[d].add(g[1].id);
        return [g, d + 1];
    });
}

// Общий этап (вызывается из createTournament)
function createUclLeague() {
    state.groups = [[...state.teams]];
    state.matches = [];
    state.uclPhase = 'league';
    state.uclRanking = null;
    const games = uclDraw(state.teams) || roundRobinRounds(state.teams, 1).flat().slice(0, 144);
    let id = 0;
    uclSchedule(games).forEach(([[home, away], day]) => {
        const m = new Match(id++, home, away, 1, 'group', `Общий этап · тур ${day}`, 0);
        m.matchday = day;
        state.matches.push(m);
    });
    state.matches.sort((a, b) => a.matchday - b.matchday);
}

// Места в таблице общего этапа: 'r16' (1–8), 'playoff' (9–24), 'out' (25–36)
function uclZone(place) {
    return place <= 8 ? 'r16' : (place <= 24 ? 'playoff' : 'out');
}

// После общего этапа — стыковой раунд за выход в 1/8
function uclStartPlayoffRound() {
    const table = sortGroup([...state.teams]);
    state.uclRanking = table.map(t => t.id);
    state.groupMatches = state.matches;
    state.settings.mode = 'knockout';
    state.uclPhase = 'playoff';
    const pairs = [];
    for (let k = 0; k < 4; k++) {
        const high = uclShuffle([table[8 + 2 * k], table[9 + 2 * k]]);
        const low = [table[23 - 2 * k], table[22 - 2 * k]];
        high.forEach((h, i) => pairs.push([low[i], h])); // клуб выше в таблице принимает ответный матч
    }
    createKnockoutRound(null, pairs, 'Стыковой раунд');
    state.tournamentHistory[state.tournamentHistory.length - 1].roundIndex = -1;
    state.matches.forEach(m => { m.roundIndex = -1; });
    // Свои команды на 25–36 местах — выбыли; на 1–8 — ждут 1/8 финала
    humanTeams().forEach(t => { if (table.indexOf(t) >= 24) markEliminated(t); });
}

// После стыкового раунда — 1/8 финала по местам в таблице
function uclStartRoundOf16() {
    const byId = id => state.teams.find(t => t.id === id);
    const rank = state.uclRanking.map(byId);
    const winners = state.matches.map(m => m.winner);           // по порядку: k = 0..3, по две пары
    const seedsFor = [[rank[6], rank[7]], [rank[4], rank[5]], [rank[2], rank[3]], [rank[0], rank[1]]];
    const vs = {};                                               // место (0..7) → соперник
    for (let k = 0; k < 4; k++) {
        const seeds = uclShuffle(seedsFor[k]);
        [winners[2 * k], winners[2 * k + 1]].forEach((w, i) => { vs[rank.indexOf(seeds[i])] = w; });
    }
    // Сетка: 1 и 2 места — в разных половинах, встретиться могут только в финале
    const order = [0, 7, 3, 4, 1, 6, 2, 5];
    const pairs = order.map(p => [vs[p], rank[p]]);
    state.settings.seeded = true;
    state.uclPhase = 'knockout';
    createKnockoutRound(null, pairs);
    humanTeams().forEach(t => { if (!state.matches.some(m => m.involves(t))) markEliminated(t); });
}

function isUcl() {
    return !!(state.settings && state.settings.ucl);
}

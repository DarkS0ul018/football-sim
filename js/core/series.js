// ===== СЕРИИ: турниры, которые продолжаются =====
// РПЛ: вылет и стыки — сезон за сезоном: 15–16 места вылетают в Первую лигу, 1–2 места оттуда поднимаются,
//   13–14 места играют стыки с 4-м и 3-м местом Первой лиги.
// Еврокубок по сезонам — 24 лучших остаются, 8 мест разыгрываются в отборочных стыках.
// Сборные: отбор → стыки → ЧЕ или ЧМ (по очереди); вне Европы в год ЧЕ — Кубок Америки.
// Этап, где играет ваша команда (или главный, если вы смотрите), идёт обычным турниром с живыми матчами;
// остальное (другая лига, отбор на других континентах) считается быстро «за кадром».
// Состояние серии хранится в её слоте сохранения (storage.js), рядом с текущим турниром. Здесь нет DOM.

const SERIES_TYPES = {
    rpl: { title: 'РПЛ: вылет и стыки', icon: '🏟️' },
    euro: { title: 'Еврокубок по сезонам', icon: '🏆' },
    nations: { title: 'Сборные: отбор и турниры', icon: '🌍' }
};

const CONFEDS = {
    UEFA: ['Германия', 'Франция', 'Испания', 'Англия', 'Португалия', 'Нидерланды', 'Италия', 'Бельгия', 'Хорватия', 'Швейцария',
        'Дания', 'Австрия', 'Турция', 'Норвегия', 'Сербия', 'Россия', 'Польша', 'Чехия', 'Шотландия', 'Венгрия', 'Грузия', 'Словакия',
        'Словения', 'Румыния', 'Албания', 'Швеция', 'Греция', 'Уэльс', 'Ирландия', 'Босния и Герцеговина', 'Северная Ирландия',
        'Финляндия', 'Израиль', 'Исландия', 'Северная Македония', 'Черногория', 'Болгария', 'Армения', 'Казахстан'],
    CONMEBOL: ['Аргентина', 'Бразилия', 'Уругвай', 'Колумбия', 'Эквадор', 'Парагвай', 'Чили', 'Венесуэла', 'Перу', 'Боливия'],
    CONCACAF: ['Мексика', 'США', 'Канада', 'Панама', 'Коста-Рика', 'Ямайка', 'Гондурас'],
    AFC: ['Япония', 'Южная Корея', 'Иран', 'Австралия', 'Саудовская Аравия', 'Катар', 'Узбекистан', 'Ирак', 'Иордания'],
    CAF: ['Марокко', 'Сенегал', "Кот-д'Ивуар", 'Нигерия', 'Египет', 'Алжир', 'Тунис', 'Камерун', 'Гана', 'ЮАР', 'Мали'],
    OFC: ['Новая Зеландия']
};
const CONFED_NAMES = { UEFA: 'Европа', CONMEBOL: 'Южная Америка', CONCACAF: 'Северная и Центральная Америка', AFC: 'Азия', CAF: 'Африка', OFC: 'Океания' };

function confedMembers(c) {
    return CONFEDS[c].filter(n => typeof NATIONS !== 'undefined' && NATIONS[n]);
}

function confedOf(name) {
    return Object.keys(CONFEDS).find(c => CONFEDS[c].includes(name)) || null;
}

const ratingOf = n => teamRatings[n] ?? (typeof NATIONS !== 'undefined' && NATIONS[n] ? NATIONS[n].rating : 70);
const byRating = list => [...list].sort((a, b) => ratingOf(b) - ratingOf(a));
const shuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ----- Быстрый счёт для матчей «за кадром» -----
function poisson(lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L && k < 12);
    return k - 1;
}

function quickMatch(home, away) {
    const d = (ratingOf(home) - ratingOf(away)) / 10;
    return [poisson(1.45 * Math.exp(0.3 * d)), poisson(1.15 * Math.exp(-0.3 * d))];
}

// Таблица круговой системы: [{ name, p, w, d, l, gf, ga, pts }] от первого места к последнему
function quickTable(names, legs = 2) {
    const row = {};
    names.forEach(n => { row[n] = { name: n, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
    const play = (a, b) => {
        const [x, y] = quickMatch(a, b);
        const A = row[a], B = row[b];
        A.p++; B.p++; A.gf += x; A.ga += y; B.gf += y; B.ga += x;
        if (x > y) { A.w++; B.l++; A.pts += 3; } else if (x < y) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
    };
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        play(names[i], names[j]);
        if (legs === 2) play(names[j], names[i]);
    }
    return sortRows(Object.values(row));
}

function sortRows(rows) {
    return rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || ratingOf(b.name) - ratingOf(a.name));
}

// Сравнение команд из разных групп (группы бывают разного размера): очки и разница за матч
function sortAcross(rows) {
    return [...rows].sort((a, b) => b.pts / Math.max(1, b.p) - a.pts / Math.max(1, a.p) || (b.gf - b.ga) / Math.max(1, b.p) - (a.gf - a.ga) / Math.max(1, a.p) || b.gf - a.gf);
}

// Пара из двух матчей «за кадром»: победитель и счёт
function quickTie(a, b) {
    const [x1, y1] = quickMatch(a, b), [y2, x2] = quickMatch(b, a);
    const ta = x1 + x2, tb = y1 + y2;
    let winner = ta > tb ? a : (tb > ta ? b : null), pens = '';
    if (!winner) { winner = Math.random() < ratingOf(a) / (ratingOf(a) + ratingOf(b)) ? a : b; pens = ' (пен.)'; }
    return { winner, loser: winner === a ? b : a, text: `${a} ${ta}:${tb} ${b}${pens}` };
}

// Целый турнир «за кадром»: группы по 4 → 16 лучших → плей-офф. Возвращает чемпиона и финалиста.
function quickTournament(names) {
    const groups = seedGroups(names, Math.max(1, Math.round(names.length / 4)));
    const tables = groups.map(g => quickTable(g, 1));
    const firsts = tables.map(t => t[0]), seconds = tables.map(t => t[1]).filter(Boolean);
    const rest = sortAcross(tables.flatMap(t => t.slice(2)));
    let alive = [...firsts, ...seconds, ...rest].slice(0, 16).map(r => r.name);
    let final = null;
    while (alive.length > 1) {
        const next = [];
        for (let i = 0; i < alive.length / 2; i++) {
            const a = alive[i], b = alive[alive.length - 1 - i];
            const [x, y] = quickMatch(a, b);
            const w = x > y ? a : (y > x ? b : (Math.random() < 0.5 ? a : b));
            next.push(w);
            if (alive.length === 2) final = { winner: w, loser: w === a ? b : a };
        }
        alive = next;
    }
    return final || { winner: alive[0], loser: null };
}

// Посев по корзинам: сильнейшие разведены по разным группам
function seedGroups(names, groupCount) {
    const sorted = byRating(names);
    const groups = Array.from({ length: groupCount }, () => []);
    for (let i = 0; i < sorted.length; i += groupCount) {
        shuffle(sorted.slice(i, i + groupCount)).forEach((n, k) => groups[k].push(n));
    }
    return groups.filter(g => g.length);
}

// Сильный против слабого: 1-й с последним, 2-й с предпоследним… (сеяный — первым, он принимает во втором матче)
function seededPairs(names) {
    const s = byRating(names);
    const half = Math.floor(s.length / 2);
    const top = s.slice(0, half), low = shuffle(s.slice(half, half * 2));
    return top.map((t, i) => [low[i], t]);
}

// ===== Создание серии =====
function createSeries(type, gameMode, userTeam = null) {
    const s = { id: newSlotId(), type, gameMode, userTeam, season: 1, phase: null, history: [], last: null, created: Date.now() };
    if (type === 'rpl') {
        s.rpl = [...getTeamsData('russia').names];
        s.fnl = [...getTeamsData('fnl').names];
        s.phase = 'league';
    } else if (type === 'euro') {
        const pool = byRating(getTeamsData('world').names);
        s.direct = pool.slice(0, 24);
        s.qual = pool.slice(24, 40);
        s.phase = 'qual';
    } else {
        s.cycle = 'euro';
        s.year = 2028;
        s.phase = 'qual';
    }
    return s;
}

// Где играет команда игрока в РПЛ-серии
function seriesUserLeague(s) {
    return s.userTeam && s.fnl.includes(s.userTeam) ? 'fnl' : 'rpl';
}

// Сборные: в год ЧЕ команды не из Европы играют Кубок Америки (без отбора)
function nationsUserPlaysCopa(s) {
    return s.cycle === 'euro' && s.userTeam && confedOf(s.userTeam) !== 'UEFA';
}

function cycleTitle(s) {
    if (s.cycle === 'euro') return `Чемпионат Европы ${s.year}`;
    return `Чемпионат мира ${s.year}`;
}

// Подпись текущего этапа
function seriesStageLabel(s) {
    if (s.type === 'rpl') {
        const league = seriesUserLeague(s) === 'fnl' ? 'Первая лига' : 'РПЛ';
        return s.phase === 'league' ? `Сезон ${s.season}: ${league}` : `Сезон ${s.season}: стыковые матчи`;
    }
    if (s.type === 'euro') return s.phase === 'qual' ? `Сезон ${s.season}: отборочные стыки` : `Сезон ${s.season}: основной турнир`;
    if (nationsUserPlaysCopa(s)) return `Кубок Америки ${s.year}`;
    const confed = s.cycle === 'wc' ? (s.userTeam ? confedOf(s.userTeam) : 'UEFA') : 'UEFA';
    if (s.phase === 'qual') return `${cycleTitle(s)}: отбор (${CONFED_NAMES[confed]})`;
    if (s.phase === 'playoffs') return `${cycleTitle(s)}: стыковые матчи`;
    return cycleTitle(s);
}

function describeSeries(s) {
    const t = SERIES_TYPES[s.type];
    return { title: `${t.icon} ${t.title}${s.userTeam ? ' · ' + s.userTeam : ''}`, details: `Далее: ${seriesStageLabel(s)}` };
}

// ===== Этап: какой турнир сейчас играется =====
// Возвращает { settings, names, user, title }
function seriesStage(s) {
    const base = { simMode: 'realistic', teamPick: 'random', seriesId: s.id, seriesType: s.type, seriesPhase: s.phase };
    const make = (names, settings, title) => {
        const user = s.gameMode === 'career' && s.userTeam && names.includes(s.userTeam) ? s.userTeam : null;
        return { names, title, user, settings: { ...base, ...settings, count: names.length, gameMode: user ? s.gameMode : 'simulator', seriesTitle: title } };
    };

    if (s.type === 'rpl') {
        if (s.phase === 'league') {
            const fnl = seriesUserLeague(s) === 'fnl';
            return make(fnl ? s.fnl : s.rpl, { mode: 'league', teamType: fnl ? 'fnl' : 'russia', groupLegs: 2, playoffLegs: 1 },
                `${fnl ? 'Первая лига' : 'РПЛ'} · сезон ${s.season}`);
        }
        const pairs = s.pending.pairs;
        return make(pairs.flat(), { mode: 'knockout', teamType: 'russia', presetPairs: pairs, pairsTitle: 'Стыковые матчи',
            stageOnly: true, playoffLegs: 2, groupLegs: 1 }, `Стыковые матчи РПЛ · сезон ${s.season}`);
    }

    if (s.type === 'euro') {
        if (s.phase === 'qual') {
            const pairs = seededPairs(s.qual);
            return make(pairs.flat(), { mode: 'knockout', teamType: 'world', presetPairs: pairs, pairsTitle: 'Отборочные стыки',
                stageOnly: true, playoffLegs: 2, groupLegs: 1 }, `Еврокубок · отбор · сезон ${s.season}`);
        }
        const names = s.main;
        return make(names, { mode: 'groups', teamType: 'world', presetGroups: seedGroups(names, 8), groupLegs: 2, playoffLegs: 2 },
            `Еврокубок · сезон ${s.season}`);
    }

    // Сборные
    if (nationsUserPlaysCopa(s)) {
        const conmebol = confedMembers('CONMEBOL');
        const names = [...conmebol, ...byRating(confedMembers('CONCACAF')).slice(0, 16 - conmebol.length)];
        return make(names, { mode: 'groups', teamType: 'copa', presetGroups: seedGroups(names, 4), groupLegs: 1, playoffLegs: 1 }, `Кубок Америки ${s.year}`);
    }
    if (s.phase === 'qual') {
        const confed = s.cycle === 'wc' && s.userTeam ? confedOf(s.userTeam) : 'UEFA';
        const names = confedMembers(confed === 'OFC' ? 'UEFA' : confed);
        return make(names, { mode: 'groups', teamType: s.cycle === 'euro' ? 'euro' : 'worldcup', presetGroups: qualGroups(confed === 'OFC' ? 'UEFA' : confed, names),
            stageOnly: true, groupLegs: 2, playoffLegs: 1, qualConfed: confed }, `${cycleTitle(s)} · отбор: ${CONFED_NAMES[confed === 'OFC' ? 'UEFA' : confed]}`);
    }
    if (s.phase === 'playoffs') {
        const pairs = s.pending.pairs;
        return make(pairs.flat(), { mode: 'knockout', teamType: s.cycle === 'euro' ? 'euro' : 'worldcup', presetPairs: pairs, pairsTitle: 'Стыковые матчи',
            stageOnly: true, playoffLegs: 2, groupLegs: 1 }, `${cycleTitle(s)} · стыковые матчи`);
    }
    const names = s.pending.qualified;
    return make(names, { mode: 'groups', teamType: s.cycle === 'euro' ? 'euro' : 'worldcup', presetGroups: seedGroups(names, names.length / 4),
        groupLegs: 1, playoffLegs: 1 }, cycleTitle(s));
}

// Группы отбора по континенту
function qualGroups(confed, names) {
    if (confed === 'CONMEBOL') return [byRating(names)];                       // одна лига, дома и в гостях
    if (confed === 'AFC') return seedGroups(names, Math.max(1, Math.round(names.length / 3)));
    if (confed === 'CONCACAF') return seedGroups(names, 2);
    return seedGroups(names, Math.ceil(names.length / 4));
}

// ===== Итоги этапа: обновляем серию по сыгранному турниру =====
// Таблицы групп сыгранного турнира в виде строк quickTable
function stateGroupTables() {
    return state.groups.map(g => sortGroup([...g]).map(t => ({
        name: t.name, p: t.stats.played, w: t.stats.won, d: t.stats.drawn, l: t.stats.lost, gf: t.stats.gf, ga: t.stats.ga, pts: t.stats.points
    })));
}

function stateTieResults() {
    return state.matches.map(m => {
        const g = m.aggregateScore;
        const pens = m.penalties && m.penalties.kicks && m.penalties.kicks.length ? ` (пен. ${m.penalties.t1}:${m.penalties.t2})` : '';
        return { winner: m.winner ? m.winner.name : null, loser: m.winner ? (m.winner === m.team1 ? m.team2.name : m.team1.name) : null,
            text: `${m.team1.name} ${g.t1}:${g.t2} ${m.team2.name}${pens}` };
    });
}

// Места в Еврокубке: чемпион, финалист, полуфиналисты… затем третьи и четвёртые места групп
function stateCupRanking() {
    const order = [];
    const push = n => { if (n && !order.includes(n)) order.push(n); };
    if (state.champion) push(state.champion.name);
    [...state.tournamentHistory].reverse().forEach(r => r.matches.forEach(m => {
        if (m.winner) push((m.winner === m.team1 ? m.team2 : m.team1).name);
    }));
    const tables = stateGroupTables();
    [2, 3].forEach(pos => sortAcross(tables.map(t => t[pos]).filter(Boolean)).forEach(r => push(r.name)));
    state.teams.forEach(t => push(t.name));
    return order;
}

// Вызывается один раз, когда этап серии доигран. Возвращает { lines } — что произошло.
function seriesFinishStage(s) {
    const lines = [];
    const add = (icon, text) => lines.push({ icon, text });

    if (s.type === 'rpl') {
        if (s.phase === 'league') {
            const fnlVisible = seriesUserLeague(s) === 'fnl';
            const played = sortGroup([...state.teams]).map(t => t.name);
            const rpl = fnlVisible ? quickTable(s.rpl).map(r => r.name) : played;
            const fnl = fnlVisible ? played : quickTable(s.fnl).map(r => r.name);
            const n = rpl.length;
            s.pending = {
                rplTable: rpl, fnlTable: fnl,
                relegated: rpl.slice(n - 2), promoted: fnl.slice(0, 2),
                pairs: [[fnl[3], rpl[n - 4]], [fnl[2], rpl[n - 3]]].filter(p => p[0] && p[1])
            };
            add('🏆', `Чемпион РПЛ — ${rpl[0]}. В Еврокубок: ${rpl.slice(0, 3).join(', ')}.`);
            add('⬇️', `Вылетают в Первую лигу: ${s.pending.relegated.join(' и ')}.`);
            add('⬆️', `Выходят в РПЛ: ${s.pending.promoted.join(' и ')} (1–2 места Первой лиги).`);
            add('⚔️', `Стыковые матчи: ${s.pending.pairs.map((p, i) => `${p[1]} (${n - 3 + i}-е место РПЛ) — ${p[0]} (${4 - i}-е место Первой лиги)`).join('; ')}.`);
            s.last = { title: `Сезон ${s.season}: чемпионат`, lines, tables: { 'РПЛ': rpl, 'Первая лига': fnl } };
            s.phase = 'playoffs';
            return s.last;
        }
        // Стыки
        const ties = stateTieResults();
        let rpl = s.pending.rplTable.filter(n => !s.pending.relegated.includes(n));
        let fnl = s.pending.fnlTable.filter(n => !s.pending.promoted.includes(n));
        rpl.push(...s.pending.promoted);
        fnl.push(...s.pending.relegated);
        ties.forEach(t => {
            add('⚔️', t.text);
            if (fnl.includes(t.winner)) {        // клуб Первой лиги выиграл стыки — меняются местами
                rpl = rpl.filter(n => n !== t.loser).concat(t.winner);
                fnl = fnl.filter(n => n !== t.winner).concat(t.loser);
                add('⬆️', `${t.winner} выходит в РПЛ, ${t.loser} — в Первую лигу.`);
            } else add('🛡️', `${t.winner} сохраняет место в РПЛ.`);
        });
        s.rpl = rpl; s.fnl = fnl;
        s.history.unshift({ title: `Сезон ${s.season}`, lines: [
            `🏆 Чемпион: ${s.pending.rplTable[0]}`,
            `⬇️ Вылет: ${s.pending.relegated.join(', ')}`,
            `⬆️ Подъём: ${s.pending.promoted.join(', ')}`,
            ...ties.map(t => `⚔️ ${t.text}`)
        ] });
        s.last = { title: `Сезон ${s.season}: стыковые матчи`, lines };
        s.season++;
        s.phase = 'league';
        s.pending = null;
        return s.last;
    }

    if (s.type === 'euro') {
        if (s.phase === 'qual') {
            const ties = stateTieResults();
            s.main = [...s.direct, ...ties.map(t => t.winner)];
            ties.forEach(t => add(t.winner ? '✅' : '❌', `${t.text} — в турнир проходит ${t.winner}`));
            s.last = { title: `Сезон ${s.season}: отборочные стыки`, lines };
            s.phase = 'main';
            return s.last;
        }
        const rank = stateCupRanking();
        add('🏆', `Победитель Еврокубка — ${rank[0]}, в финале — ${rank[1]}.`);
        add('🥉', `Полуфиналисты: ${rank.slice(2, 4).join(', ')}.`);
        const keep = rank.slice(0, 24);
        const outsiders = byRating(getTeamsData('world').names.filter(n => !s.main.includes(n)));
        // В отбор: 25–32 места этого сезона + 8 сильнейших из не игравших (немного случайности среди претендентов)
        const challengers = shuffle(outsiders.slice(0, 12)).slice(0, 8);
        s.direct = keep;
        s.qual = [...rank.slice(24, 32), ...challengers];
        add('⬇️', `В отбор следующего сезона: ${rank.slice(24, 32).join(', ')}.`);
        add('🆕', `Претенденты из других клубов: ${challengers.join(', ')}.`);
        s.history.unshift({ title: `Сезон ${s.season}`, lines: [`🏆 ${rank[0]} · финал: ${rank[1]}`, `🥉 ${rank.slice(2, 4).join(', ')}`] });
        s.last = { title: `Сезон ${s.season}: Еврокубок`, lines };
        s.season++;
        s.phase = 'qual';
        return s.last;
    }

    // ----- Сборные -----
    if (nationsUserPlaysCopa(s)) {
        // Кубок Америки сыгран; Чемпионат Европы того же года — «за кадром»
        const euro = quickTournament(byRating(confedMembers('UEFA')).slice(0, 24));
        add('🏆', `Кубок Америки ${s.year}: победитель — ${state.champion.name}.`);
        add('⭐', `Чемпионат Европы ${s.year}: победитель — ${euro.winner}${euro.loser ? `, финалист — ${euro.loser}` : ''}.`);
        s.history.unshift({ title: `${s.year}`, lines: [`🌎 Кубок Америки: ${state.champion.name}`, `⭐ ЧЕ: ${euro.winner}`] });
        s.last = { title: `Кубок Америки ${s.year}`, lines };
        s.cycle = 'wc'; s.year += 2; s.phase = 'qual'; s.pending = null;
        return s.last;
    }

    if (s.phase === 'qual') {
        const visible = state.settings.qualConfed === 'OFC' ? 'UEFA' : state.settings.qualConfed;
        const tables = {};
        tables[visible] = stateGroupTables();
        const confeds = s.cycle === 'euro' ? ['UEFA'] : ['UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF'];
        confeds.forEach(c => { if (!tables[c]) tables[c] = qualGroups(c, confedMembers(c)).map(g => quickTable(g, 2)); });

        const qualified = [], pairs = [];
        const winners = c => tables[c].map(t => t[0]).filter(Boolean);
        const seconds = c => sortAcross(tables[c].map(t => t[1]).filter(Boolean));
        if (s.cycle === 'euro') {
            const ue = tables.UEFA;
            qualified.push(...ue.flatMap(t => t.slice(0, 2).map(r => r.name)));
            const thirds = sortAcross(ue.map(t => t[2]).filter(Boolean)).slice(0, 8).map(r => r.name);
            for (let i = 0; i < thirds.length / 2; i++) pairs.push([thirds[thirds.length - 1 - i], thirds[i]]);
            add('✅', `Напрямую на ЧЕ: ${qualified.join(', ')}.`);
            add('⚔️', `Стыковые матчи (лучшие третьи места): ${pairs.map(p => p.join(' — ')).join('; ')}.`);
        } else {
            const ueW = winners('UEFA').map(r => r.name), ueS = seconds('UEFA').slice(0, 8).map(r => r.name);
            qualified.push(...ueW);
            for (let i = 0; i < ueS.length / 2; i++) pairs.push([ueS[ueS.length - 1 - i], ueS[i]]);
            const sa = tables.CONMEBOL[0].map(r => r.name);
            qualified.push(...sa.slice(0, 4));
            const caf = [...winners('CAF').map(r => r.name), ...seconds('CAF').slice(0, 2).map(r => r.name)];
            qualified.push(...caf);
            const afcS = seconds('AFC');
            qualified.push(...winners('AFC').map(r => r.name), ...afcS.slice(0, 1).map(r => r.name));
            const ccS = seconds('CONCACAF');
            qualified.push(...winners('CONCACAF').map(r => r.name), ...ccS.slice(0, 1).map(r => r.name));
            // Межконтинентальные стыки
            const ofc = confedMembers('OFC')[0];
            if (sa[4] && ofc) pairs.push([ofc, sa[4]]);
            if (ccS[1] && afcS[1]) pairs.push([ccS[1].name, afcS[1].name]);
            add('✅', `Европа: ${ueW.join(', ')}.`);
            add('✅', `Южная Америка: ${sa.slice(0, 4).join(', ')}. Африка: ${caf.join(', ')}.`);
            add('✅', `Азия: ${[...winners('AFC').map(r => r.name), ...afcS.slice(0, 1).map(r => r.name)].join(', ')}. Северная Америка: ${[...winners('CONCACAF').map(r => r.name), ...ccS.slice(0, 1).map(r => r.name)].join(', ')}.`);
            add('⚔️', `Стыковые матчи: ${pairs.map(p => p.join(' — ')).join('; ')}.`);
        }
        s.pending = { qualified, pairs, tables };
        s.last = { title: `${cycleTitle(s)}: отбор`, lines, groups: tables[visible] };
        s.phase = 'playoffs';
        return s.last;
    }

    if (s.phase === 'playoffs') {
        const ties = stateTieResults();
        ties.forEach(t => add('⚔️', `${t.text} — на ${s.cycle === 'euro' ? 'ЧЕ' : 'ЧМ'} едет ${t.winner}`));
        let qualified = [...s.pending.qualified, ...ties.map(t => t.winner).filter(Boolean)];
        // Если кого-то убрали в редакторе — добираем сильнейшими
        const need = s.cycle === 'euro' ? 24 : 32;
        const pool = byRating((s.cycle === 'euro' ? confedMembers('UEFA') : Object.keys(CONFEDS).flatMap(confedMembers)).filter(n => !qualified.includes(n)));
        while (qualified.length < need && pool.length) qualified.push(pool.shift());
        qualified = qualified.slice(0, need);
        s.pending = { qualified };
        if (s.userTeam) add(qualified.includes(s.userTeam) ? '🎉' : '😔', qualified.includes(s.userTeam)
            ? `${s.userTeam} едет на ${cycleTitle(s)}!` : `${s.userTeam} не прошла отбор — турнир сыграют без неё.`);
        s.last = { title: `${cycleTitle(s)}: стыковые матчи`, lines };
        s.phase = 'final';
        return s.last;
    }

    // Финальный турнир
    const champ = state.champion.name;
    const final = state.tournamentHistory.length ? state.tournamentHistory[state.tournamentHistory.length - 1].matches[0] : null;
    const runner = final && final.winner ? (final.winner === final.team1 ? final.team2 : final.team1).name : null;
    add('🏆', `${cycleTitle(s)}: победитель — ${champ}${runner ? `, финалист — ${runner}` : ''}.`);
    if (s.userTeam) add('🎽', `${s.userTeam}: ${s.pending.qualified.includes(s.userTeam) ? userResultText() : 'не прошла отбор'}.`);
    s.history.unshift({ title: cycleTitle(s), lines: [`🏆 ${champ}${runner ? ' · финал: ' + runner : ''}`] });
    s.last = { title: cycleTitle(s), lines };
    s.cycle = s.cycle === 'euro' ? 'wc' : 'euro';
    s.year += 2;
    s.phase = 'qual';
    s.pending = null;
    return s.last;
}

function userResultText() {
    try { return getUserResult().text.toLowerCase(); } catch (e) { return 'сыграла'; }
}

// ===== Хранение серии в слоте =====
function readSeries(id = currentSlotId) {
    const slot = readSlot(id);
    return slot && slot.series ? slot.series : null;
}

function writeSeries(s) {
    currentSlotId = s.id;
    const slot = readSlot(s.id) || { tournament: null, series: null };
    slot.series = s;
    writeSlot(s.id, slot);
}

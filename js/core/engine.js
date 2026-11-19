// ===== ДВИЖОК МАТЧА =====
// Один поминутный движок для всего: живой матч, «быстрый результат» и автосимуляция
// прогоняют одну и ту же MatchSimulation — разница только в том, показываем ли мы минуты.
// Здесь нет работы с DOM.

// ----- Ростер команды (20 игроков: 11 в старте + 9 на скамейке) -----
const FORMATION = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
const LINE_KEYS = { GK: 'goalkeepers', DEF: 'defenders', MID: 'midfielders', FWD: 'forwards' };
const BASE_POSITIONS = {
    GK:  [{ x: 8, y: 50 }],
    DEF: [{ x: 20, y: 22 }, { x: 18, y: 41 }, { x: 18, y: 59 }, { x: 20, y: 78 }],
    MID: [{ x: 40, y: 25 }, { x: 37, y: 43 }, { x: 37, y: 57 }, { x: 40, y: 75 }],
    FWD: [{ x: 58, y: 40 }, { x: 58, y: 60 }]
};
const BENCH_SIZE = 9;
const MAX_SUBS = 5;

function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295; // 0..1, всегда одинаково для одной строки
}

const rosterCache = {};

// Детерминированный ростер: одинаковый в каждом матче и после перезагрузки.
function getTeamRoster(teamName, teamRating) {
    // В идущем турнире составы зафиксированы при старте (правки в редакторе на него не влияют)
    if (state.rosters && state.rosters[teamName]) return state.rosters[teamName];
    const base = buildBaseRoster(teamName, teamRating);
    // В карьере: развитие игроков и трансферы (career.js)
    return careerPlayers ? applyCareerRoster(teamName, base) : base;
}

// Возраст: настоящий (js/data/ages.js), а если год рождения неизвестен — условный 20–31,
// всегда одинаковый для игрока
function baseAge(teamName, playerName) {
    const real = typeof knownAge === 'function' ? knownAge(teamName, playerName) : null;
    return real ?? 20 + Math.floor(hashString('age:' + teamName + playerName) * 12);
}

function buildBaseRoster(teamName, teamRating) {
    const key = `${teamName}|${teamRating}`;
    if (rosterCache[key]) return rosterCache[key];

    const origin = getTeamOrigin(teamName);
    const data = (typeof SQUADS !== 'undefined' && SQUADS[origin] && SQUADS[origin][teamName]) || fallbackPlayerNames[origin];
    const used = new Set();
    const unique = list => (list || []).filter(n => !used.has(n) && used.add(n));
    const lines = {};
    Object.keys(LINE_KEYS).forEach(pos => { lines[pos] = unique(data[LINE_KEYS[pos]]); });

    // Если в линии не хватает игроков (в данных бывают повторы) — добираем из других линий
    const starters = [];
    Object.keys(FORMATION).forEach(pos => {
        const take = lines[pos].splice(0, FORMATION[pos]).map(name => ({ name, position: pos }));
        while (take.length < FORMATION[pos]) {
            const donor = ['MID', 'DEF', 'FWD'].find(p => p !== 'GK' && lines[p].length > (pos === 'GK' ? 99 : 0));
            const name = donor ? lines[donor].shift() : `Игрок ${starters.length + take.length + 1}`;
            take.push({ name, position: pos });
        }
        starters.push(...take);
    });

    // Скамейка: запасной вратарь + лучшие из остальных по порядку в заявке
    const benchPool = [];
    if (lines.GK.length) benchPool.push({ name: lines.GK.shift(), position: 'GK' });
    const maxLen = Math.max(lines.DEF.length, lines.MID.length, lines.FWD.length);
    for (let i = 0; i < maxLen && benchPool.length < BENCH_SIZE; i++) {
        ['DEF', 'MID', 'FWD'].forEach(pos => {
            if (lines[pos][i] && benchPool.length < BENCH_SIZE) benchPool.push({ name: lines[pos][i], position: pos });
        });
    }

    const lineIndex = {};
    const rate = (p, isStarter) => {
        const idx = lineIndex[p.position] = (lineIndex[p.position] ?? -1) + 1;
        const noise = (hashString(teamName + p.name) - 0.5) * 8; // ±4
        const base = isStarter ? teamRating + 3 - idx * 0.8 : teamRating - 5 - idx * 0.6;
        return Math.round(Math.max(50, Math.min(99, base + noise)));
    };

    let number = 1;
    const withMeta = p => ({ ...p, age: baseAge(teamName, p.name), origTeam: teamName });
    const roster = starters.map(p => withMeta({ ...p, number: number++, rating: rate(p, true), starter: true }));
    Object.keys(lineIndex).forEach(k => delete lineIndex[k]); // у скамейки своя нумерация по линиям
    roster.push(...benchPool.map(p => withMeta({ ...p, number: number++, rating: rate(p, false), starter: false })));
    rosterCache[key] = roster;
    return roster;
}

// Короткая сводка состава (для статистики игроков)
function generateTeamSquad(teamName, teamId) {
    const team = getTeamById(teamId);
    return getTeamRoster(teamName, team ? team.rating : (teamRatings[teamName] || 75));
}

// ----- Счёт и режимы -----
function isRealistic() {
    return state.settings.simMode !== 'random';
}

// В режиме «рандом» все игроки равны — исход решает только случай.
// В «реализме» учитываются усталость и игра не на своей позиции (см. squad.js).
function effRating(p) {
    return isRealistic() ? effectiveRating(p, p.position) : 75;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function weightedPick(list, weightFn) {
    const total = list.reduce((s, x) => s + weightFn(x), 0);
    let r = Math.random() * total;
    for (const x of list) { r -= weightFn(x); if (r <= 0) return x; }
    return list[list.length - 1] || null;
}

// Счёт конкретной игры матча (для двухматчевых пар — leg1/leg2)
function getLegScore(m, leg) {
    if (m.legs === 2) return leg === 1 ? m.leg1 : m.leg2;
    return { t1: m.score1, t2: m.score2 };
}

function setLegScore(m, leg, score) {
    if (m.legs === 2) Object.assign(leg === 1 ? m.leg1 : m.leg2, score);
    else { m.score1 = score.t1; m.score2 = score.t2; }
}

// Кто хозяин в игре: в первом матче пары — team1, во втором — team2, финал — нейтральное поле
function getHomeSide(m, leg) {
    if (m.isFinal) return null;
    return m.legs === 2 && leg === 2 ? 'team2' : 'team1';
}

// ----- Ожидаемые голы (xG) -----
// Точка удара: r — путь к воротам соперника в % длины поля (100 — линия ворот), y — поперёк поля (0–100).
// Модель как у аналитиков: чем ближе и чем шире угол обзора ворот, тем выше шанс; удар головой — ниже.
const PITCH_M = { len: 105, wid: 68, goal: 7.32 };

function shotXg(r, y, { header = false, counter = false } = {}) {
    const dx = Math.max(0.5, (100 - r) * PITCH_M.len / 100);
    const dy = Math.abs(y - 50) * PITCH_M.wid / 100;
    const d = Math.hypot(dx, dy);
    const g = PITCH_M.goal;
    let angle = Math.atan2(g * dx, dx * dx + dy * dy - (g / 2) ** 2); // угол, под которым видны ворота
    if (angle < 0) angle += Math.PI;
    let xg = 1 / (1 + Math.exp(-(-1.0 - 0.12 * d + 1.2 * angle)));
    if (header) xg *= 0.55;
    if (counter) xg *= 1.25; // выход один на один после контратаки
    return clamp(xg, 0.01, 0.8);
}

// Откуда бьёт игрок: нападающие — из штрафной, полузащитники и защитники — чаще издали
function pickShotSpot(position, kind, counter) {
    const rnd = Math.random;
    let r;
    if (kind === 'corner') r = 88 + rnd() * 6;
    else if (counter) r = 84 + rnd() * 11;
    else r = ({ FWD: 82 + rnd() * 13, MID: 74 + rnd() * 17, DEF: 73 + rnd() * 15 })[position] ?? 80 + rnd() * 12;
    const spread = clamp((100 - r) * 2.4, 16, 44); // вблизи ворот бьют по центру, издали — откуда угодно
    const y = 50 + (rnd() - 0.5) * spread;
    return { r: Math.round(r * 10) / 10, y: Math.round(y * 10) / 10 };
}

const XG_MEAN = 0.11; // средний xG удара в этой модели (калибровка: общая результативность не меняется)

const SIDE_KEY = { team1: 't1', team2: 't2' };
const otherSide = side => side === 'team1' ? 'team2' : 'team1';

// ----- Симуляция одной игры -----
class MatchSimulation {
    constructor(match, leg = 1) {
        this.match = match;
        this.leg = leg;
        this.minute = 0;
        this.maxMinute = 90;
        this.phase = 'regular';      // regular | extra | over
        this.isOver = false;
        this.homeSide = getHomeSide(match, leg);
        this.score = { t1: 0, t2: 0 };
        this.attackingSide = 'team1';
        this.possessionTicks = { team1: 0, team2: 0 };
        this.events = [];
        this.newEvents = []; // события текущей минуты (есть и до первого шага — для смены тактики в паузе)
        // Доп. время возможно только в решающей игре плей-офф
        this.allowExtraTime = match.stage === 'playoff' && (match.legs === 1 || leg === 2);
        this.stats = {
            possession: { team1: 50, team2: 50 },
            shots: { team1: 0, team2: 0 },
            shotsOnTarget: { team1: 0, team2: 0 },
            corners: { team1: 0, team2: 0 },
            fouls: { team1: 0, team2: 0 },
            yellowCards: { team1: 0, team2: 0 },
            redCards: { team1: 0, team2: 0 },
            substitutions: { team1: [], team2: [] },
            xg: { team1: 0, team2: 0 }
        };
        this.shotLog = []; // все удары: { side, minute, r, y, xg, result, player, name, keeper, header }
        this.sides = {
            team1: this.createSide(match.team1, 'team1'),
            team2: this.createSide(match.team2, 'team2')
        };
        this.prematchPlan();
    }

    // Команда под управлением компьютера? (в карьере команда игрока — нет)
    isAI(side) {
        return !(isCareer() && state.userTeam && this.sides[side].team.id === state.userTeam.id);
    }

    // Перед матчем тренер подстраивается под соперника: против намного более сильного — играет от обороны
    prematchPlan() {
        if (!isRealistic()) return;
        ['team1', 'team2'].forEach(side => {
            if (!this.isAI(side)) return;
            const s = this.sides[side];
            const gap = this.strength(otherSide(side)) - this.strength(side);
            if (gap >= 6 && !['counter', 'defense'].includes(s.style)) {
                s.style = gap >= 10 ? 'defense' : 'counter';
                s.line = 'low';
                s.plan = 'против фаворита — от обороны';
            } else if (gap <= -8 && ['counter', 'defense'].includes(s.style)) {
                s.style = 'balance';
                s.line = 'mid';
                s.plan = 'против слабого — берёт игру на себя';
            }
        });
    }

    // Состав берётся из тактики команды (squad.js): схема, стартовые 11, свежесть, дисквалификации
    createSide(team, side) {
        prepareTeamForMatch(team);
        const squad = getSquad(team);
        const players = getSquadPlayers(team);
        const byNum = Object.fromEntries(players.map(p => [p.number, p]));
        const slots = FORMATIONS[squad.formation];
        const mirror = side === 'team2'; // team1 всегда слева, team2 справа

        const onPitch = [];
        squad.lineup.forEach((num, i) => {
            const p = byNum[num];
            if (!p) return;
            const [pos, sx, sy] = slots[i];
            const x = mirror ? 100 - sx : sx;
            onPitch.push({ ...p, position: pos, teamId: team.id, side, yellow: 0, x, y: sy, baseX: x, baseY: sy });
        });
        const inLineup = new Set(squad.lineup);
        const bench = players.filter(p => isAvailable(p) && !inLineup.has(p.number))
            .sort((a, b) => (a.position === 'GK' ? -1 : 0) - (b.position === 'GK' ? -1 : 0) || b.rating - a.rating)
            .filter((p, i, arr) => p.position !== 'GK' || arr.findIndex(x => x.position === 'GK') === i) // один запасной вратарь
            .slice(0, BENCH_SIZE)
            .map(p => ({ ...p, teamId: team.id, side, yellow: 0 }));

        return {
            team, side, onPitch, bench,
            style: STYLES[squad.style] ? squad.style : 'balance',
            formation: squad.formation,
            line: LINES[squad.line] ? squad.line : 'mid',
            coach: {},             // решения тренера по ходу матча (чтобы не повторять)
            autoSubs: true,
            subsUsed: 0,
            sentOff: [],
            subbedOff: [],
            yellowed: new Set(),
            appeared: new Set(onPitch.map(p => p.number)),
            served: new Set(players.filter(p => !isAvailable(p)).map(p => p.number)), // пропускают матч: дисквалификация или травма
            injured: new Map(),    // травмы этого матча: номер → { type, matches }
            absent: players.filter(p => !isAvailable(p)).sort((a, b) => b.rating - a.rating)
                .map(p => ({ number: p.number, name: p.name, rating: p.rating, injured: isInjured(p), reason: absenceText(p) }))
        };
    }

    setStyle(side, style) {
        if (!STYLES[style]) return;
        this.sides[side].style = style;
        this.log('tactic', side, `Тактика: ${STYLES[style].label}`);
    }

    setLine(side, line) {
        if (!LINES[line]) return;
        this.sides[side].line = line;
        this.log('tactic', side, `Линия обороны: ${LINES[line].label}`);
    }

    // Перестроение под новую схему: игроки на поле расставляются по слотам.
    // Если игроков меньше 11 (удаление) — сначала убираются слоты нападающих.
    reshape(side, formation, reason = '') {
        const s = this.sides[side];
        if (!FORMATIONS[formation]) return false;
        let slots = FORMATIONS[formation].map(([pos, x, y]) => ({ pos, x, y }));
        const players = [...s.onPitch];
        for (const drop of ['FWD', 'MID', 'DEF']) {
            while (slots.length > players.length) {
                const idx = slots.map(sl => sl.pos).lastIndexOf(drop);
                if (idx === -1) break;
                slots.splice(idx, 1);
            }
        }
        const mirror = side === 'team2';
        const free = [...players];
        const take = (slot) => {
            free.sort((a, b) => effectiveRating(b, slot.pos) - effectiveRating(a, slot.pos));
            return free.shift();
        };
        // Вратарь — в ворота, затем защита, полузащита, атака
        ['GK', 'DEF', 'MID', 'FWD'].forEach(pos => {
            slots.filter(sl => sl.pos === pos).forEach(sl => {
                const p = pos === 'GK' ? (free.find(x => x.natPos === 'GK') || take(sl)) : take(sl);
                if (!p) return;
                if (free.includes(p)) free.splice(free.indexOf(p), 1);
                p.position = sl.pos;
                p.baseX = mirror ? 100 - sl.x : sl.x;
                p.baseY = sl.y;
            });
        });
        s.formation = formation;
        if (reason) this.log('tactic', side, `${reason}: ${formation}`, { lineupChanged: true });
        return true;
    }

    // Тренер меняет игру по ходу матча (только команды компьютера)
    aiCoach() {
        if (!isRealistic() || this.minute < 55) return;
        const m = this.match;
        const agg = m.legs === 2 && this.leg === 2
            ? { t1: m.leg1.t1 + this.score.t1, t2: m.leg1.t2 + this.score.t2 }
            : this.score;
        ['team1', 'team2'].forEach(side => {
            if (!this.isAI(side)) return;
            const s = this.sides[side];
            const my = side === 'team1' ? agg.t1 : agg.t2, their = side === 'team1' ? agg.t2 : agg.t1;
            const diff = my - their;
            const outfield = s.onPitch.filter(p => p.position !== 'GK').length;

            // Проигрываем — рискуем
            if (diff < 0 && !s.coach.chasing && (this.minute >= 68 || diff <= -2)) {
                s.coach.chasing = true;
                const target = outfield >= 10 ? (s.formation.startsWith('3') ? '3-4-3' : '4-3-3') : '4-4-1';
                this.reshape(side, FORMATIONS[target] ? target : '4-3-3', `Тренер «${s.team.name}» бросает всех вперёд`);
                s.style = 'attack';
                s.line = 'high';
            }
            // Ведём в концовке — закрываемся
            else if (diff > 0 && diff <= 1 && !s.coach.protecting && this.minute >= 78) {
                s.coach.protecting = true;
                this.reshape(side, '5-3-2', `Тренер «${s.team.name}» закрывается`);
                s.style = 'defense';
                s.line = 'low';
            }
            // В плей-офф при ничьей в концовке решающего матча — идём вперёд
            else if (diff === 0 && !s.coach.pushing && this.minute >= 80 && this.allowExtraTime && s.style !== 'attack') {
                s.coach.pushing = true;
                s.style = 'attack';
                this.log('tactic', side, `Тренер «${s.team.name}» требует идти вперёд`);
            }
        });
    }

    // Замена по решению игрока (номера из onPitch и bench)
    manualSubstitute(side, outNumber, inNumber) {
        const s = this.sides[side];
        const out = s.onPitch.find(p => p.number === outNumber);
        const inP = s.bench.find(p => p.number === inNumber);
        if (!out || !inP) return false;
        return this.substitute(side, out, inP);
    }

    goalkeeper(side) {
        return this.sides[side].onPitch.find(p => p.position === 'GK') || { name: 'полевой игрок', rating: 45 };
    }

    strength(side) {
        const s = this.sides[side];
        const players = s.onPitch;
        const avg = players.reduce((sum, p) => sum + effRating(p), 0) / Math.max(1, players.length);
        const missing = 11 - players.length;
        return avg - missing * 4;
    }

    // Сколько игроков в каждой линии сейчас на поле (схема + удаления)
    shape(side) {
        const count = { DEF: 0, MID: 0, FWD: 0 };
        this.sides[side].onPitch.forEach(p => { if (count[p.position] !== undefined) count[p.position]++; });
        return count;
    }

    // Насколько тактика команды увеличивает её долю атак
    tacticalAttack(side) {
        if (!isRealistic()) return 0;
        const s = this.sides[side], opp = this.sides[otherSide(side)];
        const sh = this.shape(side);
        let v = STYLES[s.style].attackShare + LINES[s.line].attackShare;
        v += (sh.FWD - 2) * 0.012 - (sh.DEF - 4) * 0.015;      // больше нападающих — больше атак
        if (s.style === 'possession' && opp.style === 'pressing') v -= 0.03; // прессинг мешает строить игру
        return v;
    }

    // Доля атак team1: зависит от силы составов, фактора поля и тактики
    team1AttackProbability() {
        let p = 0.5 + (this.strength('team1') - this.strength('team2')) * 0.012;
        if (isRealistic() && this.homeSide) p += this.homeSide === 'team1' ? 0.04 : -0.04;
        p += this.tacticalAttack('team1') - this.tacticalAttack('team2');
        return clamp(p, 0.25, 0.75);
    }

    // Поправка к реализации моментов от тактики обеих команд
    finishBonus(side) {
        const s = this.sides[side], opp = this.sides[otherSide(side)];
        if (!isRealistic()) return 0;
        const oppShape = this.shape(otherSide(side)), myShape = this.shape(side);
        let v = STYLES[s.style].ownFinish + STYLES[opp.style].oppFinish + LINES[opp.line].oppFinish;
        v += (myShape.FWD - 2) * 0.006;                         // больше нападающих в штрафной
        v -= (oppShape.DEF - 4) * 0.012;                        // пятёрка защитников мешает
        if (s.style === 'counter' && opp.line === 'high') v += 0.03; // контратака за спину высокой линии
        return v;
    }

    tire() {
        ['team1', 'team2'].forEach(side => {
            const k = 0.22 * STYLES[this.sides[side].style].fatigue;
            this.sides[side].onPitch.forEach(p => { p.fitness = Math.max(20, (p.fitness ?? 100) - k * (0.8 + Math.random() * 0.4)); });
        });
    }

    log(type, side, text, extra = {}) {
        const ev = { minute: this.minute, type, side, team: side ? this.sides[side].team : null, text, ...extra };
        this.events.push(ev);
        this.newEvents.push(ev);
        return ev;
    }

    // Один шаг = одна игровая минута. Возвращает события этой минуты.
    step() {
        this.newEvents = [];
        if (this.isOver) return this.newEvents;
        this.minute++;

        const p1 = this.team1AttackProbability();
        const attack = Math.random() < 0.55;
        this.attackingSide = Math.random() < p1 ? 'team1' : 'team2';
        this.possessionTicks[this.attackingSide]++;
        const t = this.possessionTicks;
        this.stats.possession.team1 = Math.round(t.team1 / (t.team1 + t.team2) * 100);
        this.stats.possession.team2 = 100 - this.stats.possession.team1;

        // Розыгрыш минуты: кто начал атаку, через кого шёл мяч, чем закончилось (для показа на поле)
        this.play = null;
        if (attack) this.playAttack(this.attackingSide);
        if (!this.play) {
            const side = this.attackingSide;
            this.startPlay(side, 'keep', this.buildChain(side, 2 + (Math.random() < 0.5 ? 1 : 0)));
        }
        // Прессингующие команды чаще фолят (дополнительные фолы)
        if (isRealistic()) ['team1', 'team2'].forEach(side => {
            const extra = STYLES[this.sides[side].style].fouls - 1;
            if (extra > 0 && Math.random() < 0.18 * extra) this.foul(side, otherSide(side));
        });
        this.tire();
        if (Math.random() < 0.0025) this.injury(Math.random() < 0.5 ? 'team1' : 'team2');
        this.aiSubstitutions();
        this.aiCoach();

        if (this.minute === 45) this.log('half', null, `Перерыв: ${this.score.t1}:${this.score.t2}`);
        this.lastPlay = this.play;
        if (this.minute >= this.maxMinute) this.endOfPeriod();
        return this.newEvents;
    }

    // ----- Описание розыгрыша (для показа на поле) -----
    // play = { side, kind: keep|attack|counter|corner|foul, chain: [номера игроков по порядку], end: {...} | null }
    startPlay(side, kind, chain) {
        // Повторы убираем, оставляя последнее появление игрока (порядок «пас — удар» важнее)
        const nums = chain.filter(Boolean).map(p => p.number);
        this.play = {
            side, kind, end: null,
            chain: nums.filter((n, i) => nums.lastIndexOf(n) === i)
        };
        return this.play;
    }

    // Цепочка передач: от защиты через полузащиту вперёд
    buildChain(side, n) {
        const field = this.sides[side].onPitch.filter(p => p.position !== 'GK');
        const stages = [{ DEF: 3, MID: 2, FWD: 0.3 }, { DEF: 0.8, MID: 3, FWD: 1 }, { DEF: 0.3, MID: 2, FWD: 2.5 }];
        const chain = [];
        for (let i = 0; i < n; i++) {
            const w = stages[Math.min(i, stages.length - 1)];
            const last = chain[chain.length - 1];
            const p = weightedPick(field.filter(x => x !== last), x => w[x.position] || 0.1);
            if (p) chain.push(p);
        }
        return chain;
    }

    playAttack(side) {
        // Контратака: мяч только что сменил владельца, а команда любит играть на выпадах
        const turnover = this.lastPlay && this.lastPlay.side !== side;
        const counter = turnover && Math.random() < (this.sides[side].style === 'counter' ? 0.6 : 0.2);
        const pre = this.buildChain(side, counter ? 1 : 1 + (Math.random() < 0.5 ? 1 : 0));
        const roll = Math.random();
        if (roll < 0.42) this.shot(side, 'open', pre, counter);
        else if (roll < 0.60) {
            this.stats.corners[side]++;
            const field = this.sides[side].onPitch.filter(p => p.position !== 'GK');
            const taker = weightedPick(field, p => ({ MID: 3, FWD: 2, DEF: 0.5 })[p.position]);
            this.startPlay(side, 'corner', [...pre, taker]);
            this.log('corner', side, taker ? `Угловой — подаёт ${taker.name}` : 'Угловой', { player: taker });
            if (Math.random() < 0.35) this.shot(side, 'corner', pre, false, taker);
        } else if (roll < 0.92) {
            const field = this.sides[side].onPitch.filter(p => p.position !== 'GK');
            const victim = weightedPick(field, p => ({ FWD: 3, MID: 2, DEF: 0.5 })[p.position]);
            this.startPlay(side, 'foul', [...pre, victim]);
            this.foul(otherSide(side), side, victim);
        } else {
            this.startPlay(side, counter ? 'counter' : 'attack', pre); // атака сорвалась без удара
        }
    }

    pickShooter(side, kind, exclude = null) {
        const field = this.sides[side].onPitch.filter(p => p.position !== 'GK' && p !== exclude);
        const posWeight = kind === 'corner'
            ? { FWD: 3, MID: 1, DEF: 3 }
            : { FWD: 5, MID: 2.5, DEF: 0.7 };
        return weightedPick(field, p => posWeight[p.position] * Math.pow(effRating(p) / 75, 3));
    }

    pickAssister(side, scorer) {
        const field = this.sides[side].onPitch.filter(p => p.position !== 'GK' && p.number !== scorer.number);
        if (!field.length) return null;
        const posWeight = { MID: 4, FWD: 3, DEF: 1.2 };
        return weightedPick(field, p => posWeight[p.position] * Math.pow(effRating(p) / 75, 2));
    }

    // pre — начало розыгрыша; cornerTaker — кто подавал угловой
    shot(side, kind, pre = [], counter = false, cornerTaker = null) {
        const shooter = this.pickShooter(side, kind, cornerTaker); // подающий угловой сам себе не забивает
        if (!shooter) return;
        // Последний пас перед ударом: подающий угловой или партнёр (он же — кандидат на голевую передачу)
        const passer = kind === 'corner' ? cornerTaker : this.pickAssister(side, shooter);
        const play = this.startPlay(side, kind === 'corner' ? 'corner' : (counter ? 'counter' : 'attack'),
            [...pre.filter(p => p !== shooter && p !== passer), passer, shooter]);
        const gk = this.goalkeeper(otherSide(side));
        this.stats.shots[side]++;
        // Точка удара и xG (качество момента); навес с углового — чаще удар головой
        const header = kind === 'corner' && Math.random() < 0.75;
        const at = pickShotSpot(shooter.position, kind, counter);
        const xg = shotXg(at.r, at.y, { header, counter });
        this.stats.xg[side] += xg;
        // Мастерство бьющего и вратаря, тактика — как раньше; xG смещает шанс относительно среднего момента
        const pOnTarget = clamp(0.35 + (effRating(shooter) - 80) * 0.004, 0.22, 0.5);
        const pConvert = clamp(0.29 + (effRating(shooter) - effRating(gk)) * 0.004 + this.finishBonus(side), 0.12, 0.5);
        const pGoal = clamp(pOnTarget * pConvert * xg / XG_MEAN, 0.005, 0.85);
        const pSave = Math.min(1 - pGoal, pOnTarget * (1 - pConvert) * clamp(0.6 + xg / XG_MEAN * 0.4, 0.6, 1.6));
        const u = Math.random();
        const result = u < pGoal ? 'goal' : (u < pGoal + pSave ? 'save' : 'off');
        const shotInfo = { side, minute: this.minute, r: at.r, y: at.y, xg, result, header,
            player: shooter.number, name: shooter.name, keeper: gk ? gk.number : null };
        this.shotLog.push(shotInfo);
        if (result === 'off') {
            play.end = { type: 'off', shooter: shooter.number, at, xg, header };
            this.log('shot-off', side, `Удар мимо — ${shooter.name}`, { player: shooter, xg });
            return;
        }
        this.stats.shotsOnTarget[side]++;
        if (result === 'goal') {
            const assister = Math.random() < 0.75 ? passer : null;
            shotInfo.assister = assister ? assister.number : null;
            play.end = { type: 'goal', shooter: shooter.number, at, xg, header };
            this.goal(side, shooter, assister, kind === 'corner' ? 'после углового' : '', xg);
        } else {
            play.end = { type: 'save', shooter: shooter.number, keeper: gk.number, at, xg, header };
            this.log('shot', side, `${gk.name} отражает удар (${shooter.name})`, { player: shooter, xg });
        }
    }

    goal(side, scorer, assister, note = '', xg = null) {
        this.score[SIDE_KEY[side]]++;
        setLegScore(this.match, this.leg, this.score);
        this.addStat(this.sides[side].team.id, scorer.number, 'goals');
        if (assister) this.addStat(this.sides[side].team.id, assister.number, 'assists');
        const parts = [`ГОЛ! ${scorer.name}`];
        if (assister) parts.push(`пас: ${assister.name}`);
        if (note) parts.push(note);
        this.log('goal', side, parts.join(' · '), { player: scorer, assister, xg });
    }

    foul(side, victimSide, victim = null) {
        const s = this.sides[side];
        // Аккуратные команды (владение) фолят реже
        const foulK = isRealistic() ? STYLES[s.style].fouls : 1;
        if (foulK < 1 && Math.random() > foulK) return;
        const offender = weightedPick(s.onPitch, p => ({ DEF: 3, MID: 2, FWD: 1, GK: 0.2 })[p.position]);
        if (!offender) return;
        this.stats.fouls[side]++;
        if (victim && this.play && this.play.side === victimSide) {
            this.play.end = { type: 'foul', offender: offender.number, victim: victim.number };
        }

        const r = Math.random();
        if (r < 0.0025) this.sendOff(side, offender, 'Прямая красная карточка');
        else if (r < 0.17) {
            offender.yellow++;
            s.yellowed.add(offender.number);
            this.stats.yellowCards[side]++;
            this.addStat(s.team.id, offender.number, 'yellowCards');
            if (offender.yellow >= 2) this.sendOff(side, offender, 'Вторая жёлтая — удаление');
            else this.log('card-yellow', side, `Жёлтая карточка — ${offender.name}`, { player: offender });
        } else {
            this.log('foul', side, `Фол — ${offender.name}`, { player: offender });
        }

        // Нарушение в штрафной — пенальти
        if (Math.random() < 0.02) this.penaltyKick(victimSide);
    }

    penaltyKick(side) {
        const field = this.sides[side].onPitch.filter(p => p.position !== 'GK');
        if (!field.length) return;
        const taker = [...field].sort((a, b) => effRating(b) - effRating(a) || (a.position === 'FWD' ? -1 : 1))[0];
        const gk = this.goalkeeper(otherSide(side));
        this.stats.shots[side]++;
        if (!this.play || this.play.side !== side) this.startPlay(side, 'foul', []);
        const play = this.play;
        const PEN_XG = 0.76;
        this.stats.xg[side] += PEN_XG;
        const shotInfo = { side, minute: this.minute, r: 89.5, y: 50, xg: PEN_XG, result: "pen-miss", penalty: true, player: taker.number, name: taker.name, keeper: gk ? gk.number : null };
        this.shotLog.push(shotInfo);
        if (Math.random() < clamp(0.76 + (effRating(taker) - effRating(gk)) * 0.005, 0.6, 0.9)) {
            this.stats.shotsOnTarget[side]++;
            shotInfo.result = 'pen-goal';
            play.end = { ...(play.end || {}), type: 'penalty-goal', taker: taker.number };
            this.goal(side, taker, null, 'с пенальти', PEN_XG);
        } else {
            play.end = { ...(play.end || {}), type: 'penalty-miss', taker: taker.number };
            this.log('penalty-miss', side, `Пенальти не забит — ${taker.name}`, { player: taker });
        }
    }

    // Статистика игроков: кубковые голы — в отдельную таблицу кубка
    addStat(teamId, number, field) {
        if (this.match.cup) addCupStat(teamId, number, field);
        else addPlayerStat(teamId, number, field);
    }

    // ----- Оценки игроков за матч (3–10), как в спортивных приложениях -----
    // Голы, передачи, качество ударов (xG), сейвы, пропущенные, «сухарь», карточки, результат команды
    playerRatings() {
        const out = [];
        ['team1', 'team2'].forEach(side => {
            const s = this.sides[side], opp = otherSide(side);
            const my = this.score[SIDE_KEY[side]], their = this.score[SIDE_KEY[opp]];
            const result = my > their ? 0.3 : (my < their ? -0.3 : 0);
            const seen = new Set();
            [...s.onPitch, ...s.subbedOff, ...s.sentOff].forEach(p => {
                if (seen.has(p.number)) return;
                seen.add(p.number);
                const mine = e => e.side === side && e.player && e.player.number === p.number;
                let r = 6.3 + result;
                this.events.forEach(e => {
                    if (e.type === 'goal' && mine(e)) r += String(e.text).includes('пенальти') ? 0.6 : 1.0;
                    if (e.type === 'goal' && e.side === side && e.assister && e.assister.number === p.number) r += 0.6;
                    if (e.type === 'card-yellow' && mine(e)) r -= 0.3;
                    if (e.type === 'card-red' && mine(e)) r -= 1.5;
                });
                let shots = 0;
                this.shotLog.forEach(sh => {
                    if (sh.side === side && sh.player === p.number) {
                        shots++;
                        r += sh.xg * 1.2 + (sh.result === 'save' ? 0.08 : 0);
                    }
                    if (sh.side === opp && sh.keeper === p.number && p.position === 'GK') {
                        if (sh.result === 'save') r += 0.3;
                        if (sh.result === 'goal' || sh.result === 'pen-goal') r -= 0.4;
                    }
                });
                if (p.position === 'GK' && their === 0) r += 0.6;
                if (p.position === 'DEF') r += their === 0 ? 0.4 : -0.2 * their;
                if (p.position === 'MID' && their === 0) r += 0.1;
                if (p.position === 'FWD' && shots === 0) r -= 0.2;
                r += ((p.number * 37 + (side === 'team1' ? 11 : 23)) % 9 - 4) * 0.05; // небольшой разброс «по игре»
                out.push({ side, number: p.number, name: p.name, position: p.position, rating: Math.round(clamp(r, 3, 10) * 10) / 10 });
            });
        });
        return out;
    }

    // Лучший игрок матча: высшая оценка, при равенстве — из победившей команды
    manOfTheMatch() {
        const { t1, t2 } = this.score;
        const winner = t1 > t2 ? 'team1' : (t2 > t1 ? 'team2' : null);
        return this.playerRatings().sort((a, b) => b.rating - a.rating || (b.side === winner) - (a.side === winner))[0] || null;
    }

    sendOff(side, player, text) {
        const s = this.sides[side];
        s.onPitch = s.onPitch.filter(p => p !== player);
        s.sentOff.push(player);
        this.stats.redCards[side]++;
        this.addStat(s.team.id, player.number, 'redCards');
        this.log('card-red', side, `${text} — ${player.name}`, { player, lineupChanged: true });

        // Удалён вратарь: выпускаем запасного вместо полевого игрока
        if (player.position === 'GK') {
            const benchGk = s.bench.find(p => p.position === 'GK');
            const victim = [...s.onPitch].filter(p => p.position !== 'GK').sort((a, b) => a.rating - b.rating)[0];
            if (benchGk && victim && s.subsUsed < MAX_SUBS) this.substitute(side, victim, benchGk, 'вынужденная');
        }
        // Тренер перестраивает команду в меньшинстве (убирает нападающего из схемы)
        if (this.isAI(side) && s.onPitch.length >= 7) {
            this.reshape(side, s.formation, `«${s.team.name}» перестраивается в меньшинстве`);
        }
    }

    substitute(side, out, inPlayer, reason = '') {
        const s = this.sides[side];
        const idx = s.onPitch.indexOf(out);
        if (idx === -1 || s.subsUsed >= MAX_SUBS) return false;
        const fresh = { ...inPlayer, yellow: 0, x: out.x, y: out.y, baseX: out.baseX, baseY: out.baseY };
        // Выходящий занимает позицию ушедшего (вратарь — всегда в ворота)
        fresh.position = inPlayer.natPos === 'GK' ? 'GK' : (out.position === 'GK' ? 'DEF' : out.position);
        if (fresh.position === 'GK') {
            // Запасной вратарь встаёт в ворота, а не на место ушедшего полевого
            fresh.baseX = side === 'team2' ? 92 : 8;
            fresh.baseY = 50;
        }
        s.onPitch[idx] = fresh;
        s.bench = s.bench.filter(p => p !== inPlayer);
        s.subbedOff.push(out);
        s.subsUsed++;
        s.appeared.add(fresh.number);
        this.stats.substitutions[side].push({ out: out.name, in: fresh.name, minute: this.minute });
        this.log('substitution', side, `Замена${reason ? ' (' + reason + ')' : ''}: ${out.name} → ${fresh.name}`, { lineupChanged: true });
        return true;
    }

    bestBenchFor(side, position) {
        const bench = this.sides[side].bench.filter(p => p.position !== 'GK');
        const same = bench.filter(p => p.position === position);
        return [...(same.length ? same : bench)].sort((a, b) => b.rating - a.rating)[0] || null;
    }

    injury(side) {
        const s = this.sides[side];
        const field = s.onPitch.filter(p => p.position !== 'GK' && !s.injured.has(p.number));
        if (!field.length) return;
        // Уставшие травмируются чаще
        const player = weightedPick(field, p => 1 + (100 - (p.fitness ?? 100)) / 25);
        const inj = rollInjury();
        s.injured.set(player.number, inj);
        const note = inj.matches >= 6 ? ' Похоже, надолго.' : '';
        this.log('injury', side, `${player.name} травмирован (${inj.type}) — пропустит ${matchesWord(inj.matches)}.${note}`, { player, injury: inj });
        const replacement = this.bestBenchFor(side, player.position);
        if (!(replacement && this.substitute(side, player, replacement, 'травма'))) {
            player.fitness = Math.min(player.fitness ?? 100, 25); // замен не осталось — доигрывает через боль
        }
    }

    // Тренеры делают 3-5 замен во втором тайме, в первую очередь меняя уставших
    aiSubstitutions() {
        ['team1', 'team2'].forEach(side => {
            const s = this.sides[side];
            if (!s.autoSubs || this.minute < 55 || s.subsUsed >= MAX_SUBS) return;
            const chance = s.subsUsed < 3 ? 0.06 : (this.minute > 75 ? 0.03 : 0);
            if (Math.random() >= chance) return;
            const candidates = s.onPitch.filter(p => p.position !== 'GK' && !s.subbedOff.includes(p) && s.appeared.has(p.number));
            if (!candidates.length) return;
            candidates.sort((a, b) => (a.fitness - b.fitness) || (a.rating - b.rating));
            const out = candidates[Math.floor(Math.random() * Math.min(2, candidates.length))];
            const inPlayer = this.bestBenchFor(side, out.position);
            if (inPlayer) this.substitute(side, out, inPlayer);
        });
    }

    aggregateTied() {
        const m = this.match;
        if (m.legs === 2) return m.leg1.t1 + this.score.t1 === m.leg1.t2 + this.score.t2;
        return this.score.t1 === this.score.t2;
    }

    endOfPeriod() {
        if (this.phase === 'regular' && this.allowExtraTime && this.aggregateTied()) {
            this.phase = 'extra';
            this.maxMinute = 120;
            this.log('half', null, 'Ничья — назначено дополнительное время');
            return;
        }
        this.finish();
    }

    finish() {
        if (this.isOver) return;
        if (this.phase === 'extra') this.match.extraTime = true;
        this.isOver = true;
        this.phase = 'over';
        setLegScore(this.match, this.leg, this.score);
        // Оценки за матч — в форму игроков; результат — в мораль
        const ratings = this.playerRatings();
        const motm = this.manOfTheMatch();
        const strengths = { team1: this.strength('team1'), team2: this.strength('team2') };
        ['team1', 'team2'].forEach(side => {
            const s = this.sides[side];
            s.appeared.forEach(num => this.addStat(s.team.id, num, 'matches'));
            // Свежесть, восстановление, дисквалификации, форма и мораль — в состав команды
            const all = [...s.onPitch, ...s.subbedOff, ...s.sentOff];
            const my = this.score[SIDE_KEY[side]], their = this.score[SIDE_KEY[otherSide(side)]];
            const goals = new Map();
            this.events.forEach(e => { if (e.type === 'goal' && e.side === side && e.player) goals.set(e.player.number, (goals.get(e.player.number) || 0) + 1); });
            applyPostMatch(s.team, {
                served: s.served,
                endFitness: new Map(all.map(p => [p.number, p.fitness])),
                redCards: new Set(s.sentOff.map(p => p.number)),
                yellowCards: s.yellowed,
                ratings: new Map(ratings.filter(r => r.side === side).map(r => [r.number, r.rating])),
                result: my > their ? 'W' : (my < their ? 'L' : 'D'),
                margin: Math.abs(my - their),
                underdog: strengths[otherSide(side)] - strengths[side] >= 4,
                goals,
                motm: motm && motm.side === side ? motm.number : null,
                injuries: s.injured
            });
        });
        this.match.currentLeg = this.match.legs === 2 && this.leg === 1 ? 2 : this.leg;
    }

    runToEnd() {
        while (!this.isOver) this.step();
        return this;
    }
}

// ----- Результат, победитель -----
function needsShootout(m) {
    const agg = m.aggregateScore;
    return m.stage === 'playoff' && agg.t1 === agg.t2;
}

function winnerByScore(m) {
    const agg = m.aggregateScore;
    return agg.t1 > agg.t2 ? m.team1 : (agg.t2 > agg.t1 ? m.team2 : null);
}

// Прогоняет все оставшиеся игры матча. Возвращает симуляцию последней игры.
function simulateRemainingLegs(m) {
    let sim = null;
    const lastLeg = m.legs === 2 ? 2 : 1;
    for (let leg = m.legs === 2 ? m.currentLeg : 1; leg <= lastLeg; leg++) {
        sim = new MatchSimulation(m, leg).runToEnd();
        m.lastSims = (m.lastSims || []).concat(sim);
    }
    return sim;
}

// ----- Серия пенальти -----
// Удар за ударом: направление удара и прыжок вратаря. Если направления не заданы — выбираются случайно.
// Бьют игроки, оставшиеся на поле (лучшие — первыми).
const KICK_DIRS = ['left', 'center', 'right'];
const KICK_DIR_LABELS = { left: '← влево', center: '↑ по центру', right: 'вправо →' };

function randomShotDir() {
    const r = Math.random();
    return r < 0.4 ? 'left' : (r < 0.6 ? 'center' : 'right');
}

function randomDiveDir() {
    const r = Math.random();
    return r < 0.45 ? 'left' : (r < 0.55 ? 'center' : 'right');
}

class Shootout {
    constructor(m, sim) {
        this.match = m;
        const onPitchOf = side => sim ? sim.sides[side].onPitch : [];
        const takersFor = side => {
            const onPitch = onPitchOf(side);
            const field = onPitch.filter(p => p.position !== 'GK').sort((a, b) => effRating(b) - effRating(a));
            return [...field, ...onPitch.filter(p => p.position === 'GK')];
        };
        this.takers = { team1: takersFor('team1'), team2: takersFor('team2') };
        this.keepers = {
            team1: onPitchOf('team1').find(p => p.position === 'GK') || { name: 'вратарь', rating: 70 },
            team2: onPitchOf('team2').find(p => p.position === 'GK') || { name: 'вратарь', rating: 70 }
        };
        this.kicks = [];
        this.n = { team1: 0, team2: 0 };
        this.s = { team1: 0, team2: 0 };
        this.winner = null;
    }

    get isOver() { return !!this.winner; }

    nextSide() { return this.n.team1 === this.n.team2 ? 'team1' : 'team2'; }

    nextTaker() {
        const side = this.nextSide();
        const list = this.takers[side];
        return list[this.n[side] % Math.max(1, list.length)] || { name: '—', rating: 75 };
    }

    nextKeeper() { return this.keepers[otherSide(this.nextSide())]; }

    kick(shotDir = randomShotDir(), diveDir = randomDiveDir()) {
        if (this.winner) return null;
        const side = this.nextSide();
        const taker = this.nextTaker();
        const gk = this.nextKeeper();
        const skill = isRealistic() ? (effRating(taker) - effRating(gk)) * 0.005 : 0;

        let scored, note;
        if (Math.random() < 0.05) { scored = false; note = 'мимо ворот'; }
        else if (shotDir === diveDir) {
            scored = Math.random() < clamp(0.3 + skill, 0.15, 0.5);
            note = scored ? 'вратарь угадал, но не достал' : 'вратарь угадал и отбил!';
        } else {
            scored = Math.random() < clamp(0.97 + skill, 0.85, 0.99);
            note = scored ? 'вратарь прыгнул не туда' : 'в штангу!';
        }

        this.n[side]++;
        if (scored) this.s[side]++;
        const kick = { side, team: (side === 'team1' ? this.match.team1 : this.match.team2).name, player: taker.name, keeper: gk.name, shotDir, diveDir, scored, note, number: this.n[side] };
        this.kicks.push(kick);
        this.checkWinner();
        return kick;
    }

    checkWinner() {
        const { n, s } = this;
        const m = this.match;
        if (n.team1 <= 5 && n.team2 <= 5) {
            if (s.team1 > s.team2 + (5 - n.team2)) this.winner = m.team1;
            else if (s.team2 > s.team1 + (5 - n.team1)) this.winner = m.team2;
        } else if (n.team1 === n.team2 && s.team1 !== s.team2) {
            this.winner = s.team1 > s.team2 ? m.team1 : m.team2;
        }
        if (!this.winner && this.kicks.length >= 60) this.winner = Math.random() < 0.5 ? m.team1 : m.team2;
    }

    result() {
        return { kicks: this.kicks, t1: this.s.team1, t2: this.s.team2, winner: this.winner };
    }
}

// Вся серия сразу (для автосимуляции и «быстрого результата»)
function computeShootout(m, sim) {
    const so = new Shootout(m, sim);
    while (!so.isOver) so.kick();
    return so.result();
}

function applyShootout(m, shootout) {
    m.penalties = { t1: shootout.t1, t2: shootout.t2, kicks: shootout.kicks };
}

// ----- Завершение матча (без UI) -----
function completeMatch(m, winner) {
    m.isFinished = true;
    m.winner = winner;
    m.lastSims = null; // симуляции больше не нужны

    const agg = m.aggregateScore;
    const isDraw = agg.t1 === agg.t2;
    if (m.cup) {
        // Кубок: только форма команд, таблица лиги не меняется
        updateTeamForm(m.team1, agg.t1, agg.t2, isDraw ? null : winner === m.team1);
        updateTeamForm(m.team2, agg.t2, agg.t1, isDraw ? null : winner === m.team2);
        return;
    }
    updateTeamStats(m.team1, agg.t1, agg.t2, isDraw ? null : winner === m.team1);
    updateTeamStats(m.team2, agg.t2, agg.t1, isDraw ? null : winner === m.team2);

    if (isCareer() && m.stage === 'playoff' && m.involves(state.userTeam) && winner !== state.userTeam) {
        state.userTeamEliminated = true;
    }
}

function autoSimulateMatch(m) {
    const sim = simulateRemainingLegs(m);
    let winner = winnerByScore(m);
    if (needsShootout(m)) {
        const shootout = computeShootout(m, sim);
        applyShootout(m, shootout);
        winner = shootout.winner;
    }
    m.isAutoSimulated = true;
    completeMatch(m, winner);
}

function autoSimulateAllRemainingMatches(filter = () => true) {
    state.matches.forEach(m => { if (!m.isFinished && filter(m)) autoSimulateMatch(m); });
}

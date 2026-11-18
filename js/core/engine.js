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
    const roster = starters.map(p => ({ ...p, number: number++, rating: rate(p, true), starter: true }));
    Object.keys(lineIndex).forEach(k => delete lineIndex[k]); // у скамейки своя нумерация по линиям
    roster.push(...benchPool.map(p => ({ ...p, number: number++, rating: rate(p, false), starter: false })));
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
            substitutions: { team1: [], team2: [] }
        };
        this.sides = {
            team1: this.createSide(match.team1, 'team1'),
            team2: this.createSide(match.team2, 'team2')
        };
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
            style: squad.style,
            autoSubs: true,
            subsUsed: 0,
            sentOff: [],
            subbedOff: [],
            yellowed: new Set(),
            appeared: new Set(onPitch.map(p => p.number)),
            served: new Set(players.filter(p => !isAvailable(p)).map(p => p.number)) // отбывают дисквалификацию
        };
    }

    setStyle(side, style) {
        if (!STYLES[style]) return;
        this.sides[side].style = style;
        this.log('half', side, `Тактика: ${STYLES[style].label}`);
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

    // Доля атак team1: зависит от силы составов и фактора своего поля
    team1AttackProbability() {
        let p = 0.5 + (this.strength('team1') - this.strength('team2')) * 0.012;
        if (isRealistic() && this.homeSide) p += this.homeSide === 'team1' ? 0.04 : -0.04;
        p += STYLES[this.sides.team1.style].attackShare - STYLES[this.sides.team2.style].attackShare;
        return clamp(p, 0.25, 0.75);
    }

    // Поправка к реализации моментов от тактики обеих команд
    finishBonus(side) {
        return STYLES[this.sides[side].style].ownFinish + STYLES[this.sides[otherSide(side)].style].oppFinish;
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

        if (attack) this.playAttack(this.attackingSide);
        this.tire();
        if (Math.random() < 0.0025) this.injury(Math.random() < 0.5 ? 'team1' : 'team2');
        this.aiSubstitutions();

        if (this.minute === 45) this.log('half', null, `Перерыв: ${this.score.t1}:${this.score.t2}`);
        if (this.minute >= this.maxMinute) this.endOfPeriod();
        return this.newEvents;
    }

    playAttack(side) {
        const roll = Math.random();
        if (roll < 0.42) this.shot(side, 'open');
        else if (roll < 0.60) {
            this.stats.corners[side]++;
            this.log('corner', side, 'Угловой');
            if (Math.random() < 0.35) this.shot(side, 'corner');
        } else if (roll < 0.92) this.foul(otherSide(side), side);
    }

    pickShooter(side, kind) {
        const field = this.sides[side].onPitch.filter(p => p.position !== 'GK');
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

    shot(side, kind) {
        const shooter = this.pickShooter(side, kind);
        if (!shooter) return;
        this.stats.shots[side]++;
        const onTarget = Math.random() < clamp(0.35 + (effRating(shooter) - 80) * 0.004, 0.22, 0.5);
        if (!onTarget) {
            this.log('shot-off', side, `Удар мимо — ${shooter.name}`, { player: shooter });
            return;
        }
        this.stats.shotsOnTarget[side]++;
        const gk = this.goalkeeper(otherSide(side));
        const pGoal = clamp(0.29 + (effRating(shooter) - effRating(gk)) * 0.004 + this.finishBonus(side), 0.12, 0.5);
        if (Math.random() < pGoal) {
            const assister = Math.random() < 0.75 ? this.pickAssister(side, shooter) : null;
            this.goal(side, shooter, assister, kind === 'corner' ? 'после углового' : '');
        } else {
            this.log('shot', side, `${gk.name} отражает удар (${shooter.name})`, { player: shooter });
        }
    }

    goal(side, scorer, assister, note = '') {
        this.score[SIDE_KEY[side]]++;
        setLegScore(this.match, this.leg, this.score);
        addPlayerStat(this.sides[side].team.id, scorer.number, 'goals');
        if (assister) addPlayerStat(this.sides[side].team.id, assister.number, 'assists');
        const parts = [`ГОЛ! ${scorer.name}`];
        if (assister) parts.push(`пас: ${assister.name}`);
        if (note) parts.push(note);
        this.log('goal', side, parts.join(' · '), { player: scorer, assister });
    }

    foul(side, victimSide) {
        const s = this.sides[side];
        const offender = weightedPick(s.onPitch, p => ({ DEF: 3, MID: 2, FWD: 1, GK: 0.2 })[p.position]);
        if (!offender) return;
        this.stats.fouls[side]++;

        const r = Math.random();
        if (r < 0.004) this.sendOff(side, offender, 'Прямая красная карточка');
        else if (r < 0.17) {
            offender.yellow++;
            s.yellowed.add(offender.number);
            this.stats.yellowCards[side]++;
            addPlayerStat(s.team.id, offender.number, 'yellowCards');
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
        if (Math.random() < clamp(0.76 + (effRating(taker) - effRating(gk)) * 0.005, 0.6, 0.9)) {
            this.stats.shotsOnTarget[side]++;
            this.goal(side, taker, null, 'с пенальти');
        } else {
            this.log('penalty-miss', side, `Пенальти не забит — ${taker.name}`, { player: taker });
        }
    }

    sendOff(side, player, text) {
        const s = this.sides[side];
        s.onPitch = s.onPitch.filter(p => p !== player);
        s.sentOff.push(player);
        this.stats.redCards[side]++;
        addPlayerStat(s.team.id, player.number, 'redCards');
        this.log('card-red', side, `${text} — ${player.name}`, { player, lineupChanged: true });

        // Удалён вратарь: выпускаем запасного вместо полевого игрока
        if (player.position === 'GK') {
            const benchGk = s.bench.find(p => p.position === 'GK');
            const victim = [...s.onPitch].filter(p => p.position !== 'GK').sort((a, b) => a.rating - b.rating)[0];
            if (benchGk && victim && s.subsUsed < MAX_SUBS) this.substitute(side, victim, benchGk, 'вынужденная');
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
        const field = s.onPitch.filter(p => p.position !== 'GK');
        if (!field.length) return;
        const player = field[Math.floor(Math.random() * field.length)];
        this.log('injury', side, `Травма — ${player.name}`, { player });
        const replacement = this.bestBenchFor(side, player.position);
        if (replacement) this.substitute(side, player, replacement, 'травма');
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
        ['team1', 'team2'].forEach(side => {
            const s = this.sides[side];
            s.appeared.forEach(num => addPlayerStat(s.team.id, num, 'matches'));
            // Свежесть, восстановление и дисквалификации — в состав команды
            const all = [...s.onPitch, ...s.subbedOff, ...s.sentOff];
            applyPostMatch(s.team, {
                served: s.served,
                endFitness: new Map(all.map(p => [p.number, p.fitness])),
                redCards: new Set(s.sentOff.map(p => p.number)),
                yellowCards: s.yellowed
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

// ===== ДВИЖОК МАТЧА: составы, счёт, события, пенальти =====
// Здесь нет работы с DOM — только расчёты. Отрисовкой занимается js/ui/match.js.

// ----- Составы -----
const FORMATION_4_4_2 = {
    goalkeepers: [{ x: 8, y: 50 }],
    defenders:   [{ x: 20, y: 25 }, { x: 18, y: 42 }, { x: 18, y: 58 }, { x: 20, y: 75 }],
    midfielders: [{ x: 40, y: 30 }, { x: 38, y: 50 }, { x: 38, y: 70 }, { x: 45, y: 50 }],
    forwards:    [{ x: 60, y: 40 }, { x: 60, y: 60 }]
};
const POSITION_CODES = { goalkeepers: 'GK', defenders: 'DEF', midfielders: 'MID', forwards: 'FWD' };

// isHome: хозяева играют слева направо, гости — зеркально
function generateTeamSquad(teamName, teamId, isHome = true) {
    const origin = getTeamOrigin(teamName);
    const playersData = (typeof SQUADS !== 'undefined' && SQUADS[origin] && SQUADS[origin][teamName])
        || fallbackPlayerNames[origin];

    const squad = [];
    let number = 1;
    Object.keys(FORMATION_4_4_2).forEach(line => {
        FORMATION_4_4_2[line].forEach((pos, idx) => {
            const name = playersData[line] && playersData[line][idx];
            if (!name) return;
            const x = isHome ? pos.x : 100 - pos.x;
            squad.push({
                number: number++, name, position: POSITION_CODES[line],
                x, y: pos.y, baseX: x, baseY: pos.y,
                isGoalkeeper: line === 'goalkeepers',
                team: teamId
            });
        });
    });
    return squad;
}

function ensureSquads(match) {
    if (!match.squad1) {
        match.squad1 = generateTeamSquad(match.team1.name, match.team1.id, true);
        match.squad2 = generateTeamSquad(match.team2.name, match.team2.id, false);
    }
}

function fieldPlayersOf(squad) {
    return squad.filter(p => p.position !== 'GK');
}

// ----- Кто забил / отдал пас (взвешенно по позициям) -----
function pickFromGroups(groups, roll) {
    for (const [threshold, list] of groups) {
        if (roll < threshold && list.length > 0) return list[Math.floor(Math.random() * list.length)];
    }
    const any = groups.flatMap(g => g[1]);
    return any.length ? any[Math.floor(Math.random() * any.length)] : null;
}

function selectGoalScorer(fieldPlayers) {
    const by = pos => fieldPlayers.filter(p => p.position === pos);
    // 70% нападающие, 25% полузащитники, 5% защитники
    return pickFromGroups([[70, by('FWD')], [95, by('MID')], [101, by('DEF')]], Math.random() * 100)
        || fieldPlayers[0];
}

function selectAssistProvider(fieldPlayers, scorer) {
    const by = pos => fieldPlayers.filter(p => p.position === pos && p.number !== scorer.number);
    // 45% нападающие, 45% полузащитники, 10% защитники
    return pickFromGroups([[45, by('FWD')], [90, by('MID')], [101, by('DEF')]], Math.random() * 100);
}

// Записывает гол (и ассист с вероятностью 85%) в статистику игроков
function recordGoal(teamId, fieldPlayers) {
    const scorer = selectGoalScorer(fieldPlayers);
    addPlayerStat(teamId, scorer.number, 'goals');
    let assister = null;
    if (Math.random() < 0.85) {
        assister = selectAssistProvider(fieldPlayers, scorer);
        if (assister) addPlayerStat(teamId, assister.number, 'assists');
    }
    return { scorer, assister };
}

// ----- Счёт -----
function scoreForTeam(teamRating, opponentRating) {
    if (state.settings.simMode === 'random') {
        return Math.floor(Math.random() * 7); // кубик 0-6
    }
    // Реализм: ожидаемые голы по разнице рейтингов + распределение Пуассона
    const expected = Math.max(0.3, 1.4 + ((teamRating || 75) - (opponentRating || 75)) * 0.08);
    const L = Math.exp(-expected);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return Math.min(7, k - 1);
}

// Вероятность, что эпизод разыгрывает team1 (в «реализме» зависит от рейтинга)
function getTeam1EdgeProbability(m) {
    if (state.settings.simMode !== 'realistic') return 0.5;
    const diff = (m.team1.rating || 75) - (m.team2.rating || 75);
    return Math.max(0.25, Math.min(0.75, 0.5 + diff * 0.015));
}

// Мгновенно рассчитывает счёт оставшихся таймов/матчей и записывает голы игрокам
function simulateMatchScore(m) {
    ensureSquads(m);
    const f1 = fieldPlayersOf(m.squad1), f2 = fieldPlayersOf(m.squad2);
    const play = (leg) => {
        leg.t1 = scoreForTeam(m.team1.rating, m.team2.rating);
        leg.t2 = scoreForTeam(m.team2.rating, m.team1.rating);
        for (let i = 0; i < leg.t1; i++) recordGoal(m.team1.id, f1);
        for (let i = 0; i < leg.t2; i++) recordGoal(m.team2.id, f2);
    };
    if (m.legs === 2) {
        if (m.currentLeg === 1) play(m.leg1);
        play(m.leg2);
        m.currentLeg = 2;
    } else {
        const leg = { t1: 0, t2: 0 };
        play(leg);
        m.score1 = leg.t1; m.score2 = leg.t2;
    }
}

function needsShootout(m) {
    const agg = m.aggregateScore;
    return m.stage === 'playoff' && agg.t1 === agg.t2;
}

function winnerByScore(m) {
    const agg = m.aggregateScore;
    return agg.t1 > agg.t2 ? m.team1 : (agg.t2 > agg.t1 ? m.team2 : null);
}

// ----- Серия пенальти -----
// Возвращает полную последовательность ударов; анимировать её — задача UI.
function computeShootout(m) {
    const chance = (team, opp) => state.settings.simMode === 'realistic'
        ? Math.max(0.5, Math.min(0.9, 0.75 + (team.rating - opp.rating) * 0.008))
        : 0.75;
    const p1 = chance(m.team1, m.team2), p2 = chance(m.team2, m.team1);
    const kicks = [];
    let k1 = 0, k2 = 0, s1 = 0, s2 = 0, winner = null;

    while (!winner) {
        const first = k1 === k2;
        const scored = Math.random() < (first ? p1 : p2);
        if (first) { k1++; if (scored) s1++; } else { k2++; if (scored) s2++; }
        kicks.push({ side: first ? 'team1' : 'team2', team: (first ? m.team1 : m.team2).name, scored, number: first ? k1 : k2 });

        if (k1 <= 5 && k2 <= 5) {
            // Досрочное окончание основной серии
            if (s1 > s2 + (5 - k2)) winner = m.team1;
            else if (s2 > s1 + (5 - k1)) winner = m.team2;
        } else if (k1 === k2 && s1 !== s2) {
            winner = s1 > s2 ? m.team1 : m.team2; // «до первого промаха»
        }
        if (!winner && kicks.length >= 40) winner = Math.random() < 0.5 ? m.team1 : m.team2;
    }
    return { kicks, t1: s1, t2: s2, winner };
}

function applyShootout(m, shootout) {
    m.penalties = { t1: shootout.t1, t2: shootout.t2, kicks: shootout.kicks };
}

// ----- Завершение матча (без UI) -----
function completeMatch(m, winner) {
    m.isFinished = true;
    m.winner = winner;
    ensureSquads(m);
    m.squad1.forEach(p => addPlayerStat(m.team1.id, p.number, 'matches'));
    m.squad2.forEach(p => addPlayerStat(m.team2.id, p.number, 'matches'));

    const agg = m.aggregateScore;
    const isDraw = agg.t1 === agg.t2;
    updateTeamStats(m.team1, agg.t1, agg.t2, isDraw ? null : winner === m.team1);
    updateTeamStats(m.team2, agg.t2, agg.t1, isDraw ? null : winner === m.team2);

    if (isCareer() && m.stage === 'playoff' && m.involves(state.userTeam) && winner !== state.userTeam) {
        state.userTeamEliminated = true;
    }
}

function autoSimulateMatch(m) {
    simulateMatchScore(m);
    let winner = winnerByScore(m);
    if (needsShootout(m)) {
        const shootout = computeShootout(m);
        applyShootout(m, shootout);
        winner = shootout.winner;
    }
    m.isAutoSimulated = true;
    completeMatch(m, winner);
    m.squad1 = m.squad2 = null; // экономим память — составы легко пересоздать
}

function autoSimulateAllRemainingMatches(filter = () => true) {
    state.matches.forEach(m => { if (!m.isFinished && filter(m)) autoSimulateMatch(m); });
}

// ----- События живого матча -----
function initMatchStats(match) {
    match.stats = {
        possession: { team1: 50, team2: 50 },
        shots: { team1: 0, team2: 0 },
        shotsOnTarget: { team1: 0, team2: 0 },
        corners: { team1: 0, team2: 0 },
        fouls: { team1: 0, team2: 0 },
        yellowCards: { team1: 0, team2: 0 },
        redCards: { team1: 0, team2: 0 },
        substitutions: { team1: [], team2: [] }
    };
}

// Генерирует случайное событие минуты и обновляет match.stats.
// Возвращает { type, side, team, ... } или null.
function generateRandomEvent(match, min) {
    const rand = Math.random();
    const side = Math.random() < getTeam1EdgeProbability(match) ? 'team1' : 'team2';
    const team = side === 'team1' ? match.team1 : match.team2;
    const s = match.stats;

    // Команда в большинстве атакует чаще
    const redDiff = s.redCards.team1 - s.redCards.team2;
    let adv = 0;
    if (redDiff < 0) adv = side === 'team1' ? 0.1 : -0.1;
    else if (redDiff > 0) adv = side === 'team2' ? 0.1 : -0.1;

    if (rand < 0.15 + adv) {
        s.shots[side]++;
        if (Math.random() < 0.4) {
            s.shotsOnTarget[side]++;
            return { type: Math.random() < 0.5 ? 'goal' : 'shot', side, team };
        }
        return { type: 'shot-off', side, team };
    }
    if (rand < 0.20) {
        s.corners[side]++;
        return { type: 'corner', side, team };
    }
    if (rand < 0.30) {
        s.fouls[side]++;
        if (Math.random() < 0.2) {
            const card = Math.random() < 0.85 ? 'yellow' : 'red';
            if (card === 'yellow') s.yellowCards[side]++; else s.redCards[side]++;
            return { type: `card-${card}`, side, team };
        }
        return { type: 'foul', side, team };
    }
    if (min > 60 && rand < 0.33 && s.substitutions[side].length < 3) {
        const squad = side === 'team1' ? match.squad1 : match.squad2;
        const out = squad[Math.floor(Math.random() * squad.length)];
        const inNumber = 12 + s.substitutions[side].length;
        s.substitutions[side].push({ out: out.number, in: inNumber, minute: min });
        return { type: 'substitution', side, team, out: out.number, in: inNumber };
    }
    return null;
}

// Гол в живом матче: обновляет счёт текущей игры и статистику игроков
function applyLiveGoal(m, side) {
    const team = side === 'team1' ? m.team1 : m.team2;
    const squad = side === 'team1' ? m.squad1 : m.squad2;
    const key = side === 'team1' ? 't1' : 't2';
    if (m.legs === 2) (m.currentLeg === 1 ? m.leg1 : m.leg2)[key]++;
    else if (side === 'team1') m.score1++; else m.score2++;
    return recordGoal(team.id, fieldPlayersOf(squad));
}

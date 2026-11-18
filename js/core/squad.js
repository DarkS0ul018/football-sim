// ===== СОСТАВ КОМАНДЫ МЕЖДУ МАТЧАМИ =====
// Схема, стиль, стартовый состав, свежесть игроков и дисквалификации живут весь турнир.
// Статические данные игроков (имя, позиция, рейтинг) — в getTeamRoster (engine.js).

const FORMATIONS = {
    '4-4-2': [['GK', 8, 50], ['DEF', 20, 22], ['DEF', 18, 41], ['DEF', 18, 59], ['DEF', 20, 78],
              ['MID', 40, 25], ['MID', 37, 43], ['MID', 37, 57], ['MID', 40, 75], ['FWD', 58, 40], ['FWD', 58, 60]],
    '4-3-3': [['GK', 8, 50], ['DEF', 20, 22], ['DEF', 18, 41], ['DEF', 18, 59], ['DEF', 20, 78],
              ['MID', 38, 30], ['MID', 35, 50], ['MID', 38, 70], ['FWD', 58, 22], ['FWD', 61, 50], ['FWD', 58, 78]],
    '4-2-3-1': [['GK', 8, 50], ['DEF', 20, 22], ['DEF', 18, 41], ['DEF', 18, 59], ['DEF', 20, 78],
              ['MID', 32, 40], ['MID', 32, 60], ['MID', 45, 22], ['MID', 47, 50], ['MID', 45, 78], ['FWD', 61, 50]],
    '5-3-2': [['GK', 8, 50], ['DEF', 22, 14], ['DEF', 18, 32], ['DEF', 17, 50], ['DEF', 18, 68], ['DEF', 22, 86],
              ['MID', 38, 30], ['MID', 36, 50], ['MID', 38, 70], ['FWD', 56, 40], ['FWD', 56, 60]],
    '3-5-2': [['GK', 8, 50], ['DEF', 18, 30], ['DEF', 17, 50], ['DEF', 18, 70],
              ['MID', 40, 12], ['MID', 35, 35], ['MID', 32, 50], ['MID', 35, 65], ['MID', 40, 88], ['FWD', 57, 40], ['FWD', 57, 60]]
};

const STYLES = {
    attack:  { label: '⚔️ Атака',  hint: 'Больше атак и голов, но и пропускаете чаще. Игроки устают быстрее.', attackShare: 0.05, ownFinish: 0.02, oppFinish: 0.03, fatigue: 1.25 },
    balance: { label: '⚖️ Баланс', hint: 'Обычная игра.', attackShare: 0, ownFinish: 0, oppFinish: 0, fatigue: 1 },
    defense: { label: '🛡️ Оборона', hint: 'Меньше атак, но и соперник забивает реже. Экономит силы.', attackShare: -0.05, ownFinish: -0.02, oppFinish: -0.04, fatigue: 0.85 }
};

const YELLOWS_FOR_BAN = 2; // две жёлтые в разных матчах = пропуск следующего

// Штраф за игру не на своей позиции
function positionPenalty(natural, slot) {
    if (natural === slot) return 0;
    if (slot === 'GK' || natural === 'GK') return 30;
    const order = { DEF: 0, MID: 1, FWD: 2 };
    return Math.abs(order[natural] - order[slot]) === 1 ? 5 : 10;
}

// Рейтинг игрока с учётом свежести и позиции (используется и в составе, и в матче)
function effectiveRating(player, slot = player.natPos || player.position) {
    const fatigue = (100 - (player.fitness ?? 100)) * 0.15;
    return player.rating - fatigue - positionPenalty(player.natPos || player.position, slot);
}

function initSquads() {
    state.squads = {};
    state.teams.forEach(team => {
        const players = {};
        getTeamRoster(team.name, team.rating).forEach(p => {
            players[p.number] = { fitness: 100, suspended: 0, yellowAcc: 0 };
        });
        state.squads[team.id] = { formation: '4-4-2', style: 'balance', lineup: [], players };
        state.squads[team.id].lineup = autoLineup(team);
    });
}

function getSquad(team) {
    return state.squads[team.id];
}

// Полный список игроков команды: статика + текущее состояние
function getSquadPlayers(team) {
    const squad = getSquad(team);
    return getTeamRoster(team.name, team.rating).map(p => ({ ...p, natPos: p.position, ...squad.players[p.number] }));
}

function isAvailable(p) {
    return !p.suspended;
}

// Лучший доступный состав под схему: жадно по слотам, вратарь и нападающие — первыми
function autoLineup(team, formation = getSquad(team).formation) {
    const slots = FORMATIONS[formation];
    const pool = getSquadPlayers(team).filter(isAvailable);
    const lineup = new Array(slots.length).fill(null);
    const order = slots.map((s, i) => i).sort((a, b) => ['GK', 'FWD', 'DEF', 'MID'].indexOf(slots[a][0]) - ['GK', 'FWD', 'DEF', 'MID'].indexOf(slots[b][0]));
    order.forEach(i => {
        const slot = slots[i][0];
        pool.sort((a, b) => effectiveRating(b, slot) - effectiveRating(a, slot));
        const pick = pool.shift();
        lineup[i] = pick ? pick.number : null;
    });
    return lineup;
}

// Проверяет состав перед матчем: дисквалифицированных заменяет автоматически.
// Возвращает список замен для показа игроку.
function validateLineup(team) {
    const squad = getSquad(team);
    const players = getSquadPlayers(team);
    const byNum = Object.fromEntries(players.map(p => [p.number, p]));
    const slots = FORMATIONS[squad.formation];
    const changes = [];
    const used = new Set(squad.lineup.filter(n => n !== null && byNum[n] && isAvailable(byNum[n])));
    squad.lineup = squad.lineup.map((num, i) => {
        if (num !== null && byNum[num] && isAvailable(byNum[num])) return num;
        const slot = slots[i][0];
        const pick = players.filter(p => isAvailable(p) && !used.has(p.number))
            .sort((a, b) => effectiveRating(b, slot) - effectiveRating(a, slot))[0];
        if (!pick) return null;
        used.add(pick.number);
        if (num !== null && byNum[num]) changes.push(`${byNum[num].name} дисквалифицирован → ${pick.name}`);
        return pick.number;
    });
    return changes;
}

function setFormation(team, formation) {
    const squad = getSquad(team);
    squad.formation = formation;
    squad.lineup = autoLineup(team, formation);
}

// Перед матчем ИИ выбирает лучший состав (с учётом усталости — получается ротация)
function prepareTeamForMatch(team) {
    if (isCareer() && state.userTeam && team.id === state.userTeam.id) validateLineup(team);
    else getSquad(team).lineup = autoLineup(team);
}

// Средняя сила стартового состава
function lineupStrength(team) {
    const squad = getSquad(team);
    const byNum = Object.fromEntries(getSquadPlayers(team).map(p => [p.number, p]));
    const slots = FORMATIONS[squad.formation];
    const vals = squad.lineup.map((n, i) => byNum[n] ? effectiveRating(byNum[n], slots[i][0]) : 40);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// После игры: свежесть, восстановление, дисквалификации
function applyPostMatch(team, report) {
    const squad = getSquad(team);
    Object.entries(squad.players).forEach(([num, p]) => {
        num = Number(num);
        if (report.served.has(num)) p.suspended = Math.max(0, p.suspended - 1);
        // Сыгравшие восстанавливаются не полностью — при игре без ротации свежесть понемногу падает
        if (report.endFitness.has(num)) p.fitness = Math.min(100, report.endFitness.get(num) + 17);
        else p.fitness = Math.min(100, p.fitness + 30);
        if (report.redCards.has(num)) { p.suspended += 1; }
        else if (report.yellowCards.has(num)) {
            p.yellowAcc++;
            if (p.yellowAcc >= YELLOWS_FOR_BAN) { p.suspended += 1; p.yellowAcc = 0; }
        }
    });
}

// Свежесть для показа: 🟢 / 🟡 / 🔴
function fitnessColor(f) {
    return f >= 85 ? 'var(--success)' : (f >= 70 ? 'var(--gold)' : 'var(--highlight)');
}

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
              ['MID', 40, 12], ['MID', 35, 35], ['MID', 32, 50], ['MID', 35, 65], ['MID', 40, 88], ['FWD', 57, 40], ['FWD', 57, 60]],
    '3-4-3': [['GK', 8, 50], ['DEF', 18, 30], ['DEF', 17, 50], ['DEF', 18, 70],
              ['MID', 38, 14], ['MID', 35, 40], ['MID', 35, 60], ['MID', 38, 86], ['FWD', 57, 24], ['FWD', 60, 50], ['FWD', 57, 76]],
    '3-4-2-1': [['GK', 8, 50], ['DEF', 18, 30], ['DEF', 17, 50], ['DEF', 18, 70],
              ['MID', 38, 14], ['MID', 33, 40], ['MID', 33, 60], ['MID', 38, 86], ['MID', 48, 36], ['MID', 48, 64], ['FWD', 60, 50]],
    '4-1-4-1': [['GK', 8, 50], ['DEF', 20, 22], ['DEF', 18, 41], ['DEF', 18, 59], ['DEF', 20, 78],
              ['MID', 30, 50], ['MID', 43, 18], ['MID', 40, 40], ['MID', 40, 60], ['MID', 43, 82], ['FWD', 60, 50]]
};

// Стили: attackShare — доля атак; ownFinish — реализация своих моментов;
// oppFinish — насколько легче забивать сопернику; fatigue — усталость; fouls — частота фолов
const STYLES = {
    possession: { label: '🎯 Владение',  hint: 'Контроль мяча и терпеливые атаки. Соперник реже доходит до ворот, но прессинг мешает строить игру.', attackShare: 0.04, ownFinish: -0.01, oppFinish: -0.01, fatigue: 0.95, fouls: 0.85 },
    pressing:   { label: '🔥 Прессинг',  hint: 'Отбор высоко у чужих ворот. Много атак, но игроки быстро устают и чаще фолят.', attackShare: 0.03, ownFinish: 0.01, oppFinish: -0.01, fatigue: 1.35, fouls: 1.25 },
    counter:    { label: '⚡ Контратака', hint: 'Отдаём мяч и бьём на скорости. Атак меньше, но они опаснее — особенно против высокой линии.', attackShare: -0.04, ownFinish: 0.03, oppFinish: -0.02, fatigue: 0.95, fouls: 1.05 },
    balance:    { label: '⚖️ Баланс',    hint: 'Обычная игра.', attackShare: 0, ownFinish: 0, oppFinish: 0, fatigue: 1, fouls: 1 },
    attack:     { label: '⚔️ Атака',     hint: 'Все вперёд: больше атак и голов, но и пропускаете чаще. Игроки устают быстрее.', attackShare: 0.05, ownFinish: 0.02, oppFinish: 0.03, fatigue: 1.25, fouls: 1 },
    defense:    { label: '🛡️ Оборона',   hint: 'Автобус у своих ворот: атак мало, но и соперник забивает реже. Экономит силы.', attackShare: -0.05, ownFinish: -0.02, oppFinish: -0.04, fatigue: 0.85, fouls: 1.1 }
};

// Высота линии обороны: высокая помогает давить, но открывает спину для контратак
const LINES = {
    high: { label: '⬆️ Высокая', hint: 'Команда играет высоко: больше владения у чужих ворот, но за спиной много места.', attackShare: 0.02, oppFinish: 0.02, shift: 6 },
    mid:  { label: '➡️ Средняя', hint: 'Обычная высота.', attackShare: 0, oppFinish: 0, shift: 0 },
    low:  { label: '⬇️ Низкая',  hint: 'Глубокий блок у своей штрафной: соперник реже создаёт моменты, но и своих атак меньше.', attackShare: -0.02, oppFinish: -0.02, shift: -7 }
};

const YELLOWS_FOR_BAN = 2; // две жёлтые в разных матчах = пропуск следующего

// Штраф за игру не на своей позиции
function positionPenalty(natural, slot) {
    if (natural === slot) return 0;
    if (slot === 'GK' || natural === 'GK') return 30;
    const order = { DEF: 0, MID: 1, FWD: 2 };
    return Math.abs(order[natural] - order[slot]) === 1 ? 5 : 10;
}

// Рейтинг игрока с учётом свежести, позиции, формы и морали (используется и в составе, и в матче)
function effectiveRating(player, slot = player.natPos || player.position) {
    const fatigue = (100 - (player.fitness ?? 100)) * 0.15;
    return player.rating - fatigue - positionPenalty(player.natPos || player.position, slot)
        + formBonus(player) + moraleBonus(player);
}

// ----- Форма и мораль -----
// Форма — средняя оценка за последние матчи (оценки 3–10 из движка).
// Мораль (5–100) растёт от побед, игрового времени и ярких матчей, падает от поражений и скамейки;
// со временем возвращается к обычной (65).
const MORALE_DEFAULT = 65;
const FORM_LEN = 5;   // сколько последних оценок хранится
const FORM_AVG = 3;   // по скольким считается форма

function playerForm(p) {
    const f = p.form;
    if (!f || !f.length) return null;
    const last = f.slice(-FORM_AVG);
    return last.reduce((a, b) => a + b, 0) / last.length;
}

function formBonus(p) {
    const f = playerForm(p);
    return f === null ? 0 : Math.max(-2, Math.min(2, (f - 6.5) * 1.0));
}

function moraleBonus(p) {
    const m = p.morale ?? MORALE_DEFAULT;
    return Math.max(-2, Math.min(1.5, (m - MORALE_DEFAULT) / 15));
}

const MORALE_LEVELS = [
    { min: 85, label: 'Отличная', icon: '😄', cls: 'm-top' },
    { min: 70, label: 'Хорошая', icon: '🙂', cls: 'm-good' },
    { min: 50, label: 'Нормальная', icon: '😐', cls: 'm-ok' },
    { min: 30, label: 'Плохая', icon: '🙁', cls: 'm-bad' },
    { min: 0, label: 'Ужасная', icon: '😠', cls: 'm-awful' }
];

function moraleInfo(value = MORALE_DEFAULT) {
    return MORALE_LEVELS.find(l => value >= l.min) || MORALE_LEVELS[MORALE_LEVELS.length - 1];
}

// Стрелка формы: ▲ на подъёме, ▼ на спаде
function formInfo(p) {
    const f = playerForm(p);
    if (f === null) return { arrow: '–', cls: 'f-none', label: 'Нет матчей', value: null };
    if (f >= 7.4) return { arrow: '▲▲', cls: 'f-hot', label: 'Блестящая форма', value: f };
    if (f >= 6.9) return { arrow: '▲', cls: 'f-up', label: 'Хорошая форма', value: f };
    if (f > 6.1) return { arrow: '●', cls: 'f-flat', label: 'Обычная форма', value: f };
    if (f > 5.6) return { arrow: '▼', cls: 'f-down', label: 'Спад', value: f };
    return { arrow: '▼▼', cls: 'f-cold', label: 'Глубокий спад', value: f };
}

// Мораль команды — средняя по 14 сильнейшим игрокам заявки
function teamMorale(team) {
    const squad = getSquad(team);
    if (!squad) return MORALE_DEFAULT;
    const players = getSquadPlayers(team).sort((a, b) => b.rating - a.rating).slice(0, 14);
    return players.reduce((a, p) => a + (p.morale ?? MORALE_DEFAULT), 0) / Math.max(1, players.length);
}

// Изменение формы и морали игрока после матча
function updateFormAndMorale(p, num, report) {
    const r = report.ratings ? report.ratings.get(num) : undefined;
    if (r !== undefined) p.form = [...(p.form || []), r].slice(-FORM_LEN);
    else if (p.form && p.form.length) p.form = p.form.slice(1); // без игры форма «остывает»
    if (!report.result) return;
    let m = p.morale ?? MORALE_DEFAULT;
    m += { W: 4, D: 0, L: -4 }[report.result];
    if (report.result === 'L' && report.margin >= 3) m -= 4;   // разгром бьёт по всем
    if (report.result === 'W' && report.underdog) m += 3;      // победа над фаворитом окрыляет
    if (r !== undefined) {
        m += 2;                                                 // игровое время
        if (r >= 8) m += 4; else if (r < 5.8) m -= 3;
        m += Math.min(2, report.goals.get(num) || 0) * 2;
        if (report.motm === num) m += 4;
    } else if (!p.suspended && !(report.served && report.served.has(num))) {
        m -= 3;                                                 // не попал в состав
    }
    m += (MORALE_DEFAULT - m) * 0.18;                           // эмоции со временем выравниваются
    p.morale = Math.round(Math.max(5, Math.min(100, m)));
}

function initSquads() {
    state.squads = {};
    state.teams.forEach(team => {
        const players = {};
        getTeamRoster(team.name, team.rating).forEach(p => {
            players[p.number] = { fitness: 100, suspended: 0, yellowAcc: 0 };
        });
        // Каждый клуб начинает со своей привычной тактики (js/data/tactics.js)
        const t = getClubTactics(team.name, team.rating);
        state.squads[team.id] = { formation: t.formation, style: t.style, line: t.line, lineup: [], players };
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
    return !p.suspended && !isInjured(p);
}

// ----- Травмы -----
// Срок — в матчах своей команды. Лёгкие травмы частые, тяжёлые — редкие.
const INJURY_TYPES = [
    { type: 'ушиб', min: 1, max: 1, w: 30 },
    { type: 'растяжение', min: 1, max: 2, w: 25 },
    { type: 'травма мышцы бедра', min: 2, max: 4, w: 20 },
    { type: 'травма голеностопа', min: 3, max: 5, w: 12 },
    { type: 'травма колена', min: 4, max: 8, w: 9 },
    { type: 'разрыв связок', min: 10, max: 18, w: 4 }
];

function rollInjury() {
    const total = INJURY_TYPES.reduce((a, t) => a + t.w, 0);
    let r = Math.random() * total;
    const t = INJURY_TYPES.find(x => (r -= x.w) <= 0) || INJURY_TYPES[0];
    return { type: t.type, matches: t.min + Math.floor(Math.random() * (t.max - t.min + 1)) };
}

// Прямая красная: обычно 1 матч, за грубость — 2–3
function rollRedBan() {
    const r = Math.random();
    return r < 0.65 ? 1 : (r < 0.9 ? 2 : 3);
}

function isInjured(p) {
    return !!(p.injury && p.injury.matches > 0);
}

function matchesWord(n) {
    const n10 = n % 10, n100 = n % 100;
    const w = n10 === 1 && n100 !== 11 ? 'матч' : (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? 'матча' : 'матчей');
    return `${n} ${w}`;
}

// Почему игрок пропускает матч (для подсказок и ленты)
function absenceText(p) {
    if (isInjured(p)) return `${p.injury.type}, ещё ${matchesWord(p.injury.matches)}`;
    if (p.suspended) return `дисквалификация${p.banReason ? ' (' + p.banReason + ')' : ''}, ещё ${matchesWord(p.suspended)}`;
    return '';
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
        if (num !== null && byNum[num]) changes.push(`${byNum[num].name} ${isInjured(byNum[num]) ? 'травмирован (' + absenceText(byNum[num]) + ')' : 'дисквалифицирован'} → ${pick.name}`);
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
    if (isHuman(team)) validateLineup(team);
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
    const bans = [];  // новые дисквалификации — для новостей
    const nameOf = Object.fromEntries(getSquadPlayers(team).map(x => [x.number, x.name]));
    Object.entries(squad.players).forEach(([num, p]) => {
        num = Number(num);
        if (report.served.has(num)) { p.suspended = Math.max(0, p.suspended - 1); if (!p.suspended) delete p.banReason; }
        // Сыгравшие восстанавливаются не полностью — при игре без ротации свежесть понемногу падает
        if (report.endFitness.has(num)) p.fitness = Math.min(100, report.endFitness.get(num) + 17);
        else p.fitness = Math.min(100, p.fitness + 30);
        // Травмы: новая — со сроком; старая — на матч ближе к выздоровлению
        if (report.injuries && report.injuries.has(num)) {
            p.injury = { ...report.injuries.get(num) };
            p.fitness = Math.min(p.fitness, 60);
        } else if (isInjured(p)) {
            p.injury.matches--;
            if (p.injury.matches <= 0) { delete p.injury; p.fitness = Math.min(p.fitness, 80); } // вернулся, но ещё не в тонусе
        }
        updateFormAndMorale(p, num, report); // до новой дисквалификации: отбывший её не «обижается» на скамейку
        if (!prefs.bans) { /* дисквалификации выключены в настройках */ }
        else if (report.redCards.has(num)) {
            const len = (report.redCards.get && report.redCards.get(num)) || 1;
            p.suspended += len;
            p.banReason = len > 1 ? 'прямая красная' : 'красная карточка';
            bans.push({ num, name: nameOf[num], len, reason: p.banReason });
        }
        else if (report.yellowCards.has(num)) {
            p.yellowAcc++;
            if (p.yellowAcc >= YELLOWS_FOR_BAN) {
                p.suspended += 1; p.yellowAcc = 0; p.banReason = 'перебор жёлтых';
                bans.push({ num, name: nameOf[num], len: 1, reason: p.banReason });
            }
        }
    });
    return bans;
}

// Свежесть для показа: 🟢 / 🟡 / 🔴
function fitnessColor(f) {
    return f >= 85 ? 'var(--success)' : (f >= 70 ? 'var(--gold)' : 'var(--highlight)');
}

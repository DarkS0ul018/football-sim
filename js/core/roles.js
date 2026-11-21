// ===== РОЛИ ИГРОКОВ, СТАНДАРТЫ, КАПИТАН =====
// Роль уточняет, как играет футболист на своей позиции: кто чаще бьёт, кто отдаёт, кто держится позади.
// По умолчанию роль подбирается по навыкам (см. playerSkills в squad.js); в карьере её можно задать вручную.
// Исполнители стандартов: угловые, штрафные, пенальти — назначенные или лучшие по навыкам.
// Капитан: на поле поддерживает команду, когда она проигрывает; его настроение передаётся остальным.

const ROLES = {
    GK: {
        keeper:   { label: 'Вратарь',                 short: 'ВРТ', hint: 'Держится в воротах.' },
        sweeper:  { label: 'Вратарь-чистильщик',      short: 'ЧИС', hint: 'Выходит из штрафной и страхует высокую линию: соперник реже убегает один на один.' }
    },
    DEF: {
        cb:       { label: 'Центральный защитник',    short: 'ЦЗ',  hint: 'Держит центр, опасен на чужих угловых.' },
        stopper:  { label: 'Стоппер',                 short: 'СТП', hint: 'Агрессивно выходит в отбор: чаще срывает атаки, но и фолит чаще.' },
        fb:       { label: 'Атакующий крайний',       short: 'КЗ+', hint: 'Подключается к атакам по флангу: больше голевых передач.' }
    },
    MID: {
        playmaker:{ label: 'Плеймейкер',              short: 'ПЛМ', hint: 'Через него идёт игра: больше голевых передач.' },
        destroyer:{ label: 'Опорник-разрушитель',     short: 'ОП',  hint: 'Держится позади и рушит атаки соперника.' },
        box:      { label: 'От штрафной до штрафной', short: 'Б2Б', hint: 'Успевает и назад, и к чужим воротам — чаще бьёт.' }
    },
    FWD: {
        poacher:  { label: 'Добивающий',              short: 'ДОБ', hint: 'Живёт в штрафной и чаще всех бьёт.' },
        target:   { label: '«Столб»',                 short: 'СТБ', hint: 'Выигрывает верх: опасен после навесов и угловых.' },
        inverted: { label: 'Инвертированный крайний', short: 'ИНВ', hint: 'Смещается с фланга в центр: и бьёт, и отдаёт.' },
        false9:   { label: 'Ложная девятка',          short: 'Л9',  hint: 'Опускается в середину и раздаёт передачи.' }
    }
};

// Множители весов в движке: кто чаще бьёт (open — с игры, set — после навеса), кто чаще отдаёт голевой
const ROLE_FX = {
    open:   { box: 1.3, poacher: 1.4, inverted: 1.2, target: 1.05, false9: 0.8, destroyer: 0.5, playmaker: 0.9, fb: 0.9, stopper: 0.8 },
    set:    { target: 1.6, cb: 1.25, stopper: 1.15, poacher: 1.1, destroyer: 0.8, playmaker: 0.7 },
    assist: { playmaker: 1.5, fb: 1.3, inverted: 1.2, false9: 1.4, destroyer: 0.6, poacher: 0.7, target: 0.9, box: 1.05 }
};

function rolesFor(pos) { return ROLES[pos] || ROLES.MID; }

// Роль по навыкам: у защитников — ещё и по месту в схеме (фланг или центр)
function autoRole(p, slotY = 50) {
    const pos = ROLES[p.position] ? p.position : 'MID';
    const sk = playerSkills({ ...p, natPos: p.natPos || p.position });
    if (pos === 'GK') return sk.dis >= sk.ref ? 'sweeper' : 'keeper';
    if (pos === 'DEF') {
        if (slotY < 27 || slotY > 73) return 'fb';
        return sk.edge && sk.edge.tck >= 4 ? 'stopper' : 'cb';
    }
    if (pos === 'MID') {
        const e = sk.edge || {};
        if ((e.pas || 0) >= Math.max(e.tck || 0, e.sho || 0) && (e.pas || 0) > 0) return 'playmaker';
        if ((e.tck || 0) > (e.sho || 0) && (e.tck || 0) > 0) return 'destroyer';
        return 'box';
    }
    const e = sk.edge || {};
    const best = ['hea', 'sho', 'pac', 'pas'].sort((a, b) => (e[b] || 0) - (e[a] || 0))[0];
    return { hea: 'target', sho: 'poacher', pac: 'inverted', pas: 'false9' }[best] || 'poacher';
}

// Роль игрока на поле: заданная в составе (если подходит к позиции) или подобранная автоматически
function playerRole(p, roles, slotY) {
    const want = roles && roles[p.number];
    if (want && rolesFor(p.position)[want]) return want;
    return autoRole(p, slotY ?? p.baseY ?? 50);
}

// Капитан по умолчанию: опыт и класс
function autoCaptain(players) {
    const list = players.filter(p => p.position !== 'GK' || players.length < 3);
    const score = p => (p.rating || 70) + (p.age || 26) * 0.6;
    return ([...list].sort((a, b) => score(b) - score(a))[0] || players[0] || {}).number ?? null;
}

// Исполнитель стандарта: назначенный (если на поле) или лучший по навыку
const SET_PIECE_SKILL = { corner: p => playerSkills(p).pas, freekick: p => playerSkills(p).sho * 0.6 + playerSkills(p).pas * 0.4, penalty: p => playerSkills(p).sho };
function bestTaker(field, kind) {
    const f = SET_PIECE_SKILL[kind] || SET_PIECE_SKILL.corner;
    return [...field].sort((a, b) => f(b) - f(a))[0] || null;
}

// Лидерство капитана после матча: его настроение передаётся раздевалке
function captainInfluence(squad, captainNum) {
    const cap = captainNum != null ? squad.players[captainNum] : null;
    if (!cap) return 0;
    const m = cap.morale ?? MORALE_DEFAULT;
    const d = m >= 80 ? 1 : (m < 35 ? -1 : 0);
    if (!d) return 0;
    Object.entries(squad.players).forEach(([num, p]) => {
        if (Number(num) === captainNum) return;
        p.morale = Math.round(Math.max(5, Math.min(100, (p.morale ?? MORALE_DEFAULT) + d)));
    });
    return d;
}

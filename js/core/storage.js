// ===== СОХРАНЕНИЕ ТУРНИРА В localStorage =====
// Матчи и команды ссылаются друг на друга, поэтому сохраняем их по id и при загрузке связываем обратно.
// Сохраняем только «между матчами»: живой матч, прерванный перезагрузкой, просто начнётся заново.

const SAVE_KEY = 'footballSimPro.save';
const SAVE_VERSION = 3; // v3: составы (схема, свежесть, дисквалификации), туры, лига

// ===== МОИ СОХРАНЕНИЯ: у каждого турнира и серии — свой слот =====
// Индекс слотов (для списка на главной) и данные каждого слота хранятся отдельно.
// Слот: { tournament: данные турнира | null, series: состояние серии | null }.
const SLOTS_KEY = 'footballSimPro.slots';
const SLOT_PREFIX = 'footballSimPro.slot.';
const SLOTS_MAX = 12;
let currentSlotId = null;

function readSlotIndex() {
    try { const l = JSON.parse(localStorage.getItem(SLOTS_KEY)); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}

function writeSlotIndex(list) {
    try { localStorage.setItem(SLOTS_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}

function readSlot(id) {
    if (!id) return null;
    try { return JSON.parse(localStorage.getItem(SLOT_PREFIX + id)) || null; } catch (e) { return null; }
}

function newSlotId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Описание слота для списка: турнир, а между турнирами серии — сама серия
function describeSlot(slot) {
    if (slot.tournament && slot.tournament.version === SAVE_VERSION) {
        const d = describeSave(slot.tournament);
        if (slot.series && typeof describeSeries === 'function') return { title: describeSeries(slot.series).title, details: d.title + ' · ' + d.details };
        return d;
    }
    if (slot.series && typeof describeSeries === 'function') return describeSeries(slot.series);
    return { title: 'Сохранение', details: '' };
}

function writeSlot(id, slot) {
    try { localStorage.setItem(SLOT_PREFIX + id, JSON.stringify(slot)); } catch (e) { return false; }
    const info = describeSlot(slot);
    let list = readSlotIndex().filter(s => s.id !== id);
    list.unshift({ id, savedAt: Date.now(), title: info.title, details: info.details, series: !!slot.series });
    // Слишком много — убираем самые старые одиночные турниры
    while (list.length > SLOTS_MAX) {
        const drop = [...list].reverse().find(s => !s.series) || list[list.length - 1];
        list = list.filter(s => s !== drop);
        try { localStorage.removeItem(SLOT_PREFIX + drop.id); } catch (e) { /* ignore */ }
    }
    writeSlotIndex(list);
    return true;
}

function deleteSlot(id) {
    try { localStorage.removeItem(SLOT_PREFIX + id); } catch (e) { /* ignore */ }
    writeSlotIndex(readSlotIndex().filter(s => s.id !== id));
    if (currentSlotId === id) currentSlotId = null;
}

// Новый одиночный турнир — в новый слот (прежние сохранения не трогаем)
function startNewSlot() {
    currentSlotId = null;
}

// Старое единственное сохранение → первый слот
(function migrateOldSave() {
    try {
        const old = localStorage.getItem(SAVE_KEY);
        if (!old) return;
        const data = JSON.parse(old);
        if (data && data.version === SAVE_VERSION) writeSlot(newSlotId(), { tournament: data, series: null });
        localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* ignore */ }
})();

function serializeMatch(m) {
    return {
        id: m.id, t1: m.team1.id, t2: m.team2.id, legs: m.legs, stage: m.stage,
        roundName: m.roundName, roundIndex: m.roundIndex,
        isFinished: m.isFinished, isFinal: m.isFinal,
        leg1: m.leg1, leg2: m.leg2, currentLeg: m.currentLeg,
        score1: m.score1, score2: m.score2, penalties: m.penalties,
        winner: m.winner ? m.winner.id : null, isAutoSimulated: m.isAutoSimulated, extraTime: m.extraTime, matchday: m.matchday || null,
        goals: m.goals || [], reds: m.reds || [], motms: m.motms || []
    };
}

function deserializeMatch(d, teamById) {
    const m = new Match(d.id, teamById(d.t1), teamById(d.t2), d.legs, d.stage, d.roundName, d.roundIndex);
    Object.assign(m, {
        isFinished: d.isFinished, isFinal: d.isFinal,
        leg1: d.leg1, leg2: d.leg2, currentLeg: d.currentLeg,
        score1: d.score1, score2: d.score2, penalties: d.penalties,
        winner: d.winner === null ? null : teamById(d.winner),
        isAutoSimulated: d.isAutoSimulated, extraTime: !!d.extraTime, matchday: d.matchday || undefined,
        goals: d.goals || [], reds: d.reds || [], motms: d.motms || []
    });
    return m;
}

function saveGame() {
    if (!state.teams.length || state.champion) return;
    // Матч, не доигранный до конца, не сохраняем — его счёт ещё не окончательный
    const cupMatches = state.cup ? state.cup.rounds.flatMap(r => r.matches) : [];
    const live = [...state.matches, ...cupMatches].find(m => !m.isFinished && (m.score1 || m.score2 || m.leg1.t1 || m.leg1.t2 || m.currentLeg === 2));
    if (live) return;

    // Плей-офф: текущие матчи лежат и в state.matches, и в истории. Храним каждый один раз.
    const all = [];
    const indexOf = new Map();
    const ref = m => {
        if (!indexOf.has(m)) { indexOf.set(m, all.length); all.push(serializeMatch(m)); }
        return indexOf.get(m);
    };
    const data = {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        settings: state.settings,
        teams: state.teams.map(t => ({ id: t.id, name: t.name, emoji: t.emoji, rating: t.rating, stats: t.stats })),
        groups: state.groups.map(g => g.map(t => t.id)),
        groupMatches: state.settings.mode === 'groups' ? [] : state.groupMatches.map(ref),
        currentMatches: state.matches.map(ref),
        history: state.tournamentHistory.map(r => ({ round: r.round, roundIndex: r.roundIndex, matches: r.matches.map(ref) })),
        matches: all,
        currentRound: state.currentRound,
        userTeam: state.userTeam ? state.userTeam.id : null,
        userTeamEliminated: state.userTeamEliminated,
        userTeams: (state.userTeams || []).map(t => t.id),
        eliminated: state.eliminated || [],
        squads: state.squads,
        rosters: state.rosters,
        playerStats,
        cup: serializeCup(),
        news: state.news || [],
        newsMeta: state.newsMeta || null,
        uclPhase: state.uclPhase || null,
        uclRanking: state.uclRanking || null
    };
    // В свой слот: серия хранит рядом своё состояние
    if (!currentSlotId) currentSlotId = newSlotId();
    const slot = readSlot(currentSlotId) || { tournament: null, series: null };
    slot.tournament = data;
    writeSlot(currentSlotId, slot);
}

// Турнир из слота (по умолчанию — текущего)
function readSave(id = currentSlotId) {
    const slot = readSlot(id);
    const data = slot && slot.tournament;
    return data && data.version === SAVE_VERSION ? data : null;
}

// Турнир закончен или брошен: слот одиночного турнира удаляется, у серии остаётся сама серия
function clearSave(id = currentSlotId) {
    if (!id) return;
    const slot = readSlot(id);
    if (slot && slot.series) { slot.tournament = null; writeSlot(id, slot); }
    else deleteSlot(id);
}

function loadGame(id = currentSlotId) {
    if (id) currentSlotId = id;
    const data = readSave();
    if (!data) return false;

    state.settings = data.settings;
    state.teams = data.teams.map(d => Object.assign(new Team(d.id, d.name, d.emoji, d.rating), { stats: d.stats }));
    const teamById = id => state.teams.find(t => t.id === id);

    const matches = data.matches.map(d => deserializeMatch(d, teamById));
    state.groups = data.groups.map(g => g.map(teamById));
    state.groupMatches = (data.groupMatches || []).map(i => matches[i]);
    state.tournamentHistory = data.history.map(r => ({ round: r.round, roundIndex: r.roundIndex, matches: r.matches.map(i => matches[i]) }));
    // Если текущий этап — раунд плей-офф, state.matches должен быть тем же массивом, что и в истории
    const last = state.tournamentHistory[state.tournamentHistory.length - 1];
    const current = data.currentMatches.map(i => matches[i]);
    state.matches = last && current.length && last.matches[0] === current[0] ? last.matches : current;

    state.currentRound = data.currentRound;
    state.userTeam = data.userTeam === null ? null : teamById(data.userTeam);
    state.userTeamEliminated = data.userTeamEliminated;
    state.userTeams = (data.userTeams || []).map(teamById).filter(Boolean);
    state.eliminated = data.eliminated || (data.userTeamEliminated && state.userTeam ? [state.userTeam.id] : []);
    state.champion = null;
    state.activeMatch = null;
    playerStats = data.playerStats;
    state.squads = data.squads;
    state.rosters = data.rosters || null; // в старых сохранениях составов нет — берутся текущие
    state.cup = deserializeCup(data.cup, teamById);
    state.news = data.news || [];
    state.newsMeta = data.newsMeta || null;
    state.uclPhase = data.uclPhase || null;
    state.uclRanking = data.uclRanking || null;
    state.seriesProcessed = false;
    state.seasonRecorded = false;
    return true;
}

// Краткое описание сохранения для кнопки «Продолжить»
// Название турнира для карточки «Продолжить»
function saveTournamentName(s) {
    if (s.title) return s.title.replace(/^[^А-Яа-яA-Za-z]+/, '');
    if (s.ucl) return (EURO_CUPS[s.euroCup || 'ucl'] || EURO_CUPS.ucl).title.replace(/^[^А-Яа-я]+/, '');
    if (typeof NATION_CUPS !== 'undefined' && NATION_CUPS[s.teamType]) return NATION_CUPS[s.teamType].title;
    const n = s.count;
    const word = n % 10 === 1 && n % 100 !== 11 ? 'команда' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'команды' : 'команд');
    return `${{ world: 'Европейские клубы', russia: 'РПЛ', mixed: 'РПЛ + Европа', clubwc: 'Клубы мира', fnl: 'Первая лига' }[s.teamType] || 'Турнир'}, ${n} ${word}`;
}

function describeSave(data) {
    const user = data.userTeam !== null ? data.teams.find(t => t.id === data.userTeam) : null;
    const stage = data.settings.mode === 'league' ? (data.settings.ucl ? 'Общий этап' : data.settings.originalMode === 'leaguePlayoff' ? 'Чемпионат' : 'Лига')
        : data.settings.mode === 'groups' ? 'Групповой этап'
        : (data.history[data.history.length - 1] || {}).round || '';
    const played = data.currentMatches.filter(i => data.matches[i].isFinished).length;
    return {
        title: data.settings.gameMode === 'duo' && (data.userTeams || []).length === 2
            ? `Вдвоём: ${data.userTeams.map(id => data.teams.find(t => t.id === id).name).join(' vs ')}`
            : user ? `Карьера: ${user.emoji} ${user.name}` : `${saveTournamentName(data.settings)} · смотрю турнир`,
        details: `${stage} · сыграно ${played} из ${data.currentMatches.length}`
    };
}

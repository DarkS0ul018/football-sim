// ===== КАРЬЕРА: итог сезона, история, следующий сезон =====
// История карьеры хранится отдельно от сохранения турнира и переживает новые турниры.

const CAREER_KEY = 'footballSimPro.career';

function readCareer() {
    try {
        const data = JSON.parse(localStorage.getItem(CAREER_KEY));
        return data && Array.isArray(data.seasons) ? data : { seasons: [] };
    } catch (e) {
        return { seasons: [] };
    }
}

function writeCareer(data) {
    try { localStorage.setItem(CAREER_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

function clearCareer() {
    try { localStorage.removeItem(CAREER_KEY); } catch (e) { /* ignore */ }
}

// ===== РЕЕСТР ИГРОКОВ КАРЬЕРЫ =====
// Всё, что изменилось относительно стандартных данных: рост/спад рейтинга, возраст, переходы.
// Ключ — «исходный клуб|имя», поле team — где игрок сейчас.
let careerPlayers = null; // активен только в карьере (иначе null)

function playerKey(origTeam, name) {
    return `${origTeam}|${name}`;
}

// Применяет реестр к стандартному составу команды
function applyCareerRoster(teamName, base) {
    const reg = careerPlayers;
    const list = [];
    base.forEach(p => {
        const e = reg[playerKey(p.origTeam || teamName, p.name)];
        if (e && e.team !== teamName) return;         // продан в другой клуб
        list.push(e ? { ...p, rating: e.rating, age: e.age } : p);
    });
    Object.values(reg).forEach(e => {               // пришедшие из других клубов
        if (e.team === teamName && e.origTeam !== teamName) {
            list.push({ name: e.name, position: e.position, rating: e.rating, age: e.age, origTeam: e.origTeam, starter: false });
        }
    });
    return list.map((p, i) => ({ ...p, number: i + 1 }));
}

// Включает реестр карьеры для команды игрока (при старте турнира)
function activateCareerPlayers(userTeamName) {
    const career = readCareer();
    careerPlayers = career.teamName === userTeamName ? (career.players || {}) : {};
}

// ----- Развитие игроков -----
function developmentRange(age) {
    if (age <= 20) return [2, 5];
    if (age <= 23) return [1, 3];
    if (age <= 27) return [-1, 2];
    if (age <= 30) return [-2, 1];
    if (age <= 33) return [-3, 0];
    return [-4, -1];
}

// В конце сезона: все игроки турнира стареют на год и меняют рейтинг.
// Возвращает изменения по команде игрока для показа.
function developPlayers(career) {
    career.players = career.players || {};
    const changes = [];
    state.teams.forEach(team => {
        const roster = state.rosters ? state.rosters[team.name] : null;
        if (!roster) return;
        const teamMatches = Math.max(1, team.stats.played);
        roster.forEach(p => {
            const st = playerStats[`${team.id}-${p.number}`] || { matches: 0, goals: 0, assists: 0 };
            const age = p.age || baseAge(team.name, p.name);
            const [lo, hi] = developmentRange(age);
            let delta = lo + Math.floor(Math.random() * (hi - lo + 1));
            const share = st.matches / teamMatches;
            if (age <= 27 && share >= 0.5) delta += 1;                 // игровая практика
            if (age <= 25 && share < 0.15) delta -= 1;                  // без игры молодые не растут
            if (age <= 29 && st.matches && (st.goals + st.assists) / st.matches >= 0.5) delta += 1; // результативность
            const rating = Math.max(45, Math.min(97, p.rating + delta));
            const origTeam = p.origTeam || team.name;
            career.players[playerKey(origTeam, p.name)] = { team: team.name, origTeam, name: p.name, position: p.position, rating, age: age + 1 };
            if (state.userTeam && team.id === state.userTeam.id) {
                changes.push({ name: p.name, position: p.position, age: age + 1, before: p.rating, after: rating });
            }
        });
    });
    return changes.sort((a, b) => (b.after - b.before) - (a.after - a.before));
}

// ----- Финансы и трансферы -----
// Стоимость игрока, млн €: растёт с рейтингом, молодые дороже, ветераны дешевле
function playerValue(rating, age) {
    const base = Math.pow(Math.max(1, rating - 60), 2.2) / 22;
    const ageK = age <= 23 ? 1.3 : age <= 28 ? 1 : age <= 31 ? 0.7 : 0.4;
    return Math.max(0.5, Math.round(base * ageK * 10) / 10);
}

function formatMoney(m) {
    return m >= 10 ? `${Math.round(m)} млн €` : `${m.toFixed(1)} млн €`;
}

function seasonIncome(result) {
    if (!result) return 20;
    if (result.trophy) return 60;
    if (result.place === 2) return 45;
    if (/Полуфинал|1\/4|^[2-4] место/.test(result.text)) return 35;
    return 25;
}

const SQUAD_MAX = 26;
const SQUAD_LINE_MIN = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

// Текущий состав команды игрока с учётом реестра (для трансферного окна)
function careerSquad(teamName) {
    const saved = state.rosters;
    state.rosters = null;
    const rating = teamRatings[teamName] ?? 75;
    const list = getTeamRoster(teamName, rating);
    state.rosters = saved;
    return list;
}

function canSell(teamName, player) {
    const squad = careerSquad(teamName);
    if (squad.length <= 18) return 'в составе должно остаться минимум 18 игроков';
    const left = squad.filter(p => p.position === player.position).length - 1;
    if (left < SQUAD_LINE_MIN[player.position]) return `нужно минимум ${SQUAD_LINE_MIN[player.position]} на позиции ${player.position}`;
    return null;
}

function buyPlayer(career, userTeam, player, fromTeam) {
    const price = playerValue(player.rating, player.age);
    if (career.budget < price) return 'не хватает денег';
    if (careerSquad(userTeam).length >= SQUAD_MAX) return `в составе уже ${SQUAD_MAX} игроков`;
    const origTeam = player.origTeam || fromTeam;
    career.players[playerKey(origTeam, player.name)] = { team: userTeam, origTeam, name: player.name, position: player.position, rating: player.rating, age: player.age };
    career.budget = Math.round((career.budget - price) * 10) / 10;
    career.transfers = (career.transfers || []).concat({ season: career.seasons.length + 1, type: 'in', name: player.name, team: fromTeam, price });
    return null;
}

function sellPlayer(career, userTeam, player, pool) {
    const reason = canSell(userTeam, player);
    if (reason) return reason;
    const buyers = pool.filter(n => n !== userTeam);
    const buyer = buyers[Math.floor(Math.random() * buyers.length)];
    const price = Math.round(playerValue(player.rating, player.age) * 0.8 * 10) / 10;
    const origTeam = player.origTeam || userTeam;
    career.players[playerKey(origTeam, player.name)] = { team: buyer, origTeam, name: player.name, position: player.position, rating: player.rating, age: player.age };
    career.budget = Math.round((career.budget + price) * 10) / 10;
    career.transfers = (career.transfers || []).concat({ season: career.seasons.length + 1, type: 'out', name: player.name, team: buyer, price });
    return null;
}

// Рейтинг команды по её составу (для таблиц и выбора соперников)
function rosterTeamRating(roster) {
    const top = roster.map(p => p.rating).sort((a, b) => b - a).slice(0, 11);
    return Math.round(top.reduce((a, b) => a + b, 0) / Math.max(1, top.length) - 3);
}

// Насколько далеко прошла команда игрока: { text, place, trophy }
function getUserResult(team = state.userTeam) {
    if (!team) return null;
    if (state.settings.mode === 'league') {
        const table = sortGroup([...state.teams]);
        const place = table.findIndex(t => t.id === team.id) + 1;
        return { text: place === 1 ? '🏆 Чемпион лиги' : `${place} место из ${table.length}`, place, trophy: place === 1 };
    }
    if (state.champion && state.champion.id === team.id) return { text: '🏆 Чемпион', place: 1, trophy: true };
    if (isLeagueWithPlayoff() && !state.tournamentHistory.some(r => r.matches.some(m => m.involves(team)))) {
        if (isUcl() && state.uclRanking) return { text: `Общий этап: ${state.uclRanking.indexOf(team.id) + 1}-е место из 36, без плей-офф`, place: null, trophy: false };
        const table = sortGroup([...state.teams]);
        return { text: `Чемпионат: ${table.findIndex(t => t.id === team.id) + 1} место, без плей-офф`, place: null, trophy: false };
    }
    const rounds = state.tournamentHistory.filter(r => r.matches.some(m => m.involves(team)));
    if (!rounds.length) return { text: 'Групповой этап', place: null, trophy: false };
    const last = rounds[rounds.length - 1];
    if (last.roundIndex === 3) return { text: '🥈 Финал', place: 2, trophy: false };
    return { text: `Вылет: ${last.round}`, place: null, trophy: false };
}

function formatLabel(settings) {
    // Турнир сборных: «Чемпионат Европы, 24 сборные»
    const cup = typeof NATION_CUPS !== 'undefined' ? NATION_CUPS[settings.teamType] : null;
    if (cup) return `${cup.title}, ${settings.count} сборных`;
    if ((settings.originalMode || settings.mode) === 'ucl') return (EURO_CUPS[settings.euroCup || 'ucl'] || EURO_CUPS.ucl).title.replace(/^[^А-Яа-я]+/, '');
    const mode = settings.originalMode || settings.mode; // после групп mode меняется на knockout
    if (mode === 'league') return `Лига, ${settings.count} команд`;
    if (mode === 'leaguePlayoff') return `Чемпионат + плей-офф, ${settings.count} команд`;
    if (mode === 'groups') return `Группы + плей-офф, ${settings.count} команд`;
    return `Плей-офф, ${settings.count} команд`;
}

// Записывает сезон в историю (один раз за турнир)
function recordCareerSeason() {
    if (!isCareer() || !state.userTeam || state.seasonRecorded) return;
    if (state.settings.seriesId) return;                       // серия ведёт свою историю
    if (isNationCareer()) { recordNationTournament(); return; } // сборная — своя история, клубная карьера не трогается
    const result = getUserResult();
    const career = readCareer();
    const team = state.userTeam;
    const cupRes = userCupResult();
    // Новая команда — новая карьера
    if (career.teamName && career.teamName !== team.name) {
        career.seasons = [];
        career.players = {};
        career.transfers = [];
        delete career.budget;
    }
    if (typeof career.budget !== 'number') career.budget = Math.max(20, (team.rating - 60) * 3);
    career.teamName = team.name;
    career.teamEmoji = team.emoji;
    const goals = Object.values(playerStats).filter(p => p.teamId === team.id);
    const top = [...goals].sort((a, b) => b.goals - a.goals)[0];
    career.seasons.push({
        season: career.seasons.length + 1,
        format: formatLabel(state.settings),
        result: result.text,
        trophy: result.trophy,
        champion: state.champion ? `${state.champion.emoji} ${state.champion.name}` : '',
        record: `${team.stats.won}-${team.stats.drawn}-${team.stats.lost}`,
        goals: `${team.stats.gf}:${team.stats.ga}`,
        topScorer: top && top.goals ? `${top.name} (${top.goals})` : '—',
        cup: cupRes ? cupRes.text : null,
        cupTrophy: !!(cupRes && cupRes.trophy)
    });
    // Развитие игроков и доход за сезон
    career.lastDevelopment = developPlayers(career);
    // Призовые: лига + кубок (победа 15, финал 8 млн €)
    const income = seasonIncome(result) + (cupRes ? (cupRes.trophy ? 15 : (cupRes.final ? 8 : 0)) : 0);
    career.lastIncome = income;
    career.budget = Math.round((career.budget + income) * 10) / 10;
    career.lastSettings = { ...state.settings, mode: state.settings.originalMode || state.settings.mode };
    career.lastPool = state.teams.map(t => t.name);
    writeCareer(career);
    careerPlayers = career.players;
    state.seasonRecorded = true;
}

// Следующий сезон с той же командой: лига — те же соперники, кубок — новые случайные
// Рейтинги команд берутся по их текущим составам (после развития и трансферов)
function startNextSeason() {
    const career = readCareer();
    const settings = { ...(career.lastSettings || state.settings) };
    settings.mode = settings.originalMode || settings.mode;
    const userName = career.teamName || state.userTeam.name;
    const emojiOf = name => {
        const data = getTeamsData('mixed');
        return data.emojis[data.names.indexOf(name)] || '⚪';
    };
    let names;
    if (settings.mode === 'league' || settings.mode === 'leaguePlayoff') {
        names = career.lastPool || state.teams.map(t => t.name);
    } else {
        names = [userName, ...pickRandomTeams(settings.teamType, settings.count + 1)
            .map(t => t.name).filter(n => n !== userName).slice(0, settings.count - 1)];
    }
    careerPlayers = career.players || {};
    state.rosters = null;
    const pool = names.map(name => ({
        name, emoji: emojiOf(name),
        rating: rosterTeamRating(getTeamRoster(name, teamRatings[name] ?? 75))
    }));
    createTournament(settings, pool, userName);
    saveGame();
}

// ===== КАРЬЕРА ЗА СБОРНУЮ =====
// Отдельная история турниров (ЧМ, ЧЕ, Кубок Америки) — клубная карьера с трансферами не затрагивается.
const NATION_CAREER_KEY = 'footballSimPro.nationCareer';

function isNationCareer() {
    return isCareer() && typeof NATION_CUPS !== 'undefined' && !!NATION_CUPS[state.settings.teamType];
}

function readNationCareer() {
    try {
        const d = JSON.parse(localStorage.getItem(NATION_CAREER_KEY));
        if (d && Array.isArray(d.tournaments)) return d;
    } catch (e) { /* ignore */ }
    return { tournaments: [] };
}

function writeNationCareer(d) {
    try { localStorage.setItem(NATION_CAREER_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
}

function recordNationTournament() {
    const team = state.userTeam;
    const cup = NATION_CUPS[state.settings.teamType];
    const result = getUserResult();
    const top = Object.values(playerStats).filter(p => p.teamId === team.id).sort((a, b) => b.goals - a.goals)[0];
    const d = readNationCareer();
    d.tournaments.push({
        n: d.tournaments.length + 1,
        cup: cup.title, cupKey: state.settings.teamType, icon: cup.icon,
        team: team.name,
        result: result.text, trophy: result.trophy,
        champion: state.champion ? state.champion.name : '',
        record: `${team.stats.won}-${team.stats.drawn}-${team.stats.lost}`,
        goals: `${team.stats.gf}:${team.stats.ga}`,
        topScorer: top && top.goals ? `${top.name} (${top.goals})` : '—',
        date: new Date().toLocaleDateString('ru-RU')
    });
    writeNationCareer(d);
    state.seasonRecorded = true;
}

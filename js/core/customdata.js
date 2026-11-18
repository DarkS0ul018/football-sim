// ===== ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ: правки команд из редактора =====
// Стандартные данные (teams.js, squads.js) не меняются: правки хранятся в localStorage
// и накладываются поверх при загрузке игры. Сбросить можно одну команду или всё сразу.

const CUSTOM_KEY = 'footballSimPro.customData';

// Названия и имена попадают в HTML — убираем символы разметки
function cleanText(s, max = 40) {
    return String(s).replace(/[<>"&`]/g, '').trim().slice(0, max);
}

// Копия стандартных данных — для сброса
const DEFAULT_DATA = JSON.parse(JSON.stringify({
    world: worldTeams, russia: russianTeams, ratings: teamRatings, squads: SQUADS
}));

function readCustomData() {
    try {
        const data = JSON.parse(localStorage.getItem(CUSTOM_KEY));
        if (data && typeof data.teams === 'object') return data;
    } catch (e) { /* ignore */ }
    return { teams: {} };
}

function writeCustomData(data) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}

function isDefaultTeam(name) {
    return DEFAULT_DATA.world.names.includes(name) || DEFAULT_DATA.russia.names.includes(name);
}

function defaultTeamInfo(name) {
    for (const type of ['world', 'russia']) {
        const i = DEFAULT_DATA[type].names.indexOf(name);
        if (i !== -1) return { name, type, emoji: DEFAULT_DATA[type].emojis[i], rating: DEFAULT_DATA.ratings[name], squad: DEFAULT_DATA.squads[type][name] };
    }
    return null;
}

// Пересобирает рабочие данные: стандартные + правки
function applyCustomData() {
    const custom = readCustomData().teams;
    const build = (type, target) => {
        target.names.length = 0;
        target.emojis.length = 0;
        DEFAULT_DATA[type].names.forEach((name, i) => {
            const o = custom[name];
            target.names.push(name);
            target.emojis.push(o && o.emoji || DEFAULT_DATA[type].emojis[i]);
        });
        Object.entries(custom).forEach(([name, o]) => {
            if (o.isNew && o.type === type) { target.names.push(name); target.emojis.push(o.emoji || '⚪'); }
        });
    };
    build('world', worldTeams);
    build('russia', russianTeams);
    mixedTeams.names = [...russianTeams.names, ...worldTeams.names];
    mixedTeams.emojis = [...russianTeams.emojis, ...worldTeams.emojis];

    Object.keys(teamRatings).forEach(k => delete teamRatings[k]);
    Object.assign(teamRatings, DEFAULT_DATA.ratings);
    ['world', 'russia'].forEach(type => {
        SQUADS[type] = JSON.parse(JSON.stringify(DEFAULT_DATA.squads[type]));
    });
    Object.entries(custom).forEach(([name, o]) => {
        const type = o.type || (DEFAULT_DATA.russia.names.includes(name) ? 'russia' : 'world');
        if (typeof o.rating === 'number') teamRatings[name] = o.rating;
        if (o.squad) SQUADS[type][name] = o.squad;
    });

    // Сбрасываем кэши, построенные по старым данным
    Object.keys(rosterCache).forEach(k => delete rosterCache[k]);
    if (typeof teamColorCache !== 'undefined') Object.keys(teamColorCache).forEach(k => delete teamColorCache[k]);
}

function saveTeamOverride(name, data) {
    const all = readCustomData();
    name = cleanText(name, 30);
    const squad = data.squad && Object.fromEntries(Object.entries(data.squad).map(([k, v]) => [k, v.map(s => cleanText(s)).filter(Boolean)]));
    all.teams[name] = { ...data, squad, isNew: !isDefaultTeam(name) };
    const ok = writeCustomData(all);
    applyCustomData();
    return ok;
}

function removeTeamOverride(name) {
    const all = readCustomData();
    delete all.teams[name];
    writeCustomData(all);
    applyCustomData();
}

function resetAllCustomData() {
    try { localStorage.removeItem(CUSTOM_KEY); } catch (e) { /* ignore */ }
    applyCustomData();
}

function exportCustomData() {
    return JSON.stringify({ app: 'football-sim-pro', version: 1, ...readCustomData() }, null, 2);
}

// Возвращает число импортированных команд или бросает ошибку с понятным текстом
function importCustomData(json) {
    let data;
    try { data = JSON.parse(json); } catch (e) { throw new Error('Файл не похож на JSON'); }
    if (!data || typeof data.teams !== 'object') throw new Error('В файле нет раздела «teams»');
    const teams = {};
    Object.entries(data.teams).forEach(([name, o]) => {
        if (!o || typeof o !== 'object') return;
        const clean = {
            type: o.type === 'russia' ? 'russia' : 'world',
            emoji: typeof o.emoji === 'string' ? o.emoji.slice(0, 8) : '⚪',
            rating: Math.max(40, Math.min(99, Number(o.rating) || 75))
        };
        if (o.squad) {
            clean.squad = {};
            Object.keys(SQUAD_MINIMUM).forEach(line => {
                clean.squad[line] = (Array.isArray(o.squad[line]) ? o.squad[line] : [])
                    .map(s => cleanText(s)).filter(Boolean).slice(0, 30);
            });
        }
        clean.isNew = !isDefaultTeam(name);
        const cleanName = cleanText(name, 30);
        if (cleanName) teams[cleanName] = clean;
    });
    const all = readCustomData();
    Object.assign(all.teams, teams);
    writeCustomData(all);
    applyCustomData();
    return Object.keys(teams).length;
}

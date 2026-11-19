// ===== ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ: правки команд из редактора =====
// Стандартные данные (teams.js, squads.js) не меняются: правки хранятся в localStorage
// и накладываются поверх при загрузке игры. Сбросить можно одну команду или всё сразу.

const CUSTOM_KEY = 'footballSimPro.customData';

// Названия и имена попадают в HTML — убираем символы разметки
function cleanText(s, max = 40) {
    return String(s).replace(/[<>"&`]/g, '').trim().slice(0, max);
}

// Эмблема: только известные значения; картинка — только data:image (никаких внешних ссылок)
function cleanCrest(crest) {
    if (!crest || typeof crest !== 'object') return null;
    const out = {};
    ['shape', 'pattern', 'symbol'].forEach(k => {
        if (typeof crest[k] === 'string' && /^[a-z]{1,20}$/.test(crest[k])) out[k] = crest[k];
    });
    if (typeof crest.image === 'string' && crest.image.length < 200000 &&
        /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(crest.image)) out.image = crest.image;
    return Object.keys(out).length ? out : null;
}

// Эмблемы из редактора: { [команда]: { shape, pattern, symbol, image } }
let customCrests = {};

// Копия стандартных данных — для сброса
const DEFAULT_DATA = JSON.parse(JSON.stringify({
    world: worldTeams, russia: russianTeams, ratings: teamRatings, squads: SQUADS,
    nations: typeof NATIONS !== 'undefined' ? NATIONS : {},  // сборные: состав, рейтинг, цвета формы
    cups: typeof NATION_CUPS !== 'undefined' ? Object.fromEntries(Object.entries(NATION_CUPS).map(([k, c]) => [k, c.names])) : {}
}));

const FLAG_TYPES = ['h', 'v', 'cross', 'nordic', 'saltire', 'circle', 'diamond', 'taeguk', 'plain'];

// Флаг сборной из редактора: тип, 1–7 цветов, пропорции полос, звезда
function cleanFlag(flag) {
    if (!flag || typeof flag !== 'object' || !FLAG_TYPES.includes(flag.t)) return null;
    const c = (Array.isArray(flag.c) ? flag.c : []).map(x => cleanHex(x, null)).filter(Boolean).slice(0, 7);
    if (!c.length) return null;
    const out = { t: flag.t, c };
    if (Array.isArray(flag.w) && flag.w.length === c.length && flag.w.every(n => Number.isFinite(n) && n > 0 && n < 10)) out.w = flag.w;
    const star = cleanHex(flag.star, null);
    if (star) out.star = star;
    return out;
}

// Код для табло: 2–4 буквы
function cleanCode(code) {
    const s = String(code || '').toUpperCase().replace(/[^A-ZА-ЯЁ]/g, '').slice(0, 4);
    return s.length >= 2 ? s : null;
}

function cleanCups(cups) {
    return Array.isArray(cups) ? cups.filter(k => typeof NATION_CUPS !== 'undefined' && NATION_CUPS[k]) : undefined;
}

// Цвет формы сборной: только #rrggbb
function cleanHex(c, fallback) {
    return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : fallback;
}

function isNationName(name) {
    return Object.prototype.hasOwnProperty.call(DEFAULT_DATA.nations, name);
}

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
    return isNationName(name) || DEFAULT_DATA.world.names.includes(name) || DEFAULT_DATA.russia.names.includes(name);
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
    // Сборные: стандартные данные, затем правки (и свои сборные). Участники турниров — тоже заново.
    if (typeof NATIONS !== 'undefined') {
        Object.keys(NATIONS).forEach(n => { if (!isNationName(n)) { delete NATIONS[n]; delete teamMeta[n]; } });
        Object.entries(DEFAULT_DATA.nations).forEach(([name, d]) => {
            NATIONS[name] = JSON.parse(JSON.stringify(d));
            teamMeta[name] = [d.code, null];
        });
        Object.entries(NATION_CUPS).forEach(([k, c]) => { c.names = [...(DEFAULT_DATA.cups[k] || [])]; });
    }
    customCrests = {};
    Object.entries(custom).forEach(([name, o]) => {
        if (o.crest) customCrests[name] = o.crest;
        if (o.type === 'national') {
            if (typeof NATIONS === 'undefined') return;
            if (o.isNew) {
                // Своя сборная: нужны флаг, код и состав
                if (!o.flag || !o.squad || !o.code) return;
                NATIONS[name] = { code: o.code, rating: 75, kit: ['#1e4fd8', '#f2f2f2'], flag: o.flag, squad: o.squad };
                teamRatings[name] = 75;
            } else if (!isNationName(name)) return;
            const n = NATIONS[name];
            if (typeof o.rating === 'number') { teamRatings[name] = o.rating; n.rating = o.rating; }
            if (o.squad) n.squad = o.squad;
            if (Array.isArray(o.kit)) n.kit = [cleanHex(o.kit[0], n.kit[0]), cleanHex(o.kit[1], n.kit[1])];
            if (o.flag) n.flag = o.flag;
            if (o.code) n.code = o.code;
            teamMeta[name] = [n.code, null];
            // Участие в турнирах сборных
            if (Array.isArray(o.cups)) Object.entries(NATION_CUPS).forEach(([k, c]) => {
                const has = c.names.includes(name), want = o.cups.includes(k);
                if (want && !has) c.names.push(name);
                if (!want && has) c.names = c.names.filter(x => x !== name);
            });
            return;
        }
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
    const crest = cleanCrest(data.crest);
    const kit = Array.isArray(data.kit) ? [cleanHex(data.kit[0], '#1e4fd8'), cleanHex(data.kit[1], '#f2f2f2')] : undefined;
    const extra = data.type === 'national' ? { flag: cleanFlag(data.flag) || undefined, code: cleanCode(data.code) || undefined, cups: cleanCups(data.cups) } : {};
    all.teams[name] = { ...data, ...extra, squad, kit, crest: crest || undefined, isNew: !isDefaultTeam(name) };
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
        // Сборная: стандартная или своя (у своей должны быть флаг и код)
        const nation = o.type === 'national' && (isNationName(name) || (cleanFlag(o.flag) && cleanCode(o.code)));
        if (o.type === 'national' && !nation) return;
        const clean = {
            type: nation ? 'national' : (o.type === 'russia' ? 'russia' : 'world'),
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
        if (nation && Array.isArray(o.kit)) clean.kit = [cleanHex(o.kit[0], '#1e4fd8'), cleanHex(o.kit[1], '#f2f2f2')];
        if (nation) {
            const fl = cleanFlag(o.flag), code = cleanCode(o.code), cups = cleanCups(o.cups);
            if (fl) clean.flag = fl;
            if (code) clean.code = code;
            if (cups) clean.cups = cups;
        }
        const crest = cleanCrest(o.crest);
        if (crest) clean.crest = crest;
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

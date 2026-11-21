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
    meta: teamMeta,                                               // коды для табло и годы основания
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
// Рейтинги отдельных игроков из редактора: { имя: 40–99 }
function cleanPlayerRatings(pr) {
    if (!pr || typeof pr !== 'object') return undefined;
    const out = {};
    Object.entries(pr).slice(0, 80).forEach(([n, r]) => {
        const name = cleanText(n), v = Math.round(Number(r));
        if (name && v >= 40 && v <= 99) out[name] = v;
    });
    return Object.keys(out).length ? out : undefined;
}

// Свои номера игроков: { имя: 1–99 }, без повторов
function cleanPlayerNumbers(pn) {
    if (!pn || typeof pn !== "object") return undefined;
    const out = {}, used = new Set();
    Object.entries(pn).slice(0, 80).forEach(([n, v]) => {
        const name = cleanText(n), num = Math.round(Number(v));
        if (name && num >= 1 && num <= 99 && !used.has(num)) { out[name] = num; used.add(num); }
    });
    return Object.keys(out).length ? out : undefined;
}

function cleanHex(c, fallback) {
    return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : fallback;
}

function isNationName(name) {
    return Object.prototype.hasOwnProperty.call(DEFAULT_DATA.nations, name);
}

function readCustomData() {
    try {
        const data = JSON.parse(localStorage.getItem(CUSTOM_KEY));
        if (data && typeof data.teams === 'object') return migrateCustomData(data);
    } catch (e) { /* ignore */ }
    return { teams: {} };
}

// Стандартная команда исчезла, а её правки переименовывали её в другую стандартную
// (например «Украина» → «Россия», теперь Россия есть в игре сама): переносим правки на неё.
function migrateCustomData(data) {
    if (typeof DEFAULT_DATA === 'undefined') return data;
    let changed = false;
    Object.entries(data.teams).forEach(([key, o]) => {
        if (!o || o.isNew || !o.rename || isDefaultTeam(key) || !isDefaultTeam(o.rename) || data.teams[o.rename]) return;
        const moved = { ...o };
        delete moved.rename;
        data.teams[o.rename] = moved;
        delete data.teams[key];
        changed = true;
    });
    Object.entries(data.teams).forEach(([key, o]) => {          // правки команды, которой больше нет, — убираем
        if (o && !o.isNew && !isDefaultTeam(key)) { delete data.teams[key]; changed = true; }
    });
    if (changed) writeCustomData(data);
    return data;
}

function writeCustomData(data) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}

// ----- Опубликованный стандарт (data/standard.json на сайте) -----
// Слои: данные в коде ← опубликованные автором правки ← личные правки этого браузера.
// Личная правка с _reset: true значит «вернуть команду к данным из кода» (при публикации — убрать из стандарта).
const PUBLISHED_KEY = 'footballSimPro.published';

function readPublishedData() {
    try {
        const data = JSON.parse(localStorage.getItem(PUBLISHED_KEY));
        if (data && typeof data.teams === 'object') return data;
    } catch (e) { /* ignore */ }
    return { teams: {} };
}

function writePublishedData(data) {
    try { localStorage.setItem(PUBLISHED_KEY, JSON.stringify({ teams: data.teams || {}, updated: data.updated || null })); return true; } catch (e) { return false; }
}

// Итоговые правки: стандарт + личные (личная правка команды целиком заменяет опубликованную)
function effectiveTeams() {
    const teams = { ...readPublishedData().teams };
    Object.entries(readCustomData().teams).forEach(([k, o]) => {
        if (o && o._reset) delete teams[k];
        else teams[k] = o;
    });
    return teams;
}

// Сколько личных правок ещё не опубликовано
function unpublishedCount() {
    return Object.keys(readCustomData().teams).length;
}

// Стандарт с личными правками поверх — то, что уйдёт на сайт при публикации
function mergeForPublish(published) {
    const teams = { ...(published || {}) };
    Object.entries(readCustomData().teams).forEach(([k, o]) => {
        if (o && o._reset) delete teams[k];
        else teams[k] = o;
    });
    return teams;
}

// Свежий стандарт с сайта. Без интернета или при открытии файла напрямую — остаётся сохранённый.
// onChange вызывается, если стандарт изменился с прошлого раза.
function fetchPublishedData(onChange) {
    if (location.protocol === 'file:') return;
    fetch('data/standard.json?t=' + Date.now(), { cache: 'no-store' })
        .then(res => {
            if (res.status === 404) return { teams: {} };     // ещё ничего не публиковали
            if (!res.ok) throw new Error(res.status);
            return res.json();
        })
        .then(data => {
            if (!data || typeof data.teams !== 'object') return;
            if (JSON.stringify(data.teams) === JSON.stringify(readPublishedData().teams)) return;
            writePublishedData(data);
            applyCustomData();
            if (onChange) onChange();
        })
        .catch(() => { /* без сети — работаем на сохранённом */ });
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

// Новое название → исходное: настоящие возрасты, привычная тактика и вид эмблемы сохраняются после переименования
let TEAM_ALIAS = {};

// Пересобирает рабочие данные: стандартные + правки.
// Правки стандартной команды хранятся под её исходным названием (rename — новое название в игре),
// поэтому «Вернуть стандартные данные» всегда находит команду. Свои команды — под своим названием.
function applyCustomData() {
    const custom = effectiveTeams();
    TEAM_ALIAS = {};
    PLAYER_RATING_OVERRIDES = {};
    PLAYER_NUMBER_OVERRIDES = {};
    const shown = (key, o) => (o && o.rename) || key;

    // Справочники — к стандартным
    Object.keys(teamRatings).forEach(k => delete teamRatings[k]);
    Object.assign(teamRatings, DEFAULT_DATA.ratings);
    Object.keys(teamMeta).forEach(k => delete teamMeta[k]);
    Object.assign(teamMeta, JSON.parse(JSON.stringify(DEFAULT_DATA.meta)));
    customCrests = {};

    // ----- Клубы -----
    ['world', 'russia'].forEach(type => {
        const target = type === 'world' ? worldTeams : russianTeams;
        target.names.length = 0;
        target.emojis.length = 0;
        SQUADS[type] = {};
        DEFAULT_DATA[type].names.forEach((key, i) => {
            const o = custom[key] && custom[key].type !== 'national' ? custom[key] : null;
            const meta = DEFAULT_DATA.meta[key] || [null, null];
            delete teamRatings[key];
            delete teamMeta[key];
            if (o && o.hidden) return;                       // убрана из игры
            const name = shown(key, o);
            if (name !== key) TEAM_ALIAS[name] = key;
            target.names.push(name);
            target.emojis.push((o && o.emoji) || DEFAULT_DATA[type].emojis[i]);
            const squad = (o && o.squad) || DEFAULT_DATA.squads[type][key];
            if (squad) SQUADS[type][name] = JSON.parse(JSON.stringify(squad));
            teamRatings[name] = o && typeof o.rating === 'number' ? o.rating : DEFAULT_DATA.ratings[key];
            const code = (o && o.code) || meta[0];
            const year = o && o.year !== undefined ? o.year : meta[1];
            if (code || year) teamMeta[name] = [code, year];
            if (o && o.crest) customCrests[name] = o.crest;
            if (o && o.playerRatings) PLAYER_RATING_OVERRIDES[name] = { ...o.playerRatings };
            if (o && o.playerNumbers) PLAYER_NUMBER_OVERRIDES[name] = { ...o.playerNumbers };
        });
        Object.entries(custom).forEach(([name, o]) => {
            if (!o.isNew || o.type !== type) return;
            target.names.push(name);
            target.emojis.push(o.emoji || '⚪');
            if (o.squad) SQUADS[type][name] = o.squad;
            teamRatings[name] = typeof o.rating === 'number' ? o.rating : 75;
            if (o.code || o.year) teamMeta[name] = [o.code || null, o.year ?? null];
            if (o.crest) customCrests[name] = o.crest;
            if (o.playerRatings) PLAYER_RATING_OVERRIDES[name] = { ...o.playerRatings };
            if (o.playerNumbers) PLAYER_NUMBER_OVERRIDES[name] = { ...o.playerNumbers };
        });
    });
    mixedTeams.names = [...russianTeams.names, ...worldTeams.names];
    mixedTeams.emojis = [...russianTeams.emojis, ...worldTeams.emojis];

    // ----- Сборные -----
    if (typeof NATIONS !== 'undefined') {
        Object.keys(NATIONS).forEach(n => delete NATIONS[n]);
        Object.entries(NATION_CUPS).forEach(([k, c]) => { c.names = [...(DEFAULT_DATA.cups[k] || [])]; });
        const inCups = fn => Object.values(NATION_CUPS).forEach(c => { c.names = fn(c.names); });
        const applyNation = (name, n, o) => {
            if (o) {
                if (typeof o.rating === 'number') n.rating = o.rating;
                if (o.squad) n.squad = o.squad;
                if (Array.isArray(o.kit)) n.kit = [cleanHex(o.kit[0], n.kit[0]), cleanHex(o.kit[1], n.kit[1])];
                if (o.flag) n.flag = o.flag;
                if (o.code) n.code = o.code;
                if (o.crest) customCrests[name] = o.crest;
                if (o.playerRatings) PLAYER_RATING_OVERRIDES[name] = { ...o.playerRatings };
                if (o.playerNumbers) PLAYER_NUMBER_OVERRIDES[name] = { ...o.playerNumbers };
                // Участие в турнирах сборных
                if (Array.isArray(o.cups)) Object.entries(NATION_CUPS).forEach(([k, c]) => {
                    const has = c.names.includes(name), want = o.cups.includes(k);
                    if (want && !has) c.names.push(name);
                    if (!want && has) c.names = c.names.filter(x => x !== name);
                });
            }
            teamRatings[name] = n.rating;
            teamMeta[name] = [n.code, null];
        };
        Object.entries(DEFAULT_DATA.nations).forEach(([key, d]) => {
            const o = custom[key] && custom[key].type === 'national' ? custom[key] : null;
            delete teamRatings[key];
            delete teamMeta[key];
            if (o && o.hidden) { inCups(list => list.filter(x => x !== key)); return; }
            const name = shown(key, o);
            if (name !== key) { TEAM_ALIAS[name] = key; inCups(list => list.map(x => (x === key ? name : x))); }
            NATIONS[name] = JSON.parse(JSON.stringify(d));
            applyNation(name, NATIONS[name], o);
        });
        Object.entries(custom).forEach(([name, o]) => {
            // Своя сборная: нужны флаг, код и состав
            if (o.type !== 'national' || !o.isNew || !o.flag || !o.squad || !o.code) return;
            NATIONS[name] = { code: o.code, rating: 75, kit: ['#1e4fd8', '#f2f2f2'], flag: o.flag, squad: o.squad };
            applyNation(name, NATIONS[name], o);
        });
    }

    // Легендарные составы (Турнир легенд) — поверх пересобранных справочников
    if (typeof registerLegends === 'function') registerLegends();

    // Сбрасываем кэши, построенные по старым данным
    Object.keys(rosterCache).forEach(k => delete rosterCache[k]);
    if (typeof teamColorCache !== 'undefined') Object.keys(teamColorCache).forEach(k => delete teamColorCache[k]);
}

// Исходное название команды (для правок и стандартных данных)
function originalTeamName(name) {
    return TEAM_ALIAS[name] || name;
}

// Год основания: целое 1800–2100
function cleanYear(y) {
    const n = Number(y);
    return Number.isInteger(n) && n >= 1800 && n <= 2100 ? n : undefined;
}

// key — исходное название стандартной команды или название своей; oldKey — прежнее название своей команды (переименование)
function saveTeamOverride(key, data, oldKey = null) {
    const all = readCustomData();
    key = cleanText(key, 30);
    if (oldKey && oldKey !== key) dropTeamOverride(all, oldKey);
    const squad = data.squad && Object.fromEntries(Object.entries(data.squad).map(([k, v]) => [k, v.map(s => cleanText(s)).filter(Boolean)]));
    const crest = cleanCrest(data.crest);
    const kit = Array.isArray(data.kit) ? [cleanHex(data.kit[0], '#1e4fd8'), cleanHex(data.kit[1], '#f2f2f2')] : undefined;
    const extra = data.type === 'national'
        ? { flag: cleanFlag(data.flag) || undefined, code: cleanCode(data.code) || undefined, cups: cleanCups(data.cups) }
        : { code: cleanCode(data.code) || undefined, year: cleanYear(data.year) };
    const isNew = !isDefaultTeam(key);
    const rename = !isNew && data.rename ? cleanText(data.rename, 30) : '';
    all.teams[key] = { ...data, ...extra, squad, kit, crest: crest || undefined, isNew, playerRatings: cleanPlayerRatings(data.playerRatings), playerNumbers: cleanPlayerNumbers(data.playerNumbers),
        rename: rename && rename !== key ? rename : undefined, hidden: data.hidden ? true : undefined };
    const ok = writeCustomData(all);
    applyCustomData();
    return ok;
}

// Убрать стандартную команду из игры / вернуть (остальные правки сохраняются)
function setTeamHidden(key, hidden) {
    const all = readCustomData();
    const base = all.teams[key] && !all.teams[key]._reset ? all.teams[key] : readPublishedData().teams[key];
    const o = base ? JSON.parse(JSON.stringify(base)) : { type: isNationName(key) ? 'national' : (DEFAULT_DATA.russia.names.includes(key) ? 'russia' : 'world'), isNew: false };
    if (hidden) o.hidden = true; else delete o.hidden;
    all.teams[key] = o;
    writeCustomData(all);
    applyCustomData();
}

// Убирает правку команды. Если команда есть в опубликованном стандарте — помечает «вернуть к исходной»
// (для своей команды — удалить), иначе стандарт вернул бы её обратно.
function dropTeamOverride(all, name) {
    const pub = readPublishedData().teams[name];
    if (pub) all.teams[name] = { _reset: true, type: pub.type, isNew: !!pub.isNew };
    else delete all.teams[name];
}

function removeTeamOverride(name) {
    const all = readCustomData();
    dropTeamOverride(all, name);
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
            emoji: typeof o.emoji === 'string' ? o.emoji.slice(0, 8) : (isDefaultTeam(name) ? undefined : '⚪'),
            rating: o.rating !== undefined ? Math.max(40, Math.min(99, Number(o.rating) || 75)) : (isDefaultTeam(name) ? undefined : 75)
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
        if (!nation) {
            const code = cleanCode(o.code), year = cleanYear(o.year);
            if (code) clean.code = code;
            if (year) clean.year = year;
        }
        if (isDefaultTeam(name) && o.rename) clean.rename = cleanText(o.rename, 30);
        if (isDefaultTeam(name) && o.hidden) clean.hidden = true;
        const pr = cleanPlayerRatings(o.playerRatings);
        if (pr) clean.playerRatings = pr;
        const pn = cleanPlayerNumbers(o.playerNumbers);
        if (pn) clean.playerNumbers = pn;
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

// Название в игре для исходного названия (после переименования — новое)
function shownNameOf(key) {
    const found = Object.entries(TEAM_ALIAS).find(([, orig]) => orig === key);
    return found ? found[0] : key;
}

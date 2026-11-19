// ===== ПУБЛИКАЦИЯ ПРАВОК ДЛЯ ВСЕХ =====
// Автор игры сохраняет свои правки из редактора в файл data/standard.json репозитория на GitHub.
// Сайт (GitHub Pages) обновляется примерно за минуту, и при следующем открытии игры
// правки становятся стандартом у всех. Ключ доступа хранится только в этом браузере.

const PUBLISH_TOKEN_KEY = 'footballSimPro.ghToken';
const PUBLISH_FILE = 'data/standard.json';

// Репозиторий: по адресу сайта (имя.github.io/репозиторий), иначе — основной
function publishRepo() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    const repo = location.pathname.split('/').filter(Boolean)[0];
    if (m && repo) return { owner: m[1], repo };
    return { owner: 'DarkS0ul018', repo: 'football-sim' };
}

function getPublishToken() {
    try { return localStorage.getItem(PUBLISH_TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function setPublishToken(token) {
    try {
        if (token) localStorage.setItem(PUBLISH_TOKEN_KEY, token.trim());
        else localStorage.removeItem(PUBLISH_TOKEN_KEY);
    } catch (e) { /* ignore */ }
}

function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}

function base64ToUtf8(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

async function githubRequest(method, path, token, body) {
    const { owner, repo } = publishRepo();
    let res;
    try {
        res = await fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`, {
            method,
            cache: 'no-store',
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
    } catch (e) {
        throw new Error('Нет связи с GitHub. Проверьте интернет.');
    }
    if (res.status === 401) throw new Error('GitHub не принял ключ: он неверный или срок его действия истёк.');
    if (res.status === 403) throw new Error(`У ключа нет права записи в репозиторий «${repo}» (нужно Contents: Read and write).`);
    if (res.status === 404 && method !== 'GET') throw new Error(`Ключ не видит репозиторий «${repo}». При создании ключа выберите его в Repository access.`);
    if (res.status === 409) throw new Error('Файл на GitHub только что изменился. Нажмите «Опубликовать» ещё раз.');
    return res;
}

// Проверка ключа: доступ к репозиторию и право записи
async function checkPublishToken(token) {
    const res = await githubRequest('GET', '', token);
    if (res.status === 404) throw new Error(`Ключ не видит репозиторий «${publishRepo().repo}». При создании ключа выберите его в Repository access.`);
    if (!res.ok) throw new Error(`GitHub ответил ошибкой ${res.status}`);
    const info = await res.json();
    if (info.permissions && !info.permissions.push) throw new Error('У ключа нет права записи (нужно Contents: Read and write).');
    return true;
}

// Текущий опубликованный стандарт прямо из репозитория (свежее, чем сайт)
async function fetchRemoteStandard(token) {
    const res = await githubRequest('GET', `contents/${PUBLISH_FILE}?ref=main`, token);
    if (res.status === 404) return { sha: null, teams: {} };
    if (!res.ok) throw new Error(`GitHub ответил ошибкой ${res.status}`);
    const file = await res.json();
    let teams = {};
    try { teams = JSON.parse(base64ToUtf8(file.content)).teams || {}; } catch (e) { /* испорченный файл — перезапишем */ }
    return { sha: file.sha, teams };
}

// Публикует личные правки поверх текущего стандарта. Возвращает число команд в стандарте.
async function publishStandard() {
    const token = getPublishToken();
    if (!token) throw new Error('Сначала добавьте ключ публикации.');
    const remote = await fetchRemoteStandard(token);
    const teams = mergeForPublish(remote.teams);

    // Проверка: с этими данными в игре не должно быть ошибок
    const before = readPublishedData();
    const mine = readCustomData();
    writePublishedData({ teams });
    writeCustomData({ teams: {} });
    applyCustomData();
    const broken = validateGameData().teams.filter(t => t.errors.length);
    if (broken.length) {
        writePublishedData(before);
        writeCustomData(mine);
        applyCustomData();
        throw new Error(`Есть ошибки в командах: ${broken.slice(0, 3).map(t => t.name).join(', ')}. Исправьте и попробуйте снова.`);
    }

    const updated = new Date().toISOString();
    const content = JSON.stringify({ app: 'football-sim-pro', version: 1, updated, teams }, null, 1) + '\n';
    const n = Object.keys(mine.teams).length;
    try {
        const res = await githubRequest('PUT', `contents/${PUBLISH_FILE}`, token, {
            message: `Редактор: публикация правок (${n} ${n === 1 ? 'команда' : 'команд'})`,
            content: utf8ToBase64(content),
            branch: 'main',
            ...(remote.sha ? { sha: remote.sha } : {})
        });
        if (!res.ok) throw new Error(`GitHub ответил ошибкой ${res.status}`);
    } catch (e) {
        // Не получилось — всё возвращаем как было, личные правки не теряются
        writePublishedData(before);
        writeCustomData(mine);
        applyCustomData();
        throw e;
    }
    writePublishedData({ teams, updated });
    return Object.keys(teams).length;
}

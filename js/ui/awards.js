// ===== ПРЕСС-КОНФЕРЕНЦИЯ, ОБЛОЖКА ТУРА, НАГРАДЫ СЕЗОНА, ДОСТИЖЕНИЯ =====
// Пресс-конференция после матча в карьере: ответы тренера меняют мораль игроков.
// Обложка тура — на дашборде после каждого доигранного тура: игрок тура, лучший гол, команда тура.
// Награды сезона — на экране итогов. Достижения копятся на этом устройстве между турнирами.

// ---------- Достижения ----------
const ACH_KEY = 'footballSimPro.achievements';
const ACH_GROUPS = { match: 'Матчи', coach: 'Тренер', trophy: 'Трофеи', collect: 'Коллекция' };
const ACH_LIST = [
    { id: 'first_win', group: 'match', icon: '✅', title: 'Первая победа', desc: 'Выиграйте матч своей командой' },
    { id: 'rout', group: 'match', icon: '💥', title: 'Разгром', desc: 'Победа с разницей в 5 мячей и больше' },
    { id: 'comeback', group: 'match', icon: '🔄', title: 'Камбэк', desc: 'Отыграйтесь и победите, уступая по ходу матча' },
    { id: 'late', group: 'match', icon: '⏱️', title: 'На последних минутах', desc: 'Победный гол на 85-й минуте или позже' },
    { id: 'hattrick', group: 'match', icon: '🎩', title: 'Хет-трик', desc: 'Ваш игрок забил три мяча за матч' },
    { id: 'shootout', group: 'match', icon: '🧊', title: 'Нервы из стали', desc: 'Выиграйте серию пенальти' },
    { id: 'clean5', group: 'match', icon: '🧤', title: 'Сухарь', desc: '5 матчей на ноль', goal: 5, counter: 'clean' },
    { id: 'derby5', group: 'match', icon: '🔥', title: 'Король дерби', desc: 'Выиграйте 5 дерби своей командой', goal: 5, counter: 'derbyWins' },
    { id: 'legends', group: 'trophy', icon: '🏛️', title: 'Легенда среди легенд', desc: 'Выиграйте Турнир легенд своей командой' },
    { id: 'press1', group: 'coach', icon: '🎤', title: 'Первая пресс-конференция', desc: 'Ответьте журналистам после матча' },
    { id: 'press10', group: 'coach', icon: '📺', title: 'Любимец прессы', desc: '10 пресс-конференций', goal: 10, counter: 'press' },
    { id: 'hint1', group: 'coach', icon: '📊', title: 'Слушай аналитика', desc: 'Примените подсказку аналитика по ходу матча' },
    { id: 'hint10', group: 'coach', icon: '🧠', title: 'Тактический гений', desc: 'Примените 10 подсказок аналитика', goal: 10, counter: 'hints' },
    { id: 'live10', group: 'coach', icon: '📡', title: 'У экрана', desc: 'Посмотрите 10 матчей вживую', goal: 10, counter: 'live' },
    { id: 'champ', group: 'trophy', icon: '🏆', title: 'Чемпион', desc: 'Выиграйте турнир своей командой' },
    { id: 'champ_ucl', group: 'trophy', icon: '⭐', title: 'Король Европы', desc: 'Выиграйте Лигу чемпионов своей командой' },
    { id: 'champ_nat', group: 'trophy', icon: '🌍', title: 'Сборная — чемпион', desc: 'Выиграйте турнир сборных своей командой' },
    { id: 'invincible', group: 'trophy', icon: '🛡️', title: 'Непобедимые', desc: 'Сезон лиги без поражений своей командой' },
    { id: 'tour5', group: 'trophy', icon: '📚', title: 'Летописец', desc: 'Доиграйте 5 турниров в любом режиме', goal: 5, counter: 'tours' },
    { id: 'matches100', group: 'collect', icon: '💯', title: 'Сотня', desc: 'Сыграйте 100 матчей своей командой', goal: 100, counter: 'matches' },
    { id: 'goals100', group: 'collect', icon: '⚽', title: '100 голов', desc: 'Ваши команды забили 100 мячей', goal: 100, counter: 'goals' },
    { id: 'wins50', group: 'collect', icon: '🔥', title: '50 побед', desc: 'Одержите 50 побед своей командой', goal: 50, counter: 'wins' }
];

let achStore = (() => {
    try { const s = JSON.parse(localStorage.getItem(ACH_KEY)); if (s && s.unlocked) return { unlocked: s.unlocked, counters: s.counters || {} }; } catch (e) { /* ignore */ }
    return { unlocked: {}, counters: {} };
})();

function saveAch() {
    try { localStorage.setItem(ACH_KEY, JSON.stringify(achStore)); } catch (e) { /* ignore */ }
}

function unlockAch(id) {
    if (achStore.unlocked[id]) return;
    const a = ACH_LIST.find(x => x.id === id);
    if (!a) return;
    achStore.unlocked[id] = Date.now();
    saveAch();
    setTimeout(() => notify(`🏅 Достижение: ${a.icon} ${a.title}`), 400);
    renderHomeAchievements();
}

function achCount(counter, n = 1) {
    achStore.counters[counter] = (achStore.counters[counter] || 0) + n;
    saveAch();
    ACH_LIST.filter(a => a.counter === counter && achStore.counters[counter] >= a.goal).forEach(a => unlockAch(a.id));
    if (counter === 'press') unlockAch('press1');
    if (counter === 'hints') unlockAch('hint1');
}

// Матч своей команды: победы, разгромы, камбэки, хет-трики, серия пенальти
function achOnMatch(m, winner) {
    if (!hasHumans()) return;
    humanTeams().filter(t => m.involves(t)).forEach(team => {
        const s = m.team1 === team || m.team1.id === team.id ? 1 : 2;
        const goals = [...(m.goals || [])].sort((a, b) => (a.leg - b.leg) || (a.min - b.min));
        const my = goals.filter(g => g.s === s).length, their = goals.length - my;
        const won = winner && winner.id === team.id;
        achCount('matches');
        if (my) achCount('goals', my);
        if (!their) achCount('clean');
        if (won) { achCount('wins'); unlockAch('first_win'); }
        if (won && typeof derbyTitle === 'function' && derbyTitle(m.team1, m.team2)) achCount('derbyWins');
        if (won && my - their >= 5) unlockAch('rout');
        if (won && m.penalties && m.penalties.kicks && m.penalties.kicks.length) unlockAch('shootout');
        // По ходу матча: уступали, а победили; победный гол в концовке
        let diff = 0, trailed = false;
        goals.forEach(g => { diff += g.s === s ? 1 : -1; if (diff < 0) trailed = true; });
        if (won && my > their && trailed) unlockAch('comeback');
        const last = goals[goals.length - 1];
        if (won && last && last.s === s && last.min >= 85 && my - their === 1) unlockAch('late');
        const byName = {};
        goals.filter(g => g.s === s && g.p).forEach(g => { byName[g.p] = (byName[g.p] || 0) + 1; });
        if (Object.values(byName).some(n => n >= 3)) unlockAch('hattrick');
    });
}

function achOnTournament(champion) {
    achCount('tours');
    if (!hasHumans() || !champion) return;
    const t = humanTeams().find(x => x.id === champion.id);
    if (t) {
        unlockAch('champ');
        if (state.settings.teamType === 'ucl' || /Лига чемпионов/.test(state.settings.title || '')) unlockAch('champ_ucl');
        if (getTeamOrigin(champion.name) === 'national') unlockAch('champ_nat');
        if (state.settings.teamType === 'legends') unlockAch('legends');
    }
    if (state.settings.mode === 'league') humanTeams().forEach(x => { if (x.stats.played >= 10 && x.stats.lost === 0) unlockAch('invincible'); });
}

// Сетка значков: в итогах турнира и в окне «Достижения»
function achGridHtml() {
    return Object.entries(ACH_GROUPS).map(([g, label]) => `<div class="ach-group"><div class="ach-group-title">${label}</div><div class="ach-grid">${
        ACH_LIST.filter(a => a.group === g).map(a => {
            const at = achStore.unlocked[a.id];
            const cnt = a.counter ? Math.min(a.goal, achStore.counters[a.counter] || 0) : null;
            return `<div class="ach-badge ${at ? 'on' : ''}" title="${a.desc}">
                <span class="ach-icon">${a.icon}</span>
                <b>${a.title}</b><small>${a.desc}</small>
                ${at ? `<em>${new Date(at).toLocaleDateString('ru-RU')}</em>` : (cnt != null ? `<i class="ach-bar"><span style="width:${Math.round(cnt / a.goal * 100)}%"></span></i><em>${cnt} / ${a.goal}</em>` : '<em>🔒</em>')}
            </div>`;
        }).join('')}</div></div>`).join('');
}

function achSummary() {
    return `${Object.keys(achStore.unlocked).filter(id => ACH_LIST.some(a => a.id === id)).length} / ${ACH_LIST.length}`;
}

function openAchievements() {
    document.querySelector('.ach-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay ach-overlay';
    el.innerHTML = `<div class="confirm-box ach-box" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <h3>🏅 Достижения <span class="muted">${achSummary()}</span></h3>
        <p class="muted">Копятся на этом устройстве во всех турнирах и сериях.</p>
        ${achGridHtml()}
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.pc-close')) el.remove(); });
}

function renderHomeAchievements() {
    const host = $('home-ach');
    if (!host) return;
    const clubs = typeof museumClubs === 'function' ? museumClubs() : [];
    host.innerHTML = `<button type="button" class="home-ach-btn" data-open="ach"><span class="ach-icon">🏅</span><span><b>Достижения</b><small class="muted">${achSummary()} открыто</small></span><span class="home-ach-go">→</span></button>
        <button type="button" class="home-ach-btn" data-open="trophies"><span class="ach-icon">🏆</span><span><b>Трофейная комната</b><small class="muted">кубки на полках и история каждой победы</small></span><span class="home-ach-go">→</span></button>
        <button type="button" class="home-ach-btn" data-open="museum"><span class="ach-icon">🏛️</span><span><b>Музей клуба</b><small class="muted">${clubs.length ? `${clubs.length} ${clubs.length === 1 ? 'клуб' : 'клуба(ов)'} · трофеи и легенды` : 'трофеи, рекорды и легенды вашей карьеры'}</small></span><span class="home-ach-go">→</span></button>`;
    host.querySelector('[data-open="ach"]').onclick = openAchievements;
    host.querySelector('[data-open="museum"]').onclick = () => openMuseum();
    host.querySelector('[data-open="trophies"]').onclick = () => openTrophyRoom();
}

// Заменяет старые четыре значка на экране итогов
function renderAchievements() {
    const host = $('achievements-list');
    if (host) host.innerHTML = achGridHtml();
}

// ---------- Пресс-конференция ----------
function pressQuestions(m, team) {
    const s = m.team1.id === team.id ? 1 : 2;
    const agg = m.aggregateScore || { t1: m.score1, t2: m.score2 };
    const my = s === 1 ? agg.t1 : agg.t2, their = s === 1 ? agg.t2 : agg.t1;
    const opp = s === 1 ? m.team2 : m.team1;
    const won = m.winner ? m.winner.id === team.id : my > their;
    const lost = m.winner ? m.winner.id !== team.id : my < their;
    const qs = [];
    if (won && my - their >= 3) qs.push({ q: `Разгром «${opp.name}» ${my}:${their}. Команда на ходу?`, a: [
        { t: 'Горжусь ребятами — они сделали всё, что мы готовили.', fx: { all: 4 } },
        { t: 'Рано радоваться: впереди матчи посложнее.', fx: { all: 2 } },
        { t: 'Соперник был слаб, хвалить особо не за что.', fx: { all: -2 } }] });
    else if (won) qs.push({ q: `Победа над «${opp.name}». Что стало ключом?`, a: [
        { t: 'Характер. Команда билась за каждый мяч.', fx: { all: 3 } },
        { t: 'Тактика сработала — мы хорошо подготовились.', fx: { all: 2 } },
        { t: 'Повезло. Нужно играть лучше.', fx: { all: -1 } }] });
    else if (!lost) qs.push({ q: `Ничья с «${opp.name}». Довольны?`, a: [
        { t: 'Очко — тоже результат, команда не сдалась.', fx: { all: 2 } },
        { t: 'Нет. Мы должны были побеждать.', fx: { all: -1, top: 3 } },
        { t: 'Судья лишил нас победы.', fx: { all: 1 } }] });
    else qs.push({ q: my - their <= -3 ? `Тяжёлое поражение ${my}:${their}. Кто виноват?` : `Поражение от «${opp.name}». Что пошло не так?`, a: [
        { t: 'Вина на мне. Игроков в обиду не дам.', fx: { all: 3 } },
        { t: 'Некоторым игрокам стоит задуматься о своём месте в составе.', fx: { all: -3, top: 2 } },
        { t: 'Мы создали достаточно, просто не забили.', fx: { all: 1 } }] });

    const red = (m.reds || []).find(r => r.s === s && r.p);
    const motm = (m.motms || []).filter(x => x.s === s).sort((a, b) => b.r - a.r)[0];
    const scorers = {};
    (m.goals || []).filter(g => g.s === s && g.p).forEach(g => { scorers[g.p] = (scorers[g.p] || 0) + 1; });
    const star = motm ? motm.p : Object.entries(scorers).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (red) qs.push({ q: `${red.p} получил красную карточку. Подвёл команду?`, a: [
        { t: 'Поддержу его: такое бывает в борьбе.', fx: { player: red.p, v: 8 } },
        { t: 'Непрофессионально. Поговорим внутри команды.', fx: { player: red.p, v: -10, all: 1 } },
        { t: 'Без комментариев.', fx: {} }] });
    else if (star) qs.push({ q: `Как оцените игру ${star}?`, a: [
        { t: 'Лучший на поле — он нас вытащил.', fx: { player: star, v: 10, all: -1 } },
        { t: 'Хорошо, но это его работа.', fx: { player: star, v: 3 } },
        { t: 'Команда важнее отдельных игроков.', fx: { all: 2 } }] });
    else {
        const next = state.matches.find(x => !x.isFinished && x.involves(team));
        if (next) {
            const nOpp = next.team1.id === team.id ? next.team2 : next.team1;
            qs.push({ q: `Дальше — «${nOpp.name}». Какой настрой?`, a: [
                { t: 'Мы фавориты и едем за победой.', fx: { all: 3 } },
                { t: 'Уважаем соперника, готовимся спокойно.', fx: { all: 1 } },
                { t: 'Нас никто не воспринимает всерьёз — тем лучше.', fx: { all: 2 } }] });
        }
    }
    return qs;
}

// Мораль: all — всем, top — 11 игравшим (если известно), player — одному по имени
function applyPressEffect(team, fx) {
    const squad = getSquad(team);
    const players = getSquadPlayers(team);
    const bump = (num, v) => { const p = squad.players[num]; if (p) p.morale = Math.round(Math.max(5, Math.min(100, (p.morale ?? MORALE_DEFAULT) + v))); };
    const out = [];
    if (fx.all) { players.forEach(p => bump(p.number, fx.all)); out.push(["команда", fx.all]); }
    if (fx.top) {
        (squad.lineup || []).forEach(num => bump(num, fx.top));
        out.push(["основа", fx.top]);
    }
    if (fx.player) {
        const p = players.find(x => x.name === fx.player);
        if (p) { bump(p.number, fx.v); out.push([fx.player, fx.v]); }
    }
    return out;
}

// «Мораль: команда +2, Педро +10» — одинаковые адресаты складываются
function pressSummary(effects) {
    const sum = new Map();
    effects.forEach(([k, v]) => sum.set(k, (sum.get(k) || 0) + v));
    const parts = [...sum].filter(([, v]) => v).map(([k, v]) => `${escapeHtml(k)} ${v > 0 ? '+' : ''}${v}`);
    return parts.length ? `Мораль: ${parts.join(', ')}` : 'Мораль без изменений';
}

function openPressConference(m, team) {
    const qs = pressQuestions(m, team);
    if (!qs.length) return;
    document.querySelector('.press-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay press-overlay';
    let i = 0;
    const effects = [];
    const said = [];
    const render = () => {
        const q = qs[i];
        el.innerHTML = `<div class="confirm-box press-box" role="dialog" aria-modal="true">
            <button type="button" class="pc-close" title="Закрыть">✕</button>
            <div class="press-head">🎤 Пресс-конференция <span class="muted">· ${escapeHtml(team.name)}</span></div>
            ${q ? `<div class="press-step muted">Вопрос ${i + 1} из ${qs.length}</div>
                <div class="press-q">${escapeHtml(q.q)}</div>
                <div class="press-answers">${q.a.map((a, k) => `<button type="button" class="press-a" data-k="${k}">${escapeHtml(a.t)}</button>`).join('')}</div>`
            : `<div class="press-q">Спасибо, пресс-конференция окончена.</div>
                <div class="press-result">${pressSummary(effects)}</div>
                <button type="button" class="btn-primary press-done">Готово</button>`}
        </div>`;
        el.querySelectorAll('.press-a').forEach(b => b.onclick = () => {
            const a = q.a[Number(b.dataset.k)];
            effects.push(...applyPressEffect(team, a.fx));
            said.push(a.t);
            i++;
            if (i >= qs.length) finish();
            render();
        });
        el.querySelector('.press-done')?.addEventListener('click', () => el.remove());
    };
    const finish = () => {
        achCount('press');
        m.pressDone = true;
        if (typeof pushNews === 'function') pushNews({ tag: 'club', match: m, teams: [team], weight: 4,
            title: `Тренер «${team.name}»: «${said[0]}»`, text: said.slice(1).map(t => `«${t}»`).join(' ') });
        saveGame();
        $('btn-press')?.remove();
    };
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.pc-close')) el.remove(); });
    document.body.appendChild(el);
    render();
}

// После матча своей команды в карьере — кнопка рядом с «Следующий матч»
function offerPressConference(m) {
    $('btn-press')?.remove();
    if (!isCareer() || m.pressDone) return;
    const team = humanTeams().find(t => m.involves(t));
    const next = $('btn-next-match');
    if (!team || !next) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'btn-press';
    b.className = 'btn-secondary btn-press';
    b.innerHTML = '<span class="btn-icon">🎤</span><span class="btn-text">Пресс-конференция</span>';
    b.onclick = () => openPressConference(m, team);
    next.parentElement.insertBefore(b, next);
}

function afterMatchExtras(m, winner) {
    try { achOnMatch(m, winner); } catch (e) { console.warn(e); }
    offerPressConference(m);
    offerLockerRoom(m);
}

// ---------- Обложка тура ----------
function roundKey(m) { return m.matchday ? `Тур ${m.matchday}` : (m.roundName || ''); }

function lastCompletedRound() {
    const order = [], byKey = new Map();
    state.matches.forEach(m => {
        const k = roundKey(m);
        if (!byKey.has(k)) { byKey.set(k, []); order.push(k); }
        byKey.get(k).push(m);
    });
    for (let i = order.length - 1; i >= 0; i--) {
        const list = byKey.get(order[i]);
        if (list.length && list.every(m => m.isFinished)) return { key: order[i], matches: list };
    }
    return null;
}

// Выступления игроков в матчах тура (из карточек игроков: оценка, голы, передачи)
function roundPerformances(matches) {
    const res = [];
    const stats = Object.values(playerStats);
    matches.forEach(m => {
        [[m.team1, m.team2], [m.team2, m.team1]].forEach(([team, opp]) => {
            stats.filter(p => p.teamId === team.id && p.log).forEach(p => {
                const entries = p.log.filter(e => e.oppId === opp.id && (e.st || '').startsWith(m.roundName || ''));
                if (!entries.length) return;
                const e = entries[entries.length - 1];
                res.push({ p, team, rt: e.rt, g: e.g, a: e.a });
            });
        });
    });
    return res;
}

// 4-3-3 из лучших по оценке; если в линии не хватает — добираем лучшими из остальных
function bestEleven(list, score) {
    const need = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
    const sorted = [...list].sort((a, b) => score(b) - score(a));
    const used = new Set(), team = { GK: [], DEF: [], MID: [], FWD: [] };
    Object.keys(need).forEach(pos => sorted.filter(x => x.p.position === pos).slice(0, need[pos]).forEach(x => { team[pos].push(x); used.add(x); }));
    Object.keys(need).forEach(pos => {
        if (pos === 'GK') return;
        while (team[pos].length < need[pos]) {
            const x = sorted.find(y => !used.has(y) && y.p.position !== 'GK');
            if (!x) break;
            team[pos].push(x); used.add(x);
        }
    });
    return team;
}

function elevenHtml(team, val) {
    const rows = ['FWD', 'MID', 'DEF', 'GK'];
    return `<div class="eleven-pitch">${rows.map(pos => `<div class="eleven-row">${team[pos].map(x => {
        const t = x.team || getTeamById(x.p.teamId);
        return `<div class="eleven-p" data-player="${x.p.teamId}-${x.p.number}">${t ? crestHtml(t, 'sm') : ''}<b>${escapeHtml(shortName(x.p.name))}</b><small>${val(x)}</small></div>`;
    }).join('')}</div>`).join('')}</div>`;
}


function renderRoundCover() {
    let host = $('round-cover');
    const news = $('news-section');
    if (!host && news) {
        host = document.createElement('details');
        host.id = 'round-cover';
        host.className = 'card round-cover';
        news.parentElement.insertBefore(host, news);
        host.addEventListener('click', e => {
            const p = e.target.closest('.eleven-p[data-player]');
            if (p) openPlayerCard(p.dataset.player);
        });
    }
    if (!host) return;
    const r = lastCompletedRound();
    const perf = r ? roundPerformances(r.matches) : [];
    if (!r || perf.length < 11) { host.style.display = 'none'; return; }
    host.style.display = '';
    const key = `${state.settings.title || ''}|${r.key}`;
    if (host.dataset.key === key) return;
    const wasNew = host.dataset.key && host.dataset.key !== key;
    host.dataset.key = key;
    if (wasNew) host.open = true;

    const top = [...perf].sort((a, b) => (b.rt - a.rt) || (b.g - a.g))[0];
    // Лучший гол — самый невероятный по xG (без пенальти)
    let goal = null;
    r.matches.forEach(m => (m.goals || []).forEach(g => {
        if (g.pen || g.xg == null) return;
        if (!goal || g.xg < goal.g.xg) goal = { g, m, team: g.s === 1 ? m.team1 : m.team2, opp: g.s === 1 ? m.team2 : m.team1 };
    }));
    const big = r.matches.map(m => { const a = m.aggregateScore || { t1: m.score1, t2: m.score2 }; return { m, a, d: Math.abs(a.t1 - a.t2), sum: a.t1 + a.t2 }; })
        .sort((x, y) => (y.sum - x.sum) || (y.d - x.d))[0];
    const eleven = bestEleven(perf, x => x.rt + x.g * 0.3);
    const topTeam = top.team;
    host.innerHTML = `<summary><span class="rc-kicker">📰 Обложка тура</span> <b>${escapeHtml(r.key)}</b>
            <span class="rc-peek muted">· игрок тура — ${escapeHtml(top.p.name)} (${top.rt.toFixed(1)})</span></summary>
        <div class="rc-body">
            <div class="rc-hero" data-player="${top.p.teamId}-${top.p.number}">
                <div class="rc-hero-crest">${crestHtml(topTeam, 'lg')}</div>
                <div><div class="rc-label">Игрок тура</div><div class="rc-name">${escapeHtml(top.p.name)}</div>
                <div class="muted">${escapeHtml(topTeam.name)} · оценка ${top.rt.toFixed(1)}${top.g ? ` · ⚽ ${top.g}` : ''}${top.a ? ` · 👟 ${top.a}` : ''}</div></div>
            </div>
            <div class="rc-cards">
                ${goal ? `<div class="rc-card"><div class="rc-label">Лучший гол</div><b>${escapeHtml(goal.g.p)}</b>
                    <div class="muted">${goal.g.min}' · ${escapeHtml(goal.team.name)} — ${escapeHtml(goal.opp.name)}${goal.g.sp ? ` · после ${goal.g.sp === 'угловой' ? 'углового' : 'штрафного'}` : ''}</div>
                    <div class="rc-xg">шанс был ${Math.max(1, Math.round(goal.g.xg * 100))}%</div><button type="button" class="btn-more rc-watch">▶ Смотреть гол</button></div>` : ''}
                ${big ? `<div class="rc-card"><div class="rc-label">Матч тура</div><b>${escapeHtml(big.m.team1.name)} ${big.a.t1}:${big.a.t2} ${escapeHtml(big.m.team2.name)}</b>
                    <div class="muted">${big.sum} ${plural5(big.sum)} за матч</div></div>` : ''}
            </div>
            <div class="rc-label">Команда тура · 4-3-3</div>
            ${elevenHtml(eleven, x => x.rt.toFixed(1))}
        </div>`;
    host.querySelector('.rc-hero').onclick = () => openPlayerCard(host.querySelector('.rc-hero').dataset.player);
    const watch = host.querySelector('.rc-watch');
    if (watch && goal) watch.onclick = e => { e.preventDefault(); e.stopPropagation(); openGoalReplay(goal); };
}

// ---------- Награды сезона ----------
function seasonAwards() {
    const players = Object.values(playerStats).filter(p => p.rated);
    if (!players.length) return null;
    const maxRated = Math.max(...players.map(p => p.rated));
    const min = Math.max(2, Math.ceil(maxRated * 0.4));
    const pool = players.filter(p => p.rated >= min);
    const score = p => avgRating(p) * 10 + p.goals * 1.2 + p.assists * 0.8 + (p.motm || 0) * 1.5;
    const best = (list, f) => [...list].sort((a, b) => f(b) - f(a))[0] || null;
    const ageOf = p => { const t = getTeamById(p.teamId); return t ? knownAge(t.name, p.name) : null; };
    const young = pool.filter(p => { const a = ageOf(p); return a && a <= 21; });
    const gks = pool.filter(p => p.position === 'GK');
    const eleven = bestEleven(pool.map(p => ({ p, team: getTeamById(p.teamId) })), x => avgRating(x.p) + x.p.goals * 0.05);
    return { ballon: best(pool, score), young: best(young, score), gk: best(gks, p => avgRating(p)), eleven, ageOf };
}

function renderSeasonAwards() {
    const host = $('tournament-awards');
    if (!host) return;
    document.getElementById('season-awards')?.remove();
    const a = seasonAwards();
    if (!a || !a.ballon) return;
    const team = p => { const t = getTeamById(p.teamId); return t ? teamLabel(t) : ''; };
    const line = p => `ср. ${avgRating(p).toFixed(2)} · ⚽ ${p.goals} · 👟 ${p.assists}`;
    const el = document.createElement('div');
    el.id = 'season-awards';
    el.className = 'season-awards';
    el.innerHTML = `<div class="sa-cards">
            <div class="sa-card gold" data-player="${a.ballon.teamId}-${a.ballon.number}"><span class="sa-icon">🏅</span><div class="sa-title">Золотой мяч</div><b>${escapeHtml(a.ballon.name)}</b><div class="muted">${team(a.ballon)}</div><small>${line(a.ballon)}</small></div>
            ${a.young ? `<div class="sa-card" data-player="${a.young.teamId}-${a.young.number}"><span class="sa-icon">🌱</span><div class="sa-title">Лучший молодой</div><b>${escapeHtml(a.young.name)}</b><div class="muted">${team(a.young)} · ${a.ageOf(a.young)} лет</div><small>${line(a.young)}</small></div>` : ''}
            ${a.gk ? `<div class="sa-card" data-player="${a.gk.teamId}-${a.gk.number}"><span class="sa-icon">🧤</span><div class="sa-title">Лучший вратарь</div><b>${escapeHtml(a.gk.name)}</b><div class="muted">${team(a.gk)}</div><small>ср. оценка ${avgRating(a.gk).toFixed(2)} · матчей ${a.gk.rated}</small></div>` : ''}
        </div>
        <div class="rc-label">Команда сезона · 4-3-3</div>
        ${elevenHtml(a.eleven, x => avgRating(x.p).toFixed(2))}`;
    host.insertAdjacentElement('afterend', el);
    el.addEventListener('click', e => {
        const p = e.target.closest('[data-player]');
        if (p) openPlayerCard(p.dataset.player);
    });
}

document.addEventListener('DOMContentLoaded', renderHomeAchievements);
if (document.readyState !== 'loading') setTimeout(renderHomeAchievements, 0);

// ---------- Раздевалка: после трёх поражений подряд — разговор с командой ----------
function lossStreak(team) {
    const form = (team.stats && team.stats.form) || [];
    let n = 0;
    for (let i = form.length - 1; i >= 0 && String(form[i])[0] === 'L'; i--) n++;
    return n;
}

function offerLockerRoom(m) {
    $('btn-locker')?.remove();
    if (!isCareer()) return;
    const team = humanTeams().find(t => m.involves(t));
    const next = $('btn-next-match');
    if (!team || !next) return;
    const squad = getSquad(team);
    if (lossStreak(team) < 3 || squad.lockerAt === team.stats.played) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'btn-locker';
    b.className = 'btn-secondary btn-press btn-locker';
    b.innerHTML = '<span class="btn-icon">🗣️</span><span class="btn-text">Раздевалка: напряжение</span>';
    b.onclick = () => openLockerRoom(team);
    next.parentElement.insertBefore(b, next);
}

function openLockerRoom(team) {
    const squad = getSquad(team);
    const players = getSquadPlayers(team);
    const capNum = squad.captain != null ? squad.captain : autoCaptain(players);
    const cap = players.find(p => p.number === capNum);
    const capMorale = cap ? (squad.players[cap.number].morale ?? MORALE_DEFAULT) : MORALE_DEFAULT;
    const low = players.filter(p => (squad.players[p.number].morale ?? MORALE_DEFAULT) < 45);
    const n = lossStreak(team);
    const bump = (p, v) => { const s = squad.players[p.number]; s.morale = Math.round(Math.max(5, Math.min(100, (s.morale ?? MORALE_DEFAULT) + v))); };
    const options = [
        { t: `Дать слово капитану${cap ? ` — ${cap.name}` : ''}`, run: () => {
            if (capMorale >= 50) { players.forEach(p => bump(p, 4)); if (cap) bump(cap, 3); return `${cap ? cap.name : 'Капитан'} собрал команду: мораль +4 всем.`; }
            players.forEach(p => bump(p, 1)); if (cap) bump(cap, -3);
            return `${cap ? cap.name : 'Капитан'} сам подавлен — разговор не получился: мораль +1, у капитана −3.`;
        } },
        { t: 'Собрание всей командой: разобрать ошибки вместе', run: () => { players.forEach(p => bump(p, 2)); return 'Спокойный разговор: мораль +2 всем.'; } },
        { t: 'Жёсткий разнос: кто не готов бороться — сядет в запас', run: () => {
            low.forEach(p => bump(p, -6));
            players.filter(p => !low.includes(p)).forEach(p => bump(p, 3));
            return low.length ? `Недовольные (${low.length}) обиделись: −6; остальные собрались: +3.` : 'Команда восприняла разнос: мораль +3.';
        } }
    ];
    document.querySelector('.press-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay press-overlay';
    el.innerHTML = `<div class="confirm-box press-box" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <div class="press-head">🗣️ Раздевалка <span class="muted">· ${escapeHtml(team.name)}</span></div>
        <div class="press-q">${n} ${({ 'матч': 'поражение', 'матча': 'поражения' })[plural5m(n)] || 'поражений'} подряд — в команде напряжение.${low.length ? ` Недовольных: ${low.length}.` : ''} Капитан: ${cap ? escapeHtml(cap.name) : '—'} (настроение ${capMorale}).</div>
        <div class="press-answers">${options.map((o, k) => `<button type="button" class="press-a" data-k="${k}">${escapeHtml(o.t)}</button>`).join('')}</div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.pc-close')) el.remove(); });
    el.querySelectorAll('.press-a').forEach(b => b.onclick = () => {
        const res = options[Number(b.dataset.k)].run();
        squad.lockerAt = team.stats.played;
        if (typeof pushNews === 'function') pushNews({ tag: 'club', teams: [team], weight: 5, title: `Разговор в раздевалке «${team.name}»`, text: res });
        saveGame();
        $('btn-locker')?.remove();
        el.querySelector('.confirm-box').innerHTML = `<div class="press-head">🗣️ Раздевалка</div><div class="press-result">${escapeHtml(res)}</div><button type="button" class="btn-primary press-done">Готово</button>`;
        el.querySelector('.press-done').onclick = () => el.remove();
    });
}

// ---------- Музей клуба: трофеи, сезоны, легенды и рекорды вашей карьеры ----------
const MUSEUM_KEY = 'footballSimPro.museum';
function readMuseum() {
    try { const d = JSON.parse(localStorage.getItem(MUSEUM_KEY)); if (d && d.clubs) return d; } catch (e) { /* ignore */ }
    return { clubs: {} };
}
function writeMuseum(d) { try { localStorage.setItem(MUSEUM_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }

function museumClubs() {
    return Object.entries(readMuseum().clubs).map(([name, c]) => ({ name, ...c }))
        .sort((a, b) => (b.trophies || []).length - (a.trophies || []).length || (b.seasons || []).length - (a.seasons || []).length);
}

// Место команды в завершённом турнире
function museumPlace(team, champion) {
    if (champion && champion.id === team.id) return { label: '🏆 Победитель', rank: 1 };
    if (state.settings.mode === 'league' && !state.settings.ucl) {
        const pos = sortGroup([...state.teams]).findIndex(t => t.id === team.id) + 1;
        return { label: `${pos}-е место`, rank: pos };
    }
    const final = state.tournamentHistory[state.tournamentHistory.length - 1]?.matches[0];
    if (final && final.involves(team)) return { label: '🥈 Финалист', rank: 2 };
    const rounds = state.tournamentHistory.filter(r => r.matches.some(m => m.involves(team)));
    const last = rounds[rounds.length - 1];
    return { label: last && last.name ? last.name : 'участник', rank: 9 };
}

// Записывается один раз на экране итогов — для команд игроков
function museumRecord(champion) {
    if (!hasHumans() || state.museumRecorded) return;
    state.museumRecorded = true;
    const mus = readMuseum();
    const fmt = state.settings.seriesTitle || state.settings.title || formatLabel(state.settings);
    const date = new Date().toLocaleDateString('ru-RU');
    humanTeams().forEach(team => {
        const c = mus.clubs[team.name] || (mus.clubs[team.name] = { emoji: team.emoji, trophies: [], seasons: [], players: {}, records: {} });
        const place = museumPlace(team, champion);
        const st = team.stats || {};
        const scorers = Object.values(playerStats).filter(p => p.teamId === team.id);
        const top = [...scorers].sort((a, b) => b.goals - a.goals)[0];
        c.seasons.unshift({ date, fmt, place: place.label, w: st.won || 0, d: st.drawn || 0, l: st.lost || 0, gf: st.gf || 0, ga: st.ga || 0,
            top: top && top.goals ? `${top.name} (${top.goals})` : '' });
        c.seasons = c.seasons.slice(0, 40);
        if (place.rank === 1) c.trophies.unshift({ title: fmt, date });
        scorers.forEach(p => {
            if (!p.matches && !p.goals) return;
            const r = c.players[p.name] || (c.players[p.name] = { pos: p.position, goals: 0, assists: 0, matches: 0, motm: 0, seasons: 0 });
            r.goals += p.goals; r.assists += p.assists; r.matches += p.matches; r.motm += p.motm || 0; r.seasons++;
            if (p.goals > ((c.records.seasonGoals && c.records.seasonGoals.n) || 0)) c.records.seasonGoals = { n: p.goals, name: p.name, date };
        });
        // Крупнейшая победа
        allPlayedMatches().filter(m => m.involves(team)).forEach(m => {
            const a = m.aggregateScore || { t1: m.score1, t2: m.score2 };
            const home = m.team1.id === team.id;
            const my = home ? a.t1 : a.t2, their = home ? a.t2 : a.t1;
            const best = c.records.bigWin;
            if (my - their > 0 && (!best || my - their > best.diff || (my - their === best.diff && my > best.my)))
                c.records.bigWin = { diff: my - their, my, text: `${m.team1.name} ${a.t1}:${a.t2} ${m.team2.name}`, date };
        });
        if (!c.records.bestSeason || (st.won || 0) > c.records.bestSeason.w) c.records.bestSeason = { w: st.won || 0, text: `${fmt}: ${st.won || 0} побед`, date };
    });
    writeMuseum(mus);
    renderHomeAchievements();
}

const MEDALS = ['🥇', '🥈', '🥉'];

function openMuseum(clubName) {
    const clubs = museumClubs();
    document.querySelector('.museum-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay museum-overlay';
    const cur = clubs.find(c => c.name === clubName) || clubs[0];
    const team = cur ? (state.teams.find(t => t.name === cur.name) || { name: cur.name, emoji: cur.emoji }) : null;
    const score = p => p.goals * 2 + p.assists + p.motm * 2 + p.matches * 0.1;
    const legends = cur ? Object.entries(cur.players).map(([name, p]) => ({ name, ...p })).sort((a, b) => score(b) - score(a)).slice(0, 10) : [];
    const empty = '<p class="muted">Музей пополняется в режиме «Играть за команду»: после каждого турнира сюда попадают трофеи, сезоны, лучшие игроки и рекорды.</p>';
    const body = !cur ? empty : `
        ${clubs.length > 1 ? `<div class="mu-tabs">${clubs.map(c => `<button type="button" data-club="${escapeHtml(c.name)}" class="${c.name === cur.name ? 'active' : ''}">${escapeHtml(c.name)}</button>`).join('')}</div>` : ''}
        <div class="mu-head">${crestHtml(team, 'lg')}<div><div class="mu-name">${escapeHtml(cur.name)}</div>
            <div class="muted">турниров: ${cur.seasons.length} · трофеев: ${cur.trophies.length}</div></div></div>
        <div class="mu-label">Витрина трофеев</div>
        <div class="mu-shelf">${cur.trophies.length ? cur.trophies.map(t => `<div class="mu-cup"><span>🏆</span><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.date)}</small></div>`).join('') : '<div class="muted">Пока пусто — первый трофей впереди.</div>'}</div>
        <div class="mu-label">Рекорды</div>
        <div class="mu-records">
            ${cur.records.bigWin ? `<div><span>Крупнейшая победа</span><b>${escapeHtml(cur.records.bigWin.text)}</b></div>` : ''}
            ${cur.records.seasonGoals ? `<div><span>Голов за турнир</span><b>${escapeHtml(cur.records.seasonGoals.name)} — ${cur.records.seasonGoals.n}</b></div>` : ''}
            ${cur.records.bestSeason ? `<div><span>Лучший турнир</span><b>${escapeHtml(cur.records.bestSeason.text)}</b></div>` : ''}
        </div>
        <div class="mu-label">Легенды клуба</div>
        <table class="stats-table mu-legends"><thead><tr><th>Игрок</th><th>И</th><th>Голы</th><th>Пасы</th><th>⭐</th></tr></thead><tbody>
            ${legends.map((p, i) => `<tr><td>${MEDALS[i] ? MEDALS[i] + ' ' : ''}${escapeHtml(p.name)}</td><td>${p.matches}</td><td>${p.goals}</td><td>${p.assists}</td><td>${p.motm}</td></tr>`).join('')}
        </tbody></table>
        <div class="mu-label">История</div>
        <table class="stats-table mu-seasons"><thead><tr><th>Турнир</th><th>Итог</th><th>В-Н-П</th><th>Мячи</th><th>Бомбардир</th></tr></thead><tbody>
            ${cur.seasons.map(s => `<tr><td>${escapeHtml(s.fmt)}<div class="muted">${escapeHtml(s.date)}</div></td><td>${escapeHtml(s.place)}</td><td>${s.w}-${s.d}-${s.l}</td><td>${s.gf}-${s.ga}</td><td>${escapeHtml(s.top)}</td></tr>`).join('')}
        </tbody></table>`;
    el.innerHTML = `<div class="confirm-box museum-box" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <h3>🏛️ Музей клуба</h3>${body}</div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('.pc-close')) { el.remove(); return; }
        const b = e.target.closest('[data-club]');
        if (b) openMuseum(b.dataset.club);
    });
}

// ---------- Просмотр гола (лучший гол тура): мини-трансляция по данным протокола ----------
// Мяч идёт по цепочке: защита → полузащита → голевой пас → удар → сетка; для углового и пенальти — свой розыгрыш.
function openGoalReplay(info) {
    const { g, m, team, opp } = info;
    document.querySelector('.goal-replay-overlay')?.remove();
    const kits = typeof getMatchKits === 'function' ? getMatchKits(m) : null;
    const isT1 = m.team1.id === team.id;
    const kitA = kits ? (isT1 ? kits.team1 : kits.team2) : { primary: '#2d6fe8', secondary: '#fff', text: '#fff' };
    const kitB = kits ? (isT1 ? kits.team2 : kits.team1) : { primary: '#e5323b', secondary: '#fff', text: '#fff' };
    const el = document.createElement('div');
    el.className = 'confirm-overlay goal-replay-overlay';
    el.innerHTML = `<div class="confirm-box gr-box" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <div class="gr-head">🎬 Лучший гол тура · <b>${escapeHtml(g.p)}</b> <span class="muted">${g.min}' · ${escapeHtml(team.name)} — ${escapeHtml(opp.name)}</span></div>
        <div class="gr-field football-field" data-pattern="stripes"><div class="field-markings"></div><div class="goal-right gr-goal"></div><div class="gr-ball ball"></div></div>
        <div class="gr-caption" id="gr-caption"></div>
        <div class="gr-actions"><button type="button" class="btn-secondary gr-again">↻ Ещё раз</button></div>
    </div>`;
    document.body.appendChild(el);
    const field = el.querySelector('.gr-field');
    const ball = el.querySelector('.gr-ball');
    const rnd = (a, b) => a + Math.random() * (b - a);
    const mk = (kit, number, name, gk) => {
        const p = document.createElement('div');
        p.className = `player ${gk ? 'goalkeeper' : ''}`;
        p.style.cssText = `--shirt:${gk ? '#a3e635' : kit.primary};--shorts:${kit.secondary};--num:${gk ? '#111' : kit.text};--face:1;transition:left .65s ease-in-out, top .65s ease-in-out`;
        p.innerHTML = playerInnerHtml(number, name);
        field.appendChild(p);
        return p;
    };
    const place = (p, x, y) => { p.style.left = `${x}%`; p.style.top = `${y}%`; };
    // Атакующая команда (бьёт вправо) и защищающаяся
    const shortN = n => String(n || '').split(' ').slice(-1)[0];
    const att = [], def = [];
    const attPos = [[8, 50], [30, 20], [28, 40], [28, 60], [30, 80], [50, 30], [48, 50], [50, 70], [68, 22], [70, 50], [68, 78]];
    const defPos = [[97, 50], [86, 22], [88, 40], [88, 60], [86, 78], [76, 25], [74, 45], [74, 58], [76, 75], [62, 40], [62, 60]];
    attPos.forEach((pos, i) => att.push(mk(kitA, i + 1, '', i === 0)));
    defPos.forEach((pos, i) => def.push(mk(kitB, i + 1, '', i === 0)));
    const scorer = att[9], assister = g.a ? att[8] : null;
    scorer.querySelector('.player-name') && (scorer.querySelector('.player-name').textContent = shortN(g.p));
    if (!scorer.querySelector('.player-name')) { const s = document.createElement('span'); s.className = 'player-name'; s.textContent = shortN(g.p); scorer.appendChild(s); }
    if (assister) { const s = document.createElement('span'); s.className = 'player-name'; s.textContent = shortN(g.a); assister.appendChild(s); }

    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const moveBall = (x, y, ms = 650) => { ball.style.transition = `left ${ms}ms ease-in-out, top ${ms}ms ease-in-out`; ball.style.left = `${x}%`; ball.style.top = `${y}%`; };
    const caption = t => { const c = el.querySelector('#gr-caption'); if (c) c.textContent = t; };
    const run = () => {
        timers.forEach(clearTimeout); timers = [];
        attPos.forEach((pos, i) => place(att[i], pos[0], pos[1]));
        defPos.forEach((pos, i) => place(def[i], pos[0], pos[1]));
        field.querySelector('.gr-goal').classList.remove('net-shake');
        const shotY = rnd(38, 62);
        let steps;
        if (g.pen) {
            place(scorer, 86, 50); defPos.forEach((pos, i) => { if (i) place(def[i], 80 - (i % 3) * 3, 20 + i * 6); });
            steps = [{ ball: [89, 50], t: 'Пенальти' }, { ball: [99.5, rnd(42, 58)], t: `ГОЛ! ${g.p} с пенальти`, goal: true }];
            moveBall(89, 50, 0);
        } else if (g.sp) {
            const top = Math.random() < 0.5;
            const taker = assister || att[7];
            place(taker, 98.5, top ? 3 : 97); place(scorer, 84, 50);
            moveBall(98.5, top ? 3 : 97, 0);
            steps = [{ ball: [98.5, top ? 3 : 97], t: `${g.sp === 'угловой' ? 'Угловой' : 'Штрафной'}: подаёт ${g.a || 'партнёр'}` },
                { ball: [90, shotY], move: [[scorer, 89, shotY]], t: `${g.p} выигрывает верх` },
                { ball: [99.5, shotY], t: `ГОЛ! ${g.p}`, goal: true }];
        } else {
            moveBall(30, 40, 0);
            steps = [{ ball: [30, 40], t: 'Атака начинается от защиты' },
                { ball: [50, 50], move: [[att[6], 50, 50], [scorer, 78, 50]], t: 'Передача в центр поля' },
                { ball: assister ? [74, 24] : [72, 50], move: [[assister || att[6], assister ? 74 : 72, assister ? 24 : 50], [scorer, 84, shotY]], t: assister ? `${g.a} — на ход` : 'Проход по центру' },
                { ball: [86, shotY], move: [[scorer, 86, shotY], [def[2], 90, shotY - 4]], t: `${g.p} бьёт${g.xg != null && g.xg < 0.08 ? ' — издалека!' : ''}` },
                { ball: [99.5, Math.min(58, Math.max(42, shotY))], t: `ГОЛ! ${g.p}${g.xg != null ? ` · шанс был ${Math.max(1, Math.round(g.xg * 100))}%` : ''}`, goal: true }];
        }
        steps.forEach((s, i) => later(() => {
            (s.move || []).forEach(([p, x, y]) => place(p, x, y));
            moveBall(s.ball[0], s.ball[1], s.goal ? 380 : 650);
            caption(s.t);
            if (typeof playSound === 'function') playSound(s.goal ? 'kick' : 'kick');
            if (s.goal) later(() => { field.querySelector('.gr-goal').classList.add('net-shake'); if (typeof playSound === 'function') playSound('goal'); }, 380);
        }, 400 + i * 800));
    };
    run();
    el.querySelector('.gr-again').onclick = run;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.pc-close')) { timers.forEach(clearTimeout); el.remove(); } });
}

// ---------- Трофейная комната: кубки на полках, по нажатию — история победы ----------
function trophyKind(format) {
    const f = String(format || '');
    if (/Лига чемпионов/.test(f)) return 'ucl';
    if (/Лига Европы/.test(f)) return 'uel';
    if (/конференций/i.test(f)) return 'uecl';
    if (/Чемпионат мира|Клубный чемпионат мира/.test(f)) return 'wc';
    if (/Чемпионат Европы/.test(f)) return 'euro';
    if (/Кубок Америки/.test(f)) return 'copa';
    if (/Суперкубок/.test(f)) return 'super';
    if (/Кубок/.test(f)) return 'cup';
    if (/РПЛ|Лига|Первая лига/.test(f)) return 'league';
    return 'cup';
}

function trophyHtml(kind) {
    if (kind === 'league') return `<div class="t-cup t-${kind}"><div class="t-plate"></div><div class="t-base"></div></div>`;
    return `<div class="t-cup t-${kind}"><div class="t-handle l"></div><div class="t-handle r"></div><div class="t-body"></div><div class="t-stem"></div><div class="t-base"></div></div>`;
}

function openTrophyRoom(mode = 'mine') {
    const hall = typeof readHall === 'function' ? readHall() : { tournaments: [] };
    const all = hall.tournaments.filter(t => t.champion);
    const mine = all.filter(t => t.userTeam && t.champion && t.userTeam.name === t.champion.name);
    const list = mode === 'mine' ? mine : all;
    document.querySelector('.trophy-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay trophy-overlay';
    const shelves = [];
    for (let i = 0; i < list.length; i += 5) shelves.push(list.slice(i, i + 5));
    el.innerHTML = `<div class="confirm-box trophy-box" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <h3>🏆 Трофейная комната</h3>
        <div class="mu-tabs"><button type="button" data-tmode="mine" class="${mode === 'mine' ? 'active' : ''}">Ваши трофеи (${mine.length})</button><button type="button" data-tmode="all" class="${mode === 'all' ? 'active' : ''}">Все чемпионы (${all.length})</button></div>
        ${list.length ? shelves.map(row => `<div class="t-shelf">${row.map((t, k) => {
            const idx = all.indexOf(t);
            return `<button type="button" class="t-item" data-t="${idx}" style="--i:${k}">${trophyHtml(trophyKind(t.format))}<span>${escapeHtml(String(t.format || '').split(',')[0])}</span><small>${escapeHtml(t.champion.name)} · ${escapeHtml(t.date || '')}</small></button>`;
        }).join('')}</div>`).join('')
        : `<p class="muted">${mode === 'mine' ? 'Пока пусто. Выиграйте турнир в режиме «Играть за команду» — кубок появится на полке.' : 'Ещё не сыграно ни одного турнира.'}</p>`}
        <div class="t-story" id="t-story"></div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('.pc-close')) { el.remove(); return; }
        const tab = e.target.closest('[data-tmode]');
        if (tab) { openTrophyRoom(tab.dataset.tmode); return; }
        const it = e.target.closest('[data-t]');
        if (!it) return;
        const t = all[Number(it.dataset.t)];
        el.querySelectorAll('.t-item').forEach(x => x.classList.toggle('active', x === it));
        const story = el.querySelector('#t-story');
        story.innerHTML = `<div class="ts-head">${trophyHtml(trophyKind(t.format))}<div><b>${escapeHtml(t.format || '')}</b><div class="muted">${escapeHtml(t.date || '')}</div></div></div>
            <p>🏆 Чемпион — <b>${escapeHtml(t.champion.name)}</b>${t.runnerUp ? `, ${/Лига|РПЛ/.test(t.format || '') && !/чемпионов|Европы|конференций/.test(t.format || '') ? 'второе место' : 'в финале обыгран'} — ${escapeHtml(t.runnerUp.name)}` : ''}.</p>
            ${t.topScorer ? `<p>⚽ Лучший бомбардир: <b>${escapeHtml(t.topScorer.name)}</b> (${escapeHtml(t.topScorer.team)}) — ${t.topScorer.goals} ${plural5(t.topScorer.goals)}.</p>` : ''}
            ${t.userTeam ? `<p>👔 Вы играли за «${escapeHtml(t.userTeam.name)}»${t.userTeam.name === t.champion.name ? ' — и выиграли!' : '.'}</p>` : ''}`;
        story.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

// ---------- Хроника сезона: журнал на несколько страниц после турнира ----------
function chronicleData() {
    const matches = allPlayedMatches();
    const champion = state.champion;
    // Лучшие голы — самые невероятные по xG (без пенальти)
    const goals = [];
    matches.forEach(m => (m.goals || []).forEach(g => {
        if (g.pen || g.xg == null) return;
        goals.push({ g, m, team: g.s === 1 ? m.team1 : m.team2, opp: g.s === 1 ? m.team2 : m.team1 });
    }));
    goals.sort((a, b) => a.g.xg - b.g.xg);
    // Крупнейшая победа и самый результативный матч
    let big = null, wild = null, total = 0;
    matches.forEach(m => {
        const a = m.aggregateScore || { t1: m.score1, t2: m.score2 };
        const d = Math.abs(a.t1 - a.t2), sum = a.t1 + a.t2;
        total += sum;
        if (!big || d > big.d) big = { m, a, d };
        if (!wild || sum > wild.sum) wild = { m, a, sum };
    });
    const hattricks = matches.reduce((acc, m) => {
        const c = {};
        (m.goals || []).forEach(g => { const k = g.s + g.p; c[k] = (c[k] || 0) + 1; });
        return acc + Object.values(c).filter(n => n >= 3).length;
    }, 0);
    const quotes = (state.news || []).filter(n => n.tag === 'club' && /^Тренер/.test(n.title || '')).slice(0, 3);
    return { champion, goals: goals.slice(0, 3), big, wild, total, games: matches.length, hattricks, quotes, awards: seasonAwards() };
}

function chroniclePages(d) {
    const fmt = (typeof formatLabel === 'function' ? formatLabel(state.settings) : '') || 'Турнир';
    const c = d.champion;
    const top = Object.values(playerStats).sort((a, b) => b.goals - a.goals)[0];
    const score = x => `${escapeHtml(x.m.team1.name)} ${x.a.t1}:${x.a.t2} ${escapeHtml(x.m.team2.name)}`;
    const pages = [];
    pages.push(`<div class="ch-cover">
        <div class="ch-mast">ХРОНИКА СЕЗОНА</div>
        <div class="ch-issue">${escapeHtml(fmt)} · ${new Date().toLocaleDateString('ru-RU')}</div>
        ${c ? `<div class="ch-crest">${crestHtml(c, 'xl')}</div><h2>«${escapeHtml(c.name)}» — чемпион!</h2>` : ''}
        ${top && top.goals ? `<p class="ch-lead">Лучший бомбардир — ${escapeHtml(top.name)}: ${top.goals} ${plural5(top.goals)}.</p>` : ''}
        <p class="muted">${d.games} ${plural5m(d.games)} · ${d.total} ${plural5(d.total)} · в среднем ${(d.total / Math.max(1, d.games)).toFixed(2)} за игру</p>
    </div>`);
    if (d.goals.length) pages.push(`<h3 class="ch-h">⚽ Голы сезона</h3>${d.goals.map((x, i) => `<div class="ch-goal">
        <span class="ch-rank">${i + 1}</span>
        <div><b>${escapeHtml(x.g.p)}</b> <span class="muted">${x.g.min}' · ${escapeHtml(x.team.name)} — ${escapeHtml(x.opp.name)}</span>
        <div class="rc-xg">шанс был ${Math.max(1, Math.round(x.g.xg * 100))}%${x.g.sp ? ` · после ${x.g.sp === 'угловой' ? 'углового' : 'штрафного'}` : ''}</div></div>
        <button type="button" class="btn-more" data-goal="${i}">▶ Смотреть</button></div>`).join('')}`);
    const a = d.awards;
    if (a && a.ballon) pages.push(`<h3 class="ch-h">⭐ Герои сезона</h3>
        <div class="ch-heroes">
            <div><span>🏅 Золотой мяч</span><b>${escapeHtml(a.ballon.name)}</b><small>ср. ${avgRating(a.ballon).toFixed(2)} · ⚽ ${a.ballon.goals} · 👟 ${a.ballon.assists}</small></div>
            ${a.young ? `<div><span>🌱 Лучший молодой</span><b>${escapeHtml(a.young.name)}</b><small>${a.ageOf(a.young)} лет</small></div>` : ''}
            ${a.gk ? `<div><span>🧤 Лучший вратарь</span><b>${escapeHtml(a.gk.name)}</b><small>ср. ${avgRating(a.gk).toFixed(2)}</small></div>` : ''}
        </div>
        <div class="rc-label">Команда сезона</div>${elevenHtml(a.eleven, x => avgRating(x.p).toFixed(2))}`);
    // Таблица (лига) или путь чемпиона (плей-офф)
    const league = (state.settings.originalMode || state.settings.mode) === 'league' || state.settings.ucl;
    if (league) {
        const rows = sortGroup([...state.teams]).slice(0, 8);
        pages.push(`<h3 class="ch-h">📊 Итоговая таблица</h3><table class="stats-table ch-table"><thead><tr><th>#</th><th>Команда</th><th>И</th><th>О</th><th>Мячи</th></tr></thead><tbody>
            ${rows.map((t, i) => `<tr><td>${i + 1}</td><td>${teamLabel(t)}</td><td>${t.stats.played}</td><td><b>${t.stats.points}</b></td><td>${t.stats.gf}-${t.stats.ga}</td></tr>`).join('')}</tbody></table>`);
    } else if (c) {
        const path = state.tournamentHistory.map(r => ({ r, m: r.matches.find(m => m.involves(c)) })).filter(x => x.m);
        pages.push(`<h3 class="ch-h">🛤️ Путь чемпиона</h3>${path.map(x => {
            const g = x.m.aggregateScore;
            return `<div class="ch-path"><span>${escapeHtml(x.r.round || x.r.name || '')}</span><b>${escapeHtml(x.m.team1.name)} ${g.t1}:${g.t2} ${escapeHtml(x.m.team2.name)}</b>${x.m.penalties && x.m.penalties.kicks.length ? `<small>пен. ${x.m.penalties.t1}:${x.m.penalties.t2}</small>` : ''}</div>`;
        }).join('')}`);
    }
    pages.push(`<h3 class="ch-h">🎙️ Цитаты и цифры</h3>
        ${d.quotes.length ? d.quotes.map(q => `<blockquote class="ch-quote">${escapeHtml(q.title)}</blockquote>`).join('') : '<p class="muted">Тренеры в этом турнире не давали пресс-конференций.</p>'}
        <div class="ch-facts">
            ${d.big ? `<div><span>Крупнейшая победа</span><b>${score(d.big)}</b></div>` : ''}
            ${d.wild ? `<div><span>Самый результативный матч</span><b>${score(d.wild)}</b></div>` : ''}
            <div><span>Хет-трики</span><b>${d.hattricks}</b></div>
            <div><span>Голов за турнир</span><b>${d.total}</b></div>
        </div>`);
    return pages;
}

function openChronicle() {
    const d = chronicleData();
    const pages = chroniclePages(d);
    document.querySelector('.chron-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay chron-overlay';
    let i = 0;
    const render = () => {
        el.innerHTML = `<div class="confirm-box chron-box" role="dialog" aria-modal="true">
            <button type="button" class="pc-close" title="Закрыть">✕</button>
            <div class="chron-page" style="animation:chPage .35s ease-out">${pages[i]}</div>
            <div class="chron-nav">
                <button type="button" class="btn-secondary" data-nav="-1" ${i ? '' : 'disabled'}>← Назад</button>
                <span class="chron-dots">${pages.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>
                <button type="button" class="btn-primary" data-nav="1">${i < pages.length - 1 ? 'Дальше →' : 'Закрыть'}</button>
            </div></div>`;
    };
    render();
    document.body.appendChild(el);
    el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('.pc-close')) { el.remove(); return; }
        const nav = e.target.closest('[data-nav]');
        if (nav) {
            const n = i + Number(nav.dataset.nav);
            if (n >= pages.length) { el.remove(); return; }
            i = Math.max(0, n); render(); return;
        }
        const g = e.target.closest('[data-goal]');
        if (g) openGoalReplay(d.goals[Number(g.dataset.goal)]);
        const p = e.target.closest('.eleven-p[data-player]');
        if (p) openPlayerCard(p.dataset.player);
    });
    // Листание свайпом
    let sx = null;
    el.addEventListener('pointerdown', e => { sx = e.clientX; });
    el.addEventListener('pointerup', e => {
        if (sx == null) return;
        const dx = e.clientX - sx; sx = null;
        if (Math.abs(dx) > 60) { i = Math.max(0, Math.min(pages.length - 1, i + (dx < 0 ? 1 : -1))); render(); }
    });
}

function renderChronicleButton() {
    const box = document.querySelector('#screen-results .champion-box-v2');
    if (!box) return;
    let b = document.getElementById('btn-chronicle');
    if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.id = 'btn-chronicle';
        b.className = 'btn-primary btn-chronicle';
        b.innerHTML = '<span class="btn-text">📖 Хроника сезона</span>';
        b.onclick = openChronicle;
        box.insertAdjacentElement('afterend', b);
    }
    b.style.display = state.settings.stageOnly ? 'none' : '';
}

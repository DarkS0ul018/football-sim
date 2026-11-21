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
    host.innerHTML = `<button type="button" class="home-ach-btn"><span class="ach-icon">🏅</span><span><b>Достижения</b><small class="muted">${achSummary()} открыто</small></span><span class="home-ach-go">→</span></button>`;
    host.querySelector('button').onclick = openAchievements;
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
                    <div class="rc-xg">шанс был ${Math.max(1, Math.round(goal.g.xg * 100))}%</div></div>` : ''}
                ${big ? `<div class="rc-card"><div class="rc-label">Матч тура</div><b>${escapeHtml(big.m.team1.name)} ${big.a.t1}:${big.a.t2} ${escapeHtml(big.m.team2.name)}</b>
                    <div class="muted">${big.sum} ${plural5(big.sum)} за матч</div></div>` : ''}
            </div>
            <div class="rc-label">Команда тура · 4-3-3</div>
            ${elevenHtml(eleven, x => x.rt.toFixed(1))}
        </div>`;
    host.querySelector('.rc-hero').onclick = () => openPlayerCard(host.querySelector('.rc-hero').dataset.player);
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

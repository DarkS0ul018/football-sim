// ===== СТАТИСТИКА МАТЧА: xG, карта ударов, оценки игроков, лучший игрок =====

// Разметка поля для карты ударов (метры: 105 × 68)
const SHOTMAP_PITCH = `
    <rect x="0" y="0" width="105" height="68" class="sm-grass"/>
    <g class="sm-line">
        <rect x="0" y="0" width="105" height="68"/>
        <line x1="52.5" y1="0" x2="52.5" y2="68"/>
        <circle cx="52.5" cy="34" r="9.15"/>
        <rect x="0" y="13.84" width="16.5" height="40.32"/>
        <rect x="88.5" y="13.84" width="16.5" height="40.32"/>
        <rect x="0" y="24.84" width="5.5" height="18.32"/>
        <rect x="99.5" y="24.84" width="5.5" height="18.32"/>
        <path d="M16.5 26.7 A9.15 9.15 0 0 1 16.5 41.3"/>
        <path d="M88.5 26.7 A9.15 9.15 0 0 0 88.5 41.3"/>
    </g>
    <rect x="-1.6" y="30.34" width="1.6" height="7.32" class="sm-goalframe"/>
    <rect x="105" y="30.34" width="1.6" height="7.32" class="sm-goalframe"/>`;

const SHOT_RESULT_LABEL = { goal: 'гол', save: 'сейв', off: 'мимо', 'pen-goal': 'пенальти — гол', 'pen-miss': 'пенальти — не забит' };

// Карта ударов: team1 атакует вправо, team2 — влево (как на поле матча)
function renderShotMap(sim) {
    const svg = $('shot-map');
    if (!svg) return;
    const shots = sim.shotLog || [];
    const shown = Number(svg.dataset.n || 0);
    const goalFirst = (a, b) => (a.result.endsWith('goal') ? 1 : 0) - (b.result.endsWith('goal') ? 1 : 0); // голы — поверх
    const dots = shots.map((s, i) => ({ s, i })).sort((a, b) => goalFirst(a.s, b.s)).map(({ s, i }) => {
        const x = (s.side === 'team1' ? s.r : 100 - s.r) * 1.05;
        const y = s.y * 0.68;
        const rad = (0.8 + Math.sqrt(s.xg) * 3.4).toFixed(2);
        const res = s.result.endsWith('goal') ? 'goal' : (s.result === 'save' ? 'save' : 'off');
        const fresh = i >= shown ? ' sm-new' : '';
        const tip = `${s.name}, ${s.minute}' · xG ${s.xg.toFixed(2)} · ${SHOT_RESULT_LABEL[s.result] || s.result}${s.header ? ' (головой)' : ''}`;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" class="sm-dot sm-${s.side} sm-${res}${fresh}"><title>${tip}</title></circle>`;
    }).join('');
    svg.innerHTML = SHOTMAP_PITCH + dots;
    svg.dataset.n = shots.length;
    setText('xg-1', sim.stats.xg.team1.toFixed(2));
    setText('xg-2', sim.stats.xg.team2.toFixed(2));
}

function resetShotMap() {
    const svg = $('shot-map');
    if (svg) { svg.dataset.n = 0; svg.innerHTML = SHOTMAP_PITCH; }
    setText('xg-1', '0.00');
    setText('xg-2', '0.00');
    const motm = $('motm');
    if (motm) { motm.style.display = 'none'; motm.innerHTML = ''; }
}

// Цвет оценки — как в спортивных приложениях
function ratingClass(r) {
    if (r >= 8) return 'r-top';
    if (r >= 7) return 'r-good';
    if (r >= 6) return 'r-ok';
    return 'r-bad';
}

// Оценки всех игроков: ключ «сторона:номер»
function ratingsMap(sim) {
    const map = new Map();
    if (!sim.minute) return map;
    sim.playerRatings().forEach(r => map.set(`${r.side}:${r.number}`, r.rating));
    return map;
}

// Лучший игрок матча — плашка в статистике и строка в ленте
function showManOfTheMatch(m, sim) {
    const best = sim && sim.minute ? sim.manOfTheMatch() : null;
    const box = $('motm');
    if (!best || !box) return;
    const team = sim.sides[best.side].team;
    const goals = sim.events.filter(e => e.type === 'goal' && e.side === best.side && e.player && e.player.number === best.number).length;
    const assists = sim.events.filter(e => e.type === 'goal' && e.side === best.side && e.assister && e.assister.number === best.number).length;
    const saves = best.position === 'GK' ? sim.shotLog.filter(s => s.side !== best.side && s.keeper === best.number && s.result === 'save').length : 0;
    const xg = sim.shotLog.filter(s => s.side === best.side && s.player === best.number).reduce((a, s) => a + s.xg, 0);
    const facts = [];
    if (goals) facts.push(`${goals} ${plural(goals, 'гол', 'гола', 'голов')}`);
    if (assists) facts.push(`${assists} ${plural(assists, 'передача', 'передачи', 'передач')}`);
    if (saves) facts.push(`${saves} ${plural(saves, 'сейв', 'сейва', 'сейвов')}`);
    if (xg >= 0.05) facts.push(`xG ${xg.toFixed(2)}`);
    box.innerHTML = `
        <div class="motm-star">★</div>
        <div class="motm-body">
            <div class="motm-label">${sim.combined ? 'Лучший игрок двух матчей' : 'Лучший игрок матча'}</div>
            <div class="motm-name">${best.name}</div>
            <div class="motm-meta">${crestHtml(team, 'xs')} ${team.name} · ${best.position}${facts.length ? ' · ' + facts.join(', ') : ''}</div>
        </div>
        <div class="motm-rating ${ratingClass(best.rating)}">${best.rating.toFixed(1)}</div>`;
    box.style.display = 'flex';
    addMatchEvent(m, '', 'comment', `⭐ Лучший игрок ${sim.combined ? 'двух матчей' : 'матча'} — ${best.name} (${best.rating.toFixed(1)})`, team, 'c-goal');
}

function plural(n, one, few, many) {
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
}

// Форма игрока в составе на матч: только заметные подъёмы и спады (чтобы не шуметь)
function lineupForm(p) {
    const fi = formInfo(p);
    if (!['f-hot', 'f-up', 'f-down', 'f-cold'].includes(fi.cls)) return '';
    const mi = moraleInfo(p.morale ?? MORALE_DEFAULT);
    return `<span class="lp-form ${fi.cls}" title="${fi.label} (средняя оценка ${fi.value.toFixed(1)}) · мораль: ${mi.label.toLowerCase()}">${fi.arrow}</span>`;
}

// Серия команды словами: «3 победы подряд», «без побед в 4 матчах»
function teamStreak(team) {
    const form = (team.stats && team.stats.form) || [];
    if (form.length < 3) return null;
    const res = form.map(f => f[0]).reverse();
    const count = pred => { let n = 0; for (const r of res) { if (!pred(r)) break; n++; } return n; };
    const wins = count(r => r === 'W'), losses = count(r => r === 'L'), noWin = count(r => r !== 'W'), unbeaten = count(r => r !== 'L');
    if (wins >= 3) return { good: true, text: `${wins} ${plural(wins, 'победа', 'победы', 'побед')} подряд` };
    if (losses >= 3) return { good: false, text: `${losses} ${plural(losses, 'поражение', 'поражения', 'поражений')} подряд` };
    if (noWin >= 4) return { good: false, text: `без побед в ${noWin} матчах` };
    if (unbeaten >= 5) return { good: true, text: `без поражений в ${unbeaten} матчах` };
    return null;
}

// ----- Пара из двух матчей: общие итоги -----
// После 2-й игры статистика, xG, карта ударов, оценки и лучший игрок — за обе игры, а не только за последнюю.
function combinedView(sims) {
    sims = (sims || []).filter(Boolean);
    if (sims.length < 2) return sims[0] || null;
    const last = sims[sims.length - 1];
    const m = last.match;
    const sum = key => ({ team1: sims.reduce((a, s) => a + s.stats[key].team1, 0), team2: sims.reduce((a, s) => a + s.stats[key].team2, 0) });
    const pos1 = Math.round(sims.reduce((a, s) => a + s.stats.possession.team1, 0) / sims.length);
    const stats = {
        possession: { team1: pos1, team2: 100 - pos1 },
        shots: sum('shots'), shotsOnTarget: sum('shotsOnTarget'), corners: sum('corners'), fouls: sum('fouls'),
        yellowCards: sum('yellowCards'), redCards: sum('redCards'), xg: sum('xg'),
        substitutions: { team1: sims.flatMap(s => s.stats.substitutions.team1), team2: sims.flatMap(s => s.stats.substitutions.team2) }
    };
    // Оценка за пару — средняя по сыгранным играм
    const ratings = () => {
        const acc = new Map();
        sims.forEach(s => s.playerRatings().forEach(r => {
            const k = `${r.side}:${r.number}`;
            const a = acc.get(k) || { ...r, total: 0, n: 0 };
            a.total += r.rating; a.n++;
            acc.set(k, a);
        }));
        return [...acc.values()].map(a => ({ side: a.side, number: a.number, name: a.name, position: a.position, rating: Math.round(a.total / a.n * 10) / 10, games: a.n }));
    };
    const agg = m.aggregateScore;
    return {
        combined: true, legs: sims.length, match: m, sides: last.sides, leg: last.leg, homeSide: last.homeSide,
        minute: sims.reduce((a, s) => a + s.minute, 0),
        score: { t1: agg.t1, t2: agg.t2 },
        events: sims.flatMap(s => s.events.map(e => ({ ...e, leg: s.leg }))),
        shotLog: sims.flatMap(s => s.shotLog.map(x => ({ ...x, leg: s.leg }))),
        touches: mergeTouches(sims), passes: mergePasses(sims),
        stats,
        playerRatings: ratings,
        manOfTheMatch() {
            const winner = agg.t1 > agg.t2 ? 'team1' : (agg.t2 > agg.t1 ? 'team2' : (m.winner ? (m.winner === m.team1 ? 'team1' : 'team2') : null));
            return ratings().sort((a, b) => b.rating - a.rating || b.games - a.games || (b.side === winner) - (a.side === winner))[0] || null;
        }
    };
}

// ===== СЕТЬ ПЕРЕДАЧ И ТЕПЛОВАЯ КАРТА =====
// Данные пишет движок (touches, passes); поле развёрнуто так, что выбранная команда атакует вправо.
const passView = { mode: 'net', side: 'team1', player: '', sim: null };

function mergeTouches(sims) {
    const out = { team1: {}, team2: {} };
    sims.forEach(s => ['team1', 'team2'].forEach(side => Object.entries((s.touches || {})[side] || {}).forEach(([n, pts]) => {
        out[side][n] = (out[side][n] || []).concat(pts);
    })));
    return out;
}

function mergePasses(sims) {
    const out = { team1: {}, team2: {} };
    sims.forEach(s => ['team1', 'team2'].forEach(side => Object.entries((s.passes || {})[side] || {}).forEach(([k, c]) => {
        out[side][k] = (out[side][k] || 0) + c;
    })));
    return out;
}

function sidePlayers(sim, side) {
    const s = sim.sides[side];
    return [...s.onPitch, ...(s.subbedOff || []), ...(s.sentOff || [])];
}

function renderPassMap(sim) {
    const box = $('passmap-box');
    if (!box || !sim || !sim.touches) { if (box) box.style.display = 'none'; return; }
    passView.sim = sim;
    box.style.display = '';
    const side = passView.side;
    $('pm-team1').textContent = sim.sides.team1.team.name;
    $('pm-team2').textContent = sim.sides.team2.team.name;
    document.querySelectorAll('.pm-team').forEach(b => b.classList.toggle('active', b.dataset.side === side));
    document.querySelectorAll('.pm-tab').forEach(b => b.classList.toggle('active', b.dataset.pm === passView.mode));
    const players = sidePlayers(sim, side);
    const nameOf = num => (players.find(p => p.number === Number(num)) || {}).name || `#${num}`;
    const touches = sim.touches[side] || {};
    const sel = $('pm-player');
    sel.style.display = passView.mode === 'heat' ? '' : 'none';
    const withTouches = Object.keys(touches).filter(n => touches[n].length).sort((a, b) => touches[b].length - touches[a].length);
    sel.innerHTML = `<option value="">Вся команда</option>` + withTouches.map(n => `<option value="${n}" ${String(n) === passView.player ? 'selected' : ''}>${nameOf(n)} — ${touches[n].length} касаний</option>`).join('');
    const scale = ([x, y]) => [x * 1.05, y * 0.68];
    const cls = side === 'team1' ? 'pm-t1' : 'pm-t2';
    let body = '';

    if (passView.mode === 'net') {
        // Средняя позиция игрока и линии частых передач
        const avg = {};
        Object.entries(touches).forEach(([n, pts]) => {
            if (pts.length < 2) return;
            const sx = pts.reduce((a, p) => a + p[0], 0) / pts.length, sy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
            avg[n] = { xy: scale([sx, sy]), count: pts.length };
        });
        const pairs = {};
        Object.entries(sim.passes[side] || {}).forEach(([k, c]) => {
            const [a, b] = k.split('>');
            const key = [a, b].sort().join('-');
            pairs[key] = (pairs[key] || 0) + c;
        });
        const max = Math.max(1, ...Object.values(pairs));
        Object.entries(pairs).forEach(([k, c]) => {
            const [a, b] = k.split('-');
            if (!avg[a] || !avg[b] || c < 2) return;
            body += `<line class="pm-link ${cls}" x1="${avg[a].xy[0].toFixed(1)}" y1="${avg[a].xy[1].toFixed(1)}" x2="${avg[b].xy[0].toFixed(1)}" y2="${avg[b].xy[1].toFixed(1)}" stroke-width="${(0.3 + 1.6 * c / max).toFixed(2)}" opacity="${(0.25 + 0.6 * c / max).toFixed(2)}"><title>${nameOf(a)} ↔ ${nameOf(b)}: ${c}</title></line>`;
        });
        Object.entries(avg).forEach(([n, a]) => {
            const r = Math.min(4.2, 1.6 + Math.sqrt(a.count) * 0.32);
            body += `<g class="pm-node ${cls}"><circle cx="${a.xy[0].toFixed(1)}" cy="${a.xy[1].toFixed(1)}" r="${r.toFixed(1)}"><title>${nameOf(n)}: ${a.count} касаний</title></circle>
                <text x="${a.xy[0].toFixed(1)}" y="${(a.xy[1] + 0.9).toFixed(1)}">${n}</text>
                <text class="pm-name" x="${a.xy[0].toFixed(1)}" y="${(a.xy[1] + r + 2.6).toFixed(1)}">${shortName(nameOf(n))}</text></g>`;
        });
        const total = Object.values(sim.passes[side] || {}).reduce((a, c) => a + c, 0);
        setText('pm-note', `Кружок — средняя позиция игрока (размер — касания), линия — передачи между ними. Всего передач в розыгрышах: ${total}.`);
    } else {
        // Тепловая карта: сетка 21×14 с мягким размытием
        const W = 21, H = 14, grid = Array.from({ length: H }, () => new Array(W).fill(0));
        const pts = passView.player ? (touches[passView.player] || []) : Object.values(touches).flat();
        pts.forEach(([x, y]) => {
            const cx = Math.min(W - 1, Math.floor(x / 100 * W)), cy = Math.min(H - 1, Math.floor(y / 100 * H));
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const gx = cx + dx, gy = cy + dy;
                if (gx >= 0 && gx < W && gy >= 0 && gy < H) grid[gy][gx] += dx || dy ? 0.35 : 1;
            }
        });
        const max = Math.max(0.01, ...grid.flat());
        grid.forEach((row, gy) => row.forEach((v, gx) => {
            if (!v) return;
            const k = v / max;
            const color = k > 0.66 ? '255, 70, 40' : (k > 0.33 ? '255, 170, 40' : '255, 235, 90');
            body += `<rect x="${(gx * 105 / W).toFixed(2)}" y="${(gy * 68 / H).toFixed(2)}" width="${(105 / W + 0.05).toFixed(2)}" height="${(68 / H + 0.05).toFixed(2)}" fill="rgba(${color}, ${(0.15 + k * 0.6).toFixed(2)})"/>`;
        }));
        setText('pm-note', `${passView.player ? nameOf(passView.player) : 'Вся команда'}: где чаще всего был мяч (${pts.length} касаний). Команда атакует вправо →`);
    }
    $('pass-map').innerHTML = SHOTMAP_PITCH + body + `<text class="pm-arrow" x="98" y="66">→</text>`;
}

function initPassMap() {
    document.querySelectorAll('.pm-tab').forEach(b => b.onclick = () => { passView.mode = b.dataset.pm; renderPassMap(passView.sim); });
    document.querySelectorAll('.pm-team').forEach(b => b.onclick = () => { passView.side = b.dataset.side; passView.player = ''; renderPassMap(passView.sim); });
    $('pm-player').onchange = e => { passView.player = e.target.value; renderPassMap(passView.sim); };
}

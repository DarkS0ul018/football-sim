// ===== ПОЛЕ: живое движение игроков, пасы, удары, повтор гола =====
// Каждый игрок играет свою роль (из схемы): команда с мячом поднимается и растягивается,
// обороняющаяся — стоит компактным блоком, сдвинутым к мячу, ближайшие прессингуют.
// Позиции обновляются покадрово (requestAnimationFrame) с ограничением скорости — игроки бегут, а не скользят.
// Счёт и события решает движок (engine.js); здесь — только как это выглядит.

const pitch = {
    ball: { x: 50, y: 50 },   // где мяч сейчас (на экране)
    focus: { x: 50, y: 50 },  // куда летит мяч — к этой точке подстраиваются игроки
    holder: null,             // у кого мяч
    possession: 'team1',      // какая команда атакует
    path: [],                 // очередь движения мяча: { x, y, dur, t, onArrive }
    sim: null,
    msPerMinute: 600,
    kickoff: true,            // расстановка на розыгрыш с центра
    frozen: false,            // во время повтора кадры не пишутся
    raf: null,
    lastTs: 0,
    timers: [],
    recording: [],
    lastGoal: null
};

function pitchLater(fn, ms) {
    pitch.timers.push(setTimeout(fn, ms));
}

function clearPitchTimers() {
    pitch.timers.forEach(clearTimeout);
    pitch.timers = [];
}

function playerElId(p) {
    return `player-${p.teamId}-${p.number}`;
}

// ----- Отрисовка -----
function renderPlayers(sim) {
    pitch.sim = sim; // покадровый цикл двигает игроков именно этой игры
    const field = $('football-field');
    field.querySelectorAll('.player').forEach(el => el.remove());
    ['team1', 'team2'].forEach(side => {
        sim.sides[side].onPitch.forEach((p, i) => {
            const el = document.createElement('div');
            el.className = `player ${side} ${p.position === 'GK' ? 'goalkeeper' : ''}`;
            el.style.cssText = `left:${p.x}%;top:${p.y}%;z-index:${10 + i};transition:none`;
            el.innerHTML = `<span class="player-num">${p.number}</span><span class="player-name">${p.name.split(' ').slice(-1)[0]}</span>`;
            el.id = playerElId(p);
            el.title = `${p.name} · ${p.position} · ${p.rating}`;
            field.appendChild(el);
            p.el = el;
        });
    });
}

function renderField(sim) {
    const field = $('football-field');
    clearPitchTimers();
    field.querySelector('.ball')?.remove();
    hideGoalTicker();
    pitch.lastGoal = null;
    $('btn-replay-goal') && ($('btn-replay-goal').style.display = 'none');
    applyMatchKits(sim.match);
    renderPlayers(sim);
    const ball = document.createElement('div');
    ball.className = 'ball';
    ball.id = 'match-ball';
    ball.style.transition = 'none';
    field.appendChild(ball);
    pitch.sim = sim;
    pitch.path = [];
    pitch.holder = null;
    pitch.kickoff = true;
    placeBall(50, 50, 0);
    pitch.focus = { x: 50, y: 50 };
    setText('team1-name', sim.match.team1.name);
    setText('team2-name', sim.match.team2.name);
    startPitchLoop();
}

function setTransition(el, ms) {
    el.style.transition = ms > 0 ? `left ${ms}ms ease-in-out, top ${ms}ms ease-in-out` : 'none';
}

// Мгновенно (или CSS-переходом — только для повтора) ставит мяч в точку
function placeBall(x, y, ms = 0) {
    const ball = $('match-ball');
    pitch.ball = { x, y };
    if (!ball) return;
    setTransition(ball, ms);
    ball.style.left = `${x}%`;
    ball.style.top = `${y}%`;
}

function highlightPlayer(player) {
    document.querySelectorAll('.player.has-ball').forEach(el => el.classList.remove('has-ball'));
    if (player) $(playerElId(player))?.classList.add('has-ball');
}

// ----- Роли -----
// Координаты «от своих ворот»: 0 — свои ворота, 100 — чужие
const rel = (side, x) => side === 'team1' ? x : 100 - x;
const abs = rel; // преобразование симметрично

function roleOf(p, side) {
    const bx = rel(side, p.baseX), by = p.baseY;
    if (p.position === 'GK') return 'GK';
    const wide = by < 27 || by > 73;
    if (p.position === 'DEF') return wide ? 'FB' : 'CB';
    if (p.position === 'FWD') return (by < 35 || by > 65) ? 'W' : 'ST';
    if (by < 24 || by > 76) return 'WM';
    if (bx <= 33) return 'DM';
    if (bx >= 45) return 'AM';
    return 'CM';
}

// push — насколько роль подключается к атаке; max — как далеко может зайти; wa/wd — ширина в атаке/обороне
const ROLE = {
    CB: { push: 0,  max: 56, wa: 1.05, wd: 0.75 },
    FB: { push: 16, max: 84, wa: 1.25, wd: 0.82 },
    DM: { push: 4,  max: 62, wa: 1.0,  wd: 0.7 },
    CM: { push: 9,  max: 78, wa: 1.05, wd: 0.7 },
    AM: { push: 11, max: 86, wa: 1.05, wd: 0.7 },
    WM: { push: 13, max: 86, wa: 1.2,  wd: 0.8 },
    W:  { push: 13, max: 92, wa: 1.18, wd: 0.85 },
    ST: { push: 14, max: 93, wa: 1.0,  wd: 0.8 }
};

const LINE_HEIGHT = { high: 30, mid: 22, low: 14 }; // где стоит линия защиты в обороне (от своих ворот)

function clampv(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Линия обороны команды side (в её координатах)
function defensiveLine(side) {
    const s = pitch.sim.sides[side];
    const base = LINE_HEIGHT[s.line] ?? 22;
    const ballRel = rel(side, pitch.focus.x);
    return clampv(base + (ballRel - 50) * 0.35, 7, base + 14);
}

// Целевые точки всех игроков на текущий кадр
function computeTargets() {
    const sim = pitch.sim;
    if (!sim) return;
    const f = pitch.focus;
    ['team1', 'team2'].forEach(side => {
        const s = sim.sides[side];
        const attacking = pitch.possession === side;
        const ballRel = rel(side, f.x);
        const oppSide = otherSide(side);

        if (pitch.kickoff) {
            // Своя половина: расстановку сжимаем пропорционально, а не «прижимаем» к центру —
            // иначе атакующий полузащитник и нападающий по центру вставали в одну точку (виден был 10-й)
            const maxRel = Math.max(47, ...s.onPitch.map(p => rel(side, p.baseX)));
            const k = 46 / maxRel;
            s.onPitch.forEach(p => {
                p.tx = abs(side, Math.max(3, rel(side, p.baseX) * k));
                p.ty = p.baseY;
            });
            return;
        }

        if (attacking) {
            const shift = clampv((ballRel - 40) * 0.55, -10, 30);
            const oppLine = 100 - defensiveLine(oppSide); // линия защиты соперника в наших координатах
            s.onPitch.forEach(p => {
                const role = roleOf(p, side); // роль заново: схема могла смениться
                const bx = rel(side, p.baseX);
                if (role === 'GK') {
                    p.tx = abs(side, 5 + (s.line === 'high' ? 7 : 3) + (ballRel > 60 ? 4 : 0));
                    p.ty = 50 + (f.y - 50) * 0.15;
                    return;
                }
                const r = ROLE[role];
                let x = bx + shift + r.push * (ballRel > 55 ? 0.9 : 0.4);
                if (role === 'ST' || role === 'W') x = Math.max(x, Math.min(oppLine + 1, 93)); // бег на линию последнего защитника
                x = Math.min(x, r.max, role === 'ST' ? 95 : ballRel + 28);
                if (ballRel < oppLine) x = Math.min(x, oppLine + 1); // не уходить в офсайд, пока мяч перед линией обороны
                let y = 50 + (p.baseY - 50) * r.wa + (f.y - 50) * 0.22;
                p.tx = abs(side, clampv(x + (p.jx || 0), 3, 96));
                p.ty = clampv(y + (p.jy || 0), 4, 96);
            });
        } else {
            const line = defensiveLine(side);
            s.onPitch.forEach(p => {
                const role = roleOf(p, side); // роль заново: схема могла смениться
                const bx = rel(side, p.baseX);
                if (role === 'GK') {
                    p.tx = abs(side, 4 + (s.line === 'high' && ballRel > 50 ? 4 : 0));
                    p.ty = clampv(50 + (f.y - 50) * 0.35, 40, 60);
                    return;
                }
                const r = ROLE[role];
                const x = line + (bx - 19) * 0.62;
                const y = 50 + (p.baseY - 50) * r.wd + (f.y - 50) * 0.42;
                p.tx = abs(side, clampv(x + (p.jx || 0) * 0.5, 3, 96));
                p.ty = clampv(y + (p.jy || 0) * 0.5, 4, 96);
            });
            // Прессинг: ближайшие к мячу идут в отбор (при стиле «прессинг» или высокой линии — двое)
            const pressers = (s.style === 'pressing' || s.line === 'high') ? 2 : 1;
            [...s.onPitch].filter(p => p.position !== 'GK')
                .sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))
                .slice(0, pressers)
                .forEach((p, i) => {
                    const back = side === 'team1' ? -2.5 : 2.5;     // встаёт между мячом и своими воротами
                    p.tx = clampv(f.x + back * (i + 1), 2, 98);
                    p.ty = clampv(f.y + (i ? 5 : 0) * (p.y > f.y ? 1 : -1), 3, 97);
                });
        }
    });
    // Персональные задания на эту минуту (из розыгрыша): бьющий бежит в зону удара,
    // подающий — к флажку, нарушитель — к сопернику, которого сфолит
    if (pitch.overrides && !pitch.kickoff) {
        pitch.overrides.forEach((t, p) => { if (!t) return; const q = t.follow || t; p.tx = q.x; p.ty = q.y; });
    }
    // Игрок с мячом — у мяча
    if (pitch.holder && !pitch.kickoff) {
        pitch.holder.tx = f.x;
        pitch.holder.ty = f.y;
    }
}

// Небольшой разброс, чтобы строй не был «под линейку» (меняется при смене владения)
function reshuffleJitter() {
    const sim = pitch.sim;
    if (!sim) return;
    ['team1', 'team2'].forEach(side => sim.sides[side].onPitch.forEach(p => {
        p.jx = (Math.random() - 0.5) * 5;
        p.jy = (Math.random() - 0.5) * 6;
    }));
}

// ----- Покадровый цикл -----
function startPitchLoop() {
    if (!pitch.raf) {
        pitch.lastTs = 0;
        pitch.raf = requestAnimationFrame(pitchFrame);
    }
}

function stopPitchLoop() {
    if (pitch.raf) cancelAnimationFrame(pitch.raf);
    pitch.raf = null;
}

function pitchFrame(ts) {
    const dt = pitch.lastTs ? Math.min(0.05, (ts - pitch.lastTs) / 1000) : 0;
    pitch.lastTs = ts;
    if (!pitch.frozen && pitch.sim && document.getElementById('football-field')?.offsetParent !== null) {
        stepBall(dt * 1000);
        computeTargets();
        stepPlayers(dt);
    }
    pitch.raf = requestAnimationFrame(pitchFrame);
}

// Скорость: чем быстрее идёт матч, тем быстрее бегут игроки
function speedScale() {
    return 1000 / Math.max(80, pitch.msPerMinute);
}

function stepPlayers(dt) {
    const sim = pitch.sim;
    const vmax = 16 * speedScale();
    ['team1', 'team2'].forEach(side => sim.sides[side].onPitch.forEach(p => {
        if (p.tx === undefined) return;
        const dx = p.tx - p.x, dy = (p.ty - p.y) * 0.66; // поле вытянуто: по вертикали те же % короче
        const dist = Math.hypot(dx, dy);
        if (dist > 0.05) {
            const fit = 0.75 + 0.25 * ((p.fitness ?? 100) / 100);
            const ov = pitch.overrides && pitch.overrides.get(p);
            const sprint = ov ? (ov.follow ? 2.3 : 2.1) : 1; // рывок: бег в зону удара, погоня за соперником
            const v = Math.min(vmax * fit * sprint * (p.position === 'GK' ? 0.7 : 1), dist * 4); // плавное торможение у цели
            const k = Math.min(1, (v * dt) / dist);
            p.x += dx * k;
            p.y += (p.ty - p.y) * k;
        }
        const el = p.el && p.el.isConnected ? p.el : (p.el = $(playerElId(p)));
        if (el) { el.style.left = `${p.x}%`; el.style.top = `${p.y}%`; }
    }));
}

function stepBall(dtMs) {
    const seg = pitch.path[0];
    if (!seg) return;
    if (seg.t === undefined) { seg.t = 0; seg.fromX = pitch.ball.x; seg.fromY = pitch.ball.y; seg.onStart && seg.onStart(); }
    seg.t += dtMs;
    const k = Math.min(1, seg.t / Math.max(1, seg.dur));
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // мяч разгоняется и замедляется
    // Пас адресату: мяч доворачивает к принимающему, где бы тот ни оказался
    if (seg.follow && seg.follow.x !== undefined) { seg.x = seg.follow.x; seg.y = seg.follow.y; }
    placeBall(seg.fromX + (seg.x - seg.fromX) * e, seg.fromY + (seg.y - seg.fromY) * e);
    if (k >= 1) {
        pitch.path.shift();
        seg.onArrive && seg.onArrive();
        if (pitch.path[0]) pitch.focus = { x: pitch.path[0].x, y: pitch.path[0].y };
    }
}

// ----- Розыгрыш минуты -----
// Кадр для повтора гола: где мяч и все игроки
function recordFrame(holder) {
    const sim = pitch.sim;
    pitch.recording.push({
        ball: { ...pitch.ball },
        holder: holder ? { teamId: holder.teamId, number: holder.number } : null,
        players: ['team1', 'team2'].flatMap(s => sim.sides[s].onPitch.map(p => clipPlayer(p, p.x, p.y)))
    });
}

// Розыгрыш минуты строится по описанию из движка (sim.play): те же игроки, что в ленте событий
// Мгновенно доигрывает недошедший до конца розыгрыш: мяч в последнюю точку, все события срабатывают
// (иначе гол, начатый в прошлой минуте, мог потеряться — без повтора, сетки и титра)
function flushPendingPath() {
    const pending = pitch.path;
    if (!pending.length) return;
    pitch.path = [];
    pending.forEach(seg => {
        const x = seg.follow && seg.follow.x !== undefined ? seg.follow.x : seg.x;
        const y = seg.follow && seg.follow.y !== undefined ? seg.follow.y : seg.y;
        placeBall(x, y);
        if (seg.onArrive) seg.onArrive();
    });
}

// span — сколько игровых минут длится показ (атака с ударом — 2)
function animateMinute(sim, events, ms, span = 1) {
    flushPendingPath(); // прошлый розыгрыш не успел закончиться — доигрываем его мгновенно (гол не потеряется)
    pitch.pathToken = (pitch.pathToken || 0) + 1; // номер розыгрыша: отложенный «мяч в центр» не должен стереть новую атаку
    clearPitchTimers();
    pitch.sim = sim;
    pitch.msPerMinute = ms;
    const fast = ms < 250;
    const play = sim.play || { side: sim.attackingSide, kind: 'keep', chain: [], end: null };
    const side = play.side, opp = otherSide(side);
    const team = sim.sides[side].onPitch, foes = sim.sides[opp].onPitch;
    const byNum = (list, n) => (n === undefined || n === null) ? null : list.find(p => p.number === n) || null;
    const end = play.end;
    const goalEv = events.find(e => e.type === 'goal' && e.side === side);

    // Розыгрыш с центра после гола
    if (pitch.kickoff) {
        pitch.kickoff = false;
        pitch.path = [];
        placeBall(50, 50);
        pitch.holder = null;
    }
    if (pitch.possession !== side) reshuffleJitter();
    pitch.possession = side;
    pitch.overrides = new Map();
    if (!team.length) return;

    let chain = play.chain.map(n => byNum(team, n)).filter(Boolean);
    const shooter = end ? byNum(team, end.shooter ?? end.taker) : null;
    if (shooter && chain[chain.length - 1] === shooter) chain = chain.slice(0, -1);
    if (fast) chain = chain.slice(-2);

    const goalX = side === 'team1' ? 99 : 1;
    const spot = (r, y) => ({ x: abs(side, r), y });
    const wps = [];
    const lead = p => ({ x: (p.tx ?? p.x) * 0.6 + p.x * 0.4, y: (p.ty ?? p.y) * 0.6 + p.y * 0.4 }); // пас на ход

    // Бьющий заранее бежит в зону удара; если не успевает — бьёт издали, откуда добежал
    if (shooter && !String(end.type).startsWith('penalty')) {
        const depth = { FWD: [83, 8], MID: [80, 9], DEF: [80, 8] }[shooter.position] || [81, 8]; // из штрафной
        const want = end.at ? { r: end.at.r, y: end.at.y }           // точка удара из движка (по ней считается xG)
            : play.kind === 'corner'
            ? { r: 87 + Math.random() * 4, y: 42 + Math.random() * 16 }
            : { r: depth[0] + Math.random() * depth[1], y: clampv(shooter.y, 28, 72) };
        // Бежит прямо в зону удара; пас найдёт его там, куда он успеет (см. follow в stepBall)
        pitch.overrides.set(shooter, spot(want.r, want.y));
        // На угловой игрок уже стоит в штрафной (стандарт — как монтажная склейка)
        if (play.kind === 'corner' || (play.kind === 'freekick' && play.fk && !play.fk.direct)) { shooter.x = abs(side, want.r - 3); shooter.y = want.y; }
    }

    if (play.kind === 'freekick' && play.fk) {
        // Штрафной: мяч на точке нарушения, стенка, игроки в штрафной (как монтажная склейка)
        const fk = play.fk;
        const taker = byNum(team, fk.taker);
        stageFreeKick(side, team, foes, fk);
        const ballSpot = spot(fk.r, fk.y);
        placeBall(ballSpot.x, ballSpot.y, 0);
        showPitchBanner(fk.direct ? 'ШТРАФНОЙ · УДАР' : 'ШТРАФНОЙ · ПОДАЧА');
        wps.push({ ...ballSpot, player: taker, corner: true });
        if (!fk.direct && shooter && pitch.overrides.get(shooter)) wps.push({ ...pitch.overrides.get(shooter), player: shooter });
        if (end && end.type === 'cleared') { wps.push(spot(89, 35 + Math.random() * 30)); wps.push(spot(62, 20 + Math.random() * 60)); }
        if (end && end.type === 'wall' && pitch.fkWall) wps.push(spot(pitch.fkWall.r, pitch.fkWall.y), spot(pitch.fkWall.r - 12, fk.y + (Math.random() - 0.5) * 30));
    } else if (play.kind === 'corner') {
        const taker = chain[chain.length - 1];
        const pre = chain.slice(0, -1);
        pre.forEach(p => wps.push({ ...lead(p), player: p }));
        const flag = spot(98.5, Math.random() < 0.5 ? 2.5 : 97.5);
        if (taker) { pitch.overrides.set(taker, flag); taker.x = flag.x; taker.y = flag.y; } // стандарт: сразу у флажка (как монтажная склейка)
        wps.push({ ...flag, player: taker, corner: true });
        if (shooter) wps.push({ ...pitch.overrides.get(shooter), player: shooter });
    } else {
        if (play.kind === 'counter' && chain.length > 2) {
            // Контратака: длинный пас из глубины сразу на того, кто отдаст последний пас
            chain = [chain[0], chain[chain.length - 1]];
        }
        chain.forEach(p => wps.push({ ...lead(p), player: p }));
        if (shooter && !String(end.type).startsWith('penalty')) wps.push({ ...pitch.overrides.get(shooter), player: shooter });
    }

    // Фол: нарушитель бежит к фолимому, мяч останавливается
    if (end && (end.type === 'foul' || String(end.type).startsWith('penalty'))) {
        const victim = byNum(team, end.victim) || chain[chain.length - 1];
        const offender = byNum(foes, end.offender);
        if (victim && offender) pitch.overrides.set(offender, { follow: victim }); // догоняет фолимого
        if (victim && !wps.some(w => w.player === victim)) wps.push({ ...lead(victim), player: victim });
        if (wps.length) wps[wps.length - 1].foul = true;
    }

    // Финал эпизода
    if (end) {
        if (String(end.type).startsWith('penalty')) {
            const taker = byNum(team, end.taker);
            const ps = spot(89.5, 50);
            wps.length = 0; // эпизод фола уже позади — сразу постановка пенальти
            stagePenalty(side, team, foes, taker);
            showPitchBanner('ПЕНАЛЬТИ');
            // Мяч — сразу на точку; в живом матче сам удар показывается крупно (как в серии пенальти)
            placeBall(ps.x, ps.y, 0);
            wps.push({ ...ps, player: taker, penaltySpot: true });
            if (!pitch.livePenalty) {
                if (end.type === 'penalty-goal') wps.push({ x: goalX, y: 44 + Math.random() * 12, goal: true });
                else wps.push({ x: goalX, y: Math.random() < 0.5 ? 38 : 62, miss: true });
            }
        } else if (end.type === 'goal') {
            wps.push({ x: goalX, y: 44 + Math.random() * 12, goal: true });
        } else if (end.type === 'save') {
            const gk = byNum(foes, end.keeper) || foes.find(p => p.position === 'GK');
            wps.push({ x: gk ? gk.x : goalX, y: gk ? gk.y : 50, player: gk, save: true });
        } else if (end.type === 'off') {
            wps.push({ x: goalX, y: Math.random() < 0.5 ? 30 + Math.random() * 8 : 62 + Math.random() * 8, miss: true });
        }
    }
    if (!wps.length) return;

    // Длительность отрезков пропорциональна длине передачи (в сумме — почти вся минута)
    const budget = ms * span * 0.85; // атака с ударом идёт дольше (span = 2): бьющий успевает в штрафную
    let from = { ...pitch.ball };
    const lens = wps.map(w => { const d = Math.hypot(w.x - from.x, (w.y - from.y) * 0.66) + 4; from = w; return d; });
    const total = lens.reduce((a, b) => a + b, 0);

    pitch.recording = [];
    recordFrame(pitch.holder);
    pitch.path = wps.map((w, i) => ({
        x: w.x, y: w.y,
        follow: w.player && team.includes(w.player) && !w.corner && !w.penaltySpot ? w.player : null,
        dur: Math.max(60, budget * lens[i] / total),
        onStart: () => { if (!fast && i > 0) playSound('kick'); },
        onArrive: () => {
            if (w.save) {
                pitch.holder = w.player || null;               // мяч у вратаря соперника — дальше атакует он
                pitch.possession = opp;
                highlightPlayer(null);
                playSound('save');
            } else if (w.miss) {
                pitch.holder = null;
                highlightPlayer(null);
                // Удар от ворот: мяч у вратаря соперника
                const gk = foes.find(p => p.position === 'GK');
                pitchLater(() => {
                    if (!gk || pitch.kickoff) return;
                    placeBall(abs(opp, 7), 50);
                    pitch.holder = gk;
                    pitch.possession = opp;
                    pitch.focus = { x: abs(opp, 7), y: 50 };
                }, Math.min(400, ms * 0.1));
            } else if (w.player && team.includes(w.player)) {
                pitch.holder = w.player;
                highlightPlayer(w.player);
            } else {
                pitch.holder = null;
                highlightPlayer(null);
            }
            recordFrame(pitch.holder);
            if (w.goal) {
                const ev = goalEv || events.find(e => e.type === 'goal');
                if (ev) {
                    pitch.lastGoal = { ev, frames: pitch.recording.slice() };
                    recordHighlight(sim, ev, pitch.lastGoal.frames); // для обзора голов после матча
                    onGoalAnimation(sim, ev);
                }
            }
        }
    }));
    pitch.focus = { x: wps[0].x, y: wps[0].y };
    // Когда мяч влетит в ворота (для показа гола на табло ровно в этот момент)
    // и когда бьющий получает мяч / эпизод заканчивается (для комментатора)
    let acc = 0, goalAt = null, finishAt = null, shotAt = null;
    pitch.path.forEach((seg, i) => {
        const w = wps[i];
        if ((w.goal || w.save || w.miss) && finishAt === null) { shotAt = acc; finishAt = acc + seg.dur; }
        acc += seg.dur;
        if (w.goal && goalAt === null) goalAt = acc;
    });
    return { goalAt, shotAt, finishAt, total: acc };
}

function onGoalAnimation(sim, ev) {
    const field = $('football-field');
    const goalEl = field.querySelector(ev.side === 'team1' ? '.goal-right' : '.goal-left');
    goalEl?.classList.add('net-shake');
    setTimeout(() => goalEl?.classList.remove('net-shake'), 700);
    showGoalBanner(ev);
    const btn = $('btn-replay-goal');
    if (btn) btn.style.display = '';
    // Розыгрыш с центра: команды расходятся по своим половинам
    // (если к этому моменту уже началась следующая атака — не трогаем её: иначе её гол потеряется)
    const token = pitch.pathToken;
    setTimeout(() => {
        if (pitch.pathToken !== token) return;
        pitch.kickoff = true;
        pitch.holder = null;
        pitch.path = [];
        placeBall(50, 50);
        pitch.focus = { x: 50, y: 50 };
        highlightPlayer(null);
    }, Math.min(900, pitch.msPerMinute));
}

// ----- Повтор гола в замедлении -----
// Проигрывает записанные кадры атаки: и мяч, и движение игроков
let replayRunning = false;

function replayLastGoal() {
    const g = pitch.lastGoal;
    if (!g || !g.frames || replayRunning) return;
    replayRunning = true;
    const resume = pauseForReplay();               // ставим живой матч на паузу (match.js)
    pitch.frozen = true;
    const field = $('football-field');

    const badge = document.createElement('div');
    badge.className = 'replay-badge';
    badge.innerHTML = `<span>ПОВТОР</span> ${g.ev.minute}' · ${g.ev.player ? g.ev.player.name : ''}`;
    field.appendChild(badge);
    field.classList.add('replaying');

    const applyFrame = (fr, ms) => {
        fr.players.forEach(p => { const el = $(p.id); if (el) { setTransition(el, ms); el.style.left = `${p.x}%`; el.style.top = `${p.y}%`; } });
        placeBall(fr.ball.x, fr.ball.y, ms);
        highlightPlayer(fr.holder);
    };
    applyFrame(g.frames[0], 0);

    const seg = 900;
    g.frames.slice(1).forEach((fr, i) => {
        setTimeout(() => {
            applyFrame(fr, seg);
            playSound('kick');
        }, 400 + seg * i);
    });
    const end = 400 + seg * (g.frames.length - 1);
    setTimeout(() => {
        const goalEl = field.querySelector(g.ev.side === 'team1' ? '.goal-right' : '.goal-left');
        goalEl?.classList.add('net-shake');
        playSound('goal');
        setTimeout(() => goalEl?.classList.remove('net-shake'), 700);
    }, end);

    setTimeout(() => {
        badge.remove();
        field.classList.remove('replaying');
        field.querySelectorAll('.player').forEach(el => setTransition(el, 0));
        placeBall(pitch.ball.x, pitch.ball.y, 0);
        highlightPlayer(pitch.holder);
        pitch.frozen = false;
        replayRunning = false;
        if (resume) resumeAfterReplay();
    }, end + 1400);
}

// Титр гола под табло (как в трансляции) — поле при этом ничем не закрыто
let goalTickerTimer = null;
function showGoalBanner(ev) {
    const ticker = $('goal-ticker');
    if (!ticker) return;
    const note = ev.text && ev.text.includes('с пенальти') ? ' (пен.)' : '';
    ticker.innerHTML = `
        <span class="gt-label">ГОЛ</span>
        <span class="gt-minute">${ev.minute}'</span>
        ${crestHtml(ev.team, 'sm')}
        <span class="gt-scorer">${ev.player ? ev.player.name : ''}${note}</span>
        ${ev.assister ? `<span class="gt-assist">${assistLabel(ev.setPiece)}: ${ev.assister.name}</span>` : ''}
        <span class="gt-team">${ev.team.name}</span>
        ${pitch.lastGoal && pitch.lastGoal.ev === ev ? '<button type="button" class="gt-replay" onclick="replayLastGoal()">↺ Повтор</button>' : ''}`;
    ticker.classList.remove('show');
    void ticker.offsetWidth; // перезапуск анимации
    ticker.classList.add('show');
    clearTimeout(goalTickerTimer);
    goalTickerTimer = setTimeout(() => ticker.classList.remove('show'), 4500);
}

function hideGoalTicker() {
    clearTimeout(goalTickerTimer);
    $('goal-ticker')?.classList.remove('show');
}

// ===== Стандарты: расстановка как в трансляции =====
function stagePlace(side, p, r, y) {
    const pt = { x: abs(side, clampv(r, 2, 98)), y: clampv(y, 3, 97) };
    p.x = pt.x; p.y = pt.y;
    pitch.overrides.set(p, pt);
}

// Штрафной: стенка в 9,15 м на линии «мяч — ворота», атакующие и опекуны в штрафной, вратарь в воротах
function stageFreeKick(side, team, foes, fk) {
    const bx = fk.r * 1.05, by = fk.y * 0.68;           // метры
    const gx = 105, gy = 34;
    const d = Math.hypot(gx - bx, gy - by) || 1;
    const ux = (gx - bx) / d, uy = (gy - by) / d;
    const cx = bx + ux * 9.15, cy = by + uy * 9.15;
    const n = Math.abs(fk.y - 50) < 15 ? 4 : 3;
    const ballAbs = { x: abs(side, fk.r), y: fk.y };
    const field = foes.filter(p => p.position !== 'GK');
    const wall = [...field].sort((a, b) => Math.hypot(a.x - ballAbs.x, a.y - ballAbs.y) - Math.hypot(b.x - ballAbs.x, b.y - ballAbs.y)).slice(0, n);
    wall.forEach((p, i) => {
        const off = (i - (n - 1) / 2) * 1.8;             // игроки стенки плечом к плечу (с запасом под размер фишек)
        stagePlace(side, p, (cx - uy * off) / 1.05, (cy + ux * off) / 0.68);
    });
    pitch.fkWall = { r: cx / 1.05, y: cy / 0.68 };
    const gk = foes.find(p => p.position === 'GK');
    if (gk) stagePlace(side, gk, 98.4, 50 + (fk.y - 50) * 0.12);
    const taker = team.find(p => p.number === fk.taker);
    const att = team.filter(p => p !== taker && p.position !== 'GK')
        .sort((a, b) => ({ FWD: 0, DEF: 1, MID: 2 }[a.position] - { FWD: 0, DEF: 1, MID: 2 }[b.position])).slice(0, fk.direct ? 3 : 5);
    att.forEach((p, i) => stagePlace(side, p, 87 + (i % 2) * 3, 36 + i * (28 / Math.max(1, att.length - 1))));
    field.filter(p => !wall.includes(p)).slice(0, att.length).forEach((p, i) => stagePlace(side, p, 89.5 + (i % 2) * 2, 37.5 + i * (28 / Math.max(1, att.length - 1))));
    if (taker) stagePlace(side, taker, fk.r - 2.6, fk.y + (fk.y < 50 ? -2 : 2));
}

// Пенальти: мяч на точке, вратарь на линии, остальные за пределами штрафной
function stagePenalty(side, team, foes, taker) {
    const gk = foes.find(p => p.position === 'GK');
    if (gk) stagePlace(side, gk, 99.2, 50);
    if (taker) stagePlace(side, taker, 86.8, 50.5);
    const others = [...team.filter(p => p !== taker && p.position !== 'GK'), ...foes.filter(p => p !== gk && p.position !== 'GK')];
    others.forEach((p, i) => {
        const k = i / Math.max(1, others.length - 1);
        const y = 24 + k * 52;
        stagePlace(side, p, 80.5 - Math.abs(y - 50) * 0.12 + (i % 2) * 1.2, y);
    });
    const ownGk = team.find(p => p.position === 'GK');
    if (ownGk) stagePlace(side, ownGk, 8, 50);
}

// Надпись поверх поля: «ПЕНАЛЬТИ», «ШТРАФНОЙ»…
function showPitchBanner(text) {
    const field = $('football-field');
    if (!field) return;
    field.querySelector('.pitch-banner')?.remove();
    const el = document.createElement('div');
    el.className = 'pitch-banner';
    el.textContent = text;
    field.appendChild(el);
    setTimeout(() => el.remove(), 1800);
}

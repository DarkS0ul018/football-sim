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
    renderFanBand(sim);
    const field = $('football-field');
    field.querySelectorAll('.player').forEach(el => el.remove());
    ['team1', 'team2'].forEach(side => {
        sim.sides[side].onPitch.forEach((p, i) => {
            const el = document.createElement('div');
            el.className = `player ${side} ${p.position === "GK" ? "goalkeeper" : ""} ${sim.sides[side].captain === p.number ? "captain" : ""}`;
            el.style.cssText = `left:${p.x}%;top:${p.y}%;z-index:${10 + i};transition:none;--face:${side === 'team2' ? -1 : 1}`;
            el.innerHTML = playerInnerHtml(p.number, p.name.split(' ').slice(-1)[0]);
            el.id = playerElId(p);
            el.title = `${p.name} · ${p.position} · ${p.rating}`;
            field.appendChild(el);
            p.el = el;
            p._face = undefined; p._run = undefined; // новый элемент — состояние анимации заново
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
    $('btn-replay-behind') && ($('btn-replay-behind').style.display = 'none');
    applyMatchKits(sim.match);
    applyVenue(sim);
    renderPlayers(sim);
    const ball = document.createElement('div');
    ball.className = 'ball';
    ball.id = 'match-ball';
    field.querySelector('.ball-shadow')?.remove();
    const shadow = document.createElement('div');
    shadow.className = 'ball-shadow';
    shadow.id = 'ball-shadow';
    pitch.moments = [];
    const hud = $('field-hud') || field;
    hud.querySelector('.tv-bug')?.remove();
    const bug = document.createElement('div');
    bug.className = 'tv-bug';
    bug.id = 'tv-bug';
    hud.appendChild(bug);
    field.appendChild(shadow);
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
// h — высота полёта в пикселях: мяч поднимается и чуть растёт, тень остаётся на газоне
function placeBall(x, y, ms = 0, h = 0) {
    const ball = $('match-ball');
    pitch.ball = { x, y };
    if (!ball) return;
    setTransition(ball, ms);
    ball.style.left = `${x}%`;
    ball.style.top = `${y}%`;
    ball.style.transform = h > 0.5 ? `translateY(${-h}px) scale(${1 + h / 45})` : '';
    const sh = $('ball-shadow');
    if (sh) {
        setTransition(sh, ms);
        sh.style.left = `${x}%`;
        sh.style.top = `${y}%`;
        sh.style.opacity = h > 0.5 ? String(Math.max(0.35, 1 - h / 40)) : '0';
        sh.style.transform = h > 0.5 ? `scale(${Math.max(0.6, 1 - h / 50)})` : '';
    }
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
                    const sweeper = sim.roleOf && sim.roleOf(p) === 'sweeper';
                    p.tx = abs(side, 5 + (s.line === 'high' ? 7 : 3) + (ballRel > 60 ? 4 : 0) + (sweeper ? 6 : 0));
                    p.ty = 50 + (f.y - 50) * 0.15;
                    return;
                }
                const r = ROLE[role];
                let x = bx + shift + r.push * (ballRel > 55 ? 0.9 : 0.4);
                if (role === 'ST' || role === 'W') x = Math.max(x, Math.min(oppLine + 1, 93)); // бег на линию последнего защитника
                x = Math.min(x, r.max, role === 'ST' ? 95 : ballRel + 28);
                if (ballRel < oppLine) x = Math.min(x, oppLine + 1); // не уходить в офсайд, пока мяч перед линией обороны
                let y = 50 + (p.baseY - 50) * r.wa + (f.y - 50) * 0.22;
                // Роль игрока (роли — в js/core/roles.js): кто подключается, кто держится позади, кто смещается в центр
                const pr = sim.roleOf ? sim.roleOf(p) : null;
                if (pr === 'fb') x = Math.min(x + 8, 88);
                else if (pr === 'destroyer') x -= 8;
                else if (pr === 'box') x = Math.min(x + 5, 88);
                else if (pr === 'false9') x -= 10;
                else if (pr === 'inverted') { y = 50 + (y - 50) * 0.55; x += 2; }
                else if (pr === 'poacher' || pr === 'target') y = 50 + (y - 50) * 0.75;
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
                const pr = sim.roleOf ? sim.roleOf(p) : null;
                const x = line + (bx - 19) * 0.62 + (pr === 'stopper' ? 3 : 0) + (pr === 'destroyer' ? -2 : 0);
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
        stepReferee(dt);
    }
    if (document.getElementById('football-field')?.offsetParent !== null) stepCamera(dt);
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
        // Скорость меняется плавно (разгон, торможение, повороты), а не скачком
        let wantX = 0, wantY = 0;
        if (dist > 0.05) {
            const fit = (0.75 + 0.25 * ((p.fitness ?? 100) / 100)) * (p._pace || (p._pace = 1 + clamp(skillEdge(p, 'pac'), -9, 9) * 0.02));
            const ov = pitch.overrides && pitch.overrides.get(p);
            const sprint = ov ? (ov.follow ? 2.3 : 2.1) : 1; // рывок: бег в зону удара, погоня за соперником
            const v = Math.min(vmax * fit * sprint * (p.position === 'GK' ? 0.7 : 1), dist * 3.2); // плавное торможение у цели
            wantX = dx / dist * v; wantY = dy / dist * v;
        }
        const acc = Math.min(1, dt * 6.5);
        p.vx = (p.vx || 0) + (wantX - (p.vx || 0)) * acc;
        p.vy = (p.vy || 0) + (wantY - (p.vy || 0)) * acc;
        // не проскакиваем цель
        const stepX = p.vx * dt, stepY = p.vy * dt;
        if (Math.hypot(stepX, stepY) >= dist && dist > 0) { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; }
        else { p.x += stepX; p.y += stepY / 0.66; }
        const el = p.el && p.el.isConnected ? p.el : (p.el = $(playerElId(p)));
        if (el) {
            // Позицию пишем, только если игрок заметно сдвинулся (меньше работы браузеру)
            if (Math.abs(p.x - (p._lx ?? -99)) > 0.02 || Math.abs(p.y - (p._ly ?? -99)) > 0.02) {
                p._lx = p.x; p._ly = p.y;
                el.style.left = `${p.x.toFixed(2)}%`; el.style.top = `${p.y.toFixed(2)}%`;
            }
            const speed = Math.hypot(p.vx, p.vy);
            const run = p._run ? speed > 5.5 : speed > 9; // гистерезис: бег не мигает на пороге
            if (run !== p._run) { p._run = run; el.classList.toggle('running', run); }
            // Разворот по направлению бега — только если направление держится ~0.3 с
            // (иначе у цели фигурка дёргалась туда-сюда); стоя долго — лицом к воротам соперника
            const home = p.side === 'team2' ? -1 : 1;
            let want = p._face ?? home;
            if (Math.abs(p.vx) > 6 && Math.abs(p.vx) > Math.abs(p.vy) * 0.8) want = p.vx > 0 ? 1 : -1; // явно бежит вбок
            else if (speed < 1) { p._still = (p._still || 0) + dt; if (p._still > 0.8) want = home; }
            if (speed >= 1) p._still = 0;
            if (want !== p._face) {
                p._turn = (p._turn || 0) + dt;
                if (p._face === undefined || p._turn > 0.45) { p._face = want; p._turn = 0; el.style.setProperty('--face', want); }
            } else p._turn = 0;
        }
    }));
}

function stepBall(dtMs) {
    const seg = pitch.path[0];
    if (!seg) return;
    if (seg.t === undefined) { seg.t = 0; seg.fromX = pitch.ball.x; seg.fromY = pitch.ball.y; seg.onStart && seg.onStart(); }
    seg.t += dtMs;
    const k = Math.min(1, seg.t / Math.max(1, seg.dur));
    // Удар — мяч сразу летит быстро и чуть гаснет; пас — разгоняется и замедляется
    const e = seg.shot ? 1 - Math.pow(1 - k, 2.2) : (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    // Пас адресату: мяч доворачивает к принимающему, где бы тот ни оказался
    if (seg.follow && seg.follow.x !== undefined) { seg.x = seg.follow.x; seg.y = seg.follow.y; }
    // Длинная передача и навес — по дуге (высота по синусу), короткий пас и удар — низом
    if (seg.loft === undefined) {
        const d = Math.hypot(seg.x - seg.fromX, (seg.y - seg.fromY) * 0.66);
        seg.loft = !seg.shot && d > 22 ? Math.min(18, d * 0.32) : 0;
    }
    placeBall(seg.fromX + (seg.x - seg.fromX) * e, seg.fromY + (seg.y - seg.fromY) * e, 0, seg.loft * Math.sin(Math.PI * k));
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

    // Стандарт как в жизни: мяч ставят, игроки бегут на свои места, пауза, свисток — подача
    const setup = (play.kind === 'corner' || play.kind === 'freekick') ? setPieceSetupMs() : 0;
    pitch.setupWalk = setup > 0;
    pitch.setupMs = setup;

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
        if (!setup && (play.kind === "corner" || (play.kind === "freekick" && play.fk && !play.fk.direct))) { shooter.x = abs(side, want.r - 3); shooter.y = want.y; }
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
        if (setup) wps.push({ ...ballSpot, wait: setup, whistle: true }); // стенка выстраивается, свисток судьи
        if (!fk.direct && shooter && pitch.overrides.get(shooter)) wps.push({ ...pitch.overrides.get(shooter), player: shooter });
        if (end && end.type === 'cleared') { wps.push(spot(89, 35 + Math.random() * 30)); wps.push(spot(62, 20 + Math.random() * 60)); }
        if (end && end.type === 'wall' && pitch.fkWall) wps.push(spot(pitch.fkWall.r, pitch.fkWall.y), spot(pitch.fkWall.r - 12, fk.y + (Math.random() - 0.5) * 30));
    } else if (play.kind === 'corner') {
        const taker = chain[chain.length - 1];
        const pre = chain.slice(0, -1);
        pre.forEach(p => wps.push({ ...lead(p), player: p }));
        const flag = spot(98.5, Math.random() < 0.5 ? 2.5 : 97.5);
        if (taker) {
            pitch.overrides.set(taker, flag);
            if (!setup) { taker.x = flag.x; taker.y = flag.y; } // быстрый режим: сразу у флажка (монтажная склейка)
        }
        wps.push({ ...flag, player: taker, corner: true, banner: setup ? 'УГЛОВОЙ' : null });
        if (setup) {
            // Пока подающий идёт к флажку, игроки заходят в штрафную: атакующие — к воротам, защитники — опекать
            const box = team.filter(p => p !== taker && p.position !== 'GK' && p !== shooter)
                .sort((a, b) => ({ DEF: 0, FWD: 1, MID: 2 }[a.position] - { DEF: 0, FWD: 1, MID: 2 }[b.position])).slice(0, 4);
            box.forEach((p, i) => pitch.overrides.set(p, spot(86 + (i % 2) * 3, 38 + i * 8)));
            foes.filter(p => p.position !== 'GK').slice(0, 6).forEach((p, i) => pitch.overrides.set(p, spot(88 + (i % 3) * 2.5, 36 + i * 5.5)));
            const gk = foes.find(p => p.position === 'GK');
            if (gk) pitch.overrides.set(gk, spot(98.5, 50 + (flag.y > 50 ? 3 : -3)));
            wps.push({ ...flag, wait: setup });
            cameraPunch(setup / 1000 + 0.8);
        }
        if (shooter) wps.push({ ...pitch.overrides.get(shooter), player: shooter });
    } else {
        if (play.kind === 'counter' && chain.length > 2) {
            // Контратака: длинный пас из глубины сразу на того, кто отдаст последний пас
            chain = [chain[0], chain[chain.length - 1]];
        }
        chain.forEach(p => wps.push({ ...lead(p), player: p }));
        if (shooter && !String(end.type).startsWith('penalty')) wps.push({ ...pitch.overrides.get(shooter), player: shooter });
        // Аут: иногда пас уходит за боковую — игрок соперника вбрасывает мяч руками у бровки
        if (!end && play.kind === 'keep' && !fast && wps.length && Math.random() < 0.22) {
            const last = wps[wps.length - 1];
            const edge = { x: clampv(last.x + (side === 'team1' ? 6 : -6), 6, 94), y: last.y < 50 ? 0.8 : 99.2 };
            const thrower = [...foes].filter(p => p.position !== 'GK').sort((a, b) => Math.hypot(a.x - edge.x, a.y - edge.y) - Math.hypot(b.x - edge.x, b.y - edge.y))[0];
            wps.push({ ...edge, out: true });
            if (thrower) pitch.overrides.set(thrower, { x: edge.x, y: edge.y < 50 ? 2.5 : 97.5 });
            wps.push({ ...edge, wait: Math.round(clampv(ms * 0.35, 250, 700)), throwIn: true });
        }
    }
    // Офсайд: пас за спину — мяч к нападающему, помощник поднимает флажок
    if (end && end.type === 'offside') {
        const runner = byNum(team, end.player);
        if (runner) wps.push({ x: abs(side, clampv(rel(side, runner.x) + 6, 50, 92)), y: runner.y, offside: true });
    }

    // Фол: нарушитель бежит к фолимому, мяч останавливается
    if (end && (end.type === 'foul' || String(end.type).startsWith('penalty'))) {
        const victim = byNum(team, end.victim) || chain[chain.length - 1];
        const offender = byNum(foes, end.offender);
        if (victim && offender) pitch.overrides.set(offender, { follow: victim }); // догоняет фолимого
        if (victim && !wps.some(w => w.player === victim)) wps.push({ ...lead(victim), player: victim });
        if (wps.length) { const last = wps[wps.length - 1]; last.foul = true; last.victim = victim; last.offender = offender; last.hard = events.some(e => e.type === 'card-yellow' || e.type === 'card-red'); }
    }
    // Атака сорвалась без удара: защитник идёт в подкат и забирает мяч
    if (!end && (play.kind === 'attack' || play.kind === 'counter') && wps.length && !fast) {
        const last = wps[wps.length - 1];
        const tackler = foes.filter(p => p.position !== 'GK').sort((a, b) => Math.hypot(a.x - last.x, a.y - last.y) - Math.hypot(b.x - last.x, b.y - last.y))[0];
        if (tackler) { pitch.overrides.set(tackler, { x: last.x, y: last.y }); wps.push({ x: last.x + (side === 'team1' ? -2 : 2), y: last.y, tackle: tackler }); }
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
            wps.push({ x: gk ? gk.x : goalX, y: gk ? gk.y : 50, player: gk, save: true, diveDir: (end.at ? end.at.y : 50) >= (gk ? gk.y : 50) ? 1 : -1 });
        } else if (end.type === 'post') {
            // Штанга или перекладина: мяч звенит о каркас и отскакивает обратно в поле
            const postY = end.bar ? 46 + Math.random() * 8 : (Math.random() < 0.5 ? 44.4 : 55.6);
            wps.push({ x: side === 'team1' ? 99.2 : 0.8, y: postY, post: true, bar: !!end.bar });
            wps.push({ x: abs(side, 84 + Math.random() * 5), y: clampv(postY + (Math.random() - 0.5) * 30, 25, 75), rebound: true });
        } else if (end.type === 'off') {
            wps.push({ x: goalX, y: Math.random() < 0.5 ? 30 + Math.random() * 8 : 62 + Math.random() * 8, miss: true });
        }
    }
    if (!wps.length) return;

    // Длительность отрезков пропорциональна длине передачи (в сумме — почти вся минута)
    // Паузы стандартов (расстановка) идут сверх движения мяча
    const waits = wps.reduce((a, w) => a + (w.wait || 0), 0);
    const budget = Math.max(ms * span * 0.85 - waits, ms * 0.6); // атака с ударом идёт дольше (span = 2): бьющий успевает в штрафную
    let from = { ...pitch.ball };
    const lens = wps.map(w => { if (w.wait) return 0; const d = Math.hypot(w.x - from.x, (w.y - from.y) * 0.66) + 4; from = w; return d; });
    const total = lens.reduce((a, b) => a + b, 0);

    pitch.recording = [];
    recordFrame(pitch.holder);
    pitch.path = wps.map((w, i) => ({
        x: w.x, y: w.y,
        follow: w.player && team.includes(w.player) && !w.corner && !w.penaltySpot ? w.player : null,
        shot: !!(w.goal || w.save || w.miss),
        dur: w.wait ? w.wait : Math.max(60, budget * lens[i] / total),
        onStart: () => { if (!fast && i > 0 && !w.wait) playSound('kick'); },
        onArrive: () => {
            if (w.banner) showPitchBanner(w.banner);
            if (w.out) { pitch.holder = null; highlightPlayer(null); showBallTag('аут'); return; }
            if (w.post) { pitch.holder = null; highlightPlayer(null); playSound('post'); showBallTag(w.bar ? 'перекладина!' : 'штанга!', 1200); return; }
            if (w.rebound) { pitch.holder = null; highlightPlayer(null); return; }
            if (w.tackle) {
                // Подкат: защитник выбивает мяч, владение переходит к сопернику
                const el = $(playerElId(w.tackle));
                if (el) { el.classList.add('tackling'); setTimeout(() => el.classList.remove('tackling'), 650); }
                pitch.holder = w.tackle; pitch.possession = opp; highlightPlayer(w.tackle);
                return;
            }
            if (w.offside) { pitch.holder = null; highlightPlayer(null); showOffsideFlag(); return; }
            if (w.wait) { if (w.whistle) playSound('whistle-short'); return; } // пауза закончилась — подача
            if (w.foul && w.victim && !fast) {
                // Фол: игрок падает (после жёсткого — катается по газону), соперники идут спорить с судьёй
                const vEl = $(playerElId(w.victim));
                if (vEl) { vEl.classList.add(w.hard ? 'rolling' : 'fallen'); setTimeout(() => vEl.classList.remove('fallen', 'rolling'), w.hard ? 1600 : 1000); }
                if (w.hard && pitch.ref && w.offender) {
                    const mates = foes.filter(p => p !== w.offender && p.position !== 'GK')
                        .sort((a, b) => Math.hypot(a.x - pitch.ref.x, a.y - pitch.ref.y) - Math.hypot(b.x - pitch.ref.x, b.y - pitch.ref.y)).slice(0, 2);
                    mates.forEach((p, i) => pitch.overrides && pitch.overrides.set(p, { x: pitch.ref.x + (i ? 2 : -2), y: pitch.ref.y + 2 }));
                }
            }
            if (w.save) {
                // Вратарь прыгает в сторону мяча
                const gkEl = w.player ? $(playerElId(w.player)) : null;
                if (gkEl && !fast) {
                    gkEl.style.setProperty('--dive', (w.diveDir || 1) > 0 ? '1' : '-1');
                    gkEl.classList.add('diving');
                    setTimeout(() => gkEl.classList.remove('diving'), 750);
                }
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
                    if (!fast) showBallTag('от ворот');
                }, Math.min(400, ms * 0.1));
            } else if (w.player && team.includes(w.player)) {
                pitch.holder = w.player;
                highlightPlayer(w.player);
            } else {
                pitch.holder = null;
                highlightPlayer(null);
            }
            recordFrame(pitch.holder);
            // Опасный момент без гола (сейв, мимо при большом xG) — в ленту с кнопкой повтора
            if ((w.save || w.miss) && end && (end.xg >= 0.25 || String(end.type) === 'penalty-miss')) addMoment(sim, end, side, pitch.recording.slice());
            if (w.goal && end && end.cancelled) { showCancelledGoal(sim, end, side); return; } // офсайд или VAR
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
    showGoalSplash(sim, ev);
    fanCelebrate(ev.side, sim);
    standsPulse();
    cameraPunch(1.8);
    const btn = $('btn-replay-goal');
    if (btn) btn.style.display = '';
    if ($('btn-replay-behind')) $('btn-replay-behind').style.display = '';
    // В живом матче — празднование: автор бежит к угловому флажку, партнёры — к нему
    const cel = pitch.livePenalty ? Math.max(1400, Math.min(2600, (pitch.msPerMinute || 1000) * 2.2)) : 0;
    // После празднования — розыгрыш с центра: мяч в центр, команды расходятся по своим половинам, свисток
    const kick = cel ? kickoffMs() : 0;
    if (cel) {
        startCelebration(sim, ev, cel);
        if (typeof holdForCelebration === 'function') holdForCelebration(cel + kick);
    }
    // (если к этому моменту уже началась следующая атака — не трогаем её: иначе её гол потеряется)
    const token = pitch.pathToken;
    setTimeout(() => {
        if (pitch.pathToken !== token) return;
        pitchKickoff();
        if (kick) setTimeout(() => { if (pitch.pathToken === token && typeof playSound === 'function') playSound('whistle-short'); }, kick - 150);
    }, cel ? cel - 250 : Math.min(900, pitch.msPerMinute));
}

// Сколько длится расстановка на розыгрыш с центра (игроки успевают дойти до своих мест)
function kickoffMs() {
    return Math.round(Math.max(1100, Math.min(2200, (pitch.msPerMinute || 1000) * 1.6)));
}

// Мяч в центр, игроки — по своим половинам (после гола, в начале тайма)
function pitchKickoff(instant = false) {
    pitch.kickoff = true;
    pitch.holder = null;
    pitch.path = [];
    pitch.overrides = new Map();
    placeBall(50, 50);
    pitch.focus = { x: 50, y: 50 };
    highlightPlayer(null);
    if (instant && pitch.sim) {
        computeTargets();
        ['team1', 'team2'].forEach(side => pitch.sim.sides[side].onPitch.forEach(p => {
            if (p.tx === undefined) return;
            p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0;
            const el = p.el && p.el.isConnected ? p.el : $(playerElId(p));
            if (el) { el.style.left = `${p.x}%`; el.style.top = `${p.y}%`; }
            p._lx = p.x; p._ly = p.y;
        }));
    }
}

function startCelebration(sim, ev, ms) {
    if (!ev.player || !pitch.overrides) return;
    const side = ev.side, opp = otherSide(side);
    const team = sim.sides[side].onPitch, foes = sim.sides[opp].onPitch;
    const scorer = team.find(p => p.number === ev.player.number);
    if (!scorer) return;
    const flag = { x: abs(side, 96.5), y: scorer.y < 50 ? 5 : 95 };
    pitch.overrides.set(scorer, flag);
    cameraFollow(scorer, ms * 0.85);
    team.filter(p => p !== scorer && p.position !== 'GK')
        .sort((a, b) => Math.hypot(a.x - scorer.x, a.y - scorer.y) - Math.hypot(b.x - scorer.x, b.y - scorer.y))
        .slice(0, 4).forEach(p => pitch.overrides.set(p, { follow: scorer }));
    foes.forEach(p => { if (p.el) p.el.classList.add('dejected'); });
    setTimeout(() => foes.forEach(p => { if (p.el) p.el.classList.remove('dejected'); }), ms);
}

// ===== Карточка от судьи и табло замены =====
function showCardAnim(ev) {
    if (!ev.player) return;
    const el = $(playerElId(ev.player));
    if (!el) return;
    const card = document.createElement('span');
    card.className = `card-pop ${ev.type === 'card-red' ? 'red' : 'yellow'}`;
    el.appendChild(card);
    setTimeout(() => card.remove(), 1900);
}

function showSubBoard(ev) {
    const field = $('field-hud') || $('football-field'); // слой поверх поля — камера его не трогает
    if (!field || !ev.out || !ev.sub) return;
    field.querySelector('.sub-board')?.remove();
    const el = document.createElement('div');
    el.className = `sub-board ${ev.side}`;
    el.innerHTML = `<span class="sb-out">${ev.out.number}</span><span class="sb-arrows">⇄</span><span class="sb-in">${ev.sub.number}</span>
        <small>${escapeHtml(shortName(ev.out.name))} → ${escapeHtml(shortName(ev.sub.name))}</small>`;
    field.appendChild(el);
    setTimeout(() => el.remove(), 2400);
}

// ----- Повтор гола в замедлении -----
// Проигрывает записанные кадры атаки: и мяч, и движение игроков
let replayRunning = false;

function replayLastGoal(angle = "top") {
    const g = pitch.lastGoal;
    if (g) replayFrames(g.frames, `${g.ev.minute}' · ${g.ev.player ? g.ev.player.name : ''}${angle === "behind" ? " · из-за ворот" : ""}`, g.ev.side, true, { angle, slow: angle === "behind" ? 1.6 : 1 });
}

// Повтор любого момента: кадры атаки в замедлении (гол — с сеткой и рёвом трибун)
function replayFrames(frames, label, side, isGoal, opts = {}) {
    const g = { frames, ev: { side } };

    if (!g || !g.frames || replayRunning) return;
    replayRunning = true;
    const resume = pauseForReplay();               // ставим живой матч на паузу (match.js)
    pitch.frozen = true;
    const field = $('football-field');

    const badge = document.createElement('div');
    badge.className = 'replay-badge';
    badge.innerHTML = `<span>ПОВТОР</span> ${label}`;
    ($('field-hud') || field).appendChild(badge);
    field.classList.add('replaying');

    const applyFrame = (fr, ms) => {
        fr.players.forEach(p => { const el = $(p.id); if (el) { setTransition(el, ms); el.style.left = `${p.x}%`; el.style.top = `${p.y}%`; } });
        placeBall(fr.ball.x, fr.ball.y, ms);
        highlightPlayer(fr.holder);
    };
    applyFrame(g.frames[0], 0);

    const seg = Math.round(900 * (opts.slow || 1));
    // Ракурс «из-за ворот»: камера за воротами, медленнее (работает и при неподвижной камере)
    if (opts.angle === "behind") {
        const lastB = g.frames[g.frames.length - 1].ball;
        const goalX = side === "team1" ? 100 : 0;
        pitch.cam.forced = true;
        pitch.cam.shot = { kind: "goal-view", until: performance.now() + 400 + seg * g.frames.length + 900,
            cx: lastB.x, cy: lastB.y, goalX, followBall: true, rz: side === "team1" ? -90 : 90 };
    }
    g.frames.slice(1).forEach((fr, i) => {
        setTimeout(() => {
            applyFrame(fr, seg);
            playSound('kick');
        }, 400 + seg * i);
    });
    const end = 400 + seg * (g.frames.length - 1);
    setTimeout(() => {
        const goalEl = field.querySelector(g.ev.side === 'team1' ? '.goal-right' : '.goal-left');
        if (isGoal) goalEl?.classList.add('net-shake');
        if (isGoal) playSound('goal'); else playSound('save');
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
        if (pitch.cam.forced) { pitch.cam.forced = false; pitch.cam.shot = null; }
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
    if (!pitch.setupWalk) { p.x = pt.x; p.y = pt.y; p.vx = p.vy = 0; } // с паузой на расстановку — идут сами
    pitch.overrides.set(p, pt);
}

// Сколько длится расстановка на угловой и штрафной (зависит от выбора в настройках и скорости матча)
function setPieceSetupMs() {
    const mode = (typeof prefs !== 'undefined' && prefs.spMode) || 'normal';
    if (mode === 'fast') return 0;
    const n = typeof normalMatchInterval === 'function' ? normalMatchInterval() : 600;
    return mode === 'show' ? Math.round(clampv(n * 3, 1600, 3200)) : Math.round(clampv(n * 2, 700, 2000));
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
    cameraGoalView(side, abs(side, fk.r), fk.y, 8000);
}

// Пенальти: мяч на точке, вратарь на линии, остальные за пределами штрафной
function stagePenalty(side, team, foes, taker) {
    const gk = foes.find(p => p.position === 'GK');
    if (gk) stagePlace(side, gk, 99.2, 50);
    cameraGoalView(side, abs(side, 88.5), 50, 3000, true);
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
    const field = $('field-hud') || $('football-field'); // слой поверх поля — камера его не трогает
    if (!field) return;
    field.querySelector('.pitch-banner')?.remove();
    const el = document.createElement('div');
    el.className = 'pitch-banner';
    el.textContent = text;
    field.appendChild(el);
    setTimeout(() => el.remove(), 1800);
}

// ===== Стадион матча: узор газона и подпись =====
function matchVenue(sim) {
    const m = sim.match;
    const home = sim.homeSide ? sim.sides[sim.homeSide].team : null;
    const national = home && typeof NATIONS !== 'undefined' && NATIONS[home.name];
    if (!home || national) {
        const h = hashString('venue:' + m.team1.name + m.team2.name + (m.roundName || ''));
        return { name: m.isFinal ? 'Нейтральное поле · финал' : 'Нейтральное поле', capacity: 60000, pattern: PITCH_PATTERNS[Math.floor(h * PITCH_PATTERNS.length)], neutral: true };
    }
    return stadiumOf(home.name);
}

function applyVenue(sim) {
    const v = matchVenue(sim);
    const field = $('football-field');
    if (field) field.dataset.pattern = v.pattern;
    const crowd = Math.round(v.capacity * (0.8 + hashString('crowd:' + sim.match.id + sim.leg + sim.match.team1.name) * 0.2));
    // Время матча: днём — солнце и тени, вечером — закат, ночью — прожекторы
    const th = hashString('time:' + sim.match.team1.name + sim.match.team2.name + sim.leg + (sim.match.roundName || ''));
    const time = th < 0.4 ? 'day' : (th < 0.7 ? 'evening' : 'night');
    const timeLabel = { day: '☀️ дневной матч', evening: '🌇 вечерний матч', night: '🌙 под прожекторами' }[time];
    if (field) {
        field.dataset.time = time;
        if (!field.querySelector('.pitch-surface')) {
            const surf = document.createElement('div');
            surf.className = 'pitch-surface';
            field.insertBefore(surf, field.firstChild);
        }
    }
    setText('field-venue', `🏟️ ${v.name} · ${crowd.toLocaleString('ru-RU')} зрителей · ${timeLabel}`);
    sim.venue = { ...v, crowd, time, timeLabel };
    return sim.venue;
}

// ===== Опасные моменты: в ленте — карточка с повтором =====
pitch.moments = [];

function addMoment(sim, end, side, frames) {
    if (!frames || frames.length < 2 || !state.activeMatch) return;
    const team = sim.sides[side].team;
    const shooter = sim.sides[side].onPitch.concat(sim.sides[side].subbedOff || []).find(p => p.number === (end.shooter ?? end.taker));
    const kind = end.type === 'save' ? 'Сейв' : (String(end.type) === 'penalty-miss' ? 'Нереализованный пенальти' : 'Опасный момент');
    const id = pitch.moments.length;
    pitch.moments.push({ frames, side, label: `${sim.minute}' · ${shooter ? shooter.name : team.name}` });
    const list = $('events-list');
    if (!list) return;
    const el = document.createElement('div');
    el.className = 'event-item moment';
    el.innerHTML = `<span class="event-time">${sim.minute}'</span><span class="event-icon">🎬</span><span class="event-team">${crestHtml(team, 'xs')}</span>
        <span class="event-text">${kind}${shooter ? ': ' + escapeHtml(shooter.name) : ''}${end.xg ? ` <small class="muted">xG ${end.xg.toFixed(2)}</small>` : ''}
        <button type="button" class="moment-replay">▶ Повтор</button></span>`;
    el.querySelector('.moment-replay').onclick = () => { const mo = pitch.moments[id]; if (mo) replayFrames(mo.frames, mo.label, mo.side, false); };
    setTimeout(() => list.prepend(el), 400);
}

// ===== ТВ-табло в углу поля =====
function updateTvBug() {
    const bug = $('tv-bug');
    const sim = pitch.sim;
    if (!bug || !sim) return;
    const m = sim.match;
    const kits = typeof getMatchKits === 'function' ? getMatchKits(m) : {};
    const t1 = $('score-1') ? $('score-1').textContent : sim.score.t1;
    const t2 = $('score-2') ? $('score-2').textContent : sim.score.t2;
    bug.innerHTML = `<span class="tvb-team" style="--kit:${(kits.team1 || {}).primary || '#fff'}">${teamShort(m.team1.name)}</span>
        <span class="tvb-score">${t1}–${t2}</span>
        <span class="tvb-team" style="--kit:${(kits.team2 || {}).primary || '#fff'}">${teamShort(m.team2.name)}</span>
        <span class="tvb-time">${$('match-time') ? $('match-time').textContent : ''}</span>`;
}

// ===== Заставка гола поверх поля =====
function showGoalSplash(sim, ev) {
    const field = $('field-hud') || $('football-field'); // слой поверх поля — камера его не трогает
    if (!field || !ev || !ev.player) return;
    const kits = typeof getMatchKits === 'function' ? getMatchKits(sim.match) : {};
    const kit = kits[ev.side] || {};
    field.querySelector('.goal-splash')?.remove();
    const el = document.createElement('div');
    el.className = 'goal-splash';
    el.style.setProperty('--k1', kit.primary || '#b8f24a');
    el.style.setProperty('--k2', kit.secondary || '#0b1220');
    el.innerHTML = `<div class="gs-word">ГОЛ!</div>
        <div class="gs-card">${crestHtml(ev.team, 'md')}<div><b>${escapeHtml(ev.player.name)}</b>
        <small>${ev.minute}'${ev.assister ? ` · ${assistLabel(ev.setPiece)}: ${escapeHtml(ev.assister.name)}` : ''}${/пенальти/.test(ev.text) ? ' · пенальти' : ''}</small></div>
        <span class="gs-num">${ev.player.number}</span></div>`;
    field.appendChild(el);
    setTimeout(() => el.remove(), 2400);
}

// Табло в углу поля следит за счётом и временем
(function watchScoreForTvBug() {
    const obs = new MutationObserver(() => updateTvBug());
    ['match-time', 'score-1', 'score-2'].forEach(id => { const el = $(id); if (el) obs.observe(el, { childList: true, characterData: true, subtree: true }); });
})();

// ===== Фигурка игрока: голова, футболка цвета формы, шорты, ноги (на бегу — шаг) =====
// Цвета — из CSS-переменных команды (--shirt, --shorts), разворот по направлению бега — --face
const PLAYER_FIGURE = `<svg class="player-fig" viewBox="0 0 22 30" aria-hidden="true">
    <ellipse class="pf-shadow" cx="11" cy="28.6" rx="6" ry="1.4"/>
    <path class="pf-leg pf-leg-l" d="M8.6 21.5 L8 27.6"/>
    <path class="pf-leg pf-leg-r" d="M13.4 21.5 L14 27.6"/>
    <rect class="pf-shorts" x="6.2" y="17.2" width="9.6" height="5" rx="1.3"/>
    <path class="pf-shirt" d="M6.3 8.6 Q11 7.1 15.7 8.6 L18.8 11.8 L16.9 13.9 L15.9 12.7 V18.2 H6.1 V12.7 L5.1 13.9 L3.2 11.8 Z"/>
    <circle class="pf-head" cx="11" cy="4.7" r="3.4"/>
    <path class="pf-hair" d="M7.6 4.3 A3.4 3.4 0 0 1 14.4 4.3 Q11 2.7 7.6 4.3 Z"/>
</svg>`;

function playerInnerHtml(number, shortName) {
    return `${PLAYER_FIGURE}<span class="player-num">${number}</span><span class="player-name">${shortName}</span>`;
}

// ===== Камера трансляции: поле чуть наклонено и приближено, камера плавно ведёт мяч; гол — наезд =====
pitch.cam = { x: 50, y: 50, z: 1, boost: 0 };
const CAM_TILT = 12; // градусов

function cameraOn() {
    return !(typeof prefs !== 'undefined' && prefs.camera === false);
}

function stepCamera(dt) {
    const field = $('football-field');
    const rig = $('stadium') || field; // камера двигает стадион целиком: поле вместе с трибунами
    if (!field) return;
    if ((!cameraOn() && !pitch.cam.forced) || !pitch.sim) {
        if (rig.style.transform) { rig.style.transform = ''; rig.style.removeProperty('--cam-rz'); }
        pitch.cam.rz = 0; pitch.cam._rzStr = undefined;
        return;
    }
    const c = pitch.cam;
    if (c.rz == null) c.rz = 0;
    const mobile = window.innerWidth < 760;
    const now = performance.now();
    const shot = c.shot && now < c.shot.until ? c.shot : null;
    if (c.shot && !shot) c.shot = null;
    const replay = field.classList.contains('replaying');
    if (c.boost > 0) c.boost -= dt;

    // Цель камеры: ракурс момента или обычное ведение мяча
    let tx0, ty0, zT, rzT = 0, tilt = CAM_TILT;
    if (shot && shot.kind === 'goal-view') {
        // Из-за спины бьющего: ворота сверху, поле повёрнуто и сильно наклонено
        if (shot.followBall && pitch.ball) { tx0 = pitch.ball.x + (shot.goalX - pitch.ball.x) * 0.3; ty0 = 50 + (pitch.ball.y - 50) * 0.7; zT = mobile ? 1.7 : 1.85; }
        else { tx0 = shot.cx; ty0 = shot.cy; zT = mobile ? 2.1 : 2.35; }
        rzT = shot.rz; tilt = 26;
    } else if (shot && shot.kind === 'follow' && shot.target) {
        // Крупный план игрока (празднование гола)
        tx0 = shot.target.x; ty0 = shot.target.y; zT = mobile ? 1.9 : 2.1; tilt = 18;
    } else {
        tx0 = pitch.ball ? pitch.ball.x : 50; ty0 = pitch.ball ? pitch.ball.y : 50;
        zT = (mobile ? 1.1 : 1.2) + (c.boost > 0 ? 0.32 : 0);
        if (replay) { zT = mobile ? 1.15 : 1.25; tilt = 0; } // повтор — вид сверху
    }
    const k = Math.min(1, dt * (shot ? 3 : (c.boost > 0 ? 3.5 : 2)));
    c.z += (zT - c.z) * Math.min(1, dt * 2.5);
    c.x += (tx0 - c.x) * k;
    c.y += (ty0 - c.y) * k;
    c.rz += (rzT - c.rz) * Math.min(1, dt * 3.2);
    c.tilt = (c.tilt ?? CAM_TILT) + (tilt - (c.tilt ?? CAM_TILT)) * Math.min(1, dt * 3);
    let tx = 50 - c.x, ty = 50 - c.y;
    if (Math.abs(c.rz) < 1) {
        const lim = (1 - 1 / c.z) * 50; // край поля не выходит за кадр
        tx = Math.max(-lim, Math.min(lim, tx));
        ty = Math.max(-lim, Math.min(lim, ty * 0.8));
    }
    const rzStr = Math.abs(c.rz) < 0.05 ? "0deg" : `${c.rz.toFixed(1)}deg`;
    if (rzStr !== c._rzStr) { c._rzStr = rzStr; rig.style.setProperty("--cam-rz", rzStr); } // меняем, только если повернулась камера
    rig.style.transform = `perspective(1300px) rotateX(${c.tilt.toFixed(2)}deg) scale(${c.z.toFixed(3)}) rotate(${c.rz.toFixed(2)}deg) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
}

// Наезд камеры на момент (гол, пенальти)
function cameraPunch(seconds = 1.6) {
    pitch.cam.boost = seconds;
}

// Ракурс «из-за спины бьющего» на штрафной и пенальти: точка между мячом и воротами, ворота — вверху кадра
function cameraGoalView(side, ballX, ballY, ms = 2600, penalty = false) {
    if (!cameraOn() || prefs.spMode === "fast") return;
    const mpm = typeof normalMatchInterval === "function" ? normalMatchInterval() : (pitch.msPerMinute || 1000);
    if (prefs.spMode !== "show" && !(penalty && mpm >= 350) && (pitch.setupMs || 0) < 900) return; // без паузы на расстановку разворот камеры не успевает — остаёмся на общем плане
    ms = Math.min(ms, penalty ? mpm * 2.4 : (pitch.setupMs || 0) + mpm * 1.6);
    const goalX = side === 'team1' ? 100 : 0;
    pitch.cam.shot = { kind: 'goal-view', until: performance.now() + ms,
        cx: ballX + (goalX - ballX) * 0.45, cy: ballY + (50 - ballY) * 0.3, rz: side === 'team1' ? -90 : 90 };
}

// Крупный план игрока
function cameraFollow(target, ms = 2000) {
    if (!cameraOn() || !target) return;
    pitch.cam.shot = { kind: 'follow', target, until: performance.now() + ms };
}

// ----- Переключатель камеры прямо на поле: «ТВ-камера» ведёт мяч, «Всё поле» — неподвижный общий план -----
function renderCameraToggle() {
    const b = $('btn-camera');
    if (!b) return;
    const tv = cameraOn();
    b.innerHTML = tv ? '🎥 <span>ТВ-камера</span>' : '🗺️ <span>Всё поле</span>';
    b.classList.toggle('fixed', !tv);
    b.setAttribute('aria-pressed', String(tv));
}

function toggleCamera() {
    setPref('camera', !cameraOn());
    pitch.cam.boost = 0;
    pitch.cam.shot = null;
    renderCameraToggle();
}

(function initCameraToggle() {
    const b = $('btn-camera');
    if (!b) return;
    b.onclick = toggleCamera;
    renderCameraToggle();
    document.addEventListener('keydown', e => {
        if ((e.key === 'c' || e.key === 'с' || e.key === 'C' || e.key === 'С') && !e.ctrlKey && !e.metaKey && !e.altKey
            && !(e.target.closest && e.target.closest('input, textarea, select')) && $('field-viewport') && $('field-viewport').offsetParent) toggleCamera();
    });
})();

// ===== Судейские эпизоды: добавленное время, офсайд, VAR, травма =====
function hudHost() { return $('field-hud') || $('football-field'); }

function holdLive(ms) {
    if (pitch.livePenalty && typeof holdForCelebration === 'function') holdForCelebration(ms);
}

// Табло резервного судьи: «+4»
function showAddedBoard(n) {
    const host = hudHost();
    if (!host || !n) return;
    host.querySelector('.added-board')?.remove();
    const el = document.createElement('div');
    el.className = 'added-board';
    el.innerHTML = `<span>ДОБАВЛЕНО</span><b>+${n}</b>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 2800);
}

// Флажок помощника: офсайд
function showOffsideFlag(text = 'ОФСАЙД') {
    const host = hudHost();
    if (!host) return;
    host.querySelector('.offside-flag')?.remove();
    const el = document.createElement('div');
    el.className = 'offside-flag';
    el.innerHTML = `<i></i><span>🚩 ${text}</span>`;
    host.appendChild(el);
    playSound('whistle-short');
    setTimeout(() => el.remove(), 2200);
}

// VAR: «проверка…», затем решение. Матч ждёт, пока идёт просмотр
function showVarCheck(resultText, ms = 2600) {
    const host = hudHost();
    if (!host) return;
    host.querySelector('.var-box')?.remove();
    const el = document.createElement('div');
    el.className = 'var-box checking';
    el.innerHTML = `<div class="var-logo">VAR</div><div class="var-text">ПРОВЕРКА ЭПИЗОДА</div><div class="var-scan"></div>`;
    host.appendChild(el);
    holdLive(ms + 400);
    setTimeout(() => {
        el.classList.remove('checking');
        el.querySelector('.var-text').textContent = resultText;
        el.querySelector('.var-scan')?.remove();
        playSound('whistle-short');
        if (typeof crowdBoo === 'function') crowdBoo(0.8);
    }, ms * 0.6);
    setTimeout(() => el.remove(), ms + 300);
}

// Мяч в сетке, но гол отменён: офсайд (флажок) или после VAR
function showCancelledGoal(sim, end, side) {
    const field = $('football-field');
    const goalEl = field && field.querySelector(side === 'team1' ? '.goal-right' : '.goal-left');
    goalEl?.classList.add('net-shake');
    setTimeout(() => goalEl?.classList.remove('net-shake'), 700);
    if (end.cancelled === 'offside') {
        holdLive(1800);
        setTimeout(() => showOffsideFlag('ОФСАЙД · ГОЛ НЕ ЗАСЧИТАН'), 250);
    } else {
        playSound('goal'); // трибуны успевают взреветь…
        setTimeout(() => showVarCheck(`ГОЛ ОТМЕНЁН · ${String(end.reason || '').toUpperCase()}`), 700);
        holdLive(3400);
    }
    // Игра возобновляется от ворот защищающейся команды
    const opp = otherSide(side);
    const gk = sim.sides[opp].onPitch.find(p => p.position === 'GK');
    const token = pitch.pathToken;
    setTimeout(() => {
        if (pitch.pathToken !== token) return;
        placeBall(abs(opp, 7), 50, 400);
        pitch.holder = gk || null;
        pitch.possession = opp;
        pitch.focus = { x: abs(opp, 7), y: 50 };
    }, 1200);
}

// Травма: игра останавливается, врачи выбегают, носилки
function showInjuryStop(ev) {
    if (!ev.player) return;
    const el = $(playerElId(ev.player));
    if (el) {
        el.classList.add('injured-down');
        const badge = document.createElement('span');
        badge.className = 'injury-pop';
        badge.textContent = '🚑';
        el.appendChild(badge);
        setTimeout(() => { el.classList.remove('injured-down'); badge.remove(); }, 2400);
    }
    showPitchBanner('ТРАВМА · ИГРА ОСТАНОВЛЕНА');
    playSound('whistle-short');
    holdLive(2200);
}

// Погода поменялась по ходу матча — сразу видно на поле
function applyLiveWeather(w) {
    const field = $('football-field');
    if (field && w) field.dataset.weather = w;
}

// Короткая подпись у мяча («аут», «от ворот»)
function showBallTag(text, ms = 900) {
    const host = $('football-field');
    if (!host || !pitch.ball) return;
    const el = document.createElement('div');
    el.className = 'ball-tag';
    el.textContent = text;
    el.style.left = `${pitch.ball.x}%`;
    el.style.top = `${pitch.ball.y}%`;
    host.appendChild(el);
    setTimeout(() => el.remove(), ms);
}

// ===== Фан-сектор над полем: шарфы в цветах клубов, баннеры, файеры в дерби и после голов =====
function renderFanBand(sim) {
    const band = $('fan-band');
    if (!band || !sim) return;
    const key = `${sim.match.id}|${sim.leg}`;
    if (band.dataset.key === key) return;
    band.dataset.key = key;
    const home = sim.homeSide;
    const share = side => !home ? 1 : (side === home ? 2.6 : 1);
    const chant = t => {
        const n = t.name;
        return [`ВПЕРЁД, ${n.toUpperCase()}!`, `${n.toUpperCase()} — НАВСЕГДА`, `МЫ С ТОБОЙ, ${n.toUpperCase()}`][Math.floor(hashString(n + key) * 3)];
    };
    band.innerHTML = ['team1', 'team2'].map(side => {
        const t = sim.sides[side].team;
        return `<div class="fan-sec ${side}" style="flex:${share(side)}">
            <span class="fan-banner">${escapeHtml(chant(t))}</span>
            <i class="flare f1"></i><i class="flare f2"></i><i class="flare f3"></i>
        </div>`;
    }).join('');
    band.classList.remove('flares-team1', 'flares-team2', 'jump-team1', 'jump-team2');
    renderStandFlags(sim);
    if (sim.derby) setTimeout(() => fanFlares('team1', 6000) || fanFlares('team2', 6000), 400); // дерби — файер-шоу на старте
}

function fanFlares(side, ms = 4000) {
    const band = $('fan-band');
    if (!band) return;
    band.classList.add(`flares-${side}`);
    clearTimeout(band[`_fl_${side}`]);
    band[`_fl_${side}`] = setTimeout(() => band.classList.remove(`flares-${side}`), ms);
}

// Гол: сектор забившей команды прыгает, а в дерби и в концовке — ещё и файеры
function fanCelebrate(side, sim) {
    const band = $('fan-band');
    if (!band) return;
    band.classList.remove(`jump-${side}`);
    void band.offsetWidth;
    band.classList.add(`jump-${side}`);
    setTimeout(() => band.classList.remove(`jump-${side}`), 2600);
    if (sim && (sim.derby || sim.minute >= 80)) fanFlares(side, 4500);
}

// ===== Главный судья: держится рядом с эпизодом, но не мешает игре =====
function ensureReferee() {
    const field = $('football-field');
    if (!field) return null;
    let el = field.querySelector('.player.referee');
    if (!el) {
        el = document.createElement('div');
        el.className = 'player referee';
        el.innerHTML = playerInnerHtml('', 'Судья');
        el.title = 'Главный судья';
        field.appendChild(el);
        pitch.ref = { x: 50, y: 40, vx: 0, vy: 0 };
    }
    return el;
}

function stepReferee(dt) {
    const el = ensureReferee();
    if (!el || !pitch.ball) return;
    const r = pitch.ref || (pitch.ref = { x: 50, y: 40, vx: 0, vy: 0 });
    // Цель: по диагонали от мяча, в 10–14 % от него, ближе к центру поля
    const bx = pitch.ball.x, by = pitch.ball.y;
    const tx = clampv(bx + (bx > 50 ? -11 : 11), 8, 92), ty = clampv(by + (by > 50 ? -14 : 14), 6, 94);
    const dx = tx - r.x, dy = (ty - r.y) * 0.66, dist = Math.hypot(dx, dy);
    const vmax = 13 * speedScale();
    const v = Math.min(vmax, dist * 2.4);
    const wantX = dist > 0.05 ? dx / dist * v : 0, wantY = dist > 0.05 ? dy / dist * v : 0;
    const acc = Math.min(1, dt * 5);
    r.vx += (wantX - r.vx) * acc; r.vy += (wantY - r.vy) * acc;
    r.x += r.vx * dt; r.y += r.vy * dt / 0.66;
    if (Math.abs(r.x - (r._lx ?? -9)) > 0.03 || Math.abs(r.y - (r._ly ?? -9)) > 0.03) {
        r._lx = r.x; r._ly = r.y;
        el.style.left = `${r.x.toFixed(2)}%`; el.style.top = `${r.y.toFixed(2)}%`;
    }
    if (Math.abs(r.vx) > 4) { const f = r.vx > 0 ? 1 : -1; if (f !== r._f) { r._f = f; el.style.setProperty('--face', f); } }
}

// ===== Плашка статистики каждые 15 минут =====
function showStatsPlate(sim) {
    const host = hudHost();
    if (!host || !sim) return;
    host.querySelector('.stats-plate')?.remove();
    const st = sim.stats;
    const t1 = sim.sides.team1.team, t2 = sim.sides.team2.team;
    const code = t => (typeof teamShort === 'function' ? teamShort(t.name) : t.name.slice(0, 3).toUpperCase());
    const row = (label, a, b) => `<div class="sp-row"><b>${a}</b><span>${label}</span><b>${b}</b></div>`;
    const el = document.createElement('div');
    el.className = 'stats-plate';
    el.innerHTML = `<div class="sp-head"><span>${escapeHtml(code(t1))}</span><em>${sim.minute}'</em><span>${escapeHtml(code(t2))}</span></div>
        ${row('владение', st.possession.team1 + '%', st.possession.team2 + '%')}
        ${row('удары', st.shots.team1, st.shots.team2)}
        ${row('в створ', st.shotsOnTarget.team1, st.shotsOnTarget.team2)}
        ${row('xG', st.xg.team1.toFixed(1), st.xg.team2.toFixed(1))}`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3600);
}

// ===== Трибуны вокруг поля: флаги, волна, вспышки телефонов =====
function renderStandFlags(sim) {
    const st = $('stadium');
    if (!st) return;
    st.querySelectorAll('.stand-flag').forEach(f => f.remove());
    st.classList.remove('crowd-wave', 'phone-lights', 'pulse');
    pitch.lastWave = 0;
    // Флаги по периметру: у хозяев больше; team1 — слева, team2 — справа
    const spots = [[6, 'top'], [18, 'top'], [31, 'top'], [69, 'top'], [82, 'top'], [94, 'top'], [10, 'bottom'], [27, 'bottom'], [73, 'bottom'], [90, 'bottom'], [30, 'left'], [70, 'left'], [30, 'right'], [70, 'right']];
    spots.forEach(([p, edge], i) => {
        const team1 = edge === 'left' || ((edge === 'top' || edge === 'bottom') && p < 50);
        const f = document.createElement('i');
        f.className = 'stand-flag';
        f.style.setProperty('--c1', team1 ? 'var(--kit1, #2d6fe8)' : 'var(--kit2, #e5323b)');
        f.style.setProperty('--c2', team1 ? 'var(--kit1b, #fff)' : 'var(--kit2b, #fff)');
        f.style.animationDelay = `${(i % 5) * -0.11}s`;
        if (edge === 'top') { f.style.left = `${p}%`; f.style.top = '2px'; }
        else if (edge === 'bottom') { f.style.left = `${p}%`; f.style.bottom = '2px'; }
        else { f.style.top = `${p}%`; f.style[edge] = '0px'; f.style.width = '12px'; }
        st.appendChild(f);
    });
}

// Каждую минуту: иногда трибуны запускают волну; в напряжённой концовке — фонарики телефонов
function crowdAtmosphere(sim) {
    const st = $('stadium');
    if (!st || !sim) return;
    const now = performance.now();
    if (now - (pitch.lastWave || 0) > 25000 && Math.random() < 0.035 && !sim.isOver) {
        pitch.lastWave = now;
        st.classList.remove('crowd-wave'); void st.offsetWidth; st.classList.add('crowd-wave');
        setTimeout(() => st.classList.remove('crowd-wave'), 3500);
    }
    const tense = sim.minute >= 80 && Math.abs(sim.score.t1 - sim.score.t2) <= 1;
    st.classList.toggle('phone-lights', !sim.isOver && (tense || (sim.match.isFinal && sim.minute >= 75)));
}

function standsPulse() {
    const st = $('stadium');
    if (!st) return;
    st.classList.remove('pulse'); void st.offsetWidth; st.classList.add('pulse');
    setTimeout(() => st.classList.remove('pulse'), 2200);
}

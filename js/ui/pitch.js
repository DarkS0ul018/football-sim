// ===== ПОЛЕ: игроки в форме клубов, плавное движение, пасы, удары, баннер гола =====
// Каждая игровая минута анимируется за время шага (зависит от скорости матча).

const pitch = {
    ball: { x: 50, y: 50 },
    resetBall: false,
    timers: []
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

function renderPlayers(sim) {
    const field = $('football-field');
    field.querySelectorAll('.player').forEach(el => el.remove());
    ['team1', 'team2'].forEach(side => {
        sim.sides[side].onPitch.forEach((p, i) => {
            const el = document.createElement('div');
            el.className = `player ${side} ${p.position === 'GK' ? 'goalkeeper' : ''}`;
            el.style.cssText = `left:${p.x}%;top:${p.y}%;z-index:${10 + i}`;
            el.innerHTML = `<span class="player-num">${p.number}</span><span class="player-name">${p.name.split(' ').slice(-1)[0]}</span>`;
            el.id = playerElId(p);
            el.title = `${p.name} · ${p.position} · ${p.rating}`;
            field.appendChild(el);
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
    field.appendChild(ball);
    pitch.ball = { x: 50, y: 50 };
    placeBall(50, 50, 0);
    setText('team1-name', sim.match.team1.name);
    setText('team2-name', sim.match.team2.name);
}

function setTransition(el, ms) {
    el.style.transition = ms > 0 ? `left ${ms}ms ease-in-out, top ${ms}ms ease-in-out` : 'none';
}

function placeBall(x, y, ms) {
    const ball = $('match-ball');
    if (!ball) return;
    setTransition(ball, ms);
    pitch.ball = { x, y };
    ball.style.left = `${x}%`;
    ball.style.top = `${y}%`;
}

function highlightPlayer(player) {
    document.querySelectorAll('.player.has-ball').forEach(el => el.classList.remove('has-ball'));
    if (player) $(playerElId(player))?.classList.add('has-ball');
}

// Куда смещаются игроки, когда команда атакует/обороняется
function movePlayers(sim, ms) {
    const owner = sim.attackingSide;
    const by = pitch.ball.y;
    ['team1', 'team2'].forEach(side => {
        const dir = side === 'team1' ? 1 : -1; // team1 атакует вправо, team2 — влево
        sim.sides[side].onPitch.forEach(p => {
            let tx = p.baseX, ty = p.baseY;
            if (owner === side) {
                tx += ({ FWD: 18, MID: 12, DEF: 7, GK: 2 })[p.position] * dir;
            } else {
                tx -= ({ FWD: 4, MID: 8, DEF: 5, GK: 0 })[p.position] * dir;
            }
            if (p.position === 'GK') ty = Math.max(38, Math.min(62, 50 + (by - 50) * 0.3));
            else ty += (by - 50) * 0.3 + (Math.random() - 0.5) * 6;
            tx += (Math.random() - 0.5) * 3;
            p.x = Math.max(3, Math.min(97, p.x + (tx - p.x) * 0.5));
            p.y = Math.max(4, Math.min(96, p.y + (ty - p.y) * 0.5));
            const el = $(playerElId(p));
            if (el) { setTransition(el, ms); el.style.left = `${p.x}%`; el.style.top = `${p.y}%`; }
        });
    });
}

function pickPassChain(sim, side, length) {
    const players = sim.sides[side].onPitch.filter(p => p.position !== 'GK');
    if (!players.length) return [];
    const dir = side === 'team1' ? 1 : -1;
    // Пасы идут вперёд: сортируем по продвижению к чужим воротам
    const sorted = [...players].sort((a, b) => (a.x - b.x) * dir);
    const chain = [];
    for (let i = 0; i < length; i++) {
        const from = Math.floor((i / length) * sorted.length);
        const to = Math.floor(((i + 1) / length) * sorted.length);
        const slice = sorted.slice(from, Math.max(from + 1, to));
        chain.push(slice[Math.floor(Math.random() * slice.length)]);
    }
    return chain;
}

// Главный эпизод минуты (что показывать мячом)
const EPISODE_PRIORITY = ['goal', 'shot', 'shot-off', 'penalty-miss', 'corner', 'card-red', 'card-yellow', 'foul'];

function animateMinute(sim, events, ms) {
    clearPitchTimers();
    const fast = ms < 250;
    movePlayers(sim, ms * 0.9);

    if (pitch.resetBall) { pitch.resetBall = false; placeBall(50, 50, 0); }

    const side = sim.attackingSide;
    const episode = EPISODE_PRIORITY.map(t => events.find(e => e.type === t)).find(Boolean);
    const attackSide = episode && ['goal', 'shot', 'shot-off', 'penalty-miss', 'corner'].includes(episode.type) ? episode.side : side;
    const chain = pickPassChain(sim, attackSide, fast ? 1 : (episode ? 2 : 3));

    // Мяч идёт по цепочке игроков, затем — финал эпизода
    const points = chain.map(p => ({ x: p.x, y: p.y, player: p }));
    const goalX = attackSide === 'team1' ? 99 : 1;
    if (episode) {
        const shooter = episode.player;
        if (shooter && ['goal', 'shot', 'shot-off', 'penalty-miss'].includes(episode.type)) {
            const sp = sim.sides[attackSide].onPitch.find(p => p.number === shooter.number) || shooter;
            points.push({ x: sp.x ?? 70, y: sp.y ?? 50, player: sp });
        }
        if (episode.type === 'goal') points.push({ x: goalX, y: 44 + Math.random() * 12, goal: true });
        else if (episode.type === 'shot') {
            const gk = sim.sides[otherSide(attackSide)].onPitch.find(p => p.position === 'GK');
            points.push({ x: gk ? gk.x : goalX, y: gk ? gk.y : 50, player: gk, save: true });
        } else if (episode.type === 'shot-off' || episode.type === 'penalty-miss') {
            points.push({ x: goalX, y: Math.random() < 0.5 ? 30 + Math.random() * 8 : 62 + Math.random() * 8, miss: true });
        } else if (episode.type === 'corner') {
            points.push({ x: attackSide === 'team1' ? 98 : 2, y: Math.random() < 0.5 ? 3 : 97, corner: true });
        } else if (episode.player) {
            const off = episode.player;
            points.push({ x: off.x ?? pitch.ball.x, y: off.y ?? pitch.ball.y, player: off, foul: true });
        }
    }
    if (!points.length) return;

    // Запоминаем голевую атаку для повтора
    if (episode && episode.type === 'goal') {
        pitch.lastGoal = {
            ev: episode,
            ballStart: { ...pitch.ball },
            points: points.map(pt => ({ x: pt.x, y: pt.y, goal: !!pt.goal, player: pt.player ? { teamId: pt.player.teamId, number: pt.player.number } : null })),
            players: ['team1', 'team2'].flatMap(s => sim.sides[s].onPitch.map(p => ({ id: playerElId(p), x: p.x, y: p.y })))
        };
    }

    const seg = (ms * 0.85) / points.length;
    points.forEach((pt, i) => {
        pitchLater(() => {
            placeBall(pt.x, pt.y, seg);
            highlightPlayer(pt.player && !pt.save ? pt.player : null);
            if (!fast && i > 0) playSound('kick');
            if (pt.goal) setTimeout(() => onGoalAnimation(sim, episode), seg); // не отменяется следующей минутой
            if (pt.save) pitchLater(() => playSound('save'), seg * 0.8);
        }, seg * i);
    });
}

function onGoalAnimation(sim, ev) {
    const field = $('football-field');
    const goalEl = field.querySelector(ev.side === 'team1' ? '.goal-right' : '.goal-left');
    goalEl?.classList.add('net-shake');
    setTimeout(() => goalEl?.classList.remove('net-shake'), 700);
    showGoalBanner(ev);
    const btn = $('btn-replay-goal');
    if (btn) btn.style.display = '';
    pitch.resetBall = true;
}

// ----- Повтор гола в замедлении -----
let replayRunning = false;

function replayLastGoal() {
    const g = pitch.lastGoal;
    if (!g || replayRunning) return;
    replayRunning = true;
    const resume = pauseForReplay();               // ставим живой матч на паузу (match.js)
    clearPitchTimers();
    const field = $('football-field');

    // Запоминаем текущее положение, чтобы вернуть после повтора
    const now = [...field.querySelectorAll('.player')].map(el => ({ el, left: el.style.left, top: el.style.top }));
    const ballNow = { ...pitch.ball };

    const badge = document.createElement('div');
    badge.className = 'replay-badge';
    badge.innerHTML = `<span>ПОВТОР</span> ${g.ev.minute}' · ${g.ev.player ? g.ev.player.name : ''}`;
    field.appendChild(badge);
    field.classList.add('replaying');

    g.players.forEach(p => { const el = $(p.id); if (el) { setTransition(el, 0); el.style.left = `${p.x}%`; el.style.top = `${p.y}%`; } });
    placeBall(g.ballStart.x, g.ballStart.y, 0);

    const seg = 800;
    g.points.forEach((pt, i) => {
        setTimeout(() => {
            placeBall(pt.x, pt.y, seg);
            const pl = pt.player ? { teamId: pt.player.teamId, number: pt.player.number } : null;
            highlightPlayer(pl);
            if (i > 0) playSound('kick');
            if (pt.goal) setTimeout(() => {
                const goalEl = field.querySelector(g.ev.side === 'team1' ? '.goal-right' : '.goal-left');
                goalEl?.classList.add('net-shake');
                playSound('goal');
                setTimeout(() => goalEl?.classList.remove('net-shake'), 700);
            }, seg);
        }, 400 + seg * i);
    });

    setTimeout(() => {
        badge.remove();
        field.classList.remove('replaying');
        now.forEach(n => { setTransition(n.el, 0); n.el.style.left = n.left; n.el.style.top = n.top; });
        placeBall(ballNow.x, ballNow.y, 0);
        highlightPlayer(null);
        replayRunning = false;
        if (resume) resumeAfterReplay();
    }, 400 + seg * g.points.length + 1400);
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
        ${ev.assister ? `<span class="gt-assist">пас: ${ev.assister.name}</span>` : ''}
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

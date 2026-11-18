// ===== ЭКРАН МАТЧА: поле, живая симуляция, быстрый результат, пенальти =====
// Вся логика игры — в MatchSimulation (js/core/engine.js). Здесь только показ.

let simulationInterval = null;
let pendingTimers = [];
let currentMatchSpeed = 5;
let onSpeedChange = null;
let currentSim = null; // симуляция игры, показанной на экране

function getMatchInterval() {
    // 1x = 1 сек на игровую минуту, 10x = 0.1 сек
    return Math.max(50, 1000 - (currentMatchSpeed - 1) * 100);
}

function later(fn, ms) {
    pendingTimers.push(setTimeout(fn, ms));
}

function stopMatchTimers() {
    clearInterval(simulationInterval);
    pendingTimers.forEach(clearTimeout);
    pendingTimers = [];
    onSpeedChange = null;
    simStep = null;
    $('btn-manage-match').style.display = 'none';
}

let simStep = null;     // функция шага живого матча (для паузы)
let isPaused = false;

// Сторона команды игрока в текущем матче (только карьера)
function userSide(m) {
    if (!isUserMatch(m)) return null;
    return m.team1.id === state.userTeam.id ? 'team1' : 'team2';
}

// ----- Пауза и управление по ходу матча -----
let manageOut = null, manageIn = null;

function openManagePanel() {
    if (!simStep || !currentSim) return;
    clearInterval(simulationInterval);
    isPaused = true;
    manageOut = manageIn = null;
    renderManagePanel();
    $('manage-overlay').style.display = 'flex';
}

function renderManagePanel() {
    const sim = currentSim;
    const side = userSide(sim.match);
    const s = sim.sides[side];
    setText('manage-minute', `${sim.minute}' · ${sim.score.t1}:${sim.score.t2}`);
    renderStyleButtons('manage-style', s.style, style => {
        sim.setStyle(side, style);
        getSquad(s.team).style = style;
        renderManagePanel();
    });
    const left = MAX_SUBS - s.subsUsed;
    setText('manage-subs-left', `(осталось ${left} из ${MAX_SUBS})`);
    const row = (p, key, selected) => `
        <div class="tactics-player ${selected ? 'selected' : ''}" data-key="${key}">
            <span class="tp-slot">${p.position}</span><span class="tp-num">${p.number}</span>
            <span class="tp-name">${p.name}${p.yellow ? ' 🟨' : ''}</span>
            <span class="tp-fitness"><span style="width:${Math.round(p.fitness)}%;background:${fitnessColor(p.fitness)}"></span></span>
            <span class="tp-rating">${Math.round(effectiveRating(p, p.position))}</span>
        </div>`;
    $('manage-out').innerHTML = s.onPitch.map(p => row(p, `o${p.number}`, manageOut === p.number)).join('');
    $('manage-in').innerHTML = s.bench.length
        ? s.bench.map(p => row({ ...p, position: p.natPos }, `i${p.number}`, manageIn === p.number)).join('')
        : '<div class="muted">Скамейка пуста</div>';
    document.querySelectorAll('#manage-overlay .tactics-player').forEach(el => el.onclick = () => {
        const num = Number(el.dataset.key.slice(1));
        if (el.dataset.key[0] === 'o') manageOut = manageOut === num ? null : num;
        else manageIn = manageIn === num ? null : num;
        renderManagePanel();
    });
    $('btn-manage-sub').disabled = !(manageOut && manageIn && left > 0);
    $('manage-autosubs').checked = s.autoSubs;
}

function doManualSub() {
    const sim = currentSim;
    const side = userSide(sim.match);
    sim.newEvents = [];
    if (sim.manualSubstitute(side, manageOut, manageIn)) {
        sim.newEvents.forEach(ev => showSimEvent(sim.match, ev));
        renderPlayers(sim);
        renderLineups(sim);
        renderSubstitutions(sim);
    }
    manageOut = manageIn = null;
    renderManagePanel();
}

function resumeMatch() {
    $('manage-overlay').style.display = 'none';
    isPaused = false;
    if (simStep) simulationInterval = setInterval(simStep, getMatchInterval());
}

// Пока матч идёт, уйти с экрана нельзя (иначе он доигрывался бы в фоне)
function setMatchInProgress(inProgress) {
    const back = document.querySelector('#screen-match .btn-back');
    back.disabled = inProgress;
    back.style.opacity = inProgress ? '0.4' : '1';
    back.style.pointerEvents = inProgress ? 'none' : '';
}

// ----- Лента событий -----
const EVENT_ICONS = {
    'goal': '⚽', 'shot': '🧤', 'shot-off': '💨', 'corner': '🚩', 'foul': '⚠️',
    'card-yellow': '🟨', 'card-red': '🟥', 'substitution': '🔄', 'injury': '🚑',
    'half': '⏱️', 'penalties': '🎲', 'penalty-goal': '✅', 'penalty-miss': '❌', 'finish': '🏁'
};

function addMatchEvent(match, minute, type, text, team = null) {
    const list = $('events-list');
    const el = document.createElement('div');
    el.className = `event-item ${type}`;
    const timeLabel = typeof minute === 'number' ? `${minute}'` : (minute || '');
    const isTeam1 = team && team.id === match.team1.id;
    const color = team ? (isTeam1 ? 'var(--accent-primary)' : 'var(--highlight)') : 'var(--text-muted)';
    const emoji = team ? (team.emoji || (isTeam1 ? '🔵' : '🔴')) : '•';
    el.innerHTML = `<span class="event-time">${timeLabel}</span><span class="event-icon">${EVENT_ICONS[type] || '•'}</span><span class="event-team" style="color:${color};font-weight:600">${emoji}</span><span class="event-text">${text}</span>`;
    list.prepend(el);
}

function showSimEvent(m, ev, prefix = '') {
    addMatchEvent(m, ev.minute, ev.type, prefix + ev.text, ev.team);
}

// ----- Поле -----
function renderPlayers(sim) {
    const field = $('football-field');
    field.querySelectorAll('.player').forEach(el => el.remove());
    ['team1', 'team2'].forEach(side => {
        sim.sides[side].onPitch.forEach((p, i) => {
            const el = document.createElement('div');
            el.className = `player ${side} ${p.position === 'GK' ? 'goalkeeper' : ''}`;
            el.style.cssText = `left:${p.x}%;top:${p.y}%;z-index:${10 + i}`;
            el.innerText = p.number;
            el.id = `player-${p.teamId}-${p.number}`;
            el.title = `${p.name} · ${p.position} · ${p.rating}`;
            field.appendChild(el);
        });
    });
}

function renderField(sim) {
    const field = $('football-field');
    field.querySelector('.ball')?.remove();
    renderPlayers(sim);
    const ball = document.createElement('div');
    ball.className = 'ball';
    ball.id = 'match-ball';
    ball.innerText = '⚽';
    ball.style.cssText = 'left:50%;top:50%;z-index:100';
    field.appendChild(ball);
    setText('team1-name', sim.match.team1.name);
    setText('team2-name', sim.match.team2.name);
}

function moveElement(id, x, y) {
    const el = $(id);
    if (el) { el.style.left = `${x}%`; el.style.top = `${y}%`; }
}

function highlightPlayer(player) {
    document.querySelectorAll('.player.has-ball').forEach(el => el.classList.remove('has-ball'));
    if (player) $(`player-${player.teamId}-${player.number}`)?.classList.add('has-ball');
}

// ----- Составы -----
function renderLineups(sim) {
    const row = (p, cls = '') => {
        const cards = p.yellow ? ' 🟨' : '';
        return `<div class="lineup-player ${cls}"><span class="lp-num">${p.number}</span><span class="lp-pos">${p.position}</span><span class="lp-name" title="${p.name}">${p.name}${cards}</span><span class="lp-rating">${p.rating}</span></div>`;
    };
    $('lineups').innerHTML = ['team1', 'team2'].map(side => {
        const s = sim.sides[side];
        const color = side === 'team1' ? 'var(--accent-primary)' : 'var(--highlight)';
        const home = sim.homeSide === side ? ' 🏠' : '';
        const off = [...s.sentOff.map(p => row({ ...p, name: p.name + ' 🟥' }, 'off')), ...s.subbedOff.map(p => row({ ...p, name: p.name + ' ↩' }, 'off'))];
        return `<div>
            <div class="lineup-team-name" style="color:${color}">${teamLabel(s.team)}${home}</div>
            ${s.onPitch.map(p => row(p)).join('')}
            ${off.length ? `<div class="lineup-subtitle">Ушли с поля</div>${off.join('')}` : ''}
            <div class="lineup-subtitle">Запасные (замен ${s.subsUsed}/${MAX_SUBS})</div>
            ${s.bench.map(p => row(p, 'bench')).join('')}
        </div>`;
    }).join('');
}

// ----- Статистика и табло -----
function updateStatsDisplay(sim) {
    const s = sim.stats;
    const p1 = Math.max(0, Math.min(100, s.possession.team1));
    $('possession-bar-1').style.width = p1 + '%';
    $('possession-bar-2').style.width = (100 - p1) + '%';
    setText('possession-1', p1 + '%');
    setText('possession-2', (100 - p1) + '%');
    [['shots', 'shots'], ['shots-on-target', 'shotsOnTarget'], ['corners', 'corners'], ['fouls', 'fouls']].forEach(([id, key]) => {
        setText(`${id}-1`, s[key].team1);
        setText(`${id}-2`, s[key].team2);
    });
    setText('yellow-1', `🟨 ${s.yellowCards.team1}`);
    setText('red-1', `🟥 ${s.redCards.team1}`);
    setText('yellow-2', `🟨 ${s.yellowCards.team2}`);
    setText('red-2', `🟥 ${s.redCards.team2}`);
}

// На табло: в 1-м матче — его счёт, во 2-м — сумма двух матчей
function updateScoreboard(m) {
    const score = m.legs === 2 && m.currentLeg === 1 ? m.leg1 : m.aggregateScore;
    setText('score-1', score.t1);
    setText('score-2', score.t2);
}

function renderSubstitutions(sim) {
    const s1 = sim.stats.substitutions.team1, s2 = sim.stats.substitutions.team2;
    $('substitutions-panel').style.display = (s1.length || s2.length) ? 'block' : 'none';
    const column = (team, subs, color) => `<div><strong style="color:${color};margin-bottom:10px;display:block">${team.name}</strong>${subs.map(s =>
        `<div class="sub-slot used"><span class="sub-player">${s.out} → ${s.in}</span><span class="sub-time">${s.minute}'</span></div>`).join('')}</div>`;
    $('substitution-slots').innerHTML = column(sim.match.team1, s1, 'var(--accent-primary)') + column(sim.match.team2, s2, 'var(--highlight)');
}

function celebrateGoal(side) {
    const sb = document.querySelector('.scoreboard-v2');
    if (sb) { const r = sb.getBoundingClientRect(); createConfetti(r.left + r.width / 2, r.top); }
    const el = $(side === 'team1' ? 'score-1' : 'score-2');
    el.classList.add('goal-animation');
    later(() => el.classList.remove('goal-animation'), 500);
}

function legLabel(m, leg) {
    if (m.legs !== 2) return m.isFinal ? 'Финал · нейтральное поле' : m.roundName;
    const home = leg === 2 ? m.team2 : m.team1;
    return `${m.roundName} · ${leg}-й матч · дома: ${home.name}`;
}

// Готовит экран к новой игре (первая игра матча или второй матч пары)
function prepareLeg(m, leg) {
    currentSim = new MatchSimulation(m, leg);
    setText('match-stage-info', legLabel(m, leg));
    renderField(currentSim);
    renderLineups(currentSim);
    renderSubstitutions(currentSim);
    updateStatsDisplay(currentSim);
    return currentSim;
}

// ----- Открытие матча -----
function openMatchScreen(match) {
    stopMatchTimers();
    state.activeMatch = match;
    $('events-list').innerHTML = '';

    setText('match-team-1', match.team1.name);
    setText('match-team-2', match.team2.name);
    setText('team-1-logo', match.team1.emoji || '⚽');
    setText('team-2-logo', match.team2.emoji || '⚽');
    updateScoreboard(match);
    setText('match-time', "00'");
    setText('match-status', 'LIVE');

    prepareLeg(match, match.legs === 2 ? match.currentLeg : 1);
    setMatchInProgress(false);

    setVisible(['btn-sim-match', 'btn-instant-match'], true);
    setVisible(['btn-next-match', 'btn-close-match'], false);
    showScreen('match');
}

function beginMatch(runner) {
    setVisible(['btn-sim-match', 'btn-instant-match'], false);
    setMatchInProgress(true);
    runner(state.activeMatch);
}

// ----- Живая симуляция -----
function startSimulation(m) {
    let sim = currentSim;
    let ballX = 50, ballY = 50;

    function updatePlayerPositions() {
        const owner = sim.attackingSide;
        ['team1', 'team2'].forEach(side => {
            const dir = side === 'team1' ? 1 : -1; // team1 атакует вправо, team2 — влево
            sim.sides[side].onPitch.forEach(p => {
                let tx = p.baseX, ty = p.baseY;
                if (owner === side) {
                    if (p.position === 'FWD') tx += 15 * dir;
                    else if (p.position === 'MID') tx += 10 * dir;
                    else if (p.position === 'DEF') tx += 5 * dir;
                } else {
                    if (p.position === 'DEF') tx -= 5 * dir;
                    else if (p.position === 'MID') tx -= 8 * dir;
                }
                if (p.position === 'GK') ty = Math.max(30, Math.min(70, ballY));
                else ty += (ballY - 50) * 0.25;
                p.x = Math.max(5, Math.min(95, p.x + (tx - p.x) * 0.3));
                p.y = Math.max(5, Math.min(95, p.y + (ty - p.y) * 0.3));
                moveElement(`player-${p.teamId}-${p.number}`, p.x, p.y);
            });
        });
    }

    function moveBall(events) {
        const goal = events.find(e => e.type === 'goal');
        if (goal) { ballX = 50; ballY = 50; }
        else {
            const goalX = sim.attackingSide === 'team1' ? 90 : 10;
            ballX += (goalX - ballX) * 0.15 + (Math.random() - 0.5) * 6;
            ballY += (50 - ballY) * 0.05 + (Math.random() - 0.5) * 8;
        }
        ballX = Math.max(5, Math.min(95, ballX));
        ballY = Math.max(5, Math.min(95, ballY));
        moveElement('match-ball', ballX, ballY);
        const carrier = events.find(e => e.player)?.player;
        highlightPlayer(carrier || null);
    }

    function step() {
        const events = sim.step();
        let lineupChanged = false;
        events.forEach(ev => {
            showSimEvent(m, ev);
            if (ev.type === 'goal') { updateScoreboard(m); celebrateGoal(ev.side); }
            if (ev.lineupChanged) lineupChanged = true;
        });
        if (lineupChanged) { renderPlayers(sim); renderSubstitutions(sim); }
        if (lineupChanged || events.some(e => e.type === 'card-yellow')) renderLineups(sim);

        moveBall(events);
        updatePlayerPositions();
        setText('match-time', sim.minute + "'");
        if (sim.phase === 'extra') setText('match-status', 'ДОП. ВРЕМЯ');
        updateStatsDisplay(sim);

        if (!sim.isOver) return;
        if (m.legs === 2 && sim.leg === 1) {
            addMatchEvent(m, 90, 'half', `Конец 1-го матча: ${m.leg1.t1}:${m.leg1.t2}`, null);
            setText('match-status', '2-й матч');
            sim = prepareLeg(m, 2);
            ballX = 50; ballY = 50;
            updateScoreboard(m);
            return;
        }
        stopMatchTimers();
        concludeMatch(m, sim, true);
    }

    onSpeedChange = () => {
        if (isPaused) return;
        clearInterval(simulationInterval);
        simulationInterval = setInterval(step, getMatchInterval());
    };
    simStep = step;
    isPaused = false;
    if (userSide(m)) $('btn-manage-match').style.display = 'flex';
    simulationInterval = setInterval(step, getMatchInterval());
}

// ----- Быстрый результат: тот же движок, но без показа по минутам -----
const KEY_EVENTS = new Set(['goal', 'card-red', 'penalty-miss', 'injury']);

function instantResult(m) {
    const legs = [];
    let sim = currentSim;
    while (true) {
        sim.runToEnd();
        legs.push(sim);
        if (m.legs === 2 && sim.leg === 1) sim = new MatchSimulation(m, 2);
        else break;
    }
    currentSim = sim;

    legs.forEach(s => {
        const prefix = m.legs === 2 ? `[${s.leg}-й матч] ` : '';
        s.events.filter(e => KEY_EVENTS.has(e.type) || (e.type === 'half' && e.text.includes('дополнительное'))).forEach(e => showSimEvent(m, e, prefix));
        if (m.legs === 2) addMatchEvent(m, '', 'half', `${s.leg}-й матч: ${m.team1.name} ${s.score.t1}:${s.score.t2} ${m.team2.name}`, null);
    });

    renderPlayers(sim);
    renderLineups(sim);
    renderSubstitutions(sim);
    updateStatsDisplay(sim);
    updateScoreboard(m);
    setText('match-stage-info', legLabel(m, sim.leg));
    setText('match-time', m.extraTime ? 'FT (д.в.)' : 'FT');
    later(() => concludeMatch(m, sim), 600);
}

// После основного (и дополнительного) времени: либо пенальти, либо сразу итог.
// В живом матче карьеры игрок сам участвует в серии пенальти.
function concludeMatch(m, sim, live = false) {
    if (!needsShootout(m)) { finishMatch(m, winnerByScore(m)); return; }
    addMatchEvent(m, '', 'penalties', 'Серия пенальти!', null);
    setText('match-status', 'ПЕНАЛЬТИ');
    const done = result => { applyShootout(m, result); finishMatch(m, result.winner); };
    if (live && userSide(m)) { playInteractiveShootout(m, sim, done); return; }
    const shootout = computeShootout(m, sim);
    animateShootout(m, shootout, () => done(shootout));
}

// ----- Интерактивная серия пенальти -----
function playInteractiveShootout(m, sim, onDone) {
    const so = new Shootout(m, sim);
    const mySide = userSide(m);
    const overlay = $('shootout-overlay');
    setText('so-team1', teamLabel(m.team1));
    setText('so-team2', teamLabel(m.team2));
    setText('so-last', '');
    overlay.style.display = 'flex';

    const zones = [...overlay.querySelectorAll('.so-zone')];
    const contBtn = $('btn-so-continue');

    const renderScore = () => {
        setText('so-total', `${so.s.team1} : ${so.s.team2}`);
        ['team1', 'team2'].forEach((side, i) => {
            $(`so-kicks${i + 1}`).innerHTML = so.kicks.filter(k => k.side === side).map(k => k.scored ? '⚽' : '❌').join(' ');
        });
        setText('match-time', `ПЕН ${so.s.team1}:${so.s.team2}`);
    };

    const finish = () => {
        overlay.style.display = 'none';
        zones.forEach(z => z.onclick = null);
        onDone(so.result());
    };

    const nextKick = () => {
        contBtn.style.display = 'none';
        zones.forEach(z => z.classList.remove('shot', 'dive'));
        if (so.isOver) {
            const won = so.winner.id === state.userTeam.id;
            setText('so-prompt', won ? '🏆 Победа в серии пенальти!' : '😔 Серия пенальти проиграна');
            contBtn.style.display = 'block';
            contBtn.onclick = finish;
            return;
        }
        const side = so.nextSide();
        const taker = so.nextTaker();
        const keeper = so.nextKeeper();
        const userKicks = side === mySide;
        setText('so-prompt', userKicks
            ? `⚽ Бьёт ${taker.name}. Куда бить? (вратарь: ${keeper.name})`
            : `🧤 Бьёт ${taker.name}. Куда прыгает ${keeper.name}?`);
        zones.forEach(z => z.onclick = () => {
            zones.forEach(x => x.onclick = null);
            const dir = z.dataset.dir;
            const kick = userKicks ? so.kick(dir, randomDiveDir()) : so.kick(randomShotDir(), dir);
            overlay.querySelector(`.so-zone[data-dir="${kick.shotDir}"]`).classList.add('shot');
            overlay.querySelector(`.so-zone[data-dir="${kick.diveDir}"]`).classList.add('dive');
            const team = kick.side === 'team1' ? m.team1 : m.team2;
            setText('so-last', `${kick.player}: ${KICK_DIR_LABELS[kick.shotDir]}, вратарь — ${KICK_DIR_LABELS[kick.diveDir]}. ${kick.scored ? 'ГОЛ!' : 'НЕ ЗАБИЛ!'} (${kick.note})`);
            addMatchEvent(m, 'ПЕН', kick.scored ? 'penalty-goal' : 'penalty-miss', `${kick.player}: ${kick.scored ? 'ГОЛ!' : 'мимо'} (${kick.note})`, team);
            renderScore();
            contBtn.style.display = 'block';
            contBtn.onclick = nextKick;
        });
    };
    renderScore();
    nextKick();
}

function animateShootout(m, shootout, onDone) {
    let s1 = 0, s2 = 0, i = 0;
    const next = () => {
        if (i >= shootout.kicks.length) { onDone(); return; }
        const k = shootout.kicks[i++];
        if (k.scored) { if (k.side === 'team1') s1++; else s2++; }
        const team = k.side === 'team1' ? m.team1 : m.team2;
        addMatchEvent(m, 'ПЕН', k.scored ? 'penalty-goal' : 'penalty-miss', `${k.player || 'Удар ' + k.number}: ${k.scored ? 'ГОЛ!' : 'МИМО!'}`, team);
        setText('match-time', `ПЕН ${s1}:${s2}`);
        later(next, 1000);
    };
    next();
}

// ----- Завершение матча -----
function finishMatch(m, winner) {
    stopMatchTimers();
    completeMatch(m, winner);

    const agg = m.aggregateScore;
    const prefix = m.isFinal ? '🏆 ФИНАЛ | ' : (m.legs === 2 ? `(${m.leg1.t1}:${m.leg1.t2}, ${m.leg2.t1}:${m.leg2.t2}) | ` : '');
    const et = m.extraTime ? ' (д.в.)' : '';
    const pen = m.penalties.kicks.length ? ` (пен. ${m.penalties.t1}:${m.penalties.t2})` : '';
    const text = winner
        ? `${prefix}${winner.name} победил ${agg.t1}:${agg.t2}${et}${pen}`
        : `${prefix}Ничья ${agg.t1}:${agg.t2}${m.stage === 'group' ? ' (по 1 очку)' : ''}`;
    addMatchEvent(m, 'FT', 'finish', text, null);
    if (isUserMatch(m) && state.userTeamEliminated) addMatchEvent(m, '', 'finish', '😔 Ваша команда выбыла из турнира', null);

    setText('match-status', 'FINISHED');
    setMatchInProgress(false);
    setVisible(['btn-close-match'], true);

    // В карьере остальные матчи этого тура (в плей-офф — раунда) досчитываются автоматически
    if (isCareer()) {
        const md = m.matchday ?? Infinity;
        autoSimulateAllRemainingMatches(om => !isUserMatch(om) && (om.matchday ?? 0) <= md);
    }
    saveGame();

    const btn = $('btn-next-match');
    const nextMatch = state.matches.find(x => !x.isFinished && (!isCareer() || isUserMatch(x)));
    btn.style.display = 'flex';
    if (isCareer() && state.userTeamEliminated) {
        btn.innerHTML = '<span class="btn-icon">🤖</span><span class="btn-text">Досимулировать турнир</span>';
        btn.onclick = () => showResults(autoFinishTournament());
    } else if (nextMatch && m.stage === 'group') {
        btn.innerHTML = '<span class="btn-icon">➡️</span><span class="btn-text">Следующий матч</span>';
        btn.onclick = () => openMatch(nextMatch);
    } else {
        btn.innerHTML = nextMatch
            ? '<span class="btn-icon">📊</span><span class="btn-text">К сетке</span>'
            : '<span class="btn-icon">🏆</span><span class="btn-text">Завершить раунд</span>';
        btn.onclick = openDashboard;
    }
}

function initMatchScreen() {
    $('btn-sim-match').onclick = () => beginMatch(startSimulation);
    $('btn-instant-match').onclick = () => beginMatch(instantResult);
    $('btn-close-match').onclick = openDashboard;
    document.querySelector('#screen-match .btn-back').onclick = openDashboard;
    $('btn-manage-match').onclick = openManagePanel;
    $('btn-manage-sub').onclick = doManualSub;
    $('btn-manage-resume').onclick = resumeMatch;
    $('manage-autosubs').onchange = e => { if (currentSim) currentSim.sides[userSide(currentSim.match)].autoSubs = e.target.checked; };

    $('match-speed').addEventListener('input', function () {
        currentMatchSpeed = parseInt(this.value);
        setText('speed-value', currentMatchSpeed + 'x');
        if (onSpeedChange) onSpeedChange();
    });
}

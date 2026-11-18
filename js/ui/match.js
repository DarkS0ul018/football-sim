// ===== ЭКРАН МАТЧА: поле, живая симуляция, быстрый результат, пенальти =====

let simulationInterval = null;
let pendingTimers = [];
let currentMatchSpeed = 5;
let onSpeedChange = null;

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
    'goal': '⚽', 'shot': '🎯', 'shot-off': '💨', 'corner': '🚩', 'foul': '⚠️',
    'card-yellow': '🟨', 'card-red': '🟥', 'substitution': '🔄',
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

const EVENT_TEXTS = {
    'shot': () => 'Удар в створ — вратарь на месте',
    'shot-off': () => 'Удар мимо',
    'corner': () => 'Угловой',
    'foul': () => 'Фол',
    'card-yellow': () => 'Жёлтая карточка',
    'card-red': () => 'Красная карточка',
    'substitution': e => `Замена: ${e.out} → ${e.in}`
};

// ----- Поле -----
function renderField(match) {
    const field = $('football-field');
    field.querySelectorAll('.player, .ball').forEach(el => el.remove());

    [[match.squad1, 'team1', match.team1], [match.squad2, 'team2', match.team2]].forEach(([squad, cls, team]) => {
        squad.forEach((player, i) => {
            const el = document.createElement('div');
            el.className = `player ${cls} ${player.isGoalkeeper ? 'goalkeeper' : ''}`;
            el.style.cssText = `left:${player.x}%;top:${player.y}%;z-index:${10 + i}`;
            el.innerText = player.number;
            el.id = `player-${team.id}-${player.number}`;
            el.title = `${player.name} (#${player.number})`;
            field.appendChild(el);
        });
    });

    const ball = document.createElement('div');
    ball.className = 'ball';
    ball.id = 'match-ball';
    ball.innerText = '⚽';
    ball.style.cssText = 'left:50%;top:50%;z-index:100';
    field.appendChild(ball);

    setText('team1-name', match.team1.name);
    setText('team2-name', match.team2.name);
}

function moveElement(id, x, y) {
    const el = $(id);
    if (el) { el.style.left = `${x}%`; el.style.top = `${y}%`; }
}

function highlightPlayerWithBall(teamId, num) {
    document.querySelectorAll('.player.has-ball').forEach(el => el.classList.remove('has-ball'));
    $(`player-${teamId}-${num}`)?.classList.add('has-ball');
}

// ----- Статистика и табло -----
function updateStatsDisplay(match) {
    const s = match.stats;
    if (!s) return;
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

function renderSubstitutions(match) {
    const s1 = match.stats.substitutions.team1, s2 = match.stats.substitutions.team2;
    $('substitutions-panel').style.display = (s1.length || s2.length) ? 'block' : 'none';
    const column = (team, subs, color) => `<div><strong style="color:${color};margin-bottom:10px;display:block">${team.name}</strong>${subs.map(s =>
        `<div class="sub-slot used"><span class="sub-number">${s.out}</span><span class="sub-player">→ ${s.in}</span><span class="sub-time">${s.minute}'</span></div>`).join('')}</div>`;
    $('substitution-slots').innerHTML = column(match.team1, s1, 'var(--accent-primary)') + column(match.team2, s2, 'var(--highlight)');
}

function celebrateGoal(side) {
    const sb = document.querySelector('.scoreboard-v2');
    if (sb) { const r = sb.getBoundingClientRect(); createConfetti(r.left + r.width / 2, r.top); }
    const el = $(side === 'team1' ? 'score-1' : 'score-2');
    el.classList.add('goal-animation');
    later(() => el.classList.remove('goal-animation'), 500);
}

// ----- Открытие матча -----
function openMatchScreen(match) {
    stopMatchTimers();
    state.activeMatch = match;
    $('events-list').innerHTML = '';
    $('substitutions-panel').style.display = 'none';
    $('substitution-slots').innerHTML = '';

    setText('match-team-1', match.team1.name);
    setText('match-team-2', match.team2.name);
    setText('team-1-logo', match.team1.emoji || '⚽');
    setText('team-2-logo', match.team2.emoji || '⚽');
    setText('score-1', '0');
    setText('score-2', '0');
    setText('match-time', "00'");
    setText('match-status', 'LIVE');
    setText('match-stage-info', match.roundName);

    ensureSquads(match);
    initMatchStats(match);
    renderField(match);
    updateStatsDisplay(match);
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
    let min = 0, ballX = 50, ballY = 50, ballOwner = null;
    const possessionTicks = { team1: 0, team2: 0 };

    function updatePlayerPositions() {
        [...m.squad1, ...m.squad2].forEach(p => {
            let tx = p.baseX, ty = p.baseY;
            const isTeam1 = p.team === m.team1.id;
            const dir = isTeam1 ? 1 : -1; // team1 атакует вправо, team2 — влево
            if (ballOwner === (isTeam1 ? 'team1' : 'team2')) {
                if (p.position === 'FWD') tx += 15 * dir;
                else if (p.position === 'MID') tx += 10 * dir;
                else if (p.position === 'DEF') tx += 5 * dir;
            } else if (ballOwner) {
                if (p.position === 'DEF') tx -= 5 * dir;
                else if (p.position === 'MID') tx -= 8 * dir;
            }
            if (p.isGoalkeeper) ty = Math.max(30, Math.min(70, ballY));
            else ty += (ballY - 50) * 0.25;
            p.x = Math.max(5, Math.min(95, p.x + (tx - p.x) * 0.3));
            p.y = Math.max(5, Math.min(95, p.y + (ty - p.y) * 0.3));
            moveElement(`player-${p.team}-${p.number}`, p.x, p.y);
        });
    }

    function moveBall() {
        if (ballOwner) {
            const goalX = ballOwner === 'team1' ? 90 : 10;
            ballX += (goalX - ballX) * 0.02 + (Math.random() - 0.5) * 3;
            ballY += (50 - ballY) * 0.01 + (Math.random() - 0.5) * 3;
        }
        ballX = Math.max(5, Math.min(95, ballX));
        ballY = Math.max(5, Math.min(95, ballY));
        moveElement('match-ball', ballX, ballY);
    }

    function changePossession() {
        // В «реализме» сильная команда владеет мячом чаще
        if (!ballOwner || Math.random() < 0.15) {
            ballOwner = Math.random() < getTeam1EdgeProbability(m) ? 'team1' : 'team2';
            const squad = ballOwner === 'team1' ? m.squad1 : m.squad2;
            const pwb = squad[Math.floor(Math.random() * squad.length)];
            highlightPlayerWithBall(ballOwner === 'team1' ? m.team1.id : m.team2.id, pwb.number);
        }
        possessionTicks[ballOwner]++;
        m.stats.possession.team1 = Math.round(possessionTicks.team1 / (possessionTicks.team1 + possessionTicks.team2) * 100);
        m.stats.possession.team2 = 100 - m.stats.possession.team1;
    }

    function handleEvent(event) {
        if (event.type === 'goal') {
            const { scorer } = applyLiveGoal(m, event.side);
            updateScoreboard(m);
            celebrateGoal(event.side);
            addMatchEvent(m, min, 'goal', `ГОЛ! #${scorer.number} ${scorer.name} (${scorer.position})`, event.team);
            ballX = 50; ballY = 50;
            ballOwner = event.side === 'team1' ? 'team2' : 'team1'; // розыгрыш с центра
            return;
        }
        addMatchEvent(m, min, event.type, EVENT_TEXTS[event.type](event), event.team);
        if (event.type === 'substitution') renderSubstitutions(m);
    }

    function endOfRegularTime() {
        if (m.legs === 2 && m.currentLeg === 1) {
            setText('match-status', '2-й матч');
            addMatchEvent(m, 90, 'half', `Конец 1-го матча: ${m.leg1.t1}:${m.leg1.t2}`, null);
            m.currentLeg = 2;
            min = 0;
            updateScoreboard(m);
            return;
        }
        stopMatchTimers();
        concludeMatch(m);
    }

    function step() {
        min++;
        if (min > 90) { endOfRegularTime(); return; }
        moveBall();
        updatePlayerPositions();
        changePossession();
        const event = generateRandomEvent(m, min);
        if (event) handleEvent(event);
        setText('match-time', min + "'");
        updateStatsDisplay(m);
    }

    onSpeedChange = () => {
        clearInterval(simulationInterval);
        simulationInterval = setInterval(step, getMatchInterval());
    };
    simulationInterval = setInterval(step, getMatchInterval());
}

// ----- Быстрый результат -----
function instantResult(m) {
    const firstLegPending = m.legs === 2 && m.currentLeg === 1;
    simulateMatchScore(m);
    const log = text => addMatchEvent(m, '', 'half', text, null);

    if (firstLegPending) {
        setText('score-1', m.leg1.t1);
        setText('score-2', m.leg1.t2);
        setText('match-time', 'FT (1-й матч)');
        log(`🎲 1-й матч: ${m.team1.name} ${m.leg1.t1}:${m.leg1.t2} ${m.team2.name}`);
        later(() => {
            log('📊 Переход ко 2-му матчу...');
            setText('match-time', "00' (2-й матч)");
            later(() => {
                updateScoreboard(m);
                setText('match-time', 'FT');
                log(`🎲 2-й матч: ${m.team1.name} ${m.leg2.t1}:${m.leg2.t2} ${m.team2.name}`);
                const agg = m.aggregateScore;
                log(`📊 Итого: ${agg.t1}:${agg.t2}`);
                later(() => concludeMatch(m), 1000);
            }, 1500);
        }, 1000);
    } else {
        updateScoreboard(m);
        setText('match-time', 'FT');
        const agg = m.aggregateScore;
        log(`🎲 ${m.team1.name} ${agg.t1}:${agg.t2} ${m.team2.name}`);
        later(() => concludeMatch(m), 1000);
    }
}

// После основного времени: либо пенальти, либо сразу итог
function concludeMatch(m) {
    if (!needsShootout(m)) { finishMatch(m, winnerByScore(m)); return; }
    const shootout = computeShootout(m);
    addMatchEvent(m, '', 'penalties', 'Серия пенальти!', null);
    setText('match-status', 'ПЕНАЛЬТИ');
    animateShootout(m, shootout, () => {
        applyShootout(m, shootout);
        finishMatch(m, shootout.winner);
    });
}

function animateShootout(m, shootout, onDone) {
    let s1 = 0, s2 = 0, i = 0;
    const next = () => {
        if (i >= shootout.kicks.length) { onDone(); return; }
        const k = shootout.kicks[i++];
        if (k.scored) { if (k.side === 'team1') s1++; else s2++; }
        const team = k.side === 'team1' ? m.team1 : m.team2;
        addMatchEvent(m, 'ПЕН', k.scored ? 'penalty-goal' : 'penalty-miss', `Удар ${k.number}: ${k.scored ? 'ГОЛ!' : 'МИМО!'}`, team);
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
    const pen = m.penalties.kicks.length ? ` (пен. ${m.penalties.t1}:${m.penalties.t2})` : '';
    const text = winner
        ? `${prefix}${winner.name} победил ${agg.t1}:${agg.t2}${pen}`
        : `${prefix}Ничья ${agg.t1}:${agg.t2}${m.stage === 'group' ? ' (по 1 очку)' : ''}`;
    addMatchEvent(m, 'FT', 'finish', text, null);
    if (isUserMatch(m) && state.userTeamEliminated) addMatchEvent(m, '', 'finish', '😔 Ваша команда выбыла из турнира', null);

    setText('match-status', 'FINISHED');
    setMatchInProgress(false);
    setVisible(['btn-close-match'], true);

    // В карьере остальные матчи этапа досчитываются автоматически
    if (isCareer()) autoSimulateAllRemainingMatches(om => !isUserMatch(om));
    saveGame();

    const btn = $('btn-next-match');
    const nextMatch = state.matches.find(x => !x.isFinished && (!isCareer() || isUserMatch(x)));
    btn.style.display = 'flex';
    if (isCareer() && state.userTeamEliminated) {
        btn.innerHTML = '<span class="btn-icon">🤖</span><span class="btn-text">Досимулировать турнир</span>';
        btn.onclick = () => showResults(autoFinishTournament());
    } else if (nextMatch && m.stage === 'group') {
        btn.innerHTML = '<span class="btn-icon">➡️</span><span class="btn-text">Следующий матч</span>';
        btn.onclick = () => openMatchScreen(nextMatch);
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

    $('match-speed').addEventListener('input', function () {
        currentMatchSpeed = parseInt(this.value);
        setText('speed-value', currentMatchSpeed + 'x');
        if (onSpeedChange) onSpeedChange();
    });
}

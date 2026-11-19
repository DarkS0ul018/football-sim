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
    stopCrowd();
}

let simStep = null;     // функция шага живого матча (для паузы)
let isPaused = false;

// Сторона команды игрока в текущем матче (только карьера)
function userSide(m) {
    if (!isUserMatch(m)) return null;
    return m.team1.id === state.userTeam.id ? 'team1' : 'team2';
}

// ----- Пауза на время повтора гола -----
// Возвращает true, если матч шёл и мы его остановили (тогда после повтора продолжаем)
function pauseForReplay() {
    if (!simStep || isPaused) return false;
    clearInterval(simulationInterval);
    isPaused = true;
    return true;
}

function resumeAfterReplay() {
    if (!simStep || $('manage-overlay').style.display === 'flex') return;
    isPaused = false;
    simulationInterval = setInterval(simStep, getMatchInterval());
}

// ----- Пауза и управление по ходу матча -----
let manageOut = null, manageIn = null;

function openManagePanel() {
    if (!simStep || !currentSim) return;
    clearInterval(simulationInterval);
    isPaused = true;
    stopCrowd();
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
        sim.newEvents = [];
        sim.setStyle(side, style);
        getSquad(s.team).style = style;
        sim.newEvents.forEach(ev => showSimEvent(sim.match, ev));
        renderLineups(sim);
        renderManagePanel();
    });
    renderChoiceButtons('manage-line', LINES, s.line, line => {
        sim.newEvents = [];
        sim.setLine(side, line);
        sim.newEvents.forEach(ev => showSimEvent(sim.match, ev));
        renderManagePanel();
    });
    const fsel = $('manage-formation');
    fsel.innerHTML = Object.keys(FORMATIONS).map(f => `<option value="${f}" ${f === s.formation ? 'selected' : ''}>${f}</option>`).join('');
    fsel.onchange = () => {
        sim.newEvents = [];
        sim.reshape(side, fsel.value, 'Новая схема');
        sim.newEvents.forEach(ev => showSimEvent(sim.match, ev));
        renderPlayers(sim);
        renderLineups(sim);
    };
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
    startCrowd();
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
    'half': '⏱️', 'tactic': '📋', 'penalties': '🎲', 'penalty-goal': '✅', 'penalty-miss': '❌', 'finish': '🏁', 'comment': '🎙️'
};

function addMatchEvent(match, minute, type, text, team = null, extraCls = '') {
    const list = $('events-list');
    const el = document.createElement('div');
    el.className = `event-item ${type} ${extraCls}`.trim();
    const timeLabel = typeof minute === 'number' ? `${minute}'` : (minute || '');
    const isTeam1 = team && team.id === match.team1.id;
    const color = team ? (isTeam1 ? 'var(--accent-primary)' : 'var(--highlight)') : 'var(--text-muted)';
    const emoji = team ? crestHtml(team, 'xs') : '•';
    el.innerHTML = `<span class="event-time">${timeLabel}</span><span class="event-icon">${EVENT_ICONS[type] || '•'}</span><span class="event-team" style="color:${color};font-weight:600">${emoji}</span><span class="event-text">${text}</span>`;
    list.prepend(el);
    while (list.children.length > 220) list.lastElementChild.remove(); // длинная лента не тормозит
}

function showSimEvent(m, ev, prefix = '') {
    addMatchEvent(m, ev.minute, ev.type, prefix + ev.text, ev.team);
}

// ----- Поле: см. js/ui/pitch.js -----


// ----- Составы -----
function renderLineups(sim) {
    const marks = ratingsMap(sim); // оценки за матч (после стартового свистка)
    let side;
    const row = (p, cls = '') => {
        const cards = p.yellow ? ' 🟨' : '';
        const mr = cls === 'bench' ? undefined : marks.get(`${side}:${p.number}`);
        const badge = mr !== undefined ? `<span class="lp-mr ${ratingClass(mr)}" title="Оценка за матч">${mr.toFixed(1)}</span>` : '';
        return `<div class="lineup-player ${cls}"><span class="lp-num">${p.number}</span><span class="lp-pos">${p.position}</span><span class="lp-name" title="${p.name}">${p.name}${cards}</span>${lineupForm(p)}<span class="lp-rating">${p.rating}</span>${badge}</div>`;
    };
    $('lineups').innerHTML = ['team1', 'team2'].map(sd => {
        side = sd;
        const s = sim.sides[side];
        const color = side === 'team1' ? 'var(--accent-primary)' : 'var(--highlight)';
        const home = sim.homeSide === side ? ' 🏠' : '';
        const tactic = `<div class="lineup-tactic">${s.formation} · ${(STYLES[s.style] || STYLES.balance).label}${s.plan ? ' · ' + s.plan : ''}</div>`;
        const off = [...s.sentOff.map(p => row({ ...p, name: p.name + ' 🟥' }, 'off')), ...s.subbedOff.map(p => row({ ...p, name: p.name + (s.injured && s.injured.has(p.number) ? ' 🚑' : ' ↩') }, 'off'))];
        return `<div>
            <div class="lineup-team-name" style="color:${color}">${teamLabel(s.team)}${home}</div>
            ${tactic}
            ${s.onPitch.map(p => row(p)).join('')}
            ${off.length ? `<div class="lineup-subtitle">Ушли с поля</div>${off.join('')}` : ''}
            <div class="lineup-subtitle">Запасные (замен ${s.subsUsed}/${MAX_SUBS})</div>
            ${s.bench.map(p => row(p, 'bench')).join('')}
            ${(s.absent || []).length ? `<div class="lineup-subtitle">Не сыграют</div>${s.absent.map(a => `<div class="lineup-player absent" title="${a.reason}"><span class="lp-num">${a.number}</span><span class="lp-pos">${a.injured ? '🚑' : '🚫'}</span><span class="lp-name">${a.name}</span><span class="lp-why">${a.reason}</span></div>`).join('')}` : ''}
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
    playSound('goal');
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
    highlights.sims.push(currentSim);
    setText('match-stage-info', legLabel(m, leg));
    renderField(currentSim);
    renderLineups(currentSim);
    renderSubstitutions(currentSim);
    updateStatsDisplay(currentSim);
    resetShotMap();
    return currentSim;
}

// ----- Открытие матча -----
function openMatchScreen(match) {
    stopMatchTimers();
    state.activeMatch = match;
    $('events-list').innerHTML = '';
    resetCommentary();
    resetHighlights();

    setText('match-team-1', match.team1.name);
    setText('match-team-2', match.team2.name);
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
    playSound('whistle-long');
    startCrowd();
    commentKickoff(m, sim);

    // Атака с ударом показывается две минуты: следующий шаг движка пропускается
    let holdTicks = 0;
    const SHOT_ENDS = ['goal', 'save', 'off', 'penalty-goal', 'penalty-miss'];

    function step() {
        if (holdTicks > 0) { holdTicks--; return; }
        const events = sim.step();
        let lineupChanged = false;
        const ms = getMatchInterval();
        const isShot = sim.play && sim.play.end && SHOT_ENDS.includes(sim.play.end.type);
        const span = isShot && !sim.isOver ? 2 : 1;
        if (span > 1) holdTicks = span - 1;

        events.forEach(ev => {
            if (ev.lineupChanged) lineupChanged = true;
            if (ev.type === 'card-red' || ev.type === 'card-yellow' || ev.type === 'half') playSound('whistle-short');
        });
        if (lineupChanged) { renderPlayers(sim); renderSubstitutions(sim); }
        if (lineupChanged || sim.minute % 5 === 0 || events.some(e => e.type === 'card-yellow' || e.type === 'tactic' || e.type === 'card-red')) renderLineups(sim); // оценки обновляются раз в 5 минут

        const plan = animateMinute(sim, events, ms, span) || {};
        // Голы показываем, когда мяч влетит в ворота
        // (обычный setTimeout: таймеры поля сбрасываются каждую минуту, а гол должен показаться обязательно)
        const goalDelay = plan.goalAt != null ? plan.goalAt + 60 : ms * span * 0.85; // +60 мс: табло меняется, когда мяч уже в сетке
        events.forEach(ev => {
            if (ev.type === 'goal') setTimeout(() => { showSimEvent(m, ev); updateScoreboard(m); celebrateGoal(ev.side); renderLineups(sim); }, goalDelay);
        });
        commentMinute(m, sim, events, plan, ms, span); // остальное в ленте — словами комментатора
        crowdIntensity(sim);
        setText('match-time', sim.minute + "'");
        if (sim.phase === 'extra') setText('match-status', 'ДОП. ВРЕМЯ');
        updateStatsDisplay(sim);
        // Точка на карте ударов и xG — когда мяч долетит (не раскрываем исход заранее)
        const mapSim = sim;
        setTimeout(() => { if (currentSim === mapSim) renderShotMap(mapSim); }, plan.finishAt != null ? plan.finishAt + 40 : 0);

        if (!sim.isOver) return;
        if (m.legs === 2 && sim.leg === 1) {
            addMatchEvent(m, 90, 'half', `Конец 1-го матча: ${m.leg1.t1}:${m.leg1.t2}`, null);
            setText('match-status', '2-й матч');
            sim = prepareLeg(m, 2);
            cm.trailed = { team1: false, team2: false };
            commentKickoff(m, sim);
            updateScoreboard(m);
            playSound('whistle-long');
            return;
        }
        stopMatchTimers();
        // Финальный свисток — когда мяч последней минуты долетит (и гол, если он был, появится на табло)
        const endDelay = Math.max(events.some(e => e.type === 'goal') ? goalDelay + 300 : 0, plan.finishAt != null ? plan.finishAt + 200 : Math.min(ms * 0.85, 1200));
        const lastSim = sim;
        setTimeout(() => {
            updateScoreboard(m);
            playSound('whistle-end');
            stopCrowd();
            commentFinal(m, lastSim);
            concludeMatch(m, lastSim, true);
        }, endDelay);
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

    buildHighlightsFromSims(legs); // голы для обзора: атаки восстанавливаются по данным движка
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
// Серия всегда показывается наглядно (js/ui/shootout.js); в карьере за свою команду углы выбирает игрок.
function concludeMatch(m, sim, live = false) {
    if (!needsShootout(m)) { finishMatch(m, winnerByScore(m)); return; }
    addMatchEvent(m, '', 'penalties', 'Серия пенальти!', null);
    setText('match-status', 'ПЕНАЛЬТИ');
    const done = result => { applyShootout(m, result); finishMatch(m, result.winner); };
    playShootout(m, sim, userSide(m), done);
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
    if (currentSim && currentSim.match === m) { renderLineups(currentSim); renderShotMap(currentSim); showManOfTheMatch(m, currentSim); }
    buildHighlightsFromSims(highlights.sims); // страховка: незаписанные голы восстанавливаются
    showHighlightsButton();
    if (isUserMatch(m) && state.userTeamEliminated && !m.cup) addMatchEvent(m, '', 'finish', '😔 Ваша команда выбыла из турнира', null);

    setText('match-status', 'FINISHED');
    setMatchInProgress(false);
    setVisible(['btn-close-match'], true);

    // В карьере остальные матчи этого тура (в плей-офф — раунда) досчитываются автоматически
    if (isCareer() && m.cup) {
        playCupAI();     // остальные матчи раунда кубка
        advanceCup();    // жеребьёвка следующего раунда (или кубок разыгран)
        cupMatchOutcome(m, winner);
    } else if (isCareer()) {
        const md = m.matchday ?? Infinity;
        autoSimulateAllRemainingMatches(om => !isUserMatch(om) && (om.matchday ?? 0) <= md);
    }
    if (state.cup) catchUpCup();
    saveGame();

    const btn = $('btn-next-match');
    const cupNext = state.cup ? userCupMatch() : null;
    const nextMatch = cupNext || state.matches.find(x => !x.isFinished && (!isCareer() || isUserMatch(x)));
    btn.style.display = 'flex';
    if (cupNext) {
        btn.innerHTML = `<span class="btn-icon">🏆</span><span class="btn-text">${cupNext.roundName}</span>`;
        btn.onclick = () => openMatch(cupNext);
    } else if (isCareer() && state.userTeamEliminated) {
        btn.innerHTML = '<span class="btn-icon">🤖</span><span class="btn-text">Досимулировать турнир</span>';
        btn.onclick = () => showResults(autoFinishTournament());
    } else if (nextMatch && (m.stage === 'group' || m.cup) && nextMatch.stage === 'group') {
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

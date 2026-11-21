// ===== ЭКРАН МАТЧА: поле, живая симуляция, быстрый результат, пенальти =====
// Вся логика игры — в MatchSimulation (js/core/engine.js). Здесь только показ.

let simulationInterval = null;
let pendingTimers = [];
let currentMatchSpeed = 5;
let onSpeedChange = null;
let currentSim = null; // симуляция игры, показанной на экране

function getMatchInterval() {
    // 1x = 1 сек на игровую минуту, 10x = 0.1 сек; в режиме «Хайлайты» спокойные минуты — 0.12 сек
    return prefs.hlMode ? HL_FAST_MS : normalMatchInterval();
}

function normalMatchInterval() {
    return Math.max(50, 1000 - (currentMatchSpeed - 1) * 100);
}

// ----- Режим «Хайлайты»: спокойная игра пролетает, опасный момент — в темпе выбранной скорости -----
const HL_FAST_MS = 120;
function hlSpan(events, isShot) {
    if (!prefs.hlMode) return 1;
    const hot = isShot || events.some(e => ['goal', 'card-red', 'card-yellow', 'penalty-miss', 'half'].includes(e.type));
    return hot ? Math.max(2, Math.round(normalMatchInterval() * (isShot ? 2 : 1) / HL_FAST_MS)) : 1;
}

function renderHlToggle() {
    const b = $('btn-hl-mode');
    if (!b) return;
    b.classList.toggle('active', !!prefs.hlMode);
    b.setAttribute('aria-pressed', String(!!prefs.hlMode));
}

function toggleHlMode() {
    setPref('hlMode', !prefs.hlMode);
    renderHlToggle();
    if (onSpeedChange) onSpeedChange();
    notify(prefs.hlMode ? '⚡ Хайлайты: спокойные минуты пролетают, моменты — в обычном темпе' : 'Обычный темп матча');
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
    if ($('btn-pause-match')) $('btn-pause-match').style.display = 'none';
    interludeOn = false;
    if ($('interlude')) $('interlude').style.display = 'none';
    pitch.livePenalty = false;
    stopCrowd();
}

let simStep = null;     // функция шага живого матча (для паузы)
let isPaused = false;

// Стороны команд людей в матче: в карьере — одна, в дерби «Вдвоём» — обе
function humanSides(m) {
    return ['team1', 'team2'].filter(s => isHuman(s === 'team1' ? m.team1 : m.team2));
}

let manageSide = null; // чьей командой управляем в панели паузы (дерби — переключается)

function userSide(m) {
    const sides = humanSides(m);
    if (!sides.length) return null;
    return sides.includes(manageSide) ? manageSide : sides[0];
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
    setPauseLabel(true);
    stopCrowd();
    manageOut = manageIn = null;
    renderManagePanel();
    $('manage-overlay').style.display = 'flex';
}

function renderManagePanel() {
    const sim = currentSim;
    const side = userSide(sim.match);
    const s = sim.sides[side];
    // Дерби «Вдвоём»: переключатель — чьей командой управляем
    const sides = humanSides(sim.match);
    const sw = $('manage-side');
    sw.style.display = sides.length > 1 ? 'flex' : 'none';
    sw.innerHTML = sides.map(sd => {
        const t = sim.sides[sd].team;
        return `<button type="button" class="manage-side-btn p${humanIndex(t) + 1} ${sd === side ? 'active' : ''}" data-side="${sd}">${humanLabel(t)}: ${t.name}</button>`;
    }).join('');
    sw.querySelectorAll('button').forEach(b => b.onclick = () => { manageSide = b.dataset.side; manageOut = manageIn = null; renderManagePanel(); });
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
            <span class="tp-name">${p.name}${p.yellow ? ' 🟨' : ''}${bestSkillTag(p)}</span>
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
    setPauseLabel(false);
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
    'half': '⏱️', 'weather': '🌤️', 'freekick': '🎯', 'tactic': '📋', 'penalties': '🎲', 'penalty-goal': '✅', 'penalty-miss': '❌', 'finish': '🏁', 'comment': '🎙️', 'stoppage': '⏱️', 'offside': '🚩', 'var': '📺'
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
    addMatchEvent(m, ev.plus ? `${ev.minute}+${ev.plus}'` : ev.minute, ev.type, prefix + ev.text, ev.team);
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
// Табло: счёт текущей игры. В паре из двух матчей во 2-й игре счёт начинается с 0:0,
// а под табло — счёт 1-го матча и сумма двух игр (обновляется с каждым голом).
function updateScoreboard(m) {
    const leg = m.legs === 2 ? (currentSim && currentSim.match === m ? currentSim.leg : m.currentLeg) : 1;
    const score = m.legs === 2 ? (leg === 1 ? m.leg1 : m.leg2) : m.aggregateScore;
    setText('score-1', score.t1);
    setText('score-2', score.t2);
    const info = $('sb-legs');
    if (!info) return;
    if (m.legs !== 2 || leg !== 2) { info.style.display = 'none'; return; }
    const agg = m.aggregateScore;
    const pens = m.penalties.kicks.length ? ` · пен. ${m.penalties.t1}:${m.penalties.t2}` : '';
    info.innerHTML = `<span>1-й матч <b>${m.leg1.t1}:${m.leg1.t2}</b></span><span class="sb-agg">Сумма <b>${agg.t1}:${agg.t2}</b>${pens}</span>`;
    info.style.display = '';
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
    setText("match-stage-info", `${legLabel(m, leg)} · ${WEATHER[currentSim.weather].icon}${currentSim.derby ? " · 🔥 " + currentSim.derby : ""}`);
    $('football-field').dataset.weather = currentSim.weather; // дождь, снег, ветер — поверх поля
    renderField(currentSim);
    renderLineups(currentSim);
    renderSubstitutions(currentSim);
    updateStatsDisplay(currentSim);
    resetShotMap();
    if ($('passmap-box')) $('passmap-box').style.display = 'none'; // сеть передач — после финального свистка
    const wx = WEATHER[currentSim.weather];
    addMatchEvent(m, '', 'weather', `${wx.icon} Погода${m.legs === 2 ? ` (${leg}-й матч)` : ''}: ${wx.label}`, null);
    setText('stats-title', 'Статистика');
    return currentSim;
}

// ----- Открытие матча -----
function openMatchScreen(match) {
    stopMatchTimers();
    state.activeMatch = match;
    $('events-list').innerHTML = '';
    resetCommentary();
    resetHighlights();
    manageSide = null;

    const tagOf = t => isDuo() && isHuman(t) ? ` <span class="duo-tag p${humanIndex(t) + 1}">${humanLabel(t)}</span>` : '';
    setHtml('match-team-1', match.team1.name + tagOf(match.team1));
    setHtml('match-team-2', match.team2.name + tagOf(match.team2));
    updateScoreboard(match);
    setText('match-time', "00'");
    setText('match-status', 'LIVE');

    prepareLeg(match, match.legs === 2 ? match.currentLeg : 1);
    setMatchInProgress(false);

    setVisible(['btn-sim-match', 'btn-instant-match'], true);
    setVisible(['btn-next-match', 'btn-close-match', 'btn-share-match'], false);
    window.confettiColors = null;
    renderMatchPreview(match, currentSim);
    showScreen('match');
}

function beginMatch(runner) {
    $('btn-press')?.remove(); $('btn-locker')?.remove();
    hideMatchPreview();
    setVisible(['btn-sim-match', 'btn-instant-match'], false);
    setMatchInProgress(true);
    runner(state.activeMatch);
}

// ----- Живая симуляция -----
function startSimulation(m) {
    let sim = currentSim;
    pitch.livePenalty = true; // пенальти — крупным планом (см. showPenaltyMoment)
    achCount('live');
    playSound('whistle-long');
    startCrowd();
    commentKickoff(m, sim);
    if (sim.derby) setTimeout(() => { if (simStep) showPitchBanner(`🔥 ${sim.derby}`); }, 600);

    // Атака с ударом показывается две минуты: следующий шаг движка пропускается
    let holdTicks = 0;
    const SHOT_ENDS = ['goal', 'save', 'off', 'wall', 'penalty-goal', 'penalty-miss'];

    function step() {
        if (holdTicks > 0) { holdTicks--; return; }
        const events = sim.step();
        let lineupChanged = false;
        const ms = getMatchInterval();
        const isShot = sim.play && sim.play.end && SHOT_ENDS.includes(sim.play.end.type);
        let span = sim.isOver ? 1 : (prefs.hlMode ? hlSpan(events, isShot) : (isShot ? 2 : 1));
        // Стандарты «подробно»: штрафной и угловой показываются дольше — успевает и расстановка, и камера
        const setPiece = sim.play && ["freekick", "corner"].includes(sim.play.kind);
        // Стандарт: время на расстановку (пауза перед подачей) + сама подача и удар
        if (!sim.isOver && setPiece && prefs.spMode !== "fast") span = Math.max(span, Math.ceil((setPieceSetupMs() / 0.85 + normalMatchInterval() * (isShot ? 2.2 : 1.5)) / ms));
        if (span > 1) holdTicks = span - 1;

        events.forEach(ev => {
            if (ev.lineupChanged) lineupChanged = true;
            if (ev.type === 'card-red' || ev.type === 'card-yellow' || ev.type === 'half') playSound('whistle-short');
            if (ev.type === 'card-red' || ev.type === 'card-yellow') later(() => { showCardAnim(ev); crowdBoo(ev.type === 'card-red' ? 1.5 : 0.7); }, ms * 0.7);
            else if (ev.type === 'foul') later(() => playSound('whistle-short'), ms * 0.6);
            if (ev.type === 'stoppage') later(() => showAddedBoard(ev.added), 80);
            if (ev.type === 'var' && ev.outcome === 'no-pen') later(() => showVarCheck('ПЕНАЛЬТИ ОТМЕНЁН'), ms * 0.5);
            if (ev.type === 'injury') later(() => showInjuryStop(ev), ms * 0.4);
            if (ev.type === 'weather' && ev.weather) {
                applyLiveWeather(ev.weather);
                setText('match-stage-info', `${legLabel(m, sim.leg)} · ${WEATHER[ev.weather].icon}${sim.derby ? ' · 🔥 ' + sim.derby : ''}`);
                showPitchBanner(`${WEATHER[ev.weather].icon} ПОГОДА МЕНЯЕТСЯ`);
            }
            if (ev.type === 'substitution') later(() => showSubBoard(ev), 50);
        });
        if (lineupChanged) { renderPlayers(sim); renderSubstitutions(sim); }
        if (!sim.isOver && sim.minute % 3 === 0) offerAnalystHint(sim);
        if (!sim.isOver && sim.minute % 5 === 0) renderPassMap(sim); // сеть передач и тепловая карта — по ходу матча
        if (lineupChanged || sim.minute % 5 === 0 || events.some(e => e.type === 'card-yellow' || e.type === 'tactic' || e.type === 'card-red')) renderLineups(sim); // оценки обновляются раз в 5 минут

        const plan = animateMinute(sim, events, ms, span) || {};
        // Трибуны поднимаются, пока мяч летит к воротам (кроме пенальти — там свой показ)
        if (isShot && plan.finishAt != null && plan.finishAt > 600 && !events.some(e => /пенальти/.test(e.text || '') || e.type === 'penalty-miss'))
            later(() => crowdRise(Math.min(1.6, plan.finishAt / 1000 * 0.45)), plan.finishAt * 0.5);
        // Голы показываем, когда мяч влетит в ворота
        // (обычный setTimeout: таймеры поля сбрасываются каждую минуту, а гол должен показаться обязательно)
        const goalDelay = plan.goalAt != null ? plan.goalAt + 60 : ms * span * 0.85; // +60 мс: табло меняется, когда мяч уже в сетке
        // Пенальти: сначала постановка на поле, затем удар крупным планом; гол — после удара
        const penEv = events.find(e => e.type === 'penalty-miss' || (e.type === 'goal' && /пенальти/.test(e.text)));
        events.forEach(ev => {
            if (ev.type === 'goal' && ev !== penEv) setTimeout(() => { showSimEvent(m, ev); updateScoreboard(m); celebrateGoal(ev.side); renderLineups(sim); }, goalDelay);
        });
        if (penEv && penEv.player) {
            holdMatch();
            const penSim = sim;
            setTimeout(() => {
                if (simStep !== step) return;
                showPenaltyMoment(m, penSim, { side: penEv.side, taker: penEv.player.name, scored: penEv.type === 'goal' }, () => {
                    if (simStep !== step) return;
                    if (!penSim.isOver) releaseMatch(); // сначала продолжаем матч, затем празднование держит его до розыгрыша с центра
                    if (penEv.type === "goal") { showSimEvent(m, penEv); updateScoreboard(m); celebrateGoal(penEv.side); renderLineups(penSim); onGoalAnimation(penSim, penEv); }
                });
            }, Math.min(1500, ms * 1.2));
        }
        // Перерыв и доп. время — заставка со счётом и статистикой
        const brk = events.find(e => e.type === 'half' && (/^Перерыв/.test(e.text) || /дополнительное время/.test(e.text)));
        if (brk && !sim.isOver) {
            const brkSim = sim;
            setTimeout(() => {
                if (simStep !== step || interludeOn) return;
                holdMatch();
                playSound('whistle-long');
                showInterlude(/^Перерыв/.test(brk.text) ? halftimeHtml(m, brkSim) : extraTimeHtml(m, brkSim), 6000, () => { pitchKickoff(true); playSound("whistle-long"); releaseMatch(); }); // второй тайм — с центра
            }, ms * span * 0.9);
        }
        commentMinute(m, sim, events, plan, ms, span); // остальное в ленте — словами комментатора
        crowdIntensity(sim);
        setText('match-time', (sim.minuteLabel ? sim.minuteLabel() : sim.minute) + "'");
        if (sim.phase === 'extra') setText('match-status', 'ДОП. ВРЕМЯ');
        updateStatsDisplay(sim);
        // Точка на карте ударов и xG — когда мяч долетит (не раскрываем исход заранее)
        const mapSim = sim;
        setTimeout(() => { if (currentSim === mapSim) renderShotMap(mapSim); }, plan.finishAt != null ? plan.finishAt + 40 : 0);

        if (!sim.isOver) return;
        if (m.legs === 2 && sim.leg === 1) {
            addMatchEvent(m, 90, 'half', `Конец 1-го матча: ${m.leg1.t1}:${m.leg1.t2}`, null);
            setText('match-status', '2-й матч');
            // Пауза между матчами пары: итог первой игры, затем — ответный матч с заставкой перед ним
            holdMatch();
            const firstSim = sim;
            playSound('whistle-end');
            setTimeout(() => {
                if (simStep !== step) return;
                showInterlude(legBreakHtml(m, firstSim), 7000, () => {
                    if (simStep !== step) return;
                    sim = prepareLeg(m, 2);
                    cm.trailed = { team1: false, team2: false };
                    commentKickoff(m, sim);
                    updateScoreboard(m);
                    renderMatchPreview(m, sim);
                    setTimeout(() => { if (simStep !== step) return; hideMatchPreview(); playSound('whistle-long'); releaseMatch(); }, Math.max(1200, Math.min(3500, getMatchInterval() * 3)));
                });
            }, 1200);
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
    $('btn-pause-match').style.display = 'flex';
    setPauseLabel(false);
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
        if (m.legs === 2 && sim.leg === 1) { sim = new MatchSimulation(m, 2); highlights.sims.push(sim); }
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
    playShootout(m, sim, humanSides(m).length > 1 ? 'both' : userSide(m), done);
}

// ----- Завершение матча -----
let lastFinishedMatch = null;

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
    if (currentSim && currentSim.match === m) {
        // Пара из двух матчей — итоги за обе игры
        const view = m.legs === 2 ? (combinedView(highlights.sims.filter(s => s.match === m)) || currentSim) : currentSim;
        updateStatsDisplay(view);
        renderSubstitutions(view);
        renderLineups(view);
        renderShotMap(view);
        renderPassMap(view);
        showManOfTheMatch(m, view);
        setText('stats-title', view.combined ? 'Статистика · сумма двух матчей' : 'Статистика');
    }
    updateScoreboard(m);
    buildHighlightsFromSims(highlights.sims); // страховка: незаписанные голы восстанавливаются
    showHighlightsButton();
    if (!m.cup) humanTeams().filter(t => m.involves(t) && isEliminated(t)).forEach(t =>
        addMatchEvent(m, '', 'finish', isDuo() ? `😔 «${t.name}» (${humanLabel(t)}) выбывает из турнира` : '😔 Ваша команда выбыла из турнира', null));

    setText('match-status', 'FINISHED');
    setMatchInProgress(false);
    setVisible(['btn-close-match', 'btn-share-match'], true);
    lastFinishedMatch = m;

    // В карьере остальные матчи этого тура (в плей-офф — раунда) досчитываются автоматически
    if (isCareer() && m.cup) {
        playCupAI();     // остальные матчи раунда кубка
        advanceCup();    // жеребьёвка следующего раунда (или кубок разыгран)
        cupMatchOutcome(m, winner);
    } else if (hasHumans()) {
        const md = m.matchday ?? Infinity;
        autoSimulateAllRemainingMatches(om => !isUserMatch(om) && (om.matchday ?? 0) <= md);
    }
    if (state.cup) catchUpCup();
    saveGame();

    const btn = $('btn-next-match');
    const cupNext = state.cup ? userCupMatch() : null;
    const nextMatch = cupNext || state.matches.find(x => !x.isFinished && (!hasHumans() || isUserMatch(x)));
    btn.style.display = 'flex';
    if (cupNext) {
        btn.innerHTML = `<span class="btn-icon">🏆</span><span class="btn-text">${cupNext.roundName}</span>`;
        btn.onclick = () => openMatch(cupNext);
    } else if (hasHumans() && state.userTeamEliminated) {
        btn.innerHTML = '<span class="btn-icon">🤖</span><span class="btn-text">Досимулировать турнир</span>';
        btn.onclick = () => showResults(autoFinishTournament());
    } else if (nextMatch) {
        // Следующий матч — сразу, хоть в группе, хоть в плей-офф
        const who = isDuo() ? humanTeams().filter(t => nextMatch.involves(t)).map(humanLabel).join(' и ') : '';
        btn.innerHTML = `<span class="btn-icon">➡️</span><span class="btn-text">Следующий матч${who ? ' · ' + who : ''}</span>`;
        btn.title = `${nextMatch.team1.name} — ${nextMatch.team2.name} · ${nextMatch.roundName}`;
        btn.onclick = () => openMatch(nextMatch);
    } else {
        // Этап доигран: дальше — жеребьёвка следующего этапа (её видно в сетке) или итоги турнира
        const toPlayoff = (state.settings.mode === 'league' && isLeagueWithPlayoff()) || state.settings.mode === 'groups';
        const isLast = !!state.settings.stageOnly || (!toPlayoff && (state.settings.mode === 'league' || state.matches.length === 1));
        btn.innerHTML = isLast ? '<span class="btn-icon">🏆</span><span class="btn-text">Итоги турнира</span>'
            : `<span class="btn-icon">➡️</span><span class="btn-text">${toPlayoff ? 'К плей-офф' : 'Следующий раунд'}</span>`;
        btn.onclick = goToNextStage;
    }
    afterMatchExtras(m, winner); // достижения и пресс-конференция (awards.js)
}

function initMatchScreen() {
    $('btn-sim-match').onclick = () => beginMatch(startSimulation);
    $('btn-instant-match').onclick = () => beginMatch(instantResult);
    $('btn-close-match').onclick = openDashboard; // «К сетке»
    $('btn-share-match').onclick = () => shareMatch(lastFinishedMatch);
    $('btn-share-tournament').onclick = shareTournament;
    document.querySelector('#screen-match .btn-back').onclick = openDashboard;
    $('btn-manage-match').onclick = openManagePanel;
    $('btn-pause-match').onclick = togglePause;
    document.addEventListener('keydown', e => { if (e.code === 'Space' && simStep && screens.match.classList.contains('active') && !e.target.closest('input, textarea, select, button')) { e.preventDefault(); togglePause(); } });
    $('btn-manage-sub').onclick = doManualSub;
    $('btn-manage-resume').onclick = resumeMatch;
    $('manage-autosubs').onchange = e => { if (currentSim) currentSim.sides[userSide(currentSim.match)].autoSubs = e.target.checked; };

    if ($('btn-hl-mode')) { $('btn-hl-mode').onclick = toggleHlMode; renderHlToggle(); }
    $('match-speed').addEventListener('input', function () {
        currentMatchSpeed = parseInt(this.value);
        setText('speed-value', currentMatchSpeed + 'x');
        if (onSpeedChange) onSpeedChange();
    });
}

// ----- Кнопка паузы: остановить и продолжить живой матч одним нажатием -----
function setPauseLabel(paused) {
    setTimeout(() => typeof updateFsBar === 'function' && updateFsBar(), 0);
    const b = $('btn-pause-match');
    if (b) b.innerHTML = paused ? '<span class="btn-icon">▶</span><span class="btn-text">Продолжить</span>' : '<span class="btn-icon">⏸</span><span class="btn-text">Пауза</span>';
}

function togglePause() {
    if (!simStep) return;
    if (interludeOn) { notify('Заставка — нажмите «Продолжить»'); return; }
    if (!isPaused) {
        clearInterval(simulationInterval);
        isPaused = true;
        stopCrowd();
    } else {
        isPaused = false;
        startCrowd();
        simulationInterval = setInterval(simStep, getMatchInterval());
    }
    setPauseLabel(isPaused);
}

// ===== Паузы-заставки внутри живого матча: перерыв, доп. время, между матчами пары, пенальти =====
let interludeOn = false;

function holdMatch() {
    clearInterval(simulationInterval);
    interludeOn = true;
}

function releaseMatch() {
    interludeOn = false;
    $('interlude').style.display = 'none';
    if (simStep && !isPaused) simulationInterval = setInterval(simStep, getMatchInterval());
}

// Заставка поверх поля; продолжение — кнопкой или само через autoMs (быстрее на высокой скорости)
function showInterlude(html, autoMs, onDone) {
    const el = $('interlude');
    const wait = Math.round(autoMs * Math.max(0.35, Math.min(1, getMatchInterval() / 800)));
    el.innerHTML = `<div class="il-card">${html}<button type="button" class="btn-primary il-go">▶ Продолжить <small class="il-timer"></small></button></div>`;
    el.style.display = 'flex';
    let left = Math.ceil(wait / 1000), done = false;
    const tick = setInterval(() => { left--; const t = el.querySelector('.il-timer'); if (t) t.textContent = left > 0 ? `(${left})` : ''; }, 1000);
    const finish = () => { if (done) return; done = true; clearInterval(tick); clearTimeout(auto); el.style.display = 'none'; onDone(); };
    const auto = setTimeout(finish, wait);
    el.querySelector('.il-timer').textContent = `(${left})`;
    el.querySelector('.il-go').onclick = finish;
}

function goalsListHtml(sim) {
    const goals = sim.events.filter(e => e.type === 'goal');
    if (!goals.length) return '<div class="il-goals muted">Без голов</div>';
    const row = side => goals.filter(g => g.side === side).map(g => `<div>⚽ ${escapeHtml(shortName(g.player ? g.player.name : ''))} ${g.minute}'</div>`).join('');
    return `<div class="il-goals"><div>${row('team1')}</div><div class="right">${row('team2')}</div></div>`;
}

function statsLineHtml(sim) {
    const s = sim.stats;
    const line = (label, a, b) => `<div class="il-stat"><b>${a}</b><span>${label}</span><b>${b}</b></div>`;
    return `<div class="il-stats">${line('Владение', s.possession.team1 + '%', s.possession.team2 + '%')}${line('Удары (в створ)', `${s.shots.team1} (${s.shotsOnTarget.team1})`, `${s.shots.team2} (${s.shotsOnTarget.team2})`)}${line('xG', s.xg.team1.toFixed(2), s.xg.team2.toFixed(2))}</div>`;
}

function scoreHeadHtml(m, t1, t2, note = '') {
    return `<div class="il-score">${crestHtml(m.team1, 'lg')}<div><b>${t1} : ${t2}</b>${note ? `<small>${note}</small>` : ''}</div>${crestHtml(m.team2, 'lg')}</div>
        <div class="il-names"><span>${escapeHtml(m.team1.name)}</span><span>${escapeHtml(m.team2.name)}</span></div>`;
}

function halftimeHtml(m, sim) {
    return `<div class="il-kicker">Перерыв</div>${scoreHeadHtml(m, sim.score.t1, sim.score.t2, "1-й тайм")}${goalsListHtml(sim)}${statsLineHtml(sim)}${halftimeMapsHtml(sim)}`;
}

function extraTimeHtml(m, sim) {
    return `<div class="il-kicker">Дополнительное время</div>${scoreHeadHtml(m, m.aggregateScore.t1, m.aggregateScore.t2, 'ничья после 90 минут')}
        <div class="il-text">Два тайма по 15 минут. Если ничья сохранится — серия пенальти.</div>`;
}

function legBreakHtml(m, sim) {
    const home2 = m.team2;
    return `<div class="il-kicker">1-й матч завершён</div>${scoreHeadHtml(m, m.leg1.t1, m.leg1.t2, 'первая игра')}${goalsListHtml(sim)}
        <div class="il-text">Ответный матч — на поле «${escapeHtml(home2.name)}». По сумме двух игр: ${m.leg1.t1}:${m.leg1.t2}.</div>`;
}

// Празднование гола: живой матч ждёт, пока игроки радуются (пауза пользователя и заставки важнее)
let celebrating = false;
function holdForCelebration(ms) {
    if (!simStep || interludeOn || celebrating) return;
    celebrating = true;
    clearInterval(simulationInterval);
    setTimeout(() => {
        celebrating = false;
        if (simStep && !isPaused && !interludeOn) {
            clearInterval(simulationInterval);
            simulationInterval = setInterval(simStep, getMatchInterval());
        }
    }, ms);
}

// ----- Аналитик на скамейке: подсказка по ходу матча -----
// Карточка над полем: «Применить» меняет тактику; если совет точный — 15 минут команда играет заметно лучше.
let analystCard = null;
function offerAnalystHint(sim) {
    const side = userSide(sim.match);
    if (analystCard && (!analystCard.isConnected || analystCard._sim !== sim)) { analystCard.remove(); analystCard = null; }
    if (!side || analystCard) return;
    const s = sim.sides[side];
    if (s.lastHintMinute != null && sim.minute - s.lastHintMinute < 10) return;
    const hint = sim.analystHint(side);
    if (!hint) return;
    s.lastHintMinute = sim.minute;
    const host = $('field-hud') || $('football-field');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'analyst-card';
    el.innerHTML = `<div class="an-head">📊 Аналитик <span class="muted">${sim.minute}'</span></div>
        <div class="an-text">${escapeHtml(hint.text)}</div>
        <div class="an-actions"><button type="button" class="an-apply">Применить</button><button type="button" class="an-skip">Не сейчас</button></div>`;
    host.appendChild(el);
    analystCard = el;
    el._sim = sim;
    const close = () => { if (analystCard === el) analystCard = null; el.classList.add('out'); setTimeout(() => el.remove(), 300); };
    const timer = setTimeout(() => { sim.dismissHint(side, hint); close(); }, Math.max(9000, getMatchInterval() * 8));
    el.querySelector('.an-apply').onclick = () => {
        clearTimeout(timer);
        if (currentSim !== sim || sim.isOver) { close(); return; }
        sim.newEvents = [];
        sim.applyAdvice(side, hint);
        achCount('hints');
        if (hint.apply.style) getSquad(s.team).style = hint.apply.style;
        sim.newEvents.forEach(ev => showSimEvent(sim.match, ev));
        renderLineups(sim);
        el.querySelector('.an-text').textContent = '✓ Команда перестроилась — 15 минут ждём эффекта.';
        el.querySelector('.an-actions').remove();
        el.classList.add('applied');
        setTimeout(close, 2600);
    };
    el.querySelector('.an-skip').onclick = () => { clearTimeout(timer); sim.dismissHint(side, hint); close(); };
}

// ----- Поле на весь экран: настоящий полноэкранный режим, а где его нет (iPhone) — растягиваем поле поверх страницы -----
function fieldBox() { return document.querySelector('#screen-match .field-container'); }
function isFieldFullscreen() {
    const box = fieldBox();
    return !!box && (document.fullscreenElement === box || document.webkitFullscreenElement === box || box.classList.contains('pseudo-fs'));
}

function enterFieldFullscreen() {
    const box = fieldBox();
    if (!box) return;
    const req = box.requestFullscreen || box.webkitRequestFullscreen;
    const pseudo = () => { box.classList.add('pseudo-fs'); document.body.classList.add('fs-lock'); updateFsBar(); };
    if (req) {
        try {
            const p = req.call(box, { navigationUI: 'hide' });
            if (p && p.then) p.then(() => { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* ignore */ } updateFsBar(); }).catch(pseudo);
        } catch (e) { pseudo(); }
    } else pseudo();
}

function exitFieldFullscreen() {
    const box = fieldBox();
    if (box) box.classList.remove('pseudo-fs');
    document.body.classList.remove('fs-lock');
    try { screen.orientation?.unlock?.(); } catch (e) { /* ignore */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
    updateFsBar();
}

function toggleFieldFullscreen() { isFieldFullscreen() ? exitFieldFullscreen() : enterFieldFullscreen(); }

function updateFsBar() {
    const on = isFieldFullscreen();
    fieldBox()?.classList.toggle('fs-on', on);
    const b = $('btn-fullscreen');
    if (b) { b.textContent = on ? '✕' : '⛶'; b.title = on ? 'Выйти из полноэкранного режима' : 'Поле на весь экран (клавиша F)'; }
    setText('fs-speed', `${currentMatchSpeed}x`);
    const pb = document.querySelector('#fs-bar [data-fs="pause"]');
    if (pb) pb.textContent = isPaused ? '▶' : '⏸';
}

(function initFieldFullscreen() {
    $('btn-fullscreen')?.addEventListener('click', toggleFieldFullscreen);
    document.addEventListener('fullscreenchange', updateFsBar);
    document.addEventListener('webkitfullscreenchange', updateFsBar);
    $('fs-bar')?.addEventListener('click', e => {
        const b = e.target.closest('[data-fs]');
        if (!b) return;
        const sp = $('match-speed');
        if (b.dataset.fs === 'exit') exitFieldFullscreen();
        else if (b.dataset.fs === 'pause') togglePause();
        else if (sp) { sp.value = Math.max(1, Math.min(10, Number(sp.value) + (b.dataset.fs === 'faster' ? 1 : -1))); sp.dispatchEvent(new Event('input')); }
        updateFsBar();
    });
    document.addEventListener('keydown', e => {
        if ((e.key === 'f' || e.key === 'а' || e.key === 'F' || e.key === 'А') && !e.ctrlKey && !e.metaKey && !e.altKey
            && !(e.target.closest && e.target.closest('input, textarea, select')) && screens.match.classList.contains('active')) toggleFieldFullscreen();
        if (e.key === 'Escape' && fieldBox()?.classList.contains('pseudo-fs')) exitFieldFullscreen();
    });
})();

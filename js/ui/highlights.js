// ===== ОБЗОР ГОЛОВ: все голы матча подряд, как в телепрограмме =====
// Во время живого матча каждая голевая атака записывается покадрово (pitch.js → recordHighlight).
// Для «Быстрого результата» атака восстанавливается по данным движка: цепочка передач, точка удара.

const highlights = { goals: [], sims: [] }; // sims — игры этого матча (для двухматчевых пар их две)
let reel = null;

function resetHighlights() {
    stopHighlights();
    highlights.goals = [];
    highlights.sims = [];
    const btn = $('btn-highlights');
    if (btn) btn.style.display = 'none';
}

function recordHighlight(sim, ev, frames) {
    if (highlights.goals.some(g => g.ev === ev)) return;
    highlights.goals.push({ ev, frames, leg: sim.leg, score: { t1: sim.score.t1, t2: sim.score.t2 } });
}

function showHighlightsButton() {
    const btn = $('btn-highlights');
    if (!btn) return;
    btn.style.display = highlights.goals.length ? '' : 'none';
    btn.querySelector('.btn-text').textContent = `🎬 Обзор голов (${highlights.goals.length})`;
}

// ----- Восстановление атаки по данным движка (для быстрого результата) -----
function synthGoalFrames(sim, ev) {
    const side = ev.side, opp = otherSide(side);
    const shot = sim.shotLog.find(s => s.side === side && s.minute === ev.minute && ev.player && s.player === ev.player.number && /goal/.test(s.result))
        || { r: 88, y: 50 };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const mine = sim.sides[side].onPitch, theirs = sim.sides[opp].onPitch;
    const byNum = n => mine.find(p => p.number === n) || null;
    const scorer = ev.player ? byNum(ev.player.number) : null;
    const assister = ev.assister ? byNum(ev.assister.number) : null;
    const pick = pos => { const list = mine.filter(p => p.position === pos && p !== scorer && p !== assister); return list[Math.floor(Math.random() * list.length)] || null; };

    // Точки мяча (в координатах «от своих ворот») и кто с мячом
    const steps = shot.penalty
        ? [{ r: 89.5, y: 50, who: scorer }]
        : [
            { r: rnd(30, 42), y: rnd(25, 75), who: pick('DEF') },
            { r: rnd(52, 64), y: rnd(20, 80), who: pick('MID') },
            assister ? { r: rnd(74, 84), y: shot.y < 50 ? rnd(62, 85) : rnd(15, 38), who: assister } : null,
            { r: shot.r, y: shot.y, who: scorer }
        ].filter(Boolean);
    steps.push({ r: 99.6, y: rnd(46, 54), who: null, goal: true });

    const frameAt = st => {
        const ballR = Math.min(st.r, 97);
        const players = [];
        // Атакующие поднимаются за мячом, обороняющиеся отходят к своим воротам
        mine.forEach(p => {
            let r = rel(side, p.baseX), y = p.baseY;
            if (p.position !== 'GK') { r = Math.max(4, Math.min(93, r + (ballR - 45) * 0.55)); y = y * 0.8 + st.y * 0.2; }
            if (p === st.who) { r = st.r; y = st.y; }
            players.push(clipPlayer(p, abs(side, r), y));
        });
        theirs.forEach(p => {
            let r = rel(opp, p.baseX), y = p.baseY;
            if (p.position !== 'GK') { r = Math.max(4, Math.min(60, r * 0.55 + (100 - ballR) * 0.3)); y = y * 0.65 + st.y * 0.35; }
            players.push(clipPlayer(p, abs(opp, r), y));
        });
        return { ball: { x: abs(side, st.r), y: st.y }, holder: st.who ? { teamId: st.who.teamId, number: st.who.number } : null, players };
    };
    // Стартовый кадр — розыгрыш в глубине
    return [frameAt({ r: steps[0].r - 8, y: steps[0].y, who: steps[0].who }), ...steps.map(frameAt)];
}

// Для быстрого результата: восстановить голы, которых нет в записи
function buildHighlightsFromSims(sims) {
    sims.forEach(sim => {
        let t1 = 0, t2 = 0;
        sim.events.filter(e => e.type === 'goal').forEach(ev => {
            if (ev.side === 'team1') t1++; else t2++;
            if (highlights.goals.some(g => g.ev === ev)) return;
            highlights.goals.push({ ev, frames: synthGoalFrames(sim, ev), leg: sim.leg, score: { t1, t2 }, synthetic: true });
        });
    });
    highlights.goals.sort((a, b) => (a.leg - b.leg) || (a.ev.minute - b.ev.minute));
}

// Игрок в кадре повтора: где стоит и кто это (чтобы показать его, даже если сейчас его нет на поле)
function clipPlayer(p, x, y) {
    return { id: playerElId(p), x, y, s: p.side, n: p.number, nm: p.name.split(' ').slice(-1)[0], gk: p.position === 'GK' };
}

// Игроки эпизода, которых сейчас нет на поле (заменены, другой матч пары) — временные фигурки
function addTempPlayers(frame) {
    const field = $('football-field');
    frame.players.forEach(p => {
        if ($(p.id) || !p.s) return;
        const el = document.createElement('div');
        el.className = `player ${p.s} ${p.gk ? 'goalkeeper' : ''} reel-temp`;
        el.id = p.id;
        el.style.cssText = `left:${p.x}%;top:${p.y}%;transition:none`;
        el.innerHTML = `<span class="player-num">${p.n}</span><span class="player-name">${p.nm}</span>`;
        field.appendChild(el);
    });
}

function removeTempPlayers() {
    document.querySelectorAll('#football-field .reel-temp').forEach(el => el.remove());
}

// ----- Проигрывание одного эпизода (общая часть с «повтором гола») -----
// Возвращает функцию отмены
function playClip(g, seg, onDone) {
    const timers = [];
    const later2 = (fn, ms) => timers.push(setTimeout(fn, ms));
    const field = $('football-field');
    removeTempPlayers();
    addTempPlayers(g.frames[0]);
    const ids = new Set(g.frames[0].players.map(p => p.id));
    // Игроков, которых не было на поле в момент гола (вышли позже), прячем
    field.querySelectorAll('.player').forEach(el => el.classList.toggle('reel-hidden', !ids.has(el.id)));

    const applyFrame = (fr, ms) => {
        fr.players.forEach(p => { const el = $(p.id); if (el) { setTransition(el, ms); el.style.left = `${p.x}%`; el.style.top = `${p.y}%`; } });
        placeBall(fr.ball.x, fr.ball.y, ms);
        highlightPlayer(fr.holder);
    };
    applyFrame(g.frames[0], 0);
    g.frames.slice(1).forEach((fr, i) => later2(() => { applyFrame(fr, seg); playSound('kick'); }, 300 + seg * i));
    const end = 300 + seg * (g.frames.length - 1);
    later2(() => {
        const goalEl = field.querySelector(g.ev.side === 'team1' ? '.goal-right' : '.goal-left');
        goalEl?.classList.add('net-shake');
        playSound('goal');
        later2(() => goalEl?.classList.remove('net-shake'), 700);
    }, end);
    later2(() => onDone && onDone(), end + 900);
    return () => timers.forEach(clearTimeout);
}

// ----- Обзор -----
function playHighlights() {
    if (!highlights.goals.length || reel || (typeof replayRunning !== 'undefined' && replayRunning)) return;
    const field = $('football-field');
    const m = state.activeMatch;
    pitch.frozen = true;
    field.classList.add('reeling');
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const bar = document.createElement('div');
    bar.className = 'reel-bar';
    bar.innerHTML = `<span class="reel-live">ОБЗОР</span><span class="reel-count"></span>
        <button type="button" class="reel-btn" data-act="next" title="Следующий гол">⏭</button>
        <button type="button" class="reel-btn" data-act="close" title="Закрыть">✕</button>`;
    field.appendChild(bar);
    const card = document.createElement('div');
    card.className = 'reel-card';
    field.appendChild(card);
    bar.querySelector('[data-act="next"]').onclick = () => { reel.cancel && reel.cancel(); reel.timers.forEach(clearTimeout); showGoal(reel.i + 1); };
    bar.querySelector('[data-act="close"]').onclick = stopHighlights;

    reel = { i: 0, cancel: null, timers: [], bar, card, ball: { ...pitch.ball } };
    const total = highlights.goals.length;

    function showGoal(i) {
        reel.i = i;
        reel.cancel = null;
        if (i >= total) { finalCard(); return; }
        const g = highlights.goals[i];
        const ev = g.ev;
        bar.querySelector('.reel-count').textContent = `${i + 1} / ${total}`;
        const pen = ev.text && ev.text.includes('пенальти') ? ' (пен.)' : '';
        const legNote = m && m.legs === 2 ? `<small>${g.leg}-й матч</small>` : '';
        card.innerHTML = `
            <div class="rc-min">${ev.minute}'</div>
            <div class="rc-goal">ГОЛ</div>
            <div class="rc-scorer">${crestHtml(ev.team, 'sm')} ${ev.player ? ev.player.name : ''}${pen}</div>
            ${ev.assister ? `<div class="rc-assist">${assistLabel(ev.setPiece)}: ${ev.assister.name}</div>` : ''}
            <div class="rc-score">${m ? m.team1.name : ''} <b>${g.score.t1}:${g.score.t2}</b> ${m ? m.team2.name : ''}</div>${legNote}`;
        card.classList.remove('show');
        void card.offsetWidth;
        card.classList.add('show');
        reel.timers.push(setTimeout(() => {
            card.classList.remove('show');
            reel.cancel = playClip(g, 620, () => showGoal(i + 1));
        }, 1700));
    }

    function finalCard() {
        const agg = m ? m.aggregateScore : null;
        bar.querySelector('.reel-count').textContent = 'Итог';
        card.innerHTML = m ? `<div class="rc-goal">ФИНАЛЬНЫЙ СЧЁТ</div>
            <div class="rc-score big">${crestHtml(m.team1, 'sm')} ${m.team1.name} <b>${agg.t1}:${agg.t2}</b> ${m.team2.name} ${crestHtml(m.team2, 'sm')}</div>` : '';
        card.classList.remove('show');
        void card.offsetWidth;
        card.classList.add('show');
        reel.timers.push(setTimeout(stopHighlights, 2600));
    }

    showGoal(0);
}

function stopHighlights() {
    if (!reel) return;
    reel.cancel && reel.cancel();
    reel.timers.forEach(clearTimeout);
    reel.bar.remove();
    reel.card.remove();
    const ball = reel.ball;
    reel = null;
    const field = $('football-field');
    field.classList.remove('reeling');
    removeTempPlayers();
    field.querySelectorAll('.player').forEach(el => { el.classList.remove('reel-hidden'); setTransition(el, 0); });
    placeBall(ball.x, ball.y, 0);
    highlightPlayer(null);
    pitch.frozen = false;
}

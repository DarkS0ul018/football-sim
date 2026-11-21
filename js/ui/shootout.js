// ===== СЕРИЯ ПЕНАЛЬТИ: наглядный показ =====
// Ворота, вратарь, мяч и бьющий. Каждый удар анимируется: мяч летит в выбранный угол, вратарь прыгает.
// userSide = 'team1' | 'team2' — игрок сам выбирает углы за свою команду; null — серия идёт сама.

const SO_GEOMETRY = {
    zoneX: { left: 26, center: 50, right: 74 },   // центры зон ворот, % ширины сцены
    postX: { left: 15, center: 50, right: 85 },   // штанги / перекладина
    netY: 44,       // куда влетает мяч, px от верха сцены
    barY: 14,       // перекладина
    spotY: 196      // точка пенальти
};

let shootoutRun = null; // текущая серия (для кнопки «Пропустить»)

function soEl(id) { return document.getElementById(id); }

function soSetBall(x, y, ms) {
    const ball = soEl('so-ball');
    ball.style.transition = ms ? `left ${ms}ms cubic-bezier(.25,.6,.3,1), top ${ms}ms cubic-bezier(.25,.6,.3,1)` : 'none';
    ball.style.left = `${x}%`;
    ball.style.top = `${y}px`;
}

function soSetKeeper(dir, ms) {
    const k = soEl('so-keeper');
    k.style.transition = ms ? `transform ${ms}ms ease-out` : 'none';
    k.style.transform = {
        none: 'translateX(-50%)',
        left: 'translateX(calc(-50% - 78px)) translateY(-14px) rotate(-62deg)',
        right: 'translateX(calc(-50% + 78px)) translateY(-14px) rotate(62deg)',
        center: 'translateX(-50%) translateY(-22px)'
    }[dir];
}

function soFlash(text, cls) {
    const f = soEl('so-flash');
    f.textContent = text;
    f.className = `so-flash show ${cls}`;
}

function soRenderScore(so, m) {
    setText('so-total', `${so.s.team1} : ${so.s.team2}`);
    ['team1', 'team2'].forEach((side, i) => {
        const kicks = so.kicks.filter(k => k.side === side);
        const left = Math.max(0, 5 - kicks.length);
        soEl(`so-kicks${i + 1}`).innerHTML =
            kicks.map(k => `<span class="so-dot ${k.scored ? 'goal' : 'miss'}" title="${k.player}">${k.scored ? '✓' : '✕'}</span>`).join('') +
            '<span class="so-dot empty"></span>'.repeat(left);
    });
    setText('match-time', `ПЕН ${so.s.team1}:${so.s.team2}`);
}

// Подготовка сцены к удару: кто бьёт, кто в воротах
function soPrepareKick(so, m, kits) {
    const side = so.nextSide();
    const team = side === 'team1' ? m.team1 : m.team2;
    const taker = so.nextTaker();
    const keeper = so.nextKeeper();
    const gk = side === 'team1' ? kits.gk2 : kits.gk1;
    soEl('so-keeper').style.setProperty('--gk', gk.primary);
    setText('so-keeper-name', keeper.name || 'вратарь');
    soEl('so-taker').innerHTML = `${crestHtml(team, 'sm')}<span><small>Бьёт · удар ${so.n[side] + 1}</small><b>${taker.name}</b></span>`;
    soEl('so-flash').className = 'so-flash';
    soEl('so-flash').textContent = '';
    soEl('so-goal').classList.remove('net-hit');
    soSetKeeper('none', 0);
    soSetBall(50, SO_GEOMETRY.spotY, 0);
    return { side, team, taker, keeper };
}

// Анимация удара. Возвращает Promise, который завершается после показа результата.
// Координаты зон считаются по реальному размеру ворот (на телефоне ворота шире)
function soGeometry() {
    const goal = soEl('so-goal'), scene = goal.parentElement;
    const W = scene.clientWidth || 1;
    const l = goal.offsetLeft / W * 100, w = goal.offsetWidth / W * 100;
    return {
        ...SO_GEOMETRY,
        zoneX: { left: l + w / 6, center: l + w / 2, right: l + w * 5 / 6 },
        postX: { left: l + 1, center: l + w / 2, right: l + w - 1 }
    };
}

function soAnimateKick(kick, speed = 1) {
    const g = soGeometry();
    const t = ms => Math.round(ms * speed);
    return new Promise(resolve => {
        playSound('kick');
        soSetKeeper(kick.diveDir, t(420));
        let x = g.zoneX[kick.shotDir], y = g.netY;
        let result;
        if (kick.scored) { result = ['ГОЛ!', 'goal']; }
        else if (kick.note === 'мимо ворот') { y = -24; result = ['МИМО!', 'miss']; }
        else if (kick.shotDir === kick.diveDir) { y = 70; result = ['СЕЙВ!', 'save']; }
        else {
            if (kick.shotDir === 'center') y = g.barY; else x = g.postX[kick.shotDir];
            result = [kick.shotDir === 'center' ? 'ПЕРЕКЛАДИНА!' : 'ШТАНГА!', 'miss'];
        }
        soSetBall(x, y, t(430));
        setTimeout(() => {
            if (kick.scored) soEl('so-goal').classList.add('net-hit');
            else soSetBall(x + (x < 50 ? -8 : 8), 150, t(380)); // отскок
            soFlash(...result);
            playSound(kick.scored ? 'pen-goal' : 'save');
            setTimeout(resolve, t(650));
        }, t(450));
    });
}

function soLogKick(m, kick) {
    const team = kick.side === 'team1' ? m.team1 : m.team2;
    addMatchEvent(m, 'ПЕН', kick.scored ? 'penalty-goal' : 'penalty-miss',
        `${kick.player}: ${KICK_DIR_LABELS[kick.shotDir]} — ${kick.scored ? 'ГОЛ' : 'не забил'} (${kick.note})`, team);
}

function playShootout(m, sim, userSide, onDone) {
    const so = new Shootout(m, sim);
    const kits = getMatchKits(m);
    const overlay = soEl('shootout-overlay');
    const zones = [...overlay.querySelectorAll('.so-zone')];
    const contBtn = soEl('btn-so-continue');
    const skipBtn = soEl('btn-so-skip');
    const run = { cancelled: false };
    shootoutRun = run;

    setHtml('so-team1', teamLabel(m.team1));
    setHtml('so-team2', teamLabel(m.team2));
    setText('so-last', '');
    setText('so-prompt', '');
    overlay.classList.toggle('interactive', !!userSide);
    overlay.style.display = 'flex';
    soRenderScore(so, m);

    const finish = () => {
        run.cancelled = true;
        overlay.style.display = 'none';
        zones.forEach(z => { z.onclick = null; z.classList.remove('pickable'); });
        shootoutRun = null;
        onDone(so.result());
    };

    const showEnd = () => {
        skipBtn.style.display = 'none';
        const winner = so.winner;
        setHtml('so-prompt', `🏆 Серию выигрывает ${teamLabel(winner)} — ${so.s.team1}:${so.s.team2}`);
        contBtn.style.display = 'block';
        contBtn.onclick = finish;
        if (!userSide) setTimeout(() => { if (!run.cancelled && overlay.style.display !== 'none') finish(); }, 2500);
    };

    // «Пропустить»: добиваем серию мгновенно
    skipBtn.style.display = userSide ? 'none' : '';
    skipBtn.onclick = () => {
        run.cancelled = true;
        while (!so.isOver) soLogKick(m, so.kick());
        soRenderScore(so, m);
        finish();
    };

    const afterKick = async (kick) => {
        soLogKick(m, kick);
        await soAnimateKick(kick, userSide ? 1 : 0.9);
        if (run.cancelled) return;
        soRenderScore(so, m);
        setText('so-last', `${kick.player}: ${KICK_DIR_LABELS[kick.shotDir]}, вратарь — ${KICK_DIR_LABELS[kick.diveDir]} (${kick.note})`);
        if (so.isOver) { showEnd(); return; }
        if (userSide) {
            contBtn.style.display = 'block';
            contBtn.onclick = () => { contBtn.style.display = 'none'; next(); };
        } else {
            setTimeout(() => { if (!run.cancelled) next(); }, 500);
        }
    };

    const next = () => {
        if (run.cancelled) return;
        contBtn.style.display = 'none';
        const { side, taker, keeper } = soPrepareKick(so, m, kits);
        if (userSide === 'both') {
            // Дерби «Вдвоём»: сначала бьющий (втайне) выбирает угол, затем вратарь соперника — прыжок
            const shooterTeam = side === 'team1' ? m.team1 : m.team2;
            const keeperTeam = side === 'team1' ? m.team2 : m.team1;
            const pickZone = (prompt, onPick) => {
                setText('so-prompt', prompt);
                zones.forEach(z => {
                    z.classList.add('pickable');
                    z.onclick = () => { zones.forEach(x => { x.onclick = null; x.classList.remove('pickable'); }); onPick(z.dataset.dir); };
                });
            };
            pickZone(`⚽ ${humanLabel(shooterTeam)} (${shooterTeam.name}): бьёт ${taker.name}. Выберите угол — сопернику не смотреть!`, shotDir => {
                pickZone(`🧤 ${humanLabel(keeperTeam)} (${keeperTeam.name}): куда прыгнет ${keeper.name}?`, diveDir => afterKick(so.kick(shotDir, diveDir)));
            });
            return;
        }
        if (userSide) {
            const mine = side === userSide;
            setText('so-prompt', mine
                ? `⚽ Ваш удар: ${taker.name}. Выберите угол ворот`
                : `🧤 Бьёт ${taker.name}. Куда прыгнет ваш вратарь ${keeper.name}?`);
            zones.forEach(z => {
                z.classList.add('pickable');
                z.onclick = () => {
                    zones.forEach(x => { x.onclick = null; x.classList.remove('pickable'); });
                    const dir = z.dataset.dir;
                    afterKick(mine ? so.kick(dir, randomDiveDir()) : so.kick(randomShotDir(), dir));
                };
            });
        } else {
            setText('so-prompt', '');
            setTimeout(() => { if (!run.cancelled) afterKick(so.kick()); }, 650);
        }
    };
    next();
}

// ===== Пенальти по ходу матча — крупным планом, как в серии =====
// Исход уже решён движком; показываем удар: куда бьёт, куда прыгает вратарь.
function showPenaltyMoment(m, sim, info, onDone) {
    const overlay = soEl('shootout-overlay');
    const kits = getMatchKits(m);
    const side = info.side;
    const team = side === 'team1' ? m.team1 : m.team2;
    const gkSide = side === 'team1' ? 'team2' : 'team1';
    const keeper = sim.sides[gkSide].onPitch.find(p => p.position === 'GK') || { name: 'вратарь' };
    const head = overlay.querySelector('.so-header h2');
    const hidden = ['.shootout-score', '#btn-so-skip', '#btn-so-continue', '#so-prompt'].map(s => overlay.querySelector(s)).filter(Boolean);
    const prev = hidden.map(el => el.style.display);
    hidden.forEach(el => { el.style.display = 'none'; });
    head.textContent = `Пенальти · ${sim.minute}'`;
    soEl('so-keeper').style.setProperty('--gk', (kits[gkSide] || {}).primary || '#ffcc00');
    setText('so-keeper-name', keeper.name);
    soEl('so-taker').innerHTML = `${crestHtml(team, 'sm')}<span><small>Бьёт</small><b>${info.taker}</b></span>`;
    soEl('so-flash').className = 'so-flash';
    soEl('so-flash').textContent = '';
    soEl('so-goal').classList.remove('net-hit');
    setText('so-last', '');
    soSetKeeper('none', 0);
    soSetBall(50, SO_GEOMETRY.spotY, 0);
    overlay.classList.remove('interactive');
    overlay.style.display = 'flex';
    const dirs = ['left', 'center', 'right'];
    const pick = () => dirs[Math.floor(Math.random() * 3)];
    const shotDir = Math.random() < 0.15 ? 'center' : (Math.random() < 0.5 ? 'left' : 'right');
    let diveDir = pick(), note = '';
    if (info.scored) { while (diveDir === shotDir && Math.random() < 0.85) diveDir = pick(); note = 'гол'; }
    else if (Math.random() < 0.6) { diveDir = shotDir; note = 'вратарь угадал'; }
    else { while (diveDir === shotDir) diveDir = pick(); note = Math.random() < 0.5 ? 'мимо ворот' : 'штанга'; }
    setTimeout(async () => {
        await soAnimateKick({ side, shotDir, diveDir, scored: info.scored, note });
        setText('so-last', `${info.taker}: ${KICK_DIR_LABELS[shotDir]}, вратарь — ${KICK_DIR_LABELS[diveDir]}`);
        setTimeout(() => {
            overlay.style.display = 'none';
            head.textContent = 'Серия пенальти';
            hidden.forEach((el, i) => { el.style.display = prev[i]; });
            onDone();
        }, 900);
    }, 700);
}

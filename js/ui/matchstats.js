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
            <div class="motm-label">Лучший игрок матча${m.legs === 2 ? ' (2-я игра)' : ''}</div>
            <div class="motm-name">${best.name}</div>
            <div class="motm-meta">${crestHtml(team, 'xs')} ${team.name} · ${best.position}${facts.length ? ' · ' + facts.join(', ') : ''}</div>
        </div>
        <div class="motm-rating ${ratingClass(best.rating)}">${best.rating.toFixed(1)}</div>`;
    box.style.display = 'flex';
    addMatchEvent(m, '', 'comment', `⭐ Лучший игрок матча — ${best.name} (${best.rating.toFixed(1)})`, team, 'c-goal');
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

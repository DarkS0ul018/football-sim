// ===== АНИМАЦИИ: каскадное появление, табло, интро матча, праздник чемпиона =====
// Модуль подключается последним и «оборачивает» существующие функции интерфейса,
// не меняя их логику. При настройке «уменьшить движение» эффекты не запускаются.

const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Что появляется каскадом на каждом экране
const RISE_SELECTOR = [
    '.card', '.team-select-card', '.table-container', '.bracket-round', '.match-result', '#matches-list > .btn-secondary',
    '.award-card', '.achievement-card', '.team-list-item', '.tr-row', '.tr-stat', '.tactics-player', '.editor-team',
    '.scoreboard-v2', '.field-container', '.match-stats-container', '.lineups-container', '.match-events-container',
    '.top-scorers-section', '.champion-box-v2', '.hall-card', '.resume-card'
].join(',');

function animateScreenIn(screen) {
    if (reduceMotion || !screen) return;
    const items = [...screen.querySelectorAll(RISE_SELECTOR)].filter(el => el.offsetParent !== null).slice(0, 48);
    items.forEach((el, i) => {
        el.classList.remove('rise');
        void el.offsetWidth; // перезапуск анимации
        el.style.setProperty('--i', Math.min(i, 18));
        el.classList.add('rise');
        el.addEventListener('animationend', () => el.classList.remove('rise'), { once: true });
    });
    // Награды переворачиваются по очереди
    screen.querySelectorAll('.award-card').forEach((el, i) => el.style.setProperty('--i', i));
}

// Экран показывается, а содержимое часто дорисовывается сразу после — анимируем на следующем кадре
const _showScreen = showScreen;
showScreen = function (name) {
    _showScreen(name);
    requestAnimationFrame(() => animateScreenIn(screens[name]));
};

// ----- Табло: цифры перелистываются при изменении счёта -----
function watchScore(id) {
    const el = $(id);
    if (!el) return;
    let last = el.textContent;
    new MutationObserver(() => {
        if (el.textContent === last) return;
        last = el.textContent;
        if (reduceMotion) return;
        el.classList.remove('flip');
        void el.offsetWidth;
        el.classList.add('flip');
    }).observe(el, { childList: true, characterData: true, subtree: true });
}
watchScore('score-1');
watchScore('score-2');

// Гол: табло вспыхивает
const _celebrateGoal = celebrateGoal;
celebrateGoal = function (side) {
    _celebrateGoal(side);
    if (reduceMotion) return;
    const sb = document.querySelector('.scoreboard-v2');
    if (!sb) return;
    sb.classList.remove('goal-flash');
    void sb.offsetWidth;
    sb.classList.add('goal-flash');
};

// ----- Интро перед матчем: команды «въезжают» с двух сторон -----
function showMatchIntro(m, done) {
    if (reduceMotion) { done(); return; }
    const kits = getMatchKits(m);
    const intro = document.createElement('div');
    intro.className = 'match-intro';
    intro.style.setProperty('--kit1', kits.team1.primary);
    intro.style.setProperty('--kit2', kits.team2.primary);
    const stage = $('match-stage-info') ? $('match-stage-info').textContent : '';
    intro.innerHTML = `
        <div class="mi-side mi-home">${crestHtml(m.team1, 'xl')}<h2>${m.team1.name}</h2></div>
        <div class="mi-side mi-away">${crestHtml(m.team2, 'xl')}<h2>${m.team2.name}</h2></div>
        <div class="mi-vs"><b>VS</b><small>${stage}</small></div>`;
    document.body.appendChild(intro);
    playSound('whistle-short');
    setTimeout(done, 1500);                   // матч стартует, пока интро растворяется
    setTimeout(() => intro.remove(), 2300);
}

const _startSimulation = startSimulation;
startSimulation = function (m) {
    showMatchIntro(m, () => _startSimulation(m));
};

// ----- Чемпион: салют конфетти -----
const _showResults = showResults;
showResults = function (champion) {
    _showResults(champion);
    if (reduceMotion) return;
    const burst = (x, y, delay) => setTimeout(() => createConfetti(x, y), delay);
    const w = window.innerWidth;
    burst(w * 0.5, 160, 350);
    burst(w * 0.2, 220, 700);
    burst(w * 0.8, 220, 900);
    burst(w * 0.5, 120, 1300);
};

// ----- Числа «набегают» (сводка трансферного окна, итог серии) -----
function countUp(el, to, suffix = '', ms = 700) {
    if (reduceMotion || !el || isNaN(to)) return;
    const start = performance.now();
    const step = now => {
        const k = Math.min(1, (now - start) / ms);
        const v = to * (1 - Math.pow(1 - k, 3));
        el.textContent = (Number.isInteger(to) ? Math.round(v) : v.toFixed(1)) + suffix;
        if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

const _renderTransfers = renderTransfers;
renderTransfers = function () {
    const firstRender = !$('screen-transfers').classList.contains('active');
    _renderTransfers();
    if (!firstRender) return;
    const s = $('tr-strength');
    if (s) countUp(s, Number(s.textContent));
};

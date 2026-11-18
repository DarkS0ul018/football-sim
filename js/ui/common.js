// ===== ОБЩИЕ ФУНКЦИИ ИНТЕРФЕЙСА =====

const $ = id => document.getElementById(id);

const screens = {
    setup: $('screen-setup'),
    teamSelect: $('screen-team-select'),
    teamsList: $('screen-teams-list'),
    dashboard: $('screen-dashboard'),
    match: $('screen-match'),
    results: $('screen-results')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
    window.scrollTo(0, 0);
}

function setText(id, text) {
    const el = $(id);
    if (el) el.innerText = text;
}

function setVisible(ids, visible, display = 'flex') {
    ids.forEach(id => { const el = $(id); if (el) el.style.display = visible ? display : 'none'; });
}

const USER_ROW_STYLE = 'background:rgba(233,69,96,0.2)';
function userRowStyle(teamId) {
    return state.userTeam && teamId === state.userTeam.id ? USER_ROW_STYLE : '';
}

function teamLabel(team) {
    return `${team.emoji || '⚽'} ${team.name}`;
}

// ===== КОНФЕТТИ =====
const confettiCanvas = $('confetti-canvas');
const confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
let confettiParticles = [];
let confettiRunning = false;

function resizeConfetti() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}
resizeConfetti();
window.addEventListener('resize', resizeConfetti);

function createConfetti(x, y) {
    const colors = ['#4cc9f0', '#4361ee', '#e94560', '#ffd700', '#00ff88'];
    for (let i = 0; i < 50; i++) {
        confettiParticles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
            life: 100
        });
    }
    // Анимация крутится только пока есть частицы
    if (!confettiRunning) { confettiRunning = true; requestAnimationFrame(updateConfetti); }
}

function updateConfetti() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
        confettiCtx.fillStyle = p.color;
        confettiCtx.beginPath();
        confettiCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        confettiCtx.fill();
    });
    confettiParticles = confettiParticles.filter(p => p.life > 0);
    if (confettiParticles.length) requestAnimationFrame(updateConfetti);
    else { confettiRunning = false; confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
}

// ===== ТАБЛИЦА БОМБАРДИРОВ (общая для дашборда и результатов) =====
const STAT_TYPES = {
    goals:   { header: '⚽ Голы',     value: p => p.goals,             cell: p => p.goals },
    assists: { header: '🎯 Ассисты',  value: p => p.assists,           cell: p => p.assists },
    total:   { header: '⚽+🎯 Гол+Пас', value: p => p.goals + p.assists, cell: p => `${p.goals} + ${p.assists}` }
};

// Возвращает true, если в таблице есть строки
function renderScorersTable(tbodyId, headerId, statType = 'goals') {
    const list = $(tbodyId);
    if (!list) return false;
    const type = STAT_TYPES[statType] || STAT_TYPES.goals;
    setText(headerId, type.header);

    const players = Object.values(playerStats)
        .filter(p => type.value(p) > 0)
        .sort((a, b) => type.value(b) - type.value(a))
        .slice(0, 30);

    if (!players.length) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">Нет данных</td></tr>';
        return false;
    }
    list.innerHTML = players.map((p, i) => {
        const team = getTeamById(p.teamId);
        return `<tr style="${userRowStyle(p.teamId)}">
            <td>${i + 1}. ${p.name} #${p.number}</td>
            <td>${team ? teamLabel(team) : ''}</td>
            <td><b>${type.cell(p)}</b></td>
            <td>${p.matches}</td>
        </tr>`;
    }).join('');
    return true;
}

function getActiveStatTab(container) {
    return container.querySelector('.stats-tab.active')?.dataset.tab || 'goals';
}

function renderTopScorers() {
    const section = $('top-scorers-section');
    const has = renderScorersTable('top-scorers-list', 'stat-header', getActiveStatTab(section));
    section.style.display = has ? 'block' : 'none';
}

function renderFullScorers() {
    renderScorersTable('full-scorers-list', 'stat-header-results', getActiveStatTab($('screen-results')));
}

function initStatTabs() {
    document.querySelectorAll('.stats-tabs').forEach(group => {
        group.querySelectorAll('.stats-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                group.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (group.closest('#top-scorers-section')) renderTopScorers();
                else renderFullScorers();
            });
        });
    });
}

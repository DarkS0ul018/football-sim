// ===== ОБЩИЕ ФУНКЦИИ ИНТЕРФЕЙСА =====

const $ = id => document.getElementById(id);

const screens = {
    setup: $('screen-setup'),
    teamSelect: $('screen-team-select'),
    picker: $('screen-picker'),
    teamsList: $('screen-teams-list'),
    dashboard: $('screen-dashboard'),
    tactics: $('screen-tactics'),
    editor: $('screen-editor'),
    transfers: $('screen-transfers'),
    match: $('screen-match'),
    results: $('screen-results')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
    window.scrollTo(0, 0);
}

// ----- Окно подтверждения внутри игры -----
// Системный confirm() во встроенных браузерах и некоторых режимах приложения сразу отвечает «Отмена»,
// из-за этого «Начать новый турнир» и «Удалить» молча не срабатывали. Это окно работает везде.
function askConfirm(text, { ok = 'Да', cancel = 'Отмена', danger = false } = {}) {
    return new Promise(resolve => {
        document.querySelector('.confirm-overlay')?.remove();
        const el = document.createElement('div');
        el.className = 'confirm-overlay';
        el.innerHTML = `<div class="confirm-box" role="dialog" aria-modal="true">
            <p></p>
            <div class="confirm-actions">
                <button type="button" class="btn-secondary" data-r="0">${cancel}</button>
                <button type="button" class="${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${ok}</button>
            </div>
        </div>`;
        el.querySelector('p').textContent = text;
        const done = r => { el.remove(); document.removeEventListener('keydown', onKey); resolve(r); };
        const onKey = e => { if (e.key === 'Escape') done(false); if (e.key === 'Enter') done(true); };
        el.addEventListener('click', e => { if (e.target === el) done(false); const b = e.target.closest('button'); if (b) done(b.dataset.r === '1'); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(el);
        el.querySelector('[data-r="1"]').focus();
    });
}

// Короткое сообщение вместо alert()
function notify(text) {
    document.querySelector('.notify-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'notify-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('hide'), 2600);
    setTimeout(() => el.remove(), 3000);
}

function setText(id, text) {
    const el = $(id);
    if (el) el.innerText = text;
}

function setVisible(ids, visible, display = 'flex') {
    ids.forEach(id => { const el = $(id); if (el) el.style.display = visible ? display : 'none'; });
}

const USER_ROW_STYLE = 'background:rgba(233,69,96,0.2)';
const P2_ROW_STYLE = 'background:rgba(76,201,240,0.18)';
function userRowStyle(teamId) {
    const i = humanTeams().findIndex(t => t.id === teamId);
    if (i < 0) return '';
    return isDuo() && i === 1 ? P2_ROW_STYLE : USER_ROW_STYLE; // «Вдвоём»: у Игрока 2 свой цвет
}

// Эмблема + название (HTML — вставлять через innerHTML)
function teamLabel(team) {
    return `${crestHtml(team)} <span class="team-label-name">${team.name}</span>`;
}

function setHtml(id, html) {
    const el = $(id);
    if (el) el.innerHTML = html;
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
    goals:   { header: 'Голы',     value: p => p.goals,             cell: p => p.goals },
    assists: { header: 'Передачи',  value: p => p.assists,           cell: p => p.assists },
    total:   { header: 'Гол + пас', value: p => p.goals + p.assists, cell: p => `${p.goals} + ${p.assists}` }
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

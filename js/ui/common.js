// ===== ОБЩИЕ ФУНКЦИИ ИНТЕРФЕЙСА =====

const $ = id => document.getElementById(id);

const screens = {
    home: $('screen-home'),
    setup: $('screen-setup'),
    teamSelect: $('screen-team-select'),
    picker: $('screen-picker'),
    teamsList: $('screen-teams-list'),
    dashboard: $('screen-dashboard'),
    tactics: $('screen-tactics'),
    editor: $('screen-editor'),
    transfers: $('screen-transfers'),
    match: $('screen-match'),
    series: $('screen-series'),
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
// Для средней оценки — только игроки, сыгравшие хотя бы половину матчей лидера по числу игр
function ratingQualifies(p) {
    const most = Math.max(1, ...Object.values(playerStats).map(x => x.rated || 0));
    return (p.rated || 0) >= Math.max(1, Math.ceil(most / 2));
}

const STAT_TYPES = {
    goals:   { header: 'Голы',     value: p => p.goals,             cell: p => p.goals },
    assists: { header: 'Передачи',  value: p => p.assists,           cell: p => p.assists },
    total:   { header: 'Гол + пас', value: p => p.goals + p.assists, cell: p => `${p.goals} + ${p.assists}` },
    rating:  { header: 'Оценка',    value: p => (ratingQualifies(p) ? avgRating(p) || 0 : 0),
               cell: p => `${avgRating(p).toFixed(2)}${p.motm ? ` <span class="st-motm" title="Лучший игрок матча">⭐${p.motm}</span>` : ''}` },
    cards:   { header: 'Карточки',  value: p => (p.yellowCards || 0) + (p.redCards || 0) * 3,
               cell: p => [p.yellowCards ? `🟨${p.yellowCards}` : '', p.redCards ? `🟥${p.redCards}` : ''].filter(Boolean).join(' ') }
};

// Возвращает true, если в таблице есть строки
function renderScorersTable(tbodyId, headerId, statType = 'goals') {
    const list = $(tbodyId);
    if (!list) return false;
    const type = STAT_TYPES[statType] || STAT_TYPES.goals;
    setText(headerId, type.header);

    const players = Object.values(playerStats)
        .filter(p => type.value(p) > 0)
        .sort((a, b) => type.value(b) - type.value(a) || (b.goals + b.assists) - (a.goals + a.assists))
        .slice(0, 30);

    if (!players.length) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">Нет данных</td></tr>';
        // таблица скрывается целиком, только если в турнире ещё нет ни одного гола
        return statType !== 'goals' && Object.values(playerStats).some(p => p.goals > 0);
    }
    list.innerHTML = players.map((p, i) => {
        const team = getTeamById(p.teamId);
        return `<tr class="player-row" data-player="${p.id}" style="${userRowStyle(p.teamId)}" title="Карточка игрока">
            <td>${i + 1}. ${p.name} #${p.number}</td>
            <td>${team ? teamLabel(team) : ''}</td>
            <td><b>${type.cell(p)}</b></td>
            <td>${p.matches}</td>
        </tr>`;
    }).join('');
    return true;
}

// ===== КАРТОЧКА ИГРОКА: статистика за турнир и все его матчи =====
const POS_LABEL = { GK: 'Вратарь', DEF: 'Защитник', MID: 'Полузащитник', FWD: 'Нападающий' };

function pcRatingClass(r) {
    return r >= 8 ? 'rt-top' : (r >= 7 ? 'rt-good' : (r >= 6 ? 'rt-mid' : 'rt-low'));
}

function openPlayerCard(statId) {
    const p = playerStats[statId];
    if (!p) return;
    const team = getTeamById(p.teamId);
    const squadP = team && state.squads && state.squads[team.id] ? (state.squads[team.id].players || {})[p.number] : null;
    const age = team ? knownAge(team.name, p.name) : null;
    const avg = avgRating(p);
    const log = p.log || [];
    const status = [];
    if (squadP && isInjured(squadP)) status.push(`🚑 ${absenceText(squadP)}`);
    else if (squadP && squadP.suspended) status.push(`🚫 ${absenceText(squadP)}`);
    else if (squadP && squadP.yellowAcc) status.push('🟨 ещё одна жёлтая — пропуск матча');

    const tile = (val, label, cls = '') => `<div class="pc-tile ${cls}"><b>${val}</b><span>${label}</span></div>`;
    const rows = log.slice().reverse().map(e => `<tr>
        <td class="pc-stage">${e.cup ? '🏆 ' : ''}${escapeHtml(e.st)}</td>
        <td>${e.home ? '' : '<span class="muted">в гостях · </span>'}${escapeHtml(e.opp)}</td>
        <td><span class="pc-res pc-${e.res}">${e.sc}</span></td>
        <td>${'⚽'.repeat(Math.min(e.g, 5))}${'👟'.repeat(Math.min(e.a, 5))}${e.y ? '🟨' : ''}${e.r ? '🟥' : ''}${e.motm ? '⭐' : ''}</td>
        <td><span class="pc-rt ${pcRatingClass(e.rt)}">${e.rt.toFixed(1)}</span></td>
    </tr>`).join('');

    document.querySelector('.player-card-overlay')?.remove();
    const el = document.createElement('div');
    el.className = 'confirm-overlay player-card-overlay';
    el.innerHTML = `<div class="confirm-box player-card" role="dialog" aria-modal="true">
        <button type="button" class="pc-close" title="Закрыть">✕</button>
        <div class="pc-head">
            ${team ? crestHtml(team, 'lg') : ''}
            <div>
                <div class="pc-name">${escapeHtml(p.name)} <span class="muted">#${p.number}</span></div>
                <div class="muted">${POS_LABEL[p.position] || p.position}${age ? ` · ${age} лет` : ''}${team ? ` · ${escapeHtml(team.name)}` : ''} · рейтинг ${p.rating}</div>
                ${status.length ? `<div class="pc-status">${status.join(' · ')}</div>` : ''}
            </div>
        </div>
        <div class="pc-tiles">
            ${tile(p.matches, 'матчей')}
            ${tile(p.goals, 'голов')}
            ${tile(p.assists, 'передач')}
            ${tile(avg ? avg.toFixed(2) : '—', 'ср. оценка', avg ? pcRatingClass(avg) : '')}
            ${tile(p.motm || 0, 'лучший в матче')}
            ${tile(`${p.yellowCards || 0}/${p.redCards || 0}`, 'жёлт./красн.')}
        </div>
        ${log.length ? `<h4>Матчи</h4><div class="pc-log"><table class="stats-table"><tbody>${rows}</tbody></table></div>`
            : '<p class="muted">Ещё не выходил на поле в этом турнире.</p>'}
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.pc-close')) el.remove(); });
}

// Клик по строке любой таблицы игроков открывает карточку
document.addEventListener('click', e => {
    const row = e.target.closest('tr.player-row[data-player]');
    if (row) openPlayerCard(row.dataset.player);
});

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

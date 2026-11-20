// ===== ЭКРАНЫ ПОДГОТОВКИ: настройки, выбор команды, список участников =====

let careerTeamsPool = []; // команды, показанные на экране выбора (в карьере турнир играется именно ими)
let pickedTeamName = null;

function readSettings() {
    return {
        count: parseInt($('team-count').value),
        mode: $('tournament-mode').value,
        teamType: $('team-type').value,
        gameMode: $('game-mode').value,
        simMode: $('sim-mode').value,
        groupLegs: parseInt($('group-legs').value),
        playoffLegs: parseInt($('playoff-legs').value),
        playoffSize: parseInt($('playoff-size').value),
        teamPick: $('team-pick').value
    };
}

function validateSettings() {
    const { count, mode, teamType, playoffSize } = readSettings();
    const warning = $('warning-msg');
    const startBtn = $('btn-start');
    const maxTeams = getTeamsData(teamType).names.length;
    $('playoff-size-group').style.display = mode === 'leaguePlayoff' ? 'block' : 'none';

    let error = null;
    if (mode === 'leaguePlayoff' && count >= 8 && playoffSize > count / 2) {
        error = `⚠️ В плей-офф может выйти не больше половины участников (${count / 2})`;
    }
    if (mode === 'leaguePlayoff' && count < 8) error = '⚠️ Для чемпионата с плей-офф нужно минимум 8 команд';
    if (error) {
        warning.style.display = 'block';
        warning.innerText = error;
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';
        return false;
    }
    const isPowerOfTwo = count >= 2 && (count & (count - 1)) === 0;
    if (count > maxTeams) error = `⚠️ Максимум ${maxTeams} команд для этого типа`;
    else if (mode === 'knockout' && !isPowerOfTwo) error = '⚠️ Сразу плей-офф: нужно 4, 8, 16 или 32 команды';
    else if (mode === 'groups' && !getGroupFormat(count)) error = '⚠️ Для групп: 8, 12, 16, 24 или 32 команды';
    else if (mode === 'league' && (count < 4 || count % 2)) error = '⚠️ Для лиги нужно чётное число команд';

    warning.style.display = error ? 'block' : 'none';
    warning.innerText = error || '';
    startBtn.disabled = !!error;
    startBtn.style.opacity = error ? '0.5' : '1';
    return !error;
}

// ----- Продолжение сохранённого турнира (последнее из «Моих сохранений») -----
function latestSlot() {
    return readSlotIndex()[0] || null;
}

function renderResumeCard() {
    const card = $('resume-card');
    const s = latestSlot();
    if (!s) { card.style.display = 'none'; return; }
    setText('resume-title', s.title);
    setText('resume-details', s.details);
    card.style.display = 'block';
}

// Открыть слот: идущий турнир — к сетке, серия между турнирами — к её экрану
function resumeTournament(id) {
    const slotId = typeof id === 'string' ? id : (latestSlot() || {}).id;
    if (!slotId) return;
    if (loadGame(slotId)) { openDashboard(); return; }
    const slot = readSlot(slotId);
    if (slot && slot.series && typeof openSeries === 'function') { currentSlotId = slotId; openSeries(); return; }
    deleteSlot(slotId);
    renderResumeCard();
    if (typeof renderHome === 'function') renderHome();
}

async function discardSave(id) {
    const slotId = typeof id === 'string' ? id : (latestSlot() || {}).id;
    if (!slotId) return;
    const s = readSlotIndex().find(x => x.id === slotId);
    if (!(await askConfirm(`Удалить «${s ? s.title : 'сохранение'}»? Продолжить будет нельзя.`, { ok: 'Удалить', danger: true }))) return false;
    deleteSlot(slotId);
    renderResumeCard();
    return true;
}

// ----- Старт -----
async function onStartClick() {
    if (!validateSettings()) return;
    const settings = readSettings();
    startNewSlot(); // новый турнир — новое сохранение, прежние остаются в «Моих сохранениях»
    // Участники: случайно или на выбор
    if (settings.teamPick === 'manual') {
        openParticipantPicker(settings, pool => proceedWithPool(settings, pool));
    } else {
        // Сборные, в карьере и вдвоём: выбрать можно любую сборную турнира, лишние соперники отсеются после выбора
        const nationPick = isNationCupType(settings.teamType) && settings.gameMode !== 'simulator';
        proceedWithPool(settings, pickRandomTeams(settings.teamType, nationPick ? getTeamsData(settings.teamType).names.length : settings.count));
    }
}

// Дальше: в карьере — выбор своей команды из участников, иначе — сразу турнир
function proceedWithPool(settings, pool) {
    if (settings.gameMode === 'career' || settings.gameMode === 'duo') showTeamSelect(settings, pool);
    else startTournament(settings, pool, null);
}

function startTournament(settings, teamsPool, userTeamName) {
    createTournament(settings, teamsPool, userTeamName);
    saveGame();
    renderTeamsList();
    showScreen('teamsList');
}

// ----- Выбор команды в карьере -----
// «Вдвоём»: команды выбирают по очереди — firstPick — команда Игрока 1 (на втором шаге)
function showTeamSelect(settings, pool, firstPick = null) {
    careerTeamsPool = [...(pool || pickRandomTeams(settings.teamType, settings.count))].sort((a, b) => b.rating - a.rating);
    pickedTeamName = null;
    const duo = settings.gameMode === 'duo';
    const step = duo ? (firstPick ? 2 : 1) : 0;
    const head = document.querySelector('#screen-team-select .screen-header');
    head.querySelector('.kicker').textContent = duo ? 'Вдвоём' : 'Карьера';
    head.querySelector('h1').innerHTML = duo ? `<span class="duo-tag p${step}">Игрок ${step}</span> выбирает команду` : 'Выберите команду';
    head.querySelector('.subtitle').textContent = duo
        ? (step === 1 ? 'Каждый управляет своей командой: состав, тактика, решения по ходу матча. Ходите по очереди на одном устройстве.'
                      : `Игрок 1 играет за «${firstPick}». Теперь выбор Игрока 2.`)
        : 'Вы будете управлять только ею: состав, тактика, решения по ходу матча.';

    const list = $('team-select-list');
    list.innerHTML = '';
    careerTeamsPool.forEach(teamData => {
        const card = document.createElement('div');
        const taken = firstPick === teamData.name;
        card.className = `team-select-card ${taken ? 'taken' : ''}`;
        card.innerHTML = `<span class="team-emoji">${crestHtml(teamData, 'lg')}</span><h3>${teamData.name}</h3><div class="rating">Рейтинг: ${teamData.rating}</div>${taken ? '<div class="duo-tag p1">Игрок 1</div>' : ''}`;
        if (taken) { list.appendChild(card); return; }
        card.onclick = () => {
            list.querySelectorAll('.team-select-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            pickedTeamName = teamData.name;
        };
        list.appendChild(card);
    });

    const btn = document.createElement('button');
    btn.className = 'btn-primary btn-glow';
    btn.style.marginTop = '20px';
    btn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">Далее →</span>';
    btn.onclick = () => {
        if (!pickedTeamName) { notify('⚠️ Выберите команду'); return; }
        if (step === 1) { showTeamSelect(settings, careerTeamsPool, pickedTeamName); return; }
        const picks = step === 2 ? [firstPick, pickedTeamName] : [pickedTeamName];
        startTournament(settings, trimPool(careerTeamsPool, picks, settings.count), step === 2 ? picks : pickedTeamName);
    };
    list.appendChild(btn);
    showScreen('teamSelect');
}

// ----- Список участников -----
function renderTeamsList() {
    const container = $('teams-list-container');
    const sorted = [...state.teams].sort((a, b) => b.rating - a.rating);
    container.innerHTML = sorted.map((team, index) => {
        const ratingClass = team.rating >= 90 ? 'rating-high' : (team.rating < 80 ? 'rating-low' : 'rating-medium');
        const isUser = isHuman(team);
        return `
            <div class="team-list-item ${isUser ? 'user-team' : ''}">
                <span class="team-num">${index + 1}.</span>
                <div class="team-info">
                    <span class="team-emoji">${crestHtml(team)}</span>
                    <span class="team-name">${team.name}${isUser ? (isDuo() ? ` <span class="duo-tag p${humanIndex(team) + 1}">${humanLabel(team)}</span>` : ' ⚽') : ''}</span>
                </div>
                <span class="team-rating ${ratingClass}">${team.rating}</span>
                <span class="team-badge">${getRatingBadge(team.rating)}</span>
            </div>`;
    }).join('');
}

// ----- Зал славы -----
function renderHall() {
    const hall = readHall();
    const card = $('hall-card');
    if (!hall.tournaments.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    setText('hall-count', `· турниров: ${hall.tournaments.length}`);
    const crest = (t) => t ? `${crestHtml(t)} ${t.name}` : '—';
    const titles = Object.entries(hall.titles).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const r = hall.records;
    $('hall-content').innerHTML = `
        <div class="hall-grid">
            <div>
                <h4>🏆 Больше всего титулов</h4>
                ${titles.map(([name, n], i) => `<div class="hall-row"><span>${i + 1}. ${crest({ name, emoji: (hall.emojis || {})[name] || '' })}</span><b>${n}</b></div>`).join('')}
            </div>
            <div>
                <h4>📈 Рекорды</h4>
                ${r.biggestWin ? `<div class="hall-row"><span>Крупнейшая победа</span><b>${r.biggestWin.text}</b></div>` : ''}
                ${r.mostGoals ? `<div class="hall-row"><span>Самый результативный матч</span><b>${r.mostGoals.text}</b></div>` : ''}
                ${r.topScorer ? `<div class="hall-row"><span>Бомбардир турнира</span><b>${r.topScorer.text}</b></div>` : ''}
            </div>
        </div>
        <h4>📜 Последние турниры</h4>
        <div class="hall-list">
            ${hall.tournaments.slice(0, 10).map(t => `
                <div class="hall-row">
                    <span class="muted">${t.date} · ${t.format}</span>
                    <span>🥇 ${crest(t.champion)}${t.runnerUp ? ` <span class="muted">· 🥈 ${t.runnerUp.name}</span>` : ''}</span>
                </div>`).join('')}
        </div>
        <button id="btn-clear-hall" class="btn-secondary hall-clear">🗑️ Очистить зал славы</button>`;
    $('btn-clear-hall').onclick = async () => {
        if (!(await askConfirm('Очистить зал славы и историю карьеры?', { ok: 'Очистить', danger: true }))) return;
        clearHall();
        clearCareer();
        renderHall();
    };
}

function initSetupScreens() {
    renderHall();
    ['team-count', 'tournament-mode', 'team-type', 'playoff-size'].forEach(id => $(id).addEventListener('change', validateSettings));
    validateSettings();
    renderResumeCard();

    $('btn-start').addEventListener('click', onStartClick);
    $('btn-resume').addEventListener('click', resumeTournament);
    $('btn-discard-save').addEventListener('click', discardSave);
    $('btn-back-setup').addEventListener('click', () => showScreen(readSettings().teamPick === 'manual' ? 'picker' : 'setup'));
    $('btn-back-teams').addEventListener('click', () => {
        // Турнир ещё не начат — возвращаемся к настройкам без сохранения
        clearSave();
        renderResumeCard();
        if (hasHumans()) showScreen('teamSelect');
        else showScreen(readSettings().teamPick === 'manual' ? 'picker' : 'setup');
    });
    $('btn-start-tournament').addEventListener('click', openDashboard);
}

// ----- Турниры сборных: настоящий формат и без карьеры с трансферами -----
function onTeamTypeChange() {
    const type = $('team-type').value;
    const cup = typeof NATION_CUPS !== 'undefined' ? NATION_CUPS[type] : null;
    const hint = $('team-type-hint');
    const career = $('game-mode').querySelector('option[value="career"]');
    if (cup) {
        // Участников могли поменять в редакторе: берём настоящий размер турнира или ближайший возможный
        const pool = cup.names.length;
        let count = pool >= cup.count ? cup.count : [32, 24, 16, 12, 8].find(n => n <= pool);
        let mode = cup.mode;
        if (!count) { count = pool >= 4 ? 4 : pool; mode = 'knockout'; }
        $('team-count').value = String(count);
        $('tournament-mode').value = mode;
        const fmt = mode === 'groups' ? getGroupFormat(count) : null;
        const extra = pool > count ? ` В списке ${pool} сборных — сыграют ${count}: случайные или «Выбрать самому».` : '';
        hint.textContent = (fmt
            ? `${cup.icon} ${cup.title}: ${count} сборных, ${fmt.groups} групп по 4 → плей-офф` +
              (fmt.thirds ? ` (2 лучших из группы + ${fmt.thirds} лучших третьих)` : ' (по 2 лучших из группы)')
            : `${cup.icon} ${cup.title}: ${count} сборных, сразу плей-офф`) + '.' + extra + ' Формат можно поменять.';
        hint.style.display = 'block';
        career.disabled = false;
        career.textContent = 'Карьера — за одну сборную';
    } else {
        hint.style.display = 'none';
        career.disabled = false;
        career.textContent = 'Карьера — одна команда';
    }
    validateSettings();
}
$('team-type').addEventListener('change', onTeamTypeChange);
onTeamTypeChange();

// Турнир сборных (ЧМ, ЧЕ, Кубок Америки)?
function isNationCupType(type) {
    return typeof NATION_CUPS !== 'undefined' && !!NATION_CUPS[type];
}

// Участников больше, чем мест: выбранные команды остаются, остальные — случайные
function trimPool(pool, keepNames, count) {
    if (pool.length <= count) return pool;
    const keep = pool.filter(t => keepNames.includes(t.name));
    const others = pool.filter(t => !keepNames.includes(t.name)).sort(() => Math.random() - 0.5);
    return [...keep, ...others.slice(0, count - keep.length)];
}

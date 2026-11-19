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

// ----- Продолжение сохранённого турнира -----
function renderResumeCard() {
    const card = $('resume-card');
    const data = readSave();
    if (!data) { card.style.display = 'none'; return; }
    const info = describeSave(data);
    setText('resume-title', info.title);
    setText('resume-details', info.details);
    card.style.display = 'block';
}

function resumeTournament() {
    if (!loadGame()) { renderResumeCard(); return; }
    openDashboard();
}

function discardSave() {
    if (!confirm('Удалить сохранённый турнир?')) return;
    clearSave();
    renderResumeCard();
}

// ----- Старт -----
function onStartClick() {
    if (!validateSettings()) return;
    const settings = readSettings();
    if (readSave() && !confirm('Начать новый турнир? Сохранённый турнир будет удалён.')) return;
    // Участники: случайно или на выбор
    if (settings.teamPick === 'manual') {
        openParticipantPicker(settings, pool => proceedWithPool(settings, pool));
    } else {
        proceedWithPool(settings, pickRandomTeams(settings.teamType, settings.count));
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
    careerTeamsPool = pool || pickRandomTeams(settings.teamType, settings.count);
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
        if (!pickedTeamName) { alert('⚠️ Выберите команду!'); return; }
        if (step === 1) { showTeamSelect(settings, careerTeamsPool, pickedTeamName); return; }
        startTournament(settings, careerTeamsPool, step === 2 ? [firstPick, pickedTeamName] : pickedTeamName);
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
    $('btn-clear-hall').onclick = () => {
        if (!confirm('Очистить зал славы и историю карьеры?')) return;
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

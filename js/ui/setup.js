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
        playoffLegs: parseInt($('playoff-legs').value)
    };
}

function validateSettings() {
    const { count, mode, teamType } = readSettings();
    const warning = $('warning-msg');
    const startBtn = $('btn-start');
    const maxTeams = getTeamsData(teamType).names.length;

    let error = null;
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

    if (settings.gameMode === 'career') {
        showTeamSelect(settings);
    } else {
        startTournament(settings, pickRandomTeams(settings.teamType, settings.count), null);
    }
}

function startTournament(settings, teamsPool, userTeamName) {
    createTournament(settings, teamsPool, userTeamName);
    saveGame();
    renderTeamsList();
    showScreen('teamsList');
}

// ----- Выбор команды в карьере -----
function showTeamSelect(settings) {
    careerTeamsPool = pickRandomTeams(settings.teamType, settings.count);
    pickedTeamName = null;

    const list = $('team-select-list');
    list.innerHTML = '';
    careerTeamsPool.forEach(teamData => {
        const card = document.createElement('div');
        card.className = 'team-select-card';
        card.innerHTML = `<span class="team-emoji">${teamData.emoji}</span><h3>${teamData.name}</h3><div class="rating">Рейтинг: ${teamData.rating}</div>`;
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
        startTournament(settings, careerTeamsPool, pickedTeamName);
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
        const isUser = state.userTeam && team.id === state.userTeam.id;
        return `
            <div class="team-list-item ${isUser ? 'user-team' : ''}">
                <span class="team-num">${index + 1}.</span>
                <div class="team-info">
                    <span class="team-emoji">${team.emoji}</span>
                    <span class="team-name">${team.name}${isUser ? ' ⚽' : ''}</span>
                </div>
                <span class="team-rating ${ratingClass}">${team.rating}</span>
                <span class="team-badge">${getRatingBadge(team.rating)}</span>
            </div>`;
    }).join('');
}

function initSetupScreens() {
    ['team-count', 'tournament-mode', 'team-type'].forEach(id => $(id).addEventListener('change', validateSettings));
    validateSettings();
    renderResumeCard();

    $('btn-start').addEventListener('click', onStartClick);
    $('btn-resume').addEventListener('click', resumeTournament);
    $('btn-discard-save').addEventListener('click', discardSave);
    $('btn-back-setup').addEventListener('click', () => showScreen('setup'));
    $('btn-back-teams').addEventListener('click', () => {
        // Турнир ещё не начат — возвращаемся к настройкам без сохранения
        clearSave();
        renderResumeCard();
        if (isCareer()) showScreen('teamSelect'); else showScreen('setup');
    });
    $('btn-start-tournament').addEventListener('click', openDashboard);
}

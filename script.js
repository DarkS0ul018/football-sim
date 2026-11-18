// ===== АНИМАЦИИ ФАЗЫ 1 =====
const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;

if (confettiCanvas) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}

let confettiParticles = [];

function createConfetti(x, y) {
    const colors = ['#4cc9f0', '#4361ee', '#e94560', '#ffd700', '#00ff88'];
    for (let i = 0; i < 50; i++) {
        confettiParticles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
            life: 100
        });
    }
}

function updateConfetti() {
    if (confettiCtx) {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2;
            p.life--;
            confettiCtx.fillStyle = p.color;
            confettiCtx.beginPath();
            confettiCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            confettiCtx.fill();
        });
        confettiParticles = confettiParticles.filter(p => p.life > 0);
    }
    requestAnimationFrame(updateConfetti);
}
updateConfetti();

// ===== ЗАГРУЗКА СОСТАВОВ ИЗ JSON =====
let teamSquads = {};

async function loadTeamSquads() {
    try {
        const response = await fetch('squads.json');
        teamSquads = await response.json();
        console.log('✅ Составы загружены из squads.json');
        return true;
    } catch (error) {
        console.warn('⚠️ Не удалось загрузить squads.json, используем резервные данные');
        return false;
    }
}

// ===== БАЗЫ ДАННЫХ КОМАНД И ИГРОКОВ =====
const worldTeams = {
    names: ["Arsenal", "Bayern", "Liverpool", "Barca", "Real", "Tottenham", "PSG", "Chelsea", "Ajax", "ManCity", "Inter", "Atletico", "Roma", "Dortmund", "Benfica", "Napoli", "Atalanta", "Frankfurt", "Sporting", "Porto", "ManUtd", "Brugge", "Fiorentina", "Milan", "Betis", "AstonVilla", "Juventus", "Sevilla", "Valencia", "Nice", "Osasuna", "Girona", "Lazio", "Feyenoord"],
    emojis: ["🔴⚪", "🔴", "🔴", "🔵🔴", "⚪", "⚪", "🔵🔴", "🔵", "🔴⚪", "🔷", "🔵⚫", "🔴⚪", "🟡🔴", "🟡⚫", "🔴⚪", "🔵", "🔵⚫", "🔴⚫", "🟢⚪", "🔵⚪", "🔴⚪", "🔵⚫", "🟣⚪", "🔴⚫", "🟢⚪", "🔷", "⚫⚪", "🟡🔴", "🟠", "🔵🔴", "🔴", "🔴⚪", "⚪🔵", "🔴⚪"]
};

const russianTeams = {
    names: ["Спартак", "Зенит", "ЦСКА", "Локомотив", "Динамо", "Краснодар", "Ростов", "Рубин", "Сочи", "Ахмат", "Крылья", "Оренбург", "ПариНН", "Факел", "Акрон", "Балтика"],
    emojis: ["🔴⚪", "🔵⚪", "🔴🔵", "🟢⚪", "⚪🔵", "🟢⚫", "🟡🔴", "🔵⚪", "⚪🔵", "🟢⚪", "🔵⚪", "🟠⚫", "🔴⚪", "🟠⚫", "🟡🔵", "🔵⚪"]
};

// ===== ФИКСИРОВАННЫЕ РЕЙТИНГИ КОМАНД (2025/2026) =====
const teamRatings = {
    // Мировые команды (рейтинг 1-100)
    "Real": 90, "Barca": 98, "ManCity": 94, "Liverpool": 91, "Bayern": 93,
    "PSG": 90, "Inter": 88, "Juventus": 87, "Milan": 86, "Arsenal": 90,
    "Chelsea": 87, "Dortmund": 86, "Atletico": 88, "Napoli": 87, "Roma": 85,
    "Sevilla": 84, "Porto": 85, "Ajax": 84, "Benfica": 85, "Valencia": 83,
    "Tottenham": 85, "ManUtd": 86, "Atalanta": 86, "Frankfurt": 84,
    "Sporting": 85, "Brugge": 82, "Fiorentina": 84, "Betis": 83,
    "AstonVilla": 83, "Nice": 83, "Osasuna": 79, "Girona": 82, "Lazio": 85,
    "Feyenoord": 80,
    
    // Российские команды (рейтинг 1-100)
    "Спартак": 70, "Зенит": 83, "ЦСКА": 86, "Локомотив": 81, "Динамо": 80,
    "Краснодар": 82, "Ростов": 79, "Рубин": 78, "Сочи": 77, "Ахмат": 76,
    "Крылья": 77, "Оренбург": 75, "ПариНН": 74, "Факел": 73, "Акрон": 74,
    "Балтика": 75
};

// ===== ДЛЯ СМЕШАННОГО РЕЖИМА =====
const mixedTeams = {
    names: [...russianTeams.names, ...worldTeams.names],
    emojis: [...russianTeams.emojis, ...worldTeams.emojis]
};

// ===== РЕЗЕРВНЫЕ ИМЕНА ИГРОКОВ =====
const worldPlayerNames = {
    goalkeepers: ["Courtois", "Ederson", "Alisson", "Ter Stegen", "Donnarumma", "Navas", "Oblak", "Neuer", "Martinez", "Maignan"],
    defenders: ["Van Dijk", "Ramos", "Marquinhos", "Varane", "Alaba", "Davies", "Hakimi", "Cancelo", "Walker", "Rudiger"],
    midfielders: ["Modric", "Kroos", "De Bruyne", "Pedri", "Gavi", "Bellingham", "Valverde", "Camavinga", "Silva", "Gundogan"],
    forwards: ["Mbappe", "Haaland", "Benzema", "Lewandowski", "Salah", "Mane", "Vini Jr", "Rodrygo", "Neymar", "Messi"]
};

const russianPlayerNames = {
    goalkeepers: ["Акинфеев", "Кержаков", "Сафонов", "Шунин", "Дюпин", "Лунёв", "Максименко", "Селихов"],
    defenders: ["Джикия", "Фернандес", "Кудряшов", "Семёнов", "Караваев", "Лихачёв", "Тикнизян", "Маслов"],
    midfielders: ["Головин", "Миранчук", "Зобнин", "Оздоев", "Кузяев", "Ерохин", "Жемалетдинов", "Ионов"],
    forwards: ["Дзюба", "Соболев", "Чалов", "Смолов", "Комличенко", "Игнатьев", "Пиняев", "Кордоба"]
};

// ===== ГЕНЕРАЦИЯ СОСТАВА =====
function generateTeamSquad(teamName, teamId, teamType, isHome = true) {
    const squad = [];
    let playerNum = 1;
    
    // ===== ОПРЕДЕЛЯЕМ РЕАЛЬНЫЙ ТИП КОМАНДЫ =====
    let actualTeamType = teamType;
    if (teamType === 'mixed') {
        if (russianTeams.names.includes(teamName)) {
            actualTeamType = 'russia';
        } else {
            actualTeamType = 'world';
        }
    }
    
    // Пытаемся взять состав из JSON
    let playersData = null;
    if (teamSquads[actualTeamType] && teamSquads[actualTeamType][teamName]) {
        playersData = teamSquads[actualTeamType][teamName];
        console.log(`✅ Загружен состав для ${teamName} из JSON (${actualTeamType})`);
    }
    
    // Если нет данных — используем резервные имена
    if (!playersData) {
        const playerNames = actualTeamType === 'russia' ? russianPlayerNames : worldPlayerNames;
        playersData = {
            goalkeepers: playerNames.goalkeepers.slice(0, 2),
            defenders: playerNames.defenders.slice(0, 5),
            midfielders: playerNames.midfielders.slice(0, 5),
            forwards: playerNames.forwards.slice(0, 4)
        };
        console.log(`⚠️ Используем резервный состав для ${teamName}`);
    }
    
    const formations = {
        goalkeeper: [{ x: isHome ? 8 : 92, y: 50 }],
        defenders: [
            { x: isHome ? 20 : 80, y: 25 },
            { x: isHome ? 18 : 82, y: 42 },
            { x: isHome ? 18 : 82, y: 58 },
            { x: isHome ? 20 : 80, y: 75 }
        ],
        midfielders: [
            { x: isHome ? 40 : 60, y: 30 },
            { x: isHome ? 38 : 62, y: 50 },
            { x: isHome ? 38 : 62, y: 70 },
            { x: isHome ? 45 : 55, y: 50 }
        ],
        forwards: [
            { x: isHome ? 60 : 40, y: 40 },
            { x: isHome ? 60 : 40, y: 60 }
        ]
    };

    formations.goalkeeper.forEach((pos, idx) => {
        if (playersData.goalkeepers[idx]) {
            squad.push({
                number: playerNum++,
                name: playersData.goalkeepers[idx],
                position: 'GK',
                x: pos.x, y: pos.y,
                baseX: pos.x, baseY: pos.y,
                isGoalkeeper: true,
                team: teamId
            });
        }
    });
    
    formations.defenders.forEach((pos, idx) => {
        if (playersData.defenders[idx]) {
            squad.push({
                number: playerNum++,
                name: playersData.defenders[idx],
                position: 'DEF',
                x: pos.x, y: pos.y,
                baseX: pos.x, baseY: pos.y,
                team: teamId
            });
        }
    });
    
    formations.midfielders.forEach((pos, idx) => {
        if (playersData.midfielders[idx]) {
            squad.push({
                number: playerNum++,
                name: playersData.midfielders[idx],
                position: 'MID',
                x: pos.x, y: pos.y,
                baseX: pos.x, baseY: pos.y,
                team: teamId
            });
        }
    });
    
    formations.forwards.forEach((pos, idx) => {
        if (playersData.forwards[idx]) {
            squad.push({
                number: playerNum++,
                name: playersData.forwards[idx],
                position: 'FWD',
                x: pos.x, y: pos.y,
                baseX: pos.x, baseY: pos.y,
                team: teamId
            });
        }
    });
    
    return squad;
}

// ===== СТАТИСТИКА ИГРОКОВ =====
let playerStats = {};

function initPlayerStats(teamType = 'world') {
    playerStats = {};
    state.teams.forEach(team => {
        const squad = generateTeamSquad(team.name, team.id, teamType, true);
        squad.forEach(player => {
            const playerId = `${team.id}-${player.number}`;
            playerStats[playerId] = {
                id: playerId, number: player.number, name: player.name, position: player.position,
                team: team, teamId: team.id,
                goals: 0, assists: 0, matches: 0,
                yellowCards: 0, redCards: 0, shotsOnTarget: 0
            };
        });
    });
}

function addPlayerGoal(teamId, playerNumber) {
    const playerId = `${teamId}-${playerNumber}`;
    if (playerStats[playerId]) {
        playerStats[playerId].goals++;
        playerStats[playerId].shotsOnTarget++;
    }
}

function addPlayerAssist(teamId, playerNumber) {
    const playerId = `${teamId}-${playerNumber}`;
    if (playerStats[playerId]) {
        playerStats[playerId].assists++;
    }
}

function addPlayerMatch(teamId, playerNumber) {
    const playerId = `${teamId}-${playerNumber}`;
    if (playerStats[playerId]) {
        playerStats[playerId].matches++;
    }
}

// ===== ТАБЛИЦА БОМБАРДИРОВ =====
function renderTopScorersTable(statType = 'goals') {
    const section = document.getElementById('top-scorers-section');
    const list = document.getElementById('top-scorers-list');
    const header = document.getElementById('stat-header');
    if (!section || !list) return;

    let players;

    if (statType === 'goals') {
        players = Object.values(playerStats).filter(p => p.goals > 0);
        players.sort((a, b) => b.goals - a.goals);
        if (header) header.innerText = '⚽ Голы';
    } else if (statType === 'assists') {
        players = Object.values(playerStats).filter(p => p.assists > 0);
        players.sort((a, b) => b.assists - a.assists);
        if (header) header.innerText = '🎯 Ассисты';
    } else {
        players = Object.values(playerStats).filter(p => p.goals > 0 || p.assists > 0);
        players.sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));
        if (header) header.innerText = '⚽+🎯 Гол+Пас';
    }

    const topPlayers = players.slice(0, 30);

    if (topPlayers.length > 0) {
        section.style.display = 'block';
        list.innerHTML = topPlayers.map((p, index) => {
            let statCell;
            if (statType === 'goals') {
                statCell = `<td><b>${p.goals}</b></td>`;
            } else if (statType === 'assists') {
                statCell = `<td><b>${p.assists}</b></td>`;
            } else {
                statCell = `<td><b>${p.goals} + ${p.assists}</b></td>`;
            }
            return `
                <tr style="${state.userTeam && p.teamId === state.userTeam.id ? 'background:rgba(233,69,96,0.2);' : ''}">
                    <td>${index + 1}. ${p.name} #${p.number}</td>
                    <td>${p.team.emoji || '⚽'} ${p.team.name}</td>
                    ${statCell}
                    <td>${p.matches}</td>
                </tr>
            `;
        }).join('');
    } else {
        section.style.display = 'none';
    }
}

// ===== ТАБЛИЦА НА ЭКРАНЕ РЕЗУЛЬТАТОВ =====
function renderFullScorersTable(statType = 'goals') {
    const list = document.getElementById('full-scorers-list');
    const header = document.getElementById('stat-header-results');
    if (!list) return;

    let players;

    if (statType === 'goals') {
        players = Object.values(playerStats).filter(p => p.goals > 0);
        players.sort((a, b) => b.goals - a.goals);
        if (header) header.innerText = '⚽ Голы';
    } else if (statType === 'assists') {
        players = Object.values(playerStats).filter(p => p.assists > 0);
        players.sort((a, b) => b.assists - a.assists);
        if (header) header.innerText = '🎯 Ассисты';
    } else {
        players = Object.values(playerStats).filter(p => p.goals > 0 || p.assists > 0);
        players.sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));
        if (header) header.innerText = '⚽+🎯 Гол+Пас';
    }

    const topPlayers = players.slice(0, 30);

    if (topPlayers.length > 0) {
        list.innerHTML = topPlayers.map((p, index) => {
            let statCell;
            if (statType === 'goals') {
                statCell = `<td><b>${p.goals}</b></td>`;
            } else if (statType === 'assists') {
                statCell = `<td><b>${p.assists}</b></td>`;
            } else {
                statCell = `<td><b>${p.goals} + ${p.assists}</b></td>`;
            }
            return `
                <tr style="${state.userTeam && p.teamId === state.userTeam.id ? 'background:rgba(233,69,96,0.2);' : ''}">
                    <td>${index + 1}. ${p.name} #${p.number}</td>
                    <td>${p.team.emoji || '⚽'} ${p.team.name}</td>
                    ${statCell}
                    <td>${p.matches}</td>
                </tr>
            `;
        }).join('');
    } else {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">Нет данных</td></tr>';
    }
}

// ===== ПЕРЕКЛЮЧЕНИЕ ТАБОВ =====
function getActiveStatTab() {
    return document.querySelector('#top-scorers-section .stats-tab.active')?.dataset.tab || 'goals';
}

document.querySelectorAll('.stats-tabs').forEach(group => {
    group.querySelectorAll('.stats-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            group.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const statType = tab.dataset.tab;
            if (group.closest('#top-scorers-section')) renderTopScorersTable(statType);
            else renderFullScorersTable(statType);
        });
    });
});

// ===== ДОСТИЖЕНИЯ =====
const achievements = [
    { id: 'first_goal', title: 'Первый гол', desc: 'Забейте первый гол', icon: '⚽', unlocked: false, check: () => Object.values(playerStats).some(p => p.goals >= 1) },
    { id: 'hat_trick', title: 'Хет-трик', desc: '3+ гола игроком', icon: '🎯', unlocked: false, check: () => Object.values(playerStats).some(p => p.goals >= 3) },
    { id: 'five_wins', title: '5 побед', desc: '5 побед за турнир', icon: '🔥', unlocked: false, check: () => state.userTeam && state.userTeam.stats.won >= 5 },
    { id: 'champion', title: 'Чемпион!', desc: 'Выиграйте турнир в карьере', icon: '🏆', unlocked: false, check: () => !!(state.champion && state.userTeam && state.champion.id === state.userTeam.id) }
];

function checkAchievements() {
    achievements.forEach(a => { if (!a.unlocked && a.check()) a.unlocked = true; });
}

function renderAchievements() {
    const list = document.getElementById('achievements-list');
    if (!list) return;
    list.innerHTML = achievements.map(a => `
        <div class="achievement-card ${a.unlocked ? 'unlocked' : 'locked'}">
            <span class="achievement-icon">${a.icon}</span>
            <div class="achievement-title">${a.title}</div>
            <div class="achievement-desc">${a.desc}</div>
            ${a.unlocked ? '<div class="achievement-progress">✅</div>' : ''}
        </div>
    `).join('');
}

// ===== НАГРАДЫ =====
function calculateTournamentAwards() {
    const players = Object.values(playerStats);
    
    players.sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));
    const bestPlayer = players[0];
    
    players.sort((a, b) => b.goals - a.goals);
    const topScorer = players[0];
    
    players.sort((a, b) => b.assists - a.assists);
    const topAssister = players[0];
    
    // Лучший вратарь: меньше всего пропущенных за матч (при равенстве — больше сыгранных матчей)
    const goalkeepers = players.filter(p => p.position === 'GK' && p.matches > 0);
    goalkeepers.sort((a, b) => {
        const gaA = a.team.stats.ga / (a.team.stats.played || 1);
        const gaB = b.team.stats.ga / (b.team.stats.played || 1);
        return gaA - gaB || b.matches - a.matches;
    });
    const bestGoalkeeper = goalkeepers[0] || null;
    
    const attackStats = state.teams.filter(t => t.stats.played > 0).map(t => ({ team: t, gf: t.stats.gf }));
    attackStats.sort((a, b) => b.gf - a.gf);
    const bestAttack = attackStats[0]?.team || null;
    
    const defenseStats = state.teams.filter(t => t.stats.played > 0).map(t => ({ team: t, ga: t.stats.ga / t.stats.played }));
    defenseStats.sort((a, b) => a.ga - b.ga);
    const bestDefense = defenseStats[0]?.team || null;
    
    return { bestPlayer, topScorer, topAssister, bestGoalkeeper, bestAttack, bestDefense };
}

function renderTournamentAwards() {
    const container = document.getElementById('tournament-awards');
    if (!container) return;
    
    const awards = calculateTournamentAwards();
    
    container.innerHTML = `
        <div class="award-card">
            <span class="award-icon">👑</span>
            <div class="award-title">ЛУЧШИЙ ИГРОК</div>
            <div class="award-player">${awards.bestPlayer?.name || 'N/A'}</div>
            <div class="award-team">${awards.bestPlayer?.team?.emoji || '⚽'} ${awards.bestPlayer?.team?.name || ''}</div>
            <div class="award-stat">${awards.bestPlayer?.goals || 0} голов + ${awards.bestPlayer?.assists || 0} ассистов</div>
        </div>
        <div class="award-card">
            <span class="award-icon">⚽</span>
            <div class="award-title">БОМБАРДИР</div>
            <div class="award-player">${awards.topScorer?.name || 'N/A'}</div>
            <div class="award-team">${awards.topScorer?.team?.emoji || '⚽'} ${awards.topScorer?.team?.name || ''}</div>
            <div class="award-stat">${awards.topScorer?.goals || 0} голов</div>
        </div>
        <div class="award-card">
            <span class="award-icon">🎯</span>
            <div class="award-title">ЛУЧШИЙ АССИСТЕНТ</div>
            <div class="award-player">${awards.topAssister?.name || 'N/A'}</div>
            <div class="award-team">${awards.topAssister?.team?.emoji || '⚽'} ${awards.topAssister?.team?.name || ''}</div>
            <div class="award-stat">${awards.topAssister?.assists || 0} ассистов</div>
        </div>
        <div class="award-card">
            <span class="award-icon">🧤</span>
            <div class="award-title">ВРАТАРЬ</div>
            <div class="award-player">${awards.bestGoalkeeper?.name || 'N/A'}</div>
            <div class="award-team">${awards.bestGoalkeeper?.team?.emoji || '⚽'} ${awards.bestGoalkeeper?.team?.name || ''}</div>
            <div class="award-stat">${awards.bestGoalkeeper?.team?.stats.ga || 0} пропущено</div>
        </div>
        <div class="award-card">
            <span class="award-icon">🔥</span>
            <div class="award-title">ЛУЧШАЯ АТАКА</div>
            <div class="award-player">${awards.bestAttack?.name || 'N/A'}</div>
            <div class="award-team">${awards.bestAttack?.emoji || '⚽'} ${awards.bestAttack?.name || ''}</div>
            <div class="award-stat">${awards.bestAttack?.stats.gf || 0} забито</div>
        </div>
        <div class="award-card">
            <span class="award-icon">🛡️</span>
            <div class="award-title">ЛУЧШАЯ ЗАЩИТА</div>
            <div class="award-player">${awards.bestDefense?.name || 'N/A'}</div>
            <div class="award-team">${awards.bestDefense?.emoji || '⚽'} ${awards.bestDefense?.name || ''}</div>
            <div class="award-stat">${awards.bestDefense?.stats.ga || 0} пропущено</div>
        </div>
    `;
}

// ===== СОБЫТИЯ МАТЧА =====
function addMatchEvent(match, minute, type, text, team = null) {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;
    const icons = {
        'goal': '⚽', 'shot': '🎯', 'corner': '🚩', 'foul': '⚠️',
        'card-yellow': '🟨', 'card-red': '🟥', 'substitution': '🔄',
        'half': '⏱️', 'penalty': '🎲', 'penalties': '🎲', 'penalty-goal': '✅', 'penalty-miss': '❌',
        'shot-off': '💨', 'finish': '🏁', 'event': '•'
    };
    const eventDiv = document.createElement('div');
    eventDiv.className = `event-item ${type}`;
    const icon = icons[type] || '•';
    let teamColor, teamEmoji;
    if (team) {
        teamColor = team.id === match.team1.id ? 'var(--accent-primary)' : 'var(--highlight)';
        teamEmoji = team.id === match.team1.id ? (match.team1.emoji || '🔵') : (match.team2.emoji || '🔴');
    } else {
        teamColor = 'var(--text-muted)';
        teamEmoji = '•';
    }
    const timeLabel = typeof minute === 'number' ? `${minute}'` : (minute || '');
    eventDiv.innerHTML = `<span class="event-time">${timeLabel}</span><span class="event-icon">${icon}</span><span class="event-team" style="color: ${teamColor}; font-weight: 600;">${teamEmoji}</span><span class="event-text">${text}</span>`;
    if (eventsList.firstChild) eventsList.insertBefore(eventDiv, eventsList.firstChild);
    else eventsList.appendChild(eventDiv);
}

// ===== ОТРИСОВКА ПОЛЯ =====
function renderField(match) {
    const field = document.getElementById('football-field');
    if (!field) return;
    const markings = field.querySelector('.field-markings');
    const goalLeft = field.querySelector('.goal-left');
    const goalRight = field.querySelector('.goal-right');
    field.innerHTML = '';
    if (markings) field.appendChild(markings);
    if (goalLeft) field.appendChild(goalLeft);
    if (goalRight) field.appendChild(goalRight);

    if (!match.squad1) {
        const teamType = state.settings.teamType || 'world';
        match.squad1 = generateTeamSquad(match.team1.name, match.team1.id, teamType, true);
        match.squad2 = generateTeamSquad(match.team2.name, match.team2.id, teamType, false);
    }

    match.squad1.forEach((player, i) => {
        const el = document.createElement('div');
        el.className = `player team1 ${player.isGoalkeeper ? 'goalkeeper' : ''}`;
        el.style.cssText = `left:${player.x}%;top:${player.y}%;z-index:${10+i}`;
        el.innerText = player.number;
        el.id = `player-${match.team1.id}-${player.number}`;
        el.title = `${player.name} (#${player.number})`;
        field.appendChild(el);
    });
    match.squad2.forEach((player, i) => {
        const el = document.createElement('div');
        el.className = `player team2 ${player.isGoalkeeper ? 'goalkeeper' : ''}`;
        el.style.cssText = `left:${player.x}%;top:${player.y}%;z-index:${10+i}`;
        el.innerText = player.number;
        el.id = `player-${match.team2.id}-${player.number}`;
        el.title = `${player.name} (#${player.number})`;
        field.appendChild(el);
    });

    const ball = document.createElement('div');
    ball.className = 'ball';
    ball.id = 'match-ball';
    ball.innerText = '⚽';
    ball.style.cssText = 'left:50%;top:50%;z-index:100';
    field.appendChild(ball);

    const t1 = document.getElementById('team1-name');
    const t2 = document.getElementById('team2-name');
    if (t1) t1.innerText = match.team1.name;
    if (t2) t2.innerText = match.team2.name;
}

function updatePlayerPosition(match, teamId, num, x, y) {
    const el = document.getElementById(`player-${teamId}-${num}`);
    if (el) { el.style.left = `${x}%`; el.style.top = `${y}%`; }
}

function updateBallPosition(x, y) {
    const ball = document.getElementById('match-ball');
    if (ball) { ball.style.left = `${x}%`; ball.style.top = `${y}%`; }
}

function highlightPlayerWithBall(match, teamId, num) {
    document.querySelectorAll('.player.has-ball').forEach(el => el.classList.remove('has-ball'));
    const el = document.getElementById(`player-${teamId}-${num}`);
    if (el) el.classList.add('has-ball');
}

function initMatchStats(match) {
    match.stats = {
        possession: { team1: 50, team2: 50 },
        shots: { team1: 0, team2: 0 },
        shotsOnTarget: { team1: 0, team2: 0 },
        corners: { team1: 0, team2: 0 },
        fouls: { team1: 0, team2: 0 },
        yellowCards: { team1: 0, team2: 0 },
        redCards: { team1: 0, team2: 0 },
        substitutions: { team1: [], team2: [] }
    };
}

function updateStatsDisplay(match) {
    if (!match.stats) return;
    const poss1 = Math.max(0, Math.min(100, match.stats.possession.team1));
    const poss2 = 100 - poss1;
    const els = {
        'possession-bar-1': { type: 'width', val: poss1 + '%' },
        'possession-bar-2': { type: 'width', val: poss2 + '%' },
        'possession-1': { type: 'text', val: poss1 + '%' },
        'possession-2': { type: 'text', val: poss2 + '%' },
        'shots-1': { type: 'text', val: match.stats.shots.team1 },
        'shots-2': { type: 'text', val: match.stats.shots.team2 },
        'shots-on-target-1': { type: 'text', val: match.stats.shotsOnTarget.team1 },
        'shots-on-target-2': { type: 'text', val: match.stats.shotsOnTarget.team2 },
        'corners-1': { type: 'text', val: match.stats.corners.team1 },
        'corners-2': { type: 'text', val: match.stats.corners.team2 },
        'fouls-1': { type: 'text', val: match.stats.fouls.team1 },
        'fouls-2': { type: 'text', val: match.stats.fouls.team2 },
        'yellow-1': { type: 'text', val: match.stats.yellowCards.team1 },
        'red-1': { type: 'text', val: match.stats.redCards.team1 },
        'yellow-2': { type: 'text', val: match.stats.yellowCards.team2 },
        'red-2': { type: 'text', val: match.stats.redCards.team2 }
    };
    Object.keys(els).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (els[id].type === 'width') el.style.width = els[id].val;
            else el.innerText = els[id].val;
        }
    });
}

function showCard(match, teamId, type) {
    const key = teamId === match.team1.id ? 'team1' : 'team2';
    if (type === 'yellow') match.stats.yellowCards[key]++;
    else match.stats.redCards[key]++;
    updateStatsDisplay(match);
}

function makeSubstitution(match, teamId, out, in_p, min) {
    const key = teamId === match.team1.id ? 'team1' : 'team2';
    match.stats.substitutions[key].push({ out, in: in_p, minute: min });
    renderSubstitutions(match);
}

function renderSubstitutions(match) {
    const panel = document.getElementById('substitutions-panel');
    const slots = document.getElementById('substitution-slots');
    if (!panel || !slots) return;
    const s1 = match.stats.substitutions.team1;
    const s2 = match.stats.substitutions.team2;
    if (s1.length > 0 || s2.length > 0) panel.style.display = 'block';
    slots.innerHTML = `
        <div><strong style="color:var(--accent-primary);margin-bottom:10px;display:block">${match.team1.name}</strong>${s1.map(s => `<div class="sub-slot used"><span class="sub-number">${s.out}</span><span class="sub-player">→ ${s.in}</span><span class="sub-time">${s.minute}'</span></div>`).join('')}</div>
        <div><strong style="color:var(--highlight);margin-bottom:10px;display:block">${match.team2.name}</strong>${s2.map(s => `<div class="sub-slot used"><span class="sub-number">${s.out}</span><span class="sub-player">→ ${s.in}</span><span class="sub-time">${s.minute}'</span></div>`).join('')}</div>
    `;
}

function generateRandomEvent(match, min) {
    const rand = Math.random();
    const team = Math.random() < getTeam1EdgeProbability(match) ? 'team1' : 'team2';
    const teamObj = team === 'team1' ? match.team1 : match.team2;
    const redDiff = match.stats.redCards.team1 - match.stats.redCards.team2;
    let adv = 0;
    if (redDiff < 0) adv = team === 'team1' ? 0.1 : -0.1;
    else if (redDiff > 0) adv = team === 'team2' ? 0.1 : -0.1;

    if (rand < 0.15 + adv) {
        match.stats.shots[team]++;
        const onTarget = Math.random() < 0.4;
        if (onTarget) {
            match.stats.shotsOnTarget[team]++;
            if (Math.random() < 0.5) return { type: 'goal', team: teamObj, onTarget: true };
            return { type: 'shot', team: teamObj, onTarget: true };
        }
        addMatchEvent(match, min, 'shot-off', 'Удар мимо', teamObj);
        return { type: 'shot-off', team: teamObj, onTarget: false };
    }
    if (rand < 0.20) {
        match.stats.corners[team]++;
        addMatchEvent(match, min, 'corner', 'Угловой', teamObj);
        return { type: 'corner', team: teamObj };
    }
    if (rand < 0.30) {
        match.stats.fouls[team]++;
        if (Math.random() < 0.2) {
            const cardType = Math.random() < 0.85 ? 'yellow' : 'red';
            showCard(match, teamObj.id, cardType);
            addMatchEvent(match, min, `card-${cardType}`, cardType === 'yellow' ? 'Жёлтая карточка' : 'Красная карточка', teamObj);
            return { type: 'card', team: teamObj, card: cardType };
        }
        addMatchEvent(match, min, 'foul', 'Фол', teamObj);
        return { type: 'foul', team: teamObj };
    }
    if (min > 60 && rand < 0.33 && match.stats.substitutions[team].length < 3) {
        const squad = team === 'team1' ? match.squad1 : match.squad2;
        const out = squad[Math.floor(Math.random() * squad.length)];
        const in_p = { number: 12 + match.stats.substitutions[team].length, name: `${teamObj.name} SUB` };
        makeSubstitution(match, teamObj.id, out.number, in_p.name, min);
        addMatchEvent(match, min, 'substitution', `Замена: ${out.number} → ${in_p.number}`, teamObj);
        return { type: 'substitution', team: teamObj, out: out.number, in: in_p.name };
    }
    return null;
}

// ===== ВЗВЕШЕННЫЙ ВЫБОР ИГРОКА ДЛЯ ГОЛА =====
function selectGoalScorer(fieldPlayers) {
    const forwards = fieldPlayers.filter(p => p.position === 'FWD');
    const midfielders = fieldPlayers.filter(p => p.position === 'MID');
    const defenders = fieldPlayers.filter(p => p.position === 'DEF');
    
    const rand = Math.random() * 100;
    let selectedGroup;
    
    if (rand < 70 && forwards.length > 0) {
        selectedGroup = forwards;
    } else if (rand < 95 && midfielders.length > 0) {
        selectedGroup = midfielders;
    } else if (defenders.length > 0) {
        selectedGroup = defenders;
    } else if (midfielders.length > 0) {
        selectedGroup = midfielders;
    } else {
        selectedGroup = forwards.length > 0 ? forwards : fieldPlayers;
    }
    
    return selectedGroup[Math.floor(Math.random() * selectedGroup.length)];
}

// ===== ВЗВЕШЕННЫЙ ВЫБОР ИГРОКА ДЛЯ АССИСТА =====
function selectAssistProvider(fieldPlayers, scorer) {
    const forwards = fieldPlayers.filter(p => p.position === 'FWD' && p.number !== scorer.number);
    const midfielders = fieldPlayers.filter(p => p.position === 'MID' && p.number !== scorer.number);
    const defenders = fieldPlayers.filter(p => p.position === 'DEF' && p.number !== scorer.number);
    
    const rand = Math.random() * 100;
    let selectedGroup;
    
    if (rand < 45 && forwards.length > 0) {
        selectedGroup = forwards;
    } else if (rand < 90 && midfielders.length > 0) {
        selectedGroup = midfielders;
    } else if (defenders.length > 0) {
        selectedGroup = defenders;
    } else if (midfielders.length > 0) {
        selectedGroup = midfielders;
    } else {
        selectedGroup = forwards.length > 0 ? forwards : fieldPlayers.filter(p => p.number !== scorer.number);
    }
    
    return selectedGroup[Math.floor(Math.random() * selectedGroup.length)];
}

// ===== КОНФИГУРАЦИЯ =====
const state = {
    teams: [], matches: [], groups: [], settings: {},
    activeMatch: null, tournamentHistory: [],
    currentRound: 0, userTeam: null,
    gameMode: 'simulator', userTeamEliminated: false
};
let selectedTeamsForCareer = [];
let simulationInterval;
let currentMatchSpeed = 5;

// ===== КЛАССЫ =====
class Team {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.rating = teamRatings[name] || Math.floor(Math.random() * 20) + 70;
        this.stats = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, yellowCards: 0, redCards: 0 };
    }
}

class Match {
    constructor(id, t1, t2, legs = 1, stage = 'group', roundName = '', roundIndex = 0) {
        this.id = id;
        this.team1 = t1;
        this.team2 = t2;
        this.legs = legs;
        this.stage = stage;
        this.roundName = roundName;
        this.roundIndex = roundIndex;
        this.isFinished = false;
        this.isFinal = false;
        this.leg1 = { t1: 0, t2: 0 };
        this.leg2 = { t1: 0, t2: 0 };
        this.currentLeg = 1;
        this.score1 = 0;
        this.score2 = 0;
        this.penalties = { t1: 0, t2: 0, kicks: [] };
        this.winner = null;
        this.isAutoSimulated = false;
        this.squad1 = null;
        this.squad2 = null;
        this.stats = null;
    }
    get aggregateScore() {
        if (this.legs === 2) return { t1: this.leg1.t1 + this.leg2.t1, t2: this.leg1.t2 + this.leg2.t2 };
        return { t1: this.score1, t2: this.score2 };
    }
}

// ===== УПРАВЛЕНИЕ =====
const screens = {
    setup: document.getElementById('screen-setup'),
    teamSelect: document.getElementById('screen-team-select'),
    teamsList: document.getElementById('screen-teams-list'),
    dashboard: document.getElementById('screen-dashboard'),
    match: document.getElementById('screen-match'),
    results: document.getElementById('screen-results')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
}

// ===== ВАЛИДАЦИЯ =====
const teamCountInput = document.getElementById('team-count');
const tournamentModeSelect = document.getElementById('tournament-mode');
const gameModeSelect = document.getElementById('game-mode');
const warningMsg = document.getElementById('warning-msg');

function validateTeamCount() {
    const count = parseInt(teamCountInput.value);
    const mode = tournamentModeSelect.value;
    const teamType = document.getElementById('team-type').value;
    
    const startBtn = document.getElementById('btn-start');
    const fail = (msg) => {
        warningMsg.style.display = 'block';
        warningMsg.innerText = msg;
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';
        return false;
    };

    const maxTeams = getTeamsData(teamType).names.length;

    // Плей-офф работает только на степенях двойки (4, 8, 16, 32)
    const isPowerOfTwo = count >= 2 && (count & (count - 1)) === 0;
    if (!isPowerOfTwo) return fail('⚠️ Количество команд должно быть 4, 8, 16 или 32');
    if (count > maxTeams) return fail(`⚠️ Максимум ${maxTeams} команд для этого типа`);
    if (mode === 'groups' && count < 8) return fail('⚠️ Для групп нужно минимум 8 команд');

    warningMsg.style.display = 'none';
    startBtn.disabled = false;
    startBtn.style.opacity = '1';
    return true;
}

function getTeamsData(teamType) {
    if (teamType === 'mixed') return mixedTeams;
    return teamType === 'russia' ? russianTeams : worldTeams;
}

teamCountInput.addEventListener('change', validateTeamCount);
tournamentModeSelect.addEventListener('change', validateTeamCount);
document.getElementById('team-type').addEventListener('change', validateTeamCount);
validateTeamCount();

function getRoundName(count) {
    if (count === 2) return "Финал";
    if (count === 4) return "Полуфинал";
    if (count === 8) return "1/4 финала";
    if (count === 16) return "1/8 финала";
    if (count === 32) return "1/16 финала";
    return "1/" + count + " финала";
}

function getRoundIndex(count) {
    if (count === 2) return 3;
    if (count === 4) return 2;
    if (count === 8) return 1;
    if (count === 16) return 0;
    if (count === 32) return -1;
    return 0;
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.getElementById('btn-start').addEventListener('click', async () => {
    if (!validateTeamCount()) return;
    if (Object.keys(teamSquads).length === 0) await loadTeamSquads();
    
    state.settings.gameMode = gameModeSelect.value;
    state.userTeam = null;
    if (state.settings.gameMode === 'career') showTeamSelect();
    else { selectedTeamsForCareer = []; await initTournament(); }
});

function pickRandomTeams(teamType, count) {
    const teamsData = getTeamsData(teamType);
    const available = Array.from({ length: teamsData.names.length }, (_, i) => i);
    const picked = [];
    for (let i = 0; i < count && available.length > 0; i++) {
        const r = Math.floor(Math.random() * available.length);
        picked.push(available.splice(r, 1)[0]);
    }
    return picked.map(idx => ({
        name: teamsData.names[idx],
        emoji: teamsData.emojis[idx] || '⚽',
        rating: teamRatings[teamsData.names[idx]] || Math.floor(Math.random() * 20) + 70
    }));
}

function isUserMatch(m) {
    return state.settings.gameMode === 'career' && state.userTeam &&
        (m.team1.id === state.userTeam.id || m.team2.id === state.userTeam.id);
}

document.getElementById('btn-back-setup').addEventListener('click', () => showScreen('setup'));

// ===== ЭКРАН ВЫБОРА КОМАНДЫ =====
function showTeamSelect() {
    const count = parseInt(teamCountInput.value);
    const teamType = document.getElementById('team-type').value;

    selectedTeamsForCareer = pickRandomTeams(teamType, count);
    state.userTeam = null;

    const list = document.getElementById('team-select-list');
    list.innerHTML = '';

    selectedTeamsForCareer.forEach(teamData => {
        const card = document.createElement('div');
        card.className = 'team-select-card';
        card.innerHTML = `<span class="team-emoji">${teamData.emoji}</span><h3>${teamData.name}</h3><div class="rating">Рейтинг: ${teamData.rating}</div>`;
        card.onclick = () => {
            document.querySelectorAll('.team-select-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.userTeam = teamData;
        };
        list.appendChild(card);
    });
    
    const btn = document.createElement('button');
    btn.id = 'btn-confirm-team';
    btn.className = 'btn-primary btn-glow';
    btn.style.marginTop = '20px';
    btn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">Далее →</span>';
    btn.onclick = () => {
        if (!state.userTeam) { alert('⚠️ Выберите команду!'); return; }
        initTournament();
    };
    list.appendChild(btn);
    showScreen('teamSelect');
}

// ===== ОТОБРАЖЕНИЕ СПИСКА КОМАНД =====
function renderTeamsList(teams, userTeam = null) {
    const container = document.getElementById('teams-list-container');
    if (!container) return;
    
    const sortedTeams = [...teams].sort((a, b) => b.rating - a.rating);
    
    container.innerHTML = sortedTeams.map((team, index) => {
        let ratingClass = 'rating-medium';
        if (team.rating >= 90) ratingClass = 'rating-high';
        else if (team.rating < 80) ratingClass = 'rating-low';
        
        const isUserTeam = userTeam && team.name === userTeam.name;
        
        return `
            <div class="team-list-item ${isUserTeam ? 'user-team' : ''}">
                <span class="team-num">${index + 1}.</span>
                <div class="team-info">
                    <span class="team-emoji">${team.emoji || '⚽'}</span>
                    <span class="team-name">${team.name}${isUserTeam ? ' ⚽' : ''}</span>
                </div>
                <span class="team-rating ${ratingClass}">${team.rating}</span>
                <span class="team-badge">${getRatingBadge(team.rating)}</span>
            </div>
        `;
    }).join('');
}

function getRatingBadge(rating) {
    if (rating >= 90) return '⭐⭐⭐';
    if (rating >= 85) return '⭐⭐';
    if (rating >= 80) return '⭐';
    return '○';
}

// ===== ИНИЦИАЛИЗАЦИЯ ТУРНИРА =====
async function initTournament() {
    const count = parseInt(teamCountInput.value);
    const mode = tournamentModeSelect.value;
    const teamType = document.getElementById('team-type').value;
    
    if (Object.keys(teamSquads).length === 0) await loadTeamSquads();
    
    state.settings = {
        count, mode, teamType,
        gameMode: state.settings.gameMode || 'simulator',
        simMode: document.getElementById('sim-mode').value,
        groupLegs: parseInt(document.getElementById('group-legs').value),
        playoffLegs: parseInt(document.getElementById('playoff-legs').value)
    };
    
    state.teams = [];
    state.tournamentHistory = [];
    state.currentRound = 0;
    state.userTeamEliminated = false;
    
    // В карьере берём ровно тех участников, что были показаны на экране выбора команды
    const isCareer = state.settings.gameMode === 'career';
    const teamsPool = isCareer && selectedTeamsForCareer.length === count
        ? selectedTeamsForCareer
        : pickRandomTeams(teamType, count);

    const userTeamName = isCareer && state.userTeam ? state.userTeam.name : null;
    if (!isCareer) state.userTeam = null;

    teamsPool.forEach((data, i) => {
        const team = new Team(i, data.name);
        team.emoji = data.emoji;
        team.rating = data.rating;
        state.teams.push(team);
        if (userTeamName === data.name) state.userTeam = team;
    });

    renderTeamsList(state.teams, state.userTeam);
    showScreen('teamsList');

    initPlayerStats(teamType);

    if (mode === 'groups') createGroups();
    else {
        const roundName = getRoundName(count);
        const roundIndex = getRoundIndex(count);
        createKnockoutRound(state.teams, roundName, roundIndex);
    }
    
    const badge = document.getElementById('user-team-badge');
    if (state.settings.gameMode === 'career' && state.userTeam && badge) {
        badge.style.display = 'inline-block';
        badge.innerText = `${state.userTeam.emoji} ${state.userTeam.name}`;
    } else if (badge) badge.style.display = 'none';
}

function createGroups() {
    const groupCount = state.settings.count / 4;
    state.groups = Array.from({length: groupCount}, () => []);
    const shuffled = [...state.teams].sort(() => 0.5 - Math.random());
    shuffled.forEach((team, i) => state.groups[i % groupCount].push(team));
    generateGroupMatches();
}

function generateGroupMatches() {
    state.matches = [];
    let id = 0;
    state.groups.forEach((group, gi) => {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const legs = state.settings.groupLegs;
                if (legs === 1) {
                    state.matches.push(new Match(id++, group[i], group[j], 1, 'group', `Группа ${String.fromCharCode(65 + gi)}`, 0));
                } else {
                    state.matches.push(new Match(id++, group[i], group[j], 1, 'group', `Группа ${String.fromCharCode(65 + gi)} (1)`, 0));
                    state.matches.push(new Match(id++, group[j], group[i], 1, 'group', `Группа ${String.fromCharCode(65 + gi)} (2)`, 0));
                }
            }
        }
    });
    document.getElementById('dashboard-title').innerText = "Групповой этап";
}

function createKnockoutRound(teams, roundName, roundIndex) {
    state.matches = [];
    state.currentRound = roundIndex;
    state.tournamentHistory.push({ round: roundName, matches: [], roundIndex });
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const isFinal = roundIndex === 3 || shuffled.length === 2;
    const legs = isFinal ? 1 : state.settings.playoffLegs;
    for (let i = 0; i < shuffled.length; i += 2) {
        const match = new Match(i/2, shuffled[i], shuffled[i+1], legs, 'playoff', roundName, roundIndex);
        match.isFinal = isFinal;
        state.matches.push(match);
        state.tournamentHistory[state.tournamentHistory.length - 1].matches.push(match);
    }
    document.getElementById('dashboard-title').innerText = roundName;
}

// ===== ГЕНЕРАЦИЯ СЧЁТА (учитывает режим симуляции) =====
function scoreForTeam(teamRating, opponentRating) {
    if (state.settings.simMode === 'random') {
        // Чистый рандом: кубик 0-6
        return Math.floor(Math.random() * 7);
    }
    // Реализм: ожидаемые голы зависят от разницы рейтингов
    const ratingDiff = (teamRating || 75) - (opponentRating || 75);
    const expectedGoals = Math.max(0.3, 1.4 + ratingDiff * 0.08);
    // Пуассоновское распределение — естественный разброс счёта
    const L = Math.exp(-expectedGoals);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return Math.min(7, k - 1);
}

function ensureSquads(match) {
    if (!match.squad1) {
        const teamType = state.settings.teamType || 'world';
        match.squad1 = generateTeamSquad(match.team1.name, match.team1.id, teamType, true);
        match.squad2 = generateTeamSquad(match.team2.name, match.team2.id, teamType, false);
    }
}

function recordGoals(teamId, teamFieldPlayers, goalsCount) {
    for (let i = 0; i < goalsCount; i++) {
        const scorer = selectGoalScorer(teamFieldPlayers);
        addPlayerGoal(teamId, scorer.number);
        if (Math.random() < 0.85) {
            const assister = selectAssistProvider(teamFieldPlayers, scorer);
            if (assister) addPlayerAssist(teamId, assister.number);
        }
    }
}

// ===== АВТО-СИМУЛЯЦИЯ С УЧЁТОМ РЕЙТИНГА =====
function autoSimulateMatch(match) {
    const rating1 = match.team1.rating || 75;
    const rating2 = match.team2.rating || 75;

    ensureSquads(match);

    const team1FieldPlayers = match.squad1.filter(p => p.position !== 'GK');
    const team2FieldPlayers = match.squad2.filter(p => p.position !== 'GK');

    if (match.legs === 2) {
        match.leg1.t1 = scoreForTeam(rating1, rating2);
        match.leg1.t2 = scoreForTeam(rating2, rating1);
        match.leg2.t1 = scoreForTeam(rating1, rating2);
        match.leg2.t2 = scoreForTeam(rating2, rating1);
        
        recordGoals(match.team1.id, team1FieldPlayers, match.leg1.t1);
        recordGoals(match.team2.id, team2FieldPlayers, match.leg1.t2);
        recordGoals(match.team1.id, team1FieldPlayers, match.leg2.t1);
        recordGoals(match.team2.id, team2FieldPlayers, match.leg2.t2);
    } else {
        match.score1 = scoreForTeam(rating1, rating2);
        match.score2 = scoreForTeam(rating2, rating1);
        
        recordGoals(match.team1.id, team1FieldPlayers, match.score1);
        recordGoals(match.team2.id, team2FieldPlayers, match.score2);
    }
    
    const agg = match.aggregateScore;
    
    if (match.stage === 'playoff' && agg.t1 === agg.t2) {
        let k1 = 0, k2 = 0, s1 = 0, s2 = 0, suddenDeath = false;
        while (true) {
            const t1Turn = k1 === k2;
            const team = t1Turn ? match.team1 : match.team2;
            const opponent = t1Turn ? match.team2 : match.team1;
            const baseFactor = 0.70;
            const ratingBonus = (team.rating - opponent.rating) * 0.008;
            const ratingFactor = Math.max(0.4, Math.min(0.95, baseFactor + ratingBonus));
            const scored = Math.random() < ratingFactor;
            
            if (t1Turn) { k1++; if (scored) { s1++; match.penalties.t1++; } match.penalties.kicks.push({ team: match.team1.name, scored, number: k1 + k2 }); }
            else { k2++; if (scored) { s2++; match.penalties.t2++; } match.penalties.kicks.push({ team: match.team2.name, scored, number: k1 + k2 }); }
            const r1 = 5 - k1, r2 = 5 - k2;
            if (!suddenDeath && k1 <= 5 && k2 <= 5) { if (s1 > s2 + r2) { match.winner = match.team1; break; } if (s2 > s1 + r1) { match.winner = match.team2; break; } }
            if (k1 >= 5 && k2 >= 5) suddenDeath = true;
            if (suddenDeath && k1 === k2 && s1 !== s2) { match.winner = s1 > s2 ? match.team1 : match.team2; break; }
            if (k1 + k2 > 20) { match.winner = Math.random() > 0.5 ? match.team1 : match.team2; break; }
        }
    } else {
        match.winner = agg.t1 > agg.t2 ? match.team1 : (agg.t2 > agg.t1 ? match.team2 : null);
    }
    
    match.isFinished = true;
    match.isAutoSimulated = true;
    
    if (match.squad1) match.squad1.forEach(player => addPlayerMatch(match.team1.id, player.number));
    if (match.squad2) match.squad2.forEach(player => addPlayerMatch(match.team2.id, player.number));
    
    const isDraw = agg.t1 === agg.t2;
    updateStats(match.team1, agg.t1, agg.t2, isDraw ? null : (match.winner === match.team1));
    updateStats(match.team2, agg.t2, agg.t1, isDraw ? null : (match.winner === match.team2));
}

function autoSimulateAllRemainingMatches() {
    state.matches.forEach(m => { if (!m.isFinished && !m.isAutoSimulated) autoSimulateMatch(m); });
}

function createPlayoffFromGroups() {
    const playoffTeams = [];
    state.groups.forEach((group, idx) => {
        group.sort((a,b) => {
            if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
            return (b.stats.gf - b.stats.ga) - (a.stats.gf - a.stats.ga);
        });
        playoffTeams.push({ team: group[0], groupIndex: idx, position: 1 });
        playoffTeams.push({ team: group[1], groupIndex: idx, position: 2 });
    });
    const groupWinners = playoffTeams.filter(t => t.position === 1).sort((a, b) => a.groupIndex - b.groupIndex);
    const groupRunnersUp = playoffTeams.filter(t => t.position === 2).sort((a, b) => a.groupIndex - b.groupIndex);
    const matches = [];
    for (let i = 0; i < groupWinners.length; i++) {
        const opponentIndex = (i + 1) % groupRunnersUp.length;
        matches.push([groupWinners[i].team, groupRunnersUp[opponentIndex].team]);
    }
    return matches;
}

// ===== СЕТКА =====
function renderBracket() {
    const bracketDiv = document.getElementById('playoff-bracket');
    const bracketContainer = document.getElementById('bracket-container');
    if (!bracketContainer) return;
    bracketContainer.innerHTML = '';
    
    if (state.settings.mode === 'knockout' || state.tournamentHistory.some(r => r.matches.some(m => m.stage === 'playoff'))) {
        bracketDiv.style.display = 'block';
        document.getElementById('content-area').style.display = 'none';
        
        const playoffRounds = state.tournamentHistory.filter(r => r.matches[0]?.stage === 'playoff');
        const progressHTML = `<div class="tournament-progress">${playoffRounds.map((r, i) => {
            const isCurrent = i === playoffRounds.length - 1;
            return `<div class="progress-step active ${isCurrent ? '' : 'completed'}">${r.round}</div>`;
        }).join('')}</div>`;
        bracketDiv.querySelector('.tournament-progress')?.remove();
        bracketDiv.insertAdjacentHTML('afterbegin', progressHTML);
        
        const icons = ["🏟️", "🔥", "", "🏆"];
        state.tournamentHistory.forEach(hr => {
            if (hr.matches[0]?.stage !== 'playoff') return;
            const roundDiv = document.createElement('div');
            roundDiv.className = 'bracket-round';
            const title = document.createElement('div');
            title.className = 'bracket-round-title';
            title.innerHTML = `${icons[hr.roundIndex] || '🎮'} ${hr.round}`;
            roundDiv.appendChild(title);
            
            hr.matches.forEach(m => {
                const agg = m.aggregateScore;
                const matchDiv = document.createElement('div');
                matchDiv.className = 'bracket-match';
                if (state.settings.gameMode === 'career' && state.userTeam && (m.team1.id === state.userTeam.id || m.team2.id === state.userTeam.id)) matchDiv.classList.add('user-team');
                if (m.isFinished) matchDiv.classList.add('played');
                if (m.isFinal) matchDiv.classList.add('final');
                
                const t1W = m.winner === m.team1 ? 'winner' : (m.isFinished && m.stage === 'playoff' ? 'loser' : '');
                const t2W = m.winner === m.team2 ? 'winner' : (m.isFinished && m.stage === 'playoff' ? 'loser' : '');
                
                const penKicks = m.penalties.kicks.length > 0 ? `<div class="penalty-details"><div style="margin-bottom:8px;font-size:12px;font-weight:bold;color:#e94560">⚽ Пенальти:</div><div style="display:flex;flex-wrap:wrap;align-items:center;gap:5px"><span style="font-size:11px;color:#888">${m.team1.name}:</span>${m.penalties.kicks.filter(k => k.team === m.team1.name).map(k => `<span class="penalty-kick ${k.scored ? 'penalty-goal' : 'penalty-miss'}">${k.scored ? '⚽' : '❌'}</span>`).join('')}<span style="margin:0 10px;color:#4cc9f0;font-weight:bold">${m.penalties.t1}</span><span style="font-size:11px;color:#888">|</span><span style="margin:0 5px;font-size:11px;color:#888">${m.team2.name}:</span>${m.penalties.kicks.filter(k => k.team === m.team2.name).map(k => `<span class="penalty-kick ${k.scored ? 'penalty-goal' : 'penalty-miss'}">${k.scored ? '⚽' : '❌'}</span>`).join('')}<span style="margin:0 10px;color:#4cc9f0;font-weight:bold">${m.penalties.t2}</span></div></div>` : '';
                
                const legsInfo = m.legs === 2 && m.isFinished ? `<div class="bracket-match-info"><div>1-й: ${m.leg1.t1}:${m.leg1.t2}</div><div>2-й: ${m.leg2.t1}:${m.leg2.t2}</div><div style="margin-top:5px;font-weight:bold;color:var(--gold)">Итого: ${agg.t1}:${agg.t2}</div></div>` : (m.isFinal ? '<div class="bracket-match-info final-label">🏆 ГЛАВНЫЙ МАТЧ</div>' : '');
                const autoBadge = m.isAutoSimulated ? '<span style="font-size:10px;color:#888">🤖 Авто</span>' : '';
                
                matchDiv.innerHTML = `<div class="bracket-team ${t1W}"><span style="flex:1">${m.team1.emoji || '⚽'} ${m.team1.name}</span><span class="bracket-score">${m.isFinished ? agg.t1 : '-'}</span></div><div class="bracket-team ${t2W}"><span style="flex:1">${m.team2.emoji || '⚽'} ${m.team2.name}</span><span class="bracket-score">${m.isFinished ? agg.t2 : '-'}</span></div>${legsInfo}${penKicks}${autoBadge}`;
                if (!m.isFinished && (state.settings.gameMode === 'simulator' || (state.userTeam && (m.team1.id === state.userTeam.id || m.team2.id === state.userTeam.id)))) matchDiv.onclick = () => openMatchScreen(m);
                roundDiv.appendChild(matchDiv);
            });
            bracketContainer.appendChild(roundDiv);
        });
    } else {
        bracketDiv.style.display = 'none';
        document.getElementById('content-area').style.display = 'block';
    }
}

// ===== ДАШБОРД =====
function renderDashboard() {
    // Карьера: если у команды игрока нет матчей в этом этапе — досчитываем остальные автоматически
    if (state.settings.gameMode === 'career' && !state.matches.some(m => !m.isFinished && isUserMatch(m))) {
        autoSimulateAllRemainingMatches();
    }

    renderBracket();
    renderTopScorersTable(getActiveStatTab());

    const list = document.getElementById('matches-list');
    if (list) list.innerHTML = '';
    
    if (state.settings.mode === 'groups' && state.currentRound === 0) {
        const area = document.getElementById('content-area');
        if (area) {
            area.innerHTML = '';
            state.groups.forEach((group, idx) => {
                area.innerHTML += `<div class="table-container"><h4>Группа ${String.fromCharCode(65 + idx)}</h4><table><tr><th>Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>О</th><th>РМ</th></tr>${group.sort((a,b) => { if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points; return (b.stats.gf - b.stats.ga) - (a.stats.gf - a.stats.ga); }).map(t => `<tr style="${state.userTeam && t.id === state.userTeam.id ? 'background:rgba(233,69,96,0.2)' : ''}"><td>${t.emoji || '⚽'} ${t.name} ${state.userTeam && t.id === state.userTeam.id ? '⚽' : ''}</td><td>${t.stats.played}</td><td>${t.stats.won}</td><td>${t.stats.drawn}</td><td>${t.stats.lost}</td><td><b>${t.stats.points}</b></td><td>${t.stats.gf - t.stats.ga}</td></tr>`).join('')}</table></div>`;
            });
        }
    }
    
    if (document.getElementById('playoff-bracket').style.display !== 'block') {
        const unfinished = state.matches.filter(m => !m.isFinished);
        const finished = state.matches.filter(m => m.isFinished);
        if (list) list.innerHTML = '<h3>Матчи:</h3>';

        finished.forEach(m => {
            const agg = m.aggregateScore;
            const penInfo = m.penalties.t1 || m.penalties.t2 ? ` (пен. ${m.penalties.t1}:${m.penalties.t2})` : '';
            const drawInfo = m.stage === 'group' && agg.t1 === agg.t2 ? ' (Ничья)' : '';
            const legsInfo = m.legs === 2 ? ` (${m.leg1.t1}:${m.leg1.t2}, ${m.leg2.t1}:${m.leg2.t2})` : '';
            const autoBadge = m.isAutoSimulated ? ' 🤖' : '';
            if (list) list.innerHTML += `<div class="match-result"><b>${m.team1.emoji || '⚽'} ${m.team1.name}</b> ${agg.t1}:${agg.t2} <b>${m.team2.emoji || '⚽'} ${m.team2.name}</b>${legsInfo}${penInfo}${drawInfo}${autoBadge}<br><small>${m.stage === 'group' && agg.t1 === agg.t2 ? 'Ничья' : 'Победитель: ' + (m.winner?.name || '-')}</small></div>`;
        });
        
        if (unfinished.length > 0) {
            if (list) list.innerHTML += '<h4>Предстоящие:</h4>';
            unfinished.forEach(m => {
                const isUser = state.settings.gameMode === 'career' && state.userTeam && (m.team1.id === state.userTeam.id || m.team2.id === state.userTeam.id);
                if (state.settings.gameMode === 'career' && !isUser) return;
                const btn = document.createElement('button');
                btn.className = 'btn-secondary';
                btn.style.marginBottom = '10px';
                btn.innerHTML = `⚽ ${m.team1.emoji || '⚽'} ${m.team1.name} vs ${m.team2.emoji || '⚽'} ${m.team2.name}${m.legs === 2 ? ' (1-й матч)' : ''}${isUser ? ' ⚽ ВАШ МАТЧ' : ''}`;
                btn.onclick = () => openMatchScreen(m);
                if (list) list.appendChild(btn);
            });
        }
    }
    
    const nextBtn = document.getElementById('btn-next-round');
    if (nextBtn) {
        if (state.matches.length > 0 && state.matches.every(m => m.isFinished)) {
            nextBtn.style.display = 'block';
            nextBtn.onclick = nextStage;
            nextBtn.innerHTML = '<span>➡️ Следующий раунд</span>';
            if (state.matches.length === 1 && state.currentRound >= 3) nextBtn.innerHTML = '<span>🏆 Результаты</span>';
        } else nextBtn.style.display = 'none';
    }
}

function nextStage() {
    const champion = advanceStage();
    if (champion) { showResults(champion); return; }
    renderDashboard();
}

// Переходит к следующему этапу. Возвращает чемпиона, если турнир завершён.
function advanceStage() {
    if (state.settings.mode === 'groups') {
        const pairs = createPlayoffFromGroups();
        state.settings.mode = 'knockout';
        const count = pairs.length * 2;
        const roundName = getRoundName(count);
        const roundIndex = getRoundIndex(count);
        state.matches = [];
        state.currentRound = roundIndex;
        state.tournamentHistory.push({ round: roundName, matches: [], roundIndex });
        pairs.forEach((pair, i) => {
            const match = new Match(i, pair[0], pair[1], state.settings.playoffLegs, 'playoff', roundName, roundIndex);
            state.matches.push(match);
            state.tournamentHistory[state.tournamentHistory.length - 1].matches.push(match);
        });
        document.getElementById('dashboard-title').innerText = roundName;
    } else {
        const winners = state.matches.map(m => m.winner).filter(w => w);
        if (winners.length === 1) return winners[0];
        createKnockoutRound(winners, getRoundName(winners.length), getRoundIndex(winners.length));
    }
    // Если команда игрока не попала в новый этап — она выбыла
    if (state.settings.gameMode === 'career' && state.userTeam && !state.matches.some(isUserMatch)) {
        state.userTeamEliminated = true;
    }
    return null;
}

function showResults(champion) {
    state.champion = champion;
    const el = document.getElementById('champion-name');
    if (el) el.innerText = `${champion.emoji || '🏆'} ${champion.name}`;
    
    const path = document.getElementById('tournament-path');
    if (path) {
        path.innerHTML = state.tournamentHistory.map(r => `<div style="margin:10px 0;padding:10px;background:rgba(26,26,62,0.8);border-radius:5px"><b>${r.round}</b><br>${r.matches.map(m => { const agg = m.aggregateScore; const legInfo = m.isFinal ? '🏆 ФИНАЛ' : (m.legs === 2 ? `(${m.leg1.t1}:${m.leg1.t2}, ${m.leg2.t1}:${m.leg2.t2})` : ''); const pen = m.penalties.kicks.length > 0 ? `<div style="font-size:11px;margin-top:5px">Пенальти: ${m.team1.name} ${m.penalties.t1} - ${m.team2.name} ${m.penalties.t2}<div>${m.penalties.kicks.map((k,i) => `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin:1px;font-size:10px;${k.scored ? 'background:#4cc9f0;color:#1a1a2e' : 'background:#e94560;color:white'}">${k.scored ? '⚽' : '❌'}</span>`).join('')}</div></div>` : ''; return `${m.team1.emoji || '⚽'} ${m.team1.name} ${agg.t1}:${agg.t2} ${m.team2.emoji || '⚽'} ${m.team2.name} ${legInfo}${pen}${m.isAutoSimulated ? ' 🤖' : ''}`; }).join('<br>')}</div>`).join('');
    }
    
    const statsEl = document.getElementById('teams-stats');
    if (statsEl) statsEl.innerHTML = state.teams.sort((a,b) => b.stats.points - a.stats.points).map(t => `<tr style="${state.userTeam && t.id === state.userTeam.id ? 'background:rgba(233,69,96,0.2)' : ''}"><td>${t.emoji || '⚽'} ${t.name} ${t.id === champion.id ? '👑' : ''} ${state.userTeam && t.id === state.userTeam.id ? '⚽' : ''}</td><td>${t.stats.played}</td><td>${t.stats.won}</td><td>${t.stats.points}</td><td>${t.stats.gf}-${t.stats.ga}</td></tr>`).join('');
    
    renderTopScorersTable('goals');
    renderFullScorersTable('goals');
    renderTournamentAwards();
    checkAchievements();
    renderAchievements();
    
    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) restartBtn.onclick = () => location.reload();
    showScreen('results');
}

// ===== МАТЧ =====
function openMatchScreen(match) {
    state.activeMatch = match;
    const eventsList = document.getElementById('events-list');
    if (eventsList) eventsList.innerHTML = '';
    const subPanel = document.getElementById('substitutions-panel');
    if (subPanel) { subPanel.style.display = 'none'; const slots = document.getElementById('substitution-slots'); if (slots) slots.innerHTML = ''; }
    
    const els = {
        'match-team-1': match.team1.name, 'match-team-2': match.team2.name,
        'team-1-logo': match.team1.emoji || '⚽', 'team-2-logo': match.team2.emoji || '⚽',
        'score-1': '0', 'score-2': '0', 'match-time': "00'", 'match-status': "LIVE",
        'match-stage-info': match.roundName
    };
    Object.keys(els).forEach(id => { const el = document.getElementById(id); if (el) el.innerText = els[id]; });
    
    setMatchInProgress(false);
    initMatchStats(match);
    renderField(match);
    updateStatsDisplay(match);
    
    ['btn-sim-match', 'btn-instant-match'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; });
    ['btn-next-match', 'btn-close-match'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    
    showScreen('match');
}

document.getElementById('btn-sim-match').onclick = () => {
    ['btn-sim-match', 'btn-instant-match'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    setMatchInProgress(true);
    startSimulation();
};

document.getElementById('btn-instant-match').onclick = () => {
    ['btn-sim-match', 'btn-instant-match'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    setMatchInProgress(true);
    instantResult();
};

document.querySelector('#screen-match .btn-back').onclick = () => {
    showScreen('dashboard');
    renderDashboard();
};

// Скорость матча: 1x = 1 сек на минуту, 10x = 0.1 сек
let onSpeedChange = null;
function getMatchInterval() { return Math.max(50, 1000 - (currentMatchSpeed - 1) * 100); }
document.getElementById('match-speed').addEventListener('input', function () {
    currentMatchSpeed = parseInt(this.value);
    document.getElementById('speed-value').innerText = currentMatchSpeed + 'x';
    if (onSpeedChange) onSpeedChange();
});

document.getElementById('btn-close-match').onclick = () => {
    clearInterval(simulationInterval);
    showScreen('dashboard');
    renderDashboard();
};

document.getElementById('btn-next-match').onclick = () => {
    clearInterval(simulationInterval);
    const next = state.matches.find(m => !m.isFinished);
    if (next) openMatchScreen(next);
    else { showScreen('dashboard'); renderDashboard(); }
};

// ===== БЫСТРЫЙ РЕЗУЛЬТАТ =====
function instantResult() {
    const m = state.activeMatch;
    const rating1 = m.team1.rating || 75;
    const rating2 = m.team2.rating || 75;

    ensureSquads(m);

    const team1FieldPlayers = m.squad1.filter(p => p.position !== 'GK');
    const team2FieldPlayers = m.squad2.filter(p => p.position !== 'GK');

    const addLog = text => addMatchEvent(m, '', 'half', text, null);
    
    if (m.legs === 2 && m.currentLeg === 1) {
        m.leg1.t1 = scoreForTeam(rating1, rating2);
        m.leg1.t2 = scoreForTeam(rating2, rating1);
        m.score1 = m.leg1.t1; m.score2 = m.leg1.t2;
        
        recordGoals(m.team1.id, team1FieldPlayers, m.leg1.t1);
        recordGoals(m.team2.id, team2FieldPlayers, m.leg1.t2);
        
        document.getElementById('score-1').innerText = m.score1;
        document.getElementById('score-2').innerText = m.score2;
        document.getElementById('match-time').innerText = "FT (1-й матч)";
        addLog(`🎲 1-й матч: ${m.team1.name} ${m.leg1.t1}:${m.leg1.t2} ${m.team2.name}`);
        
        setTimeout(() => {
            addLog("📊 Переход ко 2-му матчу...");
            m.currentLeg = 2; m.score1 = 0; m.score2 = 0;
            document.getElementById('match-time').innerText = "00' (2-й матч)";
            
            setTimeout(() => {
                m.leg2.t1 = scoreForTeam(rating1, rating2);
                m.leg2.t2 = scoreForTeam(rating2, rating1);
                m.score1 = m.leg2.t1; m.score2 = m.leg2.t2;
                
                recordGoals(m.team1.id, team1FieldPlayers, m.leg2.t1);
                recordGoals(m.team2.id, team2FieldPlayers, m.leg2.t2);
                
                const agg = m.aggregateScore;
                document.getElementById('score-1').innerText = agg.t1;
                document.getElementById('score-2').innerText = agg.t2;
                document.getElementById('match-time').innerText = "FT";
                addLog(`🎲 2-й матч: ${m.team1.name} ${m.leg2.t1}:${m.leg2.t2} ${m.team2.name}`);
                addLog(`📊 Итого: ${agg.t1}:${agg.t2}`);
                
                setTimeout(() => {
                    if (m.stage === 'playoff' && agg.t1 === agg.t2) runPenaltiesInstant(m, addLog);
                    else finishMatch(m, agg.t1 > agg.t2 ? m.team1 : (agg.t2 > agg.t1 ? m.team2 : null));
                }, 1000);
            }, 1500);
        }, 1000);
    } else {
        m.score1 = scoreForTeam(rating1, rating2);
        m.score2 = scoreForTeam(rating2, rating1);
        if (m.legs === 2) { m.leg2.t1 = m.score1; m.leg2.t2 = m.score2; }
        
        recordGoals(m.team1.id, team1FieldPlayers, m.score1);
        recordGoals(m.team2.id, team2FieldPlayers, m.score2);
        
        const agg = m.aggregateScore;
        document.getElementById('score-1').innerText = agg.t1;
        document.getElementById('score-2').innerText = agg.t2;
        document.getElementById('match-time').innerText = "FT";
        addLog(`🎲 ${m.team1.name} ${agg.t1}:${agg.t2} ${m.team2.name}`);
        
        setTimeout(() => {
            if (m.stage === 'playoff' && agg.t1 === agg.t2) runPenaltiesInstant(m, addLog);
            else finishMatch(m, agg.t1 > agg.t2 ? m.team1 : (agg.t2 > agg.t1 ? m.team2 : null));
        }, 1000);
    }
}

// ===== ПЕНАЛЬТИ =====
function runPenaltiesInstant(m, addLog) {
    let k1 = 0, k2 = 0, s1 = 0, s2 = 0, suddenDeath = false, maxKicks = 20;
    const kick = () => {
        if (k1 + k2 >= maxKicks) {
            const w = s1 > s2 ? m.team1 : (s2 > s1 ? m.team2 : (Math.random() > 0.5 ? m.team1 : m.team2));
            addLog(`🏁 Пенальти: ${m.team1.name} ${s1} - ${s2} ${m.team2.name}`);
            finishMatch(m, w);
            return;
        }
        const t1Turn = k1 === k2;
        const scored = Math.random() > 0.25;
        const team = t1Turn ? m.team1 : m.team2;
        m.penalties.kicks.push({ team: team.name, scored, number: k1 + k2 + 1 });
        if (t1Turn) {
            k1++;
            if (scored) { s1++; m.penalties.t1++; }
            addLog(`Пенальти ${team.name} (${k1}): ${scored ? '⚽ ГОЛ!' : '❌ МИМО!'}`);
        } else {
            k2++;
            if (scored) { s2++; m.penalties.t2++; }
            addLog(`Пенальти ${team.name} (${k2}): ${scored ? '⚽ ГОЛ!' : '❌ МИМО!'}`);
        }
        document.getElementById('match-time').innerText = `ПЕН ${s1}:${s2}`;
        const r1 = 5 - k1, r2 = 5 - k2;
        if (!suddenDeath && k1 <= 5 && k2 <= 5) {
            if (s1 > s2 + r2) {
                setTimeout(() => { addLog(`🏁 Пенальти: ${m.team1.name} ${s1} - ${s2} ${m.team2.name}`); finishMatch(m, m.team1); }, 1500);
                return;
            }
            if (s2 > s1 + r1) {
                setTimeout(() => { addLog(`🏁 Пенальти: ${m.team1.name} ${s1} - ${s2} ${m.team2.name}`); finishMatch(m, m.team2); }, 1500);
                return;
            }
        }
        if (k1 >= 5 && k2 >= 5) suddenDeath = true;
        if (suddenDeath && k1 === k2 && s1 !== s2) {
            setTimeout(() => { addLog(`🏁 Пенальти: ${m.team1.name} ${s1} - ${s2} ${m.team2.name}`); finishMatch(m, s1 > s2 ? m.team1 : m.team2); }, 1500);
            return;
        }
        setTimeout(kick, 1000);
    };
    addLog("🎲 Серия пенальти...");
    kick();
}

function runPenalties(m, update, log) {
    let k1 = 0, k2 = 0, s1 = 0, s2 = 0, suddenDeath = false, maxKicks = 20;
    const kick = () => {
        if (k1 + k2 >= maxKicks) {
            const w = s1 > s2 ? m.team1 : (s2 > s1 ? m.team2 : (Math.random() > 0.5 ? m.team1 : m.team2));
            log(`🏁 Пенальти: ${m.team1.name} ${s1} - ${s2} ${m.team2.name}`, true);
            finishMatch(m, w);
            return;
        }
        const t1 = k1 === k2;
        const scored = Math.random() > 0.25;
        const team = t1 ? m.team1 : m.team2;
        m.penalties.kicks.push({ team: team.name, scored, number: k1 + k2 + 1 });
        if (t1) {
            k1++;
            if (scored) { s1++; m.penalties.t1++; }
            log(`Пенальти ${team.name} (${k1}): ${scored ? '⚽' : '❌'}`, scored);
        } else {
            k2++;
            if (scored) { s2++; m.penalties.t2++; }
            log(`Пенальти ${team.name} (${k2}): ${scored ? '⚽' : '❌'}`, scored);
        }
        document.getElementById('match-time').innerText = `ПЕН ${s1}:${s2}`;
        const r1 = 5 - k1, r2 = 5 - k2;
        if (!suddenDeath && k1 <= 5 && k2 <= 5) {
            if (s1 > s2 + r2) { log(`🏁 Пенальти: ${m.team1.name} ${s1} - ${s2} ${m.team2.name}`, true); finishMatch(m, m.team1); return; }
            if (s2 > s1 + r1) { log(`🏁 Пенальти: ${m.team1.name} ${s1} - ${s2} ${m.team2.name}`, true); finishMatch(m, m.team2); return; }
        }
        if (k1 >= 5 && k2 >= 5) suddenDeath = true;
        if (suddenDeath && k1 === k2 && s1 !== s2) {
            log(`🏁 Пенальти: ${m.team1.name} ${s1} - ${s2} ${m.team2.name}`, true);
            finishMatch(m, s1 > s2 ? m.team1 : m.team2);
            return;
        }
        setTimeout(kick, 1200);
    };
    kick();
}

// ===== ЗАВЕРШЕНИЕ =====
function finishMatch(m, winner) {
    clearInterval(simulationInterval);
    onSpeedChange = null;
    m.isFinished = true;
    m.winner = winner;
    
    if (m.squad1) m.squad1.forEach(player => addPlayerMatch(m.team1.id, player.number));
    if (m.squad2) m.squad2.forEach(player => addPlayerMatch(m.team2.id, player.number));
    
    const agg = m.aggregateScore;
    const isDraw = agg.t1 === agg.t2;
    const team1Result = isDraw ? null : (winner === m.team1);
    const team2Result = isDraw ? null : (winner === m.team2);
    updateStats(m.team1, agg.t1, agg.t2, team1Result);
    updateStats(m.team2, agg.t2, agg.t1, team2Result);
    
    const legInfo = m.isFinal ? '🏆 ФИНАЛ' : (m.legs === 2 ? `(${m.leg1.t1}:${m.leg1.t2}, ${m.leg2.t1}:${m.leg2.t2})` : '');
    const pen = m.penalties.kicks.length > 0 ? ` (пен. ${m.penalties.t1}:${m.penalties.t2})` : '';
    const prefix = legInfo ? legInfo + ' | ' : '';
    let resultText;
    if (isDraw && m.stage === 'group') resultText = `${prefix}Ничья ${agg.t1}:${agg.t2} (по 1 очку)`;
    else if (winner) resultText = `${prefix}${winner.name} победил ${agg.t1}:${agg.t2}${pen}`;
    else resultText = `${prefix}Ничья ${agg.t1}:${agg.t2}${pen}`;
    addMatchEvent(m, 'FT', 'finish', resultText, null);

    const statusEl = document.getElementById('match-status');
    if (statusEl) statusEl.innerText = "FINISHED";
    setMatchInProgress(false);

    ['btn-sim-match', 'btn-instant-match'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const btnClose = document.getElementById('btn-close-match');
    if (btnClose) btnClose.style.display = 'flex';

    const isCareer = state.settings.gameMode === 'career';
    if (isCareer && m.stage === 'playoff' && isUserMatch(m) && winner !== state.userTeam) {
        state.userTeamEliminated = true;
        addMatchEvent(m, '', 'finish', '😔 Ваша команда выбыла из турнира', null);
    }

    // В карьере остальные матчи текущего этапа досчитываются автоматически
    if (isCareer) {
        state.matches.forEach(om => { if (!om.isFinished && !isUserMatch(om)) autoSimulateMatch(om); });
    }

    const nextMatch = state.matches.find(x => !x.isFinished && (!isCareer || isUserMatch(x)));
    const btnNext = document.getElementById('btn-next-match');
    if (btnNext) {
        btnNext.style.display = 'flex';
        if (isCareer && state.userTeamEliminated) {
            btnNext.innerHTML = '<span class="btn-icon">🤖</span><span class="btn-text">Досимулировать турнир</span>';
            btnNext.onclick = autoFinishTournament;
        } else if (nextMatch && m.stage === 'group') {
            btnNext.innerHTML = '<span class="btn-icon">➡️</span><span class="btn-text">Следующий матч</span>';
            btnNext.onclick = () => openMatchScreen(nextMatch);
        } else if (nextMatch) {
            btnNext.innerHTML = '<span class="btn-icon">📊</span><span class="btn-text">К сетке</span>';
            btnNext.onclick = () => { showScreen('dashboard'); renderDashboard(); };
        } else {
            btnNext.innerHTML = '<span class="btn-icon">🏆</span><span class="btn-text">Завершить раунд</span>';
            btnNext.onclick = () => { showScreen('dashboard'); renderDashboard(); };
        }
    }
}

// Автоматически доигрывает все оставшиеся этапы турнира и показывает результаты
function autoFinishTournament() {
    for (let guard = 0; guard < 20; guard++) {
        autoSimulateAllRemainingMatches();
        const champion = advanceStage();
        if (champion) { showResults(champion); return; }
    }
}

// Блокирует навигацию, пока матч идёт (иначе симуляция продолжалась бы в фоне)
function setMatchInProgress(inProgress) {
    const back = document.querySelector('#screen-match .btn-back');
    if (back) {
        back.disabled = inProgress;
        back.style.opacity = inProgress ? '0.4' : '1';
        back.style.pointerEvents = inProgress ? 'none' : '';
    }
}

function updateStats(team, gf, ga, win) {
    team.stats.played++;
    team.stats.gf += gf;
    team.stats.ga += ga;
    if (win === true) { team.stats.won++; team.stats.points += 3; }
    else if (win === false) team.stats.lost++;
    else if (win === null) { team.stats.drawn++; team.stats.points += 1; }
}

// ===== СИМУЛЯЦИЯ =====
function startSimulation() {
    const m = state.activeMatch;
    let min = 0, ballX = 50, ballY = 50, ballOwner = null;
    const possessionTicks = { team1: 0, team2: 0 };

    onSpeedChange = () => {
        clearInterval(simulationInterval);
        simulationInterval = setInterval(simulationStep, getMatchInterval());
    };

    const updateScoreDisplay = () => {
        const s1 = document.getElementById('score-1');
        const s2 = document.getElementById('score-2');
        if (!s1 || !s2) return;
        if (m.legs === 2 && m.currentLeg === 1) { s1.innerText = m.leg1.t1; s2.innerText = m.leg1.t2; }
        else if (m.legs === 2 && m.currentLeg === 2) { const agg = m.aggregateScore; s1.innerText = agg.t1; s2.innerText = agg.t2; }
        else { s1.innerText = m.score1; s2.innerText = m.score2; }
    };
    
    const update = () => {
        updateScoreDisplay();
        const tEl = document.getElementById('match-time');
        if (tEl) tEl.innerText = min + "'";
        updateStatsDisplay(m);
    };
    
    function updatePlayerPositions() {
        const all = [...(m.squad1 || []), ...(m.squad2 || [])];
        all.forEach(p => {
            let tx = p.baseX, ty = p.baseY;
            // team1 атакует вправо (+x), team2 — влево (−x)
            const isTeam1 = p.team === m.team1.id;
            const dir = isTeam1 ? 1 : -1;
            if (ballOwner === (isTeam1 ? 'team1' : 'team2')) {
                if (p.position === 'FWD') tx += 15 * dir;
                else if (p.position === 'MID') tx += 10 * dir;
                else if (p.position === 'DEF') tx += 5 * dir;
            } else if (ballOwner) {
                if (p.position === 'DEF') tx -= 5 * dir;
                else if (p.position === 'MID') tx -= 8 * dir;
            }
            // Полевые игроки немного смещаются к мячу по вертикали
            if (!p.isGoalkeeper) ty += (ballY - 50) * 0.25;
            if (p.isGoalkeeper) { tx = p.baseX; ty = Math.max(30, Math.min(70, ballY)); }
            const speed = 0.3;
            p.x = p.x + (tx - p.x) * speed;
            p.y = p.y + (ty - p.y) * speed;
            p.x = Math.max(5, Math.min(95, p.x));
            p.y = Math.max(5, Math.min(95, p.y));
            updatePlayerPosition(m, p.team, p.number, p.x, p.y);
        });
    }
    
    function simulationStep() {
        min++;
        
        if (ballOwner) {
            const att = ballOwner === 'team1' ? m.team1.id : m.team2.id;
            const goalX = att === m.team1.id ? 90 : 10;
            ballX = ballX + (goalX - ballX) * 0.02 + (Math.random() - 0.5) * 3;
            ballY = ballY + (50 - ballY) * 0.01 + (Math.random() - 0.5) * 3;
        } else {
            ballX += (Math.random() - 0.5) * 5;
            ballY += (Math.random() - 0.5) * 5;
        }
        
        ballX = Math.max(5, Math.min(95, ballX));
        ballY = Math.max(5, Math.min(95, ballY));
        updateBallPosition(ballX, ballY);
        updatePlayerPositions();
        
        // Смена владения мячом (в «реализме» сильная команда владеет чаще)
        if (!ballOwner || Math.random() < 0.15) {
            ballOwner = Math.random() < getTeam1EdgeProbability(m) ? 'team1' : 'team2';
            const squad = ballOwner === 'team1' ? m.squad1 : m.squad2;
            if (squad && squad.length > 0) {
                const pwb = squad[Math.floor(Math.random() * squad.length)];
                highlightPlayerWithBall(m, ballOwner === 'team1' ? m.team1.id : m.team2.id, pwb.number);
            }
        }
        possessionTicks[ballOwner]++;
        m.stats.possession.team1 = Math.round(possessionTicks.team1 / (possessionTicks.team1 + possessionTicks.team2) * 100);
        m.stats.possession.team2 = 100 - m.stats.possession.team1;

        if (min > 90) {
            if (m.legs === 2 && m.currentLeg === 1) {
                const stEl = document.getElementById('match-status');
                if (stEl) stEl.innerText = "2-й матч";
                addMatchEvent(m, 90, 'half', `Конец 1-го матча: ${m.leg1.t1}:${m.leg1.t2}`, null);
                m.currentLeg = 2; min = 0;
                updateScoreDisplay();
                return;
            }
            clearInterval(simulationInterval);
            onSpeedChange = null;
            const agg = m.aggregateScore;
            if (m.stage === 'playoff' && agg.t1 === agg.t2) {
                addMatchEvent(m, min, 'penalties', "Серия пенальти", null);
                runPenalties(m, update, (text, isGoal) => addMatchEvent(m, 'ПЕН', isGoal ? 'penalty-goal' : 'penalty-miss', text, null));
            } else {
                const winner = agg.t1 > agg.t2 ? m.team1 : (agg.t2 > agg.t1 ? m.team2 : null);
                finishMatch(m, winner);
            }
            return;
        }
        
        const event = generateRandomEvent(m, min);
        
        if (event) {
            switch(event.type) {
                case 'goal':
                    const st = event.team === m.team1 ? 'team1' : 'team2';
                    const sq = st === 'team1' ? m.squad1 : m.squad2;
                    const fieldPlayers = sq.filter(p => p.position !== 'GK');
                    if (fieldPlayers.length === 0) break;
                    
                    const goalScorer = selectGoalScorer(fieldPlayers);
                    
                    if (m.legs === 2 && m.currentLeg === 1) { if (event.team === m.team1) m.leg1.t1++; else m.leg1.t2++; }
                    else if (m.legs === 2 && m.currentLeg === 2) { if (event.team === m.team1) m.leg2.t1++; else m.leg2.t2++; }
                    else { if (event.team === m.team1) m.score1++; else m.score2++; }
                    
                    const sid = `${st === 'team1' ? m.team1.id : m.team2.id}-${goalScorer.number}`;
                    if (playerStats[sid]) { playerStats[sid].goals++; playerStats[sid].shotsOnTarget++; }
                    
                    if (Math.random() < 0.85) {
                        const assistPlayer = selectAssistProvider(fieldPlayers, goalScorer);
                        if (assistPlayer) {
                            const aid = `${st === 'team1' ? m.team1.id : m.team2.id}-${assistPlayer.number}`;
                            if (playerStats[aid]) playerStats[aid].assists++;
                        }
                    }
                    
                    updateScoreDisplay();
                    const sb = document.querySelector('.scoreboard-v2');
                    if (sb) { const rect = sb.getBoundingClientRect(); createConfetti(rect.left + rect.width / 2, rect.top); }
                    const se = event.team === m.team1 ? document.getElementById('score-1') : document.getElementById('score-2');
                    if (se) { se.classList.add('goal-animation'); setTimeout(() => se.classList.remove('goal-animation'), 500); }
                    
                    addMatchEvent(m, min, 'goal', `ГОЛ! #${goalScorer.number} ${goalScorer.name} (${goalScorer.position})`, event.team);

                    ballX = 50; ballY = 50;
                    ballOwner = event.team === m.team1 ? 'team2' : 'team1'; // розыгрыш с центра
                    updateBallPosition(ballX, ballY);
                    break;

                case 'shot':
                    addMatchEvent(m, min, 'shot', 'Удар в створ — вратарь на месте', event.team);
                    break;
                // Угловые, фолы, карточки, замены и удары мимо уже записаны в generateRandomEvent
            }
        }
        update();
    }

    simulationInterval = setInterval(simulationStep, getMatchInterval());
}

// Вероятность, что эпизод разыгрывает team1 (в «реализме» зависит от рейтинга)
function getTeam1EdgeProbability(m) {
    if (state.settings.simMode !== 'realistic') return 0.5;
    const diff = (m.team1.rating || 75) - (m.team2.rating || 75);
    return Math.max(0.25, Math.min(0.75, 0.5 + diff * 0.015));
}

// ===== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ =====
window.addEventListener('DOMContentLoaded', async () => {
    await loadTeamSquads();
});

window.addEventListener('resize', () => {
    if (confettiCanvas) {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
});

// ===== ОБРАБОТЧИКИ КНОПОК СПИСКА КОМАНД =====
document.getElementById('btn-back-teams')?.addEventListener('click', () => {
    if (state.settings.gameMode === 'career') {
        showScreen('teamSelect');
    } else {
        showScreen('setup');
    }
});

document.getElementById('btn-start-tournament')?.addEventListener('click', () => {
    showScreen('dashboard');
    renderDashboard();
});
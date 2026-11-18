// ===== КОМАНДЫ, РЕЙТИНГИ, РЕЗЕРВНЫЕ ИМЕНА =====

const worldTeams = {
    names: ["Arsenal", "Bayern", "Liverpool", "Barca", "Real", "Tottenham", "PSG", "Chelsea", "Ajax", "ManCity", "Inter", "Atletico", "Roma", "Dortmund", "Benfica", "Napoli", "Atalanta", "Frankfurt", "Sporting", "Porto", "ManUtd", "Brugge", "Fiorentina", "Milan", "Betis", "AstonVilla", "Juventus", "Sevilla", "Valencia", "Nice", "Osasuna", "Girona", "Lazio", "Feyenoord"],
    emojis: ["🔴⚪", "🔴", "🔴", "🔵🔴", "⚪", "⚪", "🔵🔴", "🔵", "🔴⚪", "🔷", "🔵⚫", "🔴⚪", "🟡🔴", "🟡⚫", "🔴⚪", "🔵", "🔵⚫", "🔴⚫", "🟢⚪", "🔵⚪", "🔴⚪", "🔵⚫", "🟣⚪", "🔴⚫", "🟢⚪", "🔷", "⚫⚪", "🟡🔴", "🟠", "🔵🔴", "🔴", "🔴⚪", "⚪🔵", "🔴⚪"]
};

const russianTeams = {
    names: ["Спартак", "Зенит", "ЦСКА", "Локомотив", "Динамо", "Краснодар", "Ростов", "Рубин", "Сочи", "Ахмат", "Крылья", "Оренбург", "ПариНН", "Факел", "Акрон", "Балтика"],
    emojis: ["🔴⚪", "🔵⚪", "🔴🔵", "🟢⚪", "⚪🔵", "🟢⚫", "🟡🔴", "🔵⚪", "⚪🔵", "🟢⚪", "🔵⚪", "🟠⚫", "🔴⚪", "🟠⚫", "🟡🔵", "🔵⚪"]
};

const mixedTeams = {
    names: [...russianTeams.names, ...worldTeams.names],
    emojis: [...russianTeams.emojis, ...worldTeams.emojis]
};

// Рейтинги команд (1-100), сезон 2025/26.
// Ориентиры: победитель ЛЧ-2025 ПСЖ, чемпионы 2024/25 — Ливерпуль, Барселона, Бавария, Наполи, Краснодар.
const teamRatings = {
    // Мировые: элита
    "PSG": 92, "Barca": 91, "Liverpool": 91, "Bayern": 91, "Arsenal": 91, "Real": 90,
    "ManCity": 88, "Inter": 88, "Chelsea": 87, "Napoli": 86, "Atletico": 86,
    // Сильные
    "Juventus": 84, "Milan": 84, "Dortmund": 84, "Atalanta": 83, "AstonVilla": 83,
    "Tottenham": 83, "Benfica": 83, "Sporting": 83, "ManUtd": 82, "Roma": 82, "Porto": 82,
    // Средние
    "Frankfurt": 81, "Betis": 81, "Lazio": 80, "Fiorentina": 80, "Ajax": 79, "Brugge": 79,
    "Feyenoord": 79, "Nice": 78, "Sevilla": 78, "Valencia": 77, "Girona": 77, "Osasuna": 77,
    // Российские
    "Краснодар": 82, "Зенит": 82, "Спартак": 80, "ЦСКА": 80, "Локомотив": 79, "Динамо": 78,
    "Рубин": 74, "Ростов": 74, "Балтика": 74, "Ахмат": 73, "Крылья": 72, "Акрон": 72,
    "ПариНН": 71, "Оренбург": 71, "Сочи": 71, "Факел": 70
};

// Резервные имена — если команды нет в SQUADS
const fallbackPlayerNames = {
    world: {
        goalkeepers: ["Courtois", "Ederson", "Alisson", "Ter Stegen", "Donnarumma", "Navas", "Oblak", "Neuer", "Martinez", "Maignan"],
        defenders: ["Van Dijk", "Ramos", "Marquinhos", "Varane", "Alaba", "Davies", "Hakimi", "Cancelo", "Walker", "Rudiger"],
        midfielders: ["Modric", "Kroos", "De Bruyne", "Pedri", "Gavi", "Bellingham", "Valverde", "Camavinga", "Silva", "Gundogan"],
        forwards: ["Mbappe", "Haaland", "Benzema", "Lewandowski", "Salah", "Mane", "Vini Jr", "Rodrygo", "Neymar", "Messi"]
    },
    russia: {
        goalkeepers: ["Акинфеев", "Кержаков", "Сафонов", "Шунин", "Дюпин", "Лунёв", "Максименко", "Селихов"],
        defenders: ["Джикия", "Фернандес", "Кудряшов", "Семёнов", "Караваев", "Лихачёв", "Тикнизян", "Маслов"],
        midfielders: ["Головин", "Миранчук", "Зобнин", "Оздоев", "Кузяев", "Ерохин", "Жемалетдинов", "Ионов"],
        forwards: ["Дзюба", "Соболев", "Чалов", "Смолов", "Комличенко", "Игнатьев", "Пиняев", "Кордоба"]
    }
};

function getTeamsData(teamType) {
    if (teamType === 'mixed') return mixedTeams;
    return teamType === 'russia' ? russianTeams : worldTeams;
}

// Реальный тип конкретной команды (для смешанного режима)
function getTeamOrigin(teamName) {
    return russianTeams.names.includes(teamName) ? 'russia' : 'world';
}

function pickRandomTeams(teamType, count) {
    const teamsData = getTeamsData(teamType);
    const available = teamsData.names.map((_, i) => i);
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

function getRatingBadge(rating) {
    if (rating >= 90) return '⭐⭐⭐';
    if (rating >= 85) return '⭐⭐';
    if (rating >= 80) return '⭐';
    return '○';
}

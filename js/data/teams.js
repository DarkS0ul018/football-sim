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

// Рейтинги команд (1-100)
const teamRatings = {
    // Мировые
    "Real": 90, "Barca": 98, "ManCity": 94, "Liverpool": 91, "Bayern": 93,
    "PSG": 90, "Inter": 88, "Juventus": 87, "Milan": 86, "Arsenal": 90,
    "Chelsea": 87, "Dortmund": 86, "Atletico": 88, "Napoli": 87, "Roma": 85,
    "Sevilla": 84, "Porto": 85, "Ajax": 84, "Benfica": 85, "Valencia": 83,
    "Tottenham": 85, "ManUtd": 86, "Atalanta": 86, "Frankfurt": 84,
    "Sporting": 85, "Brugge": 82, "Fiorentina": 84, "Betis": 83,
    "AstonVilla": 83, "Nice": 83, "Osasuna": 79, "Girona": 82, "Lazio": 85,
    "Feyenoord": 80,
    // Российские
    "Спартак": 70, "Зенит": 83, "ЦСКА": 86, "Локомотив": 81, "Динамо": 80,
    "Краснодар": 82, "Ростов": 79, "Рубин": 78, "Сочи": 77, "Ахмат": 76,
    "Крылья": 77, "Оренбург": 75, "ПариНН": 74, "Факел": 73, "Акрон": 74,
    "Балтика": 75
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

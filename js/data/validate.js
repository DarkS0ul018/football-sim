// ===== ПРОВЕРКА ДАННЫХ: составы, рейтинги, цвета =====
// Используется страницей tools/check-data.html и редактором команд.

const SQUAD_MINIMUM = { goalkeepers: 2, defenders: 5, midfielders: 5, forwards: 3 };
const LINE_NAMES = { goalkeepers: 'вратари', defenders: 'защитники', midfielders: 'полузащитники', forwards: 'нападающие' };
const KNOWN_COLOR_EMOJI = ['🔴', '⚪', '🔵', '🟢', '🟡', '⚫', '🟣', '🟠', '🔷', '🟤'];

// Проверка одной команды. Возвращает { errors: [], warnings: [] }
function validateTeamData(name, squad, rating, emoji) {
    const errors = [], warnings = [];
    if (!squad) return { errors: ['нет состава'], warnings };

    const seen = new Map();
    Object.keys(SQUAD_MINIMUM).forEach(line => {
        const list = squad[line] || [];
        if (list.length < SQUAD_MINIMUM[line]) {
            (line === 'goalkeepers' && list.length < 1 ? errors : warnings)
                .push(`${LINE_NAMES[line]}: ${list.length} (нужно минимум ${SQUAD_MINIMUM[line]})`);
        }
        list.forEach(player => {
            if (typeof player !== 'string' || !player.trim()) { errors.push(`пустое имя в линии «${LINE_NAMES[line]}»`); return; }
            if (/[A-Za-z]/.test(player)) warnings.push(`латиница в имени: «${player}»`);
            if (seen.has(player)) warnings.push(`повтор: «${player}» (${LINE_NAMES[seen.get(player)]} и ${LINE_NAMES[line]})`);
            else seen.set(player, line);
        });
    });
    const unique = seen.size;
    if (unique < 11) errors.push(`всего ${unique} разных игроков — не хватает на стартовый состав`);
    else if (unique < 16) warnings.push(`всего ${unique} игроков — мало запасных`);

    if (typeof rating !== 'number' || rating < 40 || rating > 99) errors.push(`рейтинг вне диапазона 40–99: ${rating}`);
    const colors = Array.from(emoji || '').filter(ch => KNOWN_COLOR_EMOJI.includes(ch));
    if (!colors.length) warnings.push('нет цветов клуба (эмодзи-кружков)');
    return { errors, warnings };
}

// Полная проверка всех данных игры
function validateGameData() {
    const report = { teams: [], crossTeam: [], summary: { teams: 0, players: 0, errors: 0, warnings: 0 } };
    const playerTeams = new Map();
    [['world', worldTeams], ['russia', russianTeams]].forEach(([type, data]) => {
        data.names.forEach((name, i) => {
            const squad = SQUADS[type] && SQUADS[type][name];
            const res = validateTeamData(name, squad, teamRatings[name], data.emojis[i]);
            report.teams.push({ type, name, rating: teamRatings[name], emoji: data.emojis[i], ...res,
                players: squad ? Object.values(squad).flat().length : 0 });
            if (squad) Object.values(squad).flat().forEach(p => {
                if (!playerTeams.has(p)) playerTeams.set(p, []);
                if (!playerTeams.get(p).includes(name)) playerTeams.get(p).push(name);
            });
        });
        Object.keys(SQUADS[type] || {}).forEach(name => {
            if (!data.names.includes(name)) report.crossTeam.push(`Состав «${name}» есть, но команды нет в списке`);
        });
    });
    playerTeams.forEach((teams, player) => {
        if (teams.length > 1) report.crossTeam.push(`«${player}» числится в нескольких командах: ${teams.join(', ')}`);
    });
    // Сколько игроков с настоящим возрастом
    if (typeof knownAge === 'function') {
        report.teams.forEach(t => {
            const squad = SQUADS[t.type] && SQUADS[t.type][t.name];
            const all = squad ? Object.values(squad).flat() : [];
            t.withAge = all.filter(p => knownAge(t.name, p) !== null).length;
        });
        report.summary.withAge = report.teams.reduce((s, t) => s + (t.withAge || 0), 0);
    }
    report.summary.teams = report.teams.length;
    report.summary.players = playerTeams.size;
    report.summary.errors = report.teams.reduce((s, t) => s + t.errors.length, 0);
    report.summary.warnings = report.teams.reduce((s, t) => s + t.warnings.length, 0) + report.crossTeam.length;
    return report;
}

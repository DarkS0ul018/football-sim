// ===== ЦВЕТА КЛУБОВ, ЭМБЛЕМЫ, ФОРМА НА ПОЛЕ =====
// Цвета берутся из эмодзи команды (🔴⚪ → красный/белый), поэтому новые команды получают цвета автоматически.

const EMOJI_COLORS = {
    '🔴': '#d62839', '⚪': '#f2f2f2', '🔵': '#1e4fd8', '🟢': '#16a34a', '🟡': '#facc15',
    '⚫': '#1c1c1c', '🟣': '#7e22ce', '🟠': '#f97316', '🔷': '#6cabdd', '🟤': '#7c4a1e'
};

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDistance(a, b) {
    const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function textOn(bg) {
    return luminance(bg) > 0.55 ? '#111' : '#fff';
}

const teamColorCache = {};

// { primary, secondary, text } — домашняя форма
function getTeamColors(team) {
    const key = team.name + team.emoji;
    if (teamColorCache[key]) return teamColorCache[key];
    const colors = Array.from(team.emoji || '').map(ch => EMOJI_COLORS[ch]).filter(Boolean);
    const primary = colors[0] || '#6b7280';
    let secondary = colors[1] || (luminance(primary) > 0.55 ? '#1c1c1c' : '#f2f2f2');
    if (colorDistance(primary, secondary) < 60) secondary = luminance(primary) > 0.55 ? '#1c1c1c' : '#f2f2f2';
    return (teamColorCache[key] = { primary, secondary, text: textOn(primary) });
}

// Короткое название для эмблемы: ManCity → MC, PSG → PSG, Спартак → СПА
function teamInitials(name) {
    const caps = name.match(/[A-ZА-ЯЁ]/g) || [];
    if (caps.length >= 2) return caps.slice(0, 3).join('');
    return name.replace(/[^A-Za-zА-Яа-яЁё]/g, '').slice(0, 3).toUpperCase();
}

function crestHtml(team, size = 'sm') {
    const c = getTeamColors(team);
    return `<span class="crest crest-${size}" style="--c1:${c.primary};--c2:${c.secondary};--ct:${c.text}" title="${team.name}"><span>${teamInitials(team.name)}</span></span>`;
}

// Форма на матч: если цвета похожи — гости в запасной (цвета наоборот или нейтральные)
function getMatchKits(m) {
    const home = getTeamColors(m.team1);
    let away = getTeamColors(m.team2);
    if (colorDistance(home.primary, away.primary) < 120) {
        away = { primary: away.secondary, secondary: away.primary, text: textOn(away.secondary) };
        if (colorDistance(home.primary, away.primary) < 120) {
            const alt = luminance(home.primary) > 0.5 ? '#1c1c1c' : '#f2f2f2';
            away = { primary: alt, secondary: home.primary, text: textOn(alt) };
        }
    }
    return {
        team1: home, team2: away,
        gk1: { primary: '#a3e635', secondary: '#1c1c1c', text: '#111' },
        gk2: { primary: '#f472b6', secondary: '#1c1c1c', text: '#111' }
    };
}

// Применяет форму к игрокам на поле, табло и легенде
function applyMatchKits(m) {
    const kits = getMatchKits(m);
    const root = $('screen-match');
    root.style.setProperty('--kit1', kits.team1.primary);
    root.style.setProperty('--kit1b', kits.team1.secondary);
    root.style.setProperty('--kit1t', kits.team1.text);
    root.style.setProperty('--kit2', kits.team2.primary);
    root.style.setProperty('--kit2b', kits.team2.secondary);
    root.style.setProperty('--kit2t', kits.team2.text);
    $('team-1-logo').innerHTML = crestHtml(m.team1, 'lg');
    $('team-2-logo').innerHTML = crestHtml(m.team2, 'lg');
}

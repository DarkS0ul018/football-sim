// ===== ВЫБОР УЧАСТНИКОВ ТУРНИРА ВРУЧНУЮ =====
// Открывается, если в настройках «Участники: выбрать вручную».
// Нужно отметить ровно столько клубов, сколько участников в турнире.

const picker = { settings: null, onDone: null, type: null, selected: [], league: 'all' };

function openParticipantPicker(settings, onDone) {
    picker.settings = settings;
    picker.onDone = onDone;
    // Прошлый выбор сохраняем, если лига та же (удобно, если вернулись назад)
    if (picker.type !== settings.teamType) picker.selected = [];
    picker.type = settings.teamType;
    picker.selected = picker.selected.slice(0, settings.count);
    picker.league = 'all';
    $('picker-search').value = '';
    renderPicker();
    showScreen('picker');
}

function pickerTeams() {
    const d = getTeamsData(picker.type);
    return d.names.map((name, i) => ({ name, emoji: d.emojis[i] || '⚪', rating: teamRatings[name] ?? 75, origin: getTeamOrigin(name) }));
}

function renderPicker() {
    const need = picker.settings.count;
    const sel = new Set(picker.selected);
    const full = sel.size >= need;
    const q = $('picker-search').value.trim().toLowerCase();

    setText('picker-count', `${sel.size} / ${need}`);
    $('picker-count').classList.toggle('done', sel.size === need);
    $('picker-league-tabs').style.display = picker.type === 'mixed' ? '' : 'none';
    document.querySelectorAll('#picker-league-tabs .style-btn').forEach(b => b.classList.toggle('active', b.dataset.league === picker.league));
    $('btn-picker-next').disabled = sel.size !== need;

    const teams = pickerTeams()
        .filter(t => picker.league === 'all' || t.origin === picker.league)
        .filter(t => !q || t.name.toLowerCase().includes(q))
        .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));

    $('picker-grid').innerHTML = teams.map(t => {
        const on = sel.has(t.name);
        const order = on ? picker.selected.indexOf(t.name) + 1 : '';
        const t2 = getClubTactics(t.name, t.rating);
        return `<div class="team-select-card picker-card ${on ? 'selected' : ''} ${!on && full ? 'disabled' : ''}" data-name="${escapeHtml(t.name)}">
            ${on ? `<span class="picker-order">${order}</span>` : ''}
            <span class="team-emoji">${crestHtml(t, 'lg')}</span>
            <h3>${t.name}</h3>
            <div class="rating">${t.rating}</div>
            <div class="picker-meta">${t2.formation} · ${(STYLES[t2.style] || STYLES.balance).label}</div>
        </div>`;
    }).join('') || '<div class="muted">Ничего не найдено</div>';

    document.querySelectorAll('#picker-grid .picker-card').forEach(el => el.onclick = () => togglePick(el.dataset.name));
}

function togglePick(name) {
    const i = picker.selected.indexOf(name);
    if (i !== -1) picker.selected.splice(i, 1);
    else if (picker.selected.length < picker.settings.count) picker.selected.push(name);
    renderPicker();
}

// Добрать недостающих случайно (из видимой лиги, если выбрана вкладка)
function pickerFillRandom() {
    const pool = pickerTeams()
        .filter(t => picker.league === 'all' || t.origin === picker.league)
        .map(t => t.name)
        .filter(n => !picker.selected.includes(n))
        .sort(() => Math.random() - 0.5);
    while (picker.selected.length < picker.settings.count && pool.length) picker.selected.push(pool.shift());
    renderPicker();
}

// Сильнейшие по рейтингу
function pickerStrongest() {
    picker.selected = pickerTeams()
        .filter(t => picker.league === 'all' || t.origin === picker.league)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, picker.settings.count)
        .map(t => t.name);
    renderPicker();
}

function pickerContinue() {
    if (picker.selected.length !== picker.settings.count) return;
    const byName = Object.fromEntries(pickerTeams().map(t => [t.name, t]));
    const pool = picker.selected.map(n => ({ name: n, emoji: byName[n].emoji, rating: byName[n].rating }));
    picker.onDone(pool);
}

function initPickerScreen() {
    $('picker-search').addEventListener('input', renderPicker);
    document.querySelectorAll('#picker-league-tabs .style-btn').forEach(b => b.onclick = () => { picker.league = b.dataset.league; renderPicker(); });
    $('btn-picker-random').onclick = pickerFillRandom;
    $('btn-picker-strongest').onclick = pickerStrongest;
    $('btn-picker-clear').onclick = () => { picker.selected = []; renderPicker(); };
    $('btn-picker-back').onclick = () => showScreen('setup');
    $('btn-picker-next').onclick = pickerContinue;
}

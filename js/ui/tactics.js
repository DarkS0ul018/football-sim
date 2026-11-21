// ===== ЭКРАН ТАКТИКИ: схема, стиль, стартовый состав (карьера) =====

let tacticsMatch = null;
let tacticsTeam = null;   // чью тактику сейчас настраиваем
let tacticsQueue = [];    // «Вдвоём», дерби: кто ещё должен настроить свою команду
let tacticsSelection = null; // { from: 'lineup' | 'reserve', index | number }

function playerRowHtml(p, opts = {}) {
    const slot = opts.slot;
    const eff = Math.round(effectiveRating(p, slot || p.natPos));
    const outOfPos = slot && slot !== p.natPos;
    const badges = [];
    if (isInjured(p)) badges.push(`<span class="badge badge-injury" title="Травма: ${absenceText(p)}">🚑 ${p.injury.matches}</span>`);
    if (p.suspended) badges.push(`<span class="badge badge-red" title="${absenceText(p)}">🚫 ${p.suspended > 1 ? p.suspended : 'дискв.'}</span>`);
    else if (p.yellowAcc && !isInjured(p)) badges.push('<span class="badge badge-yellow" title="Ещё одна жёлтая — пропуск матча">🟨</span>');
    if (outOfPos) badges.push(`<span class="badge" title="Играет не на своей позиции">${p.natPos}→${slot}</span>`);
    const f = Math.round(p.fitness);
    return `
        <div class="tactics-player ${opts.selected ? 'selected' : ''} ${isAvailable(p) ? '' : 'unavailable'}" data-key="${opts.key}">
            ${slot ? `<span class="tp-slot">${slot}</span>` : `<span class="tp-slot muted">${p.natPos}</span>`}
            <span class="tp-num">${p.number}</span>
            <span class="tp-name" title="${p.name}">${p.name}</span>
            ${p.age ? `<span class="tr-age" title="Возраст">${p.age}</span>` : ''}
            ${bestSkillTag({ ...p, natPos: p.natPos || p.position })}
            ${badges.join('')}
            ${moodHtml(p)}
            <span class="tp-fitness" title="Свежесть ${f}%"><span style="width:${f}%;background:${fitnessColor(f)}"></span></span>
            <span class="tp-rating" title="Базовый рейтинг ${p.rating}, с учётом свежести, позиции, формы и морали ${eff}">${eff}</span>
        </div>`;
}

function openTactics(match, team = humanTeams().find(t => match.involves(t))) {
    tacticsMatch = match;
    tacticsSelection = null;
    tacticsTeam = team;
    const opp = match.team1.id === team.id ? match.team2 : match.team1;
    const leg = match.legs === 2 ? match.currentLeg : 1;
    const homeSide = getHomeSide(match, leg);
    const isHome = homeSide && (homeSide === 'team1' ? match.team1 : match.team2).id === team.id;
    const venue = !homeSide ? 'нейтральное поле' : (isHome ? 'дома 🏠' : 'в гостях');
    const who = humanLabel(team) ? `<span class="duo-tag p${humanIndex(team) + 1}">${humanLabel(team)}</span> ` : '';
    setHtml('tactics-opponent', `${who}${match.roundName}: ${teamLabel(team)} — ${teamLabel(opp)} · ${venue}` + teamMoodHtml(team, opp));

    const changes = validateLineup(team);
    $('tactics-warnings').innerHTML = changes.map(c => `<div>⚠️ ${c}</div>`).join('');

    prepareTeamForMatch(opp); // соперник выбирает состав (видим его силу и привычную тактику)
    const os = getSquad(opp);
    if (isHuman(opp)) setHtml('tactics-opp-strength', `${teamLabel(opp)} · ${humanLabel(opp)} — тактика соперника скрыта`);
    else setHtml('tactics-opp-strength', `${teamLabel(opp)} ${lineupStrength(opp).toFixed(1)} · ${os.formation} · ${(STYLES[os.style] || STYLES.balance).label}`);

    $('tactics-formation').innerHTML = Object.keys(FORMATIONS).map(f => `<option value="${f}">${f}</option>`).join('');
    renderTactics();
    showScreen('tactics');
}

// Кнопки выбора (стиль игры, линия обороны)
function renderChoiceButtons(containerId, options, current, onPick) {
    const box = $(containerId);
    box.innerHTML = Object.entries(options).map(([key, s]) =>
        `<button class="style-btn ${key === current ? 'active' : ''}" data-style="${key}" title="${s.hint}">${s.label}</button>`).join('');
    box.querySelectorAll('.style-btn').forEach(b => b.onclick = () => onPick(b.dataset.style));
}

function renderStyleButtons(containerId, current, onPick) {
    renderChoiceButtons(containerId, STYLES, current, onPick);
}

function renderTactics() {
    const team = tacticsTeam;
    const squad = getSquad(team);
    const players = getSquadPlayers(team);
    const byNum = Object.fromEntries(players.map(p => [p.number, p]));
    const slots = FORMATIONS[squad.formation];

    $('tactics-formation').value = squad.formation;
    renderStyleButtons('tactics-style', squad.style, style => { squad.style = style; renderTactics(); });
    setText('tactics-style-hint', (STYLES[squad.style] || STYLES.balance).hint);
    const line = LINES[squad.line] ? squad.line : 'mid';
    renderChoiceButtons('tactics-line', LINES, line, l => { squad.line = l; renderTactics(); });
    setText('tactics-line-hint', LINES[line].hint);
    setText('tactics-strength', lineupStrength(team).toFixed(1));

    const sel = tacticsSelection;
    $('tactics-lineup').innerHTML = squad.lineup.map((num, i) => byNum[num]
        ? playerRowHtml(byNum[num], { slot: slots[i][0], key: `l${i}`, selected: sel && sel.key === `l${i}` })
        : `<div class="tactics-player empty" data-key="l${i}"><span class="tp-slot">${slots[i][0]}</span><span class="tp-name muted">— пусто —</span></div>`).join('');

    const inLineup = new Set(squad.lineup);
    const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
    $('tactics-reserves').innerHTML = players.filter(p => !inLineup.has(p.number))
        .sort((a, b) => order[a.natPos] - order[b.natPos] || b.rating - a.rating)
        .map(p => playerRowHtml(p, { key: `r${p.number}`, selected: sel && sel.key === `r${p.number}` })).join('');

    document.querySelectorAll('#screen-tactics .tactics-player').forEach(el => el.onclick = () => onTacticsClick(el.dataset.key));
    renderRolesCard(team, squad, byNum, slots);
}

function onTacticsClick(key) {
    const squad = getSquad(tacticsTeam);
    const byNum = Object.fromEntries(getSquadPlayers(tacticsTeam).map(p => [p.number, p]));
    if (!tacticsSelection) {
        tacticsSelection = { key };
        renderTactics();
        return;
    }
    const a = tacticsSelection.key, b = key;
    tacticsSelection = null;
    if (a === b) { renderTactics(); return; }

    const isL = k => k[0] === 'l';
    const val = k => Number(k.slice(1));
    if (isL(a) && isL(b)) {
        [squad.lineup[val(a)], squad.lineup[val(b)]] = [squad.lineup[val(b)], squad.lineup[val(a)]];
    } else if (isL(a) !== isL(b)) {
        const slotIdx = val(isL(a) ? a : b);
        const reserve = byNum[val(isL(a) ? b : a)];
        if (!isAvailable(reserve)) { notify(`${reserve.name} пропускает этот матч: ${absenceText(reserve)}`); renderTactics(); return; }
        squad.lineup[slotIdx] = reserve.number;
    }
    renderTactics();
}

function initTacticsScreen() {
    $('tactics-formation').addEventListener('change', e => {
        setFormation(tacticsTeam, e.target.value);
        tacticsSelection = null;
        renderTactics();
    });
    $('btn-auto-lineup').onclick = () => {
        getSquad(tacticsTeam).lineup = autoLineup(tacticsTeam);
        tacticsSelection = null;
        renderTactics();
    };
    $('btn-tactics-back').onclick = () => { saveGame(); openDashboard(); };
    $('btn-tactics-play').onclick = () => {
        const squad = getSquad(tacticsTeam);
        if (squad.lineup.filter(n => n !== null).length < 11) { notify('⚠️ В стартовом составе должно быть 11 игроков'); return; }
        saveGame();
        // Дерби «Вдвоём»: теперь тактику настраивает второй игрок
        const next = tacticsQueue.shift();
        if (next) { showHandoff(next, () => openTactics(tacticsMatch, next)); return; }
        openMatchScreen(tacticsMatch);
    };
}

// В карьере перед своим матчем — экран тактики, иначе сразу матч
function openMatch(match) {
    const humans = humanTeams().filter(t => match.involves(t));
    if (!humans.length) { openMatchScreen(match); return; }
    tacticsQueue = humans.slice(1);
    if (isDuo()) showHandoff(humans[0], () => openTactics(match, humans[0]));
    else openTactics(match, humans[0]);
}

// «Вдвоём»: экран-заставка «Передайте устройство Игроку N» (чтобы соперник не подсмотрел тактику)
function showHandoff(team, onReady) {
    if (!isDuo()) { onReady(); return; }
    document.querySelector('.handoff')?.remove();
    const i = humanIndex(team) + 1;
    const el = document.createElement('div');
    el.className = `handoff p${i}`;
    el.innerHTML = `<div class="handoff-box">
        <div class="duo-tag p${i}">Игрок ${i}</div>
        <div class="handoff-crest">${crestHtml(team, 'xl')}</div>
        <h2>${team.name}</h2>
        <p>Передайте устройство Игроку ${i}: его очередь готовить состав и тактику.</p>
        <button type="button" class="btn-primary">Я готов →</button>
    </div>`;
    document.body.appendChild(el);
    el.querySelector('button').onclick = () => { el.remove(); onReady(); };
}

// ----- Форма и мораль на экране тактики -----
function moodHtml(p) {
    const fi = formInfo(p);
    const mi = moraleInfo(p.morale ?? MORALE_DEFAULT);
    const fTitle = fi.value === null ? 'Форма: ещё нет матчей' : `Форма: ${fi.label.toLowerCase()} (средняя оценка ${fi.value.toFixed(1)})`;
    return `<span class="tp-form ${fi.cls}" title="${fTitle}">${fi.arrow}</span><span class="tp-morale" title="Мораль: ${mi.label.toLowerCase()} (${p.morale ?? MORALE_DEFAULT})">${mi.icon}</span>`;
}

function teamMoodHtml(team, opp) {
    const side = t => {
        const mi = moraleInfo(teamMorale(t));
        return `<span class="tm-side">${t.name}: <span class="tm-morale ${mi.cls}">${mi.icon} ${mi.label.toLowerCase()} мораль</span> ${teamFormHtml(t)}</span>`;
    };
    return `<div class="tactics-mood">${side(team)}${side(opp)}</div>`;
}

// ----- Капитан, исполнители стандартов и роли игроков стартового состава -----
function renderRolesCard(team, squad, byNum, slots) {
    const box = $('tactics-roles');
    if (!box) return;
    const xi = squad.lineup.map((num, i) => byNum[num] ? { ...byNum[num], position: slots[i][0], slotY: slots[i][2] } : null).filter(Boolean);
    if (!xi.length) { box.innerHTML = '<div class="muted">Сначала соберите стартовый состав.</div>'; return; }
    squad.roles = squad.roles || {};
    squad.setPieces = squad.setPieces || {};
    const field = xi.filter(p => p.position !== 'GK');
    const capNum = squad.captain != null && xi.some(p => p.number === squad.captain) ? squad.captain : autoCaptain(xi);
    const capAuto = squad.captain == null || !xi.some(p => p.number === squad.captain);
    const opt = (p, sel, extra = '') => `<option value="${p.number}" ${sel ? 'selected' : ''}>${escapeHtml(p.name)}${extra}</option>`;
    const sk = (p, k) => playerSkills({ ...p, natPos: p.natPos || p.position })[k];
    const takerSelect = (kind, label, skillLabel, f) => {
        const auto = bestTaker(field.map(p => ({ ...p, natPos: p.natPos || p.position })), kind);
        const cur = squad.setPieces[kind];
        return `<label class="tr-field"><span>${label}</span><select data-sp="${kind}">
            <option value="">Авто — ${auto ? escapeHtml(auto.name) : '—'}</option>
            ${[...field].sort((a, b) => f(b) - f(a)).map(p => opt(p, cur === p.number, ` · ${skillLabel} ${Math.round(f(p))}`)).join('')}
        </select></label>`;
    };
    box.innerHTML = `<div class="tr-grid">
            <label class="tr-field"><span>©️ Капитан</span><select data-captain>
                <option value="" ${capAuto ? 'selected' : ''}>Авто — ${escapeHtml((xi.find(p => p.number === capNum) || {}).name || '—')}</option>
                ${xi.map(p => opt(p, !capAuto && p.number === capNum, p.age ? ` · ${p.age} лет` : '')).join('')}
            </select></label>
            ${takerSelect('corner', '⛳ Угловые', 'пас', p => sk(p, 'pas'))}
            ${takerSelect('freekick', '🎯 Штрафные', 'удар', p => sk(p, 'sho') * 0.6 + sk(p, 'pas') * 0.4)}
            ${takerSelect('penalty', '⚪ Пенальти', 'удар', p => sk(p, 'sho'))}
        </div>
        <div class="tr-note muted">Капитан поднимает команду, когда она проигрывает, а его настроение передаётся раздевалке.</div>
        <div class="tr-roles">${xi.map(p => {
            const roles = rolesFor(p.position);
            const cur = squad.roles[p.number] && roles[squad.roles[p.number]] ? squad.roles[p.number] : '';
            const auto = autoRole(p, p.slotY);
            const shown = cur || auto;
            return `<div class="tr-role"><span class="tp-slot">${p.position}</span><span class="tr-name">${escapeHtml(p.name)}${p.number === capNum ? ' <b class="tr-c">C</b>' : ''}</span>
                <select data-role="${p.number}" title="${escapeHtml(roles[shown].hint)}">
                    <option value="">Авто — ${roles[auto].label}</option>
                    ${Object.entries(roles).map(([k, r]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${r.label}</option>`).join('')}
                </select><small class="muted">${roles[shown].hint}</small></div>`;
        }).join('')}</div>`;
    const capName = (xi.find(p => p.number === capNum) || {}).name;
    setText('tactics-roles-peek', capName ? `· капитан ${capName}` : '');
    box.querySelector('[data-captain]').onchange = e => { squad.captain = e.target.value ? Number(e.target.value) : null; renderTactics(); };
    box.querySelectorAll('[data-sp]').forEach(s => s.onchange = () => {
        if (s.value) squad.setPieces[s.dataset.sp] = Number(s.value); else delete squad.setPieces[s.dataset.sp];
        renderTactics();
    });
    box.querySelectorAll('[data-role]').forEach(s => s.onchange = () => {
        if (s.value) squad.roles[s.dataset.role] = s.value; else delete squad.roles[s.dataset.role];
        renderTactics();
    });
}

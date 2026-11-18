// ===== ЭКРАН ТАКТИКИ: схема, стиль, стартовый состав (карьера) =====

let tacticsMatch = null;
let tacticsSelection = null; // { from: 'lineup' | 'reserve', index | number }

function playerRowHtml(p, opts = {}) {
    const slot = opts.slot;
    const eff = Math.round(effectiveRating(p, slot || p.natPos));
    const outOfPos = slot && slot !== p.natPos;
    const badges = [];
    if (p.suspended) badges.push('<span class="badge badge-red" title="Пропускает матч">🚫 дискв.</span>');
    else if (p.yellowAcc) badges.push('<span class="badge badge-yellow" title="Ещё одна жёлтая — пропуск матча">🟨</span>');
    if (outOfPos) badges.push(`<span class="badge" title="Играет не на своей позиции">${p.natPos}→${slot}</span>`);
    const f = Math.round(p.fitness);
    return `
        <div class="tactics-player ${opts.selected ? 'selected' : ''} ${p.suspended ? 'unavailable' : ''}" data-key="${opts.key}">
            ${slot ? `<span class="tp-slot">${slot}</span>` : `<span class="tp-slot muted">${p.natPos}</span>`}
            <span class="tp-num">${p.number}</span>
            <span class="tp-name" title="${p.name}">${p.name}</span>
            ${p.age ? `<span class="tr-age" title="Возраст">${p.age}</span>` : ''}
            ${badges.join('')}
            <span class="tp-fitness" title="Свежесть ${f}%"><span style="width:${f}%;background:${fitnessColor(f)}"></span></span>
            <span class="tp-rating" title="Базовый рейтинг ${p.rating}, с учётом свежести и позиции ${eff}">${eff}</span>
        </div>`;
}

function openTactics(match) {
    tacticsMatch = match;
    tacticsSelection = null;
    const team = state.userTeam;
    const opp = match.team1.id === team.id ? match.team2 : match.team1;
    const leg = match.legs === 2 ? match.currentLeg : 1;
    const homeSide = getHomeSide(match, leg);
    const isHome = homeSide && (homeSide === 'team1' ? match.team1 : match.team2).id === team.id;
    const venue = !homeSide ? 'нейтральное поле' : (isHome ? 'дома 🏠' : 'в гостях');
    setHtml('tactics-opponent', `${match.roundName}: ${teamLabel(team)} — ${teamLabel(opp)} · ${venue}`);

    const changes = validateLineup(team);
    $('tactics-warnings').innerHTML = changes.map(c => `<div>⚠️ ${c}</div>`).join('');

    prepareTeamForMatch(opp); // соперник выбирает состав (видим его силу)
    setHtml('tactics-opp-strength', `${teamLabel(opp)} ${lineupStrength(opp).toFixed(1)}`);

    $('tactics-formation').innerHTML = Object.keys(FORMATIONS).map(f => `<option value="${f}">${f}</option>`).join('');
    renderTactics();
    showScreen('tactics');
}

function renderStyleButtons(containerId, current, onPick) {
    const box = $(containerId);
    box.innerHTML = Object.entries(STYLES).map(([key, s]) =>
        `<button class="style-btn ${key === current ? 'active' : ''}" data-style="${key}" title="${s.hint}">${s.label}</button>`).join('');
    box.querySelectorAll('.style-btn').forEach(b => b.onclick = () => onPick(b.dataset.style));
}

function renderTactics() {
    const team = state.userTeam;
    const squad = getSquad(team);
    const players = getSquadPlayers(team);
    const byNum = Object.fromEntries(players.map(p => [p.number, p]));
    const slots = FORMATIONS[squad.formation];

    $('tactics-formation').value = squad.formation;
    renderStyleButtons('tactics-style', squad.style, style => { squad.style = style; renderTactics(); });
    setText('tactics-style-hint', STYLES[squad.style].hint);
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
}

function onTacticsClick(key) {
    const squad = getSquad(state.userTeam);
    const byNum = Object.fromEntries(getSquadPlayers(state.userTeam).map(p => [p.number, p]));
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
        if (reserve.suspended) { alert(`${reserve.name} дисквалифицирован и пропускает этот матч`); renderTactics(); return; }
        squad.lineup[slotIdx] = reserve.number;
    }
    renderTactics();
}

function initTacticsScreen() {
    $('tactics-formation').addEventListener('change', e => {
        setFormation(state.userTeam, e.target.value);
        tacticsSelection = null;
        renderTactics();
    });
    $('btn-auto-lineup').onclick = () => {
        getSquad(state.userTeam).lineup = autoLineup(state.userTeam);
        tacticsSelection = null;
        renderTactics();
    };
    $('btn-tactics-back').onclick = () => { saveGame(); openDashboard(); };
    $('btn-tactics-play').onclick = () => {
        const squad = getSquad(state.userTeam);
        if (squad.lineup.filter(n => n !== null).length < 11) { alert('⚠️ В стартовом составе должно быть 11 игроков'); return; }
        saveGame();
        openMatchScreen(tacticsMatch);
    };
}

// В карьере перед своим матчем — экран тактики, иначе сразу матч
function openMatch(match) {
    if (isUserMatch(match)) openTactics(match);
    else openMatchScreen(match);
}

// ===== ТРАНСФЕРНОЕ ОКНО (карьера, между сезонами) =====

let trCareer = null;

function openTransferWindow() {
    trCareer = readCareer();
    careerPlayers = trCareer.players || (trCareer.players = {});
    state.rosters = null; // работаем с актуальными составами, а не с зафиксированными в прошлом турнире
    const season = trCareer.seasons.length + 1;
    setText('tr-subtitle', `Перед сезоном ${season}. Продавайте, покупайте — изменения вступят в силу в новом сезоне.`);
    renderTransfers();
    showScreen('transfers');
}

function trUserTeam() {
    return trCareer.teamName;
}

// Пул клубов для рынка: те же лиги, что в карьере
function trMarketTeams() {
    const type = (trCareer.lastSettings && trCareer.lastSettings.teamType) || 'world';
    return getTeamsData(type).names.filter(n => n !== trUserTeam());
}

function trRow(p, opts) {
    const value = playerValue(p.rating, p.age);
    const price = opts.sell ? Math.round(value * 0.8 * 10) / 10 : value;
    return `<div class="tr-row">
        <span class="tp-slot">${p.position}</span>
        ${opts.team ? crestHtml({ name: opts.team, emoji: emojiOfTeam(opts.team) }, 'sm') : ''}
        <span class="tr-name"><b>${p.name}</b>${opts.team ? `<small>${opts.team}</small>` : ''}</span>
        <span class="tr-age" title="Возраст">${p.age} л.</span>
        <span class="tp-rating" title="Рейтинг">${p.rating}</span>
        <span class="tr-price">${formatMoney(price)}</span>
        <button class="btn-secondary tr-btn" data-action="${opts.sell ? 'sell' : 'buy'}" data-key="${opts.key}" ${opts.disabled ? 'disabled' : ''} title="${opts.reason || ''}">${opts.sell ? 'Продать' : 'Купить'}</button>
    </div>`;
}

function emojiOfTeam(name) {
    const data = getTeamsData('mixed');
    return data.emojis[data.names.indexOf(name)] || '⚪';
}

function renderTransfers() {
    const user = trUserTeam();
    const squad = careerSquad(user);
    const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
    setText('tr-budget', formatMoney(trCareer.budget));
    setText('tr-income', trCareer.lastIncome ? `+${formatMoney(trCareer.lastIncome)}` : '—');
    setText('tr-count', `${squad.length} / ${SQUAD_MAX}`);
    setText('tr-strength', rosterTeamRating(squad));

    // Развитие за прошлый сезон
    const dev = trCareer.lastDevelopment || [];
    $('tr-dev-card').style.display = dev.length ? '' : 'none';
    $('tr-development').innerHTML = dev.map(d => {
        const diff = d.after - d.before;
        const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
        return `<div class="tr-dev ${cls}"><span class="tp-slot">${d.position}</span><span class="tr-name">${d.name}</span><span class="tr-age">${d.age} л.</span><span>${d.before} → <b>${d.after}</b></span><span class="tr-diff">${diff > 0 ? '+' : ''}${diff}</span></div>`;
    }).join('');

    // Свой состав
    $('tr-squad').innerHTML = [...squad].sort((a, b) => order[a.position] - order[b.position] || b.rating - a.rating).map(p => {
        const reason = canSell(user, p);
        return trRow(p, { sell: true, key: `${p.origTeam || user}|${p.name}`, disabled: !!reason, reason });
    }).join('');

    // Рынок
    const pos = $('tr-pos').value, sort = $('tr-sort').value;
    const q = $('tr-search').value.trim().toLowerCase();
    const afford = $('tr-afford').checked;
    const full = squad.length >= SQUAD_MAX;
    let market = [];
    trMarketTeams().forEach(team => {
        getTeamRoster(team, teamRatings[team] ?? 75).forEach(p => market.push({ ...p, team }));
    });
    market = market.filter(p => (!pos || p.position === pos) &&
        (!q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)) &&
        (!afford || playerValue(p.rating, p.age) <= trCareer.budget));
    const sorters = {
        rating: (a, b) => b.rating - a.rating,
        young: (a, b) => a.age - b.age || b.rating - a.rating,
        cheap: (a, b) => playerValue(a.rating, a.age) - playerValue(b.rating, b.age)
    };
    market.sort(sorters[sort]);
    $('tr-market').innerHTML = market.slice(0, 80).map(p => {
        const price = playerValue(p.rating, p.age);
        const reason = full ? `в составе уже ${SQUAD_MAX} игроков` : price > trCareer.budget ? 'не хватает денег' : '';
        return trRow(p, { team: p.team, key: `${p.team}|${p.origTeam || p.team}|${p.name}`, disabled: !!reason, reason });
    }).join('') || '<div class="muted">Никого не найдено</div>';

    document.querySelectorAll('#screen-transfers .tr-btn').forEach(b => b.onclick = () => onTransferClick(b.dataset.action, b.dataset.key));
}

async function onTransferClick(action, key) {
    const user = trUserTeam();
    let error;
    if (action === 'sell') {
        const p = careerSquad(user).find(x => `${x.origTeam || user}|${x.name}` === key);
        if (!p || !(await askConfirm(`Продать ${p.name} за ${formatMoney(Math.round(playerValue(p.rating, p.age) * 0.8 * 10) / 10)}?`, { ok: 'Продать' }))) return;
        error = sellPlayer(trCareer, user, p, trMarketTeams());
    } else {
        const [team, origTeam, ...rest] = key.split('|');
        const name = rest.join('|');
        const p = getTeamRoster(team, teamRatings[team] ?? 75).find(x => x.name === name && (x.origTeam || team) === origTeam);
        if (!p) return;
        error = buyPlayer(trCareer, user, p, team);
    }
    if (error) { notify('⚠️ ' + error); return; }
    writeCareer(trCareer);
    careerPlayers = trCareer.players;
    renderTransfers();
}

function initTransfersScreen() {
    ['tr-pos', 'tr-sort', 'tr-afford'].forEach(id => $(id).addEventListener('change', renderTransfers));
    $('tr-search').addEventListener('input', renderTransfers);
    $('btn-tr-start').onclick = () => {
        startNextSeason();
        renderTeamsList();
        showScreen('teamsList');
    };
}

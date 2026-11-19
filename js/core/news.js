// ===== ЛЕНТА НОВОСТЕЙ =====
// Новости пишутся по ходу турнира из того, что произошло в матчах: сенсации, разгромы, хет-трики,
// серии, тяжёлые травмы, смена лидера, кубок, трансферы. Хранятся в сохранении (state.news).
// Имена — в именительном падеже, команды — в кавычках-«ёлочках».

const NEWS_MAX = 80;
const NEWS_TAGS = {
    result: { icon: '📰', label: 'Матчи' },
    player: { icon: '⭐', label: 'Игроки' },
    injury: { icon: '🚑', label: 'Травмы' },
    table: { icon: '📊', label: 'Таблица' },
    cup: { icon: '🏆', label: 'Кубок' },
    club: { icon: '🏟️', label: 'Клубы' },
    transfer: { icon: '💼', label: 'Трансферы' }
};

const qn = team => `«${team.name}»`;

function resetNews() {
    state.news = [];
    state.newsMeta = { seq: 0, leaderId: null, milestones: {}, moraleLow: {} };
}

function ensureNews() {
    if (!state.news) resetNews();
    if (!state.newsMeta) state.newsMeta = { seq: 0, leaderId: null, milestones: {}, moraleLow: {} };
}

// Метка «когда»: тур лиги, раунд плей-офф или кубка
function newsWhen(m) {
    if (!m) {
        if (state.settings.mode === 'league' || state.settings.mode === 'groups') {
            const md = getCurrentMatchday();
            return md ? `Перед туром ${md}` : 'Итоги этапа';
        }
        return getStageTitle() || '';
    }
    if (m.cup) return m.roundName;
    if (m.matchday) return `Тур ${m.matchday}`;
    return m.roundName || '';
}

// weight: важность (1–10); команде игрока в карьере — бонус, такие новости всегда наверху
function pushNews({ tag, title, text = '', teams = [], weight = 5, when = null, match = null }) {
    ensureNews();
    const ids = teams.filter(Boolean).map(t => t.id);
    const mine = humanTeams().some(t => ids.includes(t.id));
    state.news.push({
        id: ++state.newsMeta.seq, tag, title, text, teamIds: ids,
        weight: weight + (mine ? 3 : 0), mine, when: when || newsWhen(match)
    });
    if (state.news.length > NEWS_MAX) {
        // Старые и малозначимые — первыми на выход
        state.news.sort((a, b) => a.id - b.id);
        const drop = state.news.slice(0, state.news.length - NEWS_MAX).filter(n => n.weight < 9 && !n.mine);
        const dropIds = new Set(drop.map(n => n.id));
        state.news = state.news.filter(n => !dropIds.has(n.id)).slice(-NEWS_MAX);
    }
}

// ----- Из одной игры (движок, после финального свистка) -----
function newsFromSim(sim) {
    const m = sim.match;
    const { t1, t2 } = sim.score;
    const A = sim.sides.team1.team, B = sim.sides.team2.team;
    const score = `${t1}:${t2}`;
    const winSide = t1 > t2 ? 'team1' : (t2 > t1 ? 'team2' : null);

    // Сенсация: слабый обыграл сильного
    if (winSide) {
        const W = sim.sides[winSide].team, L = sim.sides[otherSide(winSide)].team;
        const gap = L.rating - W.rating;
        if (gap >= 8) pushNews({ tag: 'result', match: m, teams: [W, L], weight: 6 + Math.min(3, Math.floor((gap - 8) / 3)),
            title: `Сенсация! ${qn(W)} обыгрывает ${qn(L)}`, text: `${A.name} ${score} ${B.name}. Разница в классе не помогла фавориту.` });
        else if (Math.abs(t1 - t2) >= 5) pushNews({ tag: 'result', match: m, teams: [W, L], weight: 6,
            title: `Разгром: ${qn(W)} не оставляет шансов ${qn(L)}`, text: `${A.name} ${score} ${B.name}.` });
    } else if (t1 + t2 >= 6) {
        pushNews({ tag: 'result', match: m, teams: [A, B], weight: 5, title: `Безумная ничья ${score}`, text: `${qn(A)} и ${qn(B)} устроили перестрелку.` });
    }

    // Хет-трики и покеры
    const byPlayer = new Map();
    sim.events.filter(e => e.type === 'goal' && e.player).forEach(e => {
        const k = `${e.side}:${e.player.number}`;
        byPlayer.set(k, { ev: e, n: (byPlayer.get(k)?.n || 0) + 1 });
    });
    byPlayer.forEach(({ ev, n }) => {
        if (n < 3) return;
        const team = sim.sides[ev.side].team, opp = sim.sides[otherSide(ev.side)].team;
        const word = n >= 5 ? 'Пента-трик' : n === 4 ? 'Покер' : 'Хет-трик';
        pushNews({ tag: 'player', match: m, teams: [team], weight: 6 + (n - 3),
            title: `${word}: ${ev.player.name}`, text: `${n} ${n >= 5 ? 'голов' : 'гола'} в ворота ${qn(opp)} (${A.name} ${score} ${B.name}).` });
    });

    // Матч жизни
    const best = sim.manOfTheMatch && sim.manOfTheMatch();
    const bestMine = best && isHuman(sim.sides[best.side].team);
    const involv = best ? sim.events.filter(e => e.type === 'goal' && e.side === best.side && ((e.player && e.player.number === best.number) || (e.assister && e.assister.number === best.number))).length : 0;
    if (best && (bestMine ? best.rating >= 9.5 : best.rating >= 10 && involv >= 3) && ![...byPlayer.values()].some(x => x.n >= 3 && x.ev.player.number === best.number && x.ev.side === best.side)) {
        const team = sim.sides[best.side].team;
        pushNews({ tag: 'player', match: m, teams: [team], weight: 5,
            title: state.news.some(n => n.title === `Матч жизни: ${best.name}`) ? `${best.name} снова в ударе` : `Матч жизни: ${best.name}`, text: `Оценка ${best.rating.toFixed(1)} в игре ${A.name} — ${B.name} (${score}).` });
    }

    // Тяжёлые травмы и удаления
    ['team1', 'team2'].forEach(side => {
        const s = sim.sides[side];
        (s.injured || new Map()).forEach((inj, num) => {
            const minePlayer = isHuman(s.team);
            if (inj.matches < (minePlayer ? 2 : 4)) return;
            const p = [...s.onPitch, ...s.subbedOff, ...s.sentOff].find(x => x.number === num);
            if (!p) return;
            pushNews({ tag: 'injury', match: m, teams: [s.team], weight: inj.matches >= 8 ? 7 : 5,
                title: `Травма: ${p.name}`, text: `${inj.type[0].toUpperCase() + inj.type.slice(1)}, пропустит ${matchesWord(inj.matches)}. Удар по ${qn(s.team)}.` });
        });
        if (isHuman(s.team)) s.sentOff.forEach(p => {
            pushNews({ tag: 'club', match: m, teams: [s.team], weight: 3,
                title: `Удаление: ${p.name}`, text: `${qn(s.team)} доигрывала в меньшинстве (${A.name} ${score} ${B.name}). Следующий матч он пропустит.` });
        });
    });
}

// ----- По итогу матча (с учётом двух игр и пенальти) -----
function newsFromMatch(m, winner) {
    const agg = m.aggregateScore;
    const loser = winner ? (winner === m.team1 ? m.team2 : m.team1) : null;
    const pens = m.penalties.kicks.length ? ` (пен. ${m.penalties.t1}:${m.penalties.t2})` : '';
    const line = `${m.team1.name} ${agg.t1}:${agg.t2} ${m.team2.name}${pens}`;

    // «Вдвоём»: очная встреча игроков
    if (isDuo() && isHuman(m.team1) && isHuman(m.team2)) pushNews({ tag: 'result', match: m, teams: [m.team1, m.team2], weight: 7,
        title: winner ? `Дуэль игроков: ${qn(winner)} сильнее` : 'Дуэль игроков: ничья', text: line });

    if (m.cup && winner) {
        if (m.isFinal) pushNews({ tag: 'cup', match: m, teams: [winner, loser], weight: 10, title: `${qn(winner)} — обладатель кубка!`, text: `Финал: ${line}.` });
        else if (m.penalties.kicks.length) pushNews({ tag: 'cup', match: m, teams: [winner, loser], weight: 5, title: `Кубок: ${qn(winner)} проходит по пенальти`, text: line });
        else if (loser.rating - winner.rating >= 5) pushNews({ tag: 'cup', match: m, teams: [winner, loser], weight: 7, title: `Кубковая сенсация: ${qn(loser)} вылетает`, text: `${line}. ${qn(winner)} проходит дальше.` });
        else if (isCareer() && state.userTeam && m.involves(state.userTeam)) pushNews({ tag: 'cup', match: m, teams: [winner, loser], weight: 4,
            title: winner === state.userTeam ? `${qn(winner)} проходит дальше в кубке` : `${qn(loser)} выбывает из кубка`, text: line });
    } else if (m.stage === 'playoff' && winner) {
        if (m.roundIndex === 2) pushNews({ tag: 'result', match: m, teams: [winner, loser], weight: 8, title: `${qn(winner)} — в финале!`, text: line });
        else if (m.penalties.kicks.length) pushNews({ tag: 'result', match: m, teams: [winner, loser], weight: 6, title: `Нервы: ${qn(winner)} проходит по пенальти`, text: line });
        else if (loser.rating - winner.rating >= 5) pushNews({ tag: 'result', match: m, teams: [winner, loser], weight: 7, title: `${qn(loser)} неожиданно вылетает`, text: `${line}. ${qn(winner)} идёт дальше.` });
    }

    // Серии (форма команды — последние 5 матчей, считаем ровно на пороге, чтобы не повторяться)
    [m.team1, m.team2].forEach(team => {
        const res = ((team.stats && team.stats.form) || []).map(f => f[0]).reverse();
        const run = r => { let n = 0; for (const x of res) { if (x !== r) break; n++; } return n; };
        // О серии сообщаем один раз, пока она не прервётся
        ensureNews();
        const said = state.newsMeta.streaks = state.newsMeta.streaks || {};
        if (run('W') >= 5) { if (said[team.id] !== 'W') { said[team.id] = 'W'; pushNews({ tag: 'club', match: m, teams: [team], weight: 5, title: `${qn(team)} на ходу: 5 побед подряд` }); } }
        else if (run('L') >= 4) { if (said[team.id] !== 'L') { said[team.id] = 'L'; pushNews({ tag: 'club', match: m, teams: [team], weight: 5, title: `Кризис в ${qn(team)}: четыре поражения подряд` }); } }
        else delete said[team.id];
    });
}

// ----- Между турами: лидер, рубежи бомбардиров, настроение -----
function newsBetweenRounds() {
    ensureNews();
    const meta = state.newsMeta;
    // Новый лидер чемпионата
    if (state.settings.mode === 'league' && state.teams.some(t => t.stats.played)) {
        const leader = sortGroup([...state.teams])[0];
        if (meta.leaderId !== null && leader.id !== meta.leaderId && leader.stats.played >= 2) {
            const prev = state.teams.find(t => t.id === meta.leaderId);
            pushNews({ tag: 'table', teams: [leader, prev], weight: 7,
                title: `Новый лидер: ${qn(leader)}`, text: `${leader.stats.points} очков после ${leader.stats.played} туров${prev ? `, ${qn(prev)} опускается на второе место` : ''}.` });
        }
        meta.leaderId = leader.id;
    }
    // Рубежи бомбардиров: 5, 10, 15, 20… голов
    Object.values(playerStats).forEach(p => {
        const mark = Math.floor(p.goals / 5) * 5;
        if (mark < 10) return;
        const key = `${p.teamId}-${p.number}`;
        if ((meta.milestones[key] || 0) >= mark) return;
        meta.milestones[key] = mark;
        const team = getTeamById(p.teamId);
        const leader = Object.values(playerStats).every(o => o.goals <= p.goals);
        pushNews({ tag: 'player', teams: [team], weight: 4 + Math.min(3, mark / 5 - 1) + (leader ? 1 : 0),
            title: `${p.name}: ${p.goals} ${plural5(p.goals)} в турнире`, text: leader ? 'Лучший бомбардир турнира.' : `${team ? qn(team) : ''} — ${p.matches} ${plural5m(p.matches)}.` });
    });
    // Настроение в командах людей
    if (state.squads) humanTeams().forEach(userTeam => {
        const mo = teamMorale(userTeam);
        const was = meta.moraleLow[userTeam.id];
        if (mo < 48 && !was) {
            meta.moraleLow[userTeam.id] = true;
            pushNews({ tag: 'club', teams: [userTeam], weight: 5, title: `В раздевалке ${qn(userTeam)} напряжение`, text: 'Игроки недовольны результатами и игровым временем.' });
        } else if (mo >= 60 && was) {
            meta.moraleLow[userTeam.id] = false;
            pushNews({ tag: 'club', teams: [userTeam], weight: 4, title: `${qn(userTeam)}: настроение наладилось`, text: 'Команда снова верит в успех.' });
        }
    });
}

function plural5(n) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'гол' : (a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 'гола' : 'голов'); }
function plural5m(n) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'матч' : (a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 'матча' : 'матчей'); }

// ----- Старт сезона -----
function newsSeasonStart() {
    resetNews();
    const fav = [...state.teams].sort((a, b) => b.rating - a.rating).slice(0, 3);
    pushNews({ tag: 'table', when: 'Перед стартом', teams: fav, weight: 5,
        title: 'Старт турнира: кто фаворит?', text: `Эксперты выделяют ${fav.map(qn).join(', ')}.` });
    if (state.cup && isCareer() && state.userTeam) {
        const r = state.cup.rounds[0];
        const mm = r.matches.find(m => m.involves(state.userTeam));
        const opp = mm ? (mm.team1.id === state.userTeam.id ? mm.team2 : mm.team1) : null;
        pushNews({ tag: 'cup', when: 'Перед стартом', teams: [state.userTeam, opp], weight: 6, title: 'Жеребьёвка кубка',
            text: opp ? `${qn(state.userTeam)} сыграет с ${qn(opp)} (${r.name}).` : `${qn(state.userTeam)} начнёт кубок со следующего раунда.` });
    }
    // Летние трансферы (карьера): что сделано в межсезонье
    if (isCareer() && state.userTeam) {
        const career = readCareer();
        const season = (career.seasons || []).length + 1;
        (career.transfers || []).filter(t => t.season === season).slice(-6).forEach(t => {
            pushNews({ tag: 'transfer', when: 'Межсезонье', teams: [state.userTeam], weight: 6,
                title: t.type === 'in' ? `${qn(state.userTeam)}: новичок — ${t.name}` : `${t.name} покидает ${qn(state.userTeam)}`,
                text: t.type === 'in' ? `Прежний клуб — ${qn({ name: t.team })}, сумма — ${formatMoney(t.price)}.` : `Новый клуб — ${qn({ name: t.team })}, сумма — ${formatMoney(t.price)}.` });
        });
    }
}

// Жеребьёвка очередного раунда кубка: пара игрока (в карьере) или самая громкая пара
function newsCupDraw() {
    const r = currentCupRound();
    if (!r) return;
    const user = isCareer() ? state.userTeam : null;
    const mm = user ? r.matches.find(m => m.involves(user)) : null;
    const pair = mm || [...r.matches].sort((a, b) => (b.team1.rating + b.team2.rating) - (a.team1.rating + a.team2.rating))[0];
    const when = `${CUP_NAME} · ${r.name}`;
    if (mm) {
        const opp = mm.team1.id === user.id ? mm.team2 : mm.team1;
        pushNews({ tag: 'cup', when, teams: [user, opp], weight: 4, title: `Жеребьёвка: ${r.name}`, text: `${qn(user)} сыграет с ${qn(opp)}.` });
    } else if (pair) {
        pushNews({ tag: 'cup', when, teams: [pair.team1, pair.team2], weight: r.matches.length <= 2 ? 6 : 3,
            title: r.matches.length === 1 ? `Финал кубка: ${qn(pair.team1)} — ${qn(pair.team2)}` : `Жеребьёвка: ${r.name}`,
            text: r.matches.length === 1 ? 'Решающий матч на нейтральном поле.' : `Главная пара раунда — ${qn(pair.team1)} и ${qn(pair.team2)}.` });
    }
}

// ===== РЕПОРТАЖ: живые фразы комментатора в ленте событий =====
// Комментатор читает розыгрыш минуты (sim.play) и события движка и описывает эпизод
// по ходу: завязка — удар — развязка. Фразы появляются в такт полёту мяча на поле.
// Имена всегда в именительном падеже (склонять иностранные фамилии нельзя наугад).

const cm = {
    gen: 0,           // поколение: при открытии нового матча старые отложенные фразы не выводятся
    last: {},         // последний использованный шаблон по ключу — чтобы фразы не повторялись подряд
    quiet: 0,         // сколько минут подряд комментатор молчал
    trailed: { team1: false, team2: false }  // уступала ли команда по ходу матча (для «камбэка»)
};

const MIC = '🎙';

function cmPick(key, list) {
    if (list.length === 1) return list[0];
    let i;
    do { i = Math.floor(Math.random() * list.length); } while (i === cm.last[key]);
    cm.last[key] = i;
    return list[i];
}

const q = team => `«${team.name}»`;

function cmPlayer(sim, side, num) {
    if (num === undefined || num === null) return null;
    const s = sim.sides[side];
    return [...s.onPitch, ...s.subbedOff, ...s.sentOff].find(p => p.number === num) || null;
}

// Вывести фразу в ленту (с задержкой — в момент, когда мяч доходит до нужной точки)
function cmSay(m, minute, text, { type = 'comment', team = null, delay = 0, cls = '' } = {}) {
    const gen = cm.gen;
    const put = () => {
        if (gen !== cm.gen) return;
        addMatchEvent(m, minute, type, text, team, 'comment ' + cls);
    };
    if (delay > 0) setTimeout(put, delay); else put();
}

function resetCommentary(sim) {
    cm.gen++;
    cm.last = {};
    cm.quiet = 0;
    cm.trailed = { team1: false, team2: false };
}

// ----- Стартовый свисток -----
function commentKickoff(m, sim) {
    const s1 = sim.sides.team1, s2 = sim.sides.team2;
    const st = s => (STYLES[s.style] || STYLES.balance).label.replace(/^[^А-Яа-яЁёA-Za-z]+/, '').toLowerCase();
    cmSay(m, 0, cmPick('ko', [
        `Стартовый свисток! ${q(s1.team)} против ${q(s2.team)} — поехали!`,
        `Матч начался! На поле ${q(s1.team)} и ${q(s2.team)}.`,
        `Судья даёт свисток — встреча ${q(s1.team)} и ${q(s2.team)} началась!`
    ]), { type: 'half' });
    cmSay(m, 0, `${q(s1.team)}: ${s1.formation}, ${st(s1)}. ${q(s2.team)}: ${s2.formation}, ${st(s2)}.`, { type: 'tactic', delay: 250 });
}

// ----- Завязка атаки -----
function buildupLine(sim, play, side) {
    const team = sim.sides[side].team;
    const style = sim.sides[side].style;
    const names = play.chain.map(n => cmPlayer(sim, side, n)).filter(Boolean);
    const first = names[0];
    const passer = play.end ? names[names.length - 2] : null; // его назовёт фраза удара
    const mid = names.find(p => p !== passer && p.number !== (play.end && play.end.shooter));
    if (play.kind === 'counter') return cmPick('counter', [
        `Контратака ${q(team)}! ${first ? first.name + ' стремительно уходит вперёд' : 'Мяч летит вперёд'}…`,
        `Перехват — и ${q(team)} мчится в контратаку!`,
        `${q(team)} ловит соперника на выходе — быстрая атака!`
    ]);
    if (play.kind === 'corner') return null; // угловой описывает отдельное событие
    const byStyle = {
        possession: [`${q(team)} терпеливо разыгрывает мяч в центре`, `Короткий пас за пасом — ${q(team)} ищет брешь`],
        pressing:   [`${q(team)} отбирает мяч высоко и сразу идёт вперёд`, `Прессинг ${q(team)} приносит плоды — мяч отобран`],
        attack:     [`${q(team)} снова атакует большими силами`, `${q(team)} бросает вперёд всех — атака!`],
        counter:    [`${q(team)} быстро переводит мяч вперёд`],
        defense:    [`${q(team)} осторожно выходит из обороны`],
        balance:    [`${q(team)} начинает позиционную атаку`, `${q(team)} разгоняет атаку`]
    };
    const lines = [...(byStyle[style] || byStyle.balance)];
    if (mid) lines.push(`${mid.name} отдаёт пас вперёд — ${q(team)} в атаке`, `${mid.name} набирает скорость с мячом`);
    const line = cmPick('build', lines);
    return /[!…]$/.test(line) ? line : line + '…';
}

// ----- Удар и развязка -----
function shotLines(sim, play, side) {
    const end = play.end;
    const shooter = cmPlayer(sim, side, end.shooter ?? end.taker);
    // Последний пас: предпоследний в цепочке (последний — сам бьющий)
    const passer = cmPlayer(sim, side, play.chain[play.chain.length - 2]);
    const gk = cmPlayer(sim, otherSide(side), end.keeper);
    const sh = shooter ? shooter.name : 'Игрок';
    let shot;
    if (play.kind === 'corner') shot = end.header
        ? cmPick('shotC', [`Подача в штрафную… ${sh} бьёт головой!`, `Навес с углового — ${sh} выигрывает верх!`, `${sh} первым на мяче после подачи — головой!`])
        : cmPick('shotCF', [`Мяч отскакивает в штрафной — ${sh} бьёт с ходу!`, `После подачи ${sh} подхватывает мяч и бьёт!`]);
    else if (passer && passer !== shooter && Math.random() < 0.6)
        shot = cmPick('shotP', [`${passer.name} отдаёт, и ${sh} бьёт!`, `Пас вразрез — ${passer.name}! ${sh} один на один…`, `${passer.name} прострелил! ${sh} замыкает…`]);
    else if (end.at && end.at.r < 83) shot = cmPick('shotFar', [`${sh} пробивает издали!`, `${sh} решается на дальний удар!`, `Удар из-за штрафной — ${sh}!`]);
    else shot = cmPick('shot', [`${sh} бьёт!`, `${sh} пробивает из штрафной!`, `${sh} решается на удар!`, `${sh} обыгрывает защитника и бьёт!`]);

    let result = null;
    if (end.type === 'off') result = cmPick('off', ['Мимо ворот!', 'Выше перекладины!', 'Чуть-чуть мимо — в сантиметрах от штанги!', 'Не попал в створ.', 'Мяч улетает на трибуны.']);
    else if (end.type === 'save') {
        const g = gk ? gk.name : 'Вратарь';
        result = cmPick('save', [`${g} на месте — сейв!`, `Блестящий сейв! ${g} тащит!`, `${g} отбивает в падении!`, `${g} уверенно забирает мяч.`, `${g} переводит мяч на угловой!`]);
    }
    // Огромный момент не реализован — комментатор хватается за голову
    if (result && end.xg >= 0.35) result = cmPick('bigMiss', ['Стопроцентный момент! ', 'Как можно было не забить?! ', 'Невероятно! ']) + result;
    return { shot, result };
}

// Фразы к голу: контекст счёта, дубль/хет-трик, время
function goalFlavor(sim, ev) {
    const side = ev.side, opp = otherSide(side);
    const my = sim.score[SIDE_KEY[side]], their = sim.score[SIDE_KEY[opp]];
    const team = sim.sides[side].team;
    const bits = [];
    const scorerGoals = sim.events.filter(e => e.type === 'goal' && e.side === side && e.player && ev.player && e.player.number === ev.player.number).length;
    if (scorerGoals === 3) bits.push(`ХЕТ-ТРИК! ${ev.player.name} забивает третий!`);
    else if (scorerGoals === 4) bits.push(`Покер! ${ev.player.name} неудержим!`);
    else if (scorerGoals === 2) bits.push(`Дубль! ${ev.player.name} забивает второй!`);

    if (my === their) bits.push(cmPick('eq', ['Счёт снова равный!', `${q(team)} отыгрывается!`, 'Всё сначала — ничья!']));
    else if (my === their + 1 && cm.trailed[side] && my > 1) bits.push(`Камбэк! ${q(team)} вырывает преимущество!`);
    else if (my === their + 1) bits.push(cmPick('lead', [`${q(team)} выходит вперёд!`, `${q(team)} ведёт!`]));
    else if (my - their >= 3) bits.push(cmPick('rout', ['Это уже разгром!', `${q(team)} не останавливается!`]));
    else if (my < their) bits.push(`${q(team)} сокращает отставание — ещё не вечер!`);

    if (ev.xg != null && ev.xg < 0.05) bits.push(cmPick('screamer', ['Какой удар издалека — шедевр!', 'Гол из ничего!']));
    if (ev.minute >= 85) bits.push('Гол на последних минутах!');
    else if (ev.minute <= 3) bits.push('Молниеносный старт!');
    if (ev.assister && !String(ev.text).includes('пенальти')) bits.push(`${ev.assister.name} — с голевой передачей.`);
    return bits.join(' ');
}

// ----- Главная функция: описать минуту -----
// plan — тайминги полёта мяча из animateMinute (shotAt, finishAt, goalAt)
function commentMinute(m, sim, events, plan, ms, span) {
    const play = sim.play;
    const minute = sim.minute;
    const side = play ? play.side : sim.attackingSide;
    const team = sim.sides[side].team;
    const fast = ms < 350; // высокая скорость: одна короткая фраза на эпизод
    const end = play && play.end;
    let said = false;

    // Отметка «уступала по ходу матча» — до гола этой минуты (счёт движка уже обновлён, поэтому смотрим на счёт до голов)
    const goalsNow = events.filter(e => e.type === 'goal');
    const pre = { t1: sim.score.t1, t2: sim.score.t2 };
    goalsNow.forEach(e => pre[SIDE_KEY[e.side]]--);
    if (pre.t1 < pre.t2) cm.trailed.team1 = true;
    if (pre.t2 < pre.t1) cm.trailed.team2 = true;

    const shotEnd = end && ['goal', 'save', 'off'].includes(end.type);
    if (shotEnd) {
        const { shot, result } = shotLines(sim, play, side);
        const shotAt = plan.shotAt ?? ms * span * 0.5;
        const finishAt = plan.finishAt ?? ms * span * 0.8;
        if (!fast) {
            const build = buildupLine(sim, play, side);
            if (build) cmSay(m, minute, build, { team });
            cmSay(m, minute, shot, { team, delay: Math.max(0, shotAt - 150), cls: 'c-shot' });
        }
        if (result) {
            const type = end.type === 'save' ? 'shot' : 'shot-off';
            cmSay(m, minute, fast ? `${shot} ${result}` : result, { type, team, delay: finishAt + 40, cls: 'c-result' });
        }
        said = true;
    }

    events.forEach(ev => {
        if (ev.type === 'shot' || ev.type === 'shot-off') return; // описано выше
        if (ev.type === 'goal') {
            const flavor = goalFlavor(sim, ev);
            const delay = (plan.goalAt != null ? plan.goalAt + 60 : ms * span * 0.85) + 5; // сразу за строкой гола
            if (flavor) cmSay(m, minute, flavor, { type: 'goal', team: ev.team, delay, cls: 'c-goal' });
            said = true;
        } else if (ev.type === 'corner') {
            // Угловой без удара — защита справилась; с ударом — дальше говорит shotLines
            const noShot = !(play && play.kind === 'corner' && shotEnd);
            cmSay(m, minute, noShot && !fast
                ? cmPick('cornerNo', [`${ev.text}. Защита выносит мяч.`, `${ev.text}… мяч никто не замкнул.`])
                : ev.text, { type: 'corner', team: ev.team });
            said = true;
        } else if (ev.type === 'foul') {
            const victim = end && end.type === 'foul' && ev.side !== side ? cmPlayer(sim, side, end.victim) : null;
            const text = victim
                ? cmPick('foulV', [`${victim.name} сбит! Нарушил ${ev.player.name}.`, `${ev.player.name} грубо останавливает атаку — фол.`, `Свисток: ${ev.player.name} фолит, пострадал ${victim.name}.`])
                : cmPick('foul', [`Фол — ${ev.player.name}.`, `${ev.player.name} нарушает правила.`, `Судья фиксирует нарушение: ${ev.player.name}.`]);
            cmSay(m, minute, text, { type: 'foul', team: ev.team, delay: fast ? 0 : (shotEnd ? (plan.finishAt || 0) + 120 : (plan.total || 0) * 0.9) });
            said = true;
        } else if (ev.type === 'penalty-miss') {
            cmSay(m, minute, `Пенальти! Бьёт ${ev.player.name}…`, { type: 'comment', team: ev.team });
            cmSay(m, minute, ev.text, { type: 'penalty-miss', team: ev.team, delay: (plan.total || 0) * 0.95 });
            said = true;
        } else if (ev.type === 'half' && minute === 45) {
            const st = sim.stats;
            cmSay(m, minute, ev.text, { type: 'half' });
            cmSay(m, minute, `Удары ${st.shots.team1}–${st.shots.team2}, владение ${st.possession.team1}% на ${st.possession.team2}%. ${halfVerdict(sim)}`, { type: 'comment', delay: 200 });
            said = true;
        } else {
            showSimEvent(m, ev); // карточки, замены, тактика, травмы — как есть
            said = true;
        }
    });

    // Пенальти, забитый: подводка перед голом
    if (end && end.type === 'penalty-goal') {
        const taker = cmPlayer(sim, side, end.taker);
        if (taker) cmSay(m, minute, `Пенальти! К мячу подходит ${taker.name}…`, { team });
    }

    // Тихая минута: изредка — картинка игры
    if (!said && !fast && !sim.isOver) {
        cm.quiet++;
        if (cm.quiet >= 2 && Math.random() < 0.6) {
            cm.quiet = 0;
            cmSay(m, minute, quietLine(sim, play, side), { team });
        }
    } else cm.quiet = 0;
}

function halfVerdict(sim) {
    const { t1, t2 } = sim.score;
    const n1 = q(sim.sides.team1.team), n2 = q(sim.sides.team2.team);
    if (t1 === t2) return t1 === 0 ? 'Пока без голов — всё решится во втором тайме.' : 'Равная игра, интрига сохраняется.';
    const lead = t1 > t2 ? n1 : n2;
    return Math.abs(t1 - t2) >= 2 ? `${lead} уверенно контролирует матч.` : `${lead} уходит на перерыв с минимальным преимуществом.`;
}

function quietLine(sim, play, side) {
    const team = sim.sides[side].team;
    const opp = sim.sides[otherSide(side)].team;
    const poss = sim.stats.possession[side];
    const lines = [
        `${q(team)} контролирует мяч в середине поля.`,
        `${q(opp)} отходит назад и закрывает центр.`,
        `Борьба в центре поля, мяч переходит из ног в ноги.`,
        `${q(team)} ищет вариант для продолжения атаки.`
    ];
    if (poss >= 58) lines.push(`${q(team)} владеет мячом ${poss}% времени.`);
    if (sim.minute > 70) lines.push('Игроки заметно устали — темп падает.');
    if (sim.minute >= 80 && sim.score.t1 === sim.score.t2) lines.push('Концовка! Кто вырвет победу?');
    const keeper = cmPlayer(sim, side, play && play.chain[0]);
    if (keeper && keeper.position === 'DEF') lines.push(`${keeper.name} спокойно разыгрывает от своих ворот.`);
    return cmPick('quiet', lines);
}

// ----- Финальный свисток -----
function commentFinal(m, sim) {
    const { t1, t2 } = sim.score;
    const n1 = q(sim.sides.team1.team), n2 = q(sim.sides.team2.team);
    let text;
    if (m.legs === 2) text = `Финальный свисток! Во втором матче ${t1}:${t2} — итог решает сумма двух встреч.`;
    else if (t1 === t2) text = t1 === 0 ? `Финальный свисток! ${n1} и ${n2} не забили друг другу.` : `Финальный свисток! Боевая ничья ${t1}:${t2}.`;
    else {
        const winSide = t1 > t2 ? 'team1' : 'team2';
        const win = winSide === 'team1' ? n1 : n2;
        const diff = Math.abs(t1 - t2);
        text = `Финальный свисток! ${win} побеждает ${Math.max(t1, t2)}:${Math.min(t1, t2)}.`;
        const underdog = sim.strength(winSide) < sim.strength(otherSide(winSide)) - 4;
        if (cm.trailed[winSide]) text += ' Великолепный камбэк!';
        else if (underdog) text += ' Настоящая сенсация!';
        else if (diff >= 3) text += ' Убедительная победа.';
        else if (Math.min(t1, t2) === 0) text += ' Ещё и на ноль.';
    }
    cmSay(m, sim.minute, text, { type: 'finish' });
}

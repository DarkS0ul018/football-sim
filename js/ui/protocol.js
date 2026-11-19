// ===== ПРОТОКОЛ МАТЧА: авторы голов и передач, удаления, лучший игрок =====
// Данные пишет движок в сам матч (m.goals, m.reds, m.motms — см. recordProtocol в engine.js),
// поэтому протокол есть у любого сыгранного матча: живого, быстрого и досчитанного автоматически.

// Фамилия — для компактных строк («Холанд 23', 67'»)
function shortName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
}

// Авторы голов одной команды: игрок и его минуты (в паре — с пометкой игры)
function scorersOf(m, s, { short = true } = {}) {
    const goals = (m.goals || []).filter(g => g.s === s).sort((a, b) => a.leg - b.leg || a.min - b.min);
    const byPlayer = new Map();
    goals.forEach(g => {
        const key = g.p;
        const mark = `${g.min}'${g.pen ? ' (п)' : ''}${m.legs === 2 ? `<sup>${g.leg}</sup>` : ''}`;
        byPlayer.set(key, [...(byPlayer.get(key) || []), mark]);
    });
    return [...byPlayer.entries()].map(([p, mins]) => `${short ? shortName(p) : p} ${mins.join(', ')}`);
}

// Блок под счётом в карточке результата: слева голы хозяев, справа гостей
function scorersMiniHtml(m) {
    if (!m.isFinished || !(m.goals && m.goals.length)) return '';
    const left = scorersOf(m, 1), right = scorersOf(m, 2);
    return `<div class="mini-scorers"><div>${left.map(x => `<span>⚽ ${x}</span>`).join('')}</div><div>${right.map(x => `<span>${x} ⚽</span>`).join('')}</div></div>`;
}

// Полный протокол — окно поверх экрана
function openMatchReport(m) {
    if (!m || !m.isFinished) return;
    document.querySelector('.report-overlay')?.remove();
    const agg = m.aggregateScore;
    const legs = m.legs === 2 ? [1, 2] : [1];
    const legScore = leg => (leg === 1 && m.legs === 2 ? m.leg1 : (leg === 2 ? m.leg2 : agg));
    const legHome = leg => (m.legs === 2 && leg === 2 ? m.team2 : m.team1);

    const legBlock = leg => {
        const items = [
            ...(m.goals || []).filter(g => g.leg === leg).map(g => ({ min: g.min, s: g.s, html: `⚽ <b>${g.p}</b>${g.pen ? ' <span class="muted">(пен.)</span>' : ''}${g.a ? `<small>пас: ${g.a}</small>` : ''}` })),
            ...(m.reds || []).filter(r => r.leg === leg).map(r => ({ min: r.min, s: r.s, html: `🟥 <b>${r.p}</b> <span class="muted">удаление</span>` }))
        ].sort((a, b) => a.min - b.min);
        const sc = legScore(leg);
        const head = m.legs === 2
            ? `<div class="rp-leg">${leg}-й матч · дома ${legHome(leg).name} · <b>${sc.t1}:${sc.t2}</b></div>` : '';
        const rows = items.length ? items.map(i => `
            <div class="rp-row ${i.s === 1 ? 'home' : 'away'}">
                <div class="rp-side">${i.s === 1 ? i.html : ''}</div>
                <div class="rp-min">${i.min}'</div>
                <div class="rp-side">${i.s === 2 ? i.html : ''}</div>
            </div>`).join('') : '<div class="muted rp-empty">Без голов</div>';
        return head + rows;
    };

    // Лучший игрок: в паре из двух матчей — лучший каждой игры
    const motmItem = x => `<span>${m.legs === 2 ? `${x.leg}-й матч: ` : ''}<b>${x.p}</b> ${crestHtml(x.s === 1 ? m.team1 : m.team2, 'xs')} <span class="rp-rate ${ratingClass(x.r)}">${x.r.toFixed(1)}</span></span>`;
    const motms = (m.motms || []).slice().sort((a, b) => a.leg - b.leg);
    const motmHtml = motms.length ? `<div class="rp-motm">⭐ Лучший игрок${m.legs === 2 ? ' по играм' : ''}: ${motms.map(motmItem).join('<span class="muted">·</span>')}</div>` : '';
    const pens = m.penalties.kicks.length ? `<div class="rp-pens">Серия пенальти: <b>${m.penalties.t1}:${m.penalties.t2}</b></div>` : '';
    const notes = [m.extraTime ? 'дополнительное время' : '', m.isAutoSimulated ? 'досчитан автоматически' : ''].filter(Boolean).join(' · ');

    const el = document.createElement('div');
    el.className = 'report-overlay';
    el.innerHTML = `<div class="report-box" role="dialog" aria-modal="true">
        <button type="button" class="report-close" title="Закрыть">✕</button>
        <div class="rp-round">${m.roundName}${m.isFinal ? ' · финал' : ''}</div>
        <div class="rp-score">
            <div class="rp-team">${crestHtml(m.team1, 'lg')}<span>${m.team1.name}</span></div>
            <div class="rp-num">${agg.t1}:${agg.t2}${m.legs === 2 ? '<small>по сумме</small>' : ''}</div>
            <div class="rp-team">${crestHtml(m.team2, 'lg')}<span>${m.team2.name}</span></div>
        </div>
        ${pens}
        ${notes ? `<div class="muted rp-notes">${notes}</div>` : ''}
        <div class="rp-timeline">${legs.map(legBlock).join('')}</div>
        ${motmHtml}
        ${!(m.goals || []).length && !(m.motms || []).length ? '<div class="muted">Подробностей нет: матч сыгран в старой версии игры.</div>' : ''}
    </div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.report-close')) el.remove(); });
    document.body.appendChild(el);
}

// Нажатие на сыгранный матч (результаты тура, сетка, кубок, итоги) открывает протокол.
// Карточки строятся строками HTML, поэтому матч передаётся номером в реестре.
const reportRegistry = [];
function reportIndex(m) {
    let i = reportRegistry.indexOf(m);
    if (i < 0) { reportRegistry.push(m); i = reportRegistry.length - 1; }
    return i;
}
function reportAttr(m) {
    return m && m.isFinished ? ` data-report="${reportIndex(m)}" title="Протокол матча"` : '';
}
document.addEventListener('click', e => {
    const el = e.target.closest('[data-report]');
    if (el) openMatchReport(reportRegistry[Number(el.dataset.report)]);
});

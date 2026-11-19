// ===== ЛЕНТА НОВОСТЕЙ НА ГЛАВНОМ ЭКРАНЕ =====

const newsView = { filter: 'all', shown: 8, freshFrom: 0 };

// Новый «выпуск»: всё, что появилось с прошлого показа главного экрана, — свежее
function markNewsSeen() {
    ensureNews();
    const top = state.news.reduce((a, n) => Math.max(a, n.id), 0);
    newsView.freshFrom = state.newsMeta.seenId || 0;
    state.newsMeta.seenId = top;
    newsView.shown = 8;
}

function newsItemHtml(n, fresh) {
    const tag = NEWS_TAGS[n.tag] || NEWS_TAGS.result;
    const crests = n.teamIds.map(id => getTeamById(id)).filter(Boolean).slice(0, 2).map(t => crestHtml(t, 'xs')).join('');
    const big = n.weight - (n.mine ? 3 : 0) >= 8; // главная новость — по важности самого события
    return `<article class="news-item ${big ? 'big' : ''} ${n.mine ? 'mine' : ''} ${fresh ? 'fresh' : ''} t-${n.tag}">
        <div class="ni-icon">${tag.icon}</div>
        <div class="ni-body">
            <div class="ni-meta"><span class="ni-when">${n.when}</span><span class="ni-tag">${tag.label}</span>${n.mine ? '<span class="ni-mine">ваша команда</span>' : ''}</div>
            <div class="ni-title">${n.title}</div>
            ${n.text ? `<div class="ni-text">${n.text}</div>` : ''}
        </div>
        <div class="ni-crests">${crests}</div>
    </article>`;
}

function renderNews() {
    const section = $('news-section');
    if (!section) return;
    ensureNews();
    const all = [...state.news].sort((a, b) => b.id - a.id);
    section.style.display = all.length ? 'block' : 'none';
    if (!all.length) return;

    // Фильтры: все / моя команда / темы, которые встречаются
    const tags = Object.keys(NEWS_TAGS).filter(t => all.some(n => n.tag === t));
    const chips = [['all', 'Все']];
    if (isCareer() && state.userTeam && all.some(n => n.mine)) chips.push(['mine', 'Моя команда']);
    tags.forEach(t => chips.push([t, NEWS_TAGS[t].label]));
    if (!chips.some(c => c[0] === newsView.filter)) newsView.filter = 'all';
    $('news-filters').innerHTML = chips.map(([k, l]) => `<button type="button" class="news-chip ${newsView.filter === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('');
    $('news-filters').querySelectorAll('.news-chip').forEach(b => b.onclick = () => { newsView.filter = b.dataset.f; newsView.shown = 8; renderNews(); });

    const list = all.filter(n => newsView.filter === 'all' || (newsView.filter === 'mine' ? n.mine : n.tag === newsView.filter));
    // Свежее — новости последнего «выпуска» (с момента прошлого показа)
    const seen = newsView.freshFrom;
    // Внутри свежего выпуска важные — выше
    const freshPart = list.filter(n => n.id > seen).sort((a, b) => b.weight - a.weight || b.id - a.id);
    const ordered = [...freshPart, ...list.filter(n => n.id <= seen)];
    $('news-list').innerHTML = ordered.slice(0, newsView.shown).map(n => newsItemHtml(n, n.id > seen)).join('')
        || '<div class="muted">Пока нет новостей в этой рубрике.</div>';
    const more = $('btn-news-more');
    more.style.display = ordered.length > newsView.shown ? '' : 'none';
    more.onclick = () => { newsView.shown += 10; renderNews(); };
}

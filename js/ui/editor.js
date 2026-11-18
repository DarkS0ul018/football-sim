// ===== РЕДАКТОР КОМАНД =====
// Рейтинг, цвета и состав любой команды + свои команды. Импорт/экспорт в JSON.

const editor = { type: 'world', selected: null, isNew: false };
const COLOR_EMOJI = ['🔴', '⚪', '🔵', '🔷', '🟢', '🟡', '🟠', '🟣', '⚫', '🟤'];

function openEditor() {
    editor.selected = null;
    renderEditorList();
    renderEditorForm();
    showScreen('editor');
}

function editorTeamInfo(name) {
    const type = russianTeams.names.includes(name) ? 'russia' : 'world';
    const data = type === 'russia' ? russianTeams : worldTeams;
    const i = data.names.indexOf(name);
    return {
        name, type,
        emoji: data.emojis[i] || '⚪',
        rating: teamRatings[name] ?? 75,
        squad: SQUADS[type][name] || { goalkeepers: [], defenders: [], midfielders: [], forwards: [] }
    };
}

function renderEditorList() {
    document.querySelectorAll('#editor-type-tabs .style-btn').forEach(b => b.classList.toggle('active', b.dataset.type === editor.type));
    const data = editor.type === 'russia' ? russianTeams : worldTeams;
    const custom = readCustomData().teams;
    $('editor-team-list').innerHTML = data.names.map(name => {
        const t = editorTeamInfo(name);
        const check = validateTeamData(name, t.squad, t.rating, t.emoji);
        const marks = [
            custom[name] ? (custom[name].isNew ? '<span class="badge" title="Своя команда">новая</span>' : '<span class="badge" title="Изменена в редакторе">✏️</span>') : '',
            check.errors.length ? '<span class="badge badge-red" title="Есть ошибки">!</span>' : (check.warnings.length ? '<span class="badge badge-yellow" title="Есть замечания">⚠️</span>' : '')
        ].join('');
        return `<div class="editor-team ${editor.selected === name ? 'selected' : ''}" data-name="${name}">
            ${crestHtml({ name, emoji: t.emoji }, 'md')}
            <span class="editor-team-name">${name}</span>${marks}
            <span class="tp-rating">${t.rating}</span>
        </div>`;
    }).join('');
    document.querySelectorAll('.editor-team').forEach(el => el.onclick = () => {
        editor.selected = el.dataset.name;
        editor.isNew = false;
        renderEditorList();
        renderEditorForm();
        if (window.innerWidth < 900) $('editor-form-card').scrollIntoView({ behavior: 'smooth' });
    });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

function renderEditorForm() {
    const form = $('editor-form');
    if (!editor.selected && !editor.isNew) {
        form.innerHTML = '<div class="muted">Выберите команду слева или создайте новую.</div>';
        return;
    }
    const t = editor.isNew
        ? { name: '', type: editor.type, emoji: '🔵⚪', rating: 75, squad: { goalkeepers: [], defenders: [], midfielders: [], forwards: [] } }
        : editorTeamInfo(editor.selected);
    const custom = readCustomData().teams[t.name];
    const colors = Array.from(t.emoji).filter(ch => COLOR_EMOJI.includes(ch));
    const swatches = (idx) => COLOR_EMOJI.map(ch =>
        `<button type="button" class="swatch ${colors[idx] === ch ? 'active' : ''}" data-idx="${idx}" data-color="${ch}" style="background:${EMOJI_COLORS[ch]}" title="${ch}"></button>`).join('');

    form.innerHTML = `
        <div class="editor-head">
            <span id="editor-crest">${crestHtml({ name: t.name || 'Новая', emoji: t.emoji }, 'lg')}</span>
            <div class="editor-head-fields">
                <label>Название
                    <input type="text" id="ed-name" maxlength="30" value="${escapeHtml(t.name)}" ${editor.isNew ? '' : 'disabled'} placeholder="Например: Торпедо">
                </label>
                ${editor.isNew ? `<label>Лига
                    <select id="ed-type"><option value="world" ${t.type === 'world' ? 'selected' : ''}>🌟 Мировые</option><option value="russia" ${t.type === 'russia' ? 'selected' : ''}>🇷🇺 Российские</option></select>
                </label>` : ''}
            </div>
        </div>

        <label class="editor-rating">Рейтинг команды: <b id="ed-rating-val">${t.rating}</b>
            <input type="range" id="ed-rating" min="40" max="99" value="${t.rating}">
        </label>

        <div class="editor-colors">
            <div>Основной цвет<div class="swatches">${swatches(0)}</div></div>
            <div>Второй цвет<div class="swatches">${swatches(1)}</div></div>
        </div>

        <div class="editor-squad">
            ${Object.keys(SQUAD_MINIMUM).map(line => `
                <label>${LINE_NAMES[line][0].toUpperCase() + LINE_NAMES[line].slice(1)} <span class="muted">(сильнейшие сверху, мин. ${SQUAD_MINIMUM[line]})</span>
                    <textarea id="ed-${line}" rows="7" spellcheck="false">${escapeHtml((t.squad[line] || []).join('\n'))}</textarea>
                </label>`).join('')}
        </div>
        <div class="muted editor-hint">По одному игроку на строку. Первые в каждой линии выходят в старт: 1 вратарь, 4 защитника, 4 полузащитника, 2 нападающих.</div>

        <div id="ed-check" class="editor-check"></div>

        <div class="editor-actions">
            <button id="btn-ed-save" class="btn-primary btn-glow"><span class="btn-text">💾 Сохранить</span></button>
            ${custom && !custom.isNew ? '<button id="btn-ed-reset" class="btn-secondary">↩️ Вернуть стандартные данные</button>' : ''}
            ${custom && custom.isNew ? '<button id="btn-ed-delete" class="btn-secondary">🗑️ Удалить команду</button>' : ''}
        </div>`;

    const state2 = { colors: [colors[0] || '🔵', colors[1] || '⚪'] };
    const currentEmoji = () => state2.colors.join('');
    const readForm = () => {
        const squad = {};
        Object.keys(SQUAD_MINIMUM).forEach(line => {
            squad[line] = $(`ed-${line}`).value.split('\n').map(s => s.trim()).filter(Boolean);
        });
        return {
            name: editor.isNew ? cleanText($('ed-name').value, 30) : t.name,
            type: editor.isNew ? $('ed-type').value : t.type,
            emoji: currentEmoji(),
            rating: Number($('ed-rating').value),
            squad
        };
    };
    const refresh = () => {
        const d = readForm();
        $('editor-crest').innerHTML = crestHtml({ name: d.name || 'Новая', emoji: d.emoji }, 'lg');
        const check = validateTeamData(d.name, d.squad, d.rating, d.emoji);
        if (editor.isNew) {
            if (!d.name) check.errors.unshift('введите название');
            else if (worldTeams.names.includes(d.name) || russianTeams.names.includes(d.name)) check.errors.unshift('команда с таким названием уже есть');
        }
        $('ed-check').innerHTML = check.errors.map(e => `<div class="err-line">⛔ ${e}</div>`).join('')
            + check.warnings.map(w => `<div class="warn-line">⚠️ ${w}</div>`).join('')
            || '<div class="ok-line">✅ Данные в порядке</div>';
        $('btn-ed-save').disabled = check.errors.length > 0;
        return d;
    };

    form.querySelectorAll('.swatch').forEach(b => b.onclick = () => {
        state2.colors[Number(b.dataset.idx)] = b.dataset.color;
        form.querySelectorAll(`.swatch[data-idx="${b.dataset.idx}"]`).forEach(x => x.classList.toggle('active', x === b));
        refresh();
    });
    $('ed-rating').oninput = e => { setText('ed-rating-val', e.target.value); refresh(); };
    form.querySelectorAll('textarea, #ed-name').forEach(el => el.oninput = refresh);
    refresh();

    $('btn-ed-save').onclick = () => {
        const d = refresh();
        if ($('btn-ed-save').disabled) return;
        if (!saveTeamOverride(d.name, { type: d.type, emoji: d.emoji, rating: d.rating, squad: d.squad })) {
            alert('Не удалось сохранить: хранилище браузера недоступно или переполнено');
            return;
        }
        editor.selected = d.name;
        editor.type = d.type;
        editor.isNew = false;
        renderEditorList();
        renderEditorForm();
        validateSettings();
    };
    $('btn-ed-reset')?.addEventListener('click', () => {
        if (!confirm(`Вернуть стандартные данные для «${t.name}»?`)) return;
        removeTeamOverride(t.name);
        renderEditorList();
        renderEditorForm();
    });
    $('btn-ed-delete')?.addEventListener('click', () => {
        if (!confirm(`Удалить команду «${t.name}»?`)) return;
        removeTeamOverride(t.name);
        editor.selected = null;
        renderEditorList();
        renderEditorForm();
        validateSettings();
    });
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function initEditorScreen() {
    $('btn-open-editor').onclick = openEditor;
    $('btn-editor-back').onclick = () => { validateSettings(); showScreen('setup'); };
    document.querySelectorAll('#editor-type-tabs .style-btn').forEach(b => b.onclick = () => {
        editor.type = b.dataset.type;
        editor.selected = null;
        editor.isNew = false;
        renderEditorList();
        renderEditorForm();
    });
    $('btn-editor-new').onclick = () => {
        editor.selected = null;
        editor.isNew = true;
        renderEditorList();
        renderEditorForm();
    };
    $('btn-editor-export').onclick = () => {
        const count = Object.keys(readCustomData().teams).length;
        if (!count) { alert('Пока нет изменений для экспорта'); return; }
        downloadText('football-sim-teams.json', exportCustomData());
    };
    $('editor-import-file').onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const n = importCustomData(reader.result);
                alert(`Импортировано команд: ${n}`);
                renderEditorList();
                renderEditorForm();
                validateSettings();
            } catch (err) {
                alert('Не удалось импортировать: ' + err.message);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    };
    $('btn-editor-reset-all').onclick = () => {
        if (!confirm('Сбросить все правки и удалить свои команды?')) return;
        resetAllCustomData();
        editor.selected = null;
        editor.isNew = false;
        renderEditorList();
        renderEditorForm();
        validateSettings();
    };
}

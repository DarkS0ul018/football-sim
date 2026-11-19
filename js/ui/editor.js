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

// В каких турнирах сборных играет страна (метки в списке)
function nationCupTags(name) {
    const short = { euro: 'ЧЕ', worldcup: 'ЧМ', copa: 'КА' };
    return Object.entries(NATION_CUPS).filter(([, c]) => c.names.includes(name)).map(([k]) => short[k]);
}

function editorTeamInfo(name) {
    if (typeof NATIONS !== 'undefined' && NATIONS[name]) {
        const n = NATIONS[name];
        return { name, key: originalTeamName(name), type: 'national', emoji: null, rating: teamRatings[name] ?? n.rating, kit: [...n.kit], squad: n.squad,
            code: n.code, flag: JSON.parse(JSON.stringify(n.flag)), cups: Object.keys(NATION_CUPS).filter(k => NATION_CUPS[k].names.includes(name)) };
    }
    const type = russianTeams.names.includes(name) ? 'russia' : 'world';
    const data = type === 'russia' ? russianTeams : worldTeams;
    const i = data.names.indexOf(name);
    const meta = teamMeta[name] || [];
    return {
        name, type, key: originalTeamName(name),
        code: meta[0] || teamShort(name), year: meta[1] || '',
        emoji: data.emojis[i] || '⚪',
        rating: teamRatings[name] ?? 75,
        squad: SQUADS[type][name] || { goalkeepers: [], defenders: [], midfielders: [], forwards: [] }
    };
}

function renderEditorList() {
    document.querySelectorAll('#editor-type-tabs .style-btn').forEach(b => b.classList.toggle('active', b.dataset.type === editor.type));
    const national = editor.type === 'national';
    const data = editor.type === 'russia' ? russianTeams : worldTeams;
    const names = national ? Object.keys(NATIONS).sort((a, b) => (teamRatings[b] ?? 0) - (teamRatings[a] ?? 0)) : data.names;
    const custom = readCustomData().teams;
    $('btn-editor-new').innerHTML = national ? '+ Новая сборная' : '+ Новая команда';
    $('editor-team-list').innerHTML = names.map(name => {
        const t = editorTeamInfo(name);
        const check = validateTeamData(name, t.squad, t.rating, t.emoji);
        const marks = [
            national ? nationCupTags(name).map(x => `<span class="badge" title="Участник турнира">${x}</span>`).join('') : '',
            (() => { const o = custom[t.key]; return o ? (o.isNew ? '<span class="badge" title="Своя команда">новая</span>' : '<span class="badge" title="Изменена в редакторе">✏️</span>') : ''; })(),
            t.key !== name ? `<span class="badge" title="Стандартное название: ${t.key}">↺</span>` : '',
            check.errors.length ? '<span class="badge badge-red" title="Есть ошибки">!</span>' : (check.warnings.length ? '<span class="badge badge-yellow" title="Есть замечания">⚠️</span>' : '')
        ].join('');
        return `<div class="editor-team ${editor.selected === name ? 'selected' : ''}" data-name="${name}">
            ${crestHtml({ name, emoji: t.emoji }, 'md')}
            <span class="editor-team-name">${name}</span>${marks}
            <span class="tp-rating">${t.rating}</span>
        </div>`;
    }).join('');
    // Убранные из игры стандартные команды — внизу списка, их можно вернуть
    const hidden = Object.entries(custom).filter(([key, o]) => o.hidden && (national ? o.type === 'national' : o.type !== 'national' &&
        (editor.type === 'russia') === DEFAULT_DATA.russia.names.includes(key))).map(([key]) => key);
    if (hidden.length) $('editor-team-list').insertAdjacentHTML('beforeend', `<div class="editor-hidden-title">Убраны из игры</div>` +
        hidden.map(key => `<div class="editor-team hidden-team ${editor.selected === key && editor.hiddenKey ? 'selected' : ''}" data-hidden="${escapeHtml(key)}">
            <span class="editor-team-name">${key}</span><span class="badge">убрана</span></div>`).join(''));
    document.querySelectorAll('.editor-team').forEach(el => el.onclick = () => {
        editor.selected = el.dataset.name || el.dataset.hidden;
        editor.hiddenKey = el.dataset.hidden || null;
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
    // Стандартная команда, убранная из игры: вернуть её или сбросить правки
    if (editor.hiddenKey && editor.selected === editor.hiddenKey) {
        const key = editor.hiddenKey;
        form.innerHTML = `<div class="editor-hidden-card">
            <h3>Команда «${escapeHtml(key)}» убрана из игры</h3>
            <p class="muted">Её нет в списках участников и турнирах. Остальные правки сохранены.</p>
            <div class="editor-actions">
                <button id="btn-ed-unhide" class="btn-primary"><span class="btn-text">Вернуть в игру</span></button>
                <button id="btn-ed-reset-hidden" class="btn-secondary">Вернуть стандартные данные</button>
            </div></div>`;
        const back = () => { editor.hiddenKey = null; editor.selected = shownNameOf(key); renderEditorList(); renderEditorForm(); onTeamTypeChange(); };
        $('btn-ed-unhide').onclick = () => { setTeamHidden(key, false); back(); };
        $('btn-ed-reset-hidden').onclick = () => { removeTeamOverride(key); back(); };
        return;
    }
    const emptySquad = () => ({ goalkeepers: [], defenders: [], midfielders: [], forwards: [] });
    const t = editor.isNew
        ? (editor.type === 'national'
            ? { name: '', type: 'national', emoji: null, rating: 75, kit: ['#1e4fd8', '#ffffff'], code: '',
                flag: { t: 'h', c: ['#ffffff', '#1e4fd8', '#d62839'] }, cups: [], squad: emptySquad() }
            : { name: '', type: editor.type, emoji: '🔵⚪', rating: 75, squad: emptySquad() })
        : editorTeamInfo(editor.selected);
    const custom = readCustomData().teams[t.key || t.name];
    const isStandard = !editor.isNew && isDefaultTeam(t.key);
    const national = t.type === 'national';
    const colors = Array.from(t.emoji || '').filter(ch => COLOR_EMOJI.includes(ch));
    const crest = { shape: '', pattern: '', symbol: '', image: null, ...((custom && custom.crest) || {}) };
    const swatches = (idx) => COLOR_EMOJI.map(ch =>
        `<button type="button" class="swatch ${colors[idx] === ch ? 'active' : ''}" data-idx="${idx}" data-color="${ch}" style="background:${EMOJI_COLORS[ch]}" title="${ch}"></button>`).join('');

    form.innerHTML = `
        <div class="editor-head">
            <span id="editor-crest"></span>
            <div class="editor-head-fields">
                <label>Название
                    <input type="text" id="ed-name" maxlength="30" value="${escapeHtml(t.name)}" placeholder="${national ? 'Например: Исландия' : 'Например: Торпедо'}">
                    ${isStandard && t.key !== t.name ? `<small class="muted">стандартное название: ${escapeHtml(t.key)}</small>` : ''}
                </label>
                ${editor.isNew && !national ? `<label>Лига
                    <select id="ed-type"><option value="world" ${t.type === 'world' ? 'selected' : ''}>🌍 Европа</option><option value="russia" ${t.type === 'russia' ? 'selected' : ''}>🇷🇺 РПЛ</option></select>
                </label>` : ''}
                ${national ? '' : `<div class="editor-kit">
                    <label>Код на табло <input type="text" id="ed-code" maxlength="4" class="ed-code" value="${escapeHtml(t.code || '')}" placeholder="АВТО"></label>
                    <label>Год основания <input type="number" id="ed-year" min="1800" max="2100" class="ed-year" value="${t.year || ''}" placeholder="—"></label>
                </div>`}
            </div>
        </div>

        <label class="editor-rating">Рейтинг команды: <b id="ed-rating-val">${t.rating}</b>
            <input type="range" id="ed-rating" min="40" max="99" value="${t.rating}">
        </label>

        ${national ? nationFieldsHtml(t) : `<div class="editor-colors">
            <div>Основной цвет<div class="swatches">${swatches(0)}</div></div>
            <div>Второй цвет<div class="swatches">${swatches(1)}</div></div>
        </div>`}

        <div class="field-label">Эмблема</div>
        <div class="editor-crest-options">
            ${crestSelect('shape', 'Форма', CREST_SHAPES, crest.shape, national ? 'Флаг сборной' : 'Автоматически')}
            ${crestSelect('pattern', 'Узор', CREST_PATTERNS, crest.pattern, national ? 'Флаг сборной' : 'Автоматически')}
            ${crestSelect('symbol', 'Символ', CREST_SYMBOLS, crest.symbol, national ? 'Флаг сборной' : 'Автоматически')}
        </div>
        <div class="editor-crest-upload">
            <label class="btn-secondary">Загрузить свою картинку<input type="file" id="ed-crest-file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden></label>
            <button type="button" class="btn-secondary" id="ed-crest-clear" ${crest.image ? '' : 'style="display:none"'}>Убрать картинку</button>
            <span class="muted">PNG, JPG, WebP или SVG — картинка заменит нарисованную эмблему.</span>
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
            <button id="btn-ed-save" class="btn-primary"><span class="btn-text">Сохранить</span></button>
            ${custom && !custom.isNew ? '<button id="btn-ed-reset" class="btn-secondary">Вернуть стандартные данные</button>' : ''}
            ${custom && custom.isNew ? `<button id="btn-ed-delete" class="btn-secondary">${national ? 'Удалить сборную' : 'Удалить команду'}</button>` : ''}
            ${isStandard ? '<button id="btn-ed-hide" class="btn-secondary" title="Команда пропадёт из списков и турниров; вернуть можно внизу списка">Убрать из игры</button>' : ''}
        </div>`;

    const state2 = { colors: [colors[0] || '🔵', colors[1] || '⚪'] };
    let flagDirty = false; // флаг трогали — сохраняем из полей, иначе оставляем как был
    const currentEmoji = () => state2.colors.join('');
    const readForm = () => {
        const squad = {};
        Object.keys(SQUAD_MINIMUM).forEach(line => {
            squad[line] = $(`ed-${line}`).value.split('\n').map(s => s.trim()).filter(Boolean);
        });
        return {
            name: cleanText($('ed-name').value, 30),
            type: editor.isNew ? (national ? 'national' : $('ed-type').value) : t.type,
            emoji: national ? null : currentEmoji(),
            kit: national ? [$('ed-kit1').value, $('ed-kit2').value] : undefined,
            code: $('ed-code').value.trim().toUpperCase(),
            year: national ? undefined : $('ed-year').value,
            cups: national ? [...form.querySelectorAll('.ed-cup:checked')].map(i => i.value) : undefined,
            flag: national ? (flagDirty ? readFlagFields() : t.flag) : undefined,
            rating: Number($('ed-rating').value),
            squad,
            crest: { ...crest }
        };
    };
    const refresh = () => {
        const d = readForm();
        $('editor-crest').innerHTML = crestPreview({ name: isStandard ? t.name : (d.name || 'Новая'), emoji: d.emoji }, d.crest, national ? { code: d.code || '???', flag: d.flag, kit: d.kit } : null);
        const check = validateTeamData(d.name, d.squad, d.rating, d.emoji);
        // Название: не пустое и не занято другой командой (своё прежнее название — можно)
        const taken = n => n !== t.name && (worldTeams.names.includes(n) || russianTeams.names.includes(n) || (typeof NATIONS !== 'undefined' && NATIONS[n]));
        if (!d.name) check.errors.unshift('введите название');
        else if (taken(d.name)) check.errors.unshift('команда с таким названием уже есть');
        if (!national && d.code && !/^[A-ZА-ЯЁ]{2,4}$/.test(d.code)) check.errors.unshift('код на табло: 2–4 буквы (или оставьте пустым)');
        if (!national && d.year && !(Number(d.year) >= 1800 && Number(d.year) <= 2100)) check.errors.unshift('год основания: от 1800 до 2100');
        if (national) {
            if (!/^[A-ZА-ЯЁ]{2,4}$/.test(d.code || '')) check.errors.unshift('код на табло: 2–4 буквы, например ИСЛ');
            if (!d.cups.length) check.warnings.push('сборная не участвует ни в одном турнире');
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
    form.querySelectorAll('textarea, #ed-name, #ed-kit1, #ed-kit2, #ed-code').forEach(el => el.oninput = refresh);
    form.querySelectorAll('.ed-cup').forEach(el => el.onchange = refresh);
    form.querySelectorAll('#ed-flag-type, #ed-flag-n, .ed-flag-c, #ed-flag-star, #ed-flag-star-c').forEach(el => { el.oninput = el.onchange = () => {
        flagDirty = true;
        const st = form.querySelector('.ed-stripes'); // «Полос» — только для полосатых флагов
        if (st) st.style.display = ['h', 'v'].includes($('ed-flag-type').value) ? '' : 'none';
        refresh();
    }; });
    form.querySelectorAll('.ed-crest-select').forEach(sel => sel.onchange = () => { crest[sel.dataset.key] = sel.value; refresh(); });
    $('ed-crest-file').onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            crest.image = await imageFileToDataUrl(file);
            $('ed-crest-clear').style.display = '';
            refresh();
        } catch (err) {
            notify('Не удалось загрузить картинку: ' + err.message);
        }
        e.target.value = '';
    };
    $('ed-crest-clear').onclick = () => { crest.image = null; $('ed-crest-clear').style.display = 'none'; refresh(); };
    refresh();

    $('btn-ed-save').onclick = () => {
        const d = refresh();
        if ($('btn-ed-save').disabled) return;
        const crestData = Object.fromEntries(Object.entries(d.crest).filter(([, v]) => v));
        const payload = { type: d.type, rating: d.rating, squad: d.squad, crest: Object.keys(crestData).length ? crestData : undefined };
        if (d.type === 'national') Object.assign(payload, { kit: d.kit, code: d.code, flag: d.flag, cups: d.cups });
        else Object.assign(payload, { emoji: d.emoji, code: d.code, year: d.year });
        // Стандартная команда — правки под исходным названием, новое название — rename;
        // своя команда — под новым названием (старая запись убирается)
        let ok;
        if (isStandard) ok = saveTeamOverride(t.key, { ...payload, rename: d.name, hidden: custom && custom.hidden });
        else ok = saveTeamOverride(d.name, payload, editor.isNew ? null : t.name);
        if (!ok) {
            notify('Не удалось сохранить: хранилище браузера недоступно или переполнено');
            return;
        }
        editor.selected = d.name;
        editor.type = d.type;
        editor.isNew = false;
        renderEditorList();
        renderEditorForm();
        validateSettings();
    };
    $('btn-ed-reset')?.addEventListener('click', async () => {
        if (!(await askConfirm(`Вернуть стандартные данные для «${t.name}»?`, { ok: 'Вернуть' }))) return;
        removeTeamOverride(t.key || t.name);
        editor.selected = t.key || t.name; // стандартное название вернулось
        renderEditorList();
        renderEditorForm();
        onTeamTypeChange();
    });
    $('btn-ed-hide')?.addEventListener('click', async () => {
        if (!(await askConfirm(`Убрать «${t.name}» из игры? Команда пропадёт из списков и турниров; вернуть её можно внизу списка.`, { ok: 'Убрать', danger: true }))) return;
        setTeamHidden(t.key, true);
        editor.selected = null;
        renderEditorList();
        renderEditorForm();
        onTeamTypeChange();
    });
    $('btn-ed-delete')?.addEventListener('click', async () => {
        if (!(await askConfirm(`Удалить команду «${t.name}»?`, { ok: 'Удалить', danger: true }))) return;
        removeTeamOverride(t.name);
        editor.selected = null;
        renderEditorList();
        renderEditorForm();
        validateSettings();
    });
}

// Выпадающий список для формы/узора/символа эмблемы ('' — автоматически)
function crestSelect(key, label, options, value, autoLabel = 'Автоматически') {
    return `<label>${label}<select class="ed-crest-select" data-key="${key}">
        <option value="">${autoLabel}</option>
        ${Object.entries(options).map(([k, o]) => `<option value="${k}" ${k === value ? 'selected' : ''}>${o.label}</option>`).join('')}
    </select></label>`;
}

function crestPreview(team, crest, nation = null) {
    if (crest.image) return `<span class="crest crest-lg"><img src="${crest.image}" alt=""></span>`;
    // Сборная без своих настроек эмблемы — флаг из полей формы (видно сразу, ещё до сохранения)
    if (nation && !(crest.shape || crest.pattern || crest.symbol)) return `<span class="crest crest-lg">${nationCrestSvg(team, nation)}</span>`;
    const auto = getCrestConfig({ name: team.name, emoji: team.emoji });
    const config = { shape: crest.shape || auto.shape, pattern: crest.pattern || auto.pattern, symbol: crest.symbol || auto.symbol,
        custom: !!(crest.shape || crest.pattern || crest.symbol) }; // у сборной без настроек — флаг
    return `<span class="crest crest-lg">${crestSvg(team, config)}</span>`;
}

// Картинка из файла → квадрат до 160px в data:URL (чтобы влезть в хранилище браузера)
function imageFileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!/^image\//.test(file.type)) { reject(new Error('это не картинка')); return; }
        if (file.size > 5 * 1024 * 1024) { reject(new Error('файл больше 5 МБ')); return; }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const max = 160;
            const k = Math.min(1, max / Math.max(img.width || max, img.height || max));
            const w = Math.max(1, Math.round((img.width || max) * k)), h = Math.max(1, Math.round((img.height || max) * k));
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            let data = canvas.toDataURL('image/png');
            if (data.length > 150000) data = canvas.toDataURL('image/webp', 0.85);
            if (data.length > 190000) { reject(new Error('картинка слишком большая даже после сжатия')); return; }
            resolve(data);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('браузер не смог прочитать файл')); };
        img.src = url;
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
    $('btn-editor-back').onclick = () => { onTeamTypeChange(); showScreen('setup'); }; // участники сборных могли измениться
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
        if (!count) { notify('Пока нет изменений для экспорта'); return; }
        downloadText('football-sim-teams.json', exportCustomData());
    };
    $('editor-import-file').onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const n = importCustomData(reader.result);
                notify(`Импортировано команд: ${n}`);
                renderEditorList();
                renderEditorForm();
                validateSettings();
            } catch (err) {
                notify('Не удалось импортировать: ' + err.message);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    };
    $('btn-editor-reset-all').onclick = async () => {
        if (!(await askConfirm('Сбросить все правки и удалить свои команды?', { ok: 'Сбросить', danger: true }))) return;
        resetAllCustomData();
        editor.selected = null;
        editor.isNew = false;
        renderEditorList();
        renderEditorForm();
        validateSettings();
    };
}

// ----- Сборная: участие в турнирах, код, форма, флаг -----
const FLAG_TYPE_LABELS = {
    h: 'Горизонтальные полосы', v: 'Вертикальные полосы', cross: 'Прямой крест', nordic: 'Скандинавский крест',
    saltire: 'Косой крест', circle: 'Круг в центре', diamond: 'Ромб с кругом', taeguk: 'Круг из двух половин', plain: 'Однотонный'
};

function nationFieldsHtml(t) {
    const f = t.flag || { t: 'h', c: ['#ffffff', '#1e4fd8', '#d62839'] };
    const c = [...f.c, '#ffffff', '#1e4fd8', '#d62839'].slice(0, 3);
    const stripes = Math.min(3, Math.max(2, f.c.length));
    return `
        <div class="ed-cups">
            <div class="field-label">Участвует в турнирах</div>
            ${Object.entries(NATION_CUPS).map(([k, cup]) => `<label class="ed-cup-label">
                <input type="checkbox" class="ed-cup" value="${k}" ${t.cups.includes(k) ? 'checked' : ''}>
                ${cup.icon} ${cup.title} <span class="muted">(${cup.names.length} сейчас)</span></label>`).join('')}
        </div>
        <div class="editor-colors editor-kit">
            <label>Код на табло <input type="text" id="ed-code" maxlength="4" value="${escapeHtml(t.code || '')}" placeholder="ИСЛ" class="ed-code"></label>
            <label>Форма — основной цвет <input type="color" id="ed-kit1" value="${t.kit[0]}"></label>
            <label>второй цвет <input type="color" id="ed-kit2" value="${t.kit[1]}"></label>
        </div>
        <div class="ed-flag">
            <div class="field-label">Флаг (рисуется на эмблеме)</div>
            <div class="editor-kit">
                <label>Вид <select id="ed-flag-type">${Object.entries(FLAG_TYPE_LABELS).map(([k, l]) => `<option value="${k}" ${k === f.t ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
                <label class="ed-stripes" ${['h', 'v'].includes(f.t) ? '' : 'style="display:none"'}>Полос <select id="ed-flag-n"><option value="2" ${stripes === 2 ? 'selected' : ''}>2</option><option value="3" ${stripes === 3 ? 'selected' : ''}>3</option></select></label>
                ${c.map((col, i) => `<label>Цвет ${i + 1} <input type="color" class="ed-flag-c" value="${col}"></label>`).join('')}
                <label><input type="checkbox" id="ed-flag-star" ${f.star ? 'checked' : ''}> звезда <input type="color" id="ed-flag-star-c" value="${f.star || '#ffffff'}"></label>
            </div>
            ${f.c.length > 3 ? `<div class="muted">У этого флага ${f.c.length} полос; если поменять флаг здесь, он упростится до 2–3 полос.</div>` : ''}
        </div>`;
}

// Флаг из полей формы
function readFlagFields() {
    const type = $('ed-flag-type').value;
    const cols = [...document.querySelectorAll('.ed-flag-c')].map(i => i.value);
    const need = { h: Number($('ed-flag-n').value), v: Number($('ed-flag-n').value), cross: 2, nordic: 3, saltire: 2, circle: 2, diamond: 3, taeguk: 3, plain: 1 }[type] || 2;
    const flag = { t: type, c: cols.slice(0, need) };
    if ($('ed-flag-star').checked) flag.star = $('ed-flag-star-c').value;
    return flag;
}

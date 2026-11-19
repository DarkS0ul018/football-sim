// ===== ЭМБЛЕМЫ КЛУБОВ (SVG) =====
// Оригинальные эмблемы: форма щита + узор в цветах клуба + символ + монограмма + год основания.
// Вид выбирается по названию (всегда одинаковый), его можно переопределить в редакторе
// или загрузить свою картинку (customCrests заполняется в customdata.js).

const CREST_SHAPES = {
    heater: { label: 'Классический щит', path: 'M6 6 H94 V52 C94 82 72 102 50 114 C28 102 6 82 6 52 Z' },
    badge:  { label: 'Скруглённый щит', path: 'M6 22 Q6 6 22 6 H78 Q94 6 94 22 V62 C94 88 74 104 50 114 C26 104 6 88 6 62 Z' },
    french: { label: 'Французский щит', path: 'M6 6 H94 V74 Q94 84 84 90 L50 114 L16 90 Q6 84 6 74 Z' },
    crown:  { label: 'Щит с зубцами', path: 'M6 16 L28 6 L50 16 L72 6 L94 16 V60 C94 88 72 104 50 114 C28 104 6 88 6 60 Z' },
    round:  { label: 'Круг', path: 'M50 8 A52 52 0 1 1 49.99 8 Z' },
    hex:    { label: 'Шестигранник', path: 'M50 4 L95 26 V90 L50 116 L5 90 V26 Z' }
};

const CREST_PATTERNS = {
    solid:    { label: 'Однотонный', svg: () => '' },
    stripes:  { label: 'Вертикальные полосы', svg: s => [12, 36, 60, 84].map(x => `<rect x="${x}" y="0" width="12" height="120" fill="${s}"/>`).join('') },
    hoops:    { label: 'Горизонтальные полосы', svg: s => [28, 56, 84].map(y => `<rect x="0" y="${y}" width="100" height="14" fill="${s}"/>`).join('') },
    halves:   { label: 'Половины', svg: s => `<rect x="50" y="0" width="50" height="120" fill="${s}"/>` },
    quarters: { label: 'Четверти', svg: s => `<rect x="50" y="0" width="50" height="60" fill="${s}"/><rect x="0" y="60" width="50" height="60" fill="${s}"/>` },
    sash:     { label: 'Перевязь', svg: s => `<polygon points="-10,26 26,-10 110,74 74,110" fill="${s}"/>` },
    chevron:  { label: 'Шеврон', svg: s => `<polygon points="0,44 50,78 100,44 100,64 50,98 0,64" fill="${s}"/>` },
    cross:    { label: 'Крест', svg: s => `<rect x="41" y="0" width="18" height="120" fill="${s}"/><rect x="0" y="46" width="100" height="18" fill="${s}"/>` },
    chief:    { label: 'Верхняя полоса', svg: s => `<rect x="0" y="0" width="100" height="34" fill="${s}"/>` },
    pale:     { label: 'Центральная полоса', svg: s => `<rect x="34" y="0" width="32" height="120" fill="${s}"/>` }
};

const CREST_SYMBOLS = {
    none:   { label: 'Без символа', svg: () => '' },
    star:   { label: 'Звезда', svg: c => crestStar(50, 20, 7, c) },
    stars:  { label: 'Три звезды', svg: c => crestStar(36, 22, 5, c) + crestStar(50, 18, 6, c) + crestStar(64, 22, 5, c) },
    crown:  { label: 'Корона', svg: c => `<path d="M38 26 L36 14 L43 20 L50 11 L57 20 L64 14 L62 26 Z" fill="${c}" stroke="#0b1220" stroke-width="1.2" stroke-linejoin="round"/>` },
    ball:   { label: 'Мяч', svg: c => `<circle cx="50" cy="19" r="7" fill="#fff" stroke="#0b1220" stroke-width="1.5"/><polygon points="50,15 53.5,17.5 52.2,21.5 47.8,21.5 46.5,17.5" fill="#0b1220"/>` },
    laurel: { label: 'Лавры', svg: c => `<path d="M30 74 Q22 56 30 40 M70 74 Q78 56 70 40" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>` }
};

function crestStar(cx, cy, r, color) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const rr = i % 2 ? r * 0.45 : r;
        pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="${color}" stroke="#0b1220" stroke-width="0.8"/>`;
}

function hashPick(name, salt, list) {
    return list[Math.floor(hashString(salt + name) * list.length) % list.length];
}

// Вид эмблемы команды: из редактора или по названию
function getCrestConfig(team) {
    const custom = (typeof customCrests !== 'undefined' && customCrests[team.name]) || {};
    return {
        shape: custom.shape || hashPick(team.name, 'shape', Object.keys(CREST_SHAPES)),
        pattern: custom.pattern || hashPick(team.name, 'pattern', Object.keys(CREST_PATTERNS)),
        symbol: custom.symbol || hashPick(team.name, 'symbol', ['none', 'star', 'stars', 'crown', 'ball', 'laurel', 'none']),
        image: custom.image || null,
        custom: !!(custom.shape || custom.pattern || custom.symbol) // эмблема настроена в редакторе
    };
}

let crestCounter = 0;

function crestSvg(team, config = getCrestConfig(team)) {
    if (typeof NATIONS !== 'undefined' && NATIONS[team.name] && !config.custom) return nationCrestSvg(team);
    const c = getTeamColors(team);
    const id = `cr${++crestCounter}`;
    const shape = (CREST_SHAPES[config.shape] || CREST_SHAPES.heater).path;
    const pattern = (CREST_PATTERNS[config.pattern] || CREST_PATTERNS.solid).svg(c.secondary);
    const accent = luminance(c.primary) > 0.6 && luminance(c.secondary) > 0.6 ? '#0b1220' : '#f5c84b';
    const symbol = (CREST_SYMBOLS[config.symbol] || CREST_SYMBOLS.none).svg(accent);
    const code = teamShort(team.name);
    const year = teamFounded(team.name);
    const fontSize = code.length > 3 ? 15 : 19;
    return `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${team.name}">
        <defs>
            <clipPath id="${id}c"><path d="${shape}"/></clipPath>
            <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
            </linearGradient>
        </defs>
        <g clip-path="url(#${id}c)">
            <rect width="100" height="120" fill="${c.primary}"/>
            ${pattern}
            <rect width="100" height="120" fill="url(#${id}g)"/>
        </g>
        <path d="${shape}" fill="none" stroke="#0b1220" stroke-width="5"/>
        <path d="${shape}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1.6" transform="translate(50 60) scale(0.9) translate(-50 -60)"/>
        <g class="crest-symbol">${symbol}</g>
        <circle cx="50" cy="58" r="23" fill="#0b1220" stroke="${c.secondary === '#1c1c1c' ? '#fff' : c.secondary}" stroke-width="3"/>
        <text x="50" y="${58 + fontSize * 0.36}" text-anchor="middle" font-family="Oswald, 'Arial Narrow', sans-serif" font-weight="700" font-size="${fontSize}" fill="#fff" letter-spacing="0.5">${code}</text>
        ${year ? `<text class="crest-year" x="50" y="${config.shape === 'round' ? 97 : 99}" text-anchor="middle" font-family="Oswald, sans-serif" font-weight="600" font-size="10" fill="#fff" stroke="#0b1220" stroke-width="2.5" paint-order="stroke">${year}</text>` : ''}
    </svg>`;
}

// Эмблема для вставки в HTML. size: xs | sm | md | lg | xl
function crestHtml(team, size = 'sm') {
    const config = getCrestConfig(team);
    const inner = config.image
        ? `<img src="${config.image}" alt="${team.name}">`
        : crestSvg(team, config);
    return `<span class="crest crest-${size}" title="${team.name}">${inner}</span>`;
}

// ----- Эмблема сборной: щит с флагом и кодом страны -----
function nationFlagSvg(flag) {
    const c = flag.c;
    const W = 100, H = 120;
    const stripes = (dir) => {
        const w = flag.w || c.map(() => 1);
        const total = w.reduce((a, b) => a + b, 0);
        let pos = 0;
        return c.map((col, i) => {
            const size = (dir === 'h' ? H : W) * w[i] / total;
            const r = dir === 'h' ? `<rect x="0" y="${pos.toFixed(1)}" width="${W}" height="${(size + 0.5).toFixed(1)}" fill="${col}"/>`
                : `<rect x="${pos.toFixed(1)}" y="0" width="${(size + 0.5).toFixed(1)}" height="${H}" fill="${col}"/>`;
            pos += size;
            return r;
        }).join('');
    };
    switch (flag.t) {
        case 'h': return stripes('h');
        case 'v': return stripes('v');
        case 'cross': return `<rect width="${W}" height="${H}" fill="${c[0]}"/><rect x="40" y="0" width="20" height="${H}" fill="${c[1]}"/><rect x="0" y="50" width="${W}" height="20" fill="${c[1]}"/>`;
        case 'nordic': return `<rect width="${W}" height="${H}" fill="${c[0]}"/><rect x="26" y="0" width="20" height="${H}" fill="${c[1]}"/><rect x="0" y="50" width="${W}" height="20" fill="${c[1]}"/>`
            + (c[2] ? `<rect x="31" y="0" width="10" height="${H}" fill="${c[2]}"/><rect x="0" y="55" width="${W}" height="10" fill="${c[2]}"/>` : '');
        case 'saltire': return `<rect width="${W}" height="${H}" fill="${c[0]}"/><path d="M-10 -6 L110 126 M110 -6 L-10 126" stroke="${c[1]}" stroke-width="16"/>`;
        case 'circle': return `<rect width="${W}" height="${H}" fill="${c[0]}"/><circle cx="50" cy="40" r="20" fill="${c[1]}"/>`;
        case 'taeguk': return `<rect width="${W}" height="${H}" fill="${c[0]}"/><path d="M30 40 A20 20 0 0 1 70 40 Z" fill="${c[1]}"/><path d="M30 40 A20 20 0 0 0 70 40 Z" fill="${c[2]}"/><path d="M14 14 l8 10 M78 14 l8 10 M14 66 l8 -10 M78 66 l8 -10" stroke="#111" stroke-width="3"/>`;
        case 'diamond': return `<rect width="${W}" height="${H}" fill="${c[0]}"/><polygon points="50,8 94,60 50,112 6,60" fill="${c[1]}"/><circle cx="50" cy="60" r="20" fill="${c[2]}"/>`;
        default: return `<rect width="${W}" height="${H}" fill="${c[0]}"/>`;
    }
}

function nationCrestSvg(team, n = NATIONS[team.name]) {
    const id = `nc${++crestCounter}`;
    const shape = CREST_SHAPES.badge.path;
    const star = n.flag.star ? crestStar(50, 22, 8, n.flag.star) : '';
    return `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${team.name}">
        <defs>
            <clipPath id="${id}c"><path d="${shape}"/></clipPath>
            <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.25"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/></linearGradient>
        </defs>
        <g clip-path="url(#${id}c)">${nationFlagSvg(n.flag)}${star}<rect width="100" height="120" fill="url(#${id}g)"/></g>
        <path d="${shape}" fill="none" stroke="#0b1220" stroke-width="5"/>
        <path d="${shape}" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="1.6" transform="translate(50 60) scale(0.9) translate(-50 -60)"/>
        <rect x="22" y="72" width="56" height="26" rx="6" fill="#0b1220" stroke="#fff" stroke-opacity="0.7" stroke-width="1.5"/>
        <text x="50" y="91" text-anchor="middle" font-family="Oswald, 'Arial Narrow', sans-serif" font-weight="700" font-size="17" fill="#fff" letter-spacing="1">${n.code}</text>
    </svg>`;
}

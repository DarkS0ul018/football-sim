// ===== ПОДЕЛИТЬСЯ РЕЗУЛЬТАТОМ =====
// Рисует картинку с итогом матча или турнира (эмблемы, счёт, авторы голов) и отдаёт её системному
// «Поделиться» (Telegram, WhatsApp…) или сохраняет файлом, если браузер так не умеет.

const SHARE_W = 1080, SHARE_H = 1080;
const SHARE_SITE = 'darks0ul018.github.io/football-sim';

// Цвета карточки: под тему еврокубка или фирменные
function shareTheme() {
    const id = state.settings && state.settings.ucl ? (state.settings.euroCup || 'ucl') : null;
    return {
        ucl: { bg: ['#0f205e', '#030926'], accent: '#e6ecff', ink: '#061038' },
        uel: { bg: ['#3a1803', '#0d0803'], accent: '#ff8a1f', ink: '#1a0d02' },
        uecl: { bg: ['#0a301f', '#02110b'], accent: '#2ee68a', ink: '#02160c' }
    }[id] || { bg: ['#16243f', '#070d1a'], accent: '#b8f24a', ink: '#0a1405' };
}

function competitionName() {
    const s = state.settings || {};
    if (s.seriesTitle) return s.seriesTitle;
    if (s.title) return s.title.replace(/^[^А-Яа-яA-Za-z]+/, '');
    if (typeof NATION_CUPS !== 'undefined' && NATION_CUPS[s.teamType]) return NATION_CUPS[s.teamType].title;
    return 'Football Sim Pro';
}

// SVG эмблемы → картинка для canvas
function crestImage(team) {
    return new Promise(resolve => {
        const holder = document.createElement('div');
        holder.innerHTML = crestHtml(team, 'xl');
        const img0 = holder.querySelector('img');
        const svg = holder.querySelector('svg');
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        if (img0) img.src = img0.src;
        else if (svg) {
            if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svg.setAttribute('width', '300'); svg.setAttribute('height', '360');
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML);
        } else resolve(null);
    });
}

function shareCanvasBase(theme) {
    const c = document.createElement('canvas');
    c.width = SHARE_W; c.height = SHARE_H;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, SHARE_H);
    grad.addColorStop(0, theme.bg[0]); grad.addColorStop(1, theme.bg[1]);
    g.fillStyle = grad; g.fillRect(0, 0, SHARE_W, SHARE_H);
    // Разметка поля — фоном
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 4;
    g.beginPath(); g.arc(SHARE_W / 2, SHARE_H / 2, 230, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(0, SHARE_H / 2); g.lineTo(SHARE_W, SHARE_H / 2); g.stroke();
    // Звёзды для еврокубков
    if (state.settings && state.settings.ucl) {
        g.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 70; i++) { const x = (i * 157) % SHARE_W, y = (i * 263) % SHARE_H; g.fillRect(x, y, i % 3 ? 2 : 3, i % 3 ? 2 : 3); }
    }
    return { c, g };
}

function fitText(g, text, maxW, size, weight = '700', family = 'Oswald, Arial Narrow, sans-serif') {
    let s = size;
    do { g.font = `${weight} ${s}px ${family}`; s -= 2; } while (g.measureText(text).width > maxW && s > 18);
}

function drawHeader(g, theme, title) {
    g.fillStyle = theme.accent;
    g.fillRect(SHARE_W / 2 - 300, 70, 600, 64);
    g.fillStyle = theme.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, title.toUpperCase(), 560, 38);
    g.fillText(title.toUpperCase(), SHARE_W / 2, 103);
}

function drawFooter(g) {
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.textAlign = 'center';
    g.font = '500 30px Inter, system-ui, sans-serif';
    g.fillText(`Football Sim Pro · ${SHARE_SITE}`, SHARE_W / 2, SHARE_H - 60);
}

// ----- Карточка матча -----
async function shareMatchImage(m) {
    const theme = shareTheme();
    const { c, g } = shareCanvasBase(theme);
    drawHeader(g, theme, competitionName());
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.textAlign = 'center';
    g.font = '500 32px Inter, system-ui, sans-serif';
    g.fillText(m.roundName || '', SHARE_W / 2, 185);

    const [i1, i2] = await Promise.all([crestImage(m.team1), crestImage(m.team2)]);
    if (i1) g.drawImage(i1, 120, 240, 250, 300);
    if (i2) g.drawImage(i2, SHARE_W - 370, 240, 250, 300);
    g.fillStyle = '#ffffff';
    [[m.team1.name, 245], [m.team2.name, SHARE_W - 245]].forEach(([n, x]) => { fitText(g, n.toUpperCase(), 330, 46); g.fillText(n.toUpperCase(), x, 590); });

    const agg = m.aggregateScore;
    g.font = '700 170px Oswald, Arial Narrow, sans-serif';
    g.fillText(`${agg.t1}:${agg.t2}`, SHARE_W / 2, 400);
    g.font = '500 30px Inter, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.75)';
    const notes = [];
    if (m.legs === 2) notes.push(`матчи: ${m.leg1.t1}:${m.leg1.t2}, ${m.leg2.t1}:${m.leg2.t2}`);
    if (m.extraTime) notes.push('д.в.');
    if (m.penalties && m.penalties.kicks && m.penalties.kicks.length) notes.push(`пен. ${m.penalties.t1}:${m.penalties.t2}`);
    if (notes.length) g.fillText(notes.join(' · '), SHARE_W / 2, 505);

    // Авторы голов
    const strip = s => s.replace(/<[^>]+>/g, '');
    const left = scorersOf(m, 1, { short: false }).map(strip), right = scorersOf(m, 2, { short: false }).map(strip);
    g.font = '500 32px Inter, system-ui, sans-serif'; g.fillStyle = '#ffffff';
    g.textAlign = 'left';  left.slice(0, 7).forEach((t, i) => g.fillText('⚽ ' + t, 90, 680 + i * 48));
    g.textAlign = 'right'; right.slice(0, 7).forEach((t, i) => g.fillText(t + ' ⚽', SHARE_W - 90, 680 + i * 48));
    const motm = (m.motms || [])[m.motms.length - 1];
    if (motm) { g.textAlign = 'center'; g.fillStyle = theme.accent; g.font = '600 32px Inter, system-ui, sans-serif'; g.fillText(`⭐ Лучший игрок: ${motm.p} (${motm.r})`, SHARE_W / 2, 1010 - 60); }
    drawFooter(g);
    return c;
}

// ----- Карточка турнира -----
async function shareTournamentImage(champion) {
    const theme = shareTheme();
    const { c, g } = shareCanvasBase(theme);
    drawHeader(g, theme, competitionName());
    const img = await crestImage(champion);
    if (img) g.drawImage(img, SHARE_W / 2 - 170, 200, 340, 408);
    g.textAlign = 'center'; g.fillStyle = theme.accent;
    g.font = '600 40px Inter, system-ui, sans-serif';
    g.fillText(state.settings.stageOnly ? 'ЭТАП ЗАВЕРШЁН' : '🏆 ЧЕМПИОН', SHARE_W / 2, 670);
    g.fillStyle = '#ffffff'; fitText(g, champion.name.toUpperCase(), 900, 110);
    g.fillText(champion.name.toUpperCase(), SHARE_W / 2, 760);
    const lines = [];
    const final = state.tournamentHistory.length ? state.tournamentHistory[state.tournamentHistory.length - 1].matches[0] : null;
    if (final && final.isFinal && final.winner) {
        const a = final.aggregateScore;
        lines.push(`Финал: ${final.team1.name} ${a.t1}:${a.t2} ${final.team2.name}${final.penalties.kicks.length ? ` (пен. ${final.penalties.t1}:${final.penalties.t2})` : ''}`);
    }
    const top = Object.values(playerStats).sort((a, b) => b.goals - a.goals)[0];
    if (top && top.goals) lines.push(`Бомбардир: ${top.name} — ${top.goals}`);
    if (isCareer() && state.userTeam && state.userTeam.id !== champion.id) lines.push(`Моя команда «${state.userTeam.name}»: ${getUserResult().text}`);
    g.font = '500 34px Inter, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.85)';
    lines.slice(0, 3).forEach((t, i) => { fitText(g, t, 960, 34, '500', 'Inter, system-ui, sans-serif'); g.fillText(t, SHARE_W / 2, 850 + i * 52); });
    drawFooter(g);
    return c;
}

// Отдать картинку: системное «Поделиться» или скачивание
async function shareCanvas(canvas, filename, text) {
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (!blob) { notify('Не получилось нарисовать картинку'); return; }
    const file = new File([blob], filename, { type: 'image/png' });
    try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Football Sim Pro', text });
            return;
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return; // пользователь закрыл окно
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    notify('🖼️ Картинка сохранена — отправьте её в Telegram или WhatsApp');
}

async function shareMatch(m) {
    if (!m || !m.isFinished) return;
    const agg = m.aggregateScore;
    await shareCanvas(await shareMatchImage(m), 'football-sim-match.png', `${m.team1.name} ${agg.t1}:${agg.t2} ${m.team2.name} — ${competitionName()}`);
}

async function shareTournament() {
    if (!state.champion) return;
    await shareCanvas(await shareTournamentImage(state.champion), 'football-sim-champion.png', `${competitionName()}: чемпион — ${state.champion.name}`);
}

// ===== ЗВУК: свисток, удары, гул трибун, рёв на гол =====
// Всё синтезируется через Web Audio — никаких аудиофайлов. Включение/выключение запоминается.

const SOUND_KEY = 'footballSimPro.sound';
const sound = {
    ctx: null,
    master: null,
    noise: null,
    crowd: null,          // { src, gain, filter }
    mode: (() => { try { const v = localStorage.getItem(SOUND_KEY); return ['on', 'nocrowd', 'off'].includes(v) ? v : 'on'; } catch (e) { return 'on'; } })(),
    get enabled() { return this.mode !== 'off'; },
    set enabled(v) { /* задаётся через setSoundMode */ }
};

function audio() {
    if (!sound.enabled) return null;
    if (!sound.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        sound.ctx = new Ctx();
        sound.master = sound.ctx.createGain();
        sound.master.gain.value = 0.5;
        sound.master.connect(sound.ctx.destination);
        // Белый шум на 2 секунды — основа для трибун и ударов
        const len = sound.ctx.sampleRate * 2;
        sound.noise = sound.ctx.createBuffer(1, len, sound.ctx.sampleRate);
        const data = sound.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (sound.ctx.state === 'suspended') sound.ctx.resume();
    return sound.ctx;
}

function noiseSource(ctx, loop = false) {
    const src = ctx.createBufferSource();
    src.buffer = sound.noise;
    src.loop = loop;
    return src;
}

function envelope(gain, t, attack, hold, release, peak) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.setValueAtTime(peak, t + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

function whistle(ctx, start, duration) {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 2900;
    lfo.frequency.value = 28;        // трель свистка
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(g).connect(sound.master);
    envelope(g, start, 0.02, duration, 0.05, 0.12);
    osc.start(start); lfo.start(start);
    osc.stop(start + duration + 0.1); lfo.stop(start + duration + 0.1);
}

function playSound(name) {
    const ctx = audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (name) {
        case 'whistle-short': whistle(ctx, t, 0.18); break;
        case 'whistle-long': whistle(ctx, t, 0.7); break;
        case 'whistle-end': whistle(ctx, t, 0.3); whistle(ctx, t + 0.45, 0.3); whistle(ctx, t + 0.9, 0.9); setTimeout(() => applause(3.5), 1500); break;
        case 'kick': {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
            osc.connect(g).connect(sound.master);
            envelope(g, t, 0.003, 0.01, 0.07, 0.25);
            osc.start(t); osc.stop(t + 0.12);
            break;
        }
        case 'save': crowdBurst(ctx, t, 500, 0.5, 0.18); break;   // «у-у-у»
        case 'goal': {
            crowdBurst(ctx, t, 900, 2.2, 0.45);                    // рёв трибун
            crowdBurst(ctx, t + 0.05, 1800, 1.6, 0.18);
            if (sound.mode === 'on') { airHorn(t + 0.4); setTimeout(crowdChant, 2200); }
            break;
        }
        case 'pen-goal': crowdBurst(ctx, t, 900, 1.0, 0.3); break;
        case 'miss': crowdBurst(ctx, t, 400, 0.4, 0.12); break;
    }
}

function crowdBurst(ctx, t, freq, duration, peak) {
    const src = noiseSource(ctx, true);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(sound.master);
    envelope(g, t, 0.15, duration * 0.4, duration * 0.6, peak);
    src.start(t);
    src.stop(t + duration + 0.3);
}

// Фоновый гул трибун на время живого матча: низкий гул стадиона + «волны» голосов + речёвки с хлопками
function startCrowd() {
    const ctx = audio();
    if (!ctx || sound.crowd || sound.mode === 'nocrowd') return;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 1.2);
    gain.connect(sound.master);
    // Низкий гул
    const low = noiseSource(ctx, true);
    const lowF = ctx.createBiquadFilter(); lowF.type = 'lowpass'; lowF.frequency.value = 260;
    const lowG = ctx.createGain(); lowG.gain.value = 1.4;
    low.connect(lowF).connect(lowG).connect(gain);
    // Голоса: полоса 550 Гц, медленно «дышит»
    const src = noiseSource(ctx, true);
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 550; filter.Q.value = 0.6;
    const wave = ctx.createGain(); wave.gain.value = 0.8;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.13; lfoG.gain.value = 0.25;
    lfo.connect(lfoG).connect(wave.gain);
    src.connect(filter).connect(wave).connect(gain);
    low.start(); src.start(); lfo.start();
    sound.crowd = { src, gain, filter, extra: [low, lfo] };
    // Речёвки трибун время от времени
    sound.chantTimer = setInterval(() => {
        const r = Math.random();
        if (r < 0.22) crowdChant(); else if (r < 0.4) crowdSong(); else if (r < 0.55) crowdDrums();
    }, 12000);
}

function stopCrowd() {
    clearInterval(sound.chantTimer);
    if (!sound.crowd || !sound.ctx) return;
    const { src, gain, extra } = sound.crowd;
    const t = sound.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    [src, ...(extra || [])].forEach(n => { try { n.stop(t + 0.7); } catch (e) { /* ignore */ } });
    sound.crowd = null;
}

// Хлопок: короткий щелчок высокочастотного шума
function clap(ctx, t, peak = 0.12) {
    const s = noiseSource(ctx);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 600; f.Q.value = 1.2;
    const g = ctx.createGain();
    s.connect(f).connect(g).connect(sound.master);
    envelope(g, t, 0.003, 0.01, 0.09, peak);
    s.start(t, Math.random()); s.stop(t + 0.15);
}

// «Хлоп-хлоп — хлоп-хлоп-хлоп» и протяжное «о-о-о» трибун
function crowdChant() {
    const ctx = audio();
    if (!ctx || !sound.crowd) return;
    const t = ctx.currentTime + 0.05;
    [0, 0.35, 0.9, 1.25, 1.6].forEach(dt => { for (let k = 0; k < 3; k++) clap(ctx, t + dt + k * 0.015, 0.07); });
    [0, 2.1].forEach(dt => {
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        [196, 247, 294].forEach(fr => {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr * (1 + (Math.random() - 0.5) * 0.01);
            o.connect(f); o.start(t + dt); o.stop(t + dt + 1.3);
        });
        f.connect(g).connect(sound.master);
        envelope(g, t + dt, 0.25, 0.6, 0.4, 0.02);
    });
}

// Аплодисменты: много хлопков вразнобой
function applause(seconds = 3) {
    const ctx = audio();
    if (!ctx || sound.mode === 'nocrowd') return;
    const t = ctx.currentTime;
    for (let i = 0; i < seconds * 45; i++) clap(ctx, t + Math.random() * seconds, 0.05 + Math.random() * 0.05);
}

// Дудка болельщиков после гола
function airHorn(t) {
    const ctx = sound.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    [233, 294, 349].forEach(fr => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr;
        o.connect(f); o.start(t); o.stop(t + 1.1);
    });
    f.connect(g).connect(sound.master);
    envelope(g, t, 0.03, 0.7, 0.3, 0.045);
}


// Режимы звука: всё / без трибун / выключен
const SOUND_MODES = ['on', 'nocrowd', 'off'];
function setSoundMode(mode) {
    sound.mode = mode;
    sound.enabled = mode !== 'off';
    try { localStorage.setItem(SOUND_KEY, mode); } catch (e) { /* ignore */ }
    if (mode !== 'on') stopCrowd();
    else if (typeof simStep !== 'undefined' && simStep) startCrowd(); // включили посреди живого матча
    updateSoundButton();
}

function setSoundEnabled(on) {
    setSoundMode(on ? 'on' : 'off');
}

function updateSoundButton() {
    const btn = $('btn-sound');
    if (!btn) return;
    btn.innerHTML = typeof icon === 'function' ? icon({ on: 'volume', nocrowd: 'volumeLow', off: 'volumeOff' }[sound.mode], 18) : { on: '🔊', nocrowd: '🔉', off: '🔇' }[sound.mode];
    btn.title = { on: 'Звук стадиона включён (нажмите — без трибун)', nocrowd: 'Без трибун: только свисток и удары (нажмите — выключить)', off: 'Звук выключен (нажмите — включить)' }[sound.mode];
}

function initSound() {
    updateSoundButton();
    $('btn-sound').addEventListener('click', () => {
        const next = SOUND_MODES[(SOUND_MODES.indexOf(sound.mode) + 1) % SOUND_MODES.length];
        setSoundMode(next);
        notify({ on: '🔊 Звук стадиона', nocrowd: '🔉 Без трибун', off: '🔇 Звук выключен' }[next]);
    });
}

// ===== Звук трансляции: барабаны, песня трибун, свист-неодобрение, нарастание перед ударом =====
// Барабаны фан-сектора: «бум — бум — бум-бум-бум»
function crowdDrums() {
    const ctx = audio();
    if (!ctx || !sound.crowd) return;
    const t = ctx.currentTime + 0.05;
    const hit = (at, peak) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(110, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.18);
        o.connect(g).connect(sound.master);
        envelope(g, at, 0.004, 0.02, 0.22, peak);
        o.start(at); o.stop(at + 0.3);
    };
    for (let bar = 0; bar < 3; bar++) [0, 0.5, 1.0, 1.25, 1.5].forEach(dt => hit(t + bar * 2 + dt, 0.12));
}

// Песня трибун: сотни голосов тянут простую мелодию (гласная «о» — фильтры-форманты)
function crowdSong() {
    const ctx = audio();
    if (!ctx || !sound.crowd) return;
    const t0 = ctx.currentTime + 0.05;
    const melody = [[0, 0.45], [4, 0.45], [7, 0.9], [4, 0.45], [0, 0.45], [2, 0.9], [-1, 0.45], [2, 0.45], [4, 1.3]];
    const base = 196;
    const out = ctx.createGain(); out.gain.value = 0.02;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 1.4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 900; f2.Q.value = 1.8;
    f1.connect(out); f2.connect(out); out.connect(sound.master);
    let t = t0;
    melody.forEach(([semi, dur]) => {
        const fr = base * Math.pow(2, semi / 12);
        for (let v = 0; v < 5; v++) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sawtooth'; o.frequency.value = fr * (v % 2 ? 2 : 1) * (1 + (Math.random() - 0.5) * 0.018);
            o.connect(g); g.connect(f1); g.connect(f2);
            envelope(g, t + Math.random() * 0.04, 0.06, dur * 0.6, dur * 0.35, 0.5);
            o.start(t); o.stop(t + dur + 0.2);
        }
        t += dur;
    });
}

// Неодобрительный гул и свист: грубый фол, жёлтая, удаление
function crowdBoo(strength = 1) {
    const ctx = audio();
    if (!ctx || !sound.crowd) return;
    const t = ctx.currentTime;
    const src = noiseSource(ctx, true);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(260, t + 1.4);
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(sound.master);
    envelope(g, t, 0.2, 0.7, 0.6, 0.12 * strength);
    src.start(t); src.stop(t + 1.8);
    // свист с трибун
    for (let i = 0; i < 4 * strength; i++) {
        const o = ctx.createOscillator(), og = ctx.createGain(), at = t + Math.random() * 0.8;
        o.frequency.setValueAtTime(1900 + Math.random() * 900, at);
        o.frequency.linearRampToValueAtTime(1500 + Math.random() * 600, at + 0.5);
        o.connect(og).connect(sound.master);
        envelope(og, at, 0.03, 0.25, 0.2, 0.012);
        o.start(at); o.stop(at + 0.6);
    }
}

// «О-о-о-о!» — трибуны поднимаются, пока мяч летит к воротам
function crowdRise(seconds = 1) {
    const ctx = audio();
    if (!ctx || !sound.crowd) return;
    const t = ctx.currentTime, d = Math.max(0.4, Math.min(2.5, seconds));
    const src = noiseSource(ctx, true);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
    f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(1100, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35);
    src.connect(f).connect(g).connect(sound.master);
    src.start(t); src.stop(t + d + 0.4);
}

// Трибуны громче у ворот и в напряжённой концовке; домашний сектор громче, когда атакуют хозяева
function crowdIntensity(sim) {
    if (!sound.crowd) return;
    const nearGoal = Math.abs(pitch.ball.x - 50) / 50;
    let target = 0.04 + nearGoal * nearGoal * 0.09;
    if (sim) {
        const diff = Math.abs(sim.score.t1 - sim.score.t2);
        if (sim.minute >= 75 && diff <= 1) target *= 1.35;
        const homeAttack = sim.homeSide && sim.play && sim.play.side === sim.homeSide;
        if (homeAttack) target *= 1.2;
    }
    sound.crowd.gain.gain.setTargetAtTime(Math.min(0.16, target), sound.ctx.currentTime, 0.3);
}

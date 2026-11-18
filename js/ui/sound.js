// ===== ЗВУК: свисток, удары, гул трибун, рёв на гол =====
// Всё синтезируется через Web Audio — никаких аудиофайлов. Включение/выключение запоминается.

const SOUND_KEY = 'footballSimPro.sound';
const sound = {
    ctx: null,
    master: null,
    noise: null,
    crowd: null,          // { src, gain, filter }
    enabled: (() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { return true; } })()
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
        case 'whistle-end': whistle(ctx, t, 0.3); whistle(ctx, t + 0.45, 0.3); whistle(ctx, t + 0.9, 0.9); break;
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

// Фоновый гул трибун на время живого матча
function startCrowd() {
    const ctx = audio();
    if (!ctx || sound.crowd) return;
    const src = noiseSource(ctx, true);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 550;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 1);
    src.connect(filter).connect(gain).connect(sound.master);
    src.start();
    sound.crowd = { src, gain, filter };
}

function stopCrowd() {
    if (!sound.crowd || !sound.ctx) return;
    const { src, gain } = sound.crowd;
    const t = sound.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.stop(t + 0.7);
    sound.crowd = null;
}

// Трибуны оживляются, когда мяч у ворот
function crowdIntensity(sim) {
    if (!sound.crowd) return;
    const nearGoal = Math.abs(pitch.ball.x - 50) / 50; // 0 в центре, 1 у ворот
    const target = 0.04 + nearGoal * nearGoal * 0.08;
    sound.crowd.gain.gain.setTargetAtTime(target, sound.ctx.currentTime, 0.3);
}

function setSoundEnabled(on) {
    sound.enabled = on;
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
    if (!on) stopCrowd();
    updateSoundButton();
}

function updateSoundButton() {
    const btn = $('btn-sound');
    if (!btn) return;
    btn.innerText = sound.enabled ? '🔊' : '🔇';
    btn.title = sound.enabled ? 'Выключить звук' : 'Включить звук';
}

function initSound() {
    updateSoundButton();
    $('btn-sound').addEventListener('click', () => setSoundEnabled(!sound.enabled));
}

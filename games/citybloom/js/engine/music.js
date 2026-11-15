// music.js — música de fundo gerada por código (Web Audio), sem arquivos.
// Três temas leves com instrumentos sintetizados, reverb e melodia que varia
// a cada compasso (para não cansar). Agendamento antecipado ("lookahead"):
// um timer a cada 25 ms agenda as notas dos próximos ~150 ms no relógio do áudio.

const PREF_KEY = 'citybloom.music.v1';
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Acordes em semitons a partir da tônica do tema.
const CH = {
  I: [0, 4, 7], ii: [2, 5, 9], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16],
  Imaj7: [0, 4, 7, 11], ii7: [2, 5, 9, 12], V7: [7, 11, 14, 17], vi7: [9, 12, 16, 19], IVmaj7: [5, 9, 12, 16],
};
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export const THEMES = [
  { id: 'off',   name: { pt: 'Desligada', en: 'Off' } },
  { id: 'calm',  name: { pt: 'Manhã calma', en: 'Calm morning' }, bpm: 72,  key: 60, swing: 0,
    prog: ['I', 'vi', 'IV', 'V', 'I', 'vi', 'ii', 'V'] },
  { id: 'happy', name: { pt: 'Cidade alegre', en: 'Happy town' }, bpm: 104, key: 65, swing: 0,
    prog: ['I', 'V', 'vi', 'IV', 'I', 'V', 'IV', 'V'] },
  { id: 'lofi',  name: { pt: 'Lo-fi', en: 'Lo-fi' }, bpm: 76, key: 62, swing: 0.16,
    prog: ['ii7', 'V7', 'Imaj7', 'vi7', 'ii7', 'V7', 'IVmaj7', 'Imaj7'] },
];

class Music {
  constructor() {
    this.ctx = null;
    this.timer = null;
    let p = {};
    try { p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (_) {}
    this.theme = THEMES.some(t => t.id === p.theme) ? p.theme : 'calm';
    this.volume = typeof p.volume === 'number' ? p.volume : 0.5;
    this.seed = 12345;
  }

  _save() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ theme: this.theme, volume: this.volume })); } catch (_) {} }
  _rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  _init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC(); } catch (_) { return false; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(c.destination);
    this.dry = c.createGain(); this.dry.gain.value = 1; this.dry.connect(this.master);
    this.reverb = c.createConvolver(); this.reverb.buffer = this._impulse(2.4);
    this.wet = c.createGain(); this.wet.gain.value = 0.28;
    this.reverb.connect(this.wet); this.wet.connect(this.master);
    this.noise = this._noiseBuffer();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else if (this.theme !== 'off') this.ctx.resume();
    });
    return true;
  }

  _impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  _noiseBuffer() {
    const c = this.ctx, buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------------------------------------------------------------- controle
  // Chamar a partir de um gesto do usuário (política de autoplay).
  start() {
    if (this.theme === 'off') return;
    if (!this._init()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.timer) return;
    this.step = 0; this.bar = 0;
    this.next = this.ctx.currentTime + 0.1;
    this._fade(this.volume * 0.5, 1.5);
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.ctx) this._fade(0, 0.4);
  }

  setTheme(id) {
    if (!THEMES.some(t => t.id === id)) return;
    this.theme = id; this._save();
    this.stop();
    if (id !== 'off') setTimeout(() => this.start(), 450);
    else if (this.ctx) setTimeout(() => { if (this.theme === 'off') this.ctx.suspend(); }, 500); // poupa bateria
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v)); this._save();
    if (this.ctx && this.timer) this._fade(this.volume * 0.5, 0.15);
  }

  isPlaying() { return !!this.timer && this.ctx && this.ctx.state === 'running'; }

  _fade(to, sec) {
    const g = this.master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(to, now + sec);
  }

  // ---------------------------------------------------------------- sequenciador
  _schedule() {
    const th = THEMES.find(t => t.id === this.theme);
    if (!th || !th.bpm) return;
    const eighth = 60 / th.bpm / 2;
    while (this.next < this.ctx.currentTime + 0.15) {
      const swing = (this.step % 2 === 1) ? th.swing * eighth : 0;
      this._play(th, this.step, this.next + swing, eighth);
      this.next += eighth;
      this.step++;
      if (this.step % 8 === 0) this.bar++;
    }
  }

  _play(th, step, t, e) {
    const s = step % 8;
    const chord = CH[th.prog[this.bar % th.prog.length]];
    const k = th.key;
    if (th.id === 'calm') {
      if (s === 0) { this._bass(midi(k - 24 + chord[0]), t, e * 6, 0.5); this._piano(chord.map(n => midi(k + n)), t, e * 8, 0.16); }
      if ([2, 3, 5, 7].includes(s) && this._rand() < 0.85) this._piano([midi(k + 12 + chord[(s + this.bar) % chord.length])], t, e * 3, 0.22);
      if (s === 4 && this._rand() < 0.45) this._piano([midi(k + 12 + PENTA[Math.floor(this._rand() * PENTA.length)])], t, e * 4, 0.2);
    } else if (th.id === 'happy') {
      if (s === 0 || s === 4) this._bass(midi(k - 24 + (s === 0 ? chord[0] : chord[2])), t, e * 2, 0.55);
      const pat = [0, 1, 2, 1, 0, 2, 1, 2];
      this._marimba(midi(k + 12 + chord[pat[s] % chord.length]), t, 0.2);
      if ((s === 0 || s === 3 || s === 6) && this._rand() < 0.5) this._marimba(midi(k + 24 + PENTA[Math.floor(this._rand() * 6)]), t, 0.16);
      if (s % 2 === 1) this._hat(t, 0.05);
    } else if (th.id === 'lofi') {
      if (s === 0) { this._ep(chord.map(n => midi(k + n)), t, e * 7, 0.13); this._bass(midi(k - 24 + chord[0]), t, e * 3, 0.5); }
      if (s === 5) this._ep(chord.slice(1).map(n => midi(k + 12 + n)), t, e * 2, 0.07);
      if (s === 0 || s === 5) this._kick(t, 0.5);
      if (s === 2 || s === 6) this._snare(t, 0.16);
      this._hat(t, s % 2 ? 0.035 : 0.05);
      if ((s === 3 || s === 7) && this._rand() < 0.35) this._ep([midi(k + 12 + PENTA[Math.floor(this._rand() * PENTA.length)])], t, e * 2, 0.1);
      if (s === 0) this._vinyl(t, e * 8);
    }
  }

  // ---------------------------------------------------------------- instrumentos
  _voice(t, dur, vel, wetAmt = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.dry);
    const send = this.ctx.createGain(); send.gain.value = wetAmt; g.connect(send); send.connect(this.reverb);
    return g;
  }

  _osc(type, f, t, dur, dest, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  _piano(freqs, t, dur, vel) {
    for (const f of freqs) {
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      lp.connect(this._voice(t, dur, vel / Math.sqrt(freqs.length)));
      this._osc('triangle', f, t, dur, lp);
      this._osc('sine', f * 2, t, dur * 0.5, lp);
    }
  }

  _marimba(f, t, vel) {
    const g = this._voice(t, 0.55, vel, 0.7);
    this._osc('sine', f, t, 0.55, g);
    const g2 = this._voice(t, 0.12, vel * 0.35, 0.3);
    this._osc('sine', f * 4, t, 0.12, g2);
  }

  _ep(freqs, t, dur, vel) {
    for (const f of freqs) {
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
      const trem = this.ctx.createGain(); trem.gain.value = 0.85;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 4.5;
      const depth = this.ctx.createGain(); depth.gain.value = 0.15;
      lfo.connect(depth); depth.connect(trem.gain); lfo.start(t); lfo.stop(t + dur + 0.05);
      trem.connect(lp); lp.connect(this._voice(t, dur, vel / Math.sqrt(freqs.length), 1.2));
      this._osc('sine', f, t, dur, trem, -6);
      this._osc('sine', f, t, dur, trem, 6);
      this._osc('triangle', f * 2, t, dur * 0.3, trem);
    }
  }

  _bass(f, t, dur, vel) {
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    lp.connect(this._voice(t, dur, vel, 0.15));
    this._osc('triangle', f, t, dur, lp);
  }

  _noiseHit(t, dur, vel, type, freq, q = 1) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    src.connect(f); f.connect(this._voice(t, dur, vel, 0.2));
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  _hat(t, vel) { this._noiseHit(t, 0.05, vel, 'highpass', 7000); }
  _snare(t, vel) { this._noiseHit(t, 0.16, vel, 'bandpass', 1800, 0.8); }
  _vinyl(t, dur) { this._noiseHit(t, dur, 0.012, 'bandpass', 3000, 0.4); }
  _kick(t, vel) {
    const o = this.ctx.createOscillator(), g = this._voice(t, 0.25, vel, 0.05);
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.2);
    o.connect(g); o.start(t); o.stop(t + 0.3);
  }
}

export const music = new Music();

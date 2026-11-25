// sampler.js — toca as músicas de js/game/songs.js com instrumentos reais
// gravados (amostras MP3 do soundfont FluidR3_GM, CC BY 3.0, em
// assets/instruments/<instrumento>/<nota>.mp3, uma a cada 3 semitons).
// Cada nota usa a amostra mais próxima com ajuste de afinação (±1 semitom).
// Agendamento antecipado (lookahead) e repetição contínua da música.

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const sampleOf = (n) => Math.round(n / 3) * 3;
const nameOf = (n) => NAMES[n % 12] + (Math.floor(n / 12) - 1);

// Mixagem: volume relativo e posição (−1 esquerda … 1 direita) por instrumento.
const MIX = {
  acoustic_guitar_steel: { g: 0.85, pan: -0.3 },
  acoustic_guitar_nylon: { g: 1.0, pan: -0.2 },
  glockenspiel: { g: 0.6, pan: 0.3 },
  pizzicato_strings: { g: 0.9, pan: 0.2 },
  acoustic_bass: { g: 1.15, pan: 0 },
  flute: { g: 0.85, pan: 0.15 },
  acoustic_grand_piano: { g: 0.9, pan: 0 },
  string_ensemble_1: { g: 0.75, pan: 0 },
  orchestral_harp: { g: 0.8, pan: 0.3 },
  marimba: { g: 0.95, pan: 0.15 },
  whistle: { g: 0.7, pan: 0.1 },
  cello: { g: 0.85, pan: -0.15 },
  french_horn: { g: 0.7, pan: 0.15 },
  recorder: { g: 0.75, pan: 0.2 },
  choir_aahs: { g: 0.55, pan: 0 },
};

// Instrumentos de som contínuo (soltam a nota mais devagar).
const SUSTAIN = new Set(['string_ensemble_1', 'cello', 'choir_aahs', 'french_horn', 'recorder', 'flute', 'whistle']);

export class SongPlayer {
  constructor(baseUrl) {
    this.base = baseUrl.replace(/\/?$/, '/');
    this.ctx = null;
    this.buffers = new Map();   // "inst/midi" → AudioBuffer
    this.loading = new Map();
    this.song = null;
    this.timer = null;
    this.volume = 0.6;
  }

  _init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const c = this.ctx = new AC();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
    this.master = c.createGain(); this.master.gain.value = 0;
    this.comp.connect(this.master); this.master.connect(c.destination);
    this.reverb = c.createConvolver(); this.reverb.buffer = this._impulse(2.2);
    const wet = c.createGain(); wet.gain.value = 0.3;   // um pouco de sala: a música soa ao fundo
    this.reverb.connect(wet); wet.connect(this.comp);
    this.chan = {};
    for (const [inst, m] of Object.entries(MIX)) {
      const g = c.createGain(); g.gain.value = m.g;
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      if (p) { p.pan.value = m.pan; g.connect(p); p.connect(this.comp); p.connect(this.reverb); }
      else { g.connect(this.comp); g.connect(this.reverb); }
      this.chan[inst] = g;
    }
    this.perc = c.createGain(); this.perc.gain.value = 0.9; this.perc.connect(this.comp);
    this.noise = (() => {
      const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else if (this.timer && !this.held) this.ctx.resume();
    });
  }

  _impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  // ---------------------------------------------------------------- amostras
  _load(inst, sm) {
    const key = inst + '/' + sm;
    if (this.buffers.has(key)) return Promise.resolve();
    if (this.loading.has(key)) return this.loading.get(key);
    const p = fetch(this.base + inst + '/' + nameOf(sm) + '.mp3')
      .then(r => { if (!r.ok) throw new Error('amostra ' + key); return r.arrayBuffer(); })
      .then(ab => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
      .then(buf => { this.buffers.set(key, buf); });
    this.loading.set(key, p);
    return p;
  }

  async preload(song, onProgress) {
    this._init();
    const need = new Set();
    for (const e of song.events) if (e.n) need.add(e.inst + '|' + sampleOf(e.n));
    const list = [...need];
    let done = 0;
    await Promise.all(list.map(k => {
      const [inst, sm] = k.split('|');
      return this._load(inst, Number(sm)).then(() => { done++; if (onProgress) onProgress(done / list.length); });
    }));
  }

  // ---------------------------------------------------------------- tocar
  async play(song, onProgress) {
    this._init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.stop(true);
    this.song = song;
    await this.preload(song, onProgress);
    if (this.song !== song) return;          // trocou de música enquanto carregava
    this.spb = 60 / song.bpm;
    this.t0 = this.ctx.currentTime + 0.15;
    this.idx = 0; this.loopN = 0;
    this._fade(this._level(), 3);           // entra devagar
    this.timer = setInterval(() => this._schedule(), 25);
    this._schedule();
  }

  stop(immediate = false) {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.song = null;
    if (this.ctx) this._fade(0, immediate ? 0.05 : 0.5);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.timer) this._fade(this._level(), 0.1);
  }

  // Volume final: escolha do usuário × ganho da música (nivela as faixas) × ganho geral.
  _level() { return this.volume * ((this.song && this.song.gain) || 1) * 1.8; }

  isPlaying() { return !!this.timer; }

  // posição atual (0..1) dentro da música
  progress() {
    if (!this.timer || !this.song) return 0;
    const beats = (this.ctx.currentTime - this.t0) / this.spb;
    return ((beats % this.song.loopBeats) + this.song.loopBeats) % this.song.loopBeats / this.song.loopBeats;
  }

  _fade(to, sec) {
    const g = this.master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(to, now + sec);
  }

  _time(b) {
    const s = this.song;
    const frac = b % 1;
    const swing = s.swing && Math.abs(frac - 0.5) < 1e-6 ? s.swing * 0.5 : 0;
    return this.t0 + (this.loopN * s.loopBeats + b + swing) * this.spb;
  }

  _schedule() {
    const s = this.song;
    if (!s) return;
    const horizon = this.ctx.currentTime + 0.2;
    for (let guard = 0; guard < 500; guard++) {
      const ev = s.events[this.idx];
      const t = this._time(ev.b);
      if (t > horizon) break;
      if (t >= this.ctx.currentTime - 0.05) this._note(ev, t);
      this.idx++;
      if (this.idx >= s.events.length) { this.idx = 0; this.loopN++; }
    }
  }

  _note(ev, t) {
    if (ev.inst === 'shaker' || ev.inst === 'clap' || ev.inst === 'rim') return this._perc(ev.inst, t, ev.v);
    const sm = sampleOf(ev.n);
    const buf = this.buffers.get(ev.inst + '/' + sm);
    const out = this.chan[ev.inst];
    if (!buf || !out) return;
    const rate = Math.pow(2, (ev.n - sm) / 12);
    const dur = Math.max(0.05, ev.d * this.spb);
    const v = Math.max(0.001, ev.v);
    // As amostras têm ~3,1 s e as de som contínuo terminam secas. Notas longas desses
    // instrumentos encadeiam trechos da mesma amostra (pulando o ataque) com crossfade;
    // a nota solta (release) sempre acaba antes do fim do trecho, senão estala.
    const sus = SUSTAIN.has(ev.inst), rel = sus ? 0.45 : 0.22;
    const XF = 0.5, OFF = 0.7, noteEnd = t + dur;
    let at = t, offset = 0, first = true;
    for (let guard = 0; guard < 12; guard++) {
      const availEnd = at + (buf.duration - offset) / rate - 0.03;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.playbackRate.value = rate;
      const g = this.ctx.createGain(), gg = g.gain;
      gg.setValueAtTime(0.0001, at);
      if (first) gg.exponentialRampToValueAtTime(v, at + 0.006);
      else gg.linearRampToValueAtTime(v, at + XF);
      src.connect(g); g.connect(out);
      src.start(at, offset);
      if (!sus || noteEnd + rel <= availEnd) {          // cabe neste trecho: segura e solta
        const end = Math.max(at + (first ? 0.01 : XF), Math.min(noteEnd, availEnd - rel));
        gg.setValueAtTime(v, end);
        gg.exponentialRampToValueAtTime(0.0001, end + rel);
        src.stop(end + rel + 0.03);
        break;
      }
      // não cabe: o próximo trecho entra enquanto este sai
      const next = availEnd - XF;
      gg.setValueAtTime(v, next);
      gg.linearRampToValueAtTime(0.0001, availEnd);
      src.stop(availEnd + 0.01);
      at = next; offset = OFF; first = false;
    }
  }

  _perc(type, t, v) {
    const c = this.ctx;
    const hit = (at, dur, ftype, freq, q, vel) => {
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vel, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f); f.connect(g); g.connect(this.perc);
      src.start(at, Math.random() * 0.8); src.stop(at + dur + 0.02);
    };
    if (type === 'shaker') hit(t, 0.06, 'highpass', 6500, 0.7, v);
    else if (type === 'rim') hit(t, 0.035, 'bandpass', 2600, 3, v);
    else if (type === 'clap') { hit(t, 0.03, 'bandpass', 1300, 1, v); hit(t + 0.012, 0.03, 'bandpass', 1300, 1, v * 0.8); hit(t + 0.024, 0.14, 'bandpass', 1100, 0.8, v); }
  }
}

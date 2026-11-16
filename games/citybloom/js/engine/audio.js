// audio.js — efeitos sonoros leves com Web Audio (tons gerados, sem arquivos).
// Baseado no do Trace Rider. O áudio só liga após o primeiro toque (política
// de autoplay dos navegadores). Mudo salvo em localStorage.

const MUTE_KEY = 'citybloom.muted.v1';

class Sfx {
  constructor() {
    this.ctx = null; this.master = null;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { this.muted = false; }
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch (_) { this.ctx = null; }
  }

  // Silêncio temporário (durante anúncio).
  hold(on) {
    this.held = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend(); else this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch (_) {}
    return this.muted;
  }

  _tone(freq, dur, type = 'sine', gain = 1, delay = 0, slide = 0) {
    if (this.muted || this.held || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  click() { this._tone(520, 0.05, 'triangle', 0.4); }
  coin() { this._tone(988, 0.08, 'square', 0.25); this._tone(1319, 0.16, 'square', 0.22, 0.07); }
  collect() { this._tone(660, 0.09, 'sine', 0.7, 0, 1.5); this._tone(990, 0.12, 'sine', 0.5, 0.06); }
  build() { [196, 262, 330].forEach((f, k) => this._tone(f, 0.12, 'triangle', 0.6, k * 0.07)); }
  levelUp() { [523, 659, 784, 1047, 1319].forEach((f, k) => this._tone(f, 0.22, 'triangle', 0.6, k * 0.08)); }
  error() { this._tone(220, 0.16, 'sawtooth', 0.35, 0, 0.8); }
}

export const sfx = new Sfx();

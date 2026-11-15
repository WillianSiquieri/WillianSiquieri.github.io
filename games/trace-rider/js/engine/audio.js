// audio.js — efeitos sonoros leves com Web Audio API (tons gerados em tempo
// real, sem arquivos). O contexto só é criado após o primeiro gesto do usuário
// (navegadores bloqueiam autoplay). Mudo persiste em localStorage.

const MUTE_KEY = 'traceplay.muted.v1';

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = this._readMuted();
  }

  _readMuted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { return false; }
  }
  _writeMuted(v) {
    try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch (_) {}
  }

  // Deve ser chamado dentro de um gesto (pointerdown) para "destravar" o áudio.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    } catch (_) { this.ctx = null; }
  }

  isMuted() { return this.muted; }
  toggleMute() { this.muted = !this.muted; this._writeMuted(this.muted); return this.muted; }

  // Toca uma nota simples com envelope rápido.
  _tone(freq, dur, type = 'sine', gain = 1, delay = 0) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  click() { this._tone(320, 0.05, 'triangle', 0.5); }
  star() {
    // ping brilhante com uma subida
    this._tone(880, 0.12, 'sine', 0.9);
    this._tone(1320, 0.14, 'sine', 0.6, 0.06);
  }
  win() {
    // arpejo alegre
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.8, i * 0.09));
  }
  lose() {
    this._tone(300, 0.25, 'sawtooth', 0.6);
    this._tone(200, 0.3, 'sawtooth', 0.5, 0.1);
  }
  start() {
    // whoosh curtinho na largada
    this._tone(220, 0.14, 'triangle', 0.5);
    this._tone(440, 0.12, 'triangle', 0.4, 0.05);
  }
}

export const sfx = new Sfx();

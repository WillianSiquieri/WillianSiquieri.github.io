// music.js — música de fundo do CityBloom.
// Toca as músicas compostas para o jogo (js/game/songs.js) com instrumentos
// reais gravados (js/engine/sampler.js). As amostras só são baixadas após o
// primeiro toque do jogador (regra de autoplay) e a música pausa com a aba
// escondida. Preferências (tema e volume) ficam em localStorage.

import { SongPlayer } from './sampler.js';
import { SONGS } from '../game/songs.js';

const PREF_KEY = 'citybloom.music.v2';   // v2: trilha calma nova como padrão (volta ao padrão quem tinha a v1)
// Músicas escolhidas para o jogo; a primeira é a padrão (trilha de fundo discreta).
const ENABLED = ['hearth', 'hills', 'manha', 'bossa'];

export const THEMES = [
  { id: 'off', name: { pt: 'Desligada', en: 'Off' } },
  ...ENABLED.map(id => SONGS.find(s => s.id === id)).map(s => ({ id: s.id, name: s.name })),
];

class Music {
  constructor() {
    this.player = new SongPlayer('assets/instruments/');
    let p = {};
    try { p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (_) {}
    this.theme = p.theme === 'off' ? 'off' : (THEMES.some(t => t.id === p.theme) ? p.theme : ENABLED[0]);
    this.volume = typeof p.volume === 'number' ? p.volume : 0.35;
    this.player.volume = this.volume;
    this.started = false;
  }

  _save() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ theme: this.theme, volume: this.volume })); } catch (_) {} }

  get ctx() { return this.player.ctx; }

  // Chamar a partir de um gesto do usuário.
  start() {
    this.started = true;
    if (this.theme === 'off' || this.player.isPlaying()) return;
    const song = SONGS.find(s => s.id === this.theme);
    if (song) this.player.play(song).catch(() => {});
  }

  stop() { this.player.stop(); }

  setTheme(id) {
    if (!THEMES.some(t => t.id === id)) return;
    this.theme = id; this._save();
    this.player.stop();
    if (id !== 'off') this.start();
    else setTimeout(() => { if (this.theme === 'off' && this.player.ctx) this.player.ctx.suspend(); }, 600);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v)); this._save();
    this.player.setVolume(this.volume);
  }

  // Silêncio temporário (durante anúncio): pausa sem perder o lugar na música.
  hold(on) {
    this.player.held = on;
    const ctx = this.player.ctx;
    if (!ctx) return;
    if (on) ctx.suspend();
    else if (this.theme !== 'off' && !document.hidden) ctx.resume();
  }

  isPlaying() { return this.player.isPlaying() && !!this.player.ctx && this.player.ctx.state === 'running'; }
}

export const music = new Music();

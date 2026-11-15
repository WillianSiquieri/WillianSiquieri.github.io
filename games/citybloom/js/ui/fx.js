// fx.js — efeitos flutuantes no mundo: "+5 🪙", "+2 🪵", "+3 XP" e
// estrelinhas ao construir. Desenhados no canvas com a mesma câmera do mapa.

import { center } from '../engine/iso.js';

export class Fx {
  constructor() { this.items = []; }

  // Textos subindo a partir de um objeto/tile.
  float(i, j, size, lines, t) {
    const c = center(i, j, size);
    lines.forEach((ln, k) => this.items.push({
      kind: 'text', x: c.x, y: c.y - 30 - k * 15, text: ln.text, color: ln.color || '#1f2430', t0: t + k * 0.12, life: 1.4,
    }));
  }

  burst(i, j, size, t) {
    const c = center(i, j, size);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      this.items.push({ kind: 'spark', x: c.x, y: c.y - 10, vx: Math.cos(a) * 40, vy: Math.sin(a) * 22 - 30, t0: t, life: 0.8,
        color: ['#ffd23f', '#34c759', '#2e7dff', '#ff6b8b'][k % 4] });
    }
  }

  render(ctx, t) {
    this.items = this.items.filter(f => t - f.t0 < f.life);
    for (const f of this.items) {
      const p = (t - f.t0) / f.life;
      if (p < 0) continue;
      if (f.kind === 'text') {
        const y = f.y - p * 30;
        ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        ctx.font = '800 13px -apple-system, "Segoe UI", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeText(f.text, f.x, y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
      } else {
        const tt = t - f.t0;
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x + f.vx * tt, f.y + f.vy * tt + 60 * tt * tt, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

// traffic.js — carros andando pelas ruas (vida na cidade).
// Cada rua reta (linha ou coluna inteira de tiles de rua) recebe carros nas duas
// mãos; ao sair do mapa, o carro reaparece do outro lado com outra cor.

import { CAR_COLORS } from './props.js';

export class Traffic {
  constructor(state) { this.reset(state); }

  reset(state) {
    this.size = state.size;
    this.cars = [];
    const n = state.size;
    const isRoad = (i, j) => state.tiles[j * n + i].kind === 'road';
    const rows = [], cols = [];
    for (let j = 0; j < n; j++) { let all = true; for (let i = 0; i < n; i++) if (!isRoad(i, j)) { all = false; break; } if (all) rows.push(j); }
    for (let i = 0; i < n; i++) { let all = true; for (let j = 0; j < n; j++) if (!isRoad(i, j)) { all = false; break; } if (all) cols.push(i); }
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const add = (axis, line, dir) => this.cars.push({
      axis, line, dir, s: rnd() * n, speed: 0.6 + rnd() * 0.5,
      color: CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)],
    });
    for (const j of rows) { add('i', j, 1); add('i', j, -1); if (n > 12) add('i', j, 1); }
    for (const i of cols) { add('j', i, 1); add('j', i, -1); }
  }

  update(dt) {
    const n = this.size;
    for (const c of this.cars) {
      c.s += c.dir * c.speed * dt;
      if (c.s > n + 0.6 || c.s < -0.6) {
        c.s = c.dir > 0 ? -0.5 : n + 0.5;
        c.color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
        c.speed = 0.6 + Math.random() * 0.5;
      }
    }
  }

  // Lista para o desenho: { ci, cj, dir, color, depth }
  items() {
    return this.cars.map(c => {
      const ci = c.axis === 'i' ? c.s : c.line + (c.dir > 0 ? 0.33 : 0.67);
      const cj = c.axis === 'i' ? c.line + (c.dir > 0 ? 0.67 : 0.33) : c.s;
      return {
        ci, cj, color: c.color,
        dir: (c.axis === 'i' ? 'i' : 'j') + (c.dir > 0 ? '+' : '-'),
        depth: Math.floor(ci) + Math.floor(cj) + 0.5,
      };
    });
  }
}

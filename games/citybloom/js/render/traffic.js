// traffic.js — vida nas ruas: veículos e pedestres andando pela rede de ruas.
//
// Cada agente anda de tile em tile pela mão direita; no fim do tile escolhe ao acaso
// a próxima saída (sem voltar, salvo em rua sem saída), faz curva suave, contorna a
// rotatória e entra/sai do mapa pela névoa. Os veículos param atrás do da frente.
// A frota e o visual das pessoas mudam com a fase da cidade (carroça → ônibus).
// Só simula; o desenho fica em render3d/ (3D) e scene.js (2D).

import { CAR_COLORS } from './props.js';
import { isRoadAt, edgeExits } from '../game/roads.js';
import { phaseIndex } from '../game/config.js';
import { population } from '../game/state.js';

// N, E, S, W (bits 1, 2, 4, 8)
const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];
const OUT = 7;                       // até onde os veículos vão dentro da névoa

// Frota por fase: [tipo, peso]. Velocidade em tiles/s.
export const FLEET = [
  [['cart', 4], ['bike', 3], ['tractor', 2]],
  [['cart', 2], ['bike', 3], ['tractor', 1], ['van', 2], ['delivery-flat', 2], ['truck-flat', 1], ['sedan', 2]],
  [['sedan', 4], ['hatchback-sports', 2], ['suv', 3], ['taxi', 2], ['delivery', 2], ['van', 2], ['police', 1], ['garbage-truck', 1], ['bike', 1]],
  [['sedan', 3], ['suv', 3], ['suv-luxury', 2], ['taxi', 3], ['bus', 3], ['delivery', 2], ['truck', 1], ['ambulance', 1], ['firetruck', 1], ['police', 1], ['garbage-truck', 1]],
  [['sedan-sports', 3], ['suv-luxury', 3], ['taxi', 4], ['bus', 2], ['bus-long', 2], ['race', 1], ['sedan', 2], ['delivery', 2], ['ambulance', 1], ['police', 1]],
];
const SPEED = { cart: 0.32, bike: 0.42, tractor: 0.3, bus: 0.55, 'bus-long': 0.5, 'garbage-truck': 0.45, truck: 0.55 };
const LEN = { bus: 0.5, 'bus-long': 0.7, truck: 0.45, 'garbage-truck': 0.45, firetruck: 0.45, cart: 0.4 };
const MAXV = [6, 12, 20, 30, 40], MAXP = [10, 18, 28, 40, 54];

function pick(list, r) {
  const tot = list.reduce((a, x) => a + x[1], 0);
  let x = r * tot;
  for (const [k, w] of list) { x -= w; if (x <= 0) return k; }
  return list[0][0];
}

// Polilinha → posição e direção ao longo dela.
function poly(pts) {
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  return { pts, cum, L: cum[cum.length - 1] || 0.001 };
}
function at(p, d) {
  const { pts, cum } = p;
  let k = 1; while (k < pts.length - 1 && cum[k] < d) k++;
  const a = pts[k - 1], b = pts[k], seg = cum[k] - cum[k - 1] || 1e-6;
  const u = Math.max(0, Math.min(1, (d - cum[k - 1]) / seg));
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, hx: b[0] - a[0], hz: b[1] - a[1] };
}
function cubic(p0, p1, p2, p3, n = 8) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, s = 1 - t;
    out.push([s * s * s * p0[0] + 3 * s * s * t * p1[0] + 3 * s * t * t * p2[0] + t * t * t * p3[0],
              s * s * s * p0[1] + 3 * s * s * t * p1[1] + 3 * s * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}

export class Traffic {
  constructor(state) { this.reset(state); }
  // (center é recalculado em _fill; antes disso, o meio do mapa)

  reset(state) {
    this.state = state;
    this.size = state.size;
    this.cars = []; this.people = [];
    this.seed = 12345;
    this.phase = -1;
    this.exits = edgeExits(state);
    this.clock = 0;
    this.center = this._center();
    this._fill(true);
  }

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  // ---------------------------------------------------------------- consultas da rede
  _road(i, j) { return isRoadAt(this.state, i, j); }
  _tile(i, j) { const n = this.size; return i >= 0 && j >= 0 && i < n && j < n ? this.state.tiles[j * n + i] : null; }
  _ring(i, j) { const t = this._tile(i, j); return t && t.ra && t.ra !== 'corner' ? t.ra : null; }
  _inside(i, j, m = 0) { return i >= -m && j >= -m && i < this.size + m && j < this.size + m; }
  // pedestres ficam nas ruas perto da parte comprada da cidade
  _walkable(i, j) {
    if (!this._road(i, j) || !this._inside(i, j)) return false;
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const t = this._tile(i + a, j + b); if (t && !t.locked) return true; }
    return false;
  }

  _choose(a) {
    const opts = [];
    for (let d = 0; d < 4; d++) {
      if (d === ((a.din + 2) & 3)) continue;
      const ni = a.i + DX[d], nj = a.j + DZ[d];
      if (a.ped ? this._walkable(ni, nj) : (this._road(ni, nj) && this._inside(ni, nj, OUT + 1))) opts.push(d);
    }
    if (!opts.length) return (a.din + 2) & 3;       // rua sem saída: retorno
    // longe da cidade, a maioria volta para o centro (o movimento fica onde o jogador olha)
    const c = this.center, far = Math.hypot(a.i - c.i, a.j - c.j) > c.r + 3;
    if (far && this.rnd() < (a.exiting ? 0.1 : 0.7)) {
      opts.sort((x, y) => Math.hypot(a.i + DX[x] - c.i, a.j + DZ[x] - c.j) - Math.hypot(a.i + DX[y] - c.i, a.j + DZ[y] - c.j));
      return opts[0];
    }
    // seguir reto é mais comum
    if (opts.includes(a.din) && this.rnd() < 0.45) return a.din;
    return opts[Math.floor(this.rnd() * opts.length)];
  }

  // Caminho dentro do tile (entrada pela borda oposta a din, saída pela borda de dout).
  _tilePath(a) {
    const L = a.ped ? 0.41 : 0.19;
    const cx = a.i + 0.5, cz = a.j + 0.5;
    const rx = (d) => -DZ[d], rz = (d) => DX[d];          // lado direito da direção d
    const p0 = [cx - DX[a.din] * 0.5 + rx(a.din) * L, cz - DZ[a.din] * 0.5 + rz(a.din) * L];
    const p3 = [cx + DX[a.dout] * 0.5 + rx(a.dout) * L, cz + DZ[a.dout] * 0.5 + rz(a.dout) * L];
    const u = a.dout === ((a.din + 2) & 3);
    const k = a.din === a.dout ? 0.33 : u ? 0.62 : 0.3;
    const p1 = [p0[0] + DX[a.din] * k, p0[1] + DZ[a.din] * k];
    const p2 = [p3[0] - DX[a.dout] * k, p3[1] - DZ[a.dout] * k];
    return poly(a.din === a.dout ? [p0, p3] : cubic(p0, p1, p2, p3));
  }

  // Rotatória: entra pelo braço, roda no anel (sentido anti-horário) e sai por outro braço.
  _ringPath(a) {
    const t = this._tile(a.i, a.j);
    // centro = vizinho do braço na direção de entrada
    const ci = a.i + DX[a.din] + 0.5, cz = a.j + DZ[a.din] + 0.5;
    const R = 1.02;
    const th = (d) => Math.atan2(DZ[d], DX[d]);
    const from = (a.din + 2) & 3;                    // braço por onde entrou (visto do centro)
    const exits = [0, 1, 2, 3].filter(d => d !== from && this._road(Math.floor(ci) + DX[d] * 2, Math.floor(cz) + DZ[d] * 2) && this._inside(Math.floor(ci) + DX[d] * 2, Math.floor(cz) + DZ[d] * 2, OUT + 1));
    const out = exits.length ? exits[Math.floor(this.rnd() * exits.length)] : from;
    let a0 = th(from) - 0.32, a1 = th(out) + 0.32;
    while (a1 >= a0) a1 -= Math.PI * 2;                // anel no sentido de θ decrescente
    const rx = (d) => -DZ[d], rz = (d) => DX[d];
    const L = 0.19;
    const pts = [[a.i + 0.5 - DX[a.din] * 0.5 + rx(a.din) * L, a.j + 0.5 - DZ[a.din] * 0.5 + rz(a.din) * L]];
    for (let q = a0; q > a1; q -= 0.22) pts.push([ci + Math.cos(q) * R, cz + Math.sin(q) * R]);
    pts.push([ci + Math.cos(a1) * R, cz + Math.sin(a1) * R]);
    const ei = Math.floor(ci) + DX[out] * 2, ej = Math.floor(cz) + DZ[out] * 2;   // tile depois do braço de saída
    pts.push([ei + 0.5 - DX[out] * 0.5 + rx(out) * L, ej + 0.5 - DZ[out] * 0.5 + rz(out) * L]);
    a.after = { i: ei, j: ej, din: out };
    void t;
    return poly(pts);
  }

  _enter(a) {
    if (!a.ped && this._ring(a.i, a.j) === 'arm' && !this._ring(a.i - DX[a.din], a.j - DZ[a.din])) { a.path = this._ringPath(a); a.d = 0; return; }
    a.dout = this._choose(a);
    a.path = this._tilePath(a); a.d = 0;
  }

  _next(a) {
    if (a.after) { const f = a.after; a.after = null; a.i = f.i; a.j = f.j; a.din = f.din; }
    else { a.i += DX[a.dout]; a.j += DZ[a.dout]; a.din = a.dout; }
    if (!a.ped && !this._inside(a.i, a.j, OUT)) { a.dead = true; return; }
    if (a.ped && !this._walkable(a.i, a.j)) { a.i -= DX[a.din]; a.j -= DZ[a.din]; a.din = (a.din + 2) & 3; }
    this._enter(a);
  }

  // ---------------------------------------------------------------- nascer e repor
  _spawn(ped, scatter) {
    const n = this.size;
    let i, j, din;
    if (!ped && !scatter && this.exits.length && this.rnd() < 0.7) {
      const [ei, ej, dx, dz] = this.exits[Math.floor(this.rnd() * this.exits.length)];
      i = ei + dx * OUT; j = ej + dz * OUT; din = dx > 0 ? 3 : dx < 0 ? 1 : dz > 0 ? 0 : 2;
    } else {
      let tries = 0;
      const c = this.center || { i: n / 2, j: n / 2, r: n / 2 }, R = c.r + 6;
      do { i = Math.floor(c.i + (this.rnd() * 2 - 1) * R); j = Math.floor(c.j + (this.rnd() * 2 - 1) * R); tries++; }
      while (tries < 400 && !(this._inside(i, j) && (ped ? this._walkable(i, j) : this._road(i, j) && !this._ring(i, j))));
      if (tries >= 400) return null;
      const ds = [0, 1, 2, 3].filter(d => this._road(i - DX[d], j - DZ[d]));
      din = ds.length ? ds[Math.floor(this.rnd() * ds.length)] : 1;
    }
    const ph = Math.max(0, this.phase);
    const a = { i, j, din, ped, d: 0, dead: false, stop: 0, age: 0, life: 40 + this.rnd() * 80, born: this.clock, exiting: !ped && this.rnd() < 0.25 };
    if (ped) {
      a.speed = 0.16 + this.rnd() * 0.08; a.look = this.rnd(); a.style = ph;
      if (ph >= 3 && this.rnd() < 0.15) { a.speed *= 2.2; a.runner = true; }   // corredores
    } else {
      a.kind = pick(FLEET[ph], this.rnd());
      a.speed = (SPEED[a.kind] || 0.75) * (0.85 + this.rnd() * 0.3);
      a.len = LEN[a.kind] || 0.36;
      a.color = CAR_COLORS[Math.floor(this.rnd() * CAR_COLORS.length)];
    }
    this._enter(a);
    if (scatter) a.d = this.rnd() * a.path.L;
    return a;
  }

  // centro e raio da parte comprada da cidade
  _center() {
    const n = this.size; let si = 0, sj = 0, k = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (!this.state.tiles[j * n + i].locked) { si += i; sj += j; k++; }
    if (!k) return { i: n / 2, j: n / 2, r: 4 };
    const ci = si / k, cj = sj / k;
    return { i: ci, j: cj, r: Math.max(3, Math.sqrt(k) * 0.6) };
  }

  _fill(scatter) {
    const s = this.state;
    this.center = this._center();
    const ph = s.showcase ? 3 : phaseIndex(s.level || 1);
    if (ph !== this.phase) {                    // fase nova: frota e pessoas da fase
      this.phase = ph;
      for (const c of this.cars) { c.kind = pick(FLEET[ph], this.rnd()); c.speed = (SPEED[c.kind] || 0.75) * (0.85 + this.rnd() * 0.3); c.len = LEN[c.kind] || 0.36; }
      for (const p of this.people) p.style = ph;
    }
    const pop = s.showcase ? 999 : population(s) + (this.popBoost || 0);   // popBoost: vídeos e testes
    const nv = Math.min(MAXV[ph], 3 + Math.floor(pop / 8));
    const np = Math.min(MAXP[ph], 3 + Math.floor(pop / 5));
    while (this.cars.length < nv) { const a = this._spawn(false, scatter || this.cars.length < nv / 2); if (!a) break; this.cars.push(a); }
    while (this.people.length < np) { const a = this._spawn(true, true); if (!a) break; this.people.push(a); }
    if (this.cars.length > nv) this.cars.length = nv;
    if (this.people.length > np) this.people.length = np;
  }

  // ---------------------------------------------------------------- passo
  update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    // fila: para atrás do veículo da frente
    const P = this.cars.map(c => at(c.path, c.d));
    this.cars.forEach((c, k) => {
      const p = P[k], hl = Math.hypot(p.hx, p.hz) || 1, hx = p.hx / hl, hz = p.hz / hl;
      let block = false;
      for (let q = 0; q < this.cars.length && !block; q++) {
        if (q === k) continue;
        const o = P[q], rx = o.x - p.x, rz = o.z - p.z;
        const ahead = rx * hx + rz * hz, side = Math.abs(rx * hz - rz * hx);
        if (ahead > 0.05 && ahead < (c.len + this.cars[q].len) * 0.6 + 0.08 && side < 0.16) block = true;
      }
      c.stop = block ? c.stop + dt : 0;
      const go = !block || c.stop > 3;           // não trava para sempre
      c.v = (c.v || 0) + ((go ? c.speed : 0) - (c.v || 0)) * Math.min(1, dt * 4);
      c.d += c.v * dt;
      while (c.d >= c.path.L && !c.dead) { c.d -= c.path.L; this._next(c); }
    });
    for (const a of this.people) {
      a.age += dt;
      a.d += a.speed * dt;
      while (a.d >= a.path.L && !a.dead) { a.d -= a.path.L; this._next(a); }
      if (a.age > a.life) a.dead = true;
    }
    this.cars = this.cars.filter(c => !c.dead);
    this.people = this.people.filter(c => !c.dead);
    if ((this._t = (this._t || 0) + dt) > 0.5) { this._t = 0; this.exits = edgeExits(this.state); this._fill(false); }
  }

  // Veículos: { x, z (unidades de tile), yaw, kind, color, ci, cj, dir, depth }
  items() {
    return this.cars.map(c => {
      const p = at(c.path, c.d);
      const yaw = Math.atan2(p.hx, p.hz);
      const dir = Math.abs(p.hx) > Math.abs(p.hz) ? (p.hx > 0 ? 'i+' : 'i-') : (p.hz > 0 ? 'j+' : 'j-');
      return { x: p.x, z: p.z, yaw, kind: c.kind, color: c.color, ci: p.x, cj: p.z, dir, depth: Math.floor(p.x) + Math.floor(p.z) + 0.5 };
    });
  }

  // Pedestres: { x, z, yaw, walk (fase do passo), style, look, scale }
  peopleItems() {
    return this.people.map(a => {
      const p = at(a.path, a.d);
      const fade = Math.min(1, a.age / 0.6, (a.life - a.age) / 0.6);
      return { x: p.x, z: p.z, yaw: Math.atan2(p.hx, p.hz), walk: (this.clock - a.born) * a.speed * 26, style: a.style, look: a.look, runner: !!a.runner, scale: Math.max(0.01, fade) };
    });
  }
}

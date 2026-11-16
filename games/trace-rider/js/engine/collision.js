// collision.js — grade espacial (spatial hash) para busca rápida de segmentos
// próximos, e resolução de colisão ponto↔segmento usada pela física de Verlet.

import { closestPointOnSegment } from './vec.js';

// Tamanho de célula da grade (em unidades de mundo). Segmentos são registrados
// em todas as células que o seu "bounding box" toca.
const CELL = 80;

function cellKey(cx, cy) { return cx + ',' + cy; }

export class SpatialGrid {
  constructor(cell = CELL) {
    this.cell = cell;
    this.map = new Map(); // key -> array de segmentos
  }

  clear() { this.map.clear(); }

  _cellsForSegment(seg) {
    const c = this.cell;
    const minX = Math.min(seg.a.x, seg.b.x), maxX = Math.max(seg.a.x, seg.b.x);
    const minY = Math.min(seg.a.y, seg.b.y), maxY = Math.max(seg.a.y, seg.b.y);
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const y0 = Math.floor(minY / c), y1 = Math.floor(maxY / c);
    const keys = [];
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++)
        keys.push(cellKey(cx, cy));
    return keys;
  }

  insert(seg) {
    for (const k of this._cellsForSegment(seg)) {
      let arr = this.map.get(k);
      if (!arr) { arr = []; this.map.set(k, arr); }
      arr.push(seg);
    }
  }

  // Reconstrói a grade a partir de uma lista de segmentos.
  rebuild(segments) {
    this.clear();
    for (const s of segments) this.insert(s);
  }

  // Retorna segmentos candidatos num raio ao redor do ponto p.
  query(p, radius) {
    return this.queryBox(p.x - radius, p.y - radius, p.x + radius, p.y + radius);
  }

  // Retorna segmentos candidatos que tocam a caixa [minX,maxX]×[minY,maxY].
  queryBox(minX, minY, maxX, maxY) {
    const c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const y0 = Math.floor(minY / c), y1 = Math.floor(maxY / c);
    const seen = new Set();
    const out = [];
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const arr = this.map.get(cellKey(cx, cy));
        if (!arr) continue;
        for (const s of arr) {
          if (seen.has(s.id)) continue;
          seen.add(s.id);
          out.push(s);
        }
      }
    }
    return out;
  }
}

// Colisão contínua: se o movimento do ponto neste passo (de px,py até x,y)
// cruzou algum segmento, o ponto volta para o ponto de contato, do lado de onde
// veio (a `radius` da linha).
// Sem isso, em quedas rápidas o ponto anda mais que o raio por passo e
// "atravessa" a pista como se ela fosse invisível.
export function sweepPointSegments(point, segments, radius) {
  const mx = point.x - point.px, my = point.y - point.py;
  if (mx * mx + my * my < 1e-8) return false;
  let best = null, bestT = Infinity;
  for (const s of segments) {
    const ex = s.b.x - s.a.x, ey = s.b.y - s.a.y;
    const denom = mx * ey - my * ex;
    if (Math.abs(denom) < 1e-9) continue;            // paralelo
    const qx = s.a.x - point.px, qy = s.a.y - point.py;
    const t = (qx * ey - qy * ex) / denom;            // fração do movimento
    const u = (qx * my - qy * mx) / denom;            // fração do segmento
    if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    if (t < bestT) { bestT = t; best = s; }
  }
  if (!best) return false;
  const ex = best.b.x - best.a.x, ey = best.b.y - best.a.y;
  const el = Math.hypot(ex, ey) || 1;
  let nx = -ey / el, ny = ex / el;
  // normal apontando para o lado de onde o ponto veio
  if ((point.px - best.a.x) * nx + (point.py - best.a.y) * ny < 0) { nx = -nx; ny = -ny; }
  // Corrige só a posição (como o resto da física de Verlet): a velocidade
  // implícita (pos − anterior) diminui na direção da pista sozinha, sem
  // "frear" o carrinho de uma vez em curvas fechadas.
  const hx = point.px + mx * bestT, hy = point.py + my * bestT;
  point.x = hx + nx * radius;
  point.y = hy + ny * radius;
  return true;
}

// Resolve a colisão de um ponto de Verlet (com posição atual e anterior) contra
// os segmentos candidatos. Empurra o ponto para fora da linha pelo raio dado e
// aplica atrito tangencial. A velocidade é implícita (pos - prevPos), então
// mexer só em pos já "reflete" o movimento — comportamento clássico de Verlet.
export function resolvePointSegments(point, segments, radius, friction) {
  for (const s of segments) {
    const cp = closestPointOnSegment(point, s.a, s.b);
    let nx = point.x - cp.x;
    let ny = point.y - cp.y;
    let d = Math.hypot(nx, ny);
    if (d >= radius) continue;

    if (d < 1e-6) {
      // Ponto praticamente em cima da linha: usa a normal do segmento.
      const sx = s.b.x - s.a.x, sy = s.b.y - s.a.y;
      const sl = Math.hypot(sx, sy) || 1;
      nx = -sy / sl; ny = sx / sl; d = 0.0001;
    } else {
      nx /= d; ny /= d;
    }

    const penetration = radius - d;
    // Empurra para fora ao longo da normal.
    point.x += nx * penetration;
    point.y += ny * penetration;

    // Atrito: componente da "velocidade" (pos-prev) ao longo da tangente é reduzida.
    const vx = point.x - point.px;
    const vy = point.y - point.py;
    const tdot = vx * (-ny) + vy * (nx); // velocidade tangencial (tangente = perp da normal)
    const tx = -ny, ty = nx;
    // Reduz a parte tangencial pelo atrito mantendo a normal.
    point.px += tx * tdot * friction;
    point.py += ty * tdot * friction;
  }
}

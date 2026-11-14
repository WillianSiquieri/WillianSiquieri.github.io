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
    const c = this.cell;
    const x0 = Math.floor((p.x - radius) / c), x1 = Math.floor((p.x + radius) / c);
    const y0 = Math.floor((p.y - radius) / c), y1 = Math.floor((p.y + radius) / c);
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

// track.js — modelo da pista: coleção de segmentos de linha + grade espacial.
// Um segmento = { id, a:{x,y}, b:{x,y} }. A grade é reconstruída quando muda.

import { SpatialGrid } from '../engine/collision.js';
import { dist } from '../engine/vec.js';

let nextId = 1;

export class Track {
  constructor() {
    this.segments = [];
    this.grid = new SpatialGrid();
    this._dirty = false;
  }

  clear() {
    this.segments.length = 0;
    this.grid.clear();
    this._dirty = false;
  }

  // Remove apenas os segmentos desenhados pelo jogador (mantém os fixos da fase).
  clearUnlocked() {
    const removed = this.segments.filter(s => !s.locked);
    this.segments = this.segments.filter(s => s.locked);
    this.grid.rebuild(this.segments);
    return removed;
  }

  // Segmentos desenhados pelo jogador (para salvar no Sandbox).
  userSegments() { return this.segments.filter(s => !s.locked); }

  addSegment(ax, ay, bx, by, locked = false) {
    const seg = { id: nextId++, a: { x: ax, y: ay }, b: { x: bx, y: by }, locked };
    this.segments.push(seg);
    this.grid.insert(seg);
    return seg;
  }

  // Remove segmentos cujo ponto mais próximo de (x,y) esteja dentro de `radius`.
  // Segmentos fixos (locked) das fases nunca são apagados.
  // Retorna os segmentos removidos (para o histórico de desfazer).
  eraseAt(x, y, radius) {
    const removed = [];
    const kept = [];
    for (const s of this.segments) {
      if (!s.locked && segNearPoint(s, x, y, radius)) removed.push(s);
      else kept.push(s);
    }
    if (removed.length) {
      this.segments = kept;
      this.grid.rebuild(this.segments);
    }
    return removed;
  }

  removeSegments(segs) {
    if (!segs || !segs.length) return;
    const ids = new Set(segs.map(s => s.id));
    this.segments = this.segments.filter(s => !ids.has(s.id));
    this.grid.rebuild(this.segments);
  }

  addSegments(segs) {
    for (const s of segs) {
      this.segments.push(s);
      this.grid.insert(s);
    }
  }

  toJSON() {
    return this.segments.map(s => [
      Math.round(s.a.x), Math.round(s.a.y),
      Math.round(s.b.x), Math.round(s.b.y),
    ]);
  }

  loadJSON(arr) {
    this.clear();
    for (const [ax, ay, bx, by] of arr) this.addSegment(ax, ay, bx, by);
  }
}

function segNearPoint(s, x, y, r) {
  // Distância ponto-segmento simplificada.
  const abx = s.b.x - s.a.x, aby = s.b.y - s.a.y;
  const apx = x - s.a.x, apy = y - s.a.y;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 < 1e-9 ? 0 : (apx * abx + apy * aby) / ab2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const cx = s.a.x + abx * t, cy = s.a.y + aby * t;
  return Math.hypot(x - cx, y - cy) <= r;
}

// Simplificação de um traço de pontos em segmentos: descarta pontos muito
// próximos para não gerar milhares de micro-segmentos ao desenhar.
export function simplifyStroke(points, minDist) {
  if (points.length < 2) return [];
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (dist(points[i], out[out.length - 1]) >= minDist) out.push(points[i]);
  }
  // garante que o último ponto entre
  const last = points[points.length - 1];
  if (dist(last, out[out.length - 1]) > 0.01) out.push(last);
  return out;
}

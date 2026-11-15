// vec.js — utilitários simples de vetor 2D (objetos {x, y}).
// Mantido sem classe para facilitar uso no Verlet (mutação in-place quando útil).

export function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
export function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
export function scale(a, s) { return { x: a.x * s, y: a.y * s }; }
export function dot(a, b) { return a.x * b.x + a.y * b.y; }
export function len(a) { return Math.hypot(a.x, a.y); }
export function len2(a) { return a.x * a.x + a.y * a.y; }

export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function normalize(a) {
  const l = Math.hypot(a.x, a.y);
  if (l < 1e-9) return { x: 0, y: 0 };
  return { x: a.x / l, y: a.y / l };
}

// Ponto mais próximo no segmento AB em relação a P, mais o parâmetro t em [0,1].
export function closestPointOnSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 < 1e-12 ? 0 : (apx * abx + apy * aby) / ab2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return { x: a.x + abx * t, y: a.y + aby * t, t };
}

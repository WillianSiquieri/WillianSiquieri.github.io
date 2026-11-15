// iso.js — matemática da projeção isométrica (o desenho fica em js/render/).
// Grade (i, j): i cresce para baixo-direita, j para baixo-esquerda na tela.

export const TW = 64;   // largura do losango do tile (px de mundo)
export const TH = 32;   // altura do losango do tile

// Vértice da grade (gi, gj) → ponto no plano isométrico.
export function pt(gi, gj) {
  return { x: (gi - gj) * (TW / 2), y: (gi + gj) * (TH / 2) };
}

// Ponto do mundo → tile (i, j) que o contém.
export function tileAt(wx, wy) {
  const a = wy / (TH / 2), b = wx / (TW / 2);
  return { i: Math.floor((a + b) / 2), j: Math.floor((a - b) / 2) };
}

// Centro do bloco size×size que começa em (i, j).
export function center(i, j, size = 1) {
  return pt(i + size / 2, j + size / 2);
}

export function pointInPoly(p, pts) {
  let inside = false;
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
    const xi = pts[a].x, yi = pts[a].y, xj = pts[b].x, yj = pts[b].y;
    if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

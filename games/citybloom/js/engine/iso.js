// iso.js — projeção isométrica e desenho dos elementos do mapa, 100% por código
// (sem imagens). Coordenadas de "mundo" = plano isométrico em pixels antes da
// câmera. Grade: (i, j) com i crescendo para baixo-direita e j para baixo-esquerda.

export const TW = 64;   // largura do losango do tile
export const TH = 32;   // altura do losango do tile

// Vértice da grade (canto) (gi, gj) -> ponto no plano isométrico.
export function pt(gi, gj) {
  return { x: (gi - gj) * (TW / 2), y: (gi + gj) * (TH / 2) };
}

// Ponto do mundo -> tile (i, j) que o contém.
export function tileAt(wx, wy) {
  const a = wy / (TH / 2), b = wx / (TW / 2);
  return { i: Math.floor((a + b) / 2), j: Math.floor((a - b) / 2) };
}

// Centro do tile (ou do bloco size×size começando em i,j).
export function center(i, j, size = 1) {
  return pt(i + size / 2, j + size / 2);
}

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function poly(ctx, pts, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

const up = (p, h) => ({ x: p.x, y: p.y - h });
const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

// ---------------------------------------------------------------------------
// Chão
// ---------------------------------------------------------------------------
const GRASS_A = '#8fd16a', GRASS_B = '#86c862';

export function drawTile(ctx, i, j, kind, locked = false) {
  const d = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)];
  if (kind === 'road') {
    poly(ctx, d, '#9aa1a9');
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    const a = lerp(d[0], d[3], 0.5), b = lerp(d[1], d[2], 0.5);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
  } else {
    poly(ctx, d, (i + j) % 2 === 0 ? GRASS_A : GRASS_B);
    ctx.lineWidth = 1;
    poly(ctx, d, null, 'rgba(0,0,0,0.06)');
  }
  if (locked) poly(ctx, d, 'rgba(25, 45, 30, 0.38)'); // lote à venda (escurecido)
}

export function drawSelection(ctx, i, j, size = 1, color = '#ffffff') {
  const d = [pt(i, j), pt(i + size, j), pt(i + size, j + size), pt(i, j + size)];
  ctx.lineWidth = 2.5;
  poly(ctx, d, 'rgba(255,255,255,0.18)', color);
}

// ---------------------------------------------------------------------------
// Caixa isométrica genérica (paredes + topo) sobre um retângulo da grade.
// ---------------------------------------------------------------------------
function boxCorners(i0, j0, i1, j1) {
  // T = fundo (topo do losango), R = direita, B = frente, L = esquerda
  return { T: pt(i0, j0), R: pt(i1, j0), B: pt(i1, j1), L: pt(i0, j1) };
}

function drawBox(ctx, c, h, wallColor, topColor) {
  const { T, R, B, L } = c;
  poly(ctx, [L, B, up(B, h), up(L, h)], shade(wallColor, 0.86));   // face esquerda
  poly(ctx, [B, R, up(R, h), up(B, h)], shade(wallColor, 0.7));    // face direita
  poly(ctx, [up(T, h), up(R, h), up(B, h), up(L, h)], topColor);   // topo
}

// Ponto numa face: base de P0→P1, u ∈ [0,1] ao longo, v ∈ [0,1] na altura h.
function facePt(P0, P1, h, u, v) {
  const p = lerp(P0, P1, u);
  return { x: p.x, y: p.y - v * h };
}

function windows(ctx, P0, P1, h, floors, cols, seed) {
  const fh = 1 / floors;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const u0 = (c + 0.25) / cols, u1 = (c + 0.75) / cols;
      const v0 = f * fh + fh * 0.3, v1 = f * fh + fh * 0.75;
      const lit = ((seed * 7 + f * 3 + c * 5) % 5) === 0;
      poly(ctx, [facePt(P0, P1, h, u0, v0), facePt(P0, P1, h, u1, v0),
                 facePt(P0, P1, h, u1, v1), facePt(P0, P1, h, u0, v1)],
           lit ? '#fff2b3' : 'rgba(205, 230, 255, 0.95)');
    }
  }
}

// ---------------------------------------------------------------------------
// Construções
// ---------------------------------------------------------------------------
export function buildingHull(i, j, size, look) {
  const m = 0.14;
  const c = boxCorners(i + m, j + m, i + size - m, j + size - m);
  const h = (look.h || 20) + roofHeight(size, look) + 24;
  return [c.L, c.B, c.R, up(c.R, h), up(c.T, h), up(c.L, h)];
}

function roofHeight(size, look) {
  return look.roof_ === 'pyramid' ? 14 * size : 0;
}

export function drawBuilding(ctx, i, j, size, look, t = 0, seed = 0) {
  const m = 0.14;
  let i0 = i + m, j0 = j + m, i1 = i + size - m, j1 = j + size - m;

  // Piscina: o prédio fica no fundo e a piscina na frente.
  if (look.extra === 'pool') {
    const p = boxCorners(i + 0.2, j + 0.62, i + 0.85, j + 0.92);
    poly(ctx, [p.T, p.R, p.B, p.L], '#e9eef2');
    const w = boxCorners(i + 0.27, j + 0.67, i + 0.78, j + 0.87);
    poly(ctx, [w.T, w.R, w.B, w.L], '#4fc3f7');
    j1 = j + 0.56;
  }

  const c = boxCorners(i0, j0, i1, j1);
  const h = look.h || 20;
  const flat = look.roof_ !== 'pyramid';
  drawBox(ctx, c, h, look.walls, flat ? look.roof : shade(look.walls, 1.05));

  // Janelas
  const floors = look.floors || 1;
  const cols = Math.max(1, Math.round(2 * size));
  if (look.floors) {
    windows(ctx, c.L, c.B, h, floors, cols, seed);
    windows(ctx, c.B, c.R, h, floors, cols, seed + 3);
  }

  // Porta (face esquerda, centro)
  if (look.extra === 'door' || !look.floors) {
    poly(ctx, [facePt(c.L, c.B, h, 0.4, 0), facePt(c.L, c.B, h, 0.6, 0),
               facePt(c.L, c.B, h, 0.6, 0.55), facePt(c.L, c.B, h, 0.4, 0.55)],
         shade(look.walls, 0.45));
  }

  // Toldo listrado (comércio)
  if (look.extra === 'awning') {
    const n = 6;
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n;
      const col = k % 2 === 0 ? '#ffffff' : look.roof;
      poly(ctx, [facePt(c.L, c.B, h, u0, 0.62), facePt(c.L, c.B, h, u1, 0.62),
                 { x: lerp(c.L, c.B, u1).x - 3, y: lerp(c.L, c.B, u1).y - h * 0.42 },
                 { x: lerp(c.L, c.B, u0).x - 3, y: lerp(c.L, c.B, u0).y - h * 0.42 }], col);
    }
  }

  // Cruz (saúde)
  if (look.extra === 'cross') {
    const cx = lerp(c.L, c.B, 0.5), y = cx.y - h * 0.6;
    ctx.fillStyle = '#e53935';
    ctx.fillRect(cx.x - 2, y - 7, 4, 14);
    ctx.fillRect(cx.x - 7, y - 2, 14, 4);
  }

  // Telhado
  const topT = up(c.T, h), topR = up(c.R, h), topB = up(c.B, h), topL = up(c.L, h);
  const mid = { x: (topT.x + topB.x) / 2, y: (topT.y + topB.y) / 2 };
  let peak = mid;
  if (!flat) {
    const rh = roofHeight(size, look);
    peak = up(mid, rh);
    poly(ctx, [topT, topR, peak], shade(look.roof, 1.15));
    poly(ctx, [topT, topL, peak], shade(look.roof, 1.05));
    poly(ctx, [topL, topB, peak], shade(look.roof, 0.95));
    poly(ctx, [topB, topR, peak], shade(look.roof, 0.78));
  } else if (look.extra === 'stadium') {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(mid.x, mid.y, 22 * size * 0.6, 11 * size * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // Chaminés
  if (look.extra === 'chimney' || look.extra === 'chimney2') {
    const spots = look.extra === 'chimney2' ? [0.3, 0.6] : [0.4];
    for (const s of spots) {
      const ci = i0 + (i1 - i0) * s, cj = j0 + (j1 - j0) * 0.25;
      const cc = boxCorners(ci, cj, ci + 0.14, cj + 0.14);
      for (const k of ['T', 'R', 'B', 'L']) cc[k] = up(cc[k], h);
      drawBox(ctx, cc, 16, '#7f8c8d', '#5d6d6e');
      // fumaça
      const top = up(cc.T, 22);
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.6 + k / 3) % 1;
        ctx.fillStyle = `rgba(230,230,230,${0.55 * (1 - ph)})`;
        ctx.beginPath(); ctx.arc(top.x + ph * 8, top.y - ph * 18, 3 + ph * 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Bandeira
  if (look.extra === 'flag') {
    const base = flat ? mid : peak;
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(base.x, base.y - 22); ctx.stroke();
    const w = Math.sin(t * 4) * 2;
    poly(ctx, [{ x: base.x, y: base.y - 22 }, { x: base.x + 13, y: base.y - 19 + w },
               { x: base.x, y: base.y - 15 }], '#2ecc71');
  }

  // Antena
  if (look.extra === 'antenna') {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mid.x, mid.y); ctx.lineTo(mid.x, mid.y - 24); ctx.stroke();
    ctx.fillStyle = (Math.floor(t * 2) % 2) ? '#ff5252' : '#b71c1c';
    ctx.beginPath(); ctx.arc(mid.x, mid.y - 24, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // Toras (serraria)
  if (look.extra === 'logs') {
    const f = lerp(c.B, c.R, 0.5);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#8d5524';
      ctx.beginPath(); ctx.ellipse(f.x + 8 + k * 5, f.y + 2 - k * 3, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d7a86e';
      ctx.beginPath(); ctx.ellipse(f.x + 8 + k * 5, f.y + 2 - k * 3, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Decoração
// ---------------------------------------------------------------------------
function treeAt(ctx, p, s = 1) {
  ctx.fillStyle = '#7b4f2c';
  ctx.fillRect(p.x - 2 * s, p.y - 10 * s, 4 * s, 10 * s);
  ctx.fillStyle = '#3e9b4f';
  ctx.beginPath(); ctx.arc(p.x, p.y - 16 * s, 9 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#56b866';
  ctx.beginPath(); ctx.arc(p.x - 3 * s, p.y - 19 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
}

export function drawDecor(ctx, i, j, look, t = 0) {
  const c = center(i, j);
  if (look.kind === 'tree') { treeAt(ctx, c, 1.1); return; }
  const d = boxCorners(i + 0.1, j + 0.1, i + 0.9, j + 0.9);
  if (look.kind === 'plaza') {
    poly(ctx, [d.T, d.R, d.B, d.L], '#e3d9c6');
    const e = boxCorners(i + 0.3, j + 0.3, i + 0.7, j + 0.7);
    poly(ctx, [e.T, e.R, e.B, e.L], '#7ccf6b');
    treeAt(ctx, c, 0.8);
    return;
  }
  if (look.kind === 'fountain') {
    poly(ctx, [d.T, d.R, d.B, d.L], '#e3d9c6');
    ctx.fillStyle = '#b0bec5';
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 1, 16, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.9 + k / 4) % 1;
      ctx.fillStyle = `rgba(225,245,255,${0.9 * (1 - ph)})`;
      ctx.beginPath(); ctx.arc(c.x + Math.sin(k * 1.7) * ph * 8, c.y - 6 - Math.sin(ph * Math.PI) * 14, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Lote de produção (≈ plantação)
// ---------------------------------------------------------------------------
export function drawLot(ctx, i, j, resource, progress = 0) {
  const d = boxCorners(i + 0.08, j + 0.08, i + 0.92, j + 0.92);
  poly(ctx, [d.T, d.R, d.B, d.L], '#a07b50');
  // sulcos
  ctx.strokeStyle = 'rgba(80, 50, 25, 0.35)'; ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    const a = lerp(d.T, d.L, k / 4), b = lerp(d.R, d.B, k / 4);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  if (!resource) return;
  const s = 0.4 + 0.6 * Math.min(1, progress); // cresce com o progresso
  const spots = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]];
  for (const [u, v] of spots) {
    const p = pt(i + u, j + v);
    if (resource === 'wood') treeAt(ctx, p, 0.55 * s);
    else if (resource === 'sand') { ctx.fillStyle = '#f2d98d'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 2 * s, 8 * s, 4.5 * s, 0, Math.PI, 0); ctx.fill(); }
    else if (resource === 'clay') { ctx.fillStyle = '#b8653a'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 2 * s, 7 * s, 4 * s, 0, Math.PI, 0); ctx.fill(); }
    else if (resource === 'iron') { ctx.fillStyle = '#78828c'; poly(ctx, [{ x: p.x - 6 * s, y: p.y }, { x: p.x - 2 * s, y: p.y - 8 * s }, { x: p.x + 5 * s, y: p.y - 5 * s }, { x: p.x + 6 * s, y: p.y }], '#78828c'); }
  }
}

// ---------------------------------------------------------------------------
// Obstáculos
// ---------------------------------------------------------------------------
export function drawObstacle(ctx, i, j, type) {
  const c = center(i, j);
  if (type === 'bush') {
    for (const [dx, dy, r] of [[-9, -2, 7], [6, -1, 8], [-1, -8, 7], [2, 4, 6]]) {
      ctx.fillStyle = '#4c9a3f';
      ctx.beginPath(); ctx.arc(c.x + dx, c.y + dy, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === 'rubble') {
    for (const [dx, dy, r] of [[-8, 2, 6], [5, 0, 7], [-1, -5, 5], [9, 6, 4]]) {
      ctx.fillStyle = '#9e9e9e';
      ctx.beginPath(); ctx.arc(c.x + dx, c.y + dy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bdbdbd';
      ctx.beginPath(); ctx.arc(c.x + dx - 1.5, c.y + dy - 1.5, r * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === 'car') {
    // carro velho e meio torto: rodas, carroceria vermelha desbotada, cabine de vidro
    const b = boxCorners(i + 0.32, j + 0.2, i + 0.68, j + 0.8);
    ctx.fillStyle = '#2b2b2b';
    for (const u of [0.18, 0.82]) {
      const pl = lerp(b.L, b.B, u), pr = lerp(b.B, b.R, u);
      ctx.beginPath(); ctx.ellipse(pl.x, pl.y - 1, 3, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      if (u > 0.5) { ctx.beginPath(); ctx.ellipse(pr.x, pr.y - 1, 3, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    for (const k of ['T', 'R', 'B', 'L']) b[k] = up(b[k], 2);
    drawBox(ctx, b, 7, '#c9584a', '#d97a6c');
    const r = boxCorners(i + 0.36, j + 0.36, i + 0.64, j + 0.6);
    for (const k of ['T', 'R', 'B', 'L']) r[k] = up(r[k], 9);
    drawBox(ctx, r, 6, '#9fc3d8', '#c9584a');
    // ferrugem
    ctx.fillStyle = 'rgba(120, 70, 30, 0.45)';
    const f = lerp(b.L, b.B, 0.55);
    ctx.beginPath(); ctx.arc(f.x, f.y - 4, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

// Ponto dentro de polígono (para tocar em prédios altos).
export function pointInPoly(p, pts) {
  let inside = false;
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
    const xi = pts[a].x, yi = pts[a].y, xj = pts[b].x, yj = pts[b].y;
    if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

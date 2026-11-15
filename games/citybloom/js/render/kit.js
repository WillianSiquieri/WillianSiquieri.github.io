// kit.js — primitivas de desenho isométrico "moderno": caixas com faces em
// gradiente, sombra projetada suave, janelas de vidro com moldura e reflexo,
// varandas com guarda-corpo de vidro, toldos, telhados (duas águas e laje com
// platibanda) e equipamentos de cobertura.
//
// Tudo é desenhado no espaço de um objeto com canto de fundo em (0,0) da grade:
// box = { i0, j0, i1, j1 } em unidades de tile; z = altura em px de mundo.
// Lados visíveis: 'L' = face esquerda (aresta i0,j1 → i1,j1) e
//                 'R' = face direita (aresta i1,j1 → i1,j0).

import { pt } from '../engine/iso.js';

export const G = pt;
export const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
export const up = (p, z) => ({ x: p.x, y: p.y - z });
export const box = (i0, j0, i1, j1) => ({ i0, j0, i1, j1 });

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------
// Aceita '#rrggbb' e 'rgb(r,g,b)' (saída do próprio tint), para poder encadear.
function rgb(c) {
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/\d+(\.\d+)?/g) || [0, 0, 0];
  return [+m[0], +m[1], +m[2]];
}
// f < 1 escurece; f > 1 clareia em direção ao branco.
export function tint(hex, f) {
  const [r, g, b] = rgb(hex);
  const c = (v) => f <= 1 ? Math.round(v * f) : Math.round(v + (255 - v) * (f - 1));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
export function alpha(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

export function line(ctx, a, b, color, lw = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function vgrad(ctx, yTop, yBot, cTop, cBot) {
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, cTop); g.addColorStop(1, cBot);
  return g;
}

// ---------------------------------------------------------------------------
// Geometria de faces
// ---------------------------------------------------------------------------
export function edge(b, side) {
  return side === 'L' ? [G(b.i0, b.j1), G(b.i1, b.j1)] : [G(b.i1, b.j1), G(b.i1, b.j0)];
}
export function facePt(b, side, u, z) {
  const [A, B] = edge(b, side);
  return up(lerp(A, B, u), z);
}
export function faceQuad(b, side, u0, u1, z0, z1) {
  return [facePt(b, side, u0, z0), facePt(b, side, u1, z0), facePt(b, side, u1, z1), facePt(b, side, u0, z1)];
}
export function topQuad(b, z) {
  return [up(G(b.i0, b.j0), z), up(G(b.i1, b.j0), z), up(G(b.i1, b.j1), z), up(G(b.i0, b.j1), z)];
}
// Vetor "para fora" da face, em px de mundo, para `d` tiles.
export function outward(side, d) {
  return side === 'L' ? { x: -32 * d, y: 16 * d } : { x: 32 * d, y: 16 * d };
}
const LIGHT = { L: 0.93, R: 0.74 };

// ---------------------------------------------------------------------------
// Sombra projetada (luz vindo de trás-esquerda → sombra para frente-direita)
// ---------------------------------------------------------------------------
export function shadow(ctx, b, h, strength = 0.2) {
  const k = Math.min(1.6, h / 55);
  const v = { x: 32 * k, y: 16 * k };
  const T = G(b.i0, b.j0), R = G(b.i1, b.j0), B = G(b.i1, b.j1), L = G(b.i0, b.j1);
  const sh = (p) => ({ x: p.x + v.x, y: p.y + v.y });
  ctx.save();
  ctx.globalAlpha = strength;
  poly(ctx, [T, sh(R), sh(B), sh(L), L], '#1d2b1f');
  ctx.globalAlpha = strength * 0.6;
  poly(ctx, [L, B, R, T], '#1d2b1f'); // contato (oclusão na base)
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Caixa (prisma) com faces em gradiente
// ---------------------------------------------------------------------------
export function prism(ctx, b, z0, z1, color, opts = {}) {
  const { top = tint(color, 1.12), sides = ['L', 'R'], stroke = null } = opts;
  for (const s of sides) {
    const q = faceQuad(b, s, 0, 1, z0, z1);
    const f = LIGHT[s];
    const yTop = Math.min(q[2].y, q[3].y), yBot = Math.max(q[0].y, q[1].y);
    poly(ctx, q, vgrad(ctx, yTop, yBot, tint(color, f * 1.05), tint(color, f * 0.9)), stroke);
  }
  if (top) poly(ctx, topQuad(b, z1), top, stroke);
}

// Faixa horizontal (rodapé, laje, platibanda) ao redor das faces visíveis.
export function band(ctx, b, z0, z1, color, out = 0) {
  const bb = out ? box(b.i0 - out, b.j0 - out, b.i1 + out, b.j1 + out) : b;
  prism(ctx, bb, z0, z1, color, { top: out ? tint(color, 1.08) : null });
}

// ---------------------------------------------------------------------------
// Janelas
// ---------------------------------------------------------------------------
// Uma janela de vidro com moldura e reflexo diagonal.
export function glassPane(ctx, q, opts = {}) {
  const { frame = '#ffffff', glass = '#7fb8e6', lit = false, fw = 1 } = opts;
  poly(ctx, q, frame);
  // vidro levemente menor que a moldura
  const c = { x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4, y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4 };
  const shrink = (p) => ({ x: c.x + (p.x - c.x) * (1 - 0.18 * fw), y: c.y + (p.y - c.y) * (1 - 0.18 * fw) });
  const g = q.map(shrink);
  const yTop = Math.min(g[2].y, g[3].y), yBot = Math.max(g[0].y, g[1].y);
  poly(ctx, g, lit
    ? vgrad(ctx, yTop, yBot, '#fff6cf', '#ffd977')
    : vgrad(ctx, yTop, yBot, tint(glass, 1.45), tint(glass, 0.92)));
  // reflexo: faixa diagonal clara
  ctx.save();
  ctx.globalAlpha = 0.35;
  poly(ctx, [lerp(g[3], g[2], 0.15), lerp(g[3], g[2], 0.45), lerp(g[0], g[1], 0.2), lerp(g[0], g[1], -0.1)], '#ffffff');
  ctx.restore();
}

// Grade de janelas numa face.
export function windows(ctx, b, side, o) {
  const { z0, z1, rows, cols, mu = 0.18, mv = 0.24, frame, glass, seed = 0, litEvery = 6 } = o;
  const fh = (z1 - z0) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u0 = (c + mu) / cols, u1 = (c + 1 - mu) / cols;
      const za = z0 + r * fh + fh * mv, zb = z0 + (r + 1) * fh - fh * mv * 0.6;
      const lit = ((seed * 13 + r * 7 + c * 5) % litEvery) === 0;
      glassPane(ctx, faceQuad(b, side, u0, u1, za, zb), { frame, glass, lit });
    }
  }
}

// Faixa de vidro contínua por andar (prédios modernos) com montantes.
export function glassBands(ctx, b, side, o) {
  const { z0, z1, floors, glass = '#6fa8d6', mullion = 'rgba(255,255,255,0.55)', cols = 4 } = o;
  const fh = (z1 - z0) / floors;
  for (let f = 0; f < floors; f++) {
    const za = z0 + f * fh + fh * 0.22, zb = z0 + (f + 1) * fh - fh * 0.08;
    const q = faceQuad(b, side, 0.04, 0.96, za, zb);
    const yTop = Math.min(q[2].y, q[3].y), yBot = Math.max(q[0].y, q[1].y);
    poly(ctx, q, vgrad(ctx, yTop, yBot, tint(glass, 1.35), tint(glass, side === 'R' ? 0.8 : 0.95)));
    for (let c = 1; c < cols; c++) line(ctx, facePt(b, side, c / cols, za), facePt(b, side, c / cols, zb), mullion, 0.8);
  }
}

// Pano de vidro (arranha-céu): gradiente com reflexo do céu e grade fina.
export function curtainWall(ctx, b, side, z0, z1, glass, floors, cols) {
  const q = faceQuad(b, side, 0, 1, z0, z1);
  const yTop = Math.min(q[2].y, q[3].y), yBot = Math.max(q[0].y, q[1].y);
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  const f = side === 'R' ? 0.78 : 1;
  g.addColorStop(0, tint(glass, 1.55 * f > 1 ? 1.5 : 1));
  g.addColorStop(0.45, tint(glass, 1.05 * f));
  g.addColorStop(1, tint(glass, 0.8 * f));
  poly(ctx, q, g);
  for (let k = 1; k < floors; k++) {
    const z = z0 + (z1 - z0) * k / floors;
    line(ctx, facePt(b, side, 0, z), facePt(b, side, 1, z), 'rgba(255,255,255,0.28)', 0.6);
  }
  for (let c = 1; c < cols; c++) line(ctx, facePt(b, side, c / cols, z0), facePt(b, side, c / cols, z1), 'rgba(20,40,70,0.25)', 0.8);
  // reflexo diagonal grande
  ctx.save(); ctx.globalAlpha = 0.18;
  poly(ctx, [facePt(b, side, 0.1, z1), facePt(b, side, 0.45, z1), facePt(b, side, 0.75, z0), facePt(b, side, 0.4, z0)], '#ffffff');
  ctx.restore();
}

// Porta (com vidro opcional) e marquise.
export function door(ctx, b, side, u, w, h, color = '#3b4350', glassy = true) {
  const q = faceQuad(b, side, u - w / 2, u + w / 2, 0, h);
  poly(ctx, q, color);
  if (glassy) glassPane(ctx, faceQuad(b, side, u - w / 2 + 0.02, u + w / 2 - 0.02, h * 0.15, h * 0.9), { frame: color, glass: '#86b9de' });
}
export function canopy(ctx, b, side, u0, u1, z, depth, color) {
  const o = outward(side, depth);
  const a = facePt(b, side, u0, z), c = facePt(b, side, u1, z);
  const a2 = { x: a.x + o.x, y: a.y + o.y }, c2 = { x: c.x + o.x, y: c.y + o.y };
  poly(ctx, [a, c, c2, a2], tint(color, 1.1));
  poly(ctx, [a2, c2, up(c2, -2), up(a2, -2)], tint(color, 0.8));
}

// Toldo listrado inclinado.
export function awning(ctx, b, side, u0, u1, z, depth, color, stripes = 7) {
  const o = outward(side, depth);
  for (let k = 0; k < stripes; k++) {
    const ua = u0 + (u1 - u0) * k / stripes, ub = u0 + (u1 - u0) * (k + 1) / stripes;
    const a = facePt(b, side, ua, z), c = facePt(b, side, ub, z);
    const a2 = { x: a.x + o.x, y: a.y + o.y + 5 }, c2 = { x: c.x + o.x, y: c.y + o.y + 5 };
    poly(ctx, [a, c, c2, a2], k % 2 ? '#ffffff' : color);
  }
  const a = facePt(b, side, u0, z), c = facePt(b, side, u1, z);
  const a2 = { x: a.x + o.x, y: a.y + o.y + 5 }, c2 = { x: c.x + o.x, y: c.y + o.y + 5 };
  poly(ctx, [a2, c2, up(c2, -3), up(a2, -3)], tint(color, 0.8));
}

// Varanda com laje e guarda-corpo de vidro, em toda a largura (u0..u1).
export function balcony(ctx, b, side, u0, u1, z, depth = 0.1, slab = '#e8e4dc') {
  const o = outward(side, depth);
  const a = facePt(b, side, u0, z), c = facePt(b, side, u1, z);
  const a2 = { x: a.x + o.x, y: a.y + o.y }, c2 = { x: c.x + o.x, y: c.y + o.y };
  poly(ctx, [a, c, c2, a2], tint(slab, 1.05));
  poly(ctx, [a2, c2, up(c2, -2), up(a2, -2)], tint(slab, 0.82));
  // guarda-corpo de vidro
  poly(ctx, [a2, c2, up(c2, 6), up(a2, 6)], 'rgba(190,225,250,0.45)', 'rgba(255,255,255,0.8)', 0.7);
  // lateral
  poly(ctx, [a, a2, up(a2, 6), up(a, 6)], 'rgba(190,225,250,0.3)');
}

// Revestimento de tábuas verticais (madeira).
export function cladding(ctx, b, side, z0, z1, n = 8) {
  for (let k = 1; k < n; k++) {
    line(ctx, facePt(b, side, k / n, z0), facePt(b, side, k / n, z1), 'rgba(60,35,15,0.2)', 0.7);
  }
}

// Fiadas de tijolo (linhas horizontais).
export function brickLines(ctx, b, side, z0, z1, step = 3.5) {
  for (let z = z0 + step; z < z1; z += step) line(ctx, facePt(b, side, 0, z), facePt(b, side, 1, z), 'rgba(90,30,10,0.18)', 0.6);
}

// ---------------------------------------------------------------------------
// Telhados
// ---------------------------------------------------------------------------
// Duas águas. axis 'i': cumeeira paralela a i (empena na face R);
//             axis 'j': cumeeira paralela a j (empena na face L).
export function gableRoof(ctx, b, z, rise, color, axis = 'i', wall = null, eave = 0.06) {
  const e = box(b.i0 - eave, b.j0 - eave, b.i1 + eave, b.j1 + eave);
  if (axis === 'i') {
    const jm = (b.j0 + b.j1) / 2;
    const r0 = up(G(e.i0, jm), z + rise), r1 = up(G(e.i1, jm), z + rise);
    poly(ctx, [up(G(e.i0, e.j0), z), up(G(e.i1, e.j0), z), r1, r0], tint(color, 1.12));      // água de trás
    if (wall) poly(ctx, [up(G(b.i1, b.j0), z), up(G(b.i1, b.j1), z), up(G(b.i1, jm), z + rise)], tint(wall, LIGHT.R)); // empena
    poly(ctx, [up(G(e.i0, e.j1), z), up(G(e.i1, e.j1), z), r1, r0], tint(color, 0.92));      // água da frente
    poly(ctx, [up(G(e.i1, e.j1), z), up(G(e.i1, e.j1), z - 2), up(G(e.i0, e.j1), z - 2), up(G(e.i0, e.j1), z)], tint(color, 0.7));
    line(ctx, r0, r1, tint(color, 1.25), 1.2);
  } else {
    const im = (b.i0 + b.i1) / 2;
    const r0 = up(G(im, e.j0), z + rise), r1 = up(G(im, e.j1), z + rise);
    poly(ctx, [up(G(e.i0, e.j0), z), up(G(e.i0, e.j1), z), r1, r0], tint(color, 1.1));       // água esquerda (fundo)
    if (wall) poly(ctx, [up(G(b.i0, b.j1), z), up(G(b.i1, b.j1), z), up(G(im, b.j1), z + rise)], tint(wall, LIGHT.L));
    poly(ctx, [up(G(e.i1, e.j0), z), up(G(e.i1, e.j1), z), r1, r0], tint(color, 0.78));      // água direita (frente)
    poly(ctx, [up(G(e.i1, e.j1), z), up(G(e.i1, e.j1), z - 2), up(G(e.i1, e.j0), z - 2), up(G(e.i1, e.j0), z)], tint(color, 0.62));
    line(ctx, r0, r1, tint(color, 1.25), 1.2);
  }
}

// Laje plana com platibanda (borda) e miolo rebaixado.
export function flatRoof(ctx, b, z, color = '#cfd4da', rim = '#eef0f2', rimH = 2.5) {
  prism(ctx, b, z, z + rimH, rim, { top: tint(rim, 1.05) });
  const inset = 0.05;
  const ib = box(b.i0 + inset, b.j0 + inset, b.i1 - inset, b.j1 - inset);
  poly(ctx, topQuad(ib, z + rimH), color);
  // sombra interna da platibanda
  poly(ctx, [up(G(ib.i0, ib.j0), z + rimH), up(G(ib.i1, ib.j0), z + rimH), up(G(ib.i1, ib.j0 + 0.05), z + rimH), up(G(ib.i0 + 0.05, ib.j0 + 0.05), z + rimH), up(G(ib.i0 + 0.05, ib.j1), z + rimH), up(G(ib.i0, ib.j1), z + rimH)], 'rgba(0,0,0,0.1)');
  return z + rimH;
}

// Equipamentos de cobertura
export function acUnit(ctx, i, j, z, s = 0.12) {
  const b = box(i, j, i + s, j + s * 0.8);
  prism(ctx, b, z, z + 5, '#c9ced4', { top: '#e3e7eb' });
  const c = up(G(i + s / 2, j + s * 0.4), z + 5);
  ctx.fillStyle = '#8c949c'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 2.6, 1.3, 0, 0, Math.PI * 2); ctx.fill();
}
export function waterTank(ctx, i, j, z) {
  const c = up(G(i, j), z);
  ctx.fillStyle = '#5b8fb9';
  ctx.fillRect(c.x - 5, c.y - 9, 10, 9);
  ctx.beginPath(); ctx.ellipse(c.x, c.y, 5, 2.5, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#7fb0d6'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 9, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
}
export function solarPanels(ctx, b, z, rows = 2) {
  for (let r = 0; r < rows; r++) {
    const j0 = b.j0 + (b.j1 - b.j0) * r / rows + 0.02, j1 = b.j0 + (b.j1 - b.j0) * (r + 1) / rows - 0.02;
    const q = [up(G(b.i0, j0), z + 3), up(G(b.i1, j0), z + 3), up(G(b.i1, j1), z), up(G(b.i0, j1), z)];
    poly(ctx, q, '#2c4f7c', 'rgba(255,255,255,0.5)', 0.6);
    line(ctx, lerp(q[0], q[1], 0.5), lerp(q[3], q[2], 0.5), 'rgba(255,255,255,0.35)', 0.5);
  }
}

// Cilindro vertical (silo, chaminé, caixa d'água grande).
export function cylinder(ctx, c, r, h, color, topColor) {
  const g = ctx.createLinearGradient(c.x - r, 0, c.x + r, 0);
  g.addColorStop(0, tint(color, 1.08)); g.addColorStop(0.55, tint(color, 0.95)); g.addColorStop(1, tint(color, 0.68));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(c.x - r, c.y); ctx.lineTo(c.x - r, c.y - h);
  ctx.ellipse(c.x, c.y - h, r, r / 2, 0, Math.PI, 0, false);
  ctx.lineTo(c.x + r, c.y);
  ctx.ellipse(c.x, c.y, r, r / 2, 0, 0, Math.PI, false);
  ctx.fill();
  ctx.fillStyle = topColor || tint(color, 1.15);
  ctx.beginPath(); ctx.ellipse(c.x, c.y - h, r, r / 2, 0, 0, Math.PI * 2); ctx.fill();
}

// Placa/letreiro voltado para a tela (estilo billboard).
export function signBoard(ctx, p, text, bg, fg = '#ffffff', w = 20, h = 11) {
  const x = p.x - w / 2, y = p.y - h;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, x + 1, y + 1.5, w, h, 3); ctx.fill();
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 3); ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `${Math.round(h * 0.72)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, p.x, y + h / 2 + 0.5);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Diamante plano no chão (piso, deck, grama de jardim).
export function groundQuad(ctx, b, color, z = 0, stroke = null) {
  poly(ctx, topQuad(b, z), color, stroke);
}

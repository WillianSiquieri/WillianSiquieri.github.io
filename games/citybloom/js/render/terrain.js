// terrain.js — chão: grama com textura, ruas com calçada/meio-fio/faixas,
// cruzamentos com faixa de pedestre, lotes de produção cercados, terra à venda
// e a base de terra do mapa (efeito maquete).
// As funções de tile desenham na origem (0,0) da grade (o cache de sprites
// posiciona depois).

import { drawRich } from '../ui/icons.js';
import { G, up, box, poly, tint, lerp, line, prism, cylinder, roundRect } from './kit.js';
import { tree, hash, fence } from './props.js';

const D = (i0, j0, i1, j1) => [G(i0, j0), G(i1, j0), G(i1, j1), G(i0, j1)];

// ---------------------------------------------------------------------------
// Grama
// ---------------------------------------------------------------------------
const GRASS = ['#86cf63', '#8ad467', '#82c95f', '#8ed76b'];

export function grassTile(ctx, variant) {
  const q = D(0, 0, 1, 1);
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, tint(GRASS[variant % 4], 1.06));
  g.addColorStop(1, tint(GRASS[variant % 4], 0.96));
  poly(ctx, q, g);
  // textura: pontinhos e tufos
  for (let k = 0; k < 14; k++) {
    const u = 0.08 + hash(variant, k, 1) * 0.84, v = 0.08 + hash(k, variant, 2) * 0.84;
    const p = G(u, v);
    if (k % 3 === 0) {
      ctx.strokeStyle = 'rgba(60,120,40,0.45)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(p.x - 1.5, p.y); ctx.lineTo(p.x - 0.5, p.y - 2.5);
      ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.4, p.y - 3); ctx.moveTo(p.x + 1.5, p.y); ctx.lineTo(p.x + 1.2, p.y - 2.2); ctx.stroke();
    } else {
      ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(40,90,30,0.14)';
      ctx.fillRect(p.x, p.y, 1.4, 0.9);
    }
  }
  if (variant === 3) { // florzinhas ocasionais
    for (let k = 0; k < 3; k++) {
      const p = G(0.2 + hash(k, 9) * 0.6, 0.2 + hash(9, k) * 0.6);
      ctx.fillStyle = ['#ffffff', '#ffd166', '#ff8fab'][k];
      ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.fill();
    }
  }
  line(ctx, q[0], q[1], 'rgba(255,255,255,0.12)', 0.6);
  line(ctx, q[0], q[3], 'rgba(255,255,255,0.12)', 0.6);
}

// Água (mar e rio) e areia da praia — usados só no modo 2D de reserva.
export function waterTile(ctx, variant) {
  poly(ctx, D(0, 0, 1, 1), variant % 2 ? '#3d9fd6' : '#43a5da');
  if (variant === 1) line(ctx, G(0.25, 0.4), G(0.55, 0.4), 'rgba(255,255,255,0.5)', 1);
}
export function sandTile(ctx) { poly(ctx, D(0, 0, 1, 1), '#ead49c'); }

// ---------------------------------------------------------------------------
// Ruas: type 'i' (corre ao longo de i), 'j' (ao longo de j), 'x' (cruzamento)
// ---------------------------------------------------------------------------
const ASPHALT = '#5b6168', SIDEWALK = '#d9d6cf', CURB = '#b9b4aa';
const SW = 0.17; // largura da calçada (fração do tile)

function asphalt(ctx, q) {
  const yTop = Math.min(...q.map(p => p.y)), yBot = Math.max(...q.map(p => p.y));
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, tint(ASPHALT, 1.08)); g.addColorStop(1, tint(ASPHALT, 0.95));
  poly(ctx, q, g);
}

function sidewalk(ctx, q) {
  poly(ctx, q, SIDEWALK);
  // juntas da calçada
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(lerp(q[0], q[1], 0.5).x, lerp(q[0], q[1], 0.5).y);
  ctx.lineTo(lerp(q[3], q[2], 0.5).x, lerp(q[3], q[2], 0.5).y); ctx.stroke();
}

export function roadTile(ctx, type) {
  if (type === 'i') {
    sidewalk(ctx, D(0, 0, 1, SW));
    sidewalk(ctx, D(0, 1 - SW, 1, 1));
    asphalt(ctx, D(0, SW, 1, 1 - SW));
    line(ctx, G(0, SW), G(1, SW), CURB, 1.2);
    line(ctx, G(0, 1 - SW), G(1, 1 - SW), CURB, 1.2);
    for (let k = 0; k < 3; k++) line(ctx, G(0.08 + k * 0.33, 0.5), G(0.25 + k * 0.33, 0.5), '#f2f0e6', 1.3);
  } else if (type === 'j') {
    sidewalk(ctx, D(0, 0, SW, 1));
    sidewalk(ctx, D(1 - SW, 0, 1, 1));
    asphalt(ctx, D(SW, 0, 1 - SW, 1));
    line(ctx, G(SW, 0), G(SW, 1), CURB, 1.2);
    line(ctx, G(1 - SW, 0), G(1 - SW, 1), CURB, 1.2);
    for (let k = 0; k < 3; k++) line(ctx, G(0.5, 0.08 + k * 0.33), G(0.5, 0.25 + k * 0.33), '#f2f0e6', 1.3);
  } else {
    asphalt(ctx, D(0, 0, 1, 1));
    // cantos de calçada
    for (const [a, b] of [[0, 0], [1 - SW, 0], [0, 1 - SW], [1 - SW, 1 - SW]]) sidewalk(ctx, D(a, b, a + SW, b + SW));
    // faixas de pedestre nas 4 entradas
    const stripe = (i0, j0, i1, j1) => poly(ctx, D(i0, j0, i1, j1), '#f4f2ea');
    for (let k = 0; k < 6; k++) {
      const a = SW + 0.03 + k * 0.105;
      stripe(0.02, a, 0.14, a + 0.055);          // entrada pelo lado i0
      stripe(0.86, a, 0.98, a + 0.055);          // lado i1
      stripe(a, 0.02, a + 0.055, 0.14);          // lado j0
      stripe(a, 0.86, a + 0.055, 0.98);          // lado j1
    }
  }
}

// Tipo da rua pelo vizinho.
export function roadType(state, i, j) {
  const isRoad = (a, b) => { const t = a >= 0 && b >= 0 && a < state.size && b < state.size ? state.tiles[b * state.size + a] : null; return t && t.kind === 'road' && t.ra !== 'corner'; };
  const alongI = isRoad(i - 1, j) || isRoad(i + 1, j);
  const alongJ = isRoad(i, j - 1) || isRoad(i, j + 1);
  if (alongI && alongJ) return 'x';
  return alongJ ? 'j' : 'i';
}

// ---------------------------------------------------------------------------
// Terra à venda (sobreposição) e placa
// ---------------------------------------------------------------------------
export function lockedOverlay(ctx, i, j) {
  poly(ctx, D(i, j, i + 1, j + 1), 'rgba(58, 70, 62, 0.34)');
}

export function forSaleSign(ctx, p, label, buyable) {
  // poste
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 1, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  line(ctx, p, up(p, 14), '#6b4a2e', 1.6);
  // placa
  const w = buyable ? 46 : 24, h = 17, x = p.x - w / 2, y = p.y - 30;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; roundRect(ctx, x, y + 2.5, w, h, 8); ctx.fill();
  ctx.fillStyle = buyable ? '#ffc23d' : '#d9dee3'; roundRect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.font = '700 10px Fredoka, "Segoe UI", sans-serif'; if ('fontKerning' in ctx) ctx.fontKerning = 'none';
  drawRich(ctx, label, p.x, y + h / 2 + 0.5, 10, { fill: buyable ? '#5a3300' : '#6b7280' });
}

// ---------------------------------------------------------------------------
// Lote de produção (≈ plantação): cercado, conteúdo por recurso e estágio 0..3
// ---------------------------------------------------------------------------
const LOT_SOIL = { wood: '#7f603d', sand: '#e3c98a', clay: '#b0643f', iron: '#7c7872', none: '#94714b' };

function fenceBack(ctx) {
  fence(ctx, [0.04, 0.04], [0.96, 0.04], 5, '#e8d9b8');
  fence(ctx, [0.04, 0.04], [0.04, 0.96], 5, '#e8d9b8');
}
function fenceFront(ctx) {
  fence(ctx, [0.04, 0.96], [0.4, 0.96], 5, '#f3e6c6');   // abertura (portão) no meio
  fence(ctx, [0.6, 0.96], [0.96, 0.96], 5, '#f3e6c6');
  fence(ctx, [0.96, 0.04], [0.96, 0.96], 5, '#f3e6c6');
}

export function lotSprite(ctx, resource, stage) {
  const soil = LOT_SOIL[resource || 'none'];
  const q = D(0.04, 0.04, 0.96, 0.96);
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, tint(soil, 1.08)); g.addColorStop(1, tint(soil, 0.9));
  poly(ctx, q, g);
  fenceBack(ctx);

  if (!resource) {
    // terra arada
    for (let k = 1; k < 6; k++) line(ctx, G(0.12, k / 6), G(0.88, k / 6), 'rgba(60,35,15,0.35)', 1.4);
    const c = G(0.5, 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+', c.x, c.y);
  } else if (resource === 'wood') {
    for (let k = 1; k < 4; k++) line(ctx, G(0.12, k / 4 + 0.02), G(0.88, k / 4 + 0.02), 'rgba(50,30,10,0.3)', 1);
    const s = [0.3, 0.48, 0.66, 0.82][stage];
    const spots = [[0.25, 0.25], [0.55, 0.25], [0.25, 0.55], [0.55, 0.55], [0.82, 0.4], [0.4, 0.82], [0.75, 0.75]];
    for (const [u, v] of spots) tree(ctx, u, v, s, (u * 10 + v * 10) % 2 > 1 ? 1 : 2);
  } else if (resource === 'sand') {
    poly(ctx, D(0.15, 0.15, 0.65, 0.65), tint(soil, 0.85));
    const c = G(0.42, 0.42), r = 7 + stage * 4;
    const sg = ctx.createRadialGradient(c.x - 3, c.y - r * 0.6, 1, c.x, c.y, r * 1.3);
    sg.addColorStop(0, '#fff1c2'); sg.addColorStop(1, '#d6b86e');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(c.x, c.y, r * 1.3, r * 0.6, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(c.x - r * 1.3, c.y); ctx.quadraticCurveTo(c.x, c.y - r * 1.4, c.x + r * 1.3, c.y); ctx.fill();
    excavator(ctx, 0.74, 0.7);
  } else if (resource === 'clay') {
    poly(ctx, D(0.14, 0.14, 0.7, 0.7), tint(soil, 0.78));
    const w = G(0.3, 0.5);
    ctx.fillStyle = 'rgba(120,170,200,0.65)'; ctx.beginPath(); ctx.ellipse(w.x, w.y, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    const n = 1 + stage;
    for (let k = 0; k < n; k++) {
      const c = G(0.55 + (k % 2) * 0.2, 0.3 + Math.floor(k / 2) * 0.35);
      const cg = ctx.createRadialGradient(c.x - 2, c.y - 5, 1, c.x, c.y, 9);
      cg.addColorStop(0, '#d98a5f'); cg.addColorStop(1, '#8f4426');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(c.x, c.y, 8, 4, 0, Math.PI, 0); ctx.quadraticCurveTo(c.x, c.y - 10, c.x - 8, c.y); ctx.fill();
    }
  } else if (resource === 'iron') {
    // morro com entrada da mina
    const m = G(0.32, 0.32);
    const mg = ctx.createRadialGradient(m.x - 4, m.y - 12, 2, m.x, m.y - 4, 24);
    mg.addColorStop(0, '#9b958c'); mg.addColorStop(1, '#5f5a53');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(m.x, m.y, 22, 11, 0, Math.PI, 0); ctx.quadraticCurveTo(m.x, m.y - 26, m.x - 22, m.y); ctx.fill();
    ctx.fillStyle = '#1f1d1b'; ctx.beginPath(); ctx.ellipse(m.x + 4, m.y - 2, 6, 7, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#8a6a45'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(m.x + 4, m.y - 2, 6.5, 7.5, 0, Math.PI, 0); ctx.stroke();
    // trilhos
    line(ctx, G(0.42, 0.4), G(0.9, 0.88), '#6d5a48', 1);
    line(ctx, G(0.38, 0.46), G(0.84, 0.92), '#6d5a48', 1);
    for (let k = 0; k < 6; k++) { const a = lerp(G(0.42, 0.4), G(0.9, 0.88), k / 6), b = lerp(G(0.38, 0.46), G(0.84, 0.92), k / 6); line(ctx, a, b, '#8a6a45', 1.2); }
    // vagonete com minério
    const cb = box(0.6, 0.62, 0.78, 0.74);
    prism(ctx, cb, 2, 7, '#7d8791', { top: '#5a636c' });
    if (stage > 0) {
      const c = up(G(0.69, 0.68), 7);
      for (let k = 0; k < stage + 1; k++) { ctx.fillStyle = k % 2 ? '#4f4a45' : '#6a635b'; ctx.beginPath(); ctx.arc(c.x - 3 + k * 2, c.y - 1 - (k % 2), 2.2, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  fenceFront(ctx);
}

function excavator(ctx, i, j) {
  const b = box(i - 0.08, j - 0.06, i + 0.08, j + 0.06);
  prism(ctx, box(b.i0, b.j0, b.i1, b.j1), 1.5, 3, '#2d2d2d', { top: '#3a3a3a' });  // esteira
  prism(ctx, box(i - 0.06, j - 0.05, i + 0.06, j + 0.05), 3, 8, '#f5b700', { top: '#ffd23f' });
  prism(ctx, box(i - 0.02, j - 0.05, i + 0.05, j + 0.03), 8, 12, '#9cc9e8', { top: '#f5b700' });
  const a = up(G(i - 0.06, j), 7), e = up(G(i - 0.22, j - 0.1), 14), f = up(G(i - 0.3, j - 0.14), 6);
  line(ctx, a, e, '#e0a800', 2.2); line(ctx, e, f, '#e0a800', 2);
  ctx.fillStyle = '#555'; ctx.beginPath(); ctx.moveTo(f.x - 2, f.y); ctx.lineTo(f.x + 3, f.y + 2); ctx.lineTo(f.x + 1, f.y - 3); ctx.fill();
}

// ---------------------------------------------------------------------------
// Base do mapa (camadas de terra sob o tabuleiro)
// ---------------------------------------------------------------------------
export function mapBase(ctx, n) {
  const L = G(0, n), B = G(n, n), R = G(n, 0);
  const depth = 30;
  const dn = (p, d) => ({ x: p.x, y: p.y + d });
  // lip de grama
  poly(ctx, [L, B, dn(B, 5), dn(L, 5)], '#5fa846');
  poly(ctx, [B, R, dn(R, 5), dn(B, 5)], '#4f9439');
  // terra em camadas
  const layers = [['#8d5f3b', '#764e30'], ['#7a5134', '#634128'], ['#6a5848', '#574739']];
  const h = (depth - 5) / layers.length;
  layers.forEach(([cl, cr], k) => {
    const a = 5 + k * h, b = 5 + (k + 1) * h;
    poly(ctx, [dn(L, a), dn(B, a), dn(B, b), dn(L, b)], cl);
    poly(ctx, [dn(B, a), dn(R, a), dn(R, b), dn(B, b)], cr);
  });
  // pedrinhas na terra
  for (let k = 0; k < 40; k++) {
    const u = hash(k, 5), side = k % 2;
    const p = side ? lerp(L, B, u) : lerp(B, R, u);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(p.x, p.y + 8 + hash(5, k) * (depth - 12), 2, 1.2);
  }
  // sombra no "chão" abaixo da maquete
  ctx.fillStyle = 'rgba(30,60,80,0.12)';
  poly(ctx, [dn(L, depth + 6), dn(B, depth + 14), dn(R, depth + 6), dn(B, depth - 2)], 'rgba(30,60,80,0.1)');
}

export { cylinder };

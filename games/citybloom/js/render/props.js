// props.js — objetos de cena desenhados por código: árvores, arbustos, postes,
// bancos, cercas, entulho e carros (modernos e o abandonado).
// Coordenadas: i, j em unidades de tile (podem ser fracionárias).

import { G, up, box, prism, poly, tint, lerp, line, glassPane, faceQuad } from './kit.js';

// Pseudo-aleatório determinístico a partir de números (para variação estável).
export function hash(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function sphere(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  g.addColorStop(0, tint(color, 1.35));
  g.addColorStop(0.6, color);
  g.addColorStop(1, tint(color, 0.68));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function groundShadow(ctx, p, rx, ry, a = 0.22) {
  ctx.fillStyle = `rgba(20,40,20,${a})`;
  ctx.beginPath(); ctx.ellipse(p.x + rx * 0.25, p.y + ry * 0.2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
// Vegetação
// ---------------------------------------------------------------------------
export function tree(ctx, i, j, s = 1, variant = 0) {
  const p = G(i, j);
  groundShadow(ctx, p, 10 * s, 5 * s);
  if (variant === 1) {
    // pinheiro
    ctx.fillStyle = '#6b4426'; ctx.fillRect(p.x - 1.5 * s, p.y - 7 * s, 3 * s, 7 * s);
    const greens = ['#2f7d4a', '#3a9257', '#46a764'];
    for (let k = 0; k < 3; k++) {
      const y = p.y - (6 + k * 7) * s, w = (11 - k * 2.6) * s;
      ctx.fillStyle = greens[k];
      ctx.beginPath(); ctx.moveTo(p.x - w, y); ctx.lineTo(p.x, y - 12 * s); ctx.lineTo(p.x + w, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.moveTo(p.x, y - 12 * s); ctx.lineTo(p.x + w, y); ctx.lineTo(p.x, y); ctx.closePath(); ctx.fill();
    }
    return;
  }
  // copa arredondada em camadas
  const tg = ctx.createLinearGradient(p.x - 2 * s, 0, p.x + 2 * s, 0);
  tg.addColorStop(0, '#8a5a35'); tg.addColorStop(1, '#5e3b20');
  ctx.fillStyle = tg; ctx.fillRect(p.x - 1.8 * s, p.y - 11 * s, 3.6 * s, 11 * s);
  const base = variant === 2 ? '#6db34f' : '#4caf50';
  sphere(ctx, p.x - 5 * s, p.y - 15 * s, 7 * s, tint(base, 0.9));
  sphere(ctx, p.x + 5 * s, p.y - 16 * s, 7.5 * s, tint(base, 0.85));
  sphere(ctx, p.x, p.y - 21 * s, 8.5 * s, base);
}

export function bush(ctx, i, j, s = 1, flowers = true) {
  const p = G(i, j);
  groundShadow(ctx, p, 12 * s, 5 * s, 0.18);
  const parts = [[-7, -3, 6], [6, -2, 6.5], [-1, -8, 7], [2, 2, 5], [-6, 3, 4.5]];
  for (const [dx, dy, r] of parts) sphere(ctx, p.x + dx * s, p.y + dy * s, r * s, '#4e9a3c');
  if (flowers) {
    const cols = ['#ff6b8b', '#ffd166', '#ffffff', '#c084fc'];
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = cols[k % cols.length];
      ctx.beginPath(); ctx.arc(p.x + (hash(i * 10, j, k) - 0.5) * 18 * s, p.y - 2 * s + (hash(j, i * 7, k) - 0.6) * 12 * s, 1.3 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function flowerBed(ctx, b, colors = ['#ff6b8b', '#ffd166', '#ffffff']) {
  const q = [G(b.i0, b.j0), G(b.i1, b.j0), G(b.i1, b.j1), G(b.i0, b.j1)];
  poly(ctx, q, '#6b4a2e');
  for (let k = 0; k < 14; k++) {
    const u = hash(k, b.i0 * 31) , v = hash(b.j0 * 17, k);
    const p = G(b.i0 + (b.i1 - b.i0) * u, b.j0 + (b.j1 - b.j0) * v);
    sphere(ctx, p.x, p.y - 1.5, 2.2, '#5aa646');
    ctx.fillStyle = colors[k % colors.length];
    ctx.beginPath(); ctx.arc(p.x, p.y - 2.5, 1.1, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Mobiliário urbano
// ---------------------------------------------------------------------------
export function lamp(ctx, i, j, h = 22) {
  const p = G(i, j);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.5, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  line(ctx, p, up(p, h), '#4a525c', 1.6);
  line(ctx, up(p, h), { x: p.x + 4, y: p.y - h + 1 }, '#4a525c', 1.4);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.ellipse(p.x + 4.5, p.y - h + 2, 2.2, 1.2, 0, 0, Math.PI * 2); ctx.fill();
}

export function bench(ctx, i, j, axis = 'i') {
  const b = axis === 'i' ? box(i - 0.12, j - 0.04, i + 0.12, j + 0.04) : box(i - 0.04, j - 0.12, i + 0.04, j + 0.12);
  prism(ctx, b, 2, 3.5, '#a0673a', { top: '#c58a55' });
  const back = axis === 'i' ? box(i - 0.12, j - 0.05, i + 0.12, j - 0.03) : box(i - 0.05, j - 0.12, i - 0.03, j + 0.12);
  prism(ctx, back, 3.5, 7, '#8d5a31', { top: '#b07443' });
}

export function fence(ctx, a, b, h = 5, color = '#ffffff') {
  // a, b em unidades de tile: [i, j]
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 7));
  const A = G(a[0], a[1]), B = G(b[0], b[1]);
  line(ctx, up(A, h * 0.8), up(B, h * 0.8), tint(color, 0.85), 1);
  line(ctx, up(A, h * 0.4), up(B, h * 0.4), tint(color, 0.85), 1);
  for (let k = 0; k <= n; k++) { const p = lerp(A, B, k / n); line(ctx, p, up(p, h), color, 1.2); }
}

// ---------------------------------------------------------------------------
// Entulho
// ---------------------------------------------------------------------------
export function rubble(ctx, i, j) {
  const p = G(i + 0.5, j + 0.5);
  ctx.fillStyle = 'rgba(160,150,130,0.45)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 24, 11, 0, 0, Math.PI * 2); ctx.fill();
  const pieces = [
    [0.25, 0.3, 0.2, 0.14, 6, '#a7a39b'], [0.55, 0.2, 0.18, 0.2, 9, '#bdb8ae'],
    [0.4, 0.55, 0.22, 0.12, 5, '#9a958c'], [0.65, 0.55, 0.12, 0.12, 4, '#b5562e'],
    [0.2, 0.62, 0.12, 0.1, 3.5, '#c0663a'], [0.5, 0.42, 0.1, 0.08, 3, '#8d877d'],
  ];
  for (const [u, v, w, d, h, c] of pieces) prism(ctx, box(i + u, j + v, i + u + w, j + v + d), 0, h, c);
  // vergalhão saindo
  const q = G(i + 0.62, j + 0.3);
  line(ctx, up(q, 8), { x: q.x + 6, y: q.y - 16 }, '#7a4a2a', 1);
}

// ---------------------------------------------------------------------------
// Carros
// ---------------------------------------------------------------------------
export const CAR_COLORS = ['#e63946', '#f4f4f2', '#457b9d', '#1d3557', '#ffb703', '#2a9d8f', '#8d99ae', '#ef476f', '#6a4c93'];

// dir: 'i+', 'i-', 'j+', 'j-'. (ci, cj) = centro do carro.
export function car(ctx, ci, cj, dir, color, opts = {}) {
  const { rusty = false } = opts;
  const alongI = dir[0] === 'i';
  const fwd = dir[1] === '+';
  const L = 0.23, W = 0.115;
  const body = alongI ? box(ci - L, cj - W, ci + L, cj + W) : box(ci - W, cj - L, ci + W, cj + L);

  // sombra
  poly(ctx, [G(body.i0, body.j0), G(body.i1 + 0.05, body.j0 + 0.02), G(body.i1 + 0.05, body.j1 + 0.05), G(body.i0, body.j1 + 0.02)], 'rgba(0,0,0,0.22)');

  // rodas
  const wheels = alongI
    ? [[ci - L * 0.6, cj - W], [ci + L * 0.6, cj - W], [ci - L * 0.6, cj + W], [ci + L * 0.6, cj + W]]
    : [[ci - W, cj - L * 0.6], [ci - W, cj + L * 0.6], [ci + W, cj - L * 0.6], [ci + W, cj + L * 0.6]];
  wheels.forEach(([wi, wj], k) => {
    if (rusty && k === 3) return; // falta uma roda
    const c = up(G(wi, wj), 2.3);
    ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 2.5, 2.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rusty ? '#6d5a48' : '#b8bec6'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 1.1, 1, 0, 0, Math.PI * 2); ctx.fill();
  });

  const bodyColor = rusty ? '#a8603a' : color;
  prism(ctx, body, 2.4, 6.8, bodyColor, { top: tint(bodyColor, 1.15) });
  // faixa inferior (para-choque/saia)
  prism(ctx, body, 2.4, 3.4, tint(bodyColor, 0.6), { top: null });

  // cabine (deslocada para trás)
  const cb = alongI
    ? (fwd ? box(ci - L * 0.72, cj - W * 0.85, ci + L * 0.28, cj + W * 0.85) : box(ci - L * 0.28, cj - W * 0.85, ci + L * 0.72, cj + W * 0.85))
    : (fwd ? box(ci - W * 0.85, cj - L * 0.72, ci + W * 0.85, cj + L * 0.28) : box(ci - W * 0.85, cj - L * 0.28, ci + W * 0.85, cj + L * 0.72));
  const glass = rusty ? '#3d4a52' : '#9ccbea';
  prism(ctx, cb, 6.8, 10.6, glass, { top: tint(bodyColor, 1.05) });
  // colunas da cabine (dão leitura de janelas)
  for (const side of ['L', 'R']) {
    const q = faceQuad(cb, side, 0.46, 0.54, 6.8, 10.6);
    poly(ctx, q, tint(bodyColor, 0.85));
  }

  // faróis (frente) e lanternas (trás) na face visível da ponta
  const endSide = alongI ? 'R' : 'L';      // face que mostra a ponta do carro
  const frontVisible = fwd;                 // i+ e j+ apontam para a câmera
  const lightColor = frontVisible ? '#fff7d1' : '#ff3b3b';
  for (const u of [0.18, 0.82]) {
    poly(ctx, faceQuad(body, endSide, u - 0.09, u + 0.09, 4.4, 5.9), rusty ? '#5b4636' : lightColor);
  }
  if (frontVisible && !rusty) poly(ctx, faceQuad(body, endSide, 0.35, 0.65, 3.6, 4.6), '#2b2f36'); // grade

  if (rusty) {
    ctx.fillStyle = 'rgba(110, 55, 20, 0.55)';
    const s = faceQuad(body, alongI ? 'L' : 'R', 0.3, 0.55, 3, 6);
    poly(ctx, s, 'rgba(110,55,20,0.55)');
    // mato crescendo em volta
    for (let k = 0; k < 5; k++) {
      const p = G(ci + (hash(k, 3) - 0.5) * 0.6, cj + (hash(7, k) - 0.5) * 0.6);
      ctx.fillStyle = '#5e9e3e';
      ctx.beginPath(); ctx.moveTo(p.x - 2, p.y); ctx.lineTo(p.x, p.y - 6); ctx.lineTo(p.x + 2, p.y); ctx.fill();
    }
  }
}

// Carro abandonado (obstáculo) centrado no tile.
export function abandonedCar(ctx, i, j) {
  car(ctx, i + 0.5, j + 0.48, 'j+', '#a8603a', { rusty: true });
}

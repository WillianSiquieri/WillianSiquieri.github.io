// buildings.js — o desenho de cada construção (estilo moderno, 100% código).
// Cada pintor desenha o objeto com o canto de fundo em (0,0) da grade.
// PAINT[type](ctx)        → parte estática (vai para o cache de sprites)
// ANIM[type](ctx, t)      → partes animadas (desenhadas a cada quadro)
// HEIGHT[type]            → altura aproximada (px) para toque e recorte

import {
  G, up, box, lerp, line, poly, tint, prism, band, shadow, windows, glassBands, curtainWall,
  glassPane, faceQuad, facePt, topQuad, door, canopy, awning, balcony, cladding, brickLines,
  gableRoof, flatRoof, acUnit, waterTank, solarPanels, cylinder, signBoard, groundQuad, roundRect,
} from './kit.js';
import { tree, bush, flowerBed, lamp, bench, fence, car } from './props.js';

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------
function smoke(ctx, p, t, scale = 1) {
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.45 + k / 4) % 1;
    ctx.fillStyle = `rgba(235,238,240,${0.6 * (1 - ph)})`;
    ctx.beginPath();
    ctx.arc(p.x + ph * 10 * scale + Math.sin(ph * 6 + k) * 2, p.y - ph * 26 * scale, (3 + ph * 6) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function flag(ctx, base, h, t, color = '#2ecc71') {
  line(ctx, base, up(base, h), '#5c636b', 1.4);
  const top = up(base, h);
  const w = Math.sin(t * 4) * 1.8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y + 1);
  ctx.quadraticCurveTo(top.x + 7, top.y - 1 + w, top.x + 14, top.y + 2 + w * 0.5);
  ctx.lineTo(top.x + 14, top.y + 9 + w * 0.5);
  ctx.quadraticCurveTo(top.x + 7, top.y + 7 + w, top.x, top.y + 8);
  ctx.closePath(); ctx.fill();
}

function logPile(ctx, i, j) {
  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < 3 - r; k++) {
      const a = up(G(i + 0.02, j + k * 0.06 + r * 0.03), 2.5 + r * 4.5);
      const b = up(G(i + 0.22, j + k * 0.06 + r * 0.03), 2.5 + r * 4.5);
      line(ctx, a, b, '#7a4a26', 5);
      ctx.fillStyle = '#e0b07a'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 2.4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a67444'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(b.x, b.y, 1.2, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function crate(ctx, i, j, s = 0.1, h = 5, color = '#c49a6c') {
  prism(ctx, box(i, j, i + s, j + s), 0, h, color);
  line(ctx, facePt(box(i, j, i + s, j + s), 'L', 0, h / 2), facePt(box(i, j, i + s, j + s), 'L', 1, h / 2), 'rgba(0,0,0,0.2)', 0.6);
}

function sawtooth(ctx, b, z, teeth, color, glass = '#a9d4f2') {
  const w = (b.i1 - b.i0) / teeth;
  for (let k = 0; k < teeth; k++) {
    const tb = box(b.i0 + k * w, b.j0, b.i0 + (k + 1) * w, b.j1);
    // dente: água inclinada + face vertical de vidro voltada para +i
    const A = up(G(tb.i0, tb.j0), z), B = up(G(tb.i0, tb.j1), z);
    const C = up(G(tb.i1, tb.j1), z + 9), D = up(G(tb.i1, tb.j0), z + 9);
    poly(ctx, [A, B, C, D], tint(color, k % 2 ? 1.0 : 1.06));
    const E = up(G(tb.i1, tb.j1), z), F = up(G(tb.i1, tb.j0), z);
    poly(ctx, [E, F, D, C], glass, 'rgba(255,255,255,0.6)', 0.6);
  }
}

function paving(ctx, b, color = '#e4ddd0', grid = 6) {
  groundQuad(ctx, b, color);
  for (let k = 1; k < grid; k++) {
    const u = k / grid;
    line(ctx, G(b.i0 + (b.i1 - b.i0) * u, b.j0), G(b.i0 + (b.i1 - b.i0) * u, b.j1), 'rgba(0,0,0,0.06)', 0.6);
    line(ctx, G(b.i0, b.j0 + (b.j1 - b.j0) * u), G(b.i1, b.j0 + (b.j1 - b.j0) * u), 'rgba(0,0,0,0.06)', 0.6);
  }
}

function redCross(ctx, c, s = 1) {
  ctx.fillStyle = '#ffffff'; roundRect(ctx, c.x - 9 * s, c.y - 9 * s, 18 * s, 18 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#e53935';
  ctx.fillRect(c.x - 2.5 * s, c.y - 7 * s, 5 * s, 14 * s);
  ctx.fillRect(c.x - 7 * s, c.y - 2.5 * s, 14 * s, 5 * s);
}

function helipad(ctx, c, r = 12) {
  ctx.fillStyle = '#3d444c'; ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r / 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(c.x, c.y, r * 0.8, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(r * 0.7)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.55); ctx.fillText('H', 0, 0); ctx.restore();
}

// ---------------------------------------------------------------------------
// Casas (7 níveis)
// ---------------------------------------------------------------------------
function house1(ctx) {
  const b = box(0.24, 0.24, 0.74, 0.72);
  shadow(ctx, b, 28);
  prism(ctx, box(0.2, 0.72, 0.78, 0.9), 0, 1.6, '#a77a4c', { top: '#c49563' });       // deck
  prism(ctx, b, 0, 16, '#c98d58');
  cladding(ctx, b, 'L', 0, 16, 7); cladding(ctx, b, 'R', 0, 16, 7);
  glassPane(ctx, faceQuad(b, 'R', 0.12, 0.72, 4, 13.5), { frame: '#3b3f46', glass: '#8cc4ec' });
  glassPane(ctx, faceQuad(b, 'L', 0.12, 0.42, 6, 13), { frame: '#3b3f46' });
  door(ctx, b, 'L', 0.68, 0.22, 11.5, '#3b3f46');
  gableRoof(ctx, b, 16, 12, '#3d434c', 'j', '#c98d58');
  prism(ctx, box(0.3, 0.34, 0.37, 0.41), 21, 29, '#5a5f66', { top: '#3e4248' });
  bush(ctx, 0.88, 0.42, 0.45);
  lamp(ctx, 0.12, 0.88, 13);
}

function house2(ctx) {
  groundQuad(ctx, box(0.04, 0.04, 0.96, 0.96), '#93d46f');
  const b = box(0.16, 0.14, 0.78, 0.68);
  shadow(ctx, b, 32);
  groundQuad(ctx, box(0.42, 0.68, 0.58, 0.96), '#d9d0c1');                                 // caminho
  flowerBed(ctx, box(0.08, 0.72, 0.36, 0.9));
  prism(ctx, b, 0, 18, '#f4f0e7');
  band(ctx, b, 0, 2, '#c9c2b4');
  glassPane(ctx, faceQuad(b, 'L', 0.07, 0.32, 4.5, 14), { frame: '#ffffff', glass: '#79b4e0' });
  glassPane(ctx, faceQuad(b, 'L', 0.68, 0.93, 4.5, 14), { frame: '#ffffff', glass: '#79b4e0' });
  door(ctx, b, 'L', 0.5, 0.16, 12, '#2f6f8e');
  canopy(ctx, b, 'L', 0.38, 0.62, 13.5, 0.07, '#ffffff');
  windows(ctx, b, 'R', { z0: 2, z1: 17, rows: 1, cols: 2, frame: '#ffffff', glass: '#79b4e0', seed: 3 });
  gableRoof(ctx, b, 18, 14, '#c8553d', 'i', '#f4f0e7');
  tree(ctx, 0.86, 0.22, 0.6, 2);
  fence(ctx, [0.04, 0.96], [0.4, 0.96], 5); fence(ctx, [0.6, 0.96], [0.96, 0.96], 5); fence(ctx, [0.96, 0.04], [0.96, 0.96], 5);
}

function house3(ctx) {
  const g = box(0.14, 0.16, 0.82, 0.8), u = box(0.14, 0.16, 0.9, 0.8);
  shadow(ctx, u, 38);
  prism(ctx, g, 0, 15, '#f2f1ee');
  band(ctx, g, 0, 1.5, '#b9b6af');
  glassPane(ctx, faceQuad(g, 'L', 0.18, 0.78, 1.5, 12.5), { frame: '#30353c', glass: '#86c0e8' });
  const gd = faceQuad(g, 'R', 0.12, 0.62, 0, 10);
  poly(ctx, gd, '#a3abb4');
  for (let k = 1; k < 5; k++) line(ctx, facePt(g, 'R', 0.12, k * 2), facePt(g, 'R', 0.62, k * 2), 'rgba(0,0,0,0.15)', 0.6);
  prism(ctx, u, 15, 30, '#b9793f');
  cladding(ctx, u, 'L', 15, 30, 9); cladding(ctx, u, 'R', 15, 30, 9);
  glassPane(ctx, faceQuad(u, 'R', 0.15, 0.85, 17.5, 28), { frame: '#30353c', glass: '#86c0e8' });
  glassPane(ctx, faceQuad(u, 'L', 0.08, 0.42, 18, 28), { frame: '#30353c' });
  balcony(ctx, u, 'L', 0.5, 0.96, 15, 0.13);
  const top = flatRoof(ctx, u, 30, '#d3d6da', '#f4f4f4');
  solarPanels(ctx, box(u.i0 + 0.12, u.j0 + 0.08, u.i1 - 0.14, u.j0 + 0.4), top);
  bush(ctx, 0.93, 0.92, 0.4);
}

function house4(ctx) {
  // deck e piscina
  const deck = box(0.06, 0.54, 0.96, 0.96);
  prism(ctx, deck, 0, 1.2, '#c9a77c', { top: '#d8b98f' });
  for (let k = 1; k < 9; k++) line(ctx, up(G(deck.i0 + (deck.i1 - deck.i0) * k / 9, deck.j0), 1.2), up(G(deck.i0 + (deck.i1 - deck.i0) * k / 9, deck.j1), 1.2), 'rgba(90,60,30,0.2)', 0.5);
  const pool = box(0.14, 0.62, 0.8, 0.9);
  poly(ctx, topQuad(pool, 1.2), '#f2f4f5');
  const wq = topQuad(box(0.17, 0.645, 0.77, 0.875), 1.2);
  const wg = ctx.createLinearGradient(wq[0].x, wq[0].y, wq[2].x, wq[2].y);
  wg.addColorStop(0, '#7fdcf5'); wg.addColorStop(1, '#2aa7d6');
  poly(ctx, wq, wg);
  for (const [a, c] of [[0.28, 0.72], [0.52, 0.8]]) line(ctx, up(G(a, c), 1.3), up(G(a + 0.12, c + 0.02), 1.3), 'rgba(255,255,255,0.65)', 1);
  for (const jj of [0.6, 0.76]) prism(ctx, box(0.84, jj, 0.94, jj + 0.1), 1.2, 3.2, '#ffffff', { top: '#f4f4f4' });   // espreguiçadeiras
  // casa
  const m = box(0.1, 0.1, 0.68, 0.52), up2 = box(0.1, 0.1, 0.5, 0.38);
  shadow(ctx, m, 32);
  prism(ctx, m, 0, 16, '#fbfbf9');
  glassPane(ctx, faceQuad(m, 'L', 0.06, 0.94, 1.2, 14), { frame: '#2b2f35', glass: '#8ec7ee' });
  glassPane(ctx, faceQuad(m, 'R', 0.1, 0.55, 3, 13), { frame: '#2b2f35' });
  flatRoof(ctx, m, 16, '#d8dbdf', '#ffffff', 1.5);
  prism(ctx, up2, 17.5, 29, '#a9764a');
  cladding(ctx, up2, 'L', 17.5, 29, 8); cladding(ctx, up2, 'R', 17.5, 29, 8);
  glassPane(ctx, faceQuad(up2, 'R', 0.12, 0.88, 19.5, 27), { frame: '#2b2f35' });
  flatRoof(ctx, up2, 29, '#d8dbdf', '#ffffff', 1.5);
  tree(ctx, 0.88, 0.2, 0.75, 1);
}

function house5(ctx) {
  const b = box(0.12, 0.12, 0.88, 0.88), H = 56;
  shadow(ctx, b, H);
  prism(ctx, b, 0, H, '#ebe5da');
  // térreo com vitrine
  glassBands(ctx, b, 'L', { z0: 0, z1: 9, floors: 1, glass: '#5f8fb5', cols: 5 });
  glassBands(ctx, b, 'R', { z0: 0, z1: 9, floors: 1, glass: '#5f8fb5', cols: 5 });
  band(ctx, b, 9, 10.5, '#c9c1b2');
  windows(ctx, b, 'L', { z0: 10.5, z1: H - 1, rows: 4, cols: 3, frame: '#ffffff', glass: '#79aed8', seed: 1 });
  windows(ctx, b, 'R', { z0: 10.5, z1: H - 1, rows: 4, cols: 3, frame: '#ffffff', glass: '#79aed8', seed: 4 });
  for (let k = 0; k < 4; k++) balcony(ctx, b, 'L', 0.06, 0.94, 10.5 + k * 11.4, 0.09);
  canopy(ctx, b, 'R', 0.35, 0.65, 8.5, 0.08, '#3a4048');
  const top = flatRoof(ctx, b, H, '#c9ced4', '#f1eee8');
  acUnit(ctx, 0.25, 0.25, top); acUnit(ctx, 0.45, 0.22, top);
  waterTank(ctx, 0.7, 0.45, top);
}

function house6(ctx) {
  const b = box(0.16, 0.16, 0.84, 0.84), H = 100;
  shadow(ctx, b, H);
  prism(ctx, b, 0, H, '#dfe3e8');
  glassBands(ctx, b, 'L', { z0: 7, z1: H - 4, floors: 8, glass: '#5b97c9', cols: 4 });
  glassBands(ctx, b, 'R', { z0: 7, z1: H - 4, floors: 8, glass: '#5b97c9', cols: 4 });
  poly(ctx, faceQuad(b, 'L', 0, 0.07, 0, H), '#9aa6b4');                                   // pilar de cor
  glassBands(ctx, b, 'L', { z0: 0, z1: 7, floors: 1, glass: '#3e6f99', cols: 3 });
  band(ctx, b, H - 4, H, '#8e9aa8', 0.01);
  const top = flatRoof(ctx, b, H, '#c3c9d0', '#8e9aa8', 1.5);
  acUnit(ctx, 0.3, 0.3, top); acUnit(ctx, 0.5, 0.28, top); acUnit(ctx, 0.3, 0.55, top);
}

function house7(ctx) {
  const pod = box(0.06, 0.06, 0.94, 0.94), tw = box(0.18, 0.18, 0.82, 0.82), sb = box(0.28, 0.28, 0.72, 0.72);
  shadow(ctx, tw, 140, 0.22);
  prism(ctx, pod, 0, 14, '#e5e7ea');
  glassBands(ctx, pod, 'L', { z0: 0, z1: 12, floors: 1, glass: '#3f78a8', cols: 6 });
  glassBands(ctx, pod, 'R', { z0: 0, z1: 12, floors: 1, glass: '#3f78a8', cols: 6 });
  flatRoof(ctx, pod, 14, '#cbd2d9', '#e5e7ea', 1.2);
  prism(ctx, tw, 15, 124, '#4f8fc6', { top: null });
  curtainWall(ctx, tw, 'L', 15, 124, '#5a9ad0', 14, 5);
  curtainWall(ctx, tw, 'R', 15, 124, '#5a9ad0', 14, 5);
  band(ctx, tw, 122, 125, '#d9dee4');
  poly(ctx, topQuad(tw, 125), '#c3cad2');
  prism(ctx, sb, 125, 142, '#5a9ad0', { top: null });
  curtainWall(ctx, sb, 'L', 125, 142, '#6aa6d8', 2, 3);
  curtainWall(ctx, sb, 'R', 125, 142, '#6aa6d8', 2, 3);
  poly(ctx, topQuad(sb, 142), '#d0d5db');
  helipad(ctx, up(G(0.5, 0.5), 142), 9);
}

// ---------------------------------------------------------------------------
// Especiais
// ---------------------------------------------------------------------------
function townhall(ctx) {
  paving(ctx, box(0.04, 0.04, 1.96, 1.96), '#e8e2d6', 10);
  const m = box(0.3, 0.25, 1.7, 1.45);
  shadow(ctx, m, 46);
  tree(ctx, 0.14, 0.2, 0.7, 2); tree(ctx, 1.86, 0.22, 0.7, 2);
  prism(ctx, m, 0, 30, '#f4f0e8');
  band(ctx, m, 0, 3, '#d8d1c3');
  windows(ctx, m, 'R', { z0: 3, z1: 29, rows: 2, cols: 4, frame: '#ffffff', glass: '#7fb2da', seed: 2 });
  windows(ctx, m, 'L', { z0: 3, z1: 29, rows: 2, cols: 6, frame: '#ffffff', glass: '#7fb2da', seed: 7 });
  const top = flatRoof(ctx, m, 30, '#cfd3d8', '#efe9df', 2.5);
  // átrio de vidro no topo
  const at = box(0.78, 0.55, 1.22, 1.0);
  prism(ctx, at, top, top + 14, '#7fb8e0', { top: null });
  curtainWall(ctx, at, 'L', top, top + 14, '#8cc4ec', 2, 4);
  curtainWall(ctx, at, 'R', top, top + 14, '#8cc4ec', 2, 4);
  poly(ctx, topQuad(at, top + 14), '#e7ebef');
  // pórtico com colunas e escadaria na frente (face L)
  prism(ctx, box(0.62, 1.45, 1.38, 1.75), 0, 1.5, '#e2dccf', { top: '#efe9de' });
  prism(ctx, box(0.66, 1.45, 1.34, 1.68), 1.5, 3, '#e2dccf', { top: '#f3eee4' });
  for (let k = 0; k < 5; k++) {
    const ci = 0.7 + k * 0.145;
    prism(ctx, box(ci, 1.52, ci + 0.045, 1.57), 3, 26, '#ffffff', { top: '#ffffff' });
  }
  prism(ctx, box(0.64, 1.45, 1.36, 1.62), 26, 30, '#efe9de', { top: '#f8f5ef' });
  // relógio no átrio
  const cl = up(G(1.0, 1.0), top + 20);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3b4350'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cl.x, cl.y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  line(ctx, cl, { x: cl.x, y: cl.y - 3.5 }, '#3b4350', 1); line(ctx, cl, { x: cl.x + 2.8, y: cl.y }, '#3b4350', 1);
  lamp(ctx, 0.5, 1.85, 18); lamp(ctx, 1.85, 1.5, 18);
  bench(ctx, 1.6, 1.85);
}

function warehouse(ctx) {
  const b = box(0.1, 0.14, 0.9, 0.86);
  shadow(ctx, b, 30);
  prism(ctx, b, 0, 20, '#7f93a8');
  for (const s of ['L', 'R']) for (let k = 1; k < 16; k++) line(ctx, facePt(b, s, k / 16, 0), facePt(b, s, k / 16, 20), 'rgba(255,255,255,0.14)', 0.6);
  const d = faceQuad(b, 'L', 0.28, 0.72, 0, 14);
  poly(ctx, d, '#cfd6dd');
  for (let k = 1; k < 7; k++) line(ctx, facePt(b, 'L', 0.28, k * 2), facePt(b, 'L', 0.72, k * 2), 'rgba(0,0,0,0.13)', 0.6);
  glassPane(ctx, faceQuad(b, 'R', 0.2, 0.8, 13, 17), { frame: '#60748a', glass: '#a9d0ee' });
  gableRoof(ctx, b, 20, 7, '#5b6d80', 'i', '#7f93a8', 0.04);
  signBoard(ctx, facePt(b, 'L', 0.5, 19.5), '📦', '#2e7dff', '#fff', 16, 9);
  crate(ctx, 0.12, 0.88); crate(ctx, 0.24, 0.88, 0.1, 5, '#b8895b'); crate(ctx, 0.17, 0.86, 0.09, 4, '#d4a978');
}

// ---------------------------------------------------------------------------
// Fábricas
// ---------------------------------------------------------------------------
function sawmill(ctx) {
  groundQuad(ctx, box(0.04, 0.04, 0.96, 0.96), '#d7c29b');
  const b = box(0.12, 0.12, 0.7, 0.66);
  shadow(ctx, b, 30);
  prism(ctx, b, 0, 17, '#a4532f');
  cladding(ctx, b, 'L', 0, 17, 10); cladding(ctx, b, 'R', 0, 17, 10);
  const d = faceQuad(b, 'L', 0.3, 0.72, 0, 13);
  poly(ctx, d, '#3a2a20');
  poly(ctx, faceQuad(b, 'L', 0.33, 0.69, 0, 11.5), '#5a4030');
  sawtooth(ctx, b, 17, 3, '#6b3a1e');
  logPile(ctx, 0.72, 0.68);
  signBoard(ctx, up(G(0.7, 0.66), 31), '🪚', '#a4532f', '#fff', 16, 10);
}

function kiln(ctx) {
  const b = box(0.12, 0.2, 0.66, 0.82);
  shadow(ctx, b, 40);
  prism(ctx, b, 0, 18, '#b5562e');
  brickLines(ctx, b, 'L', 0, 18); brickLines(ctx, b, 'R', 0, 18);
  door(ctx, b, 'L', 0.5, 0.26, 12, '#4a2c1c', false);
  glassPane(ctx, faceQuad(b, 'R', 0.2, 0.75, 8, 14), { frame: '#4a2c1c', glass: '#ffb36b', lit: true });
  const top = flatRoof(ctx, b, 18, '#8a8f95', '#c46a40', 2);
  cylinder(ctx, up(G(0.3, 0.4), top), 4.5, 26, '#9c4a2a', '#5a2a18');
  // forno abobadado com boca acesa
  const c = G(0.82, 0.4);
  const g = ctx.createRadialGradient(c.x - 4, c.y - 12, 2, c.x, c.y - 4, 16);
  g.addColorStop(0, '#d9774a'); g.addColorStop(1, '#8f3f1f');
  // base (meia elipse de baixo) + cúpula voltando por cima até o lado direito
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, c.y, 13, 6.5, 0, 0, Math.PI); ctx.quadraticCurveTo(c.x, c.y - 30, c.x + 13, c.y); ctx.fill();
  const og = ctx.createRadialGradient(c.x - 2, c.y - 2, 0.5, c.x - 2, c.y - 2, 5);
  og.addColorStop(0, '#fff2a8'); og.addColorStop(1, '#ff6a00');
  ctx.fillStyle = og; ctx.beginPath(); ctx.ellipse(c.x - 3, c.y - 1, 4, 4.5, 0, Math.PI, 0); ctx.fill();
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) crate(ctx, 0.7 + k * 0.08, 0.84 + r * 0.0, 0.07, 3 + r * 3, '#c0663a');
  signBoard(ctx, up(G(0.66, 0.82), 30), '🧱', '#b5562e', '#fff', 16, 10);
}

function glassworks(ctx) {
  const b = box(0.12, 0.16, 0.66, 0.84);
  shadow(ctx, b, 38);
  prism(ctx, b, 0, 22, '#eef2f3');
  glassBands(ctx, b, 'L', { z0: 1, z1: 21, floors: 2, glass: '#4fb0b8', cols: 5 });
  glassBands(ctx, b, 'R', { z0: 1, z1: 21, floors: 2, glass: '#4fb0b8', cols: 5 });
  const top = flatRoof(ctx, b, 22, '#c9cfd3', '#dfe5e8');
  cylinder(ctx, up(G(0.3, 0.32), top), 3.5, 18, '#8d969e', '#5f676e');
  cylinder(ctx, G(0.84, 0.26), 7, 30, '#dfe3e6', '#c5cbd0');
  cylinder(ctx, G(0.84, 0.62), 7, 30, '#dfe3e6', '#c5cbd0');
  line(ctx, up(G(0.84, 0.26), 30), up(G(0.6, 0.3), 22), '#8d969e', 1.5);
  signBoard(ctx, up(G(0.66, 0.84), 34), '🪟', '#2a9d8f', '#fff', 16, 10);
}

function carpentry(ctx) {
  groundQuad(ctx, box(0.04, 0.04, 0.96, 0.96), '#dcc9a3');
  const b = box(0.14, 0.12, 0.78, 0.72);
  shadow(ctx, b, 30);
  prism(ctx, b, 0, 16, '#c99c63');
  cladding(ctx, b, 'L', 0, 16, 10); cladding(ctx, b, 'R', 0, 16, 10);
  poly(ctx, faceQuad(b, 'L', 0.25, 0.75, 0, 12), '#4a3524');
  prism(ctx, box(0.4, 0.66, 0.6, 0.72), 0, 5, '#a8784a', { top: '#c69866' });           // bancada
  glassPane(ctx, faceQuad(b, 'R', 0.2, 0.8, 7, 13), { frame: '#5c3f27' });
  gableRoof(ctx, b, 16, 12, '#6b4a2e', 'i', '#c99c63');
  for (let k = 0; k < 4; k++) prism(ctx, box(0.58, 0.8, 0.94, 0.9), k * 1.6, k * 1.6 + 1.4, k % 2 ? '#e2bf88' : '#d6b077');
  signBoard(ctx, up(G(0.78, 0.72), 33), '🛋️', '#8a5a2b', '#fff', 16, 10);
}

function steelworks(ctx) {
  groundQuad(ctx, box(0.04, 0.04, 0.96, 0.96), '#a9abae');
  const b = box(0.1, 0.12, 0.76, 0.8);
  shadow(ctx, b, 44);
  prism(ctx, b, 0, 25, '#5b626b');
  for (const s of ['L', 'R']) for (let k = 1; k < 14; k++) line(ctx, facePt(b, s, k / 14, 0), facePt(b, s, k / 14, 25), 'rgba(255,255,255,0.08)', 0.6);
  const gq = faceQuad(b, 'L', 0.12, 0.45, 4, 15);
  const gg = ctx.createLinearGradient(0, gq[2].y, 0, gq[0].y);
  gg.addColorStop(0, '#ffcf6b'); gg.addColorStop(1, '#ff6a00');
  poly(ctx, gq, gg);
  poly(ctx, faceQuad(b, 'L', 0.58, 0.9, 0, 14), '#3c4249');
  sawtooth(ctx, b, 25, 3, '#3e444b', '#9fc5df');
  for (const ci of [0.22, 0.42]) {
    cylinder(ctx, up(G(ci, 0.22), 25), 4, 30, '#80858c', '#4e5359');
    const tb = up(G(ci, 0.22), 25 + 24);
    ctx.fillStyle = '#d64933'; ctx.fillRect(tb.x - 4, tb.y - 3, 8, 3);
  }
  // guindaste
  const cb = G(0.88, 0.86);
  line(ctx, cb, up(cb, 40), '#f5b700', 2.2);
  line(ctx, up(cb, 40), { x: cb.x - 26, y: cb.y - 52 }, '#f5b700', 2);
  line(ctx, { x: cb.x - 22, y: cb.y - 50 }, { x: cb.x - 22, y: cb.y - 34 }, '#333', 0.8);
  signBoard(ctx, up(G(0.76, 0.8), 38), '🔩', '#3e444b', '#fff', 16, 10);
}

// ---------------------------------------------------------------------------
// Comércio
// ---------------------------------------------------------------------------
function shop(ctx, o) {
  const { wall, accent, icon, floors = 1 } = o;
  const b = box(0.12, 0.14, 0.86, 0.8), H = 6 + floors * 14;
  shadow(ctx, b, H + 10);
  paving(ctx, box(0.04, 0.8, 0.96, 0.96), '#e6e0d5', 4);
  prism(ctx, b, 0, H, wall);
  glassPane(ctx, faceQuad(b, 'L', 0.05, 0.62, 1, 12), { frame: '#2f343b', glass: '#9fd0f0' });
  door(ctx, b, 'L', 0.79, 0.2, 12, '#2f343b');
  glassPane(ctx, faceQuad(b, 'R', 0.1, 0.6, 1, 12), { frame: '#2f343b', glass: '#9fd0f0' });
  awning(ctx, b, 'L', 0.03, 0.97, 13, 0.12, accent);
  if (floors > 1) windows(ctx, b, 'L', { z0: 15, z1: H, rows: floors - 1, cols: 3, frame: '#ffffff', glass: '#86b9de', seed: 5 });
  if (floors > 1) windows(ctx, b, 'R', { z0: 15, z1: H, rows: floors - 1, cols: 3, frame: '#ffffff', glass: '#86b9de', seed: 2 });
  flatRoof(ctx, b, H, '#cfd3d8', tint(accent, 1.4), 2.5);
  signBoard(ctx, up(G(0.5, 0.82), H + 13), icon, accent, '#fff', 24, 13);
  bush(ctx, 0.08, 0.9, 0.32);
}

const bakery = (ctx) => shop(ctx, { wall: '#fbe3c9', accent: '#e76f51', icon: '🥐' });
const market = (ctx) => shop(ctx, { wall: '#e6f4dd', accent: '#2e9e4f', icon: '🛒' });
const clothes = (ctx) => shop(ctx, { wall: '#fde6f0', accent: '#d63384', icon: '👗', floors: 2 });

function mall(ctx) {
  paving(ctx, box(0.04, 0.04, 1.96, 1.96), '#e6e0d5', 10);
  const b = box(0.15, 0.15, 1.85, 1.6);
  shadow(ctx, b, 50);
  prism(ctx, b, 0, 34, '#efeaf7');
  glassBands(ctx, b, 'L', { z0: 1, z1: 33, floors: 2, glass: '#7aa6d6', cols: 10 });
  glassBands(ctx, b, 'R', { z0: 1, z1: 33, floors: 2, glass: '#7aa6d6', cols: 8 });
  awning(ctx, b, 'L', 0.05, 0.95, 16.5, 0.08, '#7b5cd6', 16);
  const top = flatRoof(ctx, b, 34, '#cfd3d8', '#d9cff0');
  const at = box(0.7, 0.6, 1.3, 1.15);
  prism(ctx, at, top, top + 14, '#8fbfe8', { top: null });
  curtainWall(ctx, at, 'L', top, top + 14, '#9ccaf0', 2, 5);
  curtainWall(ctx, at, 'R', top, top + 14, '#9ccaf0', 2, 5);
  poly(ctx, topQuad(at, top + 14), '#eef1f4');
  signBoard(ctx, up(G(1.0, 1.6), 44), '🛍️', '#7b5cd6', '#fff', 30, 16);
  car(ctx, 0.45, 1.8, 'i+', '#e63946'); car(ctx, 1.05, 1.8, 'i-', '#f4f4f2'); car(ctx, 1.6, 1.8, 'i+', '#457b9d');
  tree(ctx, 1.9, 0.3, 0.7, 2);
}

// ---------------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------------
function school(ctx) {
  const b = box(0.1, 0.16, 0.7, 0.84);
  shadow(ctx, b, 40);
  const court = box(0.72, 0.18, 0.97, 0.84);
  groundQuad(ctx, court, '#3fa66b');
  poly(ctx, topQuad(box(0.76, 0.24, 0.93, 0.78), 0.1), null, 'rgba(255,255,255,0.8)', 0.8);
  line(ctx, G(0.76, 0.51), G(0.93, 0.51), 'rgba(255,255,255,0.8)', 0.8);
  prism(ctx, b, 0, 28, '#f6d55c');
  band(ctx, b, 13.5, 15, '#ffffff');
  windows(ctx, b, 'L', { z0: 1, z1: 13.5, rows: 1, cols: 4, frame: '#ffffff', glass: '#7fb2da', seed: 3 });
  windows(ctx, b, 'L', { z0: 15, z1: 28, rows: 1, cols: 4, frame: '#ffffff', glass: '#7fb2da', seed: 1 });
  windows(ctx, b, 'R', { z0: 1, z1: 28, rows: 2, cols: 2, frame: '#ffffff', glass: '#7fb2da', seed: 4 });
  gableRoof(ctx, b, 28, 11, '#d9534f', 'i', '#f6d55c');
  signBoard(ctx, up(G(0.4, 0.86), 22), '🏫', '#d9534f', '#fff', 18, 11);
}

function clinic(ctx) {
  const b = box(0.12, 0.14, 0.86, 0.82);
  shadow(ctx, b, 30);
  prism(ctx, b, 0, 22, '#ffffff');
  band(ctx, b, 17, 19.5, '#1fb5a3');
  windows(ctx, b, 'R', { z0: 2, z1: 16, rows: 1, cols: 3, frame: '#e8eef0', glass: '#8ec5e8', seed: 6 });
  glassPane(ctx, faceQuad(b, 'L', 0.06, 0.4, 2, 15), { frame: '#d8e0e3', glass: '#8ec5e8' });
  door(ctx, b, 'L', 0.68, 0.3, 13, '#1fb5a3');
  canopy(ctx, b, 'L', 0.48, 0.9, 15, 0.12, '#1fb5a3');
  flatRoof(ctx, b, 22, '#d5dbe0', '#f3f6f8');
  redCross(ctx, up(G(0.5, 0.5), 34), 0.8);
  car(ctx, 0.92, 0.5, 'j+', '#ffffff');
}

function firehouse(ctx) {
  const b = box(0.1, 0.14, 0.82, 0.86);
  shadow(ctx, b, 44);
  prism(ctx, b, 0, 24, '#d64933');
  brickLines(ctx, b, 'L', 0, 24); brickLines(ctx, b, 'R', 0, 24);
  for (const [u0, u1] of [[0.07, 0.46], [0.54, 0.93]]) {
    poly(ctx, faceQuad(b, 'L', u0, u1, 0, 15), '#f1f1f1');
    for (let k = 1; k < 6; k++) line(ctx, facePt(b, 'L', u0, k * 2.5), facePt(b, 'L', u1, k * 2.5), 'rgba(0,0,0,0.12)', 0.6);
    glassPane(ctx, faceQuad(b, 'L', u0 + 0.04, u1 - 0.04, 11, 14), { frame: '#f1f1f1', glass: '#86b9de' });
  }
  band(ctx, b, 15, 16.5, '#ffffff');
  windows(ctx, b, 'R', { z0: 1, z1: 23, rows: 2, cols: 3, frame: '#ffffff', glass: '#86b9de', seed: 2 });
  flatRoof(ctx, b, 24, '#a8aeb5', '#e2e2e2');
  const tw = box(0.6, 0.14, 0.82, 0.36);
  prism(ctx, tw, 26, 44, '#c43d29');
  windows(ctx, tw, 'L', { z0: 34, z1: 43, rows: 1, cols: 1, frame: '#ffffff', glass: '#86b9de' });
  flatRoof(ctx, tw, 44, '#a8aeb5', '#e2e2e2', 1.5);
  signBoard(ctx, up(G(0.46, 0.86), 30), '🚒', '#d64933', '#fff', 18, 11);
}

function hospital(ctx) {
  paving(ctx, box(0.04, 0.04, 1.96, 1.96), '#e8e6e1', 8);
  const b = box(0.15, 0.2, 1.8, 1.7), H = 54;
  shadow(ctx, b, 66);
  prism(ctx, b, 0, H, '#f7f9fb');
  for (let k = 1; k < 4; k++) band(ctx, b, 6 + k * 12 - 1, 6 + k * 12, '#9fd8d0');
  glassBands(ctx, b, 'L', { z0: 0, z1: 6, floors: 1, glass: '#5f9fca', cols: 8 });
  windows(ctx, b, 'L', { z0: 6, z1: H - 1, rows: 4, cols: 7, frame: '#ffffff', glass: '#86b9de', seed: 3 });
  windows(ctx, b, 'R', { z0: 0, z1: H - 1, rows: 5, cols: 6, frame: '#ffffff', glass: '#86b9de', seed: 8 });
  canopy(ctx, b, 'L', 0.35, 0.65, 7, 0.14, '#e53935');
  const top = flatRoof(ctx, b, H, '#cdd3d9', '#eef2f5');
  helipad(ctx, up(G(1.25, 0.75), top), 15);
  redCross(ctx, up(facePt(b, 'L', 0.85, 0), H - 6), 0.75);
  car(ctx, 0.5, 1.86, 'i+', '#ffffff'); car(ctx, 1.4, 1.86, 'i-', '#e63946');
}

// ---------------------------------------------------------------------------
// Decoração
// ---------------------------------------------------------------------------
function treeDecor(ctx) {
  tree(ctx, 0.5, 0.5, 1.15, 0);
  bush(ctx, 0.78, 0.82, 0.35, true);
}

function plaza(ctx) {
  paving(ctx, box(0.06, 0.06, 0.94, 0.94), '#e8e0d0', 5);
  const pl = box(0.34, 0.34, 0.66, 0.66);
  prism(ctx, pl, 0, 2.5, '#c9bfae', { top: '#79c25a' });
  tree(ctx, 0.5, 0.5, 0.75, 2);
  bench(ctx, 0.5, 0.86); bench(ctx, 0.86, 0.5, 'j');
  lamp(ctx, 0.14, 0.86, 16);
}

function fountain(ctx) {
  paving(ctx, box(0.06, 0.06, 0.94, 0.94), '#e8e0d0', 5);
  const c = G(0.5, 0.5);
  cylinder(ctx, c, 22, 4, '#c4c9cf', '#dfe3e7');
  const wg = ctx.createRadialGradient(c.x - 5, c.y - 6, 2, c.x, c.y - 4, 20);
  wg.addColorStop(0, '#9be3fb'); wg.addColorStop(1, '#2ba3d4');
  ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(c.x, c.y - 4, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
  cylinder(ctx, up(c, 4), 4, 8, '#dfe3e7', '#f2f4f6');
  bench(ctx, 0.88, 0.5, 'j');
}

// ---------------------------------------------------------------------------
// Monumentos
// ---------------------------------------------------------------------------
// Porto (2D de reserva): cais de madeira e um barquinho.
function port(ctx) {
  paving(ctx, box(0.1, 0.1, 1.9, 0.9), '#c9a173', 6);
  paving(ctx, box(0.6, 0.9, 1.0, 1.9), '#a8743f', 6);
  const c = G(1.45, 1.4);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 14, 6, -0.45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f6f8e'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 2, 12, 5, -0.45, 0, Math.PI * 2); ctx.fill();
}

function stadium(ctx) {
  paving(ctx, box(0.04, 0.04, 1.96, 1.96), '#dcd8cf', 8);
  const c = G(1, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(c.x + 10, c.y + 6, 60, 30, 0, 0, Math.PI * 2); ctx.fill();
  cylinder(ctx, c, 56, 20, '#e5e7eb', '#cfd4da');
  // arquibancadas em anéis coloridos
  const rings = ['#2e7dff', '#e63946', '#2e7dff', '#e63946'];
  rings.forEach((col, k) => {
    ctx.fillStyle = tint(col, 0.9 + k * 0.05);
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 20 + k * 2, 50 - k * 5, 25 - k * 2.5, 0, 0, Math.PI * 2); ctx.fill();
  });
  const fg = ctx.createLinearGradient(0, c.y - 30, 0, c.y - 2);
  fg.addColorStop(0, '#4cc26a'); fg.addColorStop(1, '#2f9a4d');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(c.x, c.y - 12, 30, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(c.x, c.y - 12, 22, 11, 0, 0, Math.PI * 2); ctx.stroke();
  line(ctx, { x: c.x, y: c.y - 23 }, { x: c.x, y: c.y - 1 }, 'rgba(255,255,255,0.85)', 1);
  for (const [i, j] of [[0.25, 0.25], [1.75, 0.25], [0.25, 1.75], [1.75, 1.75]]) {
    const p = G(i, j);
    line(ctx, p, up(p, 46), '#8a939c', 1.6);
    ctx.fillStyle = '#fffbe0'; ctx.fillRect(p.x - 5, p.y - 50, 10, 5);
  }
}

function airport(ctx) {
  const apron = box(0.04, 0.04, 1.96, 1.96);
  groundQuad(ctx, apron, '#a3a9af');
  line(ctx, G(0.2, 1.4), G(1.9, 1.4), '#ffd23f', 1.2);
  line(ctx, G(1.0, 0.9), G(1.0, 1.9), '#ffd23f', 1.2);
  const t = box(0.12, 0.12, 1.25, 0.78);
  shadow(ctx, t, 30);
  prism(ctx, t, 0, 18, '#8fc3e8', { top: null });
  curtainWall(ctx, t, 'L', 0, 18, '#8fc3e8', 2, 10);
  curtainWall(ctx, t, 'R', 0, 18, '#8fc3e8', 2, 6);
  flatRoof(ctx, t, 18, '#e9edf0', '#ffffff', 2);
  // torre de controle
  const tc = G(1.62, 0.38);
  cylinder(ctx, tc, 6, 42, '#e8ecef', '#d5dbe0');
  cylinder(ctx, up(tc, 42), 10, 8, '#3d5a73', '#e8ecef');
  // avião
  const fus = box(0.6, 1.36, 1.7, 1.48);
  const wing = [up(G(1.0, 1.0), 6), up(G(1.25, 1.0), 6), up(G(1.3, 1.84), 6), up(G(1.05, 1.84), 6)];
  poly(ctx, wing, '#d8dde2');
  prism(ctx, fus, 3, 10, '#ffffff', { top: '#f6f7f8' });
  poly(ctx, [up(G(0.62, 1.42), 10), up(G(0.75, 1.42), 10), up(G(0.66, 1.42), 20)], '#2e7dff');
  for (let k = 0; k < 7; k++) poly(ctx, faceQuad(fus, 'L', 0.2 + k * 0.08, 0.24 + k * 0.08, 6.5, 8), '#5f8fb5');
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------
export const PAINT = {
  house1, house2, house3, house4, house5, house6, house7,
  townhall, warehouse,
  sawmill, kiln, glassworks, carpentry, steelworks,
  bakery, market, clothes, mall,
  school, clinic, firehouse, hospital,
  tree: treeDecor, plaza, fountain,
  stadium, airport, port,
};

export const HEIGHT = {
  house1: 34, house2: 38, house3: 40, house4: 34, house5: 66, house6: 108, house7: 156,
  townhall: 72, warehouse: 34, sawmill: 36, kiln: 54, glassworks: 44, carpentry: 40, steelworks: 70,
  bakery: 40, market: 40, clothes: 52, mall: 64, school: 46, clinic: 40, firehouse: 50, hospital: 70,
  tree: 36, plaza: 30, fountain: 26, stadium: 50, airport: 62, port: 24,
};

// Partes animadas (desenhadas por cima do sprite, a cada quadro)
export const ANIM = {
  townhall: (ctx, t) => flag(ctx, up(G(0.5, 0.42), 32.5), 22, t, '#2ecc71'),
  school: (ctx, t) => flag(ctx, G(0.06, 0.92), 26, t, '#2e7dff'),
  kiln: (ctx, t) => smoke(ctx, up(G(0.3, 0.4), 20 + 26), t),
  glassworks: (ctx, t) => smoke(ctx, up(G(0.3, 0.32), 24.5 + 18), t, 0.8),
  steelworks: (ctx, t) => { smoke(ctx, up(G(0.22, 0.22), 55), t); smoke(ctx, up(G(0.42, 0.22), 55), t + 0.5); },
  house7: (ctx, t) => {
    const p = up(G(0.5, 0.5), 142);
    line(ctx, { x: p.x + 8, y: p.y - 2 }, { x: p.x + 8, y: p.y - 20 }, '#6b737c', 1.2);
    ctx.fillStyle = (Math.floor(t * 1.5) % 2) ? '#ff5252' : '#9b1c1c';
    ctx.beginPath(); ctx.arc(p.x + 8, p.y - 20, 2, 0, Math.PI * 2); ctx.fill();
  },
  fountain: (ctx, t) => {
    const c = up(G(0.5, 0.5), 12);
    for (let k = 0; k < 10; k++) {
      const ph = (t * 0.8 + k / 10) % 1, a = (k / 10) * Math.PI * 2;
      const x = c.x + Math.cos(a) * ph * 14, y = c.y + Math.sin(a) * ph * 7 - Math.sin(ph * Math.PI) * 12 + ph * 8;
      ctx.fillStyle = `rgba(225,246,255,${0.9 * (1 - ph * 0.7)})`;
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  },
};

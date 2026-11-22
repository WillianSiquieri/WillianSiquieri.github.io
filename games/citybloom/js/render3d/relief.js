// relief.js — relevo em volta da cidade: montanhas ao norte e a leste, colinas a oeste,
// mar ao sul. O mapa de jogo continua plano (a grade de construção precisa disso); o
// relevo sobe a partir da borda, com vale por onde desce o rio, passagens por onde as
// estradas saem para a névoa, picos com neve e uma cachoeira na cabeceira do rio.

import * as THREE from 'three';
import { natureAt } from '../game/roads.js';

const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const R = 16;                                   // tiles de relevo além da borda
const MIST_C = new THREE.Color(0xdcebf2);

// Linhas que precisam ficar baixas: rio e estradas que saem do mapa.
function cuts(state) {
  const n = state.size, lines = [];
  // rio: desce do norte em i 16–17 e sai a leste em j 5–6
  lines.push({ x: 17, z: null, w: 2.2 }, { x: null, z: 6, w: 2.2 });
  for (let k = 0; k < n; k++) {
    const road = (i, j) => state.tiles[j * n + i].kind === 'road';
    if (road(k, 0)) lines.push({ x: k + 0.5, z: null, w: 1.6, side: 'n' });
    if (road(k, n - 1)) lines.push({ x: k + 0.5, z: null, w: 1.6, side: 's' });
    if (road(0, k)) lines.push({ x: null, z: k + 0.5, w: 1.6, side: 'w' });
    if (road(n - 1, k)) lines.push({ x: null, z: k + 0.5, w: 1.6, side: 'e' });
  }
  return lines;
}

// Altura do terreno em (x, z) em unidades de tile; 0 dentro do mapa.
export function makeHeight(state) {
  const n = state.size, L = cuts(state);
  return (x, z) => {
    const dx = Math.max(-x, 0, x - n), dz = Math.max(-z, 0, z - n);
    const d = Math.hypot(dx, dz);
    if (d < 0.6) return 0;
    if (natureAt(Math.floor(x), Math.floor(z)) !== 'grass') return 0;    // mar, praia, rio
    // quanto relevo em cada lado: montanhas ao norte e a leste, colinas a oeste, nada ao sul
    const north = sstep(0, 3, -z) * (1 - sstep(-2, 2, x - n) * 0), east = sstep(0, 3, x - n) * (1 - sstep(n - 10, n - 2, z));
    const west = sstep(0, 3, -x) * (1 - sstep(n - 10, n - 2, z));
    const amp = Math.max(north * 5.2, east * 4.4, west * 1.9);
    if (amp <= 0.01) return 0;
    // picos: crista em duas escalas (montanhas com várias pontas, não um platô)
    const r1 = 1 - Math.abs(vnoise(x * 0.17, z * 0.17, 3) * 2 - 1), r2 = 1 - Math.abs(vnoise(x * 0.41, z * 0.41, 8) * 2 - 1);
    const bumps = vnoise(x * 0.6, z * 0.6, 5);
    const shape = 0.15 + 0.65 * Math.pow(r1, 3) + 0.25 * r2 * r2 + 0.1 * bumps;
    // sobe a partir da borda do mapa e desce de novo antes do fim (sem paredão no limite)
    let h = amp * shape * sstep(0.8, 6.5, d) * (1 - sstep(R - 5, R - 0.6, d));
    // vale do rio e passagens das estradas
    for (const c of L) {
      const off = c.x != null ? Math.abs(x - c.x) : Math.abs(z - c.z);
      if (c.side === 'n' && z > 0) continue; if (c.side === 's' && z < n) continue;
      if (c.side === 'w' && x > 0) continue; if (c.side === 'e' && x < n) continue;
      if (!c.side && c.x != null && z > 0) continue;          // rio norte: só fora do mapa ao norte
      if (!c.side && c.z != null && x < n) continue;          // rio leste: só fora do mapa a leste
      h *= sstep(c.w * 0.5, c.w * 2.2, off);
    }
    return h;
  };
}

// Malha do relevo (anel em volta do mapa), cores por altura, sombreamento facetado.
export function buildRelief(state) {
  const n = state.size, H = makeHeight(state), S = 0.5;
  const pos = [], col = [];
  const C = { grass: new THREE.Color(0x6aa846), forest: new THREE.Color(0x3f7a35), rock: new THREE.Color(0x8d8a83), rock2: new THREE.Color(0x6e6b66), snow: new THREE.Color(0xf4f7fa) };
  const color = (h, x, z) => {
    const c = new THREE.Color(), r = hash(Math.floor(x * 4), Math.floor(z * 4), 7) * 0.4;
    if (h < 0.5) return c.copy(C.grass).lerp(C.forest, h / 0.5 * 0.6);
    if (h < 1.7) return c.copy(C.forest).lerp(C.grass, r * 0.3);
    if (h < 3.0) return c.copy(C.rock).lerp(C.rock2, r);
    return c.copy(C.snow).lerp(C.rock, Math.max(0, 0.35 - (h - 3) * 0.4));
  };
  for (let z = -R; z < n + R; z += S) for (let x = -R; x < n + R; x += S) {
    // só fora do mapa (com uma folga de meio tile)
    if (x >= -S && z >= -S && x + S <= n + S && z + S <= n + S) continue;
    const h00 = H(x, z), h10 = H(x + S, z), h01 = H(x, z + S), h11 = H(x + S, z + S);
    if (h00 + h10 + h01 + h11 < 0.02) continue;
    const y = (h) => h > 0.01 ? h : -0.03;      // onde é plano, fica sob o chão
    const quad = [[x, h00, z], [x, h01, z + S], [x + S, h10, z], [x + S, h10, z], [x, h01, z + S], [x + S, h11, z + S]];
    const hm = (h00 + h10 + h01 + h11) / 4, c = color(hm, x, z);
    // longe da cidade a montanha some na névoa (perspectiva aérea)
    const dd = Math.hypot(Math.max(-x, 0, x - n), Math.max(-z, 0, z - n));
    c.lerp(MIST_C, sstep(6, R - 1, dd) * 0.85);
    for (const [px, ph, pz] of quad) { pos.push(px, y(ph), pz); col.push(c.r, c.g, c.b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  mesh.receiveShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  // cachoeira na cabeceira do rio (onde ele sai das montanhas, ao norte)
  const fallZ = -7.5, top = Math.max(H(15.2, fallZ - 1.2), H(18.8, fallZ - 1.2), 1.2);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.6, top + 0.2), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.85, roughness: 0.2, side: THREE.DoubleSide }));
  fall.position.set(16.95, top / 2 - 0.05, fallZ); fall.rotation.x = -0.35; fall.name = 'waterfall';
  g.add(fall);
  g.userData.fall = fall;
  return g;
}
export function animateRelief(g, t) {
  const f = g && g.userData.fall; if (!f) return;
  f.material.opacity = 0.75 + Math.sin(t * 6) * 0.08;
}

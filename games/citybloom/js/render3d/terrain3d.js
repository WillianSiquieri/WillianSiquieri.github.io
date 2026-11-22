// terrain3d.js — o mundo em volta das construções: chão grande com textura (grama,
// praia, mar e rio), ruas de cada fase (terra → paralelepípedo → asfalto com faixas e
// semáforos), floresta densa nas terras à venda e além do mapa, cerca na divisa e
// névoa na borda do mundo. Só desenha; o traçado vem de game/roads.js.

import * as THREE from 'three';
import { ROUNDABOUTS as ALL_RA, kindAt, isRoadAt } from '../game/roads.js';
export { kindAt };

export const EXT = 14;                 // tiles de mundo além da borda do mapa
const P = 32;                          // px de textura por tile
export const MIST = 0xdcebf2;          // cor da névoa (igual ao céu)

// ---------------------------------------------------------------- utilidades
export function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// ruído de valor suave (manchas de floresta e de cor)
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Rotatórias que existem neste mapa (a vitrine, por exemplo, não tem).
const roundabouts = (state) => ALL_RA.filter(([i, j]) => { const n = state.size; return i < n && j < n && state.tiles[j * n + i].ra === 'center'; });

// ---------------------------------------------------------------- forma das ruas
// Bits: N (j-1) = 1, E (i+1) = 2, S (j+1) = 4, W (i-1) = 8.
// Modelos Kenney na rotação 0: reta E–W, curva E–S, T W–E–S, fim aberto a E.
const BASE = { straight: 10, bend: 6, t: 14, end: 2, cross: 15 };
const rot90 = (m) => ((m & 2) ? 1 : 0) | ((m & 1) ? 8 : 0) | ((m & 8) ? 4 : 0) | ((m & 4) ? 2 : 0);   // E→N, N→W, W→S, S→E
export function roadMask(state, i, j) {
  return (isRoadAt(state, i, j - 1) ? 1 : 0) | (isRoadAt(state, i + 1, j) ? 2 : 0) | (isRoadAt(state, i, j + 1) ? 4 : 0) | (isRoadAt(state, i - 1, j) ? 8 : 0);
}
export function roadShape(state, i, j) {
  const m = roadMask(state, i, j);
  const c = [1, 2, 4, 8].filter(b => m & b).length;
  const shape = c === 4 ? 'cross' : c === 3 ? 't' : c === 2 ? (m === 5 || m === 10 ? 'straight' : 'bend') : 'end';
  let b = BASE[shape];
  for (let k = 0; k < 4; k++) { if (b === m || (c <= 1 && k === 0 && m === 0)) return { shape, rot: k * Math.PI / 2, mask: m }; b = rot90(b); }
  return { shape, rot: 0, mask: m };
}

// ---------------------------------------------------------------- textura do chão
const X = (i) => (i + EXT) * P;
function blob(cx, x, y, r, inner, outer) {
  const g = cx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(0.55, inner); g.addColorStop(1, outer);
  cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
}

// Ruas pintadas no chão (fases 0 e 1): terra batida e paralelepípedo.
function paintRoads(cx, state, phase, W) {
  const n = state.size, lo = -EXT, hi = n + EXT;
  const R = document.createElement('canvas'); R.width = R.height = W;
  const rc = R.getContext('2d');
  rc.lineCap = 'round'; rc.lineJoin = 'round';
  const segs = [];
  for (let j = lo; j < hi; j++) for (let i = lo; i < hi; i++) {
    if (!isRoadAt(state, i, j)) continue;
    const t = i >= 0 && j >= 0 && i < n && j < n ? state.tiles[j * n + i] : null;
    if (t && t.ra) continue;
    if (isRoadAt(state, i + 1, j)) segs.push([i, j, i + 1, j]);
    if (isRoadAt(state, i, j + 1)) segs.push([i, j, i, j + 1]);
    segs.push([i, j, i, j]);
  }
  const ROUNDABOUTS = roundabouts(state);
  const stroke = (w, color) => {
    rc.strokeStyle = color; rc.lineWidth = w * P; rc.beginPath();
    for (const [a, b, c, d] of segs) { rc.moveTo(X(a + 0.5), X(b + 0.5)); rc.lineTo(X(c + 0.5) + (a === c && b === d ? 0.01 : 0), X(d + 0.5)); }
    rc.stroke();
    for (const [ci, cj] of ROUNDABOUTS) { rc.lineWidth = w * P; rc.beginPath(); rc.arc(X(ci + 0.5), X(cj + 0.5), 1.0 * P, 0, Math.PI * 2); rc.stroke(); }
    // braços da rotatória até o anel
    for (const [ci, cj] of ROUNDABOUTS) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      rc.beginPath(); rc.moveTo(X(ci + 0.5 + di * 0.9), X(cj + 0.5 + dj * 0.9)); rc.lineTo(X(ci + 0.5 + di * 1.6), X(cj + 0.5 + dj * 1.6)); rc.stroke();
    }
  };
  const rand = mulberry(99);
  if (phase === 0) {
    stroke(0.86, 'rgba(140,112,66,0.45)');           // borda gasta
    stroke(0.66, '#b58c58');                         // terra batida
    rc.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < 9000; k++) {                 // pedrinhas e manchas
      const x = rand() * W, y = rand() * W;
      rc.fillStyle = rand() < 0.5 ? 'rgba(90,64,36,0.22)' : 'rgba(230,200,150,0.25)';
      rc.fillRect(x, y, 1 + rand() * 2.5, 1 + rand() * 2);
    }
    rc.globalCompositeOperation = 'source-over';
    stroke(0.13, 'rgba(112,150,70,0.75)');           // capim no meio entre os sulcos
  } else {
    stroke(0.84, '#8a8274');                         // meio-fio
    stroke(0.7, '#c2b8a6');                          // paralelepípedo
    rc.globalCompositeOperation = 'source-atop';
    const s = 0.11 * P;
    for (let y = 0; y < W; y += s) for (let x = (Math.floor(y / s) % 2) * s / 2; x < W; x += s) {
      const v = 165 + Math.floor(rand() * 40);
      rc.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
      rc.fillRect(x + 0.6, y + 0.6, s - 1.4, s - 1.4);
    }
    rc.globalCompositeOperation = 'source-over';
  }
  // ilha da rotatória
  for (const [ci, cj] of roundabouts(state)) blob(rc, X(ci + 0.5), X(cj + 0.5), 0.62 * P, '#6fb24a', 'rgba(111,178,74,0)');
  cx.drawImage(R, 0, 0);
}

// Base do chão (grama, praia, água, flores e ruas pintadas): depende só do traçado e da
// fase, então é desenhada uma vez e reaproveitada a cada compra de quadra.
let BASE_CV = null, BASE_KEY = '';
export function groundCanvas(state, phase) {
  const n = state.size, W = (n + 2 * EXT) * P;
  const key = n + '|' + Math.min(phase, 2) + '|' + (state.showcase ? 's' : '');
  if (key !== BASE_KEY) { BASE_CV = baseCanvas(state, phase); BASE_KEY = key; }
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const cx = cv.getContext('2d');
  cx.drawImage(BASE_CV, 0, 0);
  // terra à venda: um pouco mais escura (mata)
  cx.fillStyle = 'rgba(28,70,24,0.10)';
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const t = state.tiles[j * n + i];
    if (t.locked && t.kind === 'grass') cx.fillRect(X(i), X(j), P, P);
  }
  return cv;
}

function baseCanvas(state, phase) {
  const n = state.size, T = n + 2 * EXT, W = T * P;
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const cx = cv.getContext('2d');
  const rand = mulberry(7);
  // grama com manchas
  cx.fillStyle = '#7cbd4b'; cx.fillRect(0, 0, W, W);
  for (let k = 0; k < 3200; k++) {
    const x = rand() * W, y = rand() * W, r = P * (0.6 + rand() * 2.6);
    const h = 86 + rand() * 24, sat = 40 + rand() * 20, l = 34 + rand() * 16;
    blob(cx, x, y, r, `hsla(${h},${sat}%,${l}%,0.16)`, `hsla(${h},${sat}%,${l}%,0)`);
  }
  // praia, raso e fundo do mar/rio
  const lo = -EXT, hi = n + EXT;
  const k2 = (i, j) => kindAt(state, i, j);
  for (let j = lo; j < hi; j++) for (let i = lo; i < hi; i++) if (k2(i, j) === 'sand' || (k2(i, j) === 'water')) blob(cx, X(i + 0.5), X(j + 0.5), 1.0 * P, '#ead49c', 'rgba(234,212,156,0)');
  for (let j = lo; j < hi; j++) for (let i = lo; i < hi; i++) if (k2(i, j) === 'water') blob(cx, X(i + 0.5), X(j + 0.5), 0.82 * P, '#69c3d6', 'rgba(105,195,214,0)');
  for (let j = lo; j < hi; j++) for (let i = lo; i < hi; i++) {
    if (k2(i, j) !== 'water') continue;
    let deep = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (k2(i + di, j + dj) === 'water') deep++;
    if (deep >= 18) blob(cx, X(i + 0.5), X(j + 0.5), 1.1 * P, '#2f86c0', 'rgba(47,134,192,0)');
  }
  // florzinhas e tufos na grama
  for (let k = 0; k < 2600; k++) {
    const x = rand() * W, y = rand() * W;
    const ti = Math.floor(x / P) - EXT, tj = Math.floor(y / P) - EXT;
    if (k2(ti, tj) !== 'grass') continue;
    if (rand() < 0.35) { cx.fillStyle = ['#ffffff', '#ffe066', '#ff9ec4', '#c9a7ff'][Math.floor(rand() * 4)]; cx.beginPath(); cx.arc(x, y, 1.2 + rand(), 0, Math.PI * 2); cx.fill(); }
    else { cx.strokeStyle = 'rgba(52,104,34,0.55)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(x - 2, y); cx.lineTo(x - 1, y - 4); cx.moveTo(x, y); cx.lineTo(x + 0.5, y - 5); cx.moveTo(x + 2, y); cx.lineTo(x + 2, y - 3.5); cx.stroke(); }
  }
  if (phase <= 1) paintRoads(cx, state, phase, W);
  else {
    // sob o asfalto: terra compactada (as curvas Kenney deixam o canto de fora à mostra)
    for (let j = lo; j < hi; j++) for (let i = lo; i < hi; i++) if (isRoadAt(state, i, j)) blob(cx, X(i + 0.5), X(j + 0.5), 0.8 * P, 'rgba(120,150,90,0.35)', 'rgba(120,150,90,0)');
  }
  return cv;
}

// Máscara da água (para a camada brilhante que ondula).
function waterMask(state) {
  const n = state.size, T = n + 2 * EXT, Q = 8, W = T * Q;
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#000'; cx.fillRect(0, 0, W, W);
  for (let j = -EXT; j < n + EXT; j++) for (let i = -EXT; i < n + EXT; i++) {
    if (kindAt(state, i, j) !== 'water') continue;
    const x = (i + EXT + 0.5) * Q, y = (j + EXT + 0.5) * Q;
    const g = cx.createRadialGradient(x, y, 0, x, y, Q * 0.8);
    g.addColorStop(0, '#fff'); g.addColorStop(0.6, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, Q * 0.8, 0, Math.PI * 2); cx.fill();
  }
  return cv;
}
let WAVES = null;
function waveTexture() {
  if (WAVES) return WAVES;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#3d9fd6'; cx.fillRect(0, 0, 128, 128);
  const rand = mulberry(5);
  for (let k = 0; k < 26; k++) {
    const x = rand() * 128, y = rand() * 128, w = 8 + rand() * 18;
    cx.strokeStyle = 'rgba(255,255,255,0.55)'; cx.lineWidth = 1.4; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(x, y); cx.quadraticCurveTo(x + w / 2, y - 2.5, x + w, y); cx.stroke();
  }
  WAVES = new THREE.CanvasTexture(cv); WAVES.wrapS = WAVES.wrapT = THREE.RepeatWrapping; WAVES.colorSpace = THREE.SRGBColorSpace;
  WAVES.userData.shared = true;
  return WAVES;
}

// Chão + água. Devolve { group, water } (water anima com animateWater).
export function buildGround(state, phase) {
  const n = state.size, T = n + 2 * EXT;
  const group = new THREE.Group();
  const tex = new THREE.CanvasTexture(groundCanvas(state, phase));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(T, T), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(n / 2, 0, n / 2); ground.receiveShadow = true;
  group.add(ground);
  const mask = new THREE.CanvasTexture(waterMask(state));
  const waves = waveTexture().clone(); waves.userData = {}; waves.needsUpdate = true; waves.repeat.set(T / 3, T / 3);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(T, T), new THREE.MeshStandardMaterial({
    color: 0xffffff, map: waves, alphaMap: mask, transparent: true, opacity: 0.62, roughness: 0.15, metalness: 0.05, depthWrite: false,
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(n / 2, 0.012, n / 2); water.receiveShadow = true;
  group.add(water);
  // segunda camada de ondas, rolando na outra direção (a água "mexe" de verdade)
  const waves2 = waveTexture().clone(); waves2.userData = {}; waves2.needsUpdate = true; waves2.repeat.set(T / 5, T / 5); waves2.rotation = 0.7;
  const water2 = new THREE.Mesh(water.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, map: waves2, alphaMap: mask, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
  water2.rotation.x = -Math.PI / 2; water2.position.set(n / 2, 0.014, n / 2);
  group.add(water2);
  // espuma na beira (praia e margens), pulsando como onda que chega
  const foam = new THREE.Mesh(water.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: new THREE.CanvasTexture(shoreMask(state)), transparent: true, opacity: 0.7, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(n / 2, 0.016, n / 2);
  group.add(foam);
  return { group, water: { a: water, b: water2, foam } };
}
export function animateWater(w, t) {
  if (!w) return;
  w.a.material.map.offset.set(Math.sin(t * 0.25) * 0.12, t * 0.02);
  w.b.material.map.offset.set(-t * 0.015, Math.cos(t * 0.2) * 0.1);
  w.foam.material.opacity = 0.45 + Math.sin(t * 1.3) * 0.25;
  w.foam.scale.setScalar(1 + Math.sin(t * 1.3) * 0.0015);
}

// Faixa de espuma: água que encosta em terra.
function shoreMask(state) {
  const n = state.size, T = n + 2 * EXT, Q = 8, W = T * Q;
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#000'; cx.fillRect(0, 0, W, W);
  const isW = (i, j) => kindAt(state, i, j) === 'water';
  for (let j = -EXT; j < n + EXT; j++) for (let i = -EXT; i < n + EXT; i++) {
    if (isW(i, j)) continue;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!isW(i + a, j + b)) continue;
      // borda entre o tile de terra e a água: linha clara do lado da água
      const x = (i + EXT + 0.5 + a * 0.55) * Q, y = (j + EXT + 0.5 + b * 0.55) * Q;
      const g = cx.createRadialGradient(x, y, 0, x, y, Q * 0.42);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, Q * 0.42, 0, Math.PI * 2); cx.fill();
    }
  }
  return cv;
}

// ---------------------------------------------------------------- floresta (instanciada)
const TRUNK_GEO = new THREE.CylinderGeometry(0.025, 0.04, 0.2, 5, 1, true); TRUNK_GEO.translate(0, 0.1, 0);
const ROUND_GEO = new THREE.IcosahedronGeometry(0.15, 0); ROUND_GEO.translate(0, 0.3, 0);
const PINE_GEO = new THREE.ConeGeometry(0.13, 0.36, 6); PINE_GEO.translate(0, 0.33, 0);
const BUSH_GEO = new THREE.IcosahedronGeometry(0.09, 0); BUSH_GEO.translate(0, 0.06, 0);
for (const g of [TRUNK_GEO, ROUND_GEO, PINE_GEO, BUSH_GEO]) g.userData.shared = true;
const TREE_MAT = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }); TREE_MAT.userData.shared = true;

export function buildForest(state, H = null) {
  const n = state.size, F = H ? 13 : 9;   // com relevo, a mata sobe pelas encostas   // floresta até 9 tiles além da borda (depois, névoa)
  const trees = [];
  const rand = mulberry(31);
  const nearRoad = (i, j) => isRoadAt(state, i, j) || isRoadAt(state, i + 1, j) || isRoadAt(state, i - 1, j) || isRoadAt(state, i, j + 1) || isRoadAt(state, i, j - 1);
  for (let j = -F; j < n + F; j++) for (let i = -F; i < n + F; i++) {
    const inside = i >= 0 && j >= 0 && i < n && j < n;
    const t = inside ? state.tiles[j * n + i] : null;
    if (inside && (!t.locked || t.obstacle)) continue;
    if (kindAt(state, i, j) !== 'grass') continue;
    // manchas de mata fechada e clareiras (ruído em duas escalas); menos árvores na beira da rua
    const dens = vnoise(i * 0.13, j * 0.13, 3) * 0.75 + vnoise(i * 0.4, j * 0.4, 4) * 0.25 - (nearRoad(i, j) ? 0.22 : 0);
    let k = Math.floor((dens - 0.42) * 9 + rand());
    if (k <= 0) { if (rand() < 0.1) trees.push({ x: i + rand(), z: j + rand(), type: rand() < 0.5 ? 3 : 0, s: 0.7 + rand() * 0.5, ry: rand() * 6.28 }); continue; }
    k = Math.min(k, 4);
    const pine = vnoise(i * 0.09, j * 0.09, 6) > 0.55;   // pinheirais em algumas regiões
    for (let q = 0; q < k; q++) {
      const r = rand();
      trees.push({ x: i + 0.1 + rand() * 0.8, z: j + 0.1 + rand() * 0.8, type: r < 0.08 ? 3 : (pine ? r < 0.8 : r < 0.25) ? 1 : 0, s: 0.95 + rand() * 0.6, ry: rand() * 6.28 });
    }
  }
  if (H) {   // no relevo: árvores na altura do chão; acima de ~2,4 só pedra e neve
    for (let k = trees.length - 1; k >= 0; k--) {
      const t = trees[k]; t.y = H(t.x, t.z);
      const dd = Math.hypot(Math.max(-t.x, 0, t.x - n), Math.max(-t.z, 0, t.z - n));
      // acima de ~2,4: pedra e neve; longe e alto: já dentro da névoa (não deixa árvore "no ar")
      if (t.y > 2.4 || (dd > 8 && t.y > 0.4) || dd > 11) trees.splice(k, 1);
      else if (t.y > 1.2 && t.type === 0) t.type = 1;
    }
  }
  const group = new THREE.Group();
  const trunks = trees.filter(t => t.type !== 3);
  const mk = (geo, list, color) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, TREE_MAT, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const c = new THREE.Color();
    list.forEach((t, k) => {
      e.set(0, t.ry || 0, 0); q.setFromEuler(e);
      v.set(t.x, t.y || 0, t.z); sc.set(t.s, t.s * (0.9 + hash(k, 3) * 0.3), t.s);
      m.compose(v, q, sc); im.setMatrixAt(k, m);
      im.setColorAt(k, color(c, t, k));
    });
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  };
  const leaf = (c, t, k) => {
    const r = hash(k, 17);
    if (r < 0.07) return c.setHSL(0.08 + hash(k, 5) * 0.05, 0.62, 0.48);           // outono
    return c.setHSL(0.24 + hash(k, 6) * 0.09, 0.45 + hash(k, 7) * 0.15, 0.27 + hash(k, 8) * 0.12);
  };
  mk(TRUNK_GEO, trunks, (c, t, k) => c.setHSL(0.07, 0.4, 0.26 + hash(k, 9) * 0.08));
  mk(ROUND_GEO, trees.filter(t => t.type === 0), leaf);
  mk(PINE_GEO, trees.filter(t => t.type === 1), (c, t, k) => c.setHSL(0.3 + hash(k, 6) * 0.06, 0.42, 0.22 + hash(k, 8) * 0.08));
  mk(BUSH_GEO, trees.filter(t => t.type === 3), leaf);
  group.userData.count = trees.length;
  return group;
}

// ---------------------------------------------------------------- cerca da divisa
export function buildFence(state, phase) {
  const n = state.size, group = new THREE.Group();
  const wood = phase <= 1;
  const mat = new THREE.MeshStandardMaterial({ color: wood ? 0xb07c4a : 0xf3f1ea, roughness: 0.85 });
  const posts = [], rails = [];
  const free = (i, j) => { const t = state.tiles[j * n + i]; return t.kind === 'grass' || t.kind === 'sand'; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const t = state.tiles[j * n + i];
    if (t.locked || !free(i, j)) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= n || b >= n) continue;
      const u = state.tiles[b * n + a];
      if (!u.locked || !free(a, b)) continue;
      // segmento na aresta entre (i,j) e (a,b)
      const vert = di !== 0, x = di > 0 ? i + 1 : di < 0 ? i : i + 0.5, z = dj > 0 ? j + 1 : dj < 0 ? j : j + 0.5;
      rails.push({ x, z, vert });
      for (const o of [-0.5, 0]) posts.push(vert ? [x, z + o] : [x + o, z]);
    }
  }
  const pg = new THREE.BoxGeometry(0.04, 0.16, 0.04); pg.translate(0, 0.08, 0);
  const rgA = new THREE.BoxGeometry(1, 0.025, 0.02);
  const ip = new THREE.InstancedMesh(pg, mat, Math.max(1, posts.length));
  const ir = new THREE.InstancedMesh(rgA, mat, Math.max(1, rails.length * 2));
  const m = new THREE.Matrix4();
  posts.forEach(([x, z], k) => { m.makeTranslation(x, 0, z); ip.setMatrixAt(k, m); });
  rails.forEach((r, k) => {
    for (let h = 0; h < 2; h++) {
      m.makeRotationY(r.vert ? Math.PI / 2 : 0); m.setPosition(r.x, 0.06 + h * 0.06, r.z);
      ir.setMatrixAt(k * 2 + h, m);
    }
  });
  ip.count = posts.length; ir.count = rails.length * 2;
  for (const im of [ip, ir]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); group.add(im); }
  return group;
}

// ---------------------------------------------------------------- névoa da borda
export function buildMist(n) {
  const group = new THREE.Group();
  const S = n + 2 * 40, Q = 4, W = S * Q;
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const cx = cv.getContext('2d');
  const img = cx.createImageData(W, W);
  const c0 = -1.5, c1 = n + 1.5, fade = 9;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = x / Q - 40, j = y / Q - 40;
    const dx = Math.max(c0 - i, 0, i - c1), dy = Math.max(c0 - j, 0, j - c1);
    const d = Math.hypot(dx, dy) + (vnoise(i * 0.25, j * 0.25, 9) - 0.5) * 3;
    const a = Math.min(1, Math.max(0, d / fade)); const s = a * a * (3 - 2 * a);
    const k = (y * W + x) * 4;
    img.data[k] = 220; img.data[k + 1] = 235; img.data[k + 2] = 242; img.data[k + 3] = Math.round(s * 255);
  }
  cx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  plane.rotation.x = -Math.PI / 2; plane.position.set(n / 2, 1.0, n / 2); plane.renderOrder = 5;
  group.add(plane);
  // nuvenzinhas de fumaça na faixa da névoa
  const rand = mulberry(77), puffs = [];
  const per = Math.round((n + 10) * 4 / 2.2);
  for (let k = 0; k < per; k++) {
    const side = k % 4, u = -4 + rand() * (n + 8), off = 3 + rand() * 4.5;
    const [x, z] = side === 0 ? [u, -off] : side === 1 ? [n + off, u] : side === 2 ? [u, n + off] : [-off, u];
    for (let b = 0; b < 4; b++) puffs.push({ x: x + (rand() - 0.5) * 2.2, z: z + (rand() - 0.5) * 2.2, y: 0.3 + rand() * 0.6, s: 0.6 + rand() * 0.8, ph: rand() * 6.28 });
  }
  const geo = new THREE.SphereGeometry(1, 14, 10);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xc9dde8, emissiveIntensity: 0.55, transparent: true, opacity: 0.8, depthWrite: false });
  const im = new THREE.InstancedMesh(geo, mat, puffs.length);
  im.userData.puffs = puffs; im.renderOrder = 4; im.frustumCulled = false;
  group.add(im);
  group.userData.puffs = im;
  animateMist(group, 0);
  return group;
}
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
export function animateMist(group, t) {
  const im = group && group.userData.puffs; if (!im) return;
  im.userData.puffs.forEach((p, k) => {
    const w = Math.sin(t * 0.18 + p.ph);
    _v.set(p.x + w * 0.5, p.y + Math.sin(t * 0.3 + p.ph * 2) * 0.08, p.z + Math.cos(t * 0.15 + p.ph) * 0.4);
    _s.setScalar(p.s * (1 + Math.sin(t * 0.4 + p.ph) * 0.06)); _s.y *= 0.62;
    _m.compose(_v, _q, _s); im.setMatrixAt(k, _m);
  });
  im.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- grade (só ao construir)
export function buildGrid(state) {
  const n = state.size, pts = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const t = state.tiles[j * n + i];
    if (t.locked || t.kind !== 'grass') continue;
    pts.push(i, 0, j, i + 1, 0, j, i, 0, j, i, 0, j + 1, i + 1, 0, j, i + 1, 0, j + 1, i, 0, j + 1, i + 1, 0, j + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false }));
  l.position.y = 0.014; l.renderOrder = 2;
  return l;
}

// ---------------------------------------------------------------- ruas em 3D, postes e semáforos
// Fases 0–1: o piso está pintado no chão; aqui só pontes, postes de madeira e lampiões.
// Fases 2+: peças de asfalto Kenney (reta, curva, T, cruzamento, fim, rotatória),
// faixas de pedestre e semáforos (fase 3+), postes que mudam por fase.
const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.userData.shared = true;
const matCache = new Map();
const flat = (color, opts = {}) => { const k = color + JSON.stringify(opts); if (!matCache.has(k)) { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }); m.userData.shared = true; matCache.set(k, m); } return matCache.get(k); };
function cube(g, x, y, z, w, h, d, color, opts) { const m = new THREE.Mesh(BOX, flat(color, opts)); m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; }

function woodLamp(g, x, z) {
  cube(g, x, 0, z, 0.035, 0.42, 0.035, 0x7a5232);
  cube(g, x + 0.05, 0.38, z, 0.1, 0.025, 0.025, 0x7a5232);
  cube(g, x + 0.09, 0.31, z, 0.05, 0.07, 0.05, 0xffd77a, { emissive: 0xffb84d, emissiveIntensity: 0.6 });
}
function bridge(g, i, j, vert, phase) {
  const wood = phase <= 1;
  const cx = i + 0.5, cz = j + 0.5;
  if (wood) {
    for (let k = 0; k < 6; k++) { const o = -0.42 + k * 0.168; vert ? cube(g, cx, 0.02, cz + o, 0.7, 0.03, 0.15, k % 2 ? 0xa8743f : 0xb98450) : cube(g, cx + o, 0.02, cz, 0.15, 0.03, 0.7, k % 2 ? 0xa8743f : 0xb98450); }
  }
  for (const side of [-0.4, 0.4]) {
    const c = wood ? 0x8a5a32 : 0xd9d6cf;
    if (vert) { cube(g, cx + side, 0.03, cz, 0.04, 0.1, 1, c); for (const o of [-0.45, 0, 0.45]) cube(g, cx + side, 0, cz + o, 0.05, 0.16, 0.05, c); }
    else { cube(g, cx, 0.03, cz + side, 1, 0.1, 0.04, c); for (const o of [-0.45, 0, 0.45]) cube(g, cx + o, 0, cz + side, 0.05, 0.16, 0.05, c); }
  }
}

export function buildRoads3D(world, state, phase) {
  const n = state.size, g = new THREE.Group();
  const lo = -10, hi = n + 10;
  const put = (name, x, z, rot, y = 0.004) => { const m = world.model(name); m.position.set(x, y, z); m.rotation.y = rot; m.traverse(o => { if (o.isMesh) o.castShadow = false; }); g.add(m); return m; };
  const lamp = (x, z, r) => {
    if (phase === 0) return;
    if (phase === 1) { woodLamp(g, x, z); return; }
    const name = phase === 2 ? 'roads/light-square' : phase === 3 ? 'roads/light-square-double' : 'roads/light-curved-double';
    const m = world.fit(world.model(name), 0.5, 0.5, 0.66); m.position.set(x, 0, z); m.rotation.y = r; g.add(m);
  };
  const shapeAt = (i, j) => roadShape(state, i, j);
  for (let j = lo; j < hi; j++) for (let i = lo; i < hi; i++) {
    if (!isRoadAt(state, i, j)) continue;
    const inside = i >= 0 && j >= 0 && i < n && j < n;
    const t = inside ? state.tiles[j * n + i] : null;
    if (t && t.ra) continue;
    const sh = shapeAt(i, j);
    const vert = sh.shape === 'straight' && (sh.mask & 5) !== 0;
    if (t && t.bridge) bridge(g, i, j, vert, phase);
    if (phase >= 2) {
      let name = 'roads/road-' + { straight: 'straight', bend: 'bend', t: 'intersection', cross: 'crossroad', end: 'end-round' }[sh.shape];
      if (phase >= 3 && sh.shape === 'straight') {
        // faixa de pedestre ao lado de cruzamentos
        const [a, b, c, d] = vert ? [i, j - 1, i, j + 1] : [i - 1, j, i + 1, j];
        const near = (x, y) => isRoadAt(state, x, y) && ['t', 'cross'].includes(shapeAt(x, y).shape);
        if (near(a, b) || near(c, d)) name = 'roads/road-crossing';
      }
      put(name, i + 0.5, j + 0.5, sh.rot, t && t.bridge ? 0.035 : 0.004);
      if (phase >= 3 && (sh.shape === 'cross' || (phase >= 4 && sh.shape === 't')) && inside) {
        const m = world.fit(world.model('roads/traffic-light'), 0.3, 0.6, 0.5); m.position.set(i + 0.08, 0, j + 0.08); m.rotation.y = Math.PI / 4; g.add(m);
      }
    }
    // postes a cada 3 tiles nas retas (dentro do mapa e um pouco além)
    if (sh.shape === 'straight' && !(t && t.bridge) && i > -4 && j > -4 && i < n + 4 && j < n + 4) {
      if (!vert && ((i % 3) + 3) % 3 === 1) lamp(i + 0.5, j + 0.06, 0);
      if (vert && ((j % 3) + 3) % 3 === 1) lamp(i + 0.06, j + 0.5, Math.PI / 2);
    }
  }
  // rotatória
  for (const [ci, cj] of roundabouts(state)) {
    if (phase >= 2) put('roads/road-roundabout', ci + 0.5, cj + 0.5, 0);
    // canteiro com árvore no meio
    cube(g, ci + 0.5, 0, cj + 0.5, 0.5, 0.05, 0.5, 0x6fb24a);
    const tr = world.fit(world.model('nature/tree_oak'), 0.45, 0.8, 0.6); tr.position.set(ci + 0.5, 0.05, cj + 0.5); g.add(tr);
  }
  // placas de via expressa nas saídas da metrópole
  if (phase >= 4) for (const [i, j] of [[0, 18], [35, 14], [21, 0]]) {
    if (!isRoadAt(state, i, j)) continue;
    const m = world.fit(world.model('roads/sign-highway'), 0.9, 0.9, 0.7); m.position.set(i + 0.5, 0, j + 0.5); m.rotation.y = j === 0 ? Math.PI / 2 : 0; g.add(m);
  }
  return g;
}

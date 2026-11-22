// parts.js — peças low-poly para montar construções em código (mesmo estilo dos
// modelos do Kenney): caixas, cilindros, telhados de duas águas, toldos
// listrados, placas com pictogramas (desenhados em canvas, sem emoji),
// bandeiras e pontos de fumaça (animados pelo world3d).

import * as THREE from 'three';

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...opts }); m.userData.shared = true; mats.set(key, m); }
  return mats.get(key);
}
const geoCache = new Map();
export function geo(key, make) { if (!geoCache.has(key)) { const g = make(); g.userData.shared = true; geoCache.set(key, g); } return geoCache.get(key); }

export function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat(color, opts));
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true;
  return m;
}
export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 16, opts) {
  const m = new THREE.Mesh(geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat(color, opts));
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true;
  return m;
}
export function sphere(r, color, x, y, z, opts) {
  const m = new THREE.Mesh(geo(`s${r}`, () => new THREE.SphereGeometry(r, 12, 8)), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}

// Telhado de duas águas: largura w (eixo X), altura h, comprimento d (eixo Z).
export function gable(w, h, d, color, x = 0, y = 0, z = 0, alongX = false) {
  const g = geo(`g${w},${h},${d}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
    const e = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    e.translate(0, 0, -d / 2);
    return e;
  });
  const m = new THREE.Mesh(g, mat(color, { flatShading: true }));
  m.position.set(x, y, z); if (alongX) m.rotation.y = Math.PI / 2;
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Toldo listrado inclinado, preso na fachada (frente = +Z).
export function awning(w, color, x = 0, y = 0.3, z = 0.4, depth = 0.16, stripes = 6) {
  const g = new THREE.Group();
  const sw = w / stripes;
  for (let k = 0; k < stripes; k++) g.add(box(sw, 0.012, depth, k % 2 ? 0xffffff : color, -w / 2 + sw * (k + 0.5), 0, depth / 2));
  for (let k = 0; k < stripes; k++) g.add(box(sw, 0.035, 0.012, k % 2 ? 0xffffff : color, -w / 2 + sw * (k + 0.5), -0.03, depth));
  g.rotation.x = 0.38;
  g.position.set(x, y, z);
  return g;
}

// Bandeira num mastro (o pano balança: objeto 'flag').
export function flag(color, x, z, h = 0.8, y = 0) {
  const g = new THREE.Group();
  g.add(cyl(0.012, 0.012, h, 0xdfe5ea, x, y, z, 6));
  const pivot = new THREE.Group(); pivot.position.set(x, y + h - 0.08, z); pivot.name = 'flag';
  const f = new THREE.Mesh(geo('flag', () => new THREE.PlaneGeometry(0.22, 0.13)), mat(color, { side: THREE.DoubleSide }));
  f.position.x = 0.11; f.castShadow = true;
  pivot.add(f); g.add(pivot);
  return g;
}

export function cross(x, y, z, s = 0.22, ry = Math.PI / 4) {
  const g = new THREE.Group();
  g.add(box(s, s, 0.03, 0xffffff, 0, -s / 2, 0));
  g.add(box(s * 0.7, s * 0.22, 0.04, 0xe53935, 0, -s * 0.11, 0));
  g.add(box(s * 0.22, s * 0.7, 0.04, 0xe53935, 0, -s * 0.35, 0));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}

// Ponto de onde sai fumaça (o world3d anima as baforadas).
export function smoke(x, y, z, scale = 1) {
  const e = new THREE.Object3D(); e.name = 'smoke'; e.position.set(x, y, z); e.userData.k = scale;
  return e;
}

// Chaminé listrada com fumaça.
export function chimney(x, z, h, r, color, stripe = 0xffffff, y = 0) {
  const g = new THREE.Group();
  g.add(cyl(r * 0.85, r, h, color, x, y, z, 12));
  g.add(cyl(r * 0.9, r * 0.92, h * 0.1, stripe, x, y + h * 0.62, z, 12));
  g.add(cyl(r * 0.88, r * 0.9, h * 0.1, stripe, x, y + h * 0.82, z, 12));
  g.add(smoke(x, y + h, z, r * 6));
  return g;
}

// ---------------------------------------------------------------- placas com pictograma
const PICTO = {
  anchor(c) { c.strokeStyle = '#ffffff'; c.lineWidth = 10; c.lineCap = 'round';
    c.beginPath(); c.arc(64, 34, 10, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(64, 44); c.lineTo(64, 100); c.stroke(); c.beginPath(); c.moveTo(46, 58); c.lineTo(82, 58); c.stroke();
    c.beginPath(); c.arc(64, 74, 28, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); },
  bread(c) { c.fillStyle = '#d9913f'; c.beginPath(); c.ellipse(64, 70, 40, 24, 0, Math.PI, 0); c.lineTo(104, 82); c.lineTo(24, 82); c.fill();
    c.strokeStyle = '#f6d39a'; c.lineWidth = 6; for (const x of [46, 64, 82]) { c.beginPath(); c.moveTo(x - 8, 52); c.lineTo(x + 6, 66); c.stroke(); } },
  shirt(c) { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(44, 30); c.lineTo(54, 30); c.quadraticCurveTo(64, 42, 74, 30); c.lineTo(84, 30); c.lineTo(108, 48); c.lineTo(98, 62); c.lineTo(88, 56);
    c.lineTo(88, 100); c.lineTo(40, 100); c.lineTo(40, 56); c.lineTo(30, 62); c.lineTo(20, 48); c.closePath(); c.fill(); },
  bag(c) { c.fillStyle = '#ffffff'; c.fillRect(34, 50, 60, 52); c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.beginPath(); c.arc(64, 50, 16, Math.PI, 0); c.stroke(); },
  fruit(c) { c.fillStyle = '#e53935'; c.beginPath(); c.arc(56, 72, 26, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fdd835'; c.beginPath(); c.arc(82, 70, 20, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#43a047'; c.beginPath(); c.ellipse(64, 40, 12, 6, -0.6, 0, Math.PI * 2); c.fill(); },
  log(c) { c.fillStyle = '#c98b52'; c.beginPath(); c.arc(64, 64, 36, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#8d5a2b'; c.lineWidth = 4;
    for (const r of [26, 16, 6]) { c.beginPath(); c.arc(64, 64, r, 0, Math.PI * 2); c.stroke(); } },
  brick(c) { c.fillStyle = '#c0532f'; for (const [x, y] of [[22, 34], [66, 34], [44, 60], [88, 60], [22, 86], [66, 86]]) c.fillRect(x - 2, y, 40, 20); },
  glass(c) { c.fillStyle = '#b3e5fc'; c.fillRect(30, 26, 68, 76); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(40, 92); c.lineTo(84, 36); c.lineTo(92, 36); c.lineTo(48, 92); c.fill(); },
  chair(c) { c.fillStyle = '#ffffff'; c.fillRect(34, 26, 12, 76); c.fillRect(34, 62, 60, 12); c.fillRect(82, 62, 12, 40); c.fillRect(34, 26, 30, 10); },
  beam(c) { c.fillStyle = '#eceff1'; c.fillRect(26, 26, 76, 16); c.fillRect(26, 86, 76, 16); c.fillRect(56, 26, 16, 76); },
  crate(c) { c.fillStyle = '#ffffff'; c.fillRect(30, 30, 68, 68); c.fillStyle = '#3d7bd9'; c.fillRect(40, 40, 48, 48); c.fillStyle = '#ffffff'; c.fillRect(40, 60, 48, 8); c.fillRect(60, 40, 8, 48); },
  book(c) { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(64, 40); c.lineTo(24, 30); c.lineTo(24, 92); c.lineTo(64, 102); c.lineTo(104, 92); c.lineTo(104, 30); c.closePath(); c.fill();
    c.strokeStyle = '#f39c12'; c.lineWidth = 5; c.beginPath(); c.moveTo(64, 40); c.lineTo(64, 100); c.stroke(); },
};
const signTex = new Map();
function signTexture(kind, bg) {
  const key = kind + bg;
  if (signTex.has(key)) return signTex.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(64, 64, 63, 0, Math.PI * 2); c.fill();
  c.fillStyle = bg; c.beginPath(); c.arc(64, 64, 56, 0, Math.PI * 2); c.fill();
  PICTO[kind](c);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.shared = true;
  signTex.set(key, t);
  return t;
}
// Placa redonda virada para a câmera (45°), num poste curto.
export function sign(kind, bg, x, y, z, s = 0.26) {
  const g = new THREE.Group();
  g.add(cyl(0.012, 0.012, 0.08, 0x8a96a3, 0, -0.08, 0, 6));
  const smKey = 'sign' + kind + bg;
  if (!mats.has(smKey)) {
    const m = new THREE.MeshStandardMaterial({ map: signTexture(kind, bg), emissive: 0xffffff, emissiveMap: signTexture(kind, bg), emissiveIntensity: 0.55, roughness: 0.6, side: THREE.DoubleSide });
    m.userData.shared = true; mats.set(smKey, m);
  }
  const disc = new THREE.Mesh(geo('signdisc', () => new THREE.CircleGeometry(0.5, 28)), mats.get(smKey));
  s *= 1.35;
  disc.scale.setScalar(s); disc.position.y = s / 2; disc.castShadow = true;
  g.add(disc);
  g.position.set(x, y, z); g.rotation.y = Math.PI / 4;
  return g;
}

// Encaixa um modelo do kit (tamanho s) em (x, z).
export function part(world, name, s, x, z, r = 0, tex = null, maxH = Infinity, y = 0) {
  const m = world.fit(world.model(name, tex), s, 1, maxH);
  m.position.set(x, y, z); m.rotation.y = r;
  return m;
}

// Pilha de caixas finas (tábuas, tijolos, vigas).
export function stack(x, z, w, d, layers, color, color2, h = 0.035) {
  const g = new THREE.Group();
  for (let k = 0; k < layers; k++) g.add(box(w, h * 0.9, d, k % 2 ? color2 : color, x, k * h, z));
  return g;
}

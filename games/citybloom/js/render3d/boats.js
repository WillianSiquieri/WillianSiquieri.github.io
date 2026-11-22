// boats.js — barcos e navios em low-poly (feitos em código, no estilo dos veículos) e
// o movimento deles no mar e no rio. A frota acompanha a época da cidade: canoa e barco
// a remo no vilarejo, veleiros na vila, lancha e balsa na cidade pequena, cargueiro e
// rebocador na cidade, porta-contêineres e transatlântico na metrópole.
// Medidas em tiles; o barco anda para +Z (proa em +Z).

import * as THREE from 'three';

const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.userData.shared = true;
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10); CYL.userData.shared = true;
const mats = new Map();
const M = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o }); m.userData.shared = true; mats.set(k, m); } return mats.get(k); };
function box(g, c, x, y, z, w, h, d, o) { const m = new THREE.Mesh(BOX, M(c, o)); m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.castShadow = true; g.add(m); return m; }
function cyl(g, c, x, y, z, r, h, o) { const m = new THREE.Mesh(CYL, M(c, o)); m.scale.set(r, h, r); m.position.set(x, y + h / 2, z); m.castShadow = true; g.add(m); return m; }

// Casco visto de cima com proa pontuda, extrudado para cima (cache por tamanho).
const hulls = new Map();
function hullGeo(len, wid, h, bow = 0.25) {
  const k = [len, wid, h, bow].join();
  if (!hulls.has(k)) {
    const L = len / 2, W = wid / 2, b = len * bow;
    const s = new THREE.Shape();
    s.moveTo(-W, -L); s.lineTo(W, -L); s.lineTo(W, L - b); s.quadraticCurveTo(W * 0.9, L - b * 0.2, 0, L); s.quadraticCurveTo(-W * 0.9, L - b * 0.2, -W, L - b); s.lineTo(-W, -L);
    const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2); geo.userData.shared = true;   // shape XY → XZ; altura em +Y
    // a proa (Y+) foi para -Z: meia-volta em Y leva a proa para +Z sem inverter as faces
    geo.rotateY(Math.PI); geo.computeVertexNormals();
    hulls.set(k, geo);
  }
  return hulls.get(k);
}
function hull(g, len, wid, h, color, deck, bow) {
  const m = new THREE.Mesh(hullGeo(len, wid, h, bow), M(color, { flatShading: true })); m.castShadow = true; g.add(m);
  if (deck) { const d = new THREE.Mesh(hullGeo(len * 0.94, wid * 0.86, 0.004, bow), M(deck)); d.position.y = h; g.add(d); }
  // faixa d'água escura no pé do casco
  const w = new THREE.Mesh(hullGeo(len * 1.01, wid * 1.02, h * 0.25, bow), M(0x7a2a24)); w.position.y = -0.005; g.add(w);
  return m;
}
function sail(g, x, y, z, h, w, color = 0xfdfbf3) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, h); s.lineTo(w, 0); s.lineTo(0, 0);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), M(color, { side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = Math.PI / 2; m.castShadow = true; g.add(m);
}

// cabeça de quem rema / pilota
function head(g, c, x, y, z) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M(c)); m.position.set(x, y, z); g.add(m); }

const BOATS = {
  canoe(w) { const g = new THREE.Group(); hull(g, 0.32, 0.09, 0.035, 0xb5733e, 0x8a5a32, 0.4); box(g, 0x4a6fa5, 0, 0.035, 0, 0.04, 0.05, 0.04); head(g, 0xf1c9a5, 0, 0.1, 0); return g; },
  rowboat() { const g = new THREE.Group(); hull(g, 0.34, 0.14, 0.05, 0xd9d3c7, 0x9c6339, 0.3); box(g, 0x2f6f8e, 0, 0.05, -0.03, 0.04, 0.05, 0.04); head(g, 0xe8b48f, 0, 0.12, -0.03); box(g, 0xc69460, 0, 0.065, -0.03, 0.26, 0.008, 0.012); return g; },
  fishing() { const g = new THREE.Group(); hull(g, 0.5, 0.18, 0.07, 0x2f6f8e, 0xc9a173, 0.3); box(g, 0xf3f1ea, 0, 0.07, -0.08, 0.12, 0.08, 0.12); box(g, 0xc0392b, 0, 0.15, -0.08, 0.14, 0.015, 0.14); cyl(g, 0x6e4325, 0, 0.07, 0.1, 0.006, 0.18); box(g, 0x6e4325, 0, 0.22, 0.05, 0.004, 0.004, 0.14); return g; },
  'fishing-sail'() { const g = BOATS.fishing(); sail(g, 0, 0.09, 0.1, 0.24, 0.16, 0xe9d8b0); return g; },
  sailboat() { const g = new THREE.Group(); hull(g, 0.5, 0.15, 0.06, 0xffffff, 0xc69460, 0.35); cyl(g, 0xdddddd, 0, 0.06, 0.03, 0.006, 0.42); sail(g, 0, 0.09, 0.03, 0.36, 0.2); sail(g, 0, 0.09, 0.05, 0.3, -0.12, 0xe85d5d); return g; },
  motorboat() { const g = new THREE.Group(); hull(g, 0.42, 0.15, 0.06, 0xffffff, 0xe3e6ea, 0.4); box(g, 0x24415e, 0, 0.06, -0.02, 0.11, 0.05, 0.1, { roughness: 0.2 }); box(g, 0x2f80ed, 0, 0.0, 0, 0.152, 0.025, 0.36); return g; },
  ferry() { const g = new THREE.Group(); hull(g, 1.0, 0.32, 0.08, 0xffffff, 0x9aa3ad, 0.18); box(g, 0xf4f6f8, 0, 0.08, -0.05, 0.26, 0.1, 0.6); box(g, 0x24415e, 0, 0.12, -0.05, 0.262, 0.035, 0.58, { roughness: 0.2 }); box(g, 0xf4f6f8, 0, 0.18, 0.1, 0.18, 0.07, 0.16); box(g, 0xc0392b, 0, 0.25, 0.0, 0.05, 0.08, 0.05); for (const c of [0xe85d5d, 0x4dabf7, 0xffd43b]) box(g, c, 0.07 - Math.random() * 0.14, 0.08, -0.38 + Math.random() * 0.1, 0.06, 0.035, 0.1); return g; },
  tug() { const g = new THREE.Group(); hull(g, 0.55, 0.22, 0.08, 0xc0392b, 0x333333, 0.3); box(g, 0xf4f6f8, 0, 0.08, -0.02, 0.15, 0.12, 0.16); box(g, 0x24415e, 0, 0.16, -0.02, 0.152, 0.03, 0.162); cyl(g, 0x222222, 0, 0.2, -0.12, 0.025, 0.1); box(g, 0x222222, 0, 0.05, 0.27, 0.2, 0.04, 0.02); return g; },
  cargo() { const g = new THREE.Group(); hull(g, 2.0, 0.42, 0.14, 0x2b3a55, 0xb84a3a, 0.15);
    box(g, 0xf4f6f8, 0, 0.14, -0.78, 0.36, 0.26, 0.26); box(g, 0x24415e, 0, 0.32, -0.78, 0.362, 0.04, 0.262, { roughness: 0.2 }); cyl(g, 0xc0392b, 0, 0.4, -0.86, 0.04, 0.12);
    for (let k = 0; k < 4; k++) { box(g, [0xe85d5d, 0x2f80ed, 0x37b24d, 0xf59f00][k], 0, 0.14, -0.4 + k * 0.28, 0.34, 0.1, 0.24); }
    for (const z of [-0.25, 0.3]) { cyl(g, 0xf2b705, 0.12, 0.14, z, 0.012, 0.3); box(g, 0xf2b705, 0.0, 0.42, z, 0.26, 0.015, 0.015); }
    return g; },
  container() { const g = new THREE.Group(); hull(g, 3.0, 0.55, 0.18, 0x1d3557, 0xb84a3a, 0.14);
    box(g, 0xf4f6f8, 0, 0.18, -1.25, 0.5, 0.36, 0.26); box(g, 0x24415e, 0, 0.44, -1.25, 0.502, 0.05, 0.262, { roughness: 0.2 }); cyl(g, 0x222222, 0, 0.54, -1.33, 0.05, 0.12);
    const C = [0xe85d5d, 0x2f80ed, 0x37b24d, 0xf59f00, 0x845ef7, 0xadb5bd, 0x20c997];
    for (let r = 0; r < 9; r++) for (let h = 0; h < 2 + (r % 3 === 1 ? 1 : 0); h++) for (const x of [-0.13, 0.13]) box(g, C[(r * 3 + h + (x > 0 ? 2 : 0)) % C.length], x, 0.18 + h * 0.075, -0.95 + r * 0.26, 0.24, 0.07, 0.24);
    return g; },
  cruise() { const g = new THREE.Group(); hull(g, 2.8, 0.55, 0.2, 0xffffff, 0x3c8dbc, 0.2);
    for (let k = 0; k < 4; k++) { const w = 0.5 - k * 0.06, l = 2.2 - k * 0.35; box(g, 0xffffff, 0, 0.2 + k * 0.1, -0.15 - k * 0.05, w, 0.1, l); box(g, 0x24415e, 0, 0.24 + k * 0.1, -0.15 - k * 0.05, w + 0.004, 0.025, l - 0.04, { roughness: 0.2 }); }
    cyl(g, 0x1d4fa8, 0, 0.6, -0.45, 0.07, 0.16); box(g, 0x29b6f6, 0, 0.6, 0.35, 0.18, 0.012, 0.3, { roughness: 0.1 });
    return g; },
};
export const BOAT_KINDS = Object.keys(BOATS);
export function makeBoat(kind) { return (BOATS[kind] || BOATS.rowboat)(); }

// ---------------------------------------------------------------- frota e rotas
const SEA = [['rowboat', 'fishing', 'rowboat'], ['sailboat', 'fishing-sail', 'rowboat', 'sailboat'], ['motorboat', 'ferry', 'sailboat', 'motorboat'],
  ['cargo', 'tug', 'ferry', 'sailboat', 'motorboat'], ['container', 'cruise', 'motorboat', 'tug', 'sailboat']];
const RIVER = [['canoe', 'rowboat'], ['canoe', 'rowboat'], ['motorboat', 'canoe'], ['motorboat'], ['motorboat', 'motorboat']];
const BIG = { cargo: 1, container: 1, cruise: 1, ferry: 1 };
const SPEED = { canoe: 0.25, rowboat: 0.22, fishing: 0.3, 'fishing-sail': 0.35, sailboat: 0.4, motorboat: 0.7, ferry: 0.45, tug: 0.4, cargo: 0.35, container: 0.32, cruise: 0.38 };

function polyline(pts) { const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); return { pts, cum, L: cum[cum.length - 1] }; }
function at(p, d) {
  d = ((d % p.L) + p.L) % p.L;
  let k = 1; while (k < p.pts.length - 1 && p.cum[k] < d) k++;
  const a = p.pts[k - 1], b = p.pts[k], u = (d - p.cum[k - 1]) / ((p.cum[k] - p.cum[k - 1]) || 1);
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}
// Mar ao sul/sudoeste (até a névoa) e o rio que desce do norte e vira para leste.
const ROUTES = {
  near: polyline([[-10, 33.8], [23, 33.8], [24.5, 34.7], [23, 35.6], [-10, 35.6], [-11.5, 34.7], [-10, 33.8]]),
  far: polyline([[-14, 36.6], [26, 36.6], [28, 37.8], [26, 39], [-14, 39], [-16, 37.8], [-14, 36.6]]),
  river: polyline([[16.5, -14], [16.5, 5.5], [17.5, 5.5], [50, 5.5]]),
};

export class Boats {
  constructor(scene, world) { this.world = world; this.group = new THREE.Group(); scene.add(this.group); this.list = []; this.phase = -1; this.t = 0; }
  _spawn(route, kind, d) {
    const g = makeBoat(kind);
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));   // material próprio: cada esteira pulsa no seu ritmo
    wake.rotation.x = -Math.PI / 2; const L = BIG[kind] ? 1.2 : 0.5; wake.scale.set(BIG[kind] ? 0.45 : 0.16, L, 1); wake.position.set(0, 0.006, -L / 2 - (BIG[kind] ? 1 : 0.15));
    g.add(wake);
    const o = new THREE.Group(); o.add(g); this.group.add(o);
    this.list.push({ o, g, wake, route, kind, d, speed: SPEED[kind] * (0.85 + Math.random() * 0.3), ph: Math.random() * 6 });
  }
  setPhase(ph) {
    if (ph === this.phase) return;
    this.phase = ph;
    for (const b of this.list) { this.group.remove(b.o); b.o.traverse(m => { if (!m.isMesh) return; if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); }
    this.list = [];
    const sea = SEA[ph], riv = RIVER[ph];
    sea.forEach((k, i) => this._spawn(BIG[k] ? ROUTES.far : (i % 2 ? ROUTES.far : ROUTES.near), k, (i / sea.length) * 60));
    riv.forEach((k, i) => this._spawn(ROUTES.river, k, i * 22));
  }
  update(t, dt) {
    for (const b of this.list) {
      b.d += b.speed * dt;
      if (b.route === ROUTES.river && b.d > b.route.L) b.d -= b.route.L;
      const p = at(b.route, b.d);
      b.o.position.set(p.x, 0.012 + Math.sin(t * 1.6 + b.ph) * 0.006, p.z);
      // vira suave para a direção da rota
      let dy = p.yaw - b.o.rotation.y; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      b.o.rotation.y += dy * Math.min(1, dt * 2.5);
      b.g.rotation.z = Math.sin(t * 1.3 + b.ph) * (BIG[b.kind] ? 0.015 : 0.05);
      b.g.rotation.x = Math.sin(t * 1.1 + b.ph * 2) * 0.03;
      b.wake.material.opacity = 0.3 + Math.sin(t * 3 + b.ph) * 0.1;
    }
  }
}

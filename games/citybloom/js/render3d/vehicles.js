// vehicles.js — veículos que andam nas ruas: modelos Kenney (Car Kit) e alguns feitos
// aqui em low-poly (carroça com cavalo, bicicleta, ônibus e ônibus articulado), porque
// o kit não tem. Todos olham para +Z (yaw 0 = andando em +Z).

import * as THREE from 'three';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const WHEEL = new THREE.CylinderGeometry(1, 1, 1, 10); WHEEL.rotateZ(Math.PI / 2);
const SPH = new THREE.SphereGeometry(1, 8, 6);
for (const g of [BOX, WHEEL, SPH]) g.userData.shared = true;
const mats = new Map();
const M = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o }); m.userData.shared = true; mats.set(k, m); } return mats.get(k); };
function part(g, geo, color, x, y, z, sx, sy, sz, opts) {
  const m = new THREE.Mesh(geo, M(color, opts)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m;
}
const box = (g, c, x, y, z, w, h, d, o) => part(g, BOX, c, x, y + h / 2, z, w, h, d, o);
const wheel = (g, x, y, z, r, w, c = 0x2b2b30) => part(g, WHEEL, c, x, y, z, w, r, r);

// Carroça puxada por cavalo
function cart(color) {
  const g = new THREE.Group();
  // cavalo (na frente, +Z)
  const hc = [0xa0683a, 0xf2e8dc, 0xc9a074, 0x7a4a26][Math.floor(color * 4) % 4];
  box(g, hc, 0, 0.07, 0.12, 0.055, 0.06, 0.15);
  box(g, hc, 0, 0.11, 0.2, 0.04, 0.07, 0.04);           // pescoço
  box(g, hc, 0, 0.15, 0.225, 0.035, 0.035, 0.07);       // cabeça
  box(g, 0x2a1d14, 0, 0.13, 0.17, 0.012, 0.05, 0.06);   // crina
  for (const [x, z] of [[-0.018, 0.06], [0.018, 0.06], [-0.018, 0.18], [0.018, 0.18]]) box(g, hc, x, 0, z, 0.014, 0.07, 0.014);
  // varais e carroça
  for (const x of [-0.04, 0.04]) box(g, 0x7a5232, x, 0.07, 0.02, 0.008, 0.008, 0.14);
  box(g, 0xb98450, 0, 0.05, -0.1, 0.13, 0.05, 0.16);
  box(g, 0xf2d36b, 0, 0.1, -0.1, 0.12, 0.06, 0.14);      // feno
  for (const x of [-0.072, 0.072]) wheel(g, x, 0.045, -0.1, 0.045, 0.012, 0x6b4426);
  return g;
}

// Bicicleta com ciclista
function bike(color) {
  const g = new THREE.Group();
  const shirt = [0xe85d5d, 0x4f8ef7, 0x5ccf7a, 0xf2b84b, 0xa77bf3][Math.floor(color * 5) % 5];
  for (const z of [-0.055, 0.055]) wheel(g, 0, 0.032, z, 0.032, 0.006, 0x222222);
  box(g, 0x666b73, 0, 0.03, 0, 0.008, 0.008, 0.11);
  box(g, 0x3b4252, 0, 0.04, -0.005, 0.02, 0.05, 0.02);    // pernas
  box(g, shirt, 0, 0.085, 0.0, 0.035, 0.05, 0.025);       // tronco
  part(g, SPH, 0xf1c9a5, 0, 0.13, 0.01, 0.017, 0.017, 0.017);
  box(g, 0x666b73, 0, 0.07, 0.045, 0.04, 0.006, 0.006);  // guidão
  return g;
}

// Ônibus (comprido) — articulado tem duas partes com sanfona
function bus(long, color) {
  const g = new THREE.Group();
  const body = long ? 0xe23b3b : [0xf2b705, 0x2f80ed, 0xffffff][Math.floor(color * 3) % 3];
  const seg = (z, len) => {
    box(g, body, 0, 0.025, z, 0.16, 0.13, len);
    box(g, 0x24415e, 0, 0.075, z, 0.163, 0.045, len * 0.92, { roughness: 0.25 });   // janelas
    box(g, 0xd8dde3, 0, 0.155, z, 0.12, 0.015, len * 0.5);                           // ar-condicionado
    for (const dz of [-len * 0.33, len * 0.33]) for (const x of [-0.075, 0.075]) wheel(g, x, 0.03, z + dz, 0.03, 0.02);
  };
  if (long) { seg(0.18, 0.34); seg(-0.18, 0.32); box(g, 0x333333, 0, 0.03, 0, 0.14, 0.11, 0.04); }
  else seg(0, 0.5);
  const f = long ? 0.35 : 0.25;
  box(g, 0x24415e, 0, 0.06, f, 0.14, 0.07, 0.006, { roughness: 0.2 });              // para-brisa
  box(g, 0x222222, 0, 0.135, f - 0.01, 0.1, 0.02, 0.01, { emissive: 0xffa53a, emissiveIntensity: 0.4 });   // letreiro
  return g;
}

const scaled = (g, k) => { g.scale.setScalar(k); const w = new THREE.Group(); w.add(g); return w; };
export const CUSTOM_VEHICLES = { cart: () => scaled(cart(Math.random()), 1.45), bike: () => scaled(bike(Math.random()), 1.3), bus: () => bus(false, Math.random()), 'bus-long': () => bus(true, Math.random()) };
export const KENNEY_VEHICLES = ['sedan', 'taxi', 'van', 'suv', 'hatchback-sports', 'police', 'delivery', 'sedan-sports', 'truck', 'tractor',
  'garbage-truck', 'suv-luxury', 'delivery-flat', 'truck-flat', 'race', 'ambulance', 'firetruck'];
const SIZE = { tractor: 0.3, truck: 0.46, 'garbage-truck': 0.46, firetruck: 0.48, 'truck-flat': 0.46, 'delivery-flat': 0.44, ambulance: 0.44 };

// Malha do veículo (a origem no chão, no centro).
export function makeVehicle(world, kind) {
  if (CUSTOM_VEHICLES[kind]) return CUSTOM_VEHICLES[kind]();
  return world.fit(world.model('cars/' + kind), SIZE[kind] || 0.42, 1);
}

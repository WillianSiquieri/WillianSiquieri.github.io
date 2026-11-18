// catalog.js — que modelo 3D representa cada construção do CityBloom.
// Modelos: Kenney City Kit (Suburban, Commercial, Industrial, Roads), Car Kit e
// Nature Kit — licença CC0 (assets/models/). O que não existe nos kits
// (prefeitura, estádio, aeroporto, praça, chafariz…) é montado aqui em código,
// no mesmo estilo low-poly.
//
// Cada tipo tem uma lista de variantes; o objeto escolhe uma pelo id (fixo).
//   m: 'kit/arquivo'   tex: 'kit/Textures/variation-x' (cores alternativas)
//   fill: quanto do tile ocupa · maxH: altura máxima · extra(g, world, size, id)
//   custom: nome de um construtor em CUSTOM

import * as THREE from 'three';

const SUB = 'suburban/', COM = 'commercial/', IND = 'industrial/', NAT = 'nature/';
const subTex = ['', SUB + 'Textures/variation-a', SUB + 'Textures/variation-b', SUB + 'Textures/variation-c'];
const comTex = ['', COM + 'Textures/variation-a', COM + 'Textures/variation-b'];
const vary = (models, texs, extra = {}) => models.flatMap(m => texs.map(tex => ({ m, tex: tex || null, ...extra })));

import { mat, box, cyl, flag, cross, part, geo } from './parts.js';
import { BUILDS } from './builds.js';
export { mat };

// ---------------------------------------------------------------- construções montadas
const CUSTOM = {
  // Prefeitura: prédio clássico com colunas, frontão, cúpula e bandeira.
  townhall(world, size) {
    const g = new THREE.Group(), cream = 0xf3ead7, roof = 0x5b6b8c;
    g.add(box(1.7, 0.08, 1.3, 0xc9c1b0));                        // base
    g.add(box(1.5, 0.5, 1.0, cream, 0, 0.08, -0.05));            // corpo
    g.add(box(1.56, 0.06, 1.06, 0xe2d6bd, 0, 0.58, -0.05));      // cornija
    g.add(box(1.0, 0.04, 0.3, 0xd8cdb6, 0, 0.0, 0.62));          // escadas
    g.add(box(0.9, 0.04, 0.22, 0xd8cdb6, 0, 0.04, 0.58));
    for (let k = 0; k < 6; k++) g.add(cyl(0.035, 0.04, 0.46, 0xffffff, -0.4 + k * 0.16, 0.08, 0.5, 10));
    // frontão
    const tri = new THREE.Shape(); tri.moveTo(-0.5, 0); tri.lineTo(0.5, 0); tri.lineTo(0, 0.22); tri.lineTo(-0.5, 0);
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false }), mat(0xe9dfc8));
    ped.position.set(0, 0.6, 0.42); ped.castShadow = true; g.add(ped);
    g.add(box(1.06, 0.05, 0.14, cream, 0, 0.55, 0.48));
    // janelas
    for (const x of [-0.6, 0.6]) for (const y of [0.2, 0.38]) g.add(box(0.12, 0.1, 0.02, 0x4f7fb5, x, y, 0.455));
    // cúpula
    g.add(cyl(0.26, 0.28, 0.2, cream, 0, 0.64, -0.1, 20));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6fa8dc));
    dome.position.set(0, 0.84, -0.1); dome.castShadow = true; g.add(dome);
    g.add(cyl(0.02, 0.02, 0.12, 0xf2c94c, 0, 1.09, -0.1, 6));
    g.add(flag(0x2ecc71, 0.55, 0.62, 0.5).translateY(0.0));
    // jardim
    for (const x of [-0.75, 0.75]) g.add(part(world, NAT + 'plant_bushDetailed', 0.22, x, 0.62));
    g.scale.setScalar(size / 1.75);
    g.userData.h = 1.12 * size / 1.75;
    return g;
  },
  // Bombeiros: galpão vermelho com torre e sirene.
  firehouse(world, size) {
    const g = new THREE.Group(), red = 0xd8433b;
    g.add(box(0.78, 0.42, 0.62, red, -0.02, 0, 0.02));
    g.add(box(0.82, 0.05, 0.66, 0x8e2b25, -0.02, 0.42, 0.02));
    for (const x of [-0.22, 0.18]) g.add(box(0.3, 0.3, 0.02, 0xeceff1, x, 0.02, 0.34));
    for (const x of [-0.22, 0.18]) for (let k = 0; k < 4; k++) g.add(box(0.3, 0.012, 0.025, 0xb0bec5, x, 0.07 + k * 0.07, 0.345));
    g.add(box(0.22, 0.72, 0.22, red, 0.3, 0, -0.2));
    g.add(box(0.26, 0.05, 0.26, 0x8e2b25, 0.3, 0.72, -0.2));
    g.add(cyl(0.05, 0.05, 0.06, 0xffd23f, 0.3, 0.77, -0.2, 10, { emissive: 0xff8800, emissiveIntensity: 0.6 }));
    g.add(box(0.5, 0.1, 0.02, 0xffffff, -0.05, 0.3, 0.345));
    g.scale.setScalar(size); g.userData.h = 0.85 * size;
    return g;
  },
  // Praça: piso de pedra, canteiros, árvore e bancos.
  plaza(world, size) {
    const g = new THREE.Group();
    g.add(box(0.92, 0.03, 0.92, 0xd9d2c3));
    g.add(box(0.5, 0.032, 0.5, 0xc8bfae));
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) g.add(part(world, SUB + 'planter', 0.24, x, z, x * z > 0 ? 0 : Math.PI / 2));
    g.add(part(world, NAT + 'tree_oak', 0.4, 0, 0));
    for (const [x, z, r] of [[0, -0.36, 0], [0, 0.36, 0], [-0.36, 0, Math.PI / 2], [0.36, 0, Math.PI / 2]]) {
      const bench = new THREE.Group();
      bench.add(box(0.2, 0.03, 0.06, 0xb07a45, 0, 0.05, 0), box(0.2, 0.06, 0.015, 0xb07a45, 0, 0.08, -0.03));
      bench.position.set(x, 0, z); bench.rotation.y = r; g.add(bench);
    }
    g.userData.h = 0.5;
    return g;
  },
  // Chafariz: tanque de pedra com água e jato.
  fountain(world, size) {
    const g = new THREE.Group();
    g.add(box(0.94, 0.02, 0.94, 0xd9d2c3));
    g.add(cyl(0.4, 0.42, 0.12, 0xbfb7a6, 0, 0.02, 0, 24));
    g.add(cyl(0.35, 0.35, 0.02, 0x5bc0eb, 0, 0.12, 0, 24, { roughness: 0.2, metalness: 0.1 }));
    g.add(cyl(0.06, 0.08, 0.28, 0xbfb7a6, 0, 0.12, 0, 12));
    g.add(cyl(0.16, 0.16, 0.03, 0xbfb7a6, 0, 0.36, 0, 18));
    const jet = cyl(0.01, 0.07, 0.2, 0xd6f3ff, 0, 0.39, 0, 10, { transparent: true, opacity: 0.75, roughness: 0.1 });
    jet.name = 'jet'; g.add(jet);
    for (const [x, z] of [[-0.4, -0.4], [0.4, 0.4]]) g.add(part(world, NAT + 'plant_bush', 0.16, x, z));
    g.userData.h = 0.6;
    return g;
  },
  // Estádio: campo, arquibancadas coloridas e torres de luz.
  stadium(world, size) {
    const g = new THREE.Group();
    g.add(box(1.92, 0.03, 1.92, 0xc8c2b4));
    g.add(box(1.1, 0.04, 0.7, 0x4caf50, 0, 0.03));
    for (let k = 0; k < 5; k++) g.add(box(0.1, 0.041, 0.7, 0x5cbf60, -0.4 + k * 0.2, 0.03));
    g.add(box(1.1, 0.042, 0.01, 0xffffff, 0, 0.03, 0)); g.add(box(0.01, 0.042, 0.7, 0xffffff, 0, 0.03, 0));
    const stand = (w, d, x, z, r, c) => {
      const s = new THREE.Group();
      for (let k = 0; k < 3; k++) s.add(box(w, 0.08 + k * 0.08, d / 3, k % 2 ? c : 0xffffff, 0, 0, -k * d / 3));
      s.position.set(x, 0.03, z); s.rotation.y = r; g.add(s);
    };
    stand(1.3, 0.36, 0, -0.58, 0, 0xe53935); stand(1.3, 0.36, 0, 0.58, Math.PI, 0x1e88e5);
    stand(0.9, 0.36, -0.78, 0, Math.PI / 2, 0x1e88e5); stand(0.9, 0.36, 0.78, 0, -Math.PI / 2, 0xe53935);
    for (const [x, z] of [[-0.88, -0.88], [0.88, -0.88], [-0.88, 0.88], [0.88, 0.88]]) {
      g.add(cyl(0.02, 0.025, 0.8, 0x9aa5b1, x, 0.03, z, 6));
      g.add(box(0.14, 0.08, 0.04, 0xfafafa, x, 0.82, z, { emissive: 0xffffcc, emissiveIntensity: 0.4 }));
    }
    g.scale.setScalar(size / 2); g.userData.h = 0.9 * size / 2;
    return g;
  },
  // Aeroporto: pista, terminal, torre de controle e avião.
  airport(world, size) {
    const g = new THREE.Group();
    g.add(box(1.94, 0.02, 1.94, 0x9ccc65));
    g.add(box(1.9, 0.03, 0.42, 0x4a4f57, 0, 0, 0.55));
    for (let k = 0; k < 7; k++) g.add(box(0.14, 0.032, 0.03, 0xffffff, -0.78 + k * 0.26, 0, 0.55));
    const term = world.fit(world.model(COM + 'building-e', COM + 'Textures/variation-b'), 1.1, 1);
    term.position.set(-0.3, 0, -0.45); g.add(term);
    g.add(cyl(0.07, 0.09, 0.85, 0xeceff1, 0.6, 0, -0.45, 12));
    g.add(cyl(0.16, 0.12, 0.14, 0x81d4fa, 0.6, 0.85, -0.45, 12, { roughness: 0.15, metalness: 0.2 }));
    g.add(cyl(0.17, 0.17, 0.03, 0x37474f, 0.6, 0.99, -0.45, 12));
    // avião
    const plane = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 4, 10), mat(0xffffff)); body.rotation.z = Math.PI / 2; body.position.y = 0.1; body.castShadow = true;
    plane.add(body, box(0.14, 0.012, 0.62, 0xffffff, 0, 0.08, 0), box(0.06, 0.12, 0.012, 0x2e7dff, -0.26, 0.1, 0), box(0.06, 0.01, 0.2, 0xffffff, -0.27, 0.15, 0));
    plane.position.set(0.15, 0.03, 0.55); g.add(plane);
    g.userData.h = 1.05 * size / 2;
    g.scale.setScalar(size / 2);
    return g;
  },
};

export function buildCustom(name, world, size, id) {
  return (CUSTOM[name] || BUILDS[name])(world, size, id);
}

// ---------------------------------------------------------------- catálogo por tipo
export const CATALOG = {
  townhall: [{ custom: 'townhall', fixed: true }],
  warehouse: [{ custom: 'warehouse', fixed: true }],
  sawmill: [{ custom: 'sawmill', fixed: true }],
  kiln: [{ custom: 'kiln', fixed: true }],
  glassworks: [{ custom: 'glassworks', fixed: true }],
  carpentry: [{ custom: 'carpentry', fixed: true }],
  steelworks: [{ custom: 'steelworks', fixed: true }],
  lot: [],
  house1: vary([SUB + 'building-type-h', SUB + 'building-type-i', SUB + 'building-type-g', SUB + 'building-type-m'], subTex),
  house2: vary([SUB + 'building-type-a', SUB + 'building-type-c', SUB + 'building-type-j', SUB + 'building-type-o'], subTex),
  house3: vary([SUB + 'building-type-e', SUB + 'building-type-k', SUB + 'building-type-r', SUB + 'building-type-s', SUB + 'building-type-u'], subTex),
  house4: vary([SUB + 'building-type-f', SUB + 'building-type-n', SUB + 'building-type-t', SUB + 'building-type-b'], subTex, { fill: 0.7, pool: true }),
  house5: vary([COM + 'building-c', COM + 'building-d', COM + 'building-a', COM + 'building-h'], comTex, { fill: 0.8 }),
  house6: vary([COM + 'building-f', COM + 'building-g', COM + 'building-l', COM + 'building-i'], comTex, { fill: 0.8 }),
  house7: vary([COM + 'building-skyscraper-a', COM + 'building-skyscraper-b', COM + 'building-skyscraper-c', COM + 'building-skyscraper-e'], [''], { fill: 0.78 }),
  bakery: [{ custom: 'bakery', fixed: true }],
  market: [{ custom: 'market', fixed: true }],
  clothes: [{ custom: 'clothes', fixed: true }],
  mall: [{ custom: 'mall', fixed: true }],
  school: [{ custom: 'school', fixed: true }],
  clinic: [{ custom: 'clinic', fixed: true }],
  firehouse: [{ custom: 'firehouse', fixed: true }],
  hospital: [{ custom: 'hospital', fixed: true }],
  tree: vary([NAT + 'tree_oak', NAT + 'tree_default', NAT + 'tree_detailed', NAT + 'tree_fat', NAT + 'tree_cone'], [''], { fill: 0.7, maxH: 0.78 }),
  plaza: [{ custom: 'plaza', fixed: true }],
  fountain: [{ custom: 'fountain', fixed: true }],
  stadium: [{ custom: 'stadium', fixed: true }],
  airport: [{ custom: 'airport', fixed: true }],
};

// ---------------------------------------------------------------- lotes de produção
// [modelo | (world)=>mesh, x, z, tamanho, giro, tinta] — coordenadas a partir do centro.
const SPOTS4 = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
function mound(color, r, h, x, z) {
  return () => { const m = new THREE.Mesh(geo(`cone${r},${h}`, () => new THREE.ConeGeometry(r, h, 9)), mat(color, { flatShading: true })); m.position.set(x, 0.06 + h / 2, z); m.castShadow = m.receiveShadow = true; return m; };
}
export function LOT_PARTS(res, stage) {
  const grow = [0.35, 0.6, 0.85, 1][stage];
  if (res === 'none' || !res) return [[NAT + 'crops_dirtDoubleRow', 0, 0, 0.78, 0]];
  if (res === 'wood') {
    const out = SPOTS4.map(([x, z], k) => [NAT + (stage === 3 ? 'tree_default' : 'tree_small'), x, z, 0.32 * grow, k]);
    if (stage === 3) out.push([NAT + 'log_stack', 0.02, 0.33, 0.26, Math.PI / 2]);
    return out;
  }
  if (res === 'clay') {
    const out = [[NAT + 'crops_dirtRow', 0, -0.18, 0.7, 0], [NAT + 'crops_dirtRow', 0, 0.18, 0.7, 0]];
    for (const [x, z] of SPOTS4.slice(0, stage + 1)) out.push([mound(0xb5653a, 0.12 * grow + 0.04, 0.16 * grow + 0.04, x, z)]);
    return out;
  }
  if (res === 'sand') {
    const out = [[mound(0xe9cf8f, 0.22 * grow + 0.05, 0.22 * grow + 0.04, -0.08, -0.05)]];
    if (stage >= 2) out.push([mound(0xf1dca6, 0.14, 0.14, 0.22, 0.22)]);
    if (stage === 3) out.push([mound(0xe2c27c, 0.12, 0.12, -0.25, 0.25)]);
    return out;
  }
  if (res === 'iron') {
    const out = [[NAT + 'rock_largeA', -0.08, -0.05, 0.42 * (0.6 + grow * 0.4), 0.3]];
    for (const [x, z] of SPOTS4.slice(0, stage + 1)) out.push([NAT + 'rock_smallC', x, z, 0.16, x * 9, stage === 3 ? 0xe39a5a : null]);
    return out;
  }
  return [];
}

export const OBSTACLE_PARTS = {
  bush: [[NAT + 'plant_bushDetailed', 0.5, 0.48, 0.6, 0], [NAT + 'plant_bushSmall', 0.2, 0.75, 0.28, 1]],
  rubble: [[NAT + 'rock_smallA', 0.45, 0.5, 0.34, 0], [NAT + 'rock_smallC', 0.72, 0.32, 0.24, 1], [NAT + 'stump_old', 0.28, 0.25, 0.22, 2]],
  car: [['cars/sedan', 0.5, 0.5, 0.62, 0.7, 0x9a8f80]],
};

export const CAR_MODELS = ['cars/sedan', 'cars/taxi', 'cars/van', 'cars/suv', 'cars/hatchback-sports', 'cars/police', 'cars/delivery', 'cars/sedan-sports', 'cars/truck'];
export const MISC_MODELS = { lamp: 'roads/light-square' };

// Todos os arquivos GLB usados (carregados uma vez na abertura).
export function modelFiles() {
  const set = new Set([...CAR_MODELS, MISC_MODELS.lamp, 'roads/road-straight', 'roads/road-crossroad']);
  for (const list of Object.values(CATALOG)) for (const v of list) if (v.m) set.add(v.m);
  for (const res of ['none', 'wood', 'clay', 'sand', 'iron']) for (const st of [0, 1, 2, 3]) for (const p of LOT_PARTS(res, st)) if (typeof p[0] === 'string') set.add(p[0]);
  for (const list of Object.values(OBSTACLE_PARTS)) for (const p of list) set.add(p[0]);
  [SUB + 'planter', NAT + 'tree_oak', NAT + 'plant_bushDetailed', NAT + 'plant_bush', NAT + 'log_stackLarge', COM + 'detail-parasol-a',
    COM + 'building-e', IND + 'building-m', IND + 'shipping-container-a', IND + 'shipping-container-b', IND + 'shipping-container-c',
    NAT + 'log_stack', 'cars/ambulance', 'cars/sedan', 'cars/taxi', 'cars/suv', 'cars/hatchback-sports',
    NAT + 'tree_default', NAT + 'tree_detailed', NAT + 'tree_fat', NAT + 'tree_cone', NAT + 'tree_pineRoundA', NAT + 'grass', NAT + 'grass_large'].forEach(f => set.add(f));
  return [...set];
}

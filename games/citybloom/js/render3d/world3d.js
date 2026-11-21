// world3d.js — a cidade em 3D (Three.js + modelos low-poly CC0 do Kenney).
//
// A câmera é ortográfica com elevação de 30° e girada 45°: assim o chão 3D cai
// exatamente na mesma grade isométrica 2:1 do jogo (engine/iso.js). Tile (i, j)
// ocupa [i, i+1] × [j, j+1] no plano XZ. Por isso Camera (x, y, zoom), o toque,
// fitView, os efeitos flutuantes e as bolhas continuam valendo como antes.
//
// Este módulo só desenha. Regras e estado ficam em game/.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS, MAP, phaseIndex } from '../game/config.js';
import { lotProgress } from '../game/economy.js';
import { makeVehicle } from './vehicles.js';
import { People } from './people.js';
import { buildGround, buildForest, buildFence, buildMist, buildGrid, buildRoads3D, animateWater, animateMist } from './terrain3d.js';
import { CATALOG, LOT_PARTS, OBSTACLE_PARTS, CAR_MODELS, MISC_MODELS, buildCustom, modelFiles } from './catalog.js';
export { modelFiles };

const K = 32 * Math.SQRT2;                 // px (mundo 2D) por unidade 3D no chão
const ELEV = Math.PI / 6;                  // 30° → projeção 2:1
export const HPX = Math.cos(ELEV) * K;     // px 2D por unidade de altura (~39,2)
const DIR = new THREE.Vector3(Math.cos(ELEV) / Math.SQRT2, Math.sin(ELEV), Math.cos(ELEV) / Math.SQRT2);

const NAT = 'nature/';
const SCENERY_TREES = [NAT + 'tree_oak', NAT + 'tree_default', NAT + 'tree_detailed', NAT + 'tree_fat', NAT + 'tree_cone', NAT + 'tree_pineRoundA'];
// Recursos compartilhados (marcados .userData.shared) nunca são liberados;
// o resto é liberado com disposeTree() quando o objeto sai da cena.
const shared = (x) => { x.userData.shared = true; return x; };
const PUFF_GEO = shared(new THREE.IcosahedronGeometry(0.06, 0));
const PUFF_MAT = shared(new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 1, transparent: true, opacity: 0.82, flatShading: true }));
const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, shared(make())); return cache.get(key); };
function boxMesh(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(once(`bg${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
    once(`bm${color}${JSON.stringify(opts)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts })));
  m.position.y = h / 2; m.castShadow = m.receiveShadow = true; return m;
}
// Material tingido (cache por material + cor).
function tinted(material, tint) {
  return once(`tint${material.uuid}${tint}`, () => { const m = material.clone(); m.color.multiply(new THREE.Color(tint)); return m; });
}
function disposeTree(root) {
  if (!root) return;
  root.traverse(o => {
    if (!o.isMesh && !o.isLineSegments) return;
    if (o.isInstancedMesh) o.dispose();                 // buffers de instância
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    for (const m of [].concat(o.material)) {
      if (!m || m.userData.shared) continue;
      for (const k of ['map', 'alphaMap', 'emissiveMap']) if (m[k] && !m[k].userData.shared) m[k].dispose();
      m.dispose();
    }
  });
}
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// Junta as malhas fixas (chão, ruas, enfeites) em poucas malhas, uma por material:
// muito menos chamadas de desenho, o que pesa sobretudo no celular.
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map(), keep = [];
  group.traverse(o => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) { keep.push(o); return; }
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld);
    const sig = o.material.uuid + '|' + Object.keys(g.attributes).sort().join(',') + '|' + o.castShadow;
    if (!buckets.has(sig)) buckets.set(sig, { mat: o.material, cast: o.castShadow, geos: [] });
    buckets.get(sig).geos.push(g);
  });
  const out = new THREE.Group();
  for (const o of keep) {
    const c = o.clone(false);
    o.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    out.add(c);
  }
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos, false);
    if (!geo) continue;
    const m = new THREE.Mesh(geo, b.mat);
    m.castShadow = b.cast; m.receiveShadow = true;
    out.add(m);
  }
  return out;
}

export class World3D {
  static supported() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; }
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.ready = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
    this.target = new THREE.Vector3();

    // luz: céu + sol quente com sombra
    this.hemi = new THREE.HemisphereLight(0xdff2ff, 0x6f8f5a, 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.root = new THREE.Group(); this.scene.add(this.root);       // objetos
    this.groundGroup = new THREE.Group(); this.scene.add(this.groundGroup);
    this.carGroup = new THREE.Group(); this.scene.add(this.carGroup);
    this.objs = new Map();           // id → { g, key, born, bump }
    this.models = new Map();         // 'kit/name' → gltf.scene
    this.texVariants = new Map();    // 'kit/variation-a' → Texture
    this.matCache = new Map();
    this.heights = new Map();        // id → altura (unidades 3D)
    this.typeHeight = {};            // tipo → altura média (miniaturas/bolhas sem objeto)
    this.firstSync = true;
    this.groundKey = '';
    this.roadKey = '';
    this.ghost = null; this.ghostKey = '';
    this.selMesh = null;
  }

  // ------------------------------------------------------------------ carregamento
  async load(onProgress = () => {}) {
    const loader = new GLTFLoader();
    const files = modelFiles();
    const texFiles = [...new Set(Object.values(CATALOG).flat().map(v => v.tex).filter(Boolean))];
    const total = files.length + texFiles.length;
    let done = 0;
    const tick = () => onProgress(++done / total);
    const texLoader = new THREE.TextureLoader();
    await Promise.all([
      ...files.map(f => loader.loadAsync(`assets/models/${f}.glb`).then(g => {
        g.scene.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          shared(o.geometry);
          for (const m of [].concat(o.material)) {
            shared(m); if (m.map) shared(m.map);
            if (m.metalness > 0.3) m.metalness = 0;
            m.roughness = Math.max(m.roughness, 0.7);
            const nm = (m.name || '').toLowerCase();
            if (f.startsWith('nature/')) {           // folhas verde-água → verde-grama
              if (/leaf|grass/.test(nm) && !/fall|dark/.test(f)) m.color.set(nm.includes('grass') ? 0x67b84a : 0x58b043);
              else if (/rock|stone/.test(f) && nm === 'dirt') m.color.set(0x9da5ad);
              else if (/bark|wood|dirt/.test(nm)) m.color.set(0x9a6239);
            }
          }
        });
        this.models.set(f, g.scene); tick();
      }).catch(e => { console.warn('[3d] modelo', f, e && e.message); tick(); })),
      ...texFiles.map(f => texLoader.loadAsync(`assets/models/${f}.png`).then(t => {
        t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; this.texVariants.set(f, shared(t)); tick();
      }).catch(() => tick())),
    ]);
    this._buildStatic();
    this.ready = true;
  }

  // Clona um modelo (geometria compartilhada) com a textura de variação.
  model(name, tex) {
    const src = this.models.get(name);
    if (!src) return new THREE.Group();
    const g = src.clone(true);
    if (tex && this.texVariants.has(tex)) {
      g.traverse(o => {
        if (!o.isMesh) return;
        const key = o.material.uuid + '|' + tex;
        let m = this.matCache.get(key);
        if (!m) { m = shared(o.material.clone()); m.map = this.texVariants.get(tex); this.matCache.set(key, m); }
        o.material = m;
      });
    }
    return g;
  }

  // Encaixa um grupo no quadrado size×size (centro no chão, base em y=0).
  fit(g, size, fill = 0.88, maxH = Infinity) {
    const box = new THREE.Box3().setFromObject(g);
    const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    let k = (size * fill) / Math.max(s.x, s.z, 0.01);
    if (s.y * k > maxH) k = maxH / s.y;
    const wrap = new THREE.Group();
    g.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    g.scale.setScalar(k);
    wrap.add(g);
    wrap.userData.h = s.y * k;
    return wrap;
  }

  // ------------------------------------------------------------------ chão estático
  _buildStatic() {}

  // Fase visual: 0 terra, 1 paralelepípedo, 2+ asfalto (muda chão, cerca, ruas e postes).
  _phase(state) { return state.showcase ? 3 : phaseIndex(state.level || 1); }

  _buildGround(state) {
    const n = state.size, ph = this._phase(state);
    const key = n + '|' + Math.min(ph, 2) + '|' + state.tiles.map(t => (t.obstacle ? 2 : t.locked ? 1 : 0)).join('');
    if (key === this.groundKey) return;
    this.groundKey = key;
    for (const gr of [this.groundGroup, this.forestGroup, this.fenceGroup]) if (gr) { disposeTree(gr); gr.clear(); }
    if (!this.forestGroup) { this.forestGroup = new THREE.Group(); this.fenceGroup = new THREE.Group(); this.scene.add(this.forestGroup, this.fenceGroup); }
    // névoa da borda (uma vez por tamanho de mapa)
    if (this.mistN !== n) {
      if (this.mist) { this.scene.remove(this.mist); disposeTree(this.mist); }
      this.mist = buildMist(n); this.mistN = n; this.scene.add(this.mist);
    }
    // chão (grama, praia, mar, rio e, nas fases 0–1, as ruas de terra / pedra)
    const gnd = buildGround(state, ph);
    this.water = gnd.water;
    this.groundGroup.add(gnd.group);
    this.forestGroup.add(buildForest(state));
    this.fenceGroup.add(buildFence(state, ph));
    // enfeites miúdos e obstáculos (mesclados)
    const deco = new THREE.Group();
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const t = state.tiles[j * n + i];
      if (!t.obstacle) {
        if (t.kind !== 'grass' || t.locked) continue;
        const h = hash(i, j, 21);
        if (h < 0.16) {
          const m = this.fit(this.model(NAT + (h < 0.08 ? 'grass_large' : 'grass')), 0.22, 1);
          m.position.set(i + 0.08 + hash(i, j, 26) * 0.14, 0, j + 0.08 + hash(i, j, 27) * 0.14);
          m.traverse(q => { if (q.isMesh) q.castShadow = false; });
          deco.add(m);
        }
        continue;
      }
      const g = new THREE.Group();
      for (const [name, x, z, s, r, tint] of OBSTACLE_PARTS[t.obstacle] || []) {
        const m = this.fit(this.model(name), s);
        if (tint) m.traverse(q => { if (q.isMesh) q.material = tinted(q.material, tint); });
        m.position.set(x, 0, z); m.rotation.y = r + hash(i, j, 5) * 0.6;
        g.add(m);
      }
      g.position.set(i, 0, j);
      deco.add(g);
    }
    this.groundGroup.add(mergeStatic(deco));
    disposeTree(deco);
    if (this.gridMesh) { this.scene.remove(this.gridMesh); disposeTree(this.gridMesh); this.gridMesh = null; }
    this.roadKey = '';
  }

  _buildRoads(state) {
    const n = state.size, ph = this._phase(state);
    const key = n + '|' + ph + '|' + state.tiles.map(t => (t.kind === 'road' ? 1 : 0)).join('');
    if (key === this.roadKey) return;
    this.roadKey = key;
    if (this.roadGroup) { this.scene.remove(this.roadGroup); disposeTree(this.roadGroup); }
    const g = buildRoads3D(this, state, ph);
    this.roadGroup = mergeStatic(g);
    this.scene.add(this.roadGroup);
  }

  // Grade de construção: só aparece ao posicionar/mover.
  _grid(state, show) {
    if (show && !this.gridMesh) { this.gridMesh = buildGrid(state); this.scene.add(this.gridMesh); }
    if (this.gridMesh) this.gridMesh.visible = !!show;
  }

  // ------------------------------------------------------------------ objetos
  _variant(o) {
    const list = CATALOG[o.type];
    if (!list || !list.length) return null;
    return list[Math.floor(hash(o.id, 11) * list.length)];
  }

  _objKey(o, now) {
    const def = BUILDINGS[o.type];
    if (def.type === 'lot') {
      const stage = !o.resource ? 0 : (now >= o.readyAt ? 3 : Math.min(2, Math.floor(lotProgress(o, now) * 3)));
      return `lot:${o.resource || ''}:${stage}`;
    }
    if (o.type === 'townhall') return 'townhall:' + this.curPhase;
    if (o.type === 'warehouse') return 'warehouse:' + this.curWh;
    if (def.type === 'house' && o.size === 1) return o.type + ':' + (this.curPhase <= 1 ? 0 : this.curPhase >= 3 ? 2 : 1);
    return o.type;
  }

  _makeObject(o, key) {
    const def = BUILDINGS[o.type];
    let g;
    if (def.type === 'lot') g = this._makeLot(key, o.id);
    else {
      const v = this._variant(o);
      if (v && v.custom) g = buildCustom(v.custom, this, o.size, o.id);
      else if (v) {
        const inner = this.model(v.m, v.tex);
        if (v.rot) inner.rotation.y = v.rot;
        g = this.fit(inner, o.size, v.fill || 0.86, v.maxH || Infinity);
        if (v.extra) v.extra(g, this, o.size, o.id);
        if (v.pool) {                       // casa com piscina: casa atrás, piscina na frente
          const h = g.userData.h;
          g.children[0].position.x -= 0.12; g.children[0].position.z -= 0.12;
          const pool = new THREE.Group();
          pool.add(boxMesh(0.36, 0.035, 0.3, 0xf2f2f2), boxMesh(0.3, 0.036, 0.24, 0x29b6f6, { roughness: 0.15, metalness: 0.1 }));
          pool.position.set(0.24, 0, 0.26);
          const w = new THREE.Group(); w.add(g, pool); w.userData.h = h; g = w;
        }
      } else g = new THREE.Group();
      // gira 0°/90° para variar (as duas faces viradas para a câmera)
      if (!(v && v.fixed)) g.rotation.y = hash(o.id, 7) < 0.5 ? 0 : Math.PI / 2;
    }
    const outer = new THREE.Group();
    outer.add(g);
    if (def.type === 'house' && o.size === 1) this._houseYard(outer, key, o.id);
    outer.userData.h = g.userData.h || 0.8;
    // partes animadas: fumaça, bandeira, serra, jato d'água
    const fx = [];
    outer.traverse(q => {
      if (q.name === 'smoke') {
        const k = q.userData.k || 1;
        for (let n = 0; n < 3; n++) { const p = new THREE.Mesh(PUFF_GEO, PUFF_MAT); p.castShadow = false; q.add(p); }
        fx.push({ kind: 'smoke', o: q, k });
      } else if (q.name === 'flag' || q.name === 'spin' || q.name === 'jet') fx.push({ kind: q.name, o: q });
    });
    outer.userData.fx = fx;
    return outer;
  }

  // Quintal das casas conforme a fase: cerquinha de madeira e horta no vilarejo,
  // nada a mais na cidade pequena, caixa de correio e arbusto podado nas cidades grandes.
  _houseYard(g, key, id) {
    const st = Number(key.split(':')[1] || 1);
    if (st === 1) return;
    if (st === 0) {
      const wood = 0xc69460;
      g.add(boxMesh(0.9, 0.012, 0.012, wood).translateX(0).translateY(0.05).translateZ(0.46));
      g.add(boxMesh(0.012, 0.012, 0.9, wood).translateX(0.46).translateY(0.05));
      for (let k = 0; k < 5; k++) { g.add(boxMesh(0.02, 0.08, 0.02, wood).translateX(-0.44 + k * 0.22).translateZ(0.46)); g.add(boxMesh(0.02, 0.08, 0.02, wood).translateX(0.46).translateZ(-0.44 + k * 0.22)); }
      if (hash(id, 41) < 0.5) for (let k = 0; k < 3; k++) g.add(boxMesh(0.05, 0.035, 0.05, 0x5aa83a).translateX(-0.36 + k * 0.08).translateZ(0.38));
    } else {
      g.add(boxMesh(0.025, 0.09, 0.025, 0x555b66).translateX(0.4).translateZ(0.42));
      g.add(boxMesh(0.05, 0.035, 0.07, hash(id, 42) < 0.5 ? 0x2f66c0 : 0xc0392b).translateX(0.4).translateY(0.09).translateZ(0.42));
      g.add(boxMesh(0.16, 0.07, 0.07, 0x3f8f3a).translateX(-0.3).translateZ(0.42));
    }
  }

  // Obra: andaime e poeira por ~1 s quando algo é construído ou evolui.
  _scaffold(o, t) {
    const g = new THREE.Group(), s = o.size, h = Math.min(1.2, (this.heights.get(o.id) || 0.6) * 0.9);
    const pole = 0xd9a441, plank = 0xb07c4a;
    for (const [x, z] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]]) g.add(boxMesh(0.025, h, 0.025, pole).translateX(x * s).translateZ(z * s));
    for (const y of [h * 0.45, h * 0.9]) {
      g.add(boxMesh(0.98 * s, 0.02, 0.05, plank).translateY(y).translateZ(0.48 * s));
      g.add(boxMesh(0.05, 0.02, 0.98 * s, plank).translateY(y).translateX(0.48 * s));
    }
    const dust = [];
    for (let k = 0; k < 10; k++) { const p = new THREE.Mesh(PUFF_GEO, PUFF_MAT); p.castShadow = false; p.userData.a = k / 10 * Math.PI * 2; g.add(p); dust.push(p); }
    g.position.set(o.i + s / 2, 0, o.j + s / 2);
    this.root.add(g);
    (this.works || (this.works = [])).push({ g, t0: t, dust, s });
  }
  _works(t) {
    if (!this.works) return;
    this.works = this.works.filter(w => {
      const a = (t - w.t0) / 1.2;
      if (a >= 1) { this.root.remove(w.g); disposeTree(w.g); return false; }
      w.g.scale.y = a < 0.15 ? a / 0.15 : a > 0.8 ? Math.max(0.01, (1 - a) / 0.2) : 1;
      for (const p of w.dust) {
        const r = (0.3 + a * 0.6) * w.s;
        p.position.set(Math.cos(p.userData.a) * r, 0.04 + a * 0.1, Math.sin(p.userData.a) * r);
        p.scale.setScalar(Math.max(0.01, (1 - a) * 2.2 * w.s));
      }
      return true;
    });
  }

  _makeLot(key, id) {
    const [, res, st] = key.split(':'); const stage = Number(st);
    const g = new THREE.Group();
    // canteiro de terra com borda de madeira
    const soil = new THREE.Mesh(once('lotSoilG', () => new THREE.BoxGeometry(0.86, 0.06, 0.86)), once('lotSoilM', () => new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 1 })));
    soil.position.y = 0.03; soil.receiveShadow = true; g.add(soil);
    const wood = once('lotWoodM', () => new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.9 }));
    for (const [x, z, w, d] of [[0, -0.45, 0.94, 0.06], [0, 0.45, 0.94, 0.06], [-0.45, 0, 0.06, 0.94], [0.45, 0, 0.06, 0.94]]) {
      const b = new THREE.Mesh(once(`lotB${w},${d}`, () => new THREE.BoxGeometry(w, 0.1, d)), wood); b.position.set(x, 0.05, z); b.castShadow = b.receiveShadow = true; g.add(b);
    }
    const parts = LOT_PARTS(res || 'none', stage);
    for (const [name, x, z, s, r, tint] of parts) {
      const m = typeof name === 'function' ? name(this) : this.fit(this.model(name), s);
      if (typeof name !== 'function') { m.position.set(x, 0.06, z); m.rotation.y = r || 0; }
      if (tint) m.traverse(q => { if (q.isMesh) q.material = tinted(q.material, tint); });
      g.add(m);
    }
    g.userData.h = stage === 3 ? 0.55 : 0.35;
    return g;
  }

  _sync(state, now, t) {
    const seen = new Set();
    for (const o of state.objects) {
      seen.add(o.id);
      const key = this._objKey(o, now);
      let e = this.objs.get(o.id);
      if (!e || e.key !== key) {
        if (e) { this.root.remove(e.g); disposeTree(e.g); }
        const g = this._makeObject(o, key);
        const grow = e ? e.key.startsWith('lot:') && key.startsWith('lot:') ? 0.25 : 0.45 : (this.firstSync ? 0 : 0.6);
        // obra só para prédio novo ou que mudou de modelo (não para lote mudando de estágio)
        const work = !this.firstSync && !key.startsWith('lot:') && (!e || e.key.split(':')[0] !== key.split(':')[0] || (key.startsWith('townhall') || key.startsWith('warehouse')));
        e = { g, key, born: grow ? t : -99, grow, bump: -99, fx: g.userData.fx, seed: hash(o.id, 31) * 10 };
        this.objs.set(o.id, e);
        this.root.add(g);
        this.heights.set(o.id, g.userData.h);
        if (work) this._scaffold(o, t);
      }
      e.g.position.set(o.i + o.size / 2, 0, o.j + o.size / 2);
      e.o = o;
    }
    for (const [id, e] of this.objs) if (!seen.has(id)) { this.root.remove(e.g); disposeTree(e.g); this.objs.delete(id); this.heights.delete(id); }
    this.firstSync = false;
  }

  // Animações: surgir com "pulo" e balançar ao coletar.
  _animate(t) {
    for (const e of this.objs.values()) {
      let sx = 1, sy = 1;
      const a = t - e.born;
      if (a >= 0 && a < e.grow) {
        const p = a / e.grow;
        const el = 1 - Math.pow(2, -10 * p) * Math.cos(p * Math.PI * 3.2);   // elástico
        sx = sy = Math.max(0.01, el);
      }
      const b = t - e.bump;
      if (b >= 0 && b < 0.45) { const w = Math.sin(b * 30) * (1 - b / 0.45) * 0.09; sy *= 1 + w; sx *= 1 - w * 0.5; }
      e.g.scale.set(sx, sy, sx);
      if (e.fx) for (const f of e.fx) {
        const T = t + e.seed;
        if (f.kind === 'smoke') {
          f.o.children.forEach((p, n) => {
            const ph = (T * 0.45 + n / 3) % 1;
            p.position.set(ph * 0.12 * f.k, ph * 0.55 * f.k, -ph * 0.05 * f.k);
            p.scale.setScalar(Math.max(0.001, Math.sin(ph * Math.PI) * (0.5 + ph) * f.k));
          });
        } else if (f.kind === 'flag') f.o.rotation.y = Math.sin(T * 3.1) * 0.35;
        else if (f.kind === 'spin') f.o.rotation.y = T * 6;
        else if (f.kind === 'jet') f.o.scale.y = 1 + Math.sin(T * 7) * 0.18;
      }
    }
  }

  bump(i, j, t) {
    for (const e of this.objs.values()) {
      const o = e.o; if (!o) continue;
      if (i >= o.i && i < o.i + o.size && j >= o.j && j < o.j + o.size) { e.bump = t; return; }
    }
  }

  // Altura em px do mundo 2D (bolhas, toque).
  heightPx(o) {
    const h = this.heights.get(o.id);
    return (h == null ? 0.8 : h) * HPX;
  }

  // ------------------------------------------------------------------ carros
  _cars(traffic) {
    // pool de malhas por tipo de veículo (reaproveitadas quando um sai e outro entra)
    const items = traffic.items();
    if (!this.vpool) this.vpool = new Map();
    const used = new Map();
    for (const c of items) {
      let list = this.vpool.get(c.kind);
      if (!list) { list = []; this.vpool.set(c.kind, list); }
      const k = used.get(c.kind) || 0; used.set(c.kind, k + 1);
      if (!list[k]) { const m = makeVehicle(this, c.kind); this.carGroup.add(m); list[k] = m; }
      const m = list[k];
      m.visible = true; m.position.set(c.x, 0.02 + (c.lift || 0), c.z); m.rotation.y = c.yaw;
    }
    for (const [kind, list] of this.vpool) for (let k = used.get(kind) || 0; k < list.length; k++) list[k].visible = false;
    if (!this.people) this.people = new People(this.scene);
    this.people.update(traffic.peopleItems());
  }

  // ------------------------------------------------------------------ seleção e fantasma
  _selection(sel) {
    if (!this.selMesh) {
      this.selMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.45, depthWrite: false }));
      this.selMesh.rotation.x = -Math.PI / 2;
      this.scene.add(this.selMesh);
    }
    if (!sel) { this.selMesh.visible = false; return; }
    const [i, j, s] = sel.kind === 'object' ? [sel.obj.i, sel.obj.j, sel.obj.size] : [sel.i, sel.j, 1];
    this.selMesh.visible = true;
    this.selMesh.scale.set(s, s, 1);
    this.selMesh.position.set(i + s / 2, 0.012, j + s / 2);
  }

  _ghost(gh, t) {
    const key = gh ? gh.type + (gh.moving ? ':' + this._objKey(gh.moving, Date.now()) : '') : '';
    if (key !== this.ghostKey) {
      if (this.ghost) { this.scene.remove(this.ghost); disposeTree(this.ghost); }
      this.ghost = null; this.ghostKey = key;
      if (gh) {
        const fake = gh.moving || { id: 1, type: gh.type, size: BUILDINGS[gh.type].size, resource: null };
        const g = this._makeObject(fake, gh.moving ? this._objKey(gh.moving, Date.now()) : (BUILDINGS[gh.type].type === 'lot' ? 'lot::0' : gh.type));
        g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.userData = {}; o.material.transparent = true; o.material.opacity = 0.7; o.castShadow = false; } });
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x34c759, transparent: true, opacity: 0.45, depthWrite: false }));
        pad.rotation.x = -Math.PI / 2; pad.position.y = 0.014; pad.name = 'pad';
        g.add(pad);
        this.ghost = g; this.scene.add(g);
      }
    }
    if (!this.ghost) return;
    const s = BUILDINGS[gh.type].size;
    this.ghost.position.set(gh.i + s / 2, 0.02 + Math.abs(Math.sin(t * 4)) * 0.05, gh.j + s / 2);
    const pad = this.ghost.getObjectByName('pad');
    pad.scale.set(s, s, 1); pad.position.y = -0.006;
    pad.material.color.set(gh.valid ? 0x34c759 : 0xff3b30);
  }

  // ------------------------------------------------------------------ quadro
  setSize(w, h, dpr) {
    this.renderer.setPixelRatio(Math.min(dpr || 1, this.dprCap || 2));
    this.renderer.setSize(w, h, false);
  }

  _camera(cam) {
    const ppu = K * cam.zoom;
    const c = this.camera;
    c.left = -cam.vw / 2 / ppu; c.right = cam.vw / 2 / ppu;
    c.top = cam.vh / 2 / ppu; c.bottom = -cam.vh / 2 / ppu;
    const gi = (cam.x / 32 + cam.y / 16) / 2, gj = (cam.y / 16 - cam.x / 32) / 2;
    this.target.set(gi, 0, gj);
    c.position.copy(this.target).addScaledVector(DIR, 120);
    c.lookAt(this.target);
    c.updateProjectionMatrix();
    // sol acompanha a área visível
    const R = Math.max(c.right, c.top * 2) + 3;
    const sc = this.sun.shadow.camera;
    sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = 200;
    sc.updateProjectionMatrix();
    this.sun.target.position.copy(this.target);
    this.sun.position.copy(this.target).add(new THREE.Vector3(-30, 60, 22));
  }

  // Qualidade automática: se o aparelho não aguenta ~30 fps, baixa a resolução
  // e depois desliga as sombras (uma vez por nível, sem voltar).
  _quality(t) {
    const q = this._q || (this._q = { last: t, acc: 0, n: 0, level: 0, since: t });
    const dt = t - q.last; q.last = t;
    if (dt <= 0 || dt > 0.5 || document.hidden) return;
    q.acc += dt; q.n++;
    if (t - q.since < 3) return;
    const avg = q.acc / q.n; q.acc = 0; q.n = 0; q.since = t;
    if (avg < 1 / 28 || q.level >= 2) return;
    q.level++;
    if (q.level === 1) { this.dprCap = 1; this.renderer.setPixelRatio(Math.min(this.renderer.getPixelRatio(), 1)); }
    if (q.level === 2) { this.sun.castShadow = false; this.renderer.shadowMap.enabled = false; }
    console.info('[3d] qualidade reduzida para o nível', q.level);
  }

  render(cam, state, t, now, ui = {}, traffic = null) {
    if (!this.ready) return;
    if (this.autoQuality !== false) this._quality(t);
    this.curPhase = this._phase(state);
    this.curWh = Math.min(3, state.warehouseLevel || 0);
    this._buildGround(state);
    this._buildRoads(state);
    this._grid(state, ui.ghost);
    this._sync(state, now, t);
    this._animate(t);
    this._works(t);
    animateWater(this.water, t);
    animateMist(this.mist, t);
    if (traffic) this._cars(traffic);
    this._selection(ui.selected);
    this._ghost(ui.ghost, t);
    this._camera(cam);
    this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------------ miniaturas
  thumb(type, px = 240) {
    if (!this.ready) return null;
    if (!this._thumbR) {
      this._thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this._thumbR.outputColorSpace = THREE.SRGBColorSpace;
      this._thumbR.toneMapping = THREE.NeutralToneMapping;
      this._thumbR.setSize(px, px);
      this._thumbScene = new THREE.Scene();
      this._thumbScene.add(new THREE.HemisphereLight(0xdff2ff, 0x6f8f5a, 1.6));
      const d = new THREE.DirectionalLight(0xfff1dc, 2.4); d.position.set(-3, 6, 2.2); this._thumbScene.add(d);
    }
    const def = BUILDINGS[type];
    const fake = { id: 3, type, size: def.size, resource: def.type === 'lot' ? 'wood' : null, readyAt: 0 };
    const g = this._makeObject(fake, def.type === 'lot' ? 'lot:wood:3' : type);
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    this._thumbScene.add(g);
    const box = new THREE.Box3().setFromObject(g);
    const ctr = box.getCenter(new THREE.Vector3());
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    cam.position.copy(ctr).addScaledVector(DIR, 50); cam.lookAt(ctr); cam.updateMatrixWorld();
    // enquadra pelos 8 cantos projetados na tela
    let r = 0;
    for (let k = 0; k < 8; k++) {
      const v = new THREE.Vector3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z);
      v.applyMatrix4(cam.matrixWorldInverse);
      r = Math.max(r, Math.abs(v.x), Math.abs(v.y));
    }
    r *= 1.06;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.updateProjectionMatrix();
    this._thumbR.render(this._thumbScene, cam);
    this._thumbScene.remove(g);
    disposeTree(g);
    return this._thumbR.domElement.toDataURL();
  }
}

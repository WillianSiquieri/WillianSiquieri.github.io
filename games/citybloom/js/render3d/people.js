// people.js — pedestres low-poly andando nas calçadas. Cada peça do corpo é uma
// InstancedMesh (poucas chamadas de desenho mesmo com dezenas de pessoas); a cor de
// cada pessoa vem por instância e pernas/braços balançam ao andar.
// O visual muda com a fase da cidade: camponeses de chapéu de palha no vilarejo,
// roupa casual nas cidades, ternos e pastas na metrópole.

import * as THREE from 'three';

const CAP = 60;
const MAT = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
const geo = {
  torso: (() => { const g = new THREE.BoxGeometry(0.05, 0.065, 0.032); g.translate(0, 0.1, 0); return g; })(),
  head: (() => { const g = new THREE.SphereGeometry(0.022, 8, 6); g.translate(0, 0.152, 0); return g; })(),
  hair: (() => { const g = new THREE.SphereGeometry(0.024, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(0, 0.156, -0.002); return g; })(),
  leg: (() => { const g = new THREE.BoxGeometry(0.019, 0.07, 0.02); g.translate(0, -0.035, 0); return g; })(),    // pivô no quadril
  arm: (() => { const g = new THREE.BoxGeometry(0.014, 0.06, 0.016); g.translate(0, -0.03, 0); return g; })(),    // pivô no ombro
  straw: (() => { const a = new THREE.CylinderGeometry(0.045, 0.045, 0.006, 10); a.translate(0, 0.168, 0); return a; })(),
  strawTop: (() => { const a = new THREE.ConeGeometry(0.024, 0.026, 8); a.translate(0, 0.182, 0); return a; })(),
  cap: (() => { const a = new THREE.BoxGeometry(0.026, 0.006, 0.026); a.translate(0, 0.165, 0.02); return a; })(),
  bag: (() => { const a = new THREE.BoxGeometry(0.012, 0.03, 0.04); a.translate(0, -0.075, 0); return a; })(),     // na mão
  basket: (() => { const a = new THREE.CylinderGeometry(0.02, 0.016, 0.022, 8); a.translate(0, -0.07, 0); return a; })(),
};

const SKIN = [0xf5d0b0, 0xe8b48f, 0xc98e66, 0x9b6744, 0x6b4630];
const HAIR = [0x2b1d14, 0x5a3a22, 0x8a5a2b, 0xd9b26a, 0x1b1b1b, 0xb0b0b0];
// Por fase: camisas, calças e chances de chapéu de palha / boné / terno / pasta / cesto
const STYLE = [
  { shirt: [0xb07a4a, 0x8f9b5a, 0xd9c49a, 0x9c5a3c, 0x6f7f9a], pants: [0x5a4632, 0x6b5a3a, 0x40506a], straw: 0.6, cap: 0, suit: 0, bag: 0, basket: 0.25 },
  { shirt: [0xd96c5a, 0x6aa0d8, 0xe8d08a, 0x7fbf7a, 0xc9a0dc], pants: [0x4a5a7a, 0x5a4632, 0x3b3b45], straw: 0.15, cap: 0.3, suit: 0, bag: 0, basket: 0.12 },
  { shirt: [0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c, 0xb197fc, 0xffffff, 0xff922b], pants: [0x364fc7, 0x343a40, 0x5c7cfa, 0x868e96], straw: 0, cap: 0.18, suit: 0.08, bag: 0.1, basket: 0 },
  { shirt: [0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c, 0xffffff, 0xf783ac, 0x20c997], pants: [0x364fc7, 0x343a40, 0x495057], straw: 0, cap: 0.12, suit: 0.25, bag: 0.2, basket: 0 },
  { shirt: [0xffffff, 0x4dabf7, 0xf783ac, 0x20c997, 0xffd43b, 0x845ef7], pants: [0x212529, 0x343a40, 0x364fc7], straw: 0, cap: 0.08, suit: 0.38, bag: 0.35, basket: 0 },
];
const hsh = (a, b) => { let h = (Math.floor(a * 1e6) * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const pickc = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];

export class People {
  constructor(scene) {
    this.group = new THREE.Group();
    this.parts = {};
    for (const [k, g] of Object.entries({ torso: geo.torso, head: geo.head, hair: geo.hair, legL: geo.leg, legR: geo.leg, armL: geo.arm, armR: geo.arm,
      straw: geo.straw, strawTop: geo.strawTop, cap: geo.cap, bag: geo.bag, basket: geo.basket })) {
      const im = new THREE.InstancedMesh(g, MAT, CAP);
      im.castShadow = true; im.frustumCulled = false; im.count = 0;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.parts[k] = im; this.group.add(im);
    }
    scene.add(this.group);
    this._m = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._l = new THREE.Matrix4();
    this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
    this._colored = new Map();
  }

  // Look da pessoa a partir do sorteio fixo (look) e da fase (style).
  _look(p) {
    const st = STYLE[Math.min(4, p.style || 0)], r = (k) => hsh(p.look, k);
    const suit = r(1) < st.suit;
    return {
      skin: pickc(SKIN, r(2)), hair: pickc(HAIR, r(3)),
      shirt: suit ? pickc([0x2b3a55, 0x3b3b45, 0x4a4a52], r(4)) : pickc(st.shirt, r(4)),
      pants: suit ? 0x2b2d33 : p.runner ? 0x222831 : pickc(st.pants, r(5)),
      hat: r(6) < st.straw ? 'straw' : r(6) < st.straw + st.cap ? 'cap' : 'hair',
      capColor: pickc([0xe03131, 0x1971c2, 0x2f9e44, 0xf08c00], r(7)),
      bag: suit && r(8) < 0.7 ? 'bag' : r(8) < st.bag ? 'bag' : r(9) < st.basket ? 'basket' : null,
    };
  }

  update(list) {
    const P = this.parts, n = Math.min(CAP, list.length);
    for (const k in P) P[k].count = n;
    const counts = { straw: 0, strawTop: 0, cap: 0, bag: 0, basket: 0 };
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = 0; k < n; k++) {
      const p = list[k], L = this._look(p);
      const sc = p.scale * 1.3;   // um pouco maiores que a escala real, para ler bem no celular
      this._q.setFromAxisAngle(this._v.set(0, 1, 0), p.yaw);
      // leve balanço vertical do passo
      const bob = Math.abs(Math.sin(p.walk)) * 0.006;
      this._b.compose(this._v.set(p.x, bob, p.z), this._q, this._s.set(sc, sc, sc));
      const set = (name, local, color) => {
        this._m.multiplyMatrices(this._b, local); P[name].setMatrixAt(k, this._m);
        if (color != null) P[name].setColorAt(k, this._c.setHex(color));
      };
      const I = this._l.identity();
      set('torso', I, L.shirt); set('head', I, L.skin);
      set('hair', I, L.hat === 'cap' ? L.capColor : L.hair);
      const sw = Math.sin(p.walk) * (p.runner ? 0.9 : 0.55);
      const limb = (x, y, rot) => new THREE.Matrix4().makeRotationX(rot).setPosition(x, y, 0);
      set('legL', limb(-0.012, 0.07, sw), L.pants); set('legR', limb(0.012, 0.07, -sw), L.pants);
      set('armL', limb(-0.032, 0.128, -sw * 0.8), L.shirt); set('armR', limb(0.032, 0.128, sw * 0.8), L.shirt);
      // acessórios (escondidos quando não usa)
      const acc = (name, on, local, color) => { if (on) set(name, local, color); else P[name].setMatrixAt(k, hidden); };
      acc('straw', L.hat === 'straw', I, 0xe3c35a); acc('strawTop', L.hat === 'straw', I, 0xd9b44a);
      acc('cap', L.hat === 'cap', I, L.capColor);
      const hand = limb(0.032, 0.128, sw * 0.8);
      acc('bag', L.bag === 'bag', hand, 0x5a3a22); acc('basket', L.bag === 'basket', hand, 0xc9a06a);
      void counts;
    }
    for (const k in P) { P[k].instanceMatrix.needsUpdate = true; if (P[k].instanceColor) P[k].instanceColor.needsUpdate = true; }
  }
}

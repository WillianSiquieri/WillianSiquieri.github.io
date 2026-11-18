// builds.js — construções montadas em código, cada uma com silhueta, cor e
// placa próprias (para nenhuma se confundir com outra). Medidas em unidades de
// tile: uma construção 1×1 ocupa de -0,45 a 0,45 em X e Z; a frente é +Z/+X
// (os dois lados que a câmera vê).

import * as THREE from 'three';
import { box, cyl, sphere, gable, awning, flag, cross, smoke, chimney, sign, part, stack, mat } from './parts.js';

const NAT = 'nature/', IND = 'industrial/', COM = 'commercial/', CAR = 'cars/';
const done = (g, h) => { g.userData.h = h; return g; };

export const BUILDS = {
  // ------------------------------------------------------------ indústria
  // Armazém: galpão largo de telhado azul, portão grande e contêineres.
  warehouse(w) {
    const g = new THREE.Group();
    g.add(box(0.9, 0.03, 0.9, 0xb9bec4));
    g.add(box(0.62, 0.34, 0.5, 0xe9edf1, -0.1, 0.03, -0.14));
    g.add(gable(0.66, 0.16, 0.54, 0x3d7bd9, -0.1, 0.37, -0.14));
    g.add(box(0.26, 0.22, 0.02, 0x8a96a3, -0.1, 0.03, 0.12));
    for (let k = 0; k < 4; k++) g.add(box(0.26, 0.008, 0.024, 0xaab4be, -0.1, 0.06 + k * 0.05, 0.123));
    g.add(part(w, IND + 'shipping-container-a', 0.36, 0.28, 0.26, Math.PI / 2));
    g.add(part(w, IND + 'shipping-container-c', 0.36, 0.28, 0.26, Math.PI / 2, null, Infinity, 0.15));
    g.add(part(w, IND + 'shipping-container-b', 0.36, 0.3, -0.2, 0));
    g.add(sign('crate', '#3d7bd9', -0.1, 0.55, -0.14, 0.2));
    return done(g, 0.78);
  },
  // Serraria: barracão de madeira aberto, pilhas de toras e serra circular.
  sawmill(w) {
    const g = new THREE.Group(), wood = 0x9c6339, dark = 0x6e4325;
    g.add(box(0.9, 0.025, 0.9, 0xc9a173));
    for (const [x, z] of [[-0.38, -0.36], [0.1, -0.36], [-0.38, 0.06], [0.1, 0.06]]) g.add(box(0.05, 0.3, 0.05, dark, x, 0.025, z));
    g.add(box(0.56, 0.2, 0.04, wood, -0.14, 0.025, -0.38));
    g.add(gable(0.62, 0.16, 0.52, 0x7a4a2a, -0.14, 0.32, -0.15));
    g.add(box(0.36, 0.06, 0.18, 0x8d6e63, -0.14, 0.025, -0.12));
    const blade = cyl(0.09, 0.09, 0.012, 0xcfd8dc, -0.14, 0.12, -0.12, 20, { metalness: 0.6, roughness: 0.3 });
    blade.rotation.x = Math.PI / 2; blade.name = 'spin'; g.add(blade);
    g.add(part(w, NAT + 'log_stackLarge', 0.34, 0.24, 0.24, Math.PI / 2));
    g.add(part(w, NAT + 'log_stack', 0.24, 0.3, -0.2, 0));
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 8), mat(0xe8c48a, { flatShading: true })).translateX(-0.3).translateY(0.055).translateZ(0.3));
    g.add(sign('log', '#8d5a2b', -0.14, 0.52, -0.15, 0.2));
    return done(g, 0.74);
  },
  // Olaria: prédio cor de tijolo, forno em cúpula, chaminé listrada e paletes de tijolos.
  kiln(w) {
    const g = new THREE.Group(), brick = 0xb5532f;
    g.add(box(0.9, 0.025, 0.9, 0xc9b8a3));
    g.add(box(0.46, 0.3, 0.44, brick, -0.18, 0.025, -0.16));
    g.add(box(0.5, 0.04, 0.48, 0x7d3720, -0.18, 0.325, -0.16));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd27a4c, { flatShading: true }));
    dome.position.set(0.2, 0.025, 0.06); dome.castShadow = true; g.add(dome);
    g.add(box(0.08, 0.07, 0.02, 0xffa726, 0.2, 0.03, 0.225, { emissive: 0xff6d00, emissiveIntensity: 0.8 }));
    g.add(chimney(-0.3, -0.3, 0.62, 0.06, 0xa1442a, 0xf1e3d3, 0.025));
    for (const [x, z] of [[0.24, 0.32], [-0.06, 0.3]]) g.add(stack(x, z, 0.18, 0.12, 4, 0xc0532f, 0xa8452a));
    g.add(sign('brick', '#b5532f', -0.1, 0.4, -0.05, 0.18));
    return done(g, 0.7);
  },
  // Vidraria: prédio branco com telhado de vidro azul, forno brilhando e placas de vidro.
  glassworks(w) {
    const g = new THREE.Group();
    g.add(box(0.9, 0.025, 0.9, 0xcfd8dc));
    g.add(box(0.56, 0.26, 0.46, 0xf5f7f8, -0.1, 0.025, -0.15));
    for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.46), mat(0x7fd3f7, { roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 }));
      r.position.set(-0.3 + k * 0.19, 0.33, -0.15); r.rotation.z = 0.5; r.castShadow = true; g.add(r);
    }
    g.add(chimney(0.26, -0.28, 0.5, 0.05, 0x90a4ae, 0x4fc3f7, 0.025));
    g.add(box(0.1, 0.08, 0.02, 0xffb74d, -0.1, 0.03, 0.085, { emissive: 0xff9100, emissiveIntensity: 0.9 }));
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.012), mat(0xb3e5fc, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.7 }));
      p.position.set(0.22, 0.11, 0.18 + k * 0.05); p.rotation.x = -0.15; p.castShadow = true; g.add(p);
    }
    g.add(sign('glass', '#039be5', -0.36, 0.3, 0.2, 0.18));
    return done(g, 0.6);
  },
  // Marcenaria: oficina bege de telhado verde, bancada e pilhas de tábuas claras.
  carpentry(w) {
    const g = new THREE.Group();
    g.add(box(0.9, 0.025, 0.9, 0xd7ccc8));
    g.add(box(0.5, 0.28, 0.44, 0xf0d9b5, -0.14, 0.025, -0.16));
    g.add(gable(0.56, 0.18, 0.5, 0x2e8b57, -0.14, 0.305, -0.16));
    g.add(box(0.18, 0.18, 0.02, 0x8d6e63, -0.14, 0.025, 0.065));
    g.add(stack(0.26, -0.18, 0.12, 0.42, 5, 0xf3d29b, 0xe3bd7b, 0.03));
    g.add(stack(0.24, 0.26, 0.34, 0.1, 4, 0xf3d29b, 0xe3bd7b, 0.03));
    g.add(box(0.26, 0.02, 0.12, 0xa1887f, -0.18, 0.12, 0.28), box(0.02, 0.1, 0.1, 0x6d4c41, -0.29, 0.025, 0.28), box(0.02, 0.1, 0.1, 0x6d4c41, -0.07, 0.025, 0.28));
    g.add(sign('chair', '#2e8b57', -0.14, 0.55, -0.16, 0.2));
    return done(g, 0.78);
  },
  // Siderúrgica: prédio escuro do kit, brilho laranja, vigas de aço e muita fumaça.
  steelworks(w) {
    const g = new THREE.Group();
    const b = part(w, IND + 'building-m', 0.84, -0.04, -0.04);
    g.add(b);
    g.add(box(0.12, 0.08, 0.02, 0xff7043, 0.0, 0.03, 0.33, { emissive: 0xff3d00, emissiveIntensity: 1 }));
    g.add(stack(0.3, 0.32, 0.28, 0.07, 3, 0x78909c, 0x546e7a, 0.03));
    const H = b.userData.h;
    for (const [x, z] of [[-0.22, 0.05], [-0.07, 0.05], [0.08, 0.05]]) g.add(smoke(x, H * 0.98, z, 0.35));
    g.add(sign('beam', '#455a64', 0.33, 0.3, -0.3, 0.18));
    return done(g, H);
  },

  // ------------------------------------------------------------ comércio
  // Padaria: casinha creme de telhado marrom, toldo rosa, chaminé do forno e mesinha.
  bakery(w) {
    const g = new THREE.Group();
    g.add(box(0.9, 0.025, 0.9, 0xe0d6c8));
    g.add(box(0.56, 0.32, 0.48, 0xfff3e0, -0.08, 0.025, -0.1));
    g.add(gable(0.6, 0.18, 0.52, 0x8d5a3b, -0.08, 0.345, -0.1));
    g.add(box(0.36, 0.14, 0.02, 0x90caf9, -0.08, 0.06, 0.145, { roughness: 0.2 }));
    g.add(awning(0.48, 0xf06292, -0.08, 0.27, 0.14));
    g.add(chimney(0.12, -0.24, 0.62, 0.035, 0xbcaaa4, 0xbcaaa4, 0.025));
    g.add(part(w, COM + 'detail-parasol-a', 0.2, 0.3, 0.32));
    g.add(sign('bread', '#f06292', -0.32, 0.44, 0.16, 0.2));
    return done(g, 0.66);
  },
  // Mercado: feira coberta com lona verde listrada, bancas de frutas e caixotes.
  market(w) {
    const g = new THREE.Group();
    g.add(box(0.9, 0.025, 0.9, 0xd9d2c3));
    for (const [x, z] of [[-0.38, -0.34], [0.34, -0.34], [-0.38, 0.3], [0.34, 0.3]]) g.add(box(0.03, 0.34, 0.03, 0xf5f5f5, x, 0.025, z));
    const roof = new THREE.Group();
    for (let k = 0; k < 7; k++) roof.add(box(0.11, 0.02, 0.72, k % 2 ? 0xffffff : 0x43a047, -0.38 + k * 0.12 + 0.02, 0, 0));
    roof.position.set(-0.02, 0.36, -0.02); roof.rotation.z = 0.12; g.add(roof);
    const fruits = [0xe53935, 0xfdd835, 0xfb8c00, 0x7cb342];
    for (const [x, z] of [[-0.2, -0.15], [0.16, -0.15], [-0.2, 0.15], [0.16, 0.15]]) {
      g.add(box(0.24, 0.1, 0.16, 0xa1887f, x, 0.025, z));
      for (let k = 0; k < 6; k++) g.add(sphere(0.028, fruits[(k + Math.round(x * 10)) % 4], x - 0.08 + (k % 3) * 0.08, 0.15, z - 0.035 + Math.floor(k / 3) * 0.07));
    }
    g.add(stack(0.35, 0.0, 0.1, 0.1, 3, 0xd7a86e, 0xc49158, 0.06));
    g.add(sign('fruit', '#43a047', -0.02, 0.48, -0.02, 0.2));
    return done(g, 0.62);
  },
  // Loja de roupas: sobrado lilás com vitrines grandes e toldo roxo.
  clothes(w) {
    const g = new THREE.Group();
    g.add(box(0.9, 0.025, 0.9, 0xe0dce6));
    g.add(box(0.62, 0.5, 0.5, 0xd1b3e8, -0.06, 0.025, -0.1));
    g.add(box(0.66, 0.04, 0.54, 0x7b4fa8, -0.06, 0.525, -0.1));
    g.add(box(0.5, 0.18, 0.02, 0xbbdefb, -0.06, 0.05, 0.155, { roughness: 0.15 }));
    for (const x of [-0.24, -0.06, 0.12]) g.add(box(0.1, 0.1, 0.02, 0xe1f5fe, x, 0.32, 0.155));
    for (const x of [-0.2, 0.08]) { g.add(cyl(0.02, 0.025, 0.12, 0xfafafa, x, 0.05, 0.12, 8)); g.add(sphere(0.02, 0xfafafa, x, 0.19, 0.12)); }
    g.add(awning(0.58, 0x8e24aa, -0.06, 0.25, 0.15));
    g.add(sign('shirt', '#8e24aa', -0.06, 0.6, -0.1, 0.22));
    return done(g, 0.88);
  },
  // Shopping (2×2): bloco largo claro com átrio de vidro, letreiro e estacionamento.
  mall(w) {
    const g = new THREE.Group();
    g.add(box(1.9, 0.025, 1.9, 0x9ea7ad));
    for (let k = 0; k < 6; k++) g.add(box(0.02, 0.026, 0.3, 0xffffff, -0.75 + k * 0.3, 0, 0.72));
    g.add(box(1.5, 0.5, 1.0, 0xf3e5f5, 0, 0.025, -0.3));
    g.add(box(1.54, 0.05, 1.04, 0xab47bc, 0, 0.525, -0.3));
    g.add(box(1.5, 0.1, 0.02, 0xab47bc, 0, 0.36, 0.205));
    const atrium = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat(0x81d4fa, { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }));
    atrium.position.set(0, 0.75, -0.3); atrium.castShadow = true; g.add(atrium);
    g.add(box(0.5, 0.25, 0.02, 0xb3e5fc, 0, 0.03, 0.205, { roughness: 0.15 }));
    const cars = [CAR + 'sedan', CAR + 'taxi', CAR + 'suv', CAR + 'hatchback-sports'];
    cars.forEach((c, k) => g.add(part(w, c, 0.26, -0.6 + k * 0.4, 0.72, 0)));
    g.add(sign('bag', '#ab47bc', 0.55, 0.62, 0.0, 0.36));
    return done(g, 1.0);
  },

  // ------------------------------------------------------------ serviços
  // Escola: prédio amarelo com telhado vermelho, torre do sino, relógio e quadra.
  school(w) {
    const g = new THREE.Group();
    g.add(box(0.9, 0.025, 0.9, 0xd6cfc2));
    g.add(box(0.7, 0.3, 0.36, 0xffd54f, -0.06, 0.025, -0.22));
    g.add(gable(0.74, 0.16, 0.4, 0xc62828, -0.06, 0.325, -0.22));
    for (let k = 0; k < 4; k++) g.add(box(0.09, 0.09, 0.02, 0x64b5f6, -0.33 + k * 0.18, 0.12, -0.03));
    g.add(box(0.14, 0.5, 0.14, 0xffca28, 0.2, 0.025, -0.22));
    g.add(gable(0.18, 0.12, 0.18, 0xc62828, 0.2, 0.525, -0.22));
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), mat(0xffffff)); clock.position.set(0.2, 0.43, -0.149); g.add(clock);
    g.add(box(0.8, 0.012, 0.3, 0x43a047, -0.02, 0.025, 0.26));
    g.add(box(0.76, 0.014, 0.012, 0xffffff, -0.02, 0.025, 0.26));
    g.add(flag(0x1e88e5, 0.38, 0.38, 0.62, 0.025));
    g.add(sign('book', '#f39c12', -0.32, 0.5, -0.22, 0.18));
    return done(g, 0.66);
  },
  // Posto de saúde: prédio branco e verde-água, cruz grande e ambulância.
  clinic(w) {
    const g = new THREE.Group();
    g.add(box(0.9, 0.025, 0.9, 0xd9e2e8));
    g.add(box(0.6, 0.32, 0.46, 0xffffff, -0.08, 0.025, -0.14));
    g.add(box(0.64, 0.04, 0.5, 0x26a69a, -0.08, 0.345, -0.14));
    g.add(box(0.6, 0.05, 0.02, 0x26a69a, -0.08, 0.2, 0.095));
    for (const x of [-0.28, -0.08, 0.12]) g.add(box(0.1, 0.08, 0.02, 0x81d4fa, x, 0.07, 0.095));
    g.add(cross(-0.08, 0.66, -0.14, 0.26));
    g.add(box(0.03, 0.1, 0.03, 0xb0bec5, -0.08, 0.385, -0.14));
    g.add(part(w, CAR + 'ambulance', 0.3, 0.26, 0.3, Math.PI / 2));
    return done(g, 0.68);
  },
  // Hospital (2×2): prédio branco alto com faixas azuis, cruz, heliponto e ambulâncias.
  hospital(w) {
    const g = new THREE.Group();
    g.add(box(1.9, 0.025, 1.9, 0xd9e2e8));
    g.add(box(1.2, 0.95, 0.8, 0xffffff, -0.2, 0.025, -0.35));
    for (let k = 0; k < 4; k++) g.add(box(1.22, 0.05, 0.82, 0x64b5f6, -0.2, 0.15 + k * 0.2, -0.35));
    g.add(box(0.6, 0.45, 0.7, 0xeceff1, 0.55, 0.025, 0.25));
    g.add(box(0.62, 0.04, 0.72, 0xe53935, 0.55, 0.475, 0.25));
    g.add(cyl(0.28, 0.28, 0.025, 0x37474f, -0.2, 0.975, -0.35, 24));
    g.add(box(0.05, 0.026, 0.24, 0xffffff, -0.28, 0.99, -0.35), box(0.05, 0.026, 0.24, 0xffffff, -0.12, 0.99, -0.35), box(0.16, 0.026, 0.05, 0xffffff, -0.2, 0.99, -0.35));
    g.add(cross(0.55, 0.85, 0.25, 0.34));
    g.add(part(w, CAR + 'ambulance', 0.4, -0.4, 0.55, Math.PI / 2));
    g.add(part(w, CAR + 'ambulance', 0.4, -0.75, 0.55, Math.PI / 2));
    return done(g, 1.2);
  },
};

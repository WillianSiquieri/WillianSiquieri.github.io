// rider.js — o personagem que desce pela pista. Corpo de Verlet com poucos
// pontos: um "trenó" com base (contato) e um ponto de corpo acima, ligados por
// restrições. Simples, estável e com cara de que "tomba" em rampas.

import { makePoint, makeConstraint } from '../engine/physics.js';

export const RIDER_RADIUS = 9; // raio de contato de cada ponto com a pista

export class Rider {
  constructor(startX, startY) {
    this.start = { x: startX, y: startY };
    this.build(startX, startY);
  }

  build(x, y) {
    // Três pontos: nariz (frente), cauda (trás) na base, e corpo acima do meio.
    this.nose = makePoint(x + 14, y);
    this.tail = makePoint(x - 14, y);
    this.body = makePoint(x, y - 16);

    this.points = [this.nose, this.tail, this.body];
    this.constraints = [
      makeConstraint(this.nose, this.tail, 1),
      makeConstraint(this.nose, this.body, 1),
      makeConstraint(this.tail, this.body, 1),
    ];
  }

  reset() {
    this.build(this.start.x, this.start.y);
  }

  // Dá um empurrãozinho inicial para a direita ao iniciar.
  kick(vx = 2.2) {
    for (const p of this.points) p.px = p.x - vx;
  }

  // Centro aproximado do corpo (para câmera e detecção de objetivos).
  center() {
    return {
      x: (this.nose.x + this.tail.x + this.body.x) / 3,
      y: (this.nose.y + this.tail.y + this.body.y) / 3,
    };
  }

  // Posição da base (ponto médio entre nariz e cauda) e ângulo do trenó.
  base() {
    return {
      x: (this.nose.x + this.tail.x) / 2,
      y: (this.nose.y + this.tail.y) / 2,
      angle: Math.atan2(this.nose.y - this.tail.y, this.nose.x - this.tail.x),
    };
  }
}

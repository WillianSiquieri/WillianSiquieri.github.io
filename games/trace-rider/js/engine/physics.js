// physics.js — integração de Verlet para pontos de massa e restrições de
// distância. O personagem (rider) é um conjunto de pontos ligados por
// restrições, o que dá um corpo rígido/semi-rígido estável e barato.

import { resolvePointSegments } from './collision.js';

// Cria um ponto de Verlet. px/py = posição anterior (codifica a velocidade).
export function makePoint(x, y) {
  return { x, y, px: x, py: y };
}

// Restrição de distância entre dois pontos (mantém o comprimento de repouso).
export function makeConstraint(pA, pB, stiffness = 1) {
  return { a: pA, b: pB, rest: Math.hypot(pA.x - pB.x, pA.y - pB.y), stiffness };
}

export function integrate(points, dt, gravity, damping) {
  const g = gravity * dt * dt;
  for (const p of points) {
    if (p.pinned) continue;
    const vx = (p.x - p.px) * damping;
    const vy = (p.y - p.py) * damping;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + g;
  }
}

export function satisfyConstraints(constraints, iterations) {
  for (let it = 0; it < iterations; it++) {
    for (const c of constraints) {
      const dx = c.b.x - c.a.x;
      const dy = c.b.y - c.a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const diff = ((d - c.rest) / d) * 0.5 * c.stiffness;
      const ox = dx * diff;
      const oy = dy * diff;
      if (!c.a.pinned) { c.a.x += ox; c.a.y += oy; }
      if (!c.b.pinned) { c.b.x -= ox; c.b.y -= oy; }
    }
  }
}

// Resolve colisão de todos os pontos contra a pista usando a grade espacial.
export function collide(points, grid, radius, friction) {
  for (const p of points) {
    if (p.pinned) continue;
    const candidates = grid.query(p, radius + 4);
    if (candidates.length) resolvePointSegments(p, candidates, radius, friction);
  }
}

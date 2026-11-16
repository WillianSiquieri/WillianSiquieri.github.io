// vehicles.js — visuais do personagem. A física é sempre a mesma (rider.js);
// aqui só muda o desenho.
//
// Cada veículo desenha num referencial local:
//   origem = ponto médio da base (entre nariz e cauda), eixo x para o nariz,
//   y para baixo. A pista fica em y ≈ +9 (raio de contato dos pontos).
// draw(ctx, o) recebe o = { color, line, wheel, speed, t }.

const TAU = Math.PI * 2;

function circle(ctx, x, y, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
function poly(ctx, pts, fill, stroke, lw) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function lines(ctx, color, lw, ...paths) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const p of paths) { ctx.moveTo(p[0][0], p[0][1]); for (let k = 1; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1]); }
  ctx.stroke();
}

// Roda com raios girando.
function wheel(ctx, o, x, y, r, spokes = 3) {
  circle(ctx, x, y, r, o.line);
  circle(ctx, x, y, r * 0.62, '#e9edf2');
  ctx.strokeStyle = '#8a93a6'; ctx.lineWidth = Math.max(1, r * 0.18); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < spokes; k++) {
    const a = o.wheel + (k * TAU) / spokes;
    ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
  }
  ctx.stroke();
  circle(ctx, x, y, r * 0.2, o.color);
}

// Cabeça com capacete na cor escolhida.
function head(ctx, o, x, y, r = 4.6, lamp = false) {
  circle(ctx, x, y, r, o.line);
  ctx.beginPath(); ctx.arc(x, y - 0.4, r + 0.9, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath();
  ctx.fillStyle = o.color; ctx.fill();
  if (lamp) circle(ctx, x + r * 0.9, y - r * 0.55, 1.8, '#ffd23f');
}

// Bonequinho de palito: pontos nomeados.
function stick(ctx, o, p) {
  const lw = 2.6;
  const segs = [];
  if (p.foot1) segs.push([p.hip, p.knee1, p.foot1]);
  if (p.foot2) segs.push([p.hip, p.knee2, p.foot2]);
  segs.push([p.hip, p.shoulder]);
  if (p.hand1) segs.push([p.shoulder, p.elbow1 || mid(p.shoulder, p.hand1), p.hand1]);
  if (p.hand2) segs.push([p.shoulder, p.elbow2 || mid(p.shoulder, p.hand2), p.hand2]);
  lines(ctx, o.line, lw, ...segs);
  head(ctx, o, p.head[0], p.head[1], 4.6, p.lamp);
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// ------------------------------------------------------------------ veículos
export const VEHICLES = [
  {
    id: 'sled', name: 'Trenó',
    draw(ctx, o) {
      lines(ctx, o.line, 4, [[-14, 0], [14, 0]]);
      poly(ctx, [[14, 0], [-14, 0], [0, -16]], o.color);
      circle(ctx, 0, -16, 6, o.line);
    },
  },
  {
    id: 'soapbox', name: 'Rolimã',
    draw(ctx, o) {
      // bonequinho sentado, pernas para a frente
      stick(ctx, o, {
        hip: [-4, -6], shoulder: [-2, -18], head: [-1, -23.5],
        knee1: [5, -11], foot1: [12, -6],
        hand1: [10, -8], elbow1: [4, -12],
      });
      poly(ctx, [[-17, -7], [13, -7], [16, 1], [-17, 1]], o.color, o.line, 2);
      lines(ctx, o.line, 1.4, [[-8, -7], [-8, 1]], [[2, -7], [2, 1]]);
      lines(ctx, o.line, 1.6, [[11, -7], [13, -12]]);                  // corda/volante
      wheel(ctx, o, -11, 4, 5);
      wheel(ctx, o, 10, 4, 5);
    },
  },
  {
    id: 'skate', name: 'Skate',
    draw(ctx, o) {
      stick(ctx, o, {
        foot1: [-7, -1], knee1: [-5, -9], foot2: [6, -1], knee2: [4, -9],
        hip: [0, -16], shoulder: [1, -27], head: [2, -32.5],
        hand1: [-10, -22], hand2: [12, -24],
      });
      ctx.lineCap = 'round';
      ctx.strokeStyle = o.color; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(-17, -4); ctx.quadraticCurveTo(-15, 1, -11, 1); ctx.lineTo(11, 1); ctx.quadraticCurveTo(15, 1, 17, -4); ctx.stroke();
      lines(ctx, o.line, 1.6, [[-9, 2], [-9, 4]], [[9, 2], [9, 4]]);
      wheel(ctx, o, -9, 5.5, 3.5, 2);
      wheel(ctx, o, 9, 5.5, 3.5, 2);
    },
  },
  {
    id: 'bmx', name: 'BMX',
    draw(ctx, o) {
      const bb = [-1, 0];
      const pa = o.wheel * 0.8;
      const ped1 = [bb[0] + Math.cos(pa) * 4, bb[1] + Math.sin(pa) * 4];
      const ped2 = [bb[0] - Math.cos(pa) * 4, bb[1] - Math.sin(pa) * 4];
      // perna de trás (atrás do quadro)
      lines(ctx, o.line, 2.6, [[-4, -13], kneeFor([-4, -13], ped2, 9), ped2]);
      wheel(ctx, o, -12, 2, 7, 5);
      wheel(ctx, o, 12, 2, 7, 5);
      // quadro
      lines(ctx, o.color, 2.8, [[-12, 2], bb, [-5, -9], [-12, 2]], [bb, [8, -8], [12, 2]], [[-5, -9], [8, -8]]);
      lines(ctx, o.line, 2.2, [[8, -8], [8.5, -13]], [[6, -13], [11, -13]], [[-8, -10], [-2, -10]]);
      // ciclista
      stick(ctx, o, {
        hip: [-4, -13], shoulder: [3, -24], head: [5.5, -29.5],
        foot1: ped1, knee1: kneeFor([-4, -13], ped1, 9),
        hand1: [9.5, -13], elbow1: [7, -18],
      });
    },
  },
  {
    id: 'minecart', name: 'Vagonete',
    draw(ctx, o) {
      // passageiro da cintura para cima, braços para o alto
      stick(ctx, o, {
        hip: [0, -9], shoulder: [0, -19], head: [0.5, -24.5], lamp: true,
        hand1: [-8, -27], hand2: [9, -27], elbow1: [-6, -21], elbow2: [7, -21],
      });
      poly(ctx, [[-16, -11], [16, -11], [12, 2], [-12, 2]], o.color, o.line, 2);
      lines(ctx, o.line, 2.4, [[-17, -11], [17, -11]]);
      for (const x of [-8, 0, 8]) circle(ctx, x, -5, 1.2, o.line);
      wheel(ctx, o, -8, 4, 5, 4);
      wheel(ctx, o, 8, 4, 5, 4);
    },
  },
  {
    id: 'rocket', name: 'Foguete',
    draw(ctx, o) {
      // chama: cresce com a velocidade e tremula
      const L = 7 + Math.min(18, o.speed * 3.2) + Math.sin(o.t * 38) * 1.6;
      poly(ctx, [[-20, -3.2], [-20 - L, 0], [-20, 3.2]], '#ff7a1a');
      poly(ctx, [[-20, -1.8], [-20 - L * 0.55, 0], [-20, 1.8]], '#ffd23f');
      stick(ctx, o, {
        foot1: [-7, -2.5], knee1: [-3, -10], foot2: [6, -2.5], knee2: [6, -10],
        hip: [0, -15], shoulder: [5, -25], head: [7.5, -30],
        hand1: [-6, -21], hand2: [13, -21],
      });
      ctx.fillStyle = o.color; ctx.strokeStyle = o.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-16, -2.5); ctx.lineTo(12, -2.5); ctx.quadraticCurveTo(19, 0, 12, 2.5); ctx.lineTo(-16, 2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      poly(ctx, [[-21, -4.5], [-15, -4.5], [-15, 4.5], [-21, 4.5]], '#8a93a6', o.line, 2);
      circle(ctx, 4, 0, 1.4, '#ffffff');
    },
  },
  {
    id: 'sports', name: 'Esportivo',
    draw(ctx, o) {
      // aerofólio
      lines(ctx, o.line, 2, [[-15, -6], [-16, -11]]);
      lines(ctx, o.color, 3, [[-21, -11.5], [-12, -11.5]]);
      // carroceria
      ctx.fillStyle = o.color; ctx.strokeStyle = o.line; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-19, 3); ctx.lineTo(-19, -5); ctx.lineTo(-10, -7);
      ctx.quadraticCurveTo(-6, -14, 2, -13.5); ctx.lineTo(8, -7);
      ctx.quadraticCurveTo(16, -6, 19, -2); ctx.lineTo(19, 3); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // vidros
      ctx.fillStyle = 'rgba(220,240,255,0.92)';
      ctx.beginPath(); ctx.moveTo(-8, -7.5); ctx.quadraticCurveTo(-5, -12, 1.5, -11.8); ctx.lineTo(6, -7.5); ctx.closePath(); ctx.fill();
      lines(ctx, o.line, 1.4, [[-1.5, -11.8], [-1.5, -7.5]]);
      // motorista (cabeça no vidro)
      head(ctx, o, -4.5, -9.6, 2.8);
      // faixa, farol e lanterna
      lines(ctx, 'rgba(255,255,255,0.75)', 1.6, [[-17, -1.5], [16, -1.5]]);
      circle(ctx, 17.4, -3, 1.6, '#ffd23f');
      circle(ctx, -18.6, -3.4, 1.3, '#ff3b30');
      wheel(ctx, o, -11, 3.5, 5.5, 5);
      wheel(ctx, o, 11, 3.5, 5.5, 5);
    },
  },
];

// Joelho de uma perna de comprimento 2·seg entre quadril e pé (dobra para a frente).
function kneeFor(hip, foot, seg) {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1];
  const d = Math.min(Math.hypot(dx, dy), seg * 2 - 0.01);
  const h = Math.sqrt(Math.max(0, seg * seg - (d / 2) * (d / 2)));
  const mx = hip[0] + dx / 2, my = hip[1] + dy / 2;
  const nx = dy / (Math.hypot(dx, dy) || 1), ny = -dx / (Math.hypot(dx, dy) || 1);
  return [mx + nx * h, my + ny * h];
}

export function getVehicleDef(id) {
  return VEHICLES.find(v => v.id === id) || VEHICLES[0];
}

// Miniatura para o menu (veículo parado sobre um trecho de pista).
export function drawThumb(canvas, vehicle, color, line) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 76, h = canvas.clientHeight || 60;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // os veículos ocupam ~x −24..20, y −35..9: cabe tudo com folga
  const s = Math.min(w / 50, (h - 4) / 46);
  ctx.translate(w / 2 + 2 * s, h - 2 - 10 * s);
  ctx.scale(s, s);
  lines(ctx, line, 2, [[-24, 9.5], [24, 9.5]]);
  vehicle.draw(ctx, { color, line, wheel: 0.4, speed: 3, t: 0.3 });
}

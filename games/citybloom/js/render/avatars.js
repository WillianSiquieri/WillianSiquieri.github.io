// avatars.js — retratos dos personagens dos pedidos, desenhados por código
// (estilo ilustração plana moderna). Gerados uma vez como imagem (dataURL).

import { tint } from './kit.js';

const cache = new Map();

export function avatarURL(client) {
  if (cache.has(client.id)) return cache.get(client.id);
  const S = 96, c = document.createElement('canvas');
  c.width = S * 2; c.height = S * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  drawAvatar(ctx, client.look, S);
  const url = c.toDataURL();
  cache.set(client.id, url);
  return url;
}

function circle(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function ellipse(ctx, x, y, rx, ry, fill, a0 = 0, a1 = Math.PI * 2) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, a0, a1); ctx.fill(); }

export function drawAvatar(ctx, L, S = 96) {
  const cx = S / 2, hy = 44, hr = 19;
  // fundo redondo
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cx, cx, 0, Math.PI * 2); ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, tint(L.bg, 1.25)); bg.addColorStop(1, L.bg);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);

  // cabelo comprido / rabo atrás da cabeça
  if (L.hair === 'long') {
    ctx.fillStyle = L.hairColor;
    ctx.beginPath(); ctx.moveTo(cx - 22, hy - 6); ctx.quadraticCurveTo(cx - 26, hy + 30, cx - 18, hy + 34);
    ctx.lineTo(cx + 18, hy + 34); ctx.quadraticCurveTo(cx + 26, hy + 30, cx + 22, hy - 6); ctx.closePath(); ctx.fill();
  }
  if (L.hair === 'ponytail') ellipse(ctx, cx + 20, hy + 6, 7, 16, L.hairColor);

  // ombros / roupa
  const shirt = ctx.createLinearGradient(0, 66, 0, S);
  shirt.addColorStop(0, tint(L.shirt, 1.08)); shirt.addColorStop(1, tint(L.shirt, 0.86));
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.moveTo(cx - 34, S); ctx.quadraticCurveTo(cx - 32, 70, cx - 12, 68);
  ctx.lineTo(cx + 12, 68); ctx.quadraticCurveTo(cx + 32, 70, cx + 34, S); ctx.closePath(); ctx.fill();
  if (L.shirt.toLowerCase() === '#ffffff') { // dólmã de chef: botões
    for (const y of [76, 84]) { circle(ctx, cx - 5, y, 1.4, '#c9ced4'); circle(ctx, cx + 5, y, 1.4, '#c9ced4'); }
  }
  // pescoço e gola
  ctx.fillStyle = tint(L.skin, 0.9); ctx.fillRect(cx - 6, hy + 14, 12, 12);
  ctx.fillStyle = tint(L.shirt, 0.75);
  ctx.beginPath(); ctx.moveTo(cx - 9, 68); ctx.lineTo(cx, 76); ctx.lineTo(cx + 9, 68); ctx.lineTo(cx + 5, 67); ctx.lineTo(cx, 72); ctx.lineTo(cx - 5, 67); ctx.closePath(); ctx.fill();
  if (L.extra === 'tie') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(cx - 8, 68); ctx.lineTo(cx, 76); ctx.lineTo(cx + 8, 68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e63946';
    ctx.beginPath(); ctx.moveTo(cx - 2.5, 70); ctx.lineTo(cx + 2.5, 70); ctx.lineTo(cx + 3.5, 86); ctx.lineTo(cx, 90); ctx.lineTo(cx - 3.5, 86); ctx.closePath(); ctx.fill();
  }
  if (L.extra === 'apron') {
    ctx.fillStyle = '#fff6e6';
    ctx.beginPath(); ctx.moveTo(cx - 13, S); ctx.lineTo(cx - 11, 74); ctx.lineTo(cx + 11, 74); ctx.lineTo(cx + 13, S); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff6e6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 11, 74); ctx.lineTo(cx - 6, 66); ctx.moveTo(cx + 11, 74); ctx.lineTo(cx + 6, 66); ctx.stroke();
  }

  // orelhas e cabeça
  circle(ctx, cx - hr + 1, hy + 2, 4.5, tint(L.skin, 0.92));
  circle(ctx, cx + hr - 1, hy + 2, 4.5, tint(L.skin, 0.92));
  const head = ctx.createRadialGradient(cx - 6, hy - 8, 3, cx, hy, hr + 2);
  head.addColorStop(0, tint(L.skin, 1.12)); head.addColorStop(1, tint(L.skin, 0.95));
  circle(ctx, cx, hy, hr, head);

  // cabelo (frente)
  ctx.fillStyle = L.hairColor;
  const top = () => { ctx.beginPath(); ctx.arc(cx, hy - 1, hr + 1.5, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(cx + 8, hy - 12, cx - 2, hy - 13); ctx.quadraticCurveTo(cx - 14, hy - 12, cx - hr - 1, hy - 2); ctx.fill(); };
  switch (L.hair) {
    case 'short': case 'long': case 'ponytail': top(); break;
    case 'side':
      top();
      ctx.beginPath(); ctx.moveTo(cx - 6, hy - 20); ctx.quadraticCurveTo(cx + 18, hy - 22, cx + 20, hy - 6); ctx.quadraticCurveTo(cx + 6, hy - 14, cx - 6, hy - 14); ctx.fill();
      break;
    case 'bun': top(); circle(ctx, cx, hy - hr - 4, 8, L.hairColor); break;
    case 'curly':
      for (let k = 0; k < 9; k++) { const a = Math.PI * (1 + k / 8); circle(ctx, cx + Math.cos(a) * (hr + 1), hy - 2 + Math.sin(a) * (hr + 1), 6.5, L.hairColor); }
      break;
    case 'bald':
      ellipse(ctx, cx - hr + 3, hy - 3, 4, 7, L.hairColor); ellipse(ctx, cx + hr - 3, hy - 3, 4, 7, L.hairColor);
      break;
  }

  // rosto
  const eyeY = hy + 1;
  ctx.fillStyle = '#2b2b33';
  ellipse(ctx, cx - 7, eyeY, 2.1, 2.6, '#2b2b33'); ellipse(ctx, cx + 7, eyeY, 2.1, 2.6, '#2b2b33');
  circle(ctx, cx - 6.4, eyeY - 0.9, 0.7, '#ffffff'); circle(ctx, cx + 7.6, eyeY - 0.9, 0.7, '#ffffff');
  ctx.strokeStyle = tint(L.hairColor === '#d9d9d9' ? '#8a8a8a' : L.hairColor, 0.9); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 10, eyeY - 6); ctx.lineTo(cx - 4, eyeY - 6.8); ctx.moveTo(cx + 4, eyeY - 6.8); ctx.lineTo(cx + 10, eyeY - 6); ctx.stroke();
  ellipse(ctx, cx - 11, hy + 7, 3.4, 2, 'rgba(255,120,120,0.28)'); ellipse(ctx, cx + 11, hy + 7, 3.4, 2, 'rgba(255,120,120,0.28)');
  ctx.strokeStyle = tint(L.skin, 0.75); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(cx, eyeY + 2); ctx.quadraticCurveTo(cx - 2, eyeY + 6, cx + 1, eyeY + 6.5); ctx.stroke();
  ctx.strokeStyle = '#8a3b3b'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(cx, hy + 9, 5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  if (L.extra === 'mustache') {
    ctx.fillStyle = L.hair === 'bald' ? '#9a9a9a' : L.hairColor;
    ctx.beginPath(); ctx.moveTo(cx, hy + 8); ctx.quadraticCurveTo(cx - 7, hy + 6, cx - 9, hy + 10); ctx.quadraticCurveTo(cx - 4, hy + 9, cx, hy + 10);
    ctx.quadraticCurveTo(cx + 4, hy + 9, cx + 9, hy + 10); ctx.quadraticCurveTo(cx + 7, hy + 6, cx, hy + 8); ctx.fill();
  }
  if (L.extra === 'glasses') {
    ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx - 7, eyeY, 5, 0, Math.PI * 2); ctx.moveTo(cx + 12, eyeY); ctx.arc(cx + 7, eyeY, 5, 0, Math.PI * 2);
    ctx.moveTo(cx - 2, eyeY); ctx.lineTo(cx + 2, eyeY); ctx.stroke();
  }

  // chapéus
  if (L.hat === 'hardhat' || L.hat === 'helmet') {
    const col = L.hat === 'hardhat' ? '#ffc300' : '#c0392b';
    const g = ctx.createLinearGradient(0, hy - 26, 0, hy - 8);
    g.addColorStop(0, tint(col, 1.2)); g.addColorStop(1, tint(col, 0.88));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, hy - 7, hr + 1, Math.PI, 0); ctx.closePath(); ctx.fill();
    ellipse(ctx, cx, hy - 7, hr + 7, 3.5, tint(col, 0.8));
    ctx.fillStyle = tint(col, 1.1); ctx.fillRect(cx - 2, hy - 27, 4, 14);
    if (L.hat === 'helmet') { circle(ctx, cx, hy - 17, 4, '#ffd166'); }
  } else if (L.hat === 'chef') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 14, hy - 22, 28, 9);
    for (const [dx, dy, r] of [[-10, -28, 8], [0, -32, 10], [10, -28, 8]]) circle(ctx, cx + dx, hy + dy, r, '#ffffff');
    ctx.strokeStyle = '#e3e7eb'; ctx.lineWidth = 1; ctx.strokeRect(cx - 14, hy - 22, 28, 9);
  } else if (L.hat === 'cap') {
    ctx.fillStyle = '#2f6f8e';
    ctx.beginPath(); ctx.arc(cx, hy - 6, hr + 0.5, Math.PI, 0); ctx.closePath(); ctx.fill();
    ellipse(ctx, cx - 12, hy - 6, 14, 3.5, tint('#2f6f8e', 0.8));
  }
  ctx.restore();
}

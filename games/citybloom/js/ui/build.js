// build.js — menu de construção por abas, com miniaturas desenhadas pelo
// mesmo código dos prédios do mapa.

import { BUILDINGS, BUILD_TABS } from '../game/config.js';
import { countOf } from '../game/state.js';
import { PAINT, HEIGHT } from '../render/buildings.js';
import { lotSprite } from '../render/terrain.js';
import { bboxBuilding, BBOX_LOT } from '../render/sprites.js';
import { costHtml } from './panels.js';
import { t, tn } from '../i18n.js';

const thumbs = new Map();

// Miniatura PNG (dataURL) do prédio, gerada uma vez.
// Com a cidade 3D ligada, as miniaturas vêm dos modelos 3D.
let provider = null;
export function setThumbProvider(fn) { provider = fn; thumbs.clear(); }

export function thumb(type) {
  if (thumbs.has(type)) return thumbs.get(type);
  if (provider) { const url = provider(type); if (url) { thumbs.set(type, url); return url; } }
  const def = BUILDINGS[type];
  const bb = def.type === 'lot' ? BBOX_LOT : bboxBuilding(def.size, HEIGHT[type] || 40);
  // recorta a sombra/folga para a miniatura ficar mais cheia
  const crop = { x: bb.x + 18, y: bb.y + 14, w: bb.w - 70, h: bb.h - 40 };
  if (def.type === 'lot') Object.assign(crop, bb);
  const S = 120, k = Math.min(S / crop.w, S / crop.h) * 0.95;
  const c = document.createElement('canvas');
  c.width = S * 2; c.height = S * 2;
  const cx = c.getContext('2d');
  cx.setTransform(k * 2, 0, 0, k * 2, -crop.x * k * 2 + (S * 2 - crop.w * k * 2) / 2, -crop.y * k * 2 + (S * 2 - crop.h * k * 2) / 2);
  if (def.type === 'lot') lotSprite(cx, 'wood', 3); else PAINT[type](cx);
  const url = c.toDataURL();
  thumbs.set(type, url);
  return url;
}

export function buildMenuView(game) {
  const s = game.state, tab = game.buildTab || 'houses';
  const tabs = BUILD_TABS.map(tb =>
    `<button class="tab${tb.id === tab ? ' on' : ''}" data-act="tab" data-arg="${tb.id}">${tb.icon}<span>${tn(tb.name)}</span></button>`).join('');
  const items = Object.entries(BUILDINGS)
    .filter(([, d]) => d.cat === tab && d.buildable !== false)
    .sort((a, b) => a[1].unlock - b[1].unlock)
    .map(([k, d]) => {
      const locked = d.unlock > s.level;
      const count = countOf(s, k);
      const full = d.max && count >= d.max;
      const meta = locked ? `<div class="lock">🔒 ${t('level')} ${d.unlock}</div>`
        : `<div class="rc">${costHtml(s, d.build)}</div>${d.max ? `<div class="muted small">${count}/${d.max} ${t('limit')}</div>` : ''}`;
      return `<button class="card${locked || full ? ' off' : ''}" data-act="pick" data-arg="${k}"${locked || full ? ' disabled' : ''}>
        <img src="${thumb(k)}" alt="">
        ${locked ? '<div class="lockbig">🔒</div>' : ''}
        <b>${tn(d.name)}</b>${meta}
      </button>`;
    }).join('');
  return `<div class="tabs">${tabs}</div><div class="cards">${items}</div>`;
}

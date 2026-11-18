// orders.js — quadro de pedidos da Prefeitura: cada pedido vem de um
// personagem (retrato desenhado por código), com fala própria.

import { ITEMS } from '../game/config.js';
import { canDeliver, clientOf, rerollCost } from '../game/economy.js';
import { ads } from '../engine/ads.js';
import { avatarURL } from '../render/avatars.js';
import { t, tn, fmtTime, fmtNum, getLang } from '../i18n.js';

export function ordersView(game) {
  const s = game.state, now = Date.now();
  const cards = s.orders.map(o => {
    if (o.waitUntil) {
      return `<div class="order wait">
        <div class="ow">⏳ ${t('newOrderIn')} <b>${fmtTime((o.waitUntil - now) / 1000)}</b></div>
        <div class="obtns">${ads.available() ? `<button class="btn ad small" data-act="reroll" data-arg="${o.id}">▶ ${t('newNow')}</button>` : ''}
        <button class="btn coin small" data-act="rerollCoins" data-arg="${o.id}"${s.coins < rerollCost(s) ? ' disabled' : ''}>🪙 ${rerollCost(s)}</button></div>
      </div>`;
    }
    const c = clientOf(o);
    const lines = c.lines[getLang()] || c.lines.en;
    const say = lines[(o.line || 0) % lines.length];
    const items = Object.entries(o.items).map(([k, v]) => {
      const have = s.inventory[k] || 0;
      return `<div class="oi${have >= v ? ' ok' : ''}"><span>${ITEMS[k].icon}</span><small>${Math.min(have, v)}/${v}</small></div>`;
    }).join('');
    const ready = canDeliver(s, o);
    return `<div class="order${ready ? ' ready' : ''}">
      <div class="who">
        <img class="avatar" src="${avatarURL(c)}" alt="">
        <div class="whotxt">
          <b>${tn(c.name)}</b><span class="role">${tn(c.role)}</span>
          <div class="say">“${say}”</div>
        </div>
      </div>
      <div class="ois">${items}</div>
      <div class="orw">🪙 ${fmtNum(o.coins)} · ⭐ ${o.xp} XP</div>
      <div class="obtns">
        <button class="btn primary small" data-act="deliver" data-arg="${o.id}"${ready ? '' : ' disabled'}>${t('deliver')}</button>
        <button class="btn ghost small" data-act="discard" data-arg="${o.id}" title="${t('discard')}">🗑️</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="orders">${cards}</div>`;
}

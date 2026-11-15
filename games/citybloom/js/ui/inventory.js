// inventory.js — folha "Estoque": todos os itens e quantidades, agrupados,
// com a capacidade do armazém e de onde vem cada item.

import { ITEMS, RESOURCE_LOTS, BUILDINGS } from '../game/config.js';
import { used, warehouseCost, canAfford } from '../game/economy.js';
import { costHtml } from './panels.js';
import { t, tn, fmtNum } from '../i18n.js';

// De onde vem o item: { text, unlock } (unlock = nível em que fica disponível).
function sourceOf(key) {
  if (RESOURCE_LOTS[key]) return { text: t('fromLot'), unlock: RESOURCE_LOTS[key].unlock };
  for (const d of Object.values(BUILDINGS)) {
    if ((d.recipes || []).some(r => r.out === key)) return { text: `${t('fromFactory')} ${tn(d.name)}`, unlock: d.unlock };
  }
  if (ITEMS[key].kind === 'special') return { text: t('fromClear'), unlock: 1 };
  return { text: '', unlock: 1 };
}

const GROUPS = [['raw', 'rawGroup'], ['product', 'productGroup'], ['special', 'specialGroup']];

export function inventoryView(game) {
  const s = game.state;
  const u = used(s), cap = s.capacity, p = Math.min(1, u / cap);
  const cost = warehouseCost(s);

  const groups = GROUPS.map(([kind, label]) => {
    const cards = Object.entries(ITEMS).filter(([, it]) => it.kind === kind).map(([k, it]) => {
      const n = s.inventory[k] || 0;
      const src = sourceOf(k);
      const locked = src.unlock > s.level;
      return `<div class="icard${n ? '' : ' zero'}">
        <div class="iicon">${it.icon}</div>
        <div class="iinfo"><b>${tn(it.name)}</b><small>${locked ? `🔒 ${t('unlocksAt')} ${src.unlock}` : src.text}</small></div>
        <div class="iqty">${fmtNum(n)}</div>
      </div>`;
    }).join('');
    return `<p class="sec">${t(label)}</p>${kind === 'special' ? `<p class="muted small">${t('specialNote')}</p>` : ''}<div class="ilist">${cards}</div>`;
  }).join('');

  return `
    <div class="istore${u >= cap ? ' full' : ''}">
      <div class="irow"><b>📦 ${t('capacity')}</b><span>${fmtNum(u)} / ${fmtNum(cap)}</span></div>
      <div class="pbar"><div style="width:${Math.round(p * 100)}%"></div></div>
      <div class="upgrade"><div><b>${t('upgradeStorage')} (+25)</b><div class="rc">${costHtml(s, cost)}</div></div>
        <button class="btn primary small" data-act="whUpgrade"${canAfford(s, cost) ? '' : ' disabled'}>⬆️</button></div>
    </div>
    ${groups}`;
}

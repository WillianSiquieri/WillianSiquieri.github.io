// panels.js — painel de ações do item tocado (bottom sheet).
// Gera HTML com botões `data-act` / `data-arg`; o main.js trata os cliques.

import { ITEMS, RESOURCE_LOTS, BUILDINGS, OBSTACLES, MAP, secs, phaseIndex } from '../game/config.js';
import {
  lotProgress, factoryDone, factoryPending, happinessMult, incomeCoins, cargoOf, chunkOf, chunkBuyable, chunkHasLand, chunkPrice,
  used, warehouseCost, canAfford, speedUpCost, adOffer,
} from '../game/economy.js';
import { ads } from '../engine/ads.js';
import { tileOf, population } from '../game/state.js';
import { t, tn, fmtTime, fmtNum } from '../i18n.js';

export function costHtml(state, cost) {
  return Object.entries(cost || {}).map(([k, v]) => {
    const have = k === 'coins' ? state.coins : (state.inventory[k] || 0);
    const icon = k === 'coins' ? '🪙' : ITEMS[k].icon;
    return `<span class="cost${have >= v ? '' : ' miss'}">${icon} ${fmtNum(v)}</span>`;
  }).join('');
}

const btn = (act, label, cls = '', arg = '', disabled = false) =>
  `<button class="btn ${cls}" data-act="${act}" data-arg="${arg}"${disabled ? ' disabled' : ''}>${label}</button>`;

// Terminar já: vídeo (se houver anúncio) e/ou moedas (só produção).
function speedBtns(s, o, now) {
  const cost = speedUpCost(s, o, now);
  return (ads.available() ? btn('speed', `▶ ${t('speedUp')}`, 'ad') : '') +
    (cost ? btn('speedCoins', `🪙 ${cost} · ${t('speedUp')}`, 'coin', '', s.coins < cost) : '');
}
// Dobrar: só com anúncio disponível e no máximo a cada 4 min.
const doubleBtn = (s, now) => ads.available() && adOffer(s, 'double', now) ? btn('collect2', `▶ ${t('double')}`, 'ad') : '';

const bar = (p) => `<div class="pbar"><div style="width:${Math.round(Math.max(0, Math.min(1, p)) * 100)}%"></div></div>`;

export function panelView(game) {
  const s = game.state, sel = game.selected, now = Date.now();
  if (!sel) return null;

  // ---------------- chão ----------------
  if (sel.kind === 'tile') {
    const tile = tileOf(s, sel.i, sel.j);
    if (tile.kind === 'water') return { title: `🌊 ${t('water')}`, body: `<p>${t('waterDesc')}</p>`, actions: '' };
    if (tile.locked) {
      const { ci, cj } = chunkOf(sel.i, sel.j);
      if (!chunkHasLand(s, ci, cj)) return { title: `🏖️ ${t('noLandTitle')}`, body: `<p>${t('noLand')}</p>`, actions: '' };
      const buyable = chunkBuyable(s, ci, cj), price = chunkPrice(s);
      return {
        title: `🏷️ ${t('lockedTitle')}`,
        body: `<p>${buyable ? t('lockedDesc') : t('notAdjacent')}</p>`,
        actions: buyable ? btn('buyChunk', `${t('buyFor')} 🪙 ${fmtNum(price)}`, 'primary', '', s.coins < price) : '',
      };
    }
    if (tile.obstacle) {
      const ob = OBSTACLES[tile.obstacle];
      return {
        title: tn(ob.early && phaseIndex(s.level) <= 1 ? ob.early : ob.name),   // no vilarejo o "carro" é uma carroça quebrada
        body: `<p>${t('clearDesc')}</p>`,
        actions: btn('clear', `${t('clear')} · 🪙 ${ob.clear}`, 'primary', '', s.coins < ob.clear),
      };
    }
    if (tile.kind === 'road') return { title: `🛣️ ${t('road')}`, body: `<p>${t('roadDesc')}</p>`, actions: '' };
    if (tile.kind === 'sand') return { title: `🏖️ ${t('beach')}`, body: `<p>${t('beachDesc')}</p>`, actions: '' };
    return { title: `🌱 ${t('grass')}`, body: `<p>${t('grassDesc')}</p>`, actions: btn('buildHere', t('buildHere'), 'primary') };
  }

  // ---------------- construções ----------------
  const o = sel.obj, def = BUILDINGS[o.type];
  const title = tn(def.name);

  if (def.type === 'lot') {
    if (!o.resource) {
      const opts = Object.entries(RESOURCE_LOTS).map(([k, r]) => {
        const locked = r.unlock > s.level;
        return `<button class="choice" data-act="startLot" data-arg="${k}"${locked || s.coins < r.cost ? ' disabled' : ''}>
          <span class="ci">${ITEMS[k].icon}</span>
          <span class="cn">${tn(ITEMS[k].name)} ×${r.yield}</span>
          <span class="cm">${locked ? `🔒 ${t('level')} ${r.unlock}` : `⏱ ${fmtTime(secs(s, r.time))} · 🪙 ${r.cost}`}</span>
        </button>`;
      }).join('');
      return { title, body: `<p>${t('lotEmpty')}</p><div class="choices">${opts}</div>`, actions: '' };
    }
    const ready = now >= o.readyAt;
    const item = ITEMS[o.resource];
    return {
      title: `${title} · ${item.icon} ${tn(item.name)}`,
      body: ready ? `<p class="ok">✅ ${t('lotReady')}</p>`
        : `<p>${t('lotGrowing')} — ${t('timeLeft')} <b>${fmtTime((o.readyAt - now) / 1000)}</b></p>${bar(lotProgress(o, now))}`,
      actions: ready ? btn('collect', `${t('collect')} ${item.icon}`, 'primary')
        : speedBtns(s, o, now),
    };
  }

  if (def.type === 'factory') {
    const done = factoryDone(o, now), pend = factoryPending(o, now).sort((a, b) => a.readyAt - b.readyAt);
    const slots = [];
    for (let k = 0; k < def.queue; k++) {
      const q = o.queue[k];
      if (!q) { slots.push(`<div class="slot empty">${t('free')}</div>`); continue; }
      const out = ITEMS[def.recipes[q.r].out];
      slots.push(q.readyAt <= now
        ? `<div class="slot done">${out.icon}<small>✓</small></div>`
        : `<div class="slot">${out.icon}<small>${fmtTime((q.readyAt - now) / 1000)}</small></div>`);
    }
    const recipes = def.recipes.map((r, idx) => {
      const out = ITEMS[r.out];
      const full = o.queue.length >= def.queue;
      return `<div class="recipe">
        <div class="rl"><span class="ci">${out.icon}</span><div><b>${tn(out.name)}</b><div class="rc">${costHtml(s, r.in)} · ⏱ ${fmtTime(secs(s, r.time))}</div></div></div>
        ${btn('recipe', t('produce'), 'primary small', idx, full || !canAfford(s, r.in))}
      </div>`;
    }).join('');
    return {
      title,
      body: `<div class="slots"><span class="lbl">${t('queue')}</span>${slots.join('')}</div>${recipes}`,
      actions: (done.length ? btn('collect', `${t('collect')} (${done.length})`, 'primary') : '') +
               (pend.length ? speedBtns(s, o, now) : ''),
    };
  }

  if (def.type === 'house') {
    const ready = now >= o.rentReadyAt;
    const rent = Math.round(def.rent * happinessMult(s));
    let up = `<p class="muted">${t('maxTier')}</p>`;
    if (def.next) {
      const nd = BUILDINGS[def.next];
      const locked = nd.unlock > s.level;
      up = `<div class="upgrade"><div><b>${t('upgrade')}: ${tn(nd.name)}</b>
          <div class="rc">👥 ${nd.residents} · 🪙 ${nd.rent}/${fmtTime(secs(s, nd.rentTime))}</div>
          <div class="rc">${locked ? `🔒 ${t('unlocksAt')} ${nd.unlock}` : costHtml(s, nd.build)}</div></div>
        ${btn('upgrade', '⬆️', 'primary small', '', locked || !canAfford(s, nd.build))}</div>`;
    }
    return {
      title,
      body: `<p>👥 ${def.residents} ${t('residents')} · ${t('rent')} 🪙 ${rent} ${t('every')} ${fmtTime(secs(s, def.rentTime))}</p>
        ${ready ? `<p class="ok">✅ 🪙 ${rent}</p>` : `${bar(1 - (o.rentReadyAt - now) / (secs(s, def.rentTime) * 1000))}<p class="muted">${t('timeLeft')} ${fmtTime((o.rentReadyAt - now) / 1000)}</p>`}
        ${up}`,
      actions: ready ? btn('collect', `${t('collect')} 🪙 ${rent}`, 'primary') + doubleBtn(s, now)
        : speedBtns(s, o, now),
    };
  }

  if (def.type === 'commerce') {
    const pop = population(s);
    const amount = incomeCoins(s, o);
    const cargo = def.cargo ? Object.entries(cargoOf(s).items).map(([k, v]) => ` + ${ITEMS[k].icon} ${v}`).join('') : '';
    const intro = def.cargo ? `<p class="muted">${t('portDesc')}</p>` : '';
    if (pop < def.minPop) {
      return { title, body: `<p>${t('income')}: 🪙 ${amount} ${t('every')} ${fmtTime(secs(s, def.income.time))}</p><p class="warn">👥 ${pop}/${def.minPop} — ${t('needPop', { n: def.minPop })}</p>`, actions: '' };
    }
    const ready = o.incomeReadyAt && now >= o.incomeReadyAt;
    return {
      title,
      body: intro + `<p>${t('income')}: 🪙 ${amount}${cargo} ${t('every')} ${fmtTime(secs(s, def.income.time))}</p>` +
        (ready ? `<p class="ok">✅ ${def.cargo ? '🚢 ' + t('shipArrived') + ' ' : ''}🪙 ${amount}${cargo}</p>` : o.incomeReadyAt ? `${bar(1 - (o.incomeReadyAt - now) / (secs(s, def.income.time) * 1000))}<p class="muted">${t('timeLeft')} ${fmtTime((o.incomeReadyAt - now) / 1000)}</p>` : ''),
      actions: ready ? btn('collect', `${t('collect')} 🪙 ${amount}`, 'primary') + doubleBtn(s, now)
        : (o.incomeReadyAt ? speedBtns(s, o, now) : ''),
    };
  }

  if (o.type === 'townhall') {
    return { title, body: `<p>${tn(def.desc)}</p>`, actions: btn('orders', t('seeOrders'), 'primary') };
  }

  if (o.type === 'warehouse') {
    const inv = Object.entries(s.inventory).filter(([, v]) => v > 0);
    const cells = inv.length
      ? inv.map(([k, v]) => `<div class="inv"><span>${ITEMS[k].icon}</span><b>${v}</b><small>${tn(ITEMS[k].name)}</small></div>`).join('')
      : `<p class="muted">${t('empty')}</p>`;
    const cost = warehouseCost(s);
    return {
      title,
      body: `<p>${t('capacity')}: <b>${used(s)}/${s.capacity}</b></p>${bar(used(s) / s.capacity)}
        <div class="invgrid">${cells}</div>
        <div class="upgrade"><div><b>${t('upgradeStorage')} (+25)</b><div class="rc">${costHtml(s, cost)}</div></div>
        ${btn('whUpgrade', '⬆️', 'primary small', '', !canAfford(s, cost))}</div>`,
      actions: btn('inventory', `📦 ${t('seeInventory')}`, 'primary'),
    };
  }

  // serviços, decoração, monumentos
  return {
    title,
    body: def.happiness ? `<p>⭐ +${def.happiness} ${t('happiness')}</p><p class="muted">${t('happyDesc')}</p>` : `<p>${tn(def.desc) || ''}</p>`,
    actions: '',
  };
}

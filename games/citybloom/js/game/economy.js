// economy.js — regras do jogo (funções puras sobre o estado).
// Cada ação devolve { ok: true, ... } ou { ok: false, err: 'chave', need? }.
// Tempos são horários absolutos (ms): o progresso offline acontece sozinho.

import {
  ITEMS, RESOURCE_LOTS, BUILDINGS, OBSTACLES, SPECIAL_DROP_CHANCE, MAP, CHUNK_PRICE,
  ORDERS, WAREHOUSE, warehouseUpgradeCost, HAPPINESS, phaseIndex, xpToNext, buildXP,
} from './config.js';
import { makeObject, tileOf, objectAt, countOf, population, happiness } from './state.js';

const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = (err, extra = {}) => ({ ok: false, err, ...extra });
const bump = (s, key, n = 1) => { s.stats[key] = (s.stats[key] || 0) + n; };
const touch = (s) => { s.rev = (s.rev || 0) + 1; };

// ---------------------------------------------------------------------------
// Inventário e custos
// ---------------------------------------------------------------------------
export function used(state) {
  let n = 0;
  for (const [k, v] of Object.entries(state.inventory)) if (ITEMS[k] && ITEMS[k].kind !== 'special') n += v;
  return n;
}
export function freeSpace(state) { return Math.max(0, state.capacity - used(state)); }
export function have(state, k) { return state.inventory[k] || 0; }

function addItems(state, items) {
  for (const [k, v] of Object.entries(items)) state.inventory[k] = (state.inventory[k] || 0) + v;
}

// O que falta para pagar `cost` ({ coins, item: n }).
export function missing(state, cost) {
  const need = {};
  for (const [k, v] of Object.entries(cost || {})) {
    const h = k === 'coins' ? state.coins : have(state, k);
    if (h < v) need[k] = v - h;
  }
  return need;
}
export function canAfford(state, cost) { return Object.keys(missing(state, cost)).length === 0; }

function pay(state, cost) {
  for (const [k, v] of Object.entries(cost || {})) {
    if (k === 'coins') state.coins -= v;
    else state.inventory[k] = have(state, k) - v;
  }
}

function payOrFail(state, cost) {
  const need = missing(state, cost);
  if (Object.keys(need).length) return fail(need.coins && Object.keys(need).length === 1 ? 'noCoins' : 'noItems', { need });
  pay(state, cost);
  return null;
}

// ---------------------------------------------------------------------------
// XP, níveis e fases
// ---------------------------------------------------------------------------
export function addXP(state, n) {
  const before = phaseIndex(state.level);
  const levels = [];
  state.xp += n;
  while (state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level++;
    levels.push(state.level);
  }
  return { levels, phaseChanged: phaseIndex(state.level) !== before };
}

// O que um nível libera (para a mensagem de "subiu de nível").
export function unlocksAt(level) {
  const list = [];
  for (const [k, d] of Object.entries(BUILDINGS)) if (d.unlock === level && d.buildable !== false) list.push({ kind: 'building', key: k });
  for (const [k, r] of Object.entries(RESOURCE_LOTS)) if (r.unlock === level) list.push({ kind: 'resource', key: k });
  return list;
}

export function happinessMult(state) {
  return Math.min(HAPPINESS.maxMult, 1 + happiness(state) / HAPPINESS.divisor);
}

// ---------------------------------------------------------------------------
// Lotes de produção
// ---------------------------------------------------------------------------
export function lotProgress(o, now) {
  if (!o.resource || !o.readyAt) return 0;
  const total = RESOURCE_LOTS[o.resource].time * 1000;
  return Math.max(0, Math.min(1, 1 - (o.readyAt - now) / total));
}

export function startLot(state, o, res, now) {
  if (o.resource) return fail('busy');
  const r = RESOURCE_LOTS[res];
  if (!r) return fail('invalid');
  if (r.unlock > state.level) return fail('locked', { level: r.unlock });
  const f = payOrFail(state, { coins: r.cost });
  if (f) return f;
  o.resource = res;
  o.readyAt = now + r.time * 1000;
  bump(state, 'lotStarted');
  return ok();
}

export function collectLot(state, o, now) {
  if (!o.resource) return fail('empty');
  if (now < o.readyAt) return fail('notReady');
  const r = RESOURCE_LOTS[o.resource];
  if (freeSpace(state) < r.yield) return fail('storageFull');
  const items = { [o.resource]: r.yield };
  addItems(state, items);
  const lv = addXP(state, r.xp);
  o.resource = null; o.readyAt = null;
  bump(state, 'lotCollected');
  return ok({ items, xp: r.xp, ...lv });
}

// ---------------------------------------------------------------------------
// Fábricas (fila de produção sequencial)
// ---------------------------------------------------------------------------
export function factoryDone(o, now) { return (o.queue || []).filter(q => q.readyAt <= now); }
export function factoryPending(o, now) { return (o.queue || []).filter(q => q.readyAt > now); }

export function startRecipe(state, o, idx, now) {
  const def = BUILDINGS[o.type];
  const rec = def.recipes && def.recipes[idx];
  if (!rec) return fail('invalid');
  if (o.queue.length >= def.queue) return fail('queueFull');
  const f = payOrFail(state, rec.in);
  if (f) return f;
  const last = o.queue.reduce((m, q) => Math.max(m, q.readyAt), 0);
  const start = Math.max(now, last);
  o.queue.push({ r: idx, readyAt: start + rec.time * 1000 });
  bump(state, 'factoryStarted');
  return ok();
}

export function collectFactory(state, o, now) {
  const def = BUILDINGS[o.type];
  const done = factoryDone(o, now).sort((a, b) => a.readyAt - b.readyAt);
  if (!done.length) return fail('notReady');
  const space = freeSpace(state);
  if (space < 1) return fail('storageFull');
  const take = done.slice(0, space);
  const items = {};
  let xp = 0;
  for (const q of take) {
    const rec = def.recipes[q.r];
    items[rec.out] = (items[rec.out] || 0) + 1;
    xp += rec.xp;
  }
  addItems(state, items);
  o.queue = o.queue.filter(q => !take.includes(q));
  bump(state, 'productsMade', take.length);
  const lv = addXP(state, xp);
  return ok({ items, xp, partial: take.length < done.length, ...lv });
}

// ---------------------------------------------------------------------------
// Casas e comércio (renda periódica)
// ---------------------------------------------------------------------------
export function collectRent(state, o, now, mult = 1) {
  const def = BUILDINGS[o.type];
  if (now < o.rentReadyAt) return fail('notReady');
  const coins = Math.round(def.rent * happinessMult(state) * mult);
  state.coins += coins;
  o.rentReadyAt = now + def.rentTime * 1000;
  bump(state, 'rentCollected');
  const lv = addXP(state, 1);
  return ok({ coins, xp: 1, ...lv });
}

export function collectIncome(state, o, now, mult = 1) {
  const def = BUILDINGS[o.type];
  if (!o.incomeReadyAt || now < o.incomeReadyAt) return fail('notReady');
  const coins = Math.round(def.income.coins * happinessMult(state) * mult);
  state.coins += coins;
  o.incomeReadyAt = now + def.income.time * 1000;
  bump(state, 'incomeCollected');
  const lv = addXP(state, 2);
  return ok({ coins, xp: 2, ...lv });
}

export function upgradeHouse(state, o, now) {
  const def = BUILDINGS[o.type];
  if (!def.next) return fail('maxLevel');
  const nd = BUILDINGS[def.next];
  if (nd.unlock > state.level) return fail('locked', { level: nd.unlock });
  const f = payOrFail(state, nd.build);
  if (f) return f;
  // aluguel pendente é pago antes de evoluir
  let bonus = 0;
  if (now >= o.rentReadyAt) { bonus = Math.round(def.rent * happinessMult(state)); state.coins += bonus; }
  o.type = def.next;
  o.rentReadyAt = now + nd.rentTime * 1000;
  touch(state);
  bump(state, 'upgraded');
  const xp = buildXP(nd.build);
  return ok({ xp, coins: bonus, ...addXP(state, xp) });
}

// ---------------------------------------------------------------------------
// Acelerar (anúncio premiado)
// ---------------------------------------------------------------------------
export function speedUp(state, o, now) {
  const def = BUILDINGS[o.type];
  if (def.type === 'lot' && o.resource && o.readyAt > now) { o.readyAt = now; return ok(); }
  if (def.type === 'factory') {
    const pend = factoryPending(o, now).sort((a, b) => a.readyAt - b.readyAt);
    if (!pend.length) return fail('notBusy');
    const delta = pend[0].readyAt - now;
    for (const q of pend) q.readyAt -= delta;
    return ok();
  }
  if (def.type === 'house' && o.rentReadyAt > now) { o.rentReadyAt = now; return ok(); }
  if (def.type === 'commerce' && o.incomeReadyAt && o.incomeReadyAt > now) { o.incomeReadyAt = now; return ok(); }
  return fail('notBusy');
}

// ---------------------------------------------------------------------------
// Construir
// ---------------------------------------------------------------------------
export function canPlace(state, type, i, j, ignore = null) {
  const def = BUILDINGS[type];
  for (let dj = 0; dj < def.size; dj++) for (let di = 0; di < def.size; di++) {
    const t = tileOf(state, i + di, j + dj);
    if (!t || t.locked || t.kind === 'road' || t.obstacle) return false;
    const o = objectAt(state, i + di, j + dj);
    if (o && o !== ignore) return false;
  }
  return true;
}

export function buildCheck(state, type) {
  const def = BUILDINGS[type];
  if (!def || def.buildable === false) return fail('invalid');
  if (def.unlock > state.level) return fail('locked', { level: def.unlock });
  if (def.max && countOf(state, type) >= def.max) return fail('maxCount');
  return ok();
}

export function build(state, type, i, j, now) {
  const c = buildCheck(state, type);
  if (!c.ok) return c;
  if (!canPlace(state, type, i, j)) return fail('invalidPlace');
  const def = BUILDINGS[type];
  const f = payOrFail(state, def.build);
  if (f) return f;
  const o = makeObject(state, type, i, j, now);
  state.objects.push(o);
  touch(state);
  bump(state, 'built');
  const xp = buildXP(def.build);
  return ok({ obj: o, xp, ...addXP(state, xp) });
}

// ---------------------------------------------------------------------------
// Expansão por quadras (3×3)
// ---------------------------------------------------------------------------
export function chunkOf(i, j) { return { ci: Math.floor(i / MAP.chunk), cj: Math.floor(j / MAP.chunk) }; }
function chunkUnlocked(state, ci, cj) {
  const n = state.size / MAP.chunk;
  if (ci < 0 || cj < 0 || ci >= n || cj >= n) return false;
  return !tileOf(state, ci * MAP.chunk, cj * MAP.chunk).locked;
}
export function chunkBuyable(state, ci, cj) {
  if (chunkUnlocked(state, ci, cj)) return false;
  const n = state.size / MAP.chunk;
  if (ci < 0 || cj < 0 || ci >= n || cj >= n) return false;
  return chunkUnlocked(state, ci - 1, cj) || chunkUnlocked(state, ci + 1, cj) ||
         chunkUnlocked(state, ci, cj - 1) || chunkUnlocked(state, ci, cj + 1);
}
export function chunkPrice(state) {
  return Math.round(CHUNK_PRICE.base * Math.pow(CHUNK_PRICE.growth, state.chunksBought) / 10) * 10;
}
export function buyChunk(state, ci, cj) {
  if (!chunkBuyable(state, ci, cj)) return fail('notAdjacent');
  const f = payOrFail(state, { coins: chunkPrice(state) });
  if (f) return f;
  for (let j = cj * MAP.chunk; j < (cj + 1) * MAP.chunk; j++)
    for (let i = ci * MAP.chunk; i < (ci + 1) * MAP.chunk; i++) tileOf(state, i, j).locked = false;
  state.chunksBought++;
  touch(state);
  bump(state, 'chunksBought');
  return ok({ xp: 10, ...addXP(state, 10) });
}

// ---------------------------------------------------------------------------
// Obstáculos
// ---------------------------------------------------------------------------
export function clearObstacle(state, i, j, rand = Math.random) {
  const t = tileOf(state, i, j);
  if (!t || !t.obstacle) return fail('invalid');
  if (t.locked) return fail('locked');
  const ob = OBSTACLES[t.obstacle];
  const f = payOrFail(state, { coins: ob.clear });
  if (f) return f;
  delete t.obstacle;
  touch(state);
  bump(state, 'cleared');
  let drop = null;
  if (rand() < SPECIAL_DROP_CHANCE) {
    drop = rand() < 0.5 ? 'hammer' : 'tape';
    addItems(state, { [drop]: 1 });
  }
  return ok({ drop, xp: ob.xp, ...addXP(state, ob.xp) });
}

// ---------------------------------------------------------------------------
// Armazém
// ---------------------------------------------------------------------------
export function warehouseCost(state) { return warehouseUpgradeCost(state.warehouseLevel); }
export function upgradeWarehouse(state) {
  const f = payOrFail(state, warehouseCost(state));
  if (f) return f;
  state.warehouseLevel++;
  state.capacity = WAREHOUSE.base + WAREHOUSE.step * state.warehouseLevel;
  bump(state, 'warehouseUp');
  return ok({ capacity: state.capacity, ...addXP(state, 5) });
}

// ---------------------------------------------------------------------------
// Pedidos (Prefeitura)
// ---------------------------------------------------------------------------
export function orderSlots(state) {
  return Math.min(ORDERS.maxSlots, ORDERS.baseSlots + phaseIndex(state.level));
}

// Itens que o jogador já consegue produzir com o que tem na cidade.
export function producibleItems(state) {
  const out = [];
  const hasLot = state.objects.some(o => o.type === 'lot');
  if (hasLot) for (const [k, r] of Object.entries(RESOURCE_LOTS)) if (r.unlock <= state.level) out.push(k);
  for (const o of state.objects) {
    const d = BUILDINGS[o.type];
    if (d.type === 'factory') for (const rec of d.recipes) if (!out.includes(rec.out)) out.push(rec.out);
  }
  return out;
}

const orderSig = (items) => Object.keys(items).sort().map(k => `${k}${items[k]}`).join('|');

// Gera um pedido diferente dos que já estão no quadro (até 8 tentativas).
export function generateOrder(state, rand = Math.random) {
  const taken = new Set(state.orders.filter(o => o.items).map(o => orderSig(o.items)));
  let o = null;
  for (let k = 0; k < 8; k++) {
    o = makeOrder(state, rand);
    if (!o || !taken.has(orderSig(o.items)) || k === 7) break; // na última, aceita mesmo repetido
    state.nextOrderId--; // descarta o id da tentativa repetida
  }
  return o;
}

function makeOrder(state, rand) {
  const pool = producibleItems(state);
  if (!pool.length) return null;
  const kinds = Math.min(pool.length, 1 + Math.floor(rand() * Math.min(3, 1 + state.level / 4)));
  const picked = [];
  while (picked.length < kinds) {
    const k = pool[Math.floor(rand() * pool.length)];
    if (!picked.includes(k)) picked.push(k);
  }
  const items = {};
  let value = 0;
  for (const k of picked) {
    const raw = ITEMS[k].kind === 'raw';
    const maxQ = Math.max(1, Math.round((raw ? 2 : 1) * (1 + state.level / 4)));
    const q = 1 + Math.floor(rand() * Math.min(maxQ, raw ? 6 : 4));
    items[k] = q;
    value += ITEMS[k].value * q;
  }
  return {
    id: state.nextOrderId++,
    items,
    coins: Math.round(value * 1.4 + 5),
    xp: Math.max(2, Math.round(value / 3)),
  };
}

// Mantém os slots cheios; slots descartados voltam após o cooldown.
export function refillOrders(state, now, rand = Math.random) {
  const slots = orderSlots(state);
  let changed = false;
  while (state.orders.length < slots) {
    const o = generateOrder(state, rand);
    if (!o) break;
    state.orders.push(o); changed = true;
  }
  state.orders.forEach((o, idx) => {
    if (o.waitUntil && now >= o.waitUntil) {
      const fresh = generateOrder(state, rand);
      if (fresh) { state.orders[idx] = fresh; changed = true; }
    }
  });
  return changed;
}

export function canDeliver(state, order) {
  if (!order || order.waitUntil) return false;
  return Object.entries(order.items).every(([k, v]) => have(state, k) >= v);
}

export function deliverOrder(state, id, rand = Math.random) {
  const idx = state.orders.findIndex(o => o.id === id);
  const order = state.orders[idx];
  if (!order || order.waitUntil) return fail('invalid');
  if (!canDeliver(state, order)) return fail('noItems', { need: missing(state, order.items) });
  pay(state, order.items);
  state.coins += order.coins;
  bump(state, 'ordersDone');
  const lv = addXP(state, order.xp);
  state.orders[idx] = generateOrder(state, rand) || { id: state.nextOrderId++, waitUntil: Date.now() };
  return ok({ coins: order.coins, xp: order.xp, ...lv });
}

export function discardOrder(state, id, now) {
  const idx = state.orders.findIndex(o => o.id === id);
  if (idx < 0) return fail('invalid');
  state.orders[idx] = { id: state.nextOrderId++, waitUntil: now + ORDERS.cooldown * 1000 };
  return ok();
}

// Troca imediata (anúncio premiado).
export function rerollOrder(state, id, rand = Math.random) {
  const idx = state.orders.findIndex(o => o.id === id);
  if (idx < 0) return fail('invalid');
  const fresh = generateOrder(state, rand);
  if (!fresh) return fail('invalid');
  state.orders[idx] = fresh;
  return ok();
}

// ---------------------------------------------------------------------------
// Atualização periódica (1×/s): comércio liga/desliga, pedidos reabastecem.
// ---------------------------------------------------------------------------
export function tick(state, now, rand = Math.random) {
  const pop = population(state);
  for (const o of state.objects) {
    const d = BUILDINGS[o.type];
    if (d.type !== 'commerce') continue;
    if (pop >= d.minPop && !o.incomeReadyAt) o.incomeReadyAt = now + d.income.time * 1000;
    if (pop < d.minPop && o.incomeReadyAt && o.incomeReadyAt > now) o.incomeReadyAt = null;
  }
  return refillOrders(state, now, rand);
}

// ---------------------------------------------------------------------------
// Indicador "pronto" acima de cada construção (para o desenho)
// ---------------------------------------------------------------------------
export function readyIcon(state, o, now) {
  const d = BUILDINGS[o.type];
  if (d.type === 'lot') return o.resource && now >= o.readyAt ? ITEMS[o.resource].icon : null;
  if (d.type === 'factory') {
    const done = factoryDone(o, now);
    return done.length ? ITEMS[d.recipes[done[0].r].out].icon : null;
  }
  if (d.type === 'house') return now >= o.rentReadyAt ? '🪙' : null;
  if (d.type === 'commerce') return o.incomeReadyAt && now >= o.incomeReadyAt ? '🪙' : null;
  if (o.type === 'townhall') return state.orders.some(or => canDeliver(state, or)) ? '📋' : null;
  return null;
}

// Coleta rápida ao tocar (o que estiver pronto). Devolve null se nada pronto.
export function quickCollect(state, o, now) {
  const d = BUILDINGS[o.type];
  if (d.type === 'lot' && o.resource && now >= o.readyAt) return collectLot(state, o, now);
  if (d.type === 'factory' && factoryDone(o, now).length) return collectFactory(state, o, now);
  if (d.type === 'house' && now >= o.rentReadyAt) return collectRent(state, o, now);
  if (d.type === 'commerce' && o.incomeReadyAt && now >= o.incomeReadyAt) return collectIncome(state, o, now);
  return null;
}

// ---------------------------------------------------------------------------
// Dicas de objetivo (primeiros passos)
// ---------------------------------------------------------------------------
export const TIPS = ['tipCollect', 'tipPlant', 'tipPlank', 'tipRent', 'tipOrder', 'tipBuild', 'tipExpand'];
const TIP_DONE = {
  tipCollect: s => s.stats.lotCollected >= 1,
  tipPlant: s => s.stats.lotStarted >= 1,
  tipPlank: s => s.stats.factoryStarted >= 1,
  tipRent: s => s.stats.rentCollected >= 1,
  tipOrder: s => s.stats.ordersDone >= 1,
  tipBuild: s => s.stats.built >= 1,
  tipExpand: s => s.stats.chunksBought >= 1,
};
export function currentTip(state) {
  for (const k of TIPS) if (!TIP_DONE[k](state)) return k;
  return null;
}

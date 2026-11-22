// economy.js — regras do jogo (funções puras sobre o estado).
// Cada ação devolve { ok: true, ... } ou { ok: false, err: 'chave', need? }.
// Tempos são horários absolutos (ms): o progresso offline acontece sozinho.

import { secs,
  ITEMS, RESOURCE_LOTS, BUILDINGS, OBSTACLES, SPECIAL_DROP_CHANCE, MAP, CHUNK_PRICE,
  ORDERS, WAREHOUSE, warehouseUpgradeCost, HAPPINESS, phaseIndex, phaseOf, levelCap, phaseGoodsOf, xpToNext, buildXP, CLIENTS,
  levelReward, phaseGoods, DAILY, DAILY_COIN_GROWTH, DAILY_EXTRA, PHASES, PHASE_GOALS, ACHIEVEMENTS,
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
  const levels = [], rewards = [];
  state.xp += n;
  const cap = levelCap(state);
  while (state.xp >= xpToNext(state.level)) {
    // no último nível da fase o nível para: falta cumprir as metas da fase (o XP fica guardado)
    if (state.level >= cap) { state.xp = xpToNext(state.level); break; }
    state.xp -= xpToNext(state.level);
    state.level++;
    levels.push(state.level);
    // presente do prefeito a cada nível
    rewards.push({ level: state.level, ...grantReward(state, levelReward(state.level)) });
  }
  return { levels, rewards, phaseChanged: false };
}
// Nível travado esperando as metas da fase?
export function levelBlocked(state) { return state.level >= levelCap(state) && state.xp >= xpToNext(state.level); }

// Pedidos de quem não é desta época passam para alguém da época (mesmos itens e prêmio).
function reassignOrders(state) {
  const era = eraClients(state), ids = new Set(era.map(c => c.id));
  for (const o of state.orders) if (!ids.has(o.client)) { o.client = era[o.id % era.length].id; o.line = 0; }
}

// ---------------------------------------------------------------------------
// Presentes (nível, baú diário): entrega moedas e itens. Itens que não cabem no
// armazém viram moedas (2× o valor), para o armazém nunca travar a coleta.
// Devolve o que foi de fato recebido: { coins, items, converted }.
// ---------------------------------------------------------------------------
export function grantReward(state, reward) {
  const got = { coins: reward.coins || 0, items: {}, converted: 0 };
  for (const [k, v] of Object.entries(reward.items || {})) {
    if (!v) continue;
    const special = ITEMS[k].kind === 'special';
    const fit = special ? v : Math.min(v, freeSpace(state));
    if (fit > 0) { state.inventory[k] = have(state, k) + fit; got.items[k] = fit; }
    if (v > fit) got.converted += (v - fit) * ITEMS[k].value * 2;
  }
  got.coins += got.converted;
  state.coins += got.coins;
  touch(state);
  return got;
}

// ---------------------------------------------------------------------------
// Baú diário: calendário de 7 dias + baú extra (anúncio) uma vez por dia.
// Dias contam pela data local do aparelho. Perdeu um dia → volta ao dia 1.
// ---------------------------------------------------------------------------
export function dayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayNum(key) { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); }
function ensureDaily(state) { if (!state.daily) state.daily = { next: 0, last: null, extra: null }; return state.daily; }

export function dailyStatus(state, now) {
  const d = ensureDaily(state);
  const today = dayKey(now);
  const gap = d.last ? dayNum(today) - dayNum(d.last) : null;
  const claimedToday = gap === 0;
  const streakBroken = gap !== null && gap > 1;
  const day = claimedToday ? (d.next + 6) % 7 : (streakBroken ? 0 : d.next % 7);
  return { canClaim: !claimedToday, claimedToday, day, streakBroken, extraAvailable: claimedToday && d.extra !== today };
}

// Recompensa concreta do dia `day` (0–6) para o nível atual.
export function dailyReward(state, day) {
  return resolveReward(state, DAILY[day]);
}
function resolveReward(state, def) {
  const [raw, product] = phaseGoodsOf(state);
  const mult = 1 + DAILY_COIN_GROWTH * (state.level - 1);
  const items = {};
  for (const [k, v] of Object.entries(def.items || {})) {
    const key = k === 'raw' ? raw : k === 'product' ? product : k;
    items[key] = (items[key] || 0) + v;
  }
  return { coins: Math.round((def.coins || 0) * mult), items };
}

export function claimDaily(state, now) {
  const st = dailyStatus(state, now);
  if (!st.canClaim) return fail('alreadyClaimed');
  const d = state.daily;
  const got = grantReward(state, dailyReward(state, st.day));
  d.next = (st.day + 1) % 7;
  d.last = dayKey(now);
  bump(state, 'dailyClaimed');
  return ok({ day: st.day, got });
}

export function claimDailyExtra(state, now, rand = Math.random) {
  const st = dailyStatus(state, now);
  if (!st.extraAvailable) return fail(st.claimedToday ? 'alreadyClaimed' : 'claimFirst');
  const def = DAILY_EXTRA[Math.floor(rand() * DAILY_EXTRA.length) % DAILY_EXTRA.length];
  const got = grantReward(state, resolveReward(state, def));
  state.daily.extra = dayKey(now);
  return ok({ got });
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
  const total = o.total || RESOURCE_LOTS[o.resource].time * 1000;
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
  o.total = secs(state, r.time) * 1000;
  o.readyAt = now + o.total;
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
  o.resource = null; o.readyAt = null; o.total = null;
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
  o.queue.push({ r: idx, readyAt: start + secs(state, rec.time) * 1000 });
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
  o.rentReadyAt = now + secs(state, def.rentTime) * 1000;
  bump(state, 'rentCollected');
  const lv = addXP(state, 1);
  return ok({ coins, xp: 1, ...lv });
}

// Renda de um comércio (o porto cresce com a fase) e a carga do navio.
export function incomeCoins(state, o) {
  const def = BUILDINGS[o.type], ph = phaseOf(state);
  return Math.round(def.income.coins * (def.cargo ? 1 + ph * 0.6 : 1) * happinessMult(state));
}
export function cargoOf(state, mult = 1) {
  const ph = phaseOf(state), [raw, product] = phaseGoodsOf(state);
  return { items: { [raw]: Math.round((2 + ph) * mult), [product]: Math.max(1, Math.round((1 + ph / 2) * mult)) } };
}
export function collectIncome(state, o, now, mult = 1) {
  const def = BUILDINGS[o.type];
  if (!o.incomeReadyAt || now < o.incomeReadyAt) return fail('notReady');
  let coins = Math.round(incomeCoins(state, o) * mult);
  state.coins += coins;
  o.incomeReadyAt = now + secs(state, def.income.time) * 1000;
  bump(state, 'incomeCollected');
  let items;
  if (def.cargo) {                       // navio chegou: carga da época
    bump(state, 'shipsArrived');
    const got = grantReward(state, cargoOf(state, mult));
    items = got.items; coins += got.converted;            // carga que não coube virou moedas
  }
  const lv = addXP(state, def.cargo ? 4 : 2);
  return ok({ coins, items, xp: def.cargo ? 4 : 2, ...lv });
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
  o.rentReadyAt = now + secs(state, nd.rentTime) * 1000;
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
    if (!t || t.locked || t.obstacle) return false;
    if (def.placeOn === 'coast' ? !(t.kind === 'sand' || (t.kind === 'water' && !t.bridge)) : t.kind !== 'grass') return false;
    const o = objectAt(state, i + di, j + dj);
    if (o && o !== ignore) return false;
  }
  if (def.placeOn === 'coast') {   // porto: metade na areia, metade na água
    let sand = 0, water = 0;
    for (let dj = 0; dj < def.size; dj++) for (let di = 0; di < def.size; di++) { const k = tileOf(state, i + di, j + dj).kind; if (k === 'sand') sand++; else water++; }
    if (!sand || !water) return false;
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

// Reposiciona uma construção já feita (grátis). O progresso (aluguel,
// produção) continua igual.
export function moveObject(state, o, i, j) {
  if (!state.objects.includes(o)) return fail('generic');
  if (o.i === i && o.j === j) return ok({ same: true });
  if (!canPlace(state, o.type, i, j, o)) return fail('invalidPlace');
  o.i = i; o.j = j;
  touch(state);
  bump(state, 'moved');
  return ok({ obj: o });
}

export function build(state, type, i, j, now) {
  const c = buildCheck(state, type);
  if (!c.ok) return c;
  if (!canPlace(state, type, i, j)) return fail(BUILDINGS[type].placeOn === 'coast' ? 'needCoast' : 'invalidPlace');
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
// Quadra com terra para construir (quadras só de água/praia/rua não são vendidas).
export function chunkHasLand(state, ci, cj) {
  let g = 0;
  for (let j = cj * MAP.chunk; j < (cj + 1) * MAP.chunk; j++)
    for (let i = ci * MAP.chunk; i < (ci + 1) * MAP.chunk; i++) { const t = tileOf(state, i, j); if (t && t.kind === 'grass') g++; }
  return g >= 3;
}
export function chunkBuyable(state, ci, cj) {
  if (chunkUnlocked(state, ci, cj)) return false;
  const n = state.size / MAP.chunk;
  if (ci < 0 || cj < 0 || ci >= n || cj >= n) return false;
  if (!chunkHasLand(state, ci, cj)) return false;
  return chunkUnlocked(state, ci - 1, cj) || chunkUnlocked(state, ci + 1, cj) ||
         chunkUnlocked(state, ci, cj - 1) || chunkUnlocked(state, ci, cj + 1);
}
export function chunkPrice(state) {
  return Math.round(CHUNK_PRICE.base * Math.pow(1 + CHUNK_PRICE.step * state.chunksBought, CHUNK_PRICE.pow) / 10) * 10;
}
export function buyChunk(state, ci, cj) {
  if (!chunkHasLand(state, ci, cj)) return fail('noLand');
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
    // Equilibrado: cai o que o jogador tem menos (os dois são gastos juntos no
    // armazém). Empate → sorteio. Evita sequências longas só de um item.
    const h = have(state, 'hammer'), tp = have(state, 'tape');
    drop = h < tp ? 'hammer' : tp < h ? 'tape' : (rand() < 0.5 ? 'hammer' : 'tape');
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
  return Math.min(ORDERS.maxSlots, ORDERS.baseSlots + phaseOf(state));
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

// Escolhe o personagem do pedido: só quem pode pedir algo já produzível,
// preferindo quem ainda não está no quadro.
// Personagens da época atual da cidade (fazendeiro no vilarejo, chef só na cidade…).
export function eraClients(state) {
  const ph = phaseOf(state);
  return CLIENTS.filter(c => !c.era || (ph >= c.era[0] && ph <= c.era[1]));
}
function pickClient(state, pool, rand) {
  const era = eraClients(state);
  let able = era.filter(c => !c.likes.length || c.likes.some(k => pool.includes(k)));
  if (!able.length) able = era;
  const onBoard = new Set(state.orders.map(o => o.client));
  const fresh = able.filter(c => !onBoard.has(c.id));
  const list = fresh.length ? fresh : able;
  return list[Math.floor(rand() * list.length)];
}

function makeOrder(state, rand) {
  const pool = producibleItems(state);
  if (!pool.length) return null;
  const client = pickClient(state, pool, rand);
  const liked = client.likes.filter(k => pool.includes(k));
  const kinds = Math.min(pool.length, 1 + Math.floor(rand() * Math.min(3, 1 + state.level / 4)));
  const picked = [];
  let guard = 0;
  while (picked.length < kinds && guard++ < 50) {
    // 80% das vezes, um item que o personagem costuma pedir
    const from = liked.length && rand() < 0.8 ? liked : pool;
    const k = from[Math.floor(rand() * from.length)];
    if (!picked.includes(k)) picked.push(k);
  }
  const items = {};
  let value = 0;
  for (const k of picked) {
    const raw = ITEMS[k].kind === 'raw';
    const maxQ = Math.max(1, Math.round((raw ? 2 : 1) * (1 + state.level / 4) * client.size));
    const q = 1 + Math.floor(rand() * Math.min(maxQ, raw ? 6 : 4));
    items[k] = q;
    value += ITEMS[k].value * q;
  }
  return {
    id: state.nextOrderId++,
    client: client.id,
    line: Math.floor(rand() * client.lines.pt.length),
    items,
    coins: Math.round((value * 1.4 + 5) * client.coins),
    xp: Math.max(2, Math.round(value / 3 * client.xp)),
  };
}

// Personagem de um pedido (pedidos antigos sem `client` ganham um padrão estável).
export function clientOf(order) {
  return CLIENTS.find(c => c.id === order.client) || CLIENTS[order.id % CLIENTS.length];
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
    if (pop >= d.minPop && !o.incomeReadyAt) o.incomeReadyAt = now + secs(state, d.income.time) * 1000;
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
export const TIPS = ['tipCollect', 'tipPlant', 'tipPlank', 'tipRent', 'tipOrder', 'tipBuild', 'tipExpand', 'tipMissions'];
const TIP_DONE = {
  tipCollect: s => s.stats.lotCollected >= 1,
  tipPlant: s => s.stats.lotStarted >= 1,
  tipPlank: s => s.stats.factoryStarted >= 1,
  tipRent: s => s.stats.rentCollected >= 1,
  tipOrder: s => s.stats.ordersDone >= 1,
  tipBuild: s => s.stats.built >= 1,
  tipExpand: s => s.stats.chunksBought >= 1,
  tipMissions: s => !!s.stats.missionsOpened,
};
export function currentTip(state) {
  for (const k of TIPS) if (!TIP_DONE[k](state)) return k;
  return null;
}

// ---------------------------------------------------------------------------
// Missões (objetivo sempre visível depois dos primeiros passos)
// ---------------------------------------------------------------------------
// Cada missão conta um contador de `stats` a partir de onde ele estava quando a
// missão começou. A ordem gira entre os tipos; metas e prêmios crescem com o nível.
export const MISSION_KINDS = [
  { k: 'rent', stat: 'rentCollected', n: L => 3 + Math.floor(L / 4) },
  { k: 'harvest', stat: 'lotCollected', n: L => 3 + Math.floor(L / 5) },
  { k: 'orders', stat: 'ordersDone', n: L => 2 + Math.floor(L / 6) },
  { k: 'products', stat: 'productsMade', n: L => 3 + Math.floor(L / 5) },
  { k: 'build', stat: 'built', n: L => 1 + Math.floor(L / 12) },
  { k: 'upgrade', stat: 'upgraded', n: () => 1, minLevel: 6 },
  { k: 'clear', stat: 'cleared', n: L => 1 + Math.floor(L / 10), minLevel: 3 },
  { k: 'expand', stat: 'chunksBought', n: () => 1, minLevel: 4 },
  { k: 'ships', stat: 'shipsArrived', n: L => 1 + Math.floor(L / 10), needs: 'port' },
];
export const MISSION_SLOTS = 3;

// Missão n da fila (pula tipos ainda não liberados e os que já estão nas outras vagas).
// Ainda dá para cumprir esse tipo de missão? (obstáculos e quadras acabam; casas chegam ao topo)
function feasible(state, k) {
  if (k === 'clear') return state.tiles.some(t => t.obstacle);
  if (k === 'expand') { const nc = state.size / MAP.chunk; for (let cj = 0; cj < nc; cj++) for (let ci = 0; ci < nc; ci++) if (chunkBuyable(state, ci, cj)) return true; return false; }
  if (k === 'upgrade') return state.objects.some(o => BUILDINGS[o.type].type === 'house' && BUILDINGS[o.type].next);
  return true;
}
function newMission(state, n, taken = []) {
  const L = state.level;
  const ok = (c) => (!c.minLevel || L >= c.minLevel) && (!c.needs || countOf(state, c.needs) > 0) && feasible(state, c.k);
  let kind = null;
  for (let k = 0; k < MISSION_KINDS.length && !kind; k++) {
    const c = MISSION_KINDS[(n + k) % MISSION_KINDS.length];
    if (ok(c) && !taken.includes(c.k)) kind = c;
  }
  if (!kind) kind = MISSION_KINDS[0];
  const era = eraClients(state);
  return { n, k: kind.k, base: state.stats[kind.stat] || 0, target: kind.n(L), client: era[(n * 7 + 3) % era.length].id };
}
function ensureMissions(state) {
  if (!Array.isArray(state.missions)) {
    // save antigo: a missão única vira a primeira das 3
    const first = state.mission && MISSION_KINDS.some(c => c.k === state.mission.k) ? state.mission : newMission(state, (state.mission && state.mission.n) || 0);
    state.missions = [first];
    delete state.mission;
  }
  // tira as que não existem mais ou ficaram impossíveis (e ainda não foram cumpridas)
  const keep = state.missions.filter(m => MISSION_KINDS.some(c => c.k === m.k) && (feasible(state, m.k) || computeMission(state, m).done));
  if (keep.length !== state.missions.length) state.missions = keep;
  // tarefa pedida por alguém da época atual (no quadro de pedidos)
  const era = eraClients(state), ids = new Set(era.map(c => c.id));
  for (const m of state.missions) if (!ids.has(m.client)) m.client = era[(m.n * 7 + 3) % era.length].id;
  let n = Math.max(-1, ...state.missions.map(m => m.n));
  while (state.missions.length < MISSION_SLOTS) state.missions.push(newMission(state, ++n, state.missions.map(m => m.k)));
  return state.missions;
}
function computeMission(state, m) {
  const kind = MISSION_KINDS.find(c => c.k === m.k);
  const progress = Math.max(0, Math.min(m.target, (state.stats[kind.stat] || 0) - m.base));
  const L = state.level;
  return { ...m, progress, done: progress >= m.target, reward: { coins: Math.round((25 + L * 10) * (1 + m.target / 4)), xp: 4 + L * 2 } };
}
// As 3 missões ativas, com progresso e prêmio.
export function missionsList(state) { return ensureMissions(state).map(m => computeMission(state, m)); }
// A missão em destaque (barra de dica): a pronta, senão a mais adiantada, senão a mais antiga.
export function mission(state) {
  const list = missionsList(state);
  return list.slice().sort((a, b) => (b.done - a.done) || (b.progress / b.target - a.progress / a.target) || (a.n - b.n))[0];
}
export function claimMission(state, idx) {
  const list = missionsList(state);
  let i = idx == null || idx === '' ? list.findIndex(m => m.done) : Number(idx);
  if (i < 0) i = 0;
  const m = list[i];
  if (!m || !m.done) return fail('notReady');
  state.coins += m.reward.coins;
  const lv = addXP(state, m.reward.xp);
  bump(state, 'missionsDone');
  const n = Math.max(...state.missions.map(x => x.n)) + 1;
  state.missions.splice(i, 1, newMission(state, n, state.missions.filter((_, k) => k !== i).map(x => x.k)));
  return ok({ coins: m.reward.coins, xp: m.reward.xp, ...lv });
}

// ---------------------------------------------------------------------------
// Metas da fase: o que a cidade precisa para merecer a próxima fase. Completar
// todas dá um prêmio grande (uma vez por fase). Calculadas do estado.
// ---------------------------------------------------------------------------
const GOAL_VALUE = {
  level: (s) => s.level,
  pop: (s) => population(s),
  houses: (s) => s.objects.filter(o => BUILDINGS[o.type].type === 'house').length,
  chunks: (s) => s.chunksBought || 0,
  has: (s, g) => countOf(s, g.type),
  stat: (s, g) => s.stats[g.stat] || 0,
};
export function phaseGoals(state) {
  const ph = phaseOf(state), next = PHASES[ph + 1];
  const list = (next ? [{ k: 'level', n: next.minLevel - 1 }] : []).concat(PHASE_GOALS[ph] || []);
  const goals = list.map(g => {
    const v = GOAL_VALUE[g.k](state, g), target = g.n || 1;
    return { ...g, target, progress: Math.min(target, v), done: v >= target };
  });
  const claimed = !next && (state.goalsClaimed || []).includes(ph);   // a última fase dá o prêmio uma vez
  const base = levelReward((next || PHASES[ph]).minLevel);
  const reward = { coins: Math.round(base.coins * 1.5), items: base.items, xp: 20 + ph * 25 };
  return { phase: ph, next, goals, allDone: goals.every(g => g.done), claimed, reward };
}
// "Virar Vila!": com todas as metas prontas, a cidade passa de fase e ganha o prêmio.
export function claimPhaseGoals(state) {
  const pg = phaseGoals(state);
  if (pg.claimed) return fail('alreadyClaimed');
  if (!pg.allDone) return fail('notReady');
  (state.goalsClaimed || (state.goalsClaimed = [])).push(pg.phase);
  if (pg.next) { state.phase = pg.phase + 1; reassignOrders(state); }
  const got = grantReward(state, pg.reward);
  const lv = addXP(state, pg.reward.xp);              // o XP guardado sobe de nível na hora
  touch(state);
  return ok({ coins: got.coins, items: got.items, xp: pg.reward.xp, ...lv, phaseChanged: !!pg.next, phase: state.phase });
}

// ---------------------------------------------------------------------------
// Conquistas: medalhas Bronze, Prata e Ouro sobre o que o jogador já fez.
// ---------------------------------------------------------------------------
export const ACH_REWARD = [{ coins: 60, xp: 5 }, { coins: 300, xp: 20 }, { coins: 1200, xp: 60 }];
export function achievements(state) {
  const got = state.ach || {};
  return ACHIEVEMENTS.map(a => {
    const v = state.stats[a.stat] || 0, tier = got[a.id] || 0;        // medalhas já pegas
    const reached = a.tiers.filter(x => v >= x).length;                // medalhas conquistadas
    const next = tier < 3 ? a.tiers[tier] : a.tiers[2];
    return { ...a, value: v, tier, reached, claimable: reached > tier, next, progress: Math.min(v, next), reward: tier < 3 ? ACH_REWARD[tier] : null };
  });
}
export function claimAchievement(state, id) {
  const a = achievements(state).find(x => x.id === id);
  if (!a) return fail('invalid');
  if (!a.claimable) return fail('notReady');
  (state.ach || (state.ach = {}))[id] = a.tier + 1;
  state.coins += a.reward.coins;
  const lv = addXP(state, a.reward.xp);
  return ok({ coins: a.reward.coins, xp: a.reward.xp, tier: a.tier + 1, ...lv });
}

// Quantos prêmios esperam no painel 🏆 (metas da fase e conquistas).
export function pendingRewards(state) {
  const pg = phaseGoals(state);
  return (pg.allDone && !pg.claimed ? 1 : 0) + achievements(state).filter(a => a.claimable).length;   // tarefas contam no quadro de pedidos
}

// ---------------------------------------------------------------------------
// Alternativas em moedas aos anúncios premiados (regra dos portais: sempre deve
// haver outro caminho além do anúncio) e intervalo entre ofertas de anúncio.
// ---------------------------------------------------------------------------
function remainingMs(o, now) {
  const def = BUILDINGS[o.type];
  if (def.type === 'lot' && o.resource && o.readyAt > now) return o.readyAt - now;
  if (def.type === 'factory') { const p = factoryPending(o, now); return p.length ? Math.min(...p.map(q => q.readyAt)) - now : 0; }
  return 0;
}
// Só produção (lote/fábrica) pode ser acelerada com moedas: ~1 moeda a cada 6 s.
export function speedUpCost(state, o, now) {
  const ms = remainingMs(o, now);
  return ms > 0 ? Math.max(3, Math.ceil(ms / 6000)) : 0;
}
export function speedUpCoins(state, o, now) {
  const cost = speedUpCost(state, o, now);
  if (!cost) return fail('notBusy');
  const f = payOrFail(state, { coins: cost });
  if (f) return f;
  const r = speedUp(state, o, now);
  if (!r.ok) { state.coins += cost; return r; }
  return ok({ spent: cost });
}
export const extraChestCost = (state) => 40 + state.level * 15;
export function claimDailyExtraCoins(state, now, rand = Math.random) {
  const st = dailyStatus(state, now);
  if (!st.extraAvailable) return fail(st.claimedToday ? 'alreadyClaimed' : 'claimFirst');
  const f = payOrFail(state, { coins: extraChestCost(state) });
  if (f) return f;
  return claimDailyExtra(state, now, rand);
}
export const rerollCost = (state) => 15 + state.level * 3;
export function rerollOrderCoins(state, id, rand = Math.random) {
  const f = payOrFail(state, { coins: rerollCost(state) });
  if (f) return f;
  const r = rerollOrder(state, id, rand);
  if (!r.ok) state.coins += rerollCost(state);
  return r;
}
// Oferta de anúncio "dobrar" no máximo a cada 4 minutos.
export const AD_GAP = { double: 4 * 60 * 1000 };
export function adOffer(state, kind, now) { return now >= ((state.adNext || {})[kind] || 0); }
export function adUsed(state, kind, now) { state.adNext = { ...(state.adNext || {}), [kind]: now + (AD_GAP[kind] || 0) }; }

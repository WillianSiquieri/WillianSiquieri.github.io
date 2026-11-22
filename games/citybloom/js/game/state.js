// state.js — estado do jogo, mapa inicial, consultas e salvar/carregar.
// Tudo que tem tempo usa horários absolutos (ms) — assim a produção continua
// com o jogo fechado sem precisar "simular" nada ao voltar.

import { BUILDINGS, MAP, START, WAREHOUSE, secs, phaseIndex } from './config.js';
import { layout, OLD_OFFSET } from './roads.js';

const SAVE_KEY = 'citybloom.save.v2';
export const VERSION = 4;   // 3: mapa 36×36 (o 18×18 antigo virou o miolo) · 4: mais rotatórias

// PRNG determinístico (mulberry32).
export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cria um objeto do mapa com os campos de timer adequados ao tipo.
export function makeObject(state, type, i, j, now, extra = {}) {
  const def = BUILDINGS[type];
  const o = { id: state.nextId++, type, i, j, size: def.size };
  if (def.type === 'house') o.rentReadyAt = now + secs(state, def.rentTime) * 1000;
  if (def.type === 'factory') o.queue = [];
  if (def.type === 'commerce') o.incomeReadyAt = null; // começa quando houver população
  if (def.type === 'lot') { o.resource = null; o.readyAt = null; }
  return Object.assign(o, extra); // `extra` pode sobrescrever (ex.: casa já pronta)
}

// Quadras iniciais (no centro do mapa).
function startChunk(i, j) {
  const C = MAP.chunk, [c0, c1] = MAP.startChunks;
  const ci = Math.floor(i / C), cj = Math.floor(j / C);
  return ci >= c0 && ci <= c1 && cj >= c0 && cj <= c1;
}

// Tiles do mapa: tipo pelo traçado fixo; obstáculos só na grama bloqueada.
function makeTiles(n, lockedAt, rand) {
  const { kind, bridge, ra } = layout(n);
  const tiles = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    const t = { kind: kind[k], locked: lockedAt(i, j) };
    if (bridge.has(k)) t.bridge = true;
    if (ra.has(k)) t.ra = ra.get(k);
    if (t.locked && t.kind === 'grass' && rand() < 0.16) {
      const r = rand();
      t.obstacle = r < 0.45 ? 'bush' : r < 0.85 ? 'rubble' : 'car';
    }
    tiles.push(t);
  }
  return tiles;
}

// Save v2 (mapa 18×18) → v3: o mapa antigo vira o miolo do novo, sem perder nada.
export function migrate(s) {
  if (!s) return s;
  if (s.v === 2 && s.size === 18) {
    const n = MAP.size, O = OLD_OFFSET, old = s.tiles;
    const inOld = (i, j) => i >= O && j >= O && i < O + 18 && j < O + 18;
    const tiles = makeTiles(n, (i, j) => !inOld(i, j) || old[(j - O) * 18 + i - O].locked, rng(20261115));
    for (let j = 0; j < 18; j++) for (let i = 0; i < 18; i++) {
      const a = old[j * 18 + i], b = tiles[(j + O) * n + i + O];
      b.locked = a.locked;
      if (a.obstacle) b.obstacle = a.obstacle; else delete b.obstacle;
    }
    for (const o of s.objects) { o.i += O; o.j += O; }
    s.tiles = tiles; s.size = n; s.v = 4; s.rev = (s.rev || 0) + 1;   // tiles já no traçado atual
    return s;
  }
  if (s.v === 3 && s.size === MAP.size) return relayout(s);
  return s;
}

// v3 → v4: aplica o traçado novo (mais ruas e rotatórias) mantendo terra comprada e
// obstáculos; o que estiver em tile que virou rua vai para o tile livre mais perto
// (ou volta em moedas, se não houver lugar).
function relayout(s) {
  const n = s.size, { kind, bridge, ra } = layout(n);
  for (let k = 0; k < n * n; k++) {
    const t = s.tiles[k];
    if (t.kind !== kind[k]) { t.kind = kind[k]; if (t.kind !== 'grass') delete t.obstacle; }
    if (bridge.has(k)) t.bridge = true; else delete t.bridge;
    if (ra.has(k)) t.ra = ra.get(k); else delete t.ra;
  }
  const occ = new Set();
  for (const o of s.objects) for (let dj = 0; dj < o.size; dj++) for (let di = 0; di < o.size; di++) occ.add((o.j + dj) * n + o.i + di);
  const fits = (o, i, j) => {
    for (let dj = 0; dj < o.size; dj++) for (let di = 0; di < o.size; di++) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n) return false;
      const t = s.tiles[b * n + a], k = b * n + a;
      if (t.locked || t.kind !== 'grass' || t.obstacle || occ.has(k)) return false;
    }
    return true;
  };
  const keep = [];
  for (const o of s.objects) {
    for (let dj = 0; dj < o.size; dj++) for (let di = 0; di < o.size; di++) occ.delete((o.j + dj) * n + o.i + di);   // tira a própria ocupação para testar
    if (fits(o, o.i, o.j)) {
      for (let dj = 0; dj < o.size; dj++) for (let di = 0; di < o.size; di++) occ.add((o.j + dj) * n + o.i + di);
      keep.push(o); continue;
    }
    let best = null, bd = Infinity;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (fits(o, i, j)) { const d = Math.hypot(i - o.i, j - o.j); if (d < bd) { bd = d; best = [i, j]; } }
    if (best) { o.i = best[0]; o.j = best[1]; for (let dj = 0; dj < o.size; dj++) for (let di = 0; di < o.size; di++) occ.add((o.j + dj) * n + o.i + di); keep.push(o); }
    else {                                     // sem lugar: devolve o custo inteiro (moedas e materiais)
      const b = BUILDINGS[o.type], cost = (b && b.build) || {};
      for (const [k, v] of Object.entries(cost)) { if (k === 'coins') s.coins = (s.coins || 0) + v; else s.inventory[k] = (s.inventory[k] || 0) + v; }
      s.refunded = (s.refunded || 0) + 1;
    }
  }
  s.objects = keep; s.v = 4; s.rev = (s.rev || 0) + 1;
  return s;
}

// ---------------------------------------------------------------------------
// Novo jogo
// ---------------------------------------------------------------------------
export function newGame(now = Date.now()) {
  const n = MAP.size;
  const tiles = makeTiles(n, (i, j) => !startChunk(i, j), rng(20261115));
  const state = {
    v: VERSION, phase: 0,
    coins: START.coins, level: START.level, xp: START.xp,
    inventory: { ...START.inventory },
    capacity: WAREHOUSE.base, warehouseLevel: 0,
    size: n, tiles,
    objects: [], nextId: 1, rev: 0,
    orders: [], nextOrderId: 1,
    chunksBought: 0,
    stats: {},
    daily: { next: 0, last: null, extra: null },   // baú diário (7 dias)
    mentor: { intro: false },                      // apresentação do prefeito
    seed: 777,
    lastSeen: now,
  };

  const O = OLD_OFFSET;   // posições do mapa antigo, agora no miolo
  const add = (type, i, j, extra) => state.objects.push(makeObject(state, type, i + O, j + O, now, extra));
  add('townhall', 7, 6);
  add('warehouse', 10, 6);
  add('sawmill', 10, 7);
  add('lot', 6, 10, { resource: 'wood', readyAt: now + 3000, total: 3000 });   // primeira colheita rápida
  add('lot', 7, 10);
  add('house1', 9, 10, { rentReadyAt: now + 8000 });            // aluguel logo no tutorial
  add('house1', 10, 10, { rentReadyAt: now + 14000 });
  add('tree', 6, 6);
  add('tree', 11, 11);

  // primeiro pedido feito para o tutorial: dá para entregar com a madeira colhida
  state.orders.push({ id: state.nextOrderId++, client: 'neighbor', line: 0, items: { wood: 2 }, coins: 30, xp: 8 });

  const tile = (i, j) => tiles[(j + O) * n + i + O];
  tile(6, 8).obstacle = 'bush';
  tile(11, 8).obstacle = 'rubble';
  tile(8, 11).obstacle = 'car';

  return state;
}

// ---------------------------------------------------------------------------
// Vitrine (?showcase=1): todas as construções lado a lado. Não é salva.
// ---------------------------------------------------------------------------
export function showcaseGame(now = Date.now()) {
  const rows = [
    ['house1', 'house2', 'house3', 'house4', 'house5', 'house6', 'house7'],
    ['sawmill', 'kiln', 'glassworks', 'carpentry', 'steelworks', 'warehouse'],
    ['bakery', 'market', 'clothes', 'mall', 'school', 'clinic'],
    ['firehouse', 'hospital', 'townhall', 'tree', 'plaza', 'fountain'],
    ['lot:wood', 'lot:sand', 'lot:clay', 'lot:iron', 'stadium', 'airport'],
  ];
  const STEP = 4;
  const n = 7 * STEP + 2;
  const tiles = [];
  for (let k = 0; k < n * n; k++) tiles.push({ kind: 'grass', locked: false });
  for (let i = 0; i < n; i++) tiles[(n - 3) * n + i].kind = 'road';
  for (let j = 0; j < n; j++) tiles[j * n + (n - 3)].kind = 'road';
  const state = {
    v: VERSION, coins: 0, level: 50, xp: 0, inventory: {}, capacity: 50, warehouseLevel: 0,
    size: n, tiles, objects: [], nextId: 1, rev: 0, orders: [], nextOrderId: 1,
    chunksBought: 0, stats: {}, seed: 1, lastSeen: now, showcase: true,
  };
  const progress = { wood: 1, sand: 0.5, clay: 0.2, iron: 1 };
  rows.forEach((row, r) => row.forEach((key, c) => {
    const [type, resource] = key.split(':');
    const extra = resource ? { resource, readyAt: now + (1 - progress[resource]) * 60000 * 5 } : {};
    state.objects.push(makeObject(state, type, 1 + c * STEP, 1 + r * STEP, now, extra));
  }));
  return state;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export function tileOf(state, i, j) {
  if (i < 0 || j < 0 || i >= state.size || j >= state.size) return null;
  return state.tiles[j * state.size + i];
}

// Grade de ocupação (id do objeto por tile), recalculada só quando state.rev muda.
const occCache = new WeakMap();
export function occupancy(state) {
  const c = occCache.get(state);
  if (c && c.rev === state.rev && c.count === state.objects.length) return c.grid;
  const grid = new Array(state.size * state.size).fill(null);
  for (const o of state.objects) {
    for (let dj = 0; dj < o.size; dj++) for (let di = 0; di < o.size; di++) {
      const i = o.i + di, j = o.j + dj;
      if (i < state.size && j < state.size) grid[j * state.size + i] = o;
    }
  }
  occCache.set(state, { rev: state.rev, count: state.objects.length, grid });
  return grid;
}

export function objectAt(state, i, j) {
  if (i < 0 || j < 0 || i >= state.size || j >= state.size) return null;
  return occupancy(state)[j * state.size + i];
}

export function countOf(state, type) {
  let k = 0;
  for (const o of state.objects) if (o.type === type) k++;
  return k;
}

export function population(state) {
  let p = 0;
  for (const o of state.objects) { const d = BUILDINGS[o.type]; if (d.residents) p += d.residents; }
  return p;
}

export function happiness(state) {
  let h = 0;
  for (const o of state.objects) { const d = BUILDINGS[o.type]; if (d.happiness) h += d.happiness; }
  return h;
}

// ---------------------------------------------------------------------------
// Salvar / carregar
// ---------------------------------------------------------------------------
// Onde o progresso fica: localStorage ou o Data module do portal (mesma API:
// getItem/setItem/removeItem), escolhido no boot com setStorage().
let store = null;
export function setStorage(s) { store = s; }
const st = () => store || localStorage;

// Primeira vez com o save da conta: traz o progresso local, se a conta estiver vazia.
export function migrateLocalSave(target) {
  try {
    if (target.getItem(SAVE_KEY)) return;
    const local = localStorage.getItem(SAVE_KEY);
    if (local) target.setItem(SAVE_KEY, local);
  } catch (_) {}
}

export function save(state) {
  if (state.showcase) return;
  state.lastSeen = Date.now();
  try { st().setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
}

export function load() {
  try {
    const raw = st().getItem(SAVE_KEY);
    if (!raw) return null;
    const s = migrate(JSON.parse(raw));
    if (!s || s.v !== VERSION || !Array.isArray(s.tiles) || !Array.isArray(s.objects)) return null;
    s.rev = (s.rev || 0) + 1;
    if (!s.daily) s.daily = { next: 0, last: null, extra: null };
    if (!s.mentor) s.mentor = { intro: true };
    if (s.phase == null) {                  // save de antes das metas de fase: fica na fase do nível
      s.phase = phaseIndex(s.level || 1);
      s.goalsClaimed = [...new Set([...(s.goalsClaimed || []), ...Array.from({ length: s.phase }, (_, k) => k)])];
    }
    return s;
  } catch (_) { return null; }
}

export function resetSave() {
  try {
    st().removeItem(SAVE_KEY);
    localStorage.removeItem('citybloom.save.v1'); // save antigo da fundação
  } catch (_) {}
}

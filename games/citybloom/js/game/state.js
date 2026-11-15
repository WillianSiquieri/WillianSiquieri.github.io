// state.js — estado do jogo, geração do mapa inicial, salvar/carregar em
// localStorage e marca de tempo para progresso offline (timers continuam com o
// jogo fechado — usado pela economia na próxima etapa).

import { BUILDINGS, MAP, START, OBSTACLES } from './config.js';

const SAVE_KEY = 'citybloom.save.v1';
const VERSION = 1;

// PRNG determinístico (mulberry32) para o mapa ser sempre igual.
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 1;
function obj(type, i, j, extra = {}) {
  return { id: nextId++, type, i, j, size: BUILDINGS[type].size, ...extra };
}

// ---------------------------------------------------------------------------
// Novo jogo
// ---------------------------------------------------------------------------
export function newGame() {
  const n = MAP.size;
  const a0 = Math.floor((n - MAP.startArea) / 2), a1 = a0 + MAP.startArea - 1; // 5..10
  const roadJ = a0 + 3;
  const rand = rng(1234);

  const tiles = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const inStart = i >= a0 && i <= a1 && j >= a0 && j <= a1;
      const t = { kind: j === roadJ ? 'road' : 'grass', locked: !inStart };
      if (!inStart && t.kind === 'grass' && rand() < 0.16) {
        const r = rand();
        t.obstacle = r < 0.45 ? 'bush' : r < 0.85 ? 'rubble' : 'car';
      }
      tiles.push(t);
    }
  }

  const objects = [
    obj('townhall', a0 + 1, a0 + 1),
    obj('warehouse', a0 + 4, a0 + 1),
    obj('house1', a0, roadJ + 1),
    obj('house1', a0 + 1, roadJ + 1),
    obj('lot', a0 + 3, roadJ + 1, { resource: 'wood', startedAt: Date.now() }),
    obj('lot', a0 + 4, roadJ + 1),
    obj('sawmill', a0 + 5, roadJ + 1),
    obj('tree', a0, a0),
    obj('tree', a1, a1),
  ];

  // Obstáculos dentro da área inicial (para limpar no começo).
  const tile = (i, j) => tiles[j * n + i];
  tile(a0 + 3, a0).obstacle = 'bush';
  tile(a1, a0).obstacle = 'car';
  tile(a0 + 3, a1).obstacle = 'rubble';

  return {
    v: VERSION,
    coins: START.coins, level: START.level, xp: START.xp,
    inventory: { wood: 4, plank: 2 },
    size: n,
    tiles,
    objects,
    lastSeen: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Vitrine (?showcase=1): todos os prédios do catálogo lado a lado, para
// validar o visual. Não é salva.
// ---------------------------------------------------------------------------
export function showcaseGame() {
  const rows = [
    ['house1', 'house2', 'house3', 'house4', 'house5', 'house6', 'house7'],
    ['sawmill', 'kiln', 'glassworks', 'carpentry', 'steelworks', 'warehouse'],
    ['bakery', 'market', 'clothes', 'mall', 'school', 'clinic'],
    ['firehouse', 'hospital', 'townhall', 'tree', 'plaza', 'fountain'],
    ['lot:wood', 'lot:sand', 'lot:clay', 'lot:iron', 'stadium', 'airport'],
  ];
  const STEP = 4;
  const n = 7 * STEP + 1;
  const tiles = [];
  for (let k = 0; k < n * n; k++) tiles.push({ kind: 'grass', locked: false });
  const objects = [];
  rows.forEach((row, r) => {
    row.forEach((key, c) => {
      const [type, resource] = key.split(':');
      const extra = resource ? { resource, startedAt: Date.now() - 1e9 } : {};
      objects.push(obj(type, 1 + c * STEP, 1 + r * STEP, extra));
    });
  });
  // rua de exemplo
  for (let i = 0; i < n; i++) tiles[(n - 2) * n + i].kind = 'road';
  return { v: VERSION, coins: 0, level: 50, xp: 0, inventory: {}, size: n, tiles, objects, lastSeen: Date.now(), showcase: true };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export function tileOf(state, i, j) {
  if (i < 0 || j < 0 || i >= state.size || j >= state.size) return null;
  return state.tiles[j * state.size + i];
}

export function objectAt(state, i, j) {
  for (const o of state.objects) {
    if (i >= o.i && i < o.i + o.size && j >= o.j && j < o.j + o.size) return o;
  }
  return null;
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

// Preço de um lote bloqueado: cresce com a distância do centro.
export function lotPrice(state, i, j) {
  const c = (state.size - 1) / 2;
  const dist = Math.max(Math.abs(i - c), Math.abs(j - c));
  return Math.round(50 * Math.ceil(2 * (1 + dist / 3)));
}

export function obstacleInfo(type) { return OBSTACLES[type]; }

// ---------------------------------------------------------------------------
// Salvar / carregar
// ---------------------------------------------------------------------------
export function save(state) {
  if (state.showcase) return;
  state.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== VERSION || !Array.isArray(s.tiles)) return null;
    nextId = Math.max(nextId, ...s.objects.map(o => o.id + 1));
    return s;
  } catch (_) { return null; }
}

export function resetSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}

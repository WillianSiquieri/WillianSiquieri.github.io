// config.js — catálogo do CityBloom (dados puros, sem lógica).
// Mesma mecânica dos jogos de fazendinha, com temática de cidade:
//   lote de produção (≈ plantação) → fábrica (≈ padaria) → casas (≈ animais)
//   → pedidos (≈ caminhão) → moedas/XP → comprar lotes e evoluir.
//
// Nomes em { pt, en }. Tempos em segundos. `look` define o desenho isométrico
// gerado por código (sem imagens): cores das paredes/telhado, altura, tipo de
// telhado e detalhes extras.

// ---------------------------------------------------------------------------
// Itens (matérias-primas e produtos)
// ---------------------------------------------------------------------------
export const ITEMS = {
  // matérias-primas (produzidas em lotes)
  wood:      { icon: '🪵', name: { pt: 'Madeira',  en: 'Wood' },      kind: 'raw' },
  sand:      { icon: '🏖️', name: { pt: 'Areia',    en: 'Sand' },      kind: 'raw' },
  clay:      { icon: '🟤', name: { pt: 'Barro',    en: 'Clay' },      kind: 'raw' },
  iron:      { icon: '⛏️', name: { pt: 'Ferro',    en: 'Iron ore' },  kind: 'raw' },
  // produtos (feitos nas fábricas)
  plank:     { icon: '🪚', name: { pt: 'Tábua',    en: 'Plank' },     kind: 'product' },
  brick:     { icon: '🧱', name: { pt: 'Tijolo',   en: 'Brick' },     kind: 'product' },
  glass:     { icon: '🪟', name: { pt: 'Vidro',    en: 'Glass' },     kind: 'product' },
  steel:     { icon: '🔩', name: { pt: 'Aço',      en: 'Steel' },     kind: 'product' },
  furniture: { icon: '🛋️', name: { pt: 'Móveis',   en: 'Furniture' }, kind: 'product' },
  bread:     { icon: '🍞', name: { pt: 'Pão',      en: 'Bread' },     kind: 'product' },
  // materiais especiais (recompensa rara; usados para ampliar o armazém)
  hammer:    { icon: '🔨', name: { pt: 'Martelo',  en: 'Hammer' },    kind: 'special' },
  tape:      { icon: '📐', name: { pt: 'Trena',    en: 'Tape' },      kind: 'special' },
};

// ---------------------------------------------------------------------------
// Lotes de produção (≈ plantações): escolhe o recurso, espera, coleta.
// ---------------------------------------------------------------------------
export const RESOURCE_LOTS = {
  wood: { time: 60,  cost: 5,  yield: 2, xp: 1, unlock: 1 },
  clay: { time: 300, cost: 15, yield: 2, xp: 2, unlock: 6 },
  sand: { time: 180, cost: 10, yield: 2, xp: 2, unlock: 11 },
  iron: { time: 600, cost: 30, yield: 2, xp: 4, unlock: 21 },
};

// ---------------------------------------------------------------------------
// Construções. type: 'house' | 'factory' | 'commerce' | 'service' | 'decor'
//                    | 'special' | 'monument' | 'lot'
// size: lado do quadrado ocupado no grid (1 = 1×1, 2 = 2×2).
// ---------------------------------------------------------------------------
export const BUILDINGS = {
  // ---- Especiais ----
  townhall: {
    type: 'special', size: 2, unlock: 1,
    name: { pt: 'Prefeitura', en: 'Town Hall' },
    desc: { pt: 'Coração da cidade. Recebe os pedidos.', en: 'Heart of the city. Takes the orders.' },
    look: { walls: '#f1ece2', roof: '#3d6fb6', h: 40, roof_: 'pyramid', floors: 2, extra: 'flag' },
  },
  warehouse: {
    type: 'special', size: 1, unlock: 1, capacity: 50,
    name: { pt: 'Armazém', en: 'Warehouse' },
    desc: { pt: 'Guarda seus materiais. Amplie para caber mais.', en: 'Stores your goods. Upgrade for more space.' },
    look: { walls: '#b98b5e', roof: '#7a4b2a', h: 26, roof_: 'pyramid', extra: 'door' },
  },
  lot: {
    type: 'lot', size: 1, unlock: 1, cost: 20,
    name: { pt: 'Lote de produção', en: 'Production lot' },
    desc: { pt: 'Produza madeira, areia, barro ou ferro.', en: 'Produce wood, sand, clay or iron.' },
    look: { ground: '#9c7a52' },
  },

  // ---- Casas (≈ animais): geram aluguel + moradores. Evoluem no lugar. ----
  house1: {
    type: 'house', size: 1, unlock: 1, tier: 1, next: 'house2',
    name: { pt: 'Casinha de madeira', en: 'Wooden cottage' },
    residents: 2, rent: 5, rentTime: 120,
    build: { coins: 30, plank: 3 },
    look: { walls: '#c8935a', roof: '#b5462f', h: 16, roof_: 'pyramid', floors: 1 },
  },
  house2: {
    type: 'house', size: 1, unlock: 6, tier: 2, next: 'house3',
    name: { pt: 'Casa de alvenaria', en: 'Brick house' },
    residents: 4, rent: 12, rentTime: 240,
    build: { coins: 80, brick: 4, plank: 2 },
    look: { walls: '#eadbc5', roof: '#c0392b', h: 20, roof_: 'pyramid', floors: 1 },
  },
  house3: {
    type: 'house', size: 1, unlock: 11, tier: 3, next: 'house4',
    name: { pt: 'Sobrado', en: 'Townhouse' },
    residents: 6, rent: 25, rentTime: 480,
    build: { coins: 180, brick: 6, glass: 3 },
    look: { walls: '#f3e4b5', roof: '#8e4a2f', h: 32, roof_: 'pyramid', floors: 2 },
  },
  house4: {
    type: 'house', size: 1, unlock: 15, tier: 4, next: 'house5',
    name: { pt: 'Casa com piscina', en: 'House with pool' },
    residents: 8, rent: 45, rentTime: 900,
    build: { coins: 350, glass: 5, furniture: 2 },
    look: { walls: '#ffffff', roof: '#2f6f8e', h: 24, roof_: 'flat', floors: 1, extra: 'pool' },
  },
  house5: {
    type: 'house', size: 1, unlock: 21, tier: 5, next: 'house6',
    name: { pt: 'Prédio pequeno', en: 'Small apartment' },
    residents: 16, rent: 90, rentTime: 1800,
    build: { coins: 700, steel: 4, glass: 6, brick: 8 },
    look: { walls: '#d9dfe7', roof: '#9aa5b1', h: 54, roof_: 'flat', floors: 4 },
  },
  house6: {
    type: 'house', size: 1, unlock: 28, tier: 6, next: 'house7',
    name: { pt: 'Edifício', en: 'Apartment tower' },
    residents: 30, rent: 180, rentTime: 3600,
    build: { coins: 1500, steel: 8, furniture: 4 },
    look: { walls: '#bccadb', roof: '#7d8a99', h: 86, roof_: 'flat', floors: 7 },
  },
  house7: {
    type: 'house', size: 1, unlock: 36, tier: 7, next: null,
    name: { pt: 'Arranha-céu', en: 'Skyscraper' },
    residents: 60, rent: 400, rentTime: 7200,
    build: { coins: 4000, steel: 16, glass: 14 },
    look: { walls: '#8fb6dd', roof: '#5b7fa6', h: 140, roof_: 'flat', floors: 12, extra: 'antenna' },
  },

  // ---- Fábricas (≈ padaria/laticínio): transformam itens ----
  sawmill: {
    type: 'factory', size: 1, unlock: 1,
    name: { pt: 'Serraria', en: 'Sawmill' },
    build: { coins: 50 },
    recipes: [{ out: 'plank', in: { wood: 2 }, time: 90, xp: 2 }],
    look: { walls: '#a0592d', roof: '#6b3a1e', h: 22, roof_: 'pyramid', extra: 'logs' },
  },
  kiln: {
    type: 'factory', size: 1, unlock: 6,
    name: { pt: 'Olaria', en: 'Brick kiln' },
    build: { coins: 120, plank: 4 },
    recipes: [{ out: 'brick', in: { clay: 2 }, time: 180, xp: 3 }],
    look: { walls: '#b5651d', roof: '#7c3f12', h: 22, roof_: 'flat', extra: 'chimney' },
  },
  glassworks: {
    type: 'factory', size: 1, unlock: 11,
    name: { pt: 'Vidraçaria', en: 'Glassworks' },
    build: { coins: 250, brick: 6 },
    recipes: [{ out: 'glass', in: { sand: 2 }, time: 240, xp: 4 }],
    look: { walls: '#8fcfd3', roof: '#4a8f94', h: 24, roof_: 'flat', extra: 'chimney' },
  },
  carpentry: {
    type: 'factory', size: 1, unlock: 14,
    name: { pt: 'Marcenaria', en: 'Carpentry' },
    build: { coins: 300, brick: 6, plank: 6 },
    recipes: [{ out: 'furniture', in: { plank: 2, glass: 1 }, time: 600, xp: 8 }],
    look: { walls: '#c49a6c', roof: '#8a5a2b', h: 22, roof_: 'pyramid' },
  },
  steelworks: {
    type: 'factory', size: 1, unlock: 21,
    name: { pt: 'Metalúrgica', en: 'Steel mill' },
    build: { coins: 800, brick: 10, glass: 4 },
    recipes: [{ out: 'steel', in: { iron: 2 }, time: 480, xp: 7 }],
    look: { walls: '#6b7280', roof: '#4b5260', h: 30, roof_: 'flat', extra: 'chimney2' },
  },

  // ---- Comércio: vende produtos aos moradores (exige população) ----
  bakery: {
    type: 'commerce', size: 1, unlock: 6, minPop: 10,
    name: { pt: 'Padaria', en: 'Bakery' },
    build: { coins: 150, brick: 4 },
    recipes: [{ out: 'bread', in: { wood: 1 }, time: 120, xp: 2 }],
    look: { walls: '#f6c48a', roof: '#d35400', h: 18, roof_: 'flat', extra: 'awning' },
  },
  market: {
    type: 'commerce', size: 1, unlock: 12, minPop: 30,
    name: { pt: 'Mercado', en: 'Market' },
    build: { coins: 400, brick: 8, glass: 4 },
    look: { walls: '#7bc67b', roof: '#3f8f3f', h: 20, roof_: 'flat', extra: 'awning' },
  },
  clothes: {
    type: 'commerce', size: 1, unlock: 17, minPop: 60,
    name: { pt: 'Loja de roupas', en: 'Clothing store' },
    build: { coins: 600, glass: 6, furniture: 2 },
    look: { walls: '#ec9fc2', roof: '#b04a7c', h: 20, roof_: 'flat', extra: 'awning' },
  },
  mall: {
    type: 'commerce', size: 2, unlock: 25, minPop: 150,
    name: { pt: 'Shopping', en: 'Mall' },
    build: { coins: 2500, steel: 8, glass: 10 },
    look: { walls: '#cdb3ee', roof: '#8b6bb8', h: 36, roof_: 'flat', floors: 2, extra: 'awning' },
  },

  // ---- Serviços: aumentam felicidade e destravam evoluções ----
  school: {
    type: 'service', size: 1, unlock: 12, happiness: 10,
    name: { pt: 'Escola', en: 'School' },
    build: { coins: 500, brick: 10, glass: 4 },
    look: { walls: '#f3d250', roof: '#c0392b', h: 26, roof_: 'pyramid', floors: 2, extra: 'flag' },
  },
  clinic: {
    type: 'service', size: 1, unlock: 16, happiness: 10,
    name: { pt: 'Posto de saúde', en: 'Clinic' },
    build: { coins: 600, brick: 8, glass: 6 },
    look: { walls: '#ffffff', roof: '#d0d7df', h: 22, roof_: 'flat', extra: 'cross' },
  },
  firehouse: {
    type: 'service', size: 1, unlock: 22, happiness: 12,
    name: { pt: 'Bombeiros', en: 'Fire station' },
    build: { coins: 900, brick: 12, steel: 2 },
    look: { walls: '#e74c3c', roof: '#a93226', h: 26, roof_: 'flat', extra: 'door' },
  },
  hospital: {
    type: 'service', size: 2, unlock: 30, happiness: 25,
    name: { pt: 'Hospital', en: 'Hospital' },
    build: { coins: 3000, steel: 8, glass: 10, furniture: 4 },
    look: { walls: '#f7f9fb', roof: '#cfd8e3', h: 48, roof_: 'flat', floors: 4, extra: 'cross' },
  },

  // ---- Decoração: felicidade (bônus no aluguel) ----
  tree: {
    type: 'decor', size: 1, unlock: 1, happiness: 1,
    name: { pt: 'Árvore', en: 'Tree' }, build: { coins: 10 },
    look: { kind: 'tree' },
  },
  plaza: {
    type: 'decor', size: 1, unlock: 7, happiness: 4,
    name: { pt: 'Praça', en: 'Plaza' }, build: { coins: 80, brick: 2 },
    look: { kind: 'plaza' },
  },
  fountain: {
    type: 'decor', size: 1, unlock: 13, happiness: 8,
    name: { pt: 'Fonte', en: 'Fountain' }, build: { coins: 200, brick: 4, glass: 1 },
    look: { kind: 'fountain' },
  },

  // ---- Monumentos (endgame da Metrópole): projetos grandes ----
  stadium: {
    type: 'monument', size: 2, unlock: 36, happiness: 50,
    name: { pt: 'Estádio', en: 'Stadium' },
    build: { coins: 10000, steel: 30, brick: 40, glass: 20 },
    look: { walls: '#e5e7eb', roof: '#2ecc71', h: 30, roof_: 'flat', extra: 'stadium' },
  },
  airport: {
    type: 'monument', size: 2, unlock: 40, happiness: 60,
    name: { pt: 'Aeroporto', en: 'Airport' },
    build: { coins: 15000, steel: 40, glass: 30, furniture: 10 },
    look: { walls: '#dfe6ee', roof: '#5d6d7e', h: 34, roof_: 'flat', extra: 'antenna' },
  },
};

// ---------------------------------------------------------------------------
// Obstáculos (≈ pedras/árvores da fazenda): limpar custa moedas e dá XP.
// ---------------------------------------------------------------------------
export const OBSTACLES = {
  rubble: { name: { pt: 'Entulho', en: 'Rubble' },          clear: 15, xp: 2 },
  bush:   { name: { pt: 'Mato', en: 'Overgrowth' },         clear: 8,  xp: 1 },
  car:    { name: { pt: 'Carro abandonado', en: 'Abandoned car' }, clear: 25, xp: 3 },
};

// ---------------------------------------------------------------------------
// Fases da cidade (eras). Cada fase abre um bairro novo no mapa.
// ---------------------------------------------------------------------------
export const PHASES = [
  { id: 'village',  minLevel: 1,  icon: '🏡', name: { pt: 'Vilarejo',       en: 'Hamlet' } },
  { id: 'town',     minLevel: 6,  icon: '🏘️', name: { pt: 'Vila',           en: 'Village' } },
  { id: 'smallcity',minLevel: 11, icon: '🏙️', name: { pt: 'Cidade pequena', en: 'Small town' } },
  { id: 'city',     minLevel: 21, icon: '🌆', name: { pt: 'Cidade',         en: 'City' } },
  { id: 'metro',    minLevel: 36, icon: '🌃', name: { pt: 'Metrópole',      en: 'Metropolis' } },
];

export function phaseForLevel(level) {
  let p = PHASES[0];
  for (const ph of PHASES) if (level >= ph.minLevel) p = ph;
  return p;
}

// XP necessário para passar do nível `level` para o próximo.
export function xpToNext(level) {
  return Math.round(20 + 15 * Math.pow(level - 1, 1.4));
}

// ---------------------------------------------------------------------------
// Mapa e início de jogo
// ---------------------------------------------------------------------------
export const MAP = {
  size: 16,          // grade 16×16
  startArea: 6,      // área inicial liberada (6×6, no centro)
  lotPriceBase: 100, // preço de um lote bloqueado (cresce com a distância)
};

export const START = {
  coins: 200,
  level: 1,
  xp: 0,
};

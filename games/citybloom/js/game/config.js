// config.js — catálogo e números da economia do CityBloom (dados puros).
// Mesma mecânica dos jogos de fazendinha, com temática de cidade:
//   lote de produção (≈ plantação) → fábrica (≈ padaria) → casas (≈ animais)
//   → pedidos (≈ caminhão) → moedas/XP → comprar quadras e evoluir.
// Nomes em { pt, en }. Tempos em segundos. O visual de cada construção fica em
// js/render/buildings.js (desenhado por código).

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------
export const ITEMS = {
  wood:      { icon: '🪵', value: 3,  kind: 'raw',     name: { pt: 'Madeira', en: 'Wood' } },
  clay:      { icon: '🟤', value: 6,  kind: 'raw',     name: { pt: 'Barro', en: 'Clay' } },
  sand:      { icon: '🏖️', value: 5,  kind: 'raw',     name: { pt: 'Areia', en: 'Sand' } },
  iron:      { icon: '⛏️', value: 12, kind: 'raw',     name: { pt: 'Ferro', en: 'Iron ore' } },
  plank:     { icon: '🪚', value: 9,  kind: 'product', name: { pt: 'Tábua', en: 'Plank' } },
  brick:     { icon: '🧱', value: 16, kind: 'product', name: { pt: 'Tijolo', en: 'Brick' } },
  glass:     { icon: '🪟', value: 14, kind: 'product', name: { pt: 'Vidro', en: 'Glass' } },
  furniture: { icon: '🛋️', value: 45, kind: 'product', name: { pt: 'Móveis', en: 'Furniture' } },
  steel:     { icon: '🔩', value: 32, kind: 'product', name: { pt: 'Aço', en: 'Steel' } },
  // especiais: caem ao limpar obstáculos; ampliam o armazém; não ocupam espaço
  hammer:    { icon: '🔨', value: 0,  kind: 'special', name: { pt: 'Martelo', en: 'Hammer' } },
  tape:      { icon: '📐', value: 0,  kind: 'special', name: { pt: 'Trena', en: 'Tape' } },
};

// ---------------------------------------------------------------------------
// Lotes de produção (≈ plantações)
// ---------------------------------------------------------------------------
export const RESOURCE_LOTS = {
  wood: { time: 60,  cost: 5,  yield: 2, xp: 1, unlock: 1 },
  clay: { time: 300, cost: 15, yield: 2, xp: 2, unlock: 6 },
  sand: { time: 180, cost: 10, yield: 2, xp: 2, unlock: 11 },
  iron: { time: 600, cost: 30, yield: 2, xp: 4, unlock: 21 },
};

// ---------------------------------------------------------------------------
// Construções
//   type: house | factory | commerce | service | decor | special | monument | lot
//   size: lado ocupado (1 = 1×1, 2 = 2×2) · unlock: nível · max: limite na cidade
//   build: custo (moedas + itens) · cat: aba do menu de construção
// ---------------------------------------------------------------------------
export const BUILDINGS = {
  // ---- Especiais (já vêm no mapa) ----
  townhall: {
    type: 'special', size: 2, unlock: 1, max: 1, buildable: false,
    name: { pt: 'Prefeitura', en: 'Town Hall' },
    desc: { pt: 'Coração da cidade. Aqui ficam os pedidos.', en: 'Heart of the city. Orders are here.' },
  },
  warehouse: {
    type: 'special', size: 1, unlock: 1, max: 1, buildable: false,
    name: { pt: 'Armazém', en: 'Warehouse' },
    desc: { pt: 'Guarda seus materiais.', en: 'Stores your goods.' },
  },

  // ---- Produção ----
  lot: {
    type: 'lot', cat: 'production', size: 1, unlock: 1, build: { coins: 20 },
    name: { pt: 'Lote de produção', en: 'Production lot' },
    desc: { pt: 'Produz madeira, barro, areia ou ferro.', en: 'Produces wood, clay, sand or iron.' },
  },
  sawmill: {
    type: 'factory', cat: 'production', size: 1, unlock: 1, max: 1, queue: 2,
    build: { coins: 60 },
    name: { pt: 'Serraria', en: 'Sawmill' },
    recipes: [{ out: 'plank', in: { wood: 2 }, time: 90, xp: 2 }],
  },
  kiln: {
    type: 'factory', cat: 'production', size: 1, unlock: 6, max: 1, queue: 2,
    build: { coins: 150, plank: 4 },
    name: { pt: 'Olaria', en: 'Brick kiln' },
    recipes: [{ out: 'brick', in: { clay: 2 }, time: 180, xp: 3 }],
  },
  glassworks: {
    type: 'factory', cat: 'production', size: 1, unlock: 11, max: 1, queue: 2,
    build: { coins: 300, brick: 6 },
    name: { pt: 'Vidraçaria', en: 'Glassworks' },
    recipes: [{ out: 'glass', in: { sand: 2 }, time: 240, xp: 4 }],
  },
  carpentry: {
    type: 'factory', cat: 'production', size: 1, unlock: 14, max: 1, queue: 2,
    build: { coins: 400, brick: 6, plank: 6 },
    name: { pt: 'Marcenaria', en: 'Carpentry' },
    recipes: [{ out: 'furniture', in: { plank: 2, glass: 1 }, time: 600, xp: 8 }],
  },
  steelworks: {
    type: 'factory', cat: 'production', size: 1, unlock: 21, max: 1, queue: 2,
    build: { coins: 900, brick: 10, glass: 4 },
    name: { pt: 'Metalúrgica', en: 'Steel mill' },
    recipes: [{ out: 'steel', in: { iron: 2 }, time: 480, xp: 7 }],
  },

  // ---- Casas (≈ animais): aluguel + moradores; evoluem no lugar ----
  house1: {
    type: 'house', cat: 'houses', size: 1, unlock: 1, tier: 1, next: 'house2',
    residents: 2, rent: 5, rentTime: 120, build: { coins: 40, plank: 3 },
    name: { pt: 'Casinha de madeira', en: 'Wooden cottage' },
  },
  house2: {
    type: 'house', cat: 'houses', size: 1, unlock: 6, tier: 2, next: 'house3',
    residents: 4, rent: 12, rentTime: 240, build: { coins: 90, brick: 4, plank: 2 },
    name: { pt: 'Casa de alvenaria', en: 'Brick house' },
  },
  house3: {
    type: 'house', cat: 'houses', size: 1, unlock: 11, tier: 3, next: 'house4',
    residents: 6, rent: 25, rentTime: 480, build: { coins: 200, brick: 6, glass: 3 },
    name: { pt: 'Sobrado', en: 'Townhouse' },
  },
  house4: {
    type: 'house', cat: 'houses', size: 1, unlock: 15, tier: 4, next: 'house5',
    residents: 8, rent: 45, rentTime: 900, build: { coins: 380, glass: 5, furniture: 2 },
    name: { pt: 'Casa com piscina', en: 'House with pool' },
  },
  house5: {
    type: 'house', cat: 'houses', size: 1, unlock: 21, tier: 5, next: 'house6',
    residents: 16, rent: 90, rentTime: 1800, build: { coins: 750, steel: 4, glass: 6, brick: 8 },
    name: { pt: 'Prédio pequeno', en: 'Small apartment' },
  },
  house6: {
    type: 'house', cat: 'houses', size: 1, unlock: 28, tier: 6, next: 'house7',
    residents: 30, rent: 180, rentTime: 3600, build: { coins: 1600, steel: 8, furniture: 4 },
    name: { pt: 'Edifício', en: 'Apartment tower' },
  },
  house7: {
    type: 'house', cat: 'houses', size: 1, unlock: 36, tier: 7, next: null,
    residents: 60, rent: 400, rentTime: 7200, build: { coins: 4200, steel: 16, glass: 14 },
    name: { pt: 'Arranha-céu', en: 'Skyscraper' },
  },

  // ---- Comércio: renda em moedas (exige população mínima) ----
  bakery: {
    type: 'commerce', cat: 'commerce', size: 1, unlock: 6, max: 2, minPop: 8,
    income: { coins: 20, time: 300 }, build: { coins: 160, brick: 4 },
    name: { pt: 'Padaria', en: 'Bakery' },
  },
  market: {
    type: 'commerce', cat: 'commerce', size: 1, unlock: 12, max: 2, minPop: 25,
    income: { coins: 45, time: 600 }, build: { coins: 420, brick: 8, glass: 4 },
    name: { pt: 'Mercado', en: 'Market' },
  },
  clothes: {
    type: 'commerce', cat: 'commerce', size: 1, unlock: 17, max: 2, minPop: 50,
    income: { coins: 80, time: 900 }, build: { coins: 650, glass: 6, furniture: 2 },
    name: { pt: 'Loja de roupas', en: 'Clothing store' },
  },
  mall: {
    type: 'commerce', cat: 'commerce', size: 2, unlock: 25, max: 1, minPop: 120,
    income: { coins: 250, time: 1800 }, build: { coins: 2600, steel: 8, glass: 10 },
    name: { pt: 'Shopping', en: 'Mall' },
  },

  // ---- Serviços: felicidade ----
  school: {
    type: 'service', cat: 'services', size: 1, unlock: 12, max: 1, happiness: 10,
    build: { coins: 500, brick: 10, glass: 4 },
    name: { pt: 'Escola', en: 'School' },
  },
  clinic: {
    type: 'service', cat: 'services', size: 1, unlock: 16, max: 1, happiness: 10,
    build: { coins: 600, brick: 8, glass: 6 },
    name: { pt: 'Posto de saúde', en: 'Clinic' },
  },
  firehouse: {
    type: 'service', cat: 'services', size: 1, unlock: 22, max: 1, happiness: 12,
    build: { coins: 900, brick: 12, steel: 2 },
    name: { pt: 'Bombeiros', en: 'Fire station' },
  },
  hospital: {
    type: 'service', cat: 'services', size: 2, unlock: 30, max: 1, happiness: 25,
    build: { coins: 3000, steel: 8, glass: 10, furniture: 4 },
    name: { pt: 'Hospital', en: 'Hospital' },
  },

  // ---- Decoração: felicidade (bônus no aluguel) ----
  tree: {
    type: 'decor', cat: 'decor', size: 1, unlock: 1, happiness: 1, build: { coins: 10 },
    name: { pt: 'Árvore', en: 'Tree' },
  },
  plaza: {
    type: 'decor', cat: 'decor', size: 1, unlock: 7, happiness: 4, build: { coins: 80, brick: 2 },
    name: { pt: 'Praça', en: 'Plaza' },
  },
  fountain: {
    type: 'decor', cat: 'decor', size: 1, unlock: 13, happiness: 8, build: { coins: 220, brick: 4, glass: 1 },
    name: { pt: 'Fonte', en: 'Fountain' },
  },

  // ---- Monumentos (endgame da Metrópole) ----
  stadium: {
    type: 'monument', cat: 'services', size: 2, unlock: 36, max: 1, happiness: 50,
    build: { coins: 10000, steel: 30, brick: 40, glass: 20 },
    name: { pt: 'Estádio', en: 'Stadium' },
  },
  airport: {
    type: 'monument', cat: 'services', size: 2, unlock: 40, max: 1, happiness: 60,
    build: { coins: 15000, steel: 40, glass: 30, furniture: 10 },
    name: { pt: 'Aeroporto', en: 'Airport' },
  },
};

// Abas do menu de construção
export const BUILD_TABS = [
  { id: 'houses',     icon: '🏠', name: { pt: 'Casas', en: 'Houses' } },
  { id: 'production', icon: '🏭', name: { pt: 'Produção', en: 'Production' } },
  { id: 'commerce',   icon: '🛍️', name: { pt: 'Comércio', en: 'Shops' } },
  { id: 'services',   icon: '🏥', name: { pt: 'Serviços', en: 'Services' } },
  { id: 'decor',      icon: '🌳', name: { pt: 'Decoração', en: 'Decor' } },
];

// ---------------------------------------------------------------------------
// Obstáculos (≈ pedras/árvores da fazenda)
// ---------------------------------------------------------------------------
export const OBSTACLES = {
  bush:   { clear: 8,  xp: 1, name: { pt: 'Mato', en: 'Overgrowth' } },
  rubble: { clear: 15, xp: 2, name: { pt: 'Entulho', en: 'Rubble' } },
  car:    { clear: 25, xp: 3, name: { pt: 'Carro abandonado', en: 'Abandoned car' } },
};
export const SPECIAL_DROP_CHANCE = 0.35;

// ---------------------------------------------------------------------------
// Personagens que fazem os pedidos na Prefeitura
//   likes: itens que costuma pedir (vazio = qualquer um)
//   coins / xp / size: multiplicadores de recompensa e de tamanho do pedido
//   retrato: assets/characters/micah/<id>.svg (js/render/avatars.js)
// ---------------------------------------------------------------------------
export const CLIENTS = [
  {
    id: 'builder', name: { pt: 'Beto', en: 'Bob' }, role: { pt: 'Construtor', en: 'Builder' },
    likes: ['plank', 'brick', 'steel', 'wood'], coins: 1, xp: 1, size: 1.1,
    lines: {
      pt: ['Preciso disso pra obra de hoje!', 'A obra não pode parar!', 'Material bom, prédio forte!'],
      en: ['I need this for today’s job!', 'The site can’t stop!', 'Good materials, strong buildings!'],
    },
  },
  {
    id: 'shop', name: { pt: 'Dona Lúcia', en: 'Ms. Lucy' }, role: { pt: 'Lojista', en: 'Shopkeeper' },
    likes: ['furniture', 'glass', 'plank'], coins: 1.1, xp: 1, size: 1,
    lines: {
      pt: ['Vou reformar a vitrine da loja!', 'Meus clientes vão adorar!', 'Chegou mercadoria nova?'],
      en: ['I’m redoing my shop window!', 'My customers will love it!', 'Any new goods today?'],
    },
  },
  {
    id: 'business', name: { pt: 'Sr. Ricardo', en: 'Mr. Richard' }, role: { pt: 'Empresário', en: 'Businessman' },
    likes: [], coins: 1.3, xp: 1, size: 1.4,
    lines: {
      pt: ['Pago bem por entrega rápida.', 'Negócio fechado?', 'Tenho um grande projeto na cidade.'],
      en: ['I pay well for fast delivery.', 'Do we have a deal?', 'I have a big project in town.'],
    },
  },
  {
    id: 'teacher', name: { pt: 'Profa. Ana', en: 'Ms. Anna' }, role: { pt: 'Professora', en: 'Teacher' },
    likes: ['wood', 'plank', 'glass'], coins: 1, xp: 1.4, size: 0.9,
    lines: {
      pt: ['É para o projeto da escola!', 'As crianças vão construir maquetes!', 'Aprender construindo é o melhor.'],
      en: ['It’s for the school project!', 'The kids will build models!', 'Learning by building is the best.'],
    },
  },
  {
    id: 'chef', name: { pt: 'Chef Marco', en: 'Chef Mark' }, role: { pt: 'Cozinheiro', en: 'Chef' },
    likes: ['wood', 'brick', 'clay'], coins: 1.05, xp: 1.1, size: 1,
    lines: {
      pt: ['Lenha para o meu forno de pizza!', 'Vou abrir um restaurante novo!', 'Cozinha boa precisa de forno bom.'],
      en: ['Firewood for my pizza oven!', 'I’m opening a new restaurant!', 'A good kitchen needs a good oven.'],
    },
  },
  {
    id: 'architect', name: { pt: 'Júlia', en: 'Julia' }, role: { pt: 'Arquiteta', en: 'Architect' },
    likes: ['glass', 'steel', 'furniture', 'brick'], coins: 1.15, xp: 1.15, size: 1.1,
    lines: {
      pt: ['Meu novo projeto precisa disso.', 'Vidro e aço: o futuro da cidade!', 'Vai ficar lindo, prometo.'],
      en: ['My new design needs this.', 'Glass and steel: the city’s future!', 'It’ll look amazing, I promise.'],
    },
  },
  {
    id: 'neighbor', name: { pt: 'Seu Zé', en: 'Old Joe' }, role: { pt: 'Vizinho', en: 'Neighbor' },
    likes: ['wood', 'clay', 'sand'], coins: 1, xp: 1, size: 0.7,
    lines: {
      pt: ['Um pouquinho pra arrumar o quintal.', 'Ô vizinho, me ajuda aí?', 'Coisa pequena, pago na hora!'],
      en: ['Just a bit to fix my backyard.', 'Hey neighbor, can you help?', 'Small thing, I’ll pay right away!'],
    },
  },
  {
    id: 'firefighter', name: { pt: 'Rafa', en: 'Rae' }, role: { pt: 'Bombeira', en: 'Firefighter' },
    likes: ['steel', 'brick', 'glass'], coins: 1.1, xp: 1.2, size: 1,
    lines: {
      pt: ['Precisamos reforçar o quartel!', 'Segurança em primeiro lugar.', 'Rápido, é para uma emergência!'],
      en: ['We need to reinforce the station!', 'Safety first.', 'Quick, it’s for an emergency!'],
    },
  },
];

// ---------------------------------------------------------------------------
// Fases da cidade
// ---------------------------------------------------------------------------
export const PHASES = [
  { id: 'village',   minLevel: 1,  icon: '🏡', name: { pt: 'Vilarejo', en: 'Hamlet' } },
  { id: 'town',      minLevel: 6,  icon: '🏘️', name: { pt: 'Vila', en: 'Village' } },
  { id: 'smallcity', minLevel: 11, icon: '🏙️', name: { pt: 'Cidade pequena', en: 'Small town' } },
  { id: 'city',      minLevel: 21, icon: '🌆', name: { pt: 'Cidade', en: 'City' } },
  { id: 'metro',     minLevel: 36, icon: '🌃', name: { pt: 'Metrópole', en: 'Metropolis' } },
];

export function phaseIndex(level) {
  let k = 0;
  PHASES.forEach((p, idx) => { if (level >= p.minLevel) k = idx; });
  return k;
}
export function phaseForLevel(level) { return PHASES[phaseIndex(level)]; }

// XP para passar do nível `level` ao próximo.
export function xpToNext(level) {
  return Math.round(20 + 15 * Math.pow(level - 1, 1.4));
}

// ---------------------------------------------------------------------------
// Mapa, expansão, pedidos, armazém, felicidade
// ---------------------------------------------------------------------------
export const MAP = {
  size: 18,              // grade 18×18
  chunk: 3,              // quadras de 3×3 (unidade de compra)
  startChunks: [2, 3],   // quadras iniciais (2..3 × 2..3) = tiles 6..11
  roadRows: [9, 15],     // ruas horizontais (j fixo)
  roadCols: [3, 12],     // ruas verticais (i fixo)
};

export const CHUNK_PRICE = { base: 150, growth: 1.5 };

export const ORDERS = {
  baseSlots: 3,          // +1 por fase, até maxSlots
  maxSlots: 6,
  cooldown: 120,         // segundos para um pedido descartado voltar
};

export const WAREHOUSE = { base: 50, step: 25 };
export function warehouseUpgradeCost(level) {
  return { coins: 100 * (level + 1), hammer: level + 1, tape: level + 1 };
}

export const HAPPINESS = { divisor: 200, maxMult: 1.5 };

export const START = {
  coins: 250,
  level: 1,
  xp: 0,
  inventory: { wood: 2 },
};

// XP ganho ao construir algo com este custo.
export function buildXP(cost) {
  return 3 + Math.round((cost && cost.coins ? cost.coins : 0) / 12);
}

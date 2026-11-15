// i18n.js — textos em português e inglês. Detecta o idioma do aparelho
// (pt* → português, resto → inglês) e permite trocar manualmente (salvo).

const LANG_KEY = 'citybloom.lang.v1';

const STRINGS = {
  pt: {
    level: 'Nível', lang: 'EN', close: 'Fechar',
    build: 'Construir', orders: 'Pedidos', storage: 'Armazém',
    // chão
    grass: 'Terreno livre', grassDesc: 'Espaço livre para construir.', buildHere: '🔨 Construir aqui',
    road: 'Rua', roadDesc: 'Por aqui passam os carros da cidade.',
    lockedTitle: 'Quadra à venda', lockedDesc: 'Compre para expandir a cidade.',
    buyFor: 'Comprar por', notAdjacent: 'Compre primeiro uma quadra vizinha da cidade.',
    clear: 'Limpar', clearDesc: 'Limpe para liberar o espaço. Pode render 🔨 ou 📐!',
    // lote
    lotEmpty: 'Escolha o que produzir:', lotGrowing: 'Produzindo', lotReady: 'Pronto para coletar!',
    // genérico
    collect: 'Coletar', speedUp: 'Terminar agora', watchAd: '▶ Anúncio', produce: 'Produzir',
    queue: 'Fila', free: 'livre', done: 'pronto', timeLeft: 'falta',
    residents: 'moradores', rent: 'Aluguel', every: 'a cada', double: 'Coletar x2',
    upgrade: 'Evoluir para', maxTier: 'Nível máximo de casa!', unlocksAt: 'Libera no nível',
    income: 'Renda', needPop: 'Precisa de {n} moradores para abrir.',
    happiness: 'Felicidade', happyDesc: 'Deixa os moradores felizes: aluguel maior.',
    seeOrders: '📋 Ver pedidos', inventory: 'Estoque', upgradeStorage: 'Ampliar armazém',
    capacity: 'Capacidade', empty: 'Vazio por enquanto.',
    // pedidos
    ordersTitle: 'Pedidos da Prefeitura', deliver: 'Entregar', discard: 'Descartar',
    newOrderIn: 'Novo pedido em', newNow: '▶ Novo agora',
    // construir
    buildTitle: 'Construir', placeHint: 'Toque no mapa para escolher o lugar', confirm: 'Construir', cancel: 'Cancelar',
    owned: 'na cidade', limit: 'limite',
    // erros
    errNoCoins: 'Moedas insuficientes 🪙', errNoItems: 'Faltam: {need}', errStorageFull: 'Armazém cheio! Amplie no armazém 📦',
    errLocked: 'Libera no nível {level}', errQueueFull: 'Fila cheia — colete primeiro', errInvalidPlace: 'Não dá para construir aí',
    errMaxCount: 'Você já tem o máximo deste prédio', errNotAdjacent: 'Compre uma quadra vizinha primeiro', errGeneric: 'Não foi possível',
    // nível
    levelUp: 'Nível {n}!', newPhase: 'Nova fase: {p}', unlocked: 'Liberado:', nothingNew: 'Continue crescendo!', great: 'Oba!',
    welcome: 'Bem-vindo de volta! Você ficou fora {t}.',
    showcase: 'Vitrine de prédios',
    // níveis
    levelsTitle: 'Níveis da cidade', start: 'Início', toNext: 'para o próximo', total: 'total',
    // configurações e nome da cidade
    settings: 'Configurações', cityName: 'Nome da cidade', cityNameDefault: 'Minha Cidade', save: 'Salvar',
    nameTitle: 'Dê um nome à sua cidade', nameSub: 'Você pode trocar depois em ⚙️.', renameTitle: 'Renomear cidade',
    nameGo: 'Começar', nameEmpty: 'Digite um nome para a cidade', nameSaved: 'Nome salvo: {n}',
    music: 'Música', effects: 'Efeitos sonoros', on: 'Ligados', off: 'Desligados', language: 'Idioma',
    // dicas
    tipCollect: 'Toque no lote de madeira 🌲 para colher',
    tipPlant: 'Toque no lote vazio e produza madeira 🪵',
    tipPlank: 'Toque na Serraria e faça tábuas 🪚',
    tipRent: 'Toque numa casa para coletar o aluguel 🪙',
    tipOrder: 'Toque na Prefeitura e entregue um pedido 📋',
    tipBuild: 'Construa algo novo no botão 🔨',
    tipExpand: 'Compre uma quadra nova (placa 🏷️)',
  },
  en: {
    level: 'Level', lang: 'PT', close: 'Close',
    build: 'Build', orders: 'Orders', storage: 'Storage',
    grass: 'Free land', grassDesc: 'Free space to build.', buildHere: '🔨 Build here',
    road: 'Road', roadDesc: 'City traffic goes through here.',
    lockedTitle: 'Block for sale', lockedDesc: 'Buy it to expand your city.',
    buyFor: 'Buy for', notAdjacent: 'First buy a block next to your city.',
    clear: 'Clear', clearDesc: 'Clear it to free the space. May drop 🔨 or 📐!',
    lotEmpty: 'Choose what to produce:', lotGrowing: 'Producing', lotReady: 'Ready to collect!',
    collect: 'Collect', speedUp: 'Finish now', watchAd: '▶ Ad', produce: 'Produce',
    queue: 'Queue', free: 'free', done: 'done', timeLeft: 'left',
    residents: 'residents', rent: 'Rent', every: 'every', double: 'Collect x2',
    upgrade: 'Upgrade to', maxTier: 'Top house level!', unlocksAt: 'Unlocks at level',
    income: 'Income', needPop: 'Needs {n} residents to open.',
    happiness: 'Happiness', happyDesc: 'Keeps residents happy: higher rent.',
    seeOrders: '📋 See orders', inventory: 'Inventory', upgradeStorage: 'Expand storage',
    capacity: 'Capacity', empty: 'Empty for now.',
    ordersTitle: 'Town Hall orders', deliver: 'Deliver', discard: 'Discard',
    newOrderIn: 'New order in', newNow: '▶ New now',
    buildTitle: 'Build', placeHint: 'Tap the map to choose a spot', confirm: 'Build', cancel: 'Cancel',
    owned: 'in city', limit: 'limit',
    errNoCoins: 'Not enough coins 🪙', errNoItems: 'Missing: {need}', errStorageFull: 'Storage full! Expand it at the warehouse 📦',
    errLocked: 'Unlocks at level {level}', errQueueFull: 'Queue full — collect first', errInvalidPlace: "Can't build there",
    errMaxCount: 'You already have the max of this building', errNotAdjacent: 'Buy a neighboring block first', errGeneric: 'Not possible',
    levelUp: 'Level {n}!', newPhase: 'New stage: {p}', unlocked: 'Unlocked:', nothingNew: 'Keep growing!', great: 'Great!',
    welcome: 'Welcome back! You were away for {t}.',
    showcase: 'Building showcase',
    levelsTitle: 'City levels', start: 'Start', toNext: 'to next', total: 'total',
    settings: 'Settings', cityName: 'City name', cityNameDefault: 'My City', save: 'Save',
    nameTitle: 'Name your city', nameSub: 'You can change it later in ⚙️.', renameTitle: 'Rename city',
    nameGo: 'Start', nameEmpty: 'Type a name for your city', nameSaved: 'Name saved: {n}',
    music: 'Music', effects: 'Sound effects', on: 'On', off: 'Off', language: 'Language',
    tipCollect: 'Tap the wood lot 🌲 to harvest',
    tipPlant: 'Tap the empty lot and produce wood 🪵',
    tipPlank: 'Tap the Sawmill and make planks 🪚',
    tipRent: 'Tap a house to collect rent 🪙',
    tipOrder: 'Tap the Town Hall and deliver an order 📋',
    tipBuild: 'Build something new with the 🔨 button',
    tipExpand: 'Buy a new block (🏷️ sign)',
  },
};

function detect() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch (_) {}
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('pt') ? 'pt' : 'en';
}

let lang = detect();

export function getLang() { return lang; }
export function setLang(l) {
  lang = l === 'pt' ? 'pt' : 'en';
  try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
}
export function toggleLang() { setLang(lang === 'pt' ? 'en' : 'pt'); return lang; }

// t('key', {vars}) → texto; tn({pt, en}) → nome vindo do catálogo.
export function t(key, vars) {
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
export function tn(obj) { return obj ? (obj[lang] || obj.en || '') : ''; }

// 90 → "1m 30s", 3600 → "1h"
export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) { const m = Math.floor(sec / 60), s = sec % 60; return s ? `${m}m ${s}s` : `${m}m`; }
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

// 1234 → "1.234" (pt) / "1,234" (en)
export function fmtNum(n) { return Math.round(n).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US'); }

setLang(lang);

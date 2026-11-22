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
    water: 'Água', waterDesc: 'Mar e rio: bonito de ver, mas não dá para construir aqui.', beach: 'Praia', beachDesc: 'Areia da praia: lugar de passear, não de construir.',
    noLandTitle: 'Só água e areia', noLand: 'Esta quadra não tem terreno para construir, por isso não está à venda.',
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
    newOrderIn: 'Novo pedido em', newNow: 'Novo agora',
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
    rename: 'Renomear', center: 'Centralizar', settings: 'Configurações', cityName: 'Nome da cidade', cityNameDefault: 'Minha Cidade', save: 'Salvar',
    nameTitle: 'Dê um nome à sua cidade', nameSub: 'Você pode trocar depois em ⚙️.', renameTitle: 'Renomear cidade',
    nameGo: 'Começar', nameEmpty: 'Digite um nome para a cidade', nameSaved: 'Nome salvo: {n}',
    music: 'Música', effects: 'Efeitos sonoros', on: 'Ligados', off: 'Desligados', language: 'Idioma',
    credits: 'Créditos',
    creditMusic: 'Música "Bossa da Prefeitura": composição original para o CityBloom.',
    creditInstruments: 'Instrumentos: soundfont FluidR3_GM (Frank Wen), via midi-js-soundfonts (Benjamin Gleitzman)',
    creditCharacters: 'Personagens: estilo Micah, de Micah Lanier, gerado com DiceBear',
    creditModels: 'Modelos 3D: Kenney (kenney.nl), CC0. Motor: Three.js (MIT).',
    creditIcons: 'Ícones: Fluent Emoji da Microsoft (MIT). Fonte: Fredoka (OFL).',
    adUnavailable: 'Sem anúncio agora — dá para usar moedas 🪙',
    inventoryTitle: 'Estoque', seeInventory: 'Ver estoque completo',
    rawGroup: 'Matérias-primas', productGroup: 'Produtos', specialGroup: 'Ferramentas especiais',
    specialNote: 'Não ocupam espaço no armazém. Servem para ampliar o armazém.',
    fromLot: 'Lote de produção', fromFactory: 'Feito na', fromClear: 'Limpando terrenos e presentes',
    move: '✥ Mover', moveHint: 'Toque no mapa para escolher o novo lugar', moving: 'Mover', moved: 'Construção movida! ✥',
    // Prefeito Walt Parker (guia)
    mayorHello: 'Olá! Eu sou o <b>Prefeito Walt Parker</b>. Bem-vindo à nossa cidade! 🏙️',
    mayorAskName: 'Antes de tudo: como vai se chamar a nossa cidade?',
    mayorCount: 'Que nome lindo! Conto com a sua ajuda para fazer <b>{c}</b> prosperar e ajudar os nossos moradores. Vamos começar colhendo madeira 🌲!',
    mayorBack: 'Olá! Eu sou o <b>Prefeito Walt Parker</b>. A partir de agora vou acompanhar você em <b>{c}</b>: dicas, parabéns a cada nível e um presente por dia 🎁!',
    mayorLevel: 'Parabéns! <b>{c}</b> chegou ao nível {n}! Os moradores estão orgulhosos. 👏|Que trabalho incrível! Nível {n}! A cidade cresce a cada dia. 🌱|Nível {n}! Eu sabia que podia contar com você! 🎉|Mais um nível, {n}! Aqui está um presente da Prefeitura. 🎁',
    mayorPhase: 'Que dia histórico! Agora somos oficialmente uma <b>{p}</b>! Obrigado por tudo! 🎉',
    next: 'Continuar', letsGo: 'Vamos lá!', yourReward: 'Seu presente', collectGift: 'Coletar! 🎁',
    convertedNote: 'Armazém cheio: o que não coube virou {n} 🪙.',
    // baú diário
    dailyTitle: 'Baú diário', day: 'Dia', openChest: 'Abrir baú', youGot: 'Você recebeu:', extraChest: 'Baú extra',
    dailySayReady: 'Bom dia! O baú do <b>dia {d}</b> está esperando por você. Volte todo dia: o 7º é o maior!',
    dailySayBroken: 'Senti sua falta! A sequência recomeçou, mas o baú de hoje já está pronto. 😉',
    dailySayDone: 'Volte amanhã para abrir o baú do <b>dia {d}</b>! 🗓️',
    comeBack: 'Volte amanhã para o próximo baú!',
    // dicas
    tipCollect: 'Toque no lote de madeira 🌲 para colher',
    tipPlant: 'Toque no lote vazio e produza madeira 🪵',
    tipPlank: 'Toque na Serraria e faça tábuas 🪚',
    tipRent: 'Toque numa casa para coletar o aluguel 🪙',
    tipOrder: 'Toque na Prefeitura e entregue um pedido 📋',
    tipBuild: 'Construa algo novo no botão 🔨',
    tipExpand: 'Compre uma quadra nova (placa 🏷️)',
    tipMissions: 'Veja suas missões, metas e medalhas no 🏆',
    mayorHi: 'Olá! Sou o Prefeito Walt. Siga a mão para começar!',
    skip: 'Pular', missionTitle: 'Missão', claim: 'Pegar',
    mission_rent: 'Colete aluguel {n} vezes', mission_harvest: 'Colha {n} lotes', mission_orders: 'Entregue {n} pedidos',
    mission_products: 'Fabrique {n} produtos', mission_build: 'Construa {n} coisa(s) nova(s)', mission_upgrade: 'Melhore {n} casa',
    missionDone: 'Missão cumprida!',
    missionsTitle: 'Missões', tabMissions: 'Missões', tabGoals: 'Metas da fase', tabAch: 'Conquistas',
    missionsHint: 'Sempre há 3 missões. Pegue o prêmio e uma nova aparece.', inProgress: 'Em andamento',
    goalsTo: 'Metas para virar {p}', goalsLast: 'Metas da Metrópole', goalsHint: 'complete tudo para ganhar o prêmio da fase',
    goalsPrize: 'Prêmio da fase', claimed: 'Recebido', goalsDone: 'Metas da fase cumpridas! 🎉', achDone: 'Medalha conquistada! 🏅', achMax: '🥇 Ouro conquistado!',
    goal_pop: '{n} moradores', goal_houses: '{n} casas', goal_chunks: 'Comprar {n} quadra(s)', goal_has: 'Ter: {b}', goal_hasN: 'Ter {n}× {b}',
    goal_lotCollected: 'Colher {n} lotes', goal_ordersDone: 'Entregar {n} pedidos', goal_productsMade: 'Fabricar {n} produtos', goal_shipsArrived: 'Receber {n} navios no porto',
    mission_clear: 'Limpe {n} terreno(s)', mission_expand: 'Compre {n} quadra nova', mission_ships: 'Receba {n} navio(s) no porto',
    ach_farmer: 'Agricultor', ach_farmer_d: 'Colha {n} lotes', ach_maker: 'Industrial', ach_maker_d: 'Fabrique {n} produtos',
    ach_courier: 'Entregador', ach_courier_d: 'Entregue {n} pedidos', ach_landlord: 'Proprietário', ach_landlord_d: 'Colete aluguel {n} vezes',
    ach_builder: 'Mestre de obras', ach_builder_d: 'Construa {n} vezes', ach_explorer: 'Desbravador', ach_explorer_d: 'Compre {n} quadras',
    ach_cleaner: 'Faxineiro', ach_cleaner_d: 'Limpe {n} terrenos', ach_achiever: 'Dedicado', ach_achiever_d: 'Complete {n} missões',
    ach_captain: 'Capitão', ach_captain_d: 'Receba {n} navios', ach_loyal: 'Fiel', ach_loyal_d: 'Abra o baú diário {n} vezes',
    portDesc: 'Navios chegam trazendo moedas e carga. Construa na praia, com parte na água.', shipArrived: 'Navio chegou!',
  },
  en: {
    level: 'Level', lang: 'PT', close: 'Close',
    build: 'Build', orders: 'Orders', storage: 'Storage',
    grass: 'Free land', grassDesc: 'Free space to build.', buildHere: '🔨 Build here',
    road: 'Road', roadDesc: 'City traffic goes through here.',
    water: 'Water', waterDesc: 'Sea and river: lovely to look at, but you can’t build here.', beach: 'Beach', beachDesc: 'Beach sand: a place to stroll, not to build.',
    noLandTitle: 'Only water and sand', noLand: 'This block has no land to build on, so it isn’t for sale.',
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
    newOrderIn: 'New order in', newNow: 'New now',
    buildTitle: 'Build', placeHint: 'Tap the map to choose a spot', confirm: 'Build', cancel: 'Cancel',
    owned: 'in city', limit: 'limit',
    errNoCoins: 'Not enough coins 🪙', errNoItems: 'Missing: {need}', errStorageFull: 'Storage full! Expand it at the warehouse 📦',
    errLocked: 'Unlocks at level {level}', errQueueFull: 'Queue full — collect first', errInvalidPlace: "Can't build there",
    errMaxCount: 'You already have the max of this building', errNotAdjacent: 'Buy a neighboring block first', errGeneric: 'Not possible',
    levelUp: 'Level {n}!', newPhase: 'New stage: {p}', unlocked: 'Unlocked:', nothingNew: 'Keep growing!', great: 'Great!',
    welcome: 'Welcome back! You were away for {t}.',
    showcase: 'Building showcase',
    levelsTitle: 'City levels', start: 'Start', toNext: 'to next', total: 'total',
    rename: 'Rename', center: 'Center', settings: 'Settings', cityName: 'City name', cityNameDefault: 'My City', save: 'Save',
    nameTitle: 'Name your city', nameSub: 'You can change it later in ⚙️.', renameTitle: 'Rename city',
    nameGo: 'Start', nameEmpty: 'Type a name for your city', nameSaved: 'Name saved: {n}',
    music: 'Music', effects: 'Sound effects', on: 'On', off: 'Off', language: 'Language',
    credits: 'Credits',
    creditMusic: 'Music "Town Hall Bossa": original composition for CityBloom.',
    creditInstruments: 'Instruments: FluidR3_GM soundfont (Frank Wen), via midi-js-soundfonts (Benjamin Gleitzman)',
    creditCharacters: 'Characters: Micah style by Micah Lanier, generated with DiceBear',
    creditModels: '3D models: Kenney (kenney.nl), CC0. Engine: Three.js (MIT).',
    creditIcons: 'Icons: Microsoft Fluent Emoji (MIT). Font: Fredoka (OFL).',
    adUnavailable: 'No ad right now — you can use coins 🪙',
    inventoryTitle: 'Inventory', seeInventory: 'See full inventory',
    rawGroup: 'Raw materials', productGroup: 'Products', specialGroup: 'Special tools',
    specialNote: 'They take no storage space. Used to expand the storage.',
    fromLot: 'Production lot', fromFactory: 'Made at the', fromClear: 'Clearing land and gifts',
    move: '✥ Move', moveHint: 'Tap the map to choose the new spot', moving: 'Move', moved: 'Building moved! ✥',
    mayorHello: 'Hello! I am <b>Mayor Walt Parker</b>. Welcome to our town! 🏙️',
    mayorAskName: 'First things first: what shall we call our city?',
    mayorCount: 'What a lovely name! I count on your help to make <b>{c}</b> thrive and to help our residents. Let\'s start by harvesting some wood 🌲!',
    mayorBack: 'Hello! I am <b>Mayor Walt Parker</b>. From now on I will be with you in <b>{c}</b>: tips, congratulations on every level and a gift every day 🎁!',
    mayorLevel: 'Congratulations! <b>{c}</b> reached level {n}! The residents are proud. 👏|Amazing work! Level {n}! The city grows every day. 🌱|Level {n}! I knew I could count on you! 🎉|Another level, {n}! Here is a gift from the Town Hall. 🎁',
    mayorPhase: 'What a historic day! We are now officially a <b>{p}</b>! Thank you for everything! 🎉',
    next: 'Continue', letsGo: "Let's go!", yourReward: 'Your gift', collectGift: 'Collect! 🎁',
    convertedNote: 'Storage full: what did not fit became {n} 🪙.',
    dailyTitle: 'Daily chest', day: 'Day', openChest: 'Open chest', youGot: 'You got:', extraChest: 'Extra chest',
    dailySayReady: 'Good morning! The <b>day {d}</b> chest is waiting for you. Come back every day: the 7th is the biggest!',
    dailySayBroken: 'I missed you! The streak restarted, but today\'s chest is ready. 😉',
    dailySayDone: 'Come back tomorrow to open the <b>day {d}</b> chest! 🗓️',
    comeBack: 'Come back tomorrow for the next chest!',
    tipCollect: 'Tap the wood lot 🌲 to harvest',
    tipPlant: 'Tap the empty lot and produce wood 🪵',
    tipPlank: 'Tap the Sawmill and make planks 🪚',
    tipRent: 'Tap a house to collect rent 🪙',
    tipOrder: 'Tap the Town Hall and deliver an order 📋',
    tipBuild: 'Build something new with the 🔨 button',
    tipExpand: 'Buy a new block (🏷️ sign)',
    tipMissions: 'See your missions, goals and medals in 🏆',
    mayorHi: "Hi! I'm Mayor Walt. Follow the hand to get started!",
    skip: 'Skip', missionTitle: 'Mission', claim: 'Collect',
    mission_rent: 'Collect rent {n} times', mission_harvest: 'Harvest {n} lots', mission_orders: 'Deliver {n} orders',
    mission_products: 'Make {n} products', mission_build: 'Build {n} new thing(s)', mission_upgrade: 'Upgrade {n} house',
    missionDone: 'Mission complete!',
    missionsTitle: 'Missions', tabMissions: 'Missions', tabGoals: 'Stage goals', tabAch: 'Achievements',
    missionsHint: 'There are always 3 missions. Collect the reward and a new one appears.', inProgress: 'In progress',
    goalsTo: 'Goals to become a {p}', goalsLast: 'Metropolis goals', goalsHint: 'complete them all to win the stage prize',
    goalsPrize: 'Stage prize', claimed: 'Collected', goalsDone: 'Stage goals complete! 🎉', achDone: 'Medal earned! 🏅', achMax: '🥇 Gold earned!',
    goal_pop: '{n} residents', goal_houses: '{n} houses', goal_chunks: 'Buy {n} block(s)', goal_has: 'Have: {b}', goal_hasN: 'Have {n}× {b}',
    goal_lotCollected: 'Harvest {n} lots', goal_ordersDone: 'Deliver {n} orders', goal_productsMade: 'Make {n} products', goal_shipsArrived: 'Receive {n} ships at the harbor',
    mission_clear: 'Clear {n} plot(s)', mission_expand: 'Buy {n} new block', mission_ships: 'Receive {n} ship(s) at the harbor',
    ach_farmer: 'Farmer', ach_farmer_d: 'Harvest {n} lots', ach_maker: 'Industrialist', ach_maker_d: 'Make {n} products',
    ach_courier: 'Courier', ach_courier_d: 'Deliver {n} orders', ach_landlord: 'Landlord', ach_landlord_d: 'Collect rent {n} times',
    ach_builder: 'Master builder', ach_builder_d: 'Build {n} times', ach_explorer: 'Pioneer', ach_explorer_d: 'Buy {n} blocks',
    ach_cleaner: 'Tidy town', ach_cleaner_d: 'Clear {n} plots', ach_achiever: 'Go-getter', ach_achiever_d: 'Complete {n} missions',
    ach_captain: 'Captain', ach_captain_d: 'Receive {n} ships', ach_loyal: 'Loyal mayor', ach_loyal_d: 'Open the daily chest {n} times',
    portDesc: 'Ships arrive with coins and cargo. Build it on the beach, partly over the water.', shipArrived: 'A ship arrived!',
  },
};

function saved() {
  try { const v = localStorage.getItem(LANG_KEY); return v === 'pt' || v === 'en' ? v : null; } catch (_) { return null; }
}
function detect() {
  const v = saved();
  if (v) return v;
  // inglês é o padrão; português só pela escolha do jogador ou pelo idioma do portal (applyPortalLocale)
  return 'en';
}

// Idioma informado pelo portal (ex.: 'pt-BR'), usado só se o jogador não escolheu.
export function applyPortalLocale(locale) {
  if (!locale || saved()) return false;
  const l = String(locale).toLowerCase().startsWith('pt') ? 'pt' : 'en';
  if (l === lang) return false;
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
  return true;
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

if (typeof document !== 'undefined') document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';   // não grava: só a escolha do jogador é salva

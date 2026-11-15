// i18n.js — textos em português e inglês. Detecta o idioma do aparelho
// (pt* → português, resto → inglês) e permite trocar manualmente (salvo).

const LANG_KEY = 'citybloom.lang.v1';

const STRINGS = {
  pt: {
    level: 'Nível',
    population: 'População',
    coins: 'Moedas',
    happiness: 'Felicidade',
    grass: 'Terreno livre',
    grassDesc: 'Aqui você poderá construir em breve.',
    locked: 'Lote à venda',
    lockedDesc: 'Compre para expandir a cidade.',
    buyFor: 'Comprar por',
    road: 'Rua',
    roadDesc: 'Liga os bairros da cidade.',
    clearFor: 'Limpar por',
    residents: 'moradores',
    rent: 'aluguel',
    every: 'a cada',
    producing: 'Produz',
    unlocksAt: 'Libera no nível',
    emptyLot: 'Lote vazio — escolha o que produzir.',
    comingSoon: 'Em construção: ações chegam na próxima versão.',
    close: 'Fechar',
    showcase: 'Vitrine de prédios (modo de design)',
    lang: 'EN',
  },
  en: {
    level: 'Level',
    population: 'Population',
    coins: 'Coins',
    happiness: 'Happiness',
    grass: 'Free land',
    grassDesc: 'You will be able to build here soon.',
    locked: 'Lot for sale',
    lockedDesc: 'Buy it to expand your city.',
    buyFor: 'Buy for',
    road: 'Road',
    roadDesc: 'Connects your neighborhoods.',
    clearFor: 'Clear for',
    residents: 'residents',
    rent: 'rent',
    every: 'every',
    producing: 'Produces',
    unlocksAt: 'Unlocks at level',
    emptyLot: 'Empty lot — choose what to produce.',
    comingSoon: 'Under construction: actions arrive in the next version.',
    close: 'Close',
    showcase: 'Building showcase (design mode)',
    lang: 'PT',
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

// t('key') → texto da interface; tn({pt, en}) → nome vindo do catálogo.
export function t(key) { return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key; }
export function tn(obj) { return obj ? (obj[lang] || obj.en || '') : ''; }

// Formata segundos: 90 → "1m 30s", 3600 → "1h".
export function fmtTime(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) { const m = Math.floor(sec / 60), s = sec % 60; return s ? `${m}m ${s}s` : `${m}m`; }
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

setLang(lang);

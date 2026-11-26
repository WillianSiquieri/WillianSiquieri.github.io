// Pronúncia para o TTS.
//
// A voz é pt-BR e lê palavra estrangeira com fonética portuguesa: "Hyperliquid"
// e "Hashdex" saem irreconhecíveis, e ticker como "AMAR3" é lido como se fosse
// uma palavra. Aqui o texto é reescrito FONETICAMENTE só para o áudio.
//
// Regra de ouro: isto nunca pode vazar para a tela. As legendas vêm dos cues do
// TTS, que são do texto reescrito — por isso `aplicar` devolve um mapa e
// `restaurarCues` recoloca as palavras originais nas legendas, mantendo o tempo.
import { log, warn } from '../util.js';

// Nomes próprios e jargão em inglês. Só o que de fato soa errado: termo que a
// voz pt-BR já lê aceitavelmente (Bitcoin, Nvidia, Microsoft) fica de fora, para
// não trocar um problema por outro.
export const PRONUNCIA_BASE = {
  // cripto
  hyperliquid: 'Ráiperlícuid',
  hashdex: 'Réshdeks',
  ethereum: 'Etíriam',
  blockchain: 'blókcheine',
  stablecoin: 'stêibolcoim',
  stablecoins: 'stêibolcoins',
  memecoin: 'mímecoim',
  memecoins: 'mímecoins',
  altcoin: 'ôltcoim',
  altcoins: 'ôltcoins',
  staking: 'stêiquin',
  airdrop: 'érdrope',
  coinbase: 'Cóinbeis',
  tether: 'Téder',
  dogecoin: 'Dójicoim',
  ripple: 'Rípou',
  solana: 'Solâna',
  halving: 'rálvin',
  // mercado
  nasdaq: 'Nézdeque',
  etf: 'Ê Tê Éfe',
  etfs: 'Ê Tê Éfes',
  // No mercado brasileiro IPO é lido em INGLÊS, não soletrado em português.
  ipo: 'áipiou',
  ipos: 'áipious',
  ceo: 'Cê Ê Ó',
  payroll: 'pêirról',
  hedge: 'rédje',
  default: 'defôut',
  commodity: 'comóditi',
  commodities: 'comóditis',
  // tecnologia
  software: 'sófituer',
  hardware: 'rárduer',
  cloud: 'cláud',
  chatgpt: 'Chat Gê Pê Tê',
};

// Nome das letras em português, para soletrar ticker.
const LETRA = {
  a: 'á', b: 'bê', c: 'cê', d: 'dê', e: 'é', f: 'éfe', g: 'gê', h: 'agá',
  i: 'i', j: 'jota', k: 'cá', l: 'éle', m: 'ême', n: 'êne', o: 'ó', p: 'pê',
  q: 'quê', r: 'érre', s: 'ésse', t: 'tê', u: 'u', v: 'vê', w: 'dáblio',
  x: 'xis', y: 'ípsilon', z: 'zê',
};
const NUMERO = {
  1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis',
  7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez', 11: 'onze', 34: 'trinta e quatro',
};

// Ticker da B3: 4 letras + 1 ou 2 dígitos (PETR4, CYRE3, ALZR11).
const TICKER = /^([A-Z]{4})(\d{1,2})$/;

function soletrarTicker(tok) {
  const m = TICKER.exec(tok);
  if (!m) return null;
  const letras = m[1].toLowerCase().split('').map((c) => LETRA[c] || c).join(' ');
  const num = NUMERO[Number(m[2])] || m[2];
  return `${letras} ${num}`;
}

// Separa pontuação do miolo da palavra, para não estragar a reescrita.
const PARTES = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u;

/**
 * Reescreve o texto para o TTS.
 * Devolve { texto, mapa } onde `mapa` tem uma entrada por palavra do texto de
 * SAÍDA, apontando o grupo e a palavra original — é o que permite devolver as
 * legendas ao texto de verdade depois.
 */
export function aplicar(texto, extra = {}) {
  const dic = { ...PRONUNCIA_BASE };
  for (const [k, v] of Object.entries(extra || {})) dic[String(k).toLowerCase()] = v;

  const tokens = String(texto || '').split(/\s+/).filter(Boolean);
  const saida = [];
  const mapa = [];
  let trocas = 0;

  tokens.forEach((tok, grupo) => {
    const [, pre, miolo, pos] = PARTES.exec(tok) || [];
    const chave = (miolo || '').toLowerCase();
    const sub = dic[chave] || soletrarTicker(miolo || '');

    if (!sub) {
      saida.push(tok);
      mapa.push({ grupo, original: tok });
      return;
    }
    trocas++;
    const novo = `${pre}${sub}${pos}`.split(/\s+/).filter(Boolean);
    for (const p of novo) {
      saida.push(p);
      mapa.push({ grupo, original: tok });
    }
  });

  if (trocas) log(`Pronúncia: ${trocas} termo(s) reescritos para o áudio`);
  return { texto: saida.join(' '), mapa, trocas };
}

/**
 * Recoloca as palavras originais nos cues do TTS, somando o tempo dos pedaços
 * que vieram de uma mesma palavra ("Ê Tê Éfe" → um cue só, "ETF").
 * Devolve null quando a contagem não casa: aí o chamador cai nas legendas
 * derivadas do texto original, que perdem sincronia mas mostram o texto certo —
 * melhor que exibir "Ê Tê Éfe" na tela.
 */
export function restaurarCues(cues, mapa) {
  if (!cues?.length || !mapa?.length) return cues || null;
  if (cues.length !== mapa.length) {
    warn(`Pronúncia: ${cues.length} cues para ${mapa.length} palavras — legenda cai no texto original.`);
    return null;
  }
  const out = [];
  let i = 0;
  while (i < cues.length) {
    const g = mapa[i].grupo;
    let j = i;
    while (j + 1 < cues.length && mapa[j + 1].grupo === g) j++;
    out.push({ part: mapa[i].original, start: cues[i].start, end: cues[j].end });
    i = j + 1;
  }
  return out;
}

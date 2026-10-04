// Utilitários compartilhados do motor.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Raiz do projeto shorts-automation/ (um nível acima de src/).
export const ROOT = resolve(__dirname, '..');

export function log(...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}]`, ...args);
}

export function warn(...args) {
  const ts = new Date().toISOString();
  console.warn(`[${ts}] ⚠`, ...args);
}

// ID curto e estável baseado em timestamp + aleatoriedade leve.
export function makeId(prefix = 'sh') {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e6).toString(36);
  return `${prefix}_${t}${r}`;
}

// Remove tags HTML e normaliza espaços — usado ao limpar descrições de RSS.
// Decodifica entidades HTML (nomeadas e numéricas) — feeds costumam trazer
// &#8220; &#8217; &amp; etc., que apareciam cru no roteiro e na legenda.
const NAMED_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…',
  ndash: '–', mdash: '—', aacute: 'á', eacute: 'é', iacute: 'í',
  oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', ccedil: 'ç',
};

export function decodeEntities(s = '') {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

// Remove o rodapé que feeds WordPress anexam ao resumo.
export function stripFeedBoilerplate(s = '') {
  return String(s)
    .replace(/\s*The post .*? appeared first on .*?\.?\s*$/i, '')
    .replace(/\s*O post .*? apareceu primeiro em .*?\.?\s*$/i, '')
    .replace(/\s*(Leia mais|Continue lendo|Read more)\b.*$/i, '')
    .trim();
}

export function stripHtml(s = '') {
  return stripFeedBoilerplate(
    decodeEntities(String(s).replace(/<[^>]*>/g, ' '))
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s = '', n = 280) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// O ditado por voz do navegador entrega resultados parciais em "escada"
// ("Esse / Esse é / Esse é um / ..."). Se forem concatenados em vez de
// substituídos, uma frase de 200 chars vira um texto de 20 KB — que depois
// entope o prompt da IA. Isto desfaz a escada colapsando blocos de palavras
// que repetem o que já veio imediatamente antes.
export function collapseRepeats(text, maxLen = 600) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= 400) return t; // texto normal: não mexe
  const words = t.split(' ');
  const out = [];
  let i = 0;
  while (i < words.length) {
    let rep = 0;
    for (let k = Math.min(out.length, words.length - i); k >= 1; k--) {
      let same = true;
      for (let j = 0; j < k; j++) {
        if (out[out.length - k + j] !== words[i + j]) { same = false; break; }
      }
      if (same) { rep = k; break; }
    }
    if (rep) i += rep; // bloco repetido: pula
    else out.push(words[i++]);
  }
  const s = out.join(' ');
  // Cada passada pode expor uma escada nova; repete até estabilizar.
  if (s.length < t.length) return collapseRepeats(s, maxLen);
  return s.length > maxLen ? s.slice(0, maxLen).replace(/\s\S*$/, '') + '…' : s;
}

// Lê uma flag de linha de comando: --count=3 -> 3, --mock -> true
export function argFlag(name, fallback = undefined) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
}

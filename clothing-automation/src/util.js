// Utilitários compartilhados do motor de clothing-automation.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Raiz do projeto clothing-automation/ (um nível acima de src/).
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
export function makeId(prefix = 'cl') {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e6).toString(36);
  return `${prefix}_${t}${r}`;
}

// Remove tags HTML e normaliza espaços.
export function stripHtml(s = '') {
  return String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s = '', n = 280) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// Lê uma flag de linha de comando: --count=3 -> 3, --mock -> true
export function argFlag(name, fallback = undefined) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
}

// Normaliza número de telefone para só dígitos (compara vendors x remetente).
export function normalizePhone(s = '') {
  return String(s).replace(/\D/g, '');
}

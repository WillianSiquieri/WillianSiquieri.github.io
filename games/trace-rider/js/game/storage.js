// storage.js — persistência em localStorage: progresso das fases e pistas do
// Sandbox. Todo acesso é protegido com try/catch (pode falhar em aba privada).

const PROGRESS_KEY = 'traceplay.progress.v1';
const SANDBOX_KEY = 'traceplay.sandbox.v1';
const SKIN_KEY = 'traceplay.skin.v1';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (_) { return false; }
}

// ---- Progresso das fases ----
// Formato: { [levelId]: { completed:true, bestTime:number, bestStars:number } }
export function getProgress() { return readJSON(PROGRESS_KEY, {}); }

export function recordLevelResult(levelId, timeSec, stars) {
  const p = getProgress();
  const prev = p[levelId] || {};
  p[levelId] = {
    completed: true,
    bestTime: prev.bestTime != null ? Math.min(prev.bestTime, timeSec) : timeSec,
    bestStars: Math.max(prev.bestStars || 0, stars),
  };
  writeJSON(PROGRESS_KEY, p);
  return p[levelId];
}

// ---- Sandbox ----
export function saveSandbox(segments) { return writeJSON(SANDBOX_KEY, segments); }
export function loadSandbox() { return readJSON(SANDBOX_KEY, null); }
export function hasSandbox() { return loadSandbox() != null; }

// ---- Skin (cor do carrinho) ----
// Paleta de cores disponível para o personagem (estilo minimalista).
export const SKINS = [
  { id: 'blue', color: '#2e7dff', name: 'Azul' },
  { id: 'red', color: '#ef4444', name: 'Vermelho' },
  { id: 'green', color: '#17b26a', name: 'Verde' },
  { id: 'purple', color: '#8b5cf6', name: 'Roxo' },
  { id: 'orange', color: '#f59e0b', name: 'Laranja' },
  { id: 'pink', color: '#ec4899', name: 'Rosa' },
];

export function getSkin() {
  let id = 'blue';
  try { id = localStorage.getItem(SKIN_KEY) || 'blue'; } catch (_) {}
  return SKINS.find(s => s.id === id) || SKINS[0];
}
export function setSkin(id) {
  try { localStorage.setItem(SKIN_KEY, id); } catch (_) {}
}

// ---- Compartilhar pista por link ----
// Codifica os segmentos (lista de [ax,ay,bx,by] inteiros) num texto compacto
// seguro para URL: números achatados, separados por vírgula, em base64.
export function encodeTrack(segments) {
  if (!segments || !segments.length) return '';
  const flat = [];
  for (const s of segments) flat.push(s[0], s[1], s[2], s[3]);
  const str = flat.join(',');
  try { return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  catch (_) { return ''; }
}

export function decodeTrack(code) {
  if (!code) return null;
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const str = atob(b64);
    const nums = str.split(',').map(Number);
    if (nums.length < 4 || nums.length % 4 !== 0 || nums.some(n => !Number.isFinite(n))) return null;
    const segs = [];
    for (let i = 0; i < nums.length; i += 4) segs.push([nums[i], nums[i + 1], nums[i + 2], nums[i + 3]]);
    return segs;
  } catch (_) { return null; }
}

// storage.js — persistência em localStorage: progresso das fases e pistas do
// Sandbox. Todo acesso é protegido com try/catch (pode falhar em aba privada).

const PROGRESS_KEY = 'traceplay.progress.v1';
const SANDBOX_KEY = 'traceplay.sandbox.v1';

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

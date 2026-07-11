// Camada de persistência: lê/grava os arquivos JSON versionados em data/ e config/.
// Todo o estado do sistema vive em arquivos simples para funcionar no GitHub Actions
// (o workflow commita as mudanças de volta ao repositório).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../util.js';

const DATA = join(ROOT, 'data');
const CONFIG = join(ROOT, 'config');

async function readJson(path, fallback) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export const config = () => readJson(join(CONFIG, 'config.json'), {});
export const settings = () => readJson(join(DATA, 'settings.json'), { mode: 'approval', shortsPerDay: 2, preferences: {} });
export const queue = () => readJson(join(DATA, 'queue.json'), []);
export const published = () => readJson(join(DATA, 'published.json'), []);
export const feedback = () => readJson(join(DATA, 'feedback.json'), []);

export const saveSettings = (v) => writeJson(join(DATA, 'settings.json'), v);
export const saveQueue = (v) => writeJson(join(DATA, 'queue.json'), v);
export const savePublished = (v) => writeJson(join(DATA, 'published.json'), v);
export const saveFeedback = (v) => writeJson(join(DATA, 'feedback.json'), v);

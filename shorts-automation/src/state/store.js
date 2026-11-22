// Camada de persistência: lê/grava os arquivos JSON versionados em data/ e config/.
// Todo o estado do sistema vive em arquivos simples para funcionar no GitHub Actions
// (o workflow commita as mudanças de volta ao repositório).
//
// MULTI-CANAL: o mesmo motor roda vários canais (financeiro, bíblico, ...). Cada
// canal tem o seu próprio estado e a sua própria configuração:
//
//   financeiro (padrão)  data/queue.json          config/config.json
//   <outro>              data/<outro>/queue.json  config/config.json + config/channels/<outro>.json
//
// O financeiro fica nos caminhos antigos de propósito: ele está em produção, e
// mover os arquivos dele quebraria o painel e os workflows sem necessidade.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, argFlag } from '../util.js';

export const DEFAULT_CHANNEL = 'financeiro';

// Canal do processo: --channel=biblico, ou SA_CHANNEL=biblico, ou o padrão.
// Resolvido uma vez só: um processo serve um canal.
export const CHANNEL = String(argFlag('channel') || process.env.SA_CHANNEL || DEFAULT_CHANNEL)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '');

const CONFIG = join(ROOT, 'config');
// Caminhos legados para o canal padrão; subpasta para os demais.
const DATA = CHANNEL === DEFAULT_CHANNEL ? join(ROOT, 'data') : join(ROOT, 'data', CHANNEL);

export const dataDir = () => DATA;
export const previewsDir = () => join(DATA, 'previews');

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
  await mkdir(DATA, { recursive: true }); // canal novo ainda não tem a pasta
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

// Mescla rasa por seção: a configuração do canal sobrescreve a base chave por
// chave dentro de cada seção (video, tts, llm...), em vez de substituir a seção
// inteira — assim o canal só declara o que muda.
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
      ? { ...base[k], ...v }
      : v;
  }
  return out;
}

export async function config() {
  const base = await readJson(join(CONFIG, 'config.json'), {});
  if (CHANNEL === DEFAULT_CHANNEL) return base;
  const over = await readJson(join(CONFIG, 'channels', `${CHANNEL}.json`), null);
  if (!over) throw new Error(`Canal "${CHANNEL}" não tem config/channels/${CHANNEL}.json`);
  return merge(base, over);
}

export const settings = () => readJson(join(DATA, 'settings.json'), { mode: 'approval', shortsPerDay: 2, preferences: {} });
export const queue = () => readJson(join(DATA, 'queue.json'), []);
export const published = () => readJson(join(DATA, 'published.json'), []);
export const feedback = () => readJson(join(DATA, 'feedback.json'), []);

export const saveSettings = (v) => writeJson(join(DATA, 'settings.json'), v);
export const saveQueue = (v) => writeJson(join(DATA, 'queue.json'), v);
export const savePublished = (v) => writeJson(join(DATA, 'published.json'), v);
export const saveFeedback = (v) => writeJson(join(DATA, 'feedback.json'), v);

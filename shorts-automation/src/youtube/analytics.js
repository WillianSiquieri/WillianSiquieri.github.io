// Coleta de performance dos vídeos publicados.
// Atualiza data/published.json com views/likes/comments e um "score" simples,
// usado depois para priorizar temas parecidos aos que performam melhor.
import { google } from 'googleapis';
import { getAuth } from './auth.js';
import * as store from '../state/store.js';
import { log, warn } from '../util.js';

// Busca estatísticas básicas (Data API) para uma lista de videoIds.
async function fetchStats(youtube, ids) {
  if (!ids.length) return {};
  const res = await youtube.videos.list({ part: ['statistics'], id: ids });
  const out = {};
  for (const v of res.data.items || []) {
    out[v.id] = {
      views: Number(v.statistics?.viewCount || 0),
      likes: Number(v.statistics?.likeCount || 0),
      comments: Number(v.statistics?.commentCount || 0),
    };
  }
  return out;
}

// Score de performance: engajamento ponderado por views.
export function scoreOf(s) {
  const views = s.views || 0;
  const eng = (s.likes || 0) * 3 + (s.comments || 0) * 5;
  return Math.round(views + eng * 10);
}

export async function refreshAnalytics() {
  const auth = getAuth();
  const published = await store.published();
  if (!auth) {
    warn('Credenciais do YouTube ausentes — analytics pulado.');
    return published;
  }
  const youtube = google.youtube({ version: 'v3', auth });
  const ids = published.map((p) => p.youtubeId).filter(Boolean);
  const stats = await fetchStats(youtube, ids);

  const updated = published.map((p) => {
    const s = stats[p.youtubeId];
    if (!s) return p;
    return { ...p, ...s, score: scoreOf(s), analyticsUpdatedAt: new Date().toISOString() };
  });

  await store.savePublished(updated);
  log(`Analytics atualizado para ${Object.keys(stats).length} vídeos.`);
  return updated;
}

// Top N vídeos por score — usados para orientar a próxima geração.
export async function topPerformers(n = 5) {
  const published = await store.published();
  return [...published].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, n);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  refreshAnalytics().catch((e) => {
    warn(e.message);
    process.exit(1);
  });
}

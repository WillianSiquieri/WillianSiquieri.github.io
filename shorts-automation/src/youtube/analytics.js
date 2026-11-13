// Coleta de performance dos vídeos publicados.
// Atualiza data/published.json com views/likes/comments, RETENÇÃO e um "score",
// usados depois para orientar a próxima geração.
//
// Por que retenção: nos Shorts a distribuição segue quem assiste até o fim, não
// quem curte. Otimizar por likes é olhar para o efeito, não para a causa.
import { google } from 'googleapis';
import { getAuth } from './auth.js';
import * as store from '../state/store.js';
import { log, warn } from '../util.js';

// Busca estatísticas básicas (Data API) para uma lista de videoIds.
async function fetchStats(youtube, ids) {
  if (!ids.length) return {};
  const out = {};
  // A Data API aceita no máximo 50 ids por chamada.
  for (let i = 0; i < ids.length; i += 50) {
    const res = await youtube.videos.list({ part: ['statistics'], id: ids.slice(i, i + 50) });
    for (const v of res.data.items || []) {
      out[v.id] = {
        views: Number(v.statistics?.viewCount || 0),
        likes: Number(v.statistics?.likeCount || 0),
        comments: Number(v.statistics?.commentCount || 0),
      };
    }
  }
  return out;
}

// Retenção por vídeo (YouTube Analytics API). Precisa do escopo
// yt-analytics.readonly. Best-effort: se falhar, o ciclo segue com views/likes.
async function fetchRetention(auth, ids, startDate) {
  if (!ids.length) return {};
  const ya = google.youtubeAnalytics({ version: 'v2', auth });
  const hoje = new Date().toISOString().slice(0, 10);
  const out = {};
  // O filtro video== aceita no máximo 500 ids, mas a resposta é por vídeo;
  // fatiamos em 200 para não montar URLs gigantes.
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const res = await ya.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: hoje,
      metrics: 'views,averageViewPercentage,averageViewDuration',
      dimensions: 'video',
      filters: `video==${lote.join(',')}`,
    });
    const cols = (res.data.columnHeaders || []).map((c) => c.name);
    const iv = cols.indexOf('video');
    const ip = cols.indexOf('averageViewPercentage');
    const id_ = cols.indexOf('averageViewDuration');
    for (const row of res.data.rows || []) {
      out[row[iv]] = {
        avgViewPct: ip >= 0 && row[ip] != null ? Math.round(Number(row[ip]) * 10) / 10 : null,
        avgViewSec: id_ >= 0 && row[id_] != null ? Math.round(Number(row[id_])) : null,
      };
    }
  }
  return out;
}

// Score de performance. Retenção multiplica: 2.000 views com 30% de retenção
// é um vídeo que o algoritmo vai parar de empurrar; 500 views com 90% é um que
// ele ainda pode escalar. Sem dado de retenção, cai no comportamento antigo.
export function scoreOf(s) {
  const views = s.views || 0;
  const eng = (s.likes || 0) * 3 + (s.comments || 0) * 5;
  const base = views + eng * 10;
  const pct = s.avgViewPct;
  if (!Number.isFinite(pct) || pct <= 0) return Math.round(base);
  // 60% de retenção = neutro; abaixo penaliza, acima premia (teto em 2x).
  return Math.round(base * Math.min(2, pct / 60));
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

  // Janela desde o primeiro vídeo publicado (ou 90 dias, o que for mais curto).
  const datas = published.map((p) => p.publishedAt).filter(Boolean).sort();
  const noventaDias = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const inicio = datas.length ? datas[0].slice(0, 10) : noventaDias;
  const startDate = inicio < noventaDias ? noventaDias : inicio;

  let ret = {};
  try {
    ret = await fetchRetention(auth, ids, startDate);
  } catch (e) {
    warn(`Retenção indisponível (${e.message}) — seguindo só com views/likes.`);
  }

  const updated = published.map((p) => {
    const s = stats[p.youtubeId];
    if (!s) return p;
    const r = ret[p.youtubeId] || {};
    const merged = { ...s, avgViewPct: r.avgViewPct ?? p.avgViewPct ?? null, avgViewSec: r.avgViewSec ?? p.avgViewSec ?? null };
    return { ...p, ...merged, score: scoreOf(merged), analyticsUpdatedAt: new Date().toISOString() };
  });

  await store.savePublished(updated);
  const comRet = updated.filter((p) => Number.isFinite(p.avgViewPct)).length;
  log(`Analytics atualizado para ${Object.keys(stats).length} vídeos (${comRet} com retenção).`);
  return updated;
}

// Top N vídeos por score — usados para orientar a próxima geração.
export async function topPerformers(n = 5) {
  const published = await store.published();
  return [...published].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, n);
}

// Piores N (entre os que já têm views suficientes para significar algo) — tão
// informativo quanto os melhores: mostra à IA o que NÃO repetir.
export async function worstPerformers(n = 5, minViews = 20) {
  const published = await store.published();
  return [...published]
    .filter((p) => (p.views || 0) >= minViews)
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .slice(0, n);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  refreshAnalytics().catch((e) => {
    warn(e.message);
    process.exit(1);
  });
}

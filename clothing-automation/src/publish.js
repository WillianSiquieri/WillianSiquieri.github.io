// Processa as decisões tomadas no painel:
//   - posts 'approved' → publicados no Instagram (Graph API) e movidos para
//     published.json. A mídia local é apagada (já está no Instagram).
//   - posts 'rejected' → removidos da fila (e a mídia local é apagada).
//
// Roda no CI logo após o painel gravar data/queue.json (e em cron curto), quando
// as imagens já foram commitadas e estão públicas no GitHub Pages.
import * as store from './state/store.js';
import { publishPost, instagramReady } from './instagram/publish.js';
import { dropMedia, publicUrl } from './media.js';
import { log, warn } from './util.js';

async function main() {
  const [config, queue, published] = await Promise.all([store.config(), store.queue(), store.published()]);
  const baseUrl = config.publicBaseUrl || '';
  const now = new Date().toISOString();

  const remaining = [];
  const newlyPublished = [];

  for (const d of queue) {
    if (d.status === 'approved') {
      const urls = (d.images || []).map((rel) => publicUrl(baseUrl, rel));
      let ig = null;
      try {
        ig = await publishPost({ imageUrls: urls, caption: d.caption });
      } catch (e) {
        warn(`Falha ao publicar ${d.id}:`, e.message);
        remaining.push(d); // mantém na fila para tentar de novo
        continue;
      }
      if (!ig && instagramReady()) {
        // ready mas retornou null por algum motivo inesperado — segura para retry.
        remaining.push(d);
        continue;
      }
      await dropMedia(d.images);
      newlyPublished.push({
        ...d,
        status: 'published',
        publishedAt: now,
        images: [],
        instagram: { published: Boolean(ig), mediaId: ig?.mediaId || null, permalink: ig?.permalink || null },
        likes: 0, comments: 0, reach: 0, score: 0,
      });
      log(ig ? `Aprovado e publicado: ${d.id} → ${ig.mediaId}` : `Aprovado (Instagram não conectado): ${d.id} marcado como publicado localmente.`);
    } else if (d.status === 'rejected') {
      await dropMedia(d.images);
      log(`Rejeitado e descartado: ${d.id}`);
      // sai da fila
    } else {
      remaining.push(d);
    }
  }

  await store.saveQueue(remaining);
  if (newlyPublished.length) await store.savePublished([...published, ...newlyPublished]);
  log(`Publicação: ${newlyPublished.length} publicados, ${remaining.length} restantes na fila.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

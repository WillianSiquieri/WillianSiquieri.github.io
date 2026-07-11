// Processa as decisões tomadas no painel:
//   - drafts com status 'approved'  → tornam-se públicos (flip de privacidade ou
//     upload público, caso ainda não tenham sido enviados) e vão para published.json.
//   - drafts com status 'rejected'  → removidos da fila (e o preview privado é deletado).
//
// Roda no CI logo após o painel gravar data/queue.json, e/ou em cron curto.
import { google } from 'googleapis';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import * as store from './state/store.js';
import { getAuth } from './youtube/auth.js';
import { log, warn, ROOT } from './util.js';

// Remove o preview auto-hospedado (já decidido, não precisa mais ocupar o repo).
async function dropPreview(d) {
  const rel = d.video?.previewFile;
  if (!rel) return;
  try { await unlink(join(ROOT, rel)); } catch { /* já não existe */ }
}

async function setPublic(youtube, videoId) {
  await youtube.videos.update({
    part: ['status'],
    requestBody: { id: videoId, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false } },
  });
}

async function deleteVideo(youtube, videoId) {
  try {
    await youtube.videos.delete({ id: videoId });
  } catch (e) {
    warn(`Não foi possível deletar ${videoId}:`, e.message);
  }
}

async function main() {
  const [queue, published] = await Promise.all([store.queue(), store.published()]);
  const auth = getAuth();
  const youtube = auth ? google.youtube({ version: 'v3', auth }) : null;
  const now = new Date().toISOString();

  const remaining = [];
  const newlyPublished = [];

  for (const d of queue) {
    if (d.status === 'approved') {
      if (youtube && d.youtubeId) {
        try {
          await setPublic(youtube, d.youtubeId);
          log(`Aprovado e publicado: ${d.youtubeId}`);
        } catch (e) {
          warn(`Falha ao publicar ${d.id}:`, e.message);
          remaining.push(d); // mantém na fila para tentar de novo
          continue;
        }
      } else {
        log(`Aprovado (sem YouTube conectado): ${d.id} marcado como publicado localmente.`);
      }
      await dropPreview(d);
      newlyPublished.push({ ...d, status: 'published', privacyStatus: 'public', publishedAt: now, views: 0, likes: 0, comments: 0, score: 0, video: { ...d.video, previewFile: null } });
    } else if (d.status === 'rejected') {
      if (youtube && d.youtubeId) await deleteVideo(youtube, d.youtubeId);
      await dropPreview(d);
      log(`Rejeitado e descartado: ${d.id}`);
      // não entra em lugar nenhum — sai da fila
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

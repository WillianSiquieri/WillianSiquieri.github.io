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
    return true;
  } catch (e) {
    warn(`Não foi possível deletar ${videoId}:`, e.message);
    return false;
  }
}

// "Insufficient Permission" não é falha passageira: o refresh token foi gerado
// sem o escopo de escrita. Dá o recado em vez de deixar o erro cru no log.
function explique(e) {
  if (/insufficient permission|insufficientPermissions/i.test(e.message)) {
    return (
      'o YT_REFRESH_TOKEN não tem o escopo de escrita ' +
      '(https://www.googleapis.com/auth/youtube). Gere o token de novo na conta do canal ' +
      'e atualize o secret — o upload funciona com youtube.upload, mas tornar público não.'
    );
  }
  return e.message;
}

async function main() {
  const [config, queue, published] = await Promise.all([store.config(), store.queue(), store.published()]);
  const auth = getAuth();
  const youtube = auth ? google.youtube({ version: 'v3', auth }) : null;
  const now = new Date().toISOString();

  // Notícia financeira envelhece rápido: um short que ficou dias sem decisão não
  // vale mais publicar, e deixá-lo na fila só faz a revisão virar um mutirão.
  // 0 desliga a expiração.
  const maxAgeDays = config.queue?.maxAgeDays ?? 5;
  const limite = maxAgeDays > 0 ? Date.now() - maxAgeDays * 86400000 : null;
  const expirou = (d) =>
    limite !== null &&
    d.status !== 'approved' &&
    d.createdAt &&
    new Date(d.createdAt).getTime() < limite;

  const remaining = [];
  const newlyPublished = [];
  const falhas = [];
  let expirados = 0;

  for (const d0 of queue) {
    // Expirado conta como rejeitado: apaga o não listado do canal e sai da fila.
    const d = expirou(d0) ? { ...d0, status: 'rejected', rejectReason: `expirou sem revisão (mais de ${maxAgeDays} dias na fila)`, decidedAt: now } : d0;
    if (d !== d0) expirados++;

    if (d.status === 'approved') {
      if (youtube && d.youtubeId) {
        try {
          await setPublic(youtube, d.youtubeId);
          log(`Aprovado e publicado: ${d.youtubeId}`);
        } catch (e) {
          const motivo = explique(e);
          warn(`Falha ao publicar ${d.id}: ${motivo}`);
          falhas.push(`${d.id}: ${motivo}`);
          // Mantém na fila para o próximo ciclo tentar, e registra o motivo
          // para o painel mostrar por que o vídeo continua não listado.
          remaining.push({ ...d, publishError: motivo, publishErrorAt: now });
          continue;
        }
      } else {
        log(`Aprovado (sem YouTube conectado): ${d.id} marcado como publicado localmente.`);
      }
      await dropPreview(d);
      newlyPublished.push({ ...d, status: 'published', privacyStatus: 'public', publishedAt: now, views: 0, likes: 0, comments: 0, score: 0, publishError: null, video: { ...d.video, previewFile: null } });
    } else if (d.status === 'rejected') {
      if (youtube && d.youtubeId && !(await deleteVideo(youtube, d.youtubeId))) {
        // O vídeo não listado continua lá; segurar na fila evita abandoná-lo
        // no canal sem ninguém saber. A próxima rodada tenta apagar de novo.
        falhas.push(`${d.id}: não foi possível apagar ${d.youtubeId} do YouTube`);
        remaining.push({ ...d, publishError: `não foi possível apagar ${d.youtubeId} do YouTube`, publishErrorAt: now });
        continue;
      }
      await dropPreview(d);
      log(`Rejeitado e descartado: ${d.id}${d !== d0 ? ' (expirado)' : ''}`);
      // não entra em lugar nenhum — sai da fila
    } else {
      remaining.push(d);
    }
  }

  await store.saveQueue(remaining);
  if (newlyPublished.length) await store.savePublished([...published, ...newlyPublished]);
  if (expirados) log(`${expirados} short(s) expiraram sem revisão (limite: ${maxAgeDays} dias).`);
  log(`Publicação: ${newlyPublished.length} publicados, ${remaining.length} restantes na fila.`);

  // Sai com erro para o workflow ficar vermelho: uma decisão do painel que não
  // se concretizou já passou batida uma vez com o run verde.
  if (falhas.length) {
    warn(`${falhas.length} decisão(ões) não aplicada(s):\n  - ${falhas.join('\n  - ')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

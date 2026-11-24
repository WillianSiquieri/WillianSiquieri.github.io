// Upload de um vídeo para o YouTube via Data API v3.
// Retorna { youtubeId, url } ou lança erro. Se as credenciais faltarem, retorna null.
import { google } from 'googleapis';
import { createReadStream } from 'node:fs';
import { getAuth } from './auth.js';
import { log } from '../util.js';

export function youtubeReady() {
  return Boolean(getAuth());
}

// Qual canal o refresh token controla. O token é amarrado ao canal escolhido na
// tela de consentimento, e escolher o errado ali já encheu o canal pessoal de
// vídeos neste projeto. Conferido uma vez por processo (cache) e barato.
let canalCache = null;
export async function canalDoToken(auth) {
  if (canalCache) return canalCache;
  const youtube = google.youtube({ version: 'v3', auth });
  const res = await youtube.channels.list({ part: ['snippet'], mine: true });
  const c = res.data.items?.[0];
  canalCache = { id: c?.id || null, title: c?.snippet?.title || null };
  return canalCache;
}

// Compara o canal do token com o nome esperado na config. Não tenta ser exato:
// normaliza acento, caixa e pontuação, porque o nome no YouTube raramente bate
// caractere a caractere com o da config.
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

export async function assertCanal(auth, esperado) {
  const atual = await canalDoToken(auth);
  if (!atual.title) {
    log('Não foi possível confirmar o canal do token — seguindo.');
    return atual;
  }
  log(`Canal do token: "${atual.title}" (${atual.id})`);
  if (esperado && norm(atual.title) !== norm(esperado)) {
    throw new Error(
      `Canal errado: o token aponta para "${atual.title}", mas este canal é "${esperado}". ` +
        `Gere o refresh token de novo e, na tela de consentimento, selecione "${esperado}".`
    );
  }
  return atual;
}

export async function uploadShort(draft, videoPath, { privacyStatus = 'private', categoryId = '25', expectedChannel = null } = {}) {
  const auth = getAuth();
  if (!auth) {
    log('Credenciais do YouTube ausentes — upload pulado.');
    return null;
  }
  // Antes de enviar qualquer byte: o token é do canal certo?
  await assertCanal(auth, expectedChannel);
  const youtube = google.youtube({ version: 'v3', auth });

  const description = [
    draft.script,
    '',
    draft.sourceLink ? `Fonte: ${draft.sourceLink}` : '',
    '',
    (draft.tags || []).map((t) => `#${String(t).replace(/\s+/g, '')}`).join(' '),
    '#shorts',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: (draft.title || 'Short').slice(0, 100),
        description: description.slice(0, 4900),
        tags: (draft.tags || []).slice(0, 15),
        categoryId, // configurável via config.video.categoryId (25 = News & Politics)
      },
      status: { privacyStatus, selfDeclaredMadeForKids: false },
    },
    media: { body: createReadStream(videoPath) },
  });

  const youtubeId = res.data.id;
  log(`Publicado no YouTube: ${youtubeId} (${privacyStatus})`);
  return { youtubeId, url: `https://youtube.com/shorts/${youtubeId}` };
}

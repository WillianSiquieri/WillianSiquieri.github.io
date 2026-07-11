// Upload de um vídeo para o YouTube via Data API v3.
// Retorna { youtubeId, url } ou lança erro. Se as credenciais faltarem, retorna null.
import { google } from 'googleapis';
import { createReadStream } from 'node:fs';
import { getAuth } from './auth.js';
import { log } from '../util.js';

export function youtubeReady() {
  return Boolean(getAuth());
}

export async function uploadShort(draft, videoPath, { privacyStatus = 'private', categoryId = '25' } = {}) {
  const auth = getAuth();
  if (!auth) {
    log('Credenciais do YouTube ausentes — upload pulado.');
    return null;
  }
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

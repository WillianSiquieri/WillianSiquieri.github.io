// Publicação no Instagram via Graph API (conta Business/Creator ligada a uma
// Página do Facebook). Fluxo:
//   1. Cria um "media container" por imagem (a partir de uma image_url pública).
//   2. Post com 1 imagem  -> publica o container direto.
//      Post com N imagens -> cria containers filhos (is_carousel_item) e um
//      container de carrossel, depois publica.
//
// As imagens vêm de data/media/, servidas publicamente pelo GitHub Pages — é por
// isso que o ciclo baixa e commita as fotos antes de publicar.
import { warn, log } from '../util.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

export function instagramReady() {
  return Boolean(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN);
}

async function graph(path, params) {
  const url = `${GRAPH}/${path}`;
  const body = new URLSearchParams({ ...params, access_token: process.env.IG_ACCESS_TOKEN });
  const res = await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(60000) });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Graph HTTP ${res.status}`);
  }
  return data;
}

async function createImageContainer(igUserId, imageUrl, { caption, carouselChild }) {
  const params = { image_url: imageUrl };
  if (carouselChild) params.is_carousel_item = 'true';
  else if (caption) params.caption = caption;
  const data = await graph(`${igUserId}/media`, params);
  return data.id;
}

async function publishContainer(igUserId, creationId) {
  const data = await graph(`${igUserId}/media_publish`, { creation_id: creationId });
  return data.id;
}

async function getPermalink(mediaId) {
  try {
    const url = `${GRAPH}/${mediaId}?fields=permalink&access_token=${process.env.IG_ACCESS_TOKEN}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    return data.permalink || null;
  } catch {
    return null;
  }
}

// Publica um post. imageUrls = URLs públicas (GitHub Pages). Retorna
// { mediaId, permalink } ou null se o Instagram não estiver configurado.
export async function publishPost({ imageUrls, caption }) {
  if (!instagramReady()) {
    log('Instagram não configurado — publicação simulada (sem envio real).');
    return null;
  }
  const igUserId = process.env.IG_USER_ID;
  if (!imageUrls?.length) throw new Error('post sem imagens');

  let creationId;
  if (imageUrls.length === 1) {
    creationId = await createImageContainer(igUserId, imageUrls[0], { caption });
  } else {
    const children = [];
    for (const u of imageUrls) {
      children.push(await createImageContainer(igUserId, u, { carouselChild: true }));
    }
    const carousel = await graph(`${igUserId}/media`, {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption: caption || '',
    });
    creationId = carousel.id;
  }

  const mediaId = await publishContainer(igUserId, creationId);
  const permalink = await getPermalink(mediaId);
  log(`Publicado no Instagram: ${mediaId}`);
  return { mediaId, permalink };
}

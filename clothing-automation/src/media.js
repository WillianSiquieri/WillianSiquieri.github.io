// Baixa as imagens recebidas e as guarda em data/media/, versionadas no repo.
// Assim o GitHub Pages serve cada imagem numa URL pública — o que o Instagram
// Graph API exige (ele publica a partir de uma image_url acessível) e o painel
// usa para mostrar o preview.
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, log, warn } from './util.js';

const MEDIA_DIR = join(ROOT, 'data', 'media');

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

// Lê um data: URI ("data:image/png;base64,....") → { buffer, type }.
function readDataUri(uri) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  const type = (m[1] || 'image/jpeg').trim();
  const buffer = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  return { buffer, type };
}

// Baixa uma lista de URLs (http(s) ou data:) para data/media/<id>_<n>.<ext>.
// Devolve os caminhos relativos (a partir da raiz do módulo) das imagens salvas.
export async function downloadImages(urls, id) {
  await mkdir(MEDIA_DIR, { recursive: true });
  const saved = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      let type, buf;
      if (String(urls[i]).startsWith('data:')) {
        const d = readDataUri(urls[i]);
        if (!d) throw new Error('data URI inválido');
        ({ buffer: buf, type } = d);
      } else {
        const res = await fetch(urls[i], { signal: AbortSignal.timeout(45000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        type = (res.headers.get('content-type') || '').split(';')[0].trim();
        buf = Buffer.from(await res.arrayBuffer());
      }
      const ext = EXT_BY_TYPE[type] || 'jpg';
      const rel = `data/media/${id}_${i + 1}.${ext}`;
      await writeFile(join(ROOT, rel), buf);
      saved.push(rel);
    } catch (e) {
      warn(`Falha ao baixar imagem ${i + 1} de ${id}:`, e.message);
    }
  }
  log(`${saved.length}/${urls.length} imagens salvas para ${id}.`);
  return saved;
}

// Remove os arquivos de mídia locais de um post (após publicar ou rejeitar).
export async function dropMedia(images = []) {
  for (const rel of images) {
    try {
      await unlink(join(ROOT, rel));
    } catch {
      /* já não existe */
    }
  }
}

// Constrói a URL pública (GitHub Pages) a partir do caminho relativo.
export function publicUrl(baseUrl, rel) {
  const b = String(baseUrl || '').replace(/\/+$/, '');
  return `${b}/${rel}`;
}

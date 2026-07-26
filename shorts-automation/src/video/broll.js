// Fundo em vídeo (b-roll) via Pexels Videos API — gratuito, dá aparência real
// aos Shorts em vez de um gradiente chapado. Escolhe o tema do clipe a partir do
// assunto do draft. Retorna o caminho do arquivo baixado, ou null (cai no gradiente).
import { writeFile } from 'node:fs/promises';
import { log, warn } from '../util.js';

// Mapeia o assunto do short para uma busca de b-roll (em inglês, onde o acervo é maior).
const QUERY_MAP = [
  { re: /d[óo]lar|c[âa]mbio|moeda|real\b/i, q: 'dollar money currency' },
  { re: /bolsa|ibovespa|a[çc][õo]es|invest|tesouro|fundo|b3\b/i, q: 'stock market trading chart' },
  { re: /petr[óo]leo|combust[íi]vel|gasolina|energia/i, q: 'oil gas fuel station' },
  { re: /tarifa|com[ée]rcio|exporta|importa|navio/i, q: 'cargo shipping port container' },
  { re: /infla[çc][ãa]o|pre[çc]o|supermercado|compras/i, q: 'grocery shopping supermarket' },
  { re: /juros|selic|banco central|banco/i, q: 'bank finance city building' },
  { re: /aposentad|previd[êe]ncia|poupan/i, q: 'saving money piggy bank' },
  { re: /cart[ãa]o|d[íi]vida|cr[ée]dito|financ/i, q: 'credit card payment money' },
  { re: /im[óo]vel|aluguel|casa|apartamento/i, q: 'real estate city apartment' },
  { re: /tecnologia|intelig[êe]ncia|ia\b|startup/i, q: 'technology data server' },
];

function pickQuery(draft) {
  const hay = [draft.theme, ...(draft.tags || []), ...(draft.captionKeywords || [])].join(' ');
  for (const m of QUERY_MAP) if (m.re.test(hay)) return m.q;
  return 'finance business money';
}

export function brollAvailable() {
  return Boolean(process.env.PEXELS_API_KEY);
}

export async function fetchBroll(draft, outPath, width = 1080, height = 1920) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const q = pickQuery(draft);
  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=20`;
    const res = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      warn(`Pexels HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const vids = (data.videos || []).filter((v) => v.video_files?.length);
    if (!vids.length) {
      warn(`Pexels sem resultados para "${q}"`);
      return null;
    }
    // Varia o clipe para não repetir sempre o mesmo tema visual.
    const pick = vids[Math.floor(Math.random() * vids.length)];
    // Prefere arquivo vertical com resolução perto de 1920 de altura.
    const file =
      pick.video_files
        .filter((f) => (f.height || 0) >= (f.width || 0))
        .sort((a, b) => Math.abs((a.height || 0) - height) - Math.abs((b.height || 0) - height))[0] ||
      pick.video_files[0];

    const vres = await fetch(file.link, { signal: AbortSignal.timeout(60000) });
    if (!vres.ok) {
      warn(`Download b-roll HTTP ${vres.status}`);
      return null;
    }
    await writeFile(outPath, Buffer.from(await vres.arrayBuffer()));
    log(`B-roll Pexels ("${q}") → ${file.width}x${file.height}`);
    return outPath;
  } catch (e) {
    warn('Falha no b-roll Pexels (usando gradiente):', e.message);
    return null;
  }
}

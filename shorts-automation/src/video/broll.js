// Fundo em vídeo (b-roll) via Pexels Videos API — gratuito, dá aparência real
// aos Shorts em vez de um gradiente chapado. Escolhe os temas dos clipes a partir
// do assunto do draft e baixa VÁRIOS, para o vídeo alternar imagens em vez de
// repetir a mesma cena em loop do começo ao fim.
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

// Buscas genéricas de reforço: entram quando a busca principal não devolve
// clipes distintos suficientes, mantendo a variedade sem sair do nicho.
const FALLBACK_QUERIES = [
  'finance business money',
  'business people office city',
  'economy graph data screen',
];

function pickQueries(draft) {
  const hay = [draft.theme, ...(draft.tags || []), ...(draft.captionKeywords || [])].join(' ');
  const hits = QUERY_MAP.filter((m) => m.re.test(hay)).map((m) => m.q);
  // Sem duplicar: temas achados primeiro, genéricos depois.
  return [...new Set([...hits, ...FALLBACK_QUERIES])];
}

export function brollAvailable() {
  return Boolean(process.env.PEXELS_API_KEY);
}

async function searchPexels(key, q) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=25`;
  const res = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    warn(`Pexels HTTP ${res.status} para "${q}"`);
    return [];
  }
  const data = await res.json();
  return (data.videos || []).filter((v) => v.video_files?.length);
}

// Escolhe o arquivo vertical com altura mais próxima do alvo.
function bestFile(video, height) {
  return (
    video.video_files
      .filter((f) => (f.height || 0) >= (f.width || 0))
      .sort((a, b) => Math.abs((a.height || 0) - height) - Math.abs((b.height || 0) - height))[0] ||
    video.video_files[0]
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Baixa até `want` clipes DISTINTOS para o diretório do draft.
 * Retorna os caminhos baixados (pode vir menos que `want`, ou vazio).
 */
export async function fetchBrollClips(draft, dir, want, width = 1080, height = 1920) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];

  const queries = pickQueries(draft);
  const chosen = [];
  const seen = new Set();

  // Varre as buscas até juntar clipes distintos suficientes.
  for (const q of queries) {
    if (chosen.length >= want) break;
    let vids;
    try {
      vids = await searchPexels(key, q);
    } catch (e) {
      warn(`Busca de b-roll "${q}" falhou: ${e.message}`);
      continue;
    }
    for (const v of shuffle(vids)) {
      if (chosen.length >= want) break;
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      chosen.push({ video: v, q });
    }
  }

  if (!chosen.length) {
    warn('Pexels sem resultados — caindo no gradiente.');
    return [];
  }

  // Baixa em paralelo: são arquivos pequenos e o ciclo inteiro tem orçamento curto.
  const results = await Promise.all(
    chosen.map(async ({ video, q }, i) => {
      const file = bestFile(video, height);
      const out = `${dir}/broll-${i}.mp4`;
      try {
        const res = await fetch(file.link, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) {
          warn(`Download b-roll HTTP ${res.status}`);
          return null;
        }
        await writeFile(out, Buffer.from(await res.arrayBuffer()));
        return { path: out, q, size: `${file.width}x${file.height}` };
      } catch (e) {
        warn(`Download b-roll falhou: ${e.message}`);
        return null;
      }
    })
  );

  const ok = results.filter(Boolean);
  if (ok.length) {
    log(`B-roll Pexels: ${ok.length} clipes [${ok.map((r) => r.q).join(' | ')}]`);
  }
  return ok.map((r) => r.path);
}

// Fundo em vídeo (b-roll) via Pexels Videos API — gratuito, dá aparência real
// aos Shorts em vez de um gradiente chapado. Escolhe os temas dos clipes a partir
// do assunto do draft e baixa VÁRIOS, para o vídeo alternar imagens em vez de
// repetir a mesma cena em loop do começo ao fim.
import { writeFile } from 'node:fs/promises';
import { log, warn } from '../util.js';

// Mapeia o assunto do short para buscas de b-roll (em inglês, onde o acervo é
// maior). Cada tema tem VÁRIOS registros visuais — não só gráfico e dinheiro —
// porque seis clipes de cotação subindo e descendo cansam igual a um só em loop.
const QUERY_MAP = [
  { re: /d[óo]lar|c[âa]mbio|moeda|real\b/i, qs: ['dollar money currency', 'currency exchange office', 'traveler airport counter', 'hands counting cash'] },
  { re: /bolsa|ibovespa|a[çc][õo]es|invest|tesouro|fundo|b3\b/i, qs: ['stock market trading chart', 'trader office screens', 'business people meeting', 'skyscraper financial district'] },
  { re: /petr[óo]leo|combust[íi]vel|gasolina|energia/i, qs: ['oil gas fuel station', 'highway truck traffic', 'power lines energy', 'driver car dashboard'] },
  { re: /tarifa|com[ée]rcio|exporta|importa|navio/i, qs: ['cargo shipping port container', 'warehouse logistics worker', 'factory production line', 'crane loading dock'] },
  { re: /infla[çc][ãa]o|pre[çc]o|supermercado|compras/i, qs: ['grocery shopping supermarket', 'price tag shelf', 'family kitchen cooking', 'street market vendor'] },
  { re: /juros|selic|banco central|banco/i, qs: ['bank finance city building', 'person using atm', 'government building columns', 'calculator desk paperwork'] },
  { re: /aposentad|previd[êe]ncia|poupan/i, qs: ['saving money piggy bank', 'elderly couple walking', 'retirement home garden', 'hands holding documents'] },
  { re: /cart[ãa]o|d[íi]vida|cr[ée]dito|financ/i, qs: ['credit card payment money', 'worried person bills', 'online shopping laptop', 'contactless payment store'] },
  { re: /im[óo]vel|aluguel|casa|apartamento/i, qs: ['real estate city apartment', 'house keys handover', 'construction site building', 'family moving boxes'] },
  { re: /tecnologia|intelig[êe]ncia|ia\b|startup|cripto|bitcoin/i, qs: ['technology data server', 'developer coding screen', 'smartphone app hands', 'modern office startup'] },
  { re: /emprego|desemprego|sal[áa]rio|trabalh/i, qs: ['office workers walking', 'job interview handshake', 'factory worker machine', 'commuters subway crowd'] },
  { re: /pol[íi]tica|elei[çc]|governo|congresso|stf/i, qs: ['government building columns', 'press conference microphones', 'crowd city street protest', 'official documents signing'] },
];

// Registros visuais genéricos de reforço: entram quando o tema não rende
// clipes distintos suficientes, mantendo o nicho sem repetir gráfico/dinheiro.
const FALLBACK_QUERIES = [
  'business people office city',
  'person reading newspaper',
  'city traffic time lapse',
  'hands using smartphone',
  'economy graph data screen',
  'crowd walking street brazil',
];

function pickQueries(draft) {
  const hay = [draft.theme, draft.title, ...(draft.tags || []), ...(draft.captionKeywords || [])].join(' ');
  const hits = QUERY_MAP.filter((m) => m.re.test(hay)).flatMap((m) => m.qs);
  // Temas achados primeiro, genéricos depois, sem duplicar.
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

  // Busca em paralelo os primeiros termos (um por clipe desejado, com folga),
  // e depois distribui em ROUND-ROBIN: 1 clipe de cada busca por rodada. Antes o
  // laço esgotava o primeiro termo e os 6 clipes vinham todos do mesmo visual.
  const usadas = queries.slice(0, Math.max(want, 4));
  const resultados = await Promise.all(
    usadas.map(async (q) => {
      try {
        return { q, vids: shuffle(await searchPexels(key, q)) };
      } catch (e) {
        warn(`Busca de b-roll "${q}" falhou: ${e.message}`);
        return { q, vids: [] };
      }
    })
  );

  for (let rodada = 0; chosen.length < want; rodada++) {
    let achouAlgo = false;
    for (const { q, vids } of resultados) {
      if (chosen.length >= want) break;
      const v = vids[rodada];
      if (!v || seen.has(v.id)) continue;
      seen.add(v.id);
      chosen.push({ video: v, q });
      achouAlgo = true;
    }
    if (!achouAlgo) break; // acabaram os resultados de todas as buscas
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

// Registro de fontes. Cada tipo de fonte tem um adaptador; para adicionar uma
// nova (API, scraping, etc.) basta registrar aqui e referenciar em config.json.
import { fetchRss } from './rss.js';
import { fetchBible } from './bible.js';
import { log } from '../util.js';

const ADAPTERS = {
  rss: fetchRss,
  // Catálogo fixo de passagens bíblicas; devolve itens no mesmo formato do RSS.
  bible: fetchBible,
  // Futuro: 'newsapi': fetchNewsApi, 'gnews': fetchGNews, 'scrape': fetchScrape
};

// Busca em todas as fontes habilitadas e devolve os itens INTERCALADOS.
//
// Por que intercalar: o prompt só recebe as primeiras manchetes da lista (8 hoje).
// Concatenando as fontes em ordem, a primeira fonte preenchia todas as vagas e as
// outras nunca chegavam ao prompt — 40 de 40 shorts do canal financeiro saíram do
// InfoMoney, e os outros quatro feeds nunca foram usados nem uma vez.
//
// Round-robin: 1 item da fonte A, 1 da B, 1 da C, e assim por diante. Assim o
// recorte do prompt representa todas as fontes, e adicionar um feed novo de fato
// muda o que a IA vê.
export async function collectItems(sources = []) {
  const enabled = sources.filter((s) => s.enabled !== false);
  const results = await Promise.all(
    enabled.map(async (s) => {
      const adapter = ADAPTERS[s.type];
      if (!adapter) {
        log(`Tipo de fonte desconhecido: ${s.type} (${s.id}) — ignorada`);
        return [];
      }
      const items = await adapter(s);
      log(`Fonte ${s.id}: ${items.length} itens`);
      return items;
    })
  );

  const intercalado = [];
  const maior = Math.max(0, ...results.map((r) => r.length));
  for (let i = 0; i < maior; i++) {
    for (const lista of results) {
      if (lista[i]) intercalado.push(lista[i]);
    }
  }
  return intercalado;
}

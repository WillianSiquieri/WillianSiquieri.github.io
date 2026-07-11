// Registro de fontes. Cada tipo de fonte tem um adaptador; para adicionar uma
// nova (API, scraping, etc.) basta registrar aqui e referenciar em config.json.
import { fetchRss } from './rss.js';
import { log } from '../util.js';

const ADAPTERS = {
  rss: fetchRss,
  // Futuro: 'newsapi': fetchNewsApi, 'gnews': fetchGNews, 'scrape': fetchScrape
};

// Busca em todas as fontes habilitadas e devolve os itens agregados.
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
  return results.flat();
}

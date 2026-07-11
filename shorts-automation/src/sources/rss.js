// Adaptador de fonte RSS/Atom. Busca o feed, normaliza os itens e devolve
// uma lista de { title, summary, link, published, sourceId }.
import { XMLParser } from 'fast-xml-parser';
import { stripHtml, truncate, warn } from '../util.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function asArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export async function fetchRss(source) {
  const items = [];
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'shorts-automation/0.1 (+https://github.com)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      warn(`Fonte ${source.id}: HTTP ${res.status}`);
      return items;
    }
    const xml = await res.text();
    const doc = parser.parse(xml);

    // RSS 2.0: rss.channel.item ; Atom: feed.entry
    const rssItems = asArray(doc?.rss?.channel?.item);
    const atomItems = asArray(doc?.feed?.entry);

    for (const it of rssItems) {
      items.push({
        sourceId: source.id,
        sourceLabel: source.label || source.id,
        title: stripHtml(it.title || ''),
        summary: truncate(stripHtml(it.description || it['content:encoded'] || ''), 400),
        link: typeof it.link === 'string' ? it.link : it.link?.['@_href'] || '',
        published: it.pubDate || it['dc:date'] || '',
      });
    }
    for (const it of atomItems) {
      const link = asArray(it.link).find((l) => l['@_rel'] !== 'self') || asArray(it.link)[0];
      items.push({
        sourceId: source.id,
        sourceLabel: source.label || source.id,
        title: stripHtml(it.title?.['#text'] || it.title || ''),
        summary: truncate(stripHtml(it.summary || it.content?.['#text'] || it.content || ''), 400),
        link: link?.['@_href'] || link || '',
        published: it.updated || it.published || '',
      });
    }
  } catch (err) {
    warn(`Fonte ${source.id} falhou:`, err.message);
  }
  return items;
}

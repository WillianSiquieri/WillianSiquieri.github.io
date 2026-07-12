// Ciclo de geração (roda periodicamente via GitHub Actions, ou manualmente).
//
// Passos:
//   1. Respeita o modo (paused | approval | auto).
//   2. Busca as fotos de roupa recebidas no WhatsApp das fornecedoras cadastradas.
//   3. Remove mensagens já processadas (dedupe por messageId).
//   4. Para cada peça nova (até postsPerDay):
//        - baixa as imagens para data/media/ (versionadas → URL pública no Pages)
//        - extrai o preço da fornecedora e aplica o spread configurável
//        - gera título/descrição/legenda com IA (guiada por preferências + feedback)
//        - monta a legenda final com o preço e a chamada para venda
//   5. Em modo 'approval': salva como rascunho aguardando aprovação no painel.
//      Em modo 'auto': marca como 'approved' para o publish.js postar no Instagram
//      (já com as imagens hospedadas após o commit).
//   6. Grava tudo em data/queue.json.
import * as store from './state/store.js';
import { collectMessages } from './whatsapp/fetch.js';
import { downloadImages } from './media.js';
import { generatePost } from './ai/generate.js';
import { parsePrice, applySpread } from './pricing.js';
import { buildCaption } from './caption.js';
import { log, warn, makeId, argFlag } from './util.js';

function usedMessageIds(queue, published) {
  const ids = new Set();
  for (const d of [...queue, ...published]) {
    if (d.source?.messageId) ids.add(d.source.messageId);
  }
  return ids;
}

// Combina preferências salvas + feedback recente numa orientação única para a IA.
function effectivePreferences(settings, feedback) {
  const p = settings.preferences || {};
  const recent = feedback.slice(-15).map((f) => `- ${f.text}`).join('\n');
  return {
    ...p,
    guidance: [p.guidance, recent && `Feedback recente do usuário:\n${recent}`].filter(Boolean).join('\n\n'),
  };
}

async function main() {
  const [config, settings, queue, published, feedback] = await Promise.all([
    store.config(), store.settings(), store.queue(), store.published(), store.feedback(),
  ]);

  if (settings.mode === 'paused' && !argFlag('force')) {
    log('Modo pausado — nada a gerar. (use --force para ignorar)');
    return;
  }

  const mock = Boolean(argFlag('mock'));
  if (mock) process.env.WHATSAPP_PROVIDER = 'mock';

  const count = Number(argFlag('count', settings.postsPerDay || 3));
  const messages = await collectMessages(config.whatsapp || {}, { count: count * 3 });
  const used = usedMessageIds(queue, published);
  const fresh = messages.filter((m) => !used.has(m.messageId)).slice(0, count);
  log(`${messages.length} mensagens elegíveis, ${fresh.length} novas a processar.`);

  const pricing = settings.pricing || { spreadPercent: 30, rounding: 'psychological' };
  const prefs = effectivePreferences(settings, feedback);
  const now = new Date().toISOString();
  const newEntries = [];

  for (const m of fresh) {
    const id = makeId();

    // 1. Baixa as imagens (para hospedar publicamente e permitir visão da IA).
    const localImages = await downloadImages(m.images, id);
    if (!localImages.length) {
      warn(`Sem imagens válidas em ${m.messageId} — pulando.`);
      continue;
    }
    m.localImages = localImages;

    // 2. Preço: base da fornecedora + spread.
    const basePrice = parsePrice(m.caption);
    const price = basePrice != null ? applySpread(basePrice, pricing.spreadPercent, pricing.rounding) : null;

    // 3. Conteúdo com IA.
    const post = await generatePost({
      item: m,
      preferences: prefs,
      storeName: config.storeName,
      niche: config.niche,
      llm: config.llm,
    });

    const size = post.size || '';
    const caption = buildCaption({
      post,
      price: price ?? 0,
      size,
      contact: config.contact,
      hashtags: post.hashtags,
    });

    const entry = {
      id,
      status: settings.mode === 'auto' ? 'approved' : 'draft',
      createdAt: now,
      vendor: { number: m.from, name: m.vendorName || m.senderName || '' },
      source: { messageId: m.messageId, receivedAt: m.receivedAt || null, caption: m.caption },
      images: localImages,
      basePrice,
      spreadPercent: pricing.spreadPercent,
      rounding: pricing.rounding,
      price,
      product: {
        title: post.title,
        description: post.description,
        category: post.category,
        size,
        color: post.color,
      },
      caption,
      hashtags: post.hashtags,
      rationale: post.rationale,
      instagram: { published: false },
    };
    newEntries.push(entry);
    log(`Rascunho criado: "${post.title}" — base ${basePrice ?? '?'} → final ${price ?? '?'} (${entry.status}).`);
  }

  await store.saveQueue([...queue, ...newEntries]);
  const autoCount = newEntries.filter((e) => e.status === 'approved').length;
  log(`Ciclo concluído: ${newEntries.length} novos posts (${autoCount} auto-aprovados aguardando publicação).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Ciclo de geração (roda 1x/dia via GitHub Actions, ou manualmente).
//
// Passos:
//   1. Respeita o modo (paused | approval | auto).
//   2. Atualiza analytics dos vídeos já publicados (best-effort).
//   3. Coleta manchetes das fontes habilitadas.
//   4. Remove temas já usados.
//   5. Gera N drafts com IA, guiada por preferências + top performers.
//   6. Monta o vídeo de cada draft (se ffmpeg disponível).
//   7. Em modo 'approval': faz upload como NÃO LISTADO (preview) e deixa para aprovar.
//      Em modo 'auto': marca para publicação pública imediata.
//   8. Grava tudo em data/queue.json.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from './state/store.js';
import { collectItems } from './sources/index.js';
import { generateShorts } from './ai/generate.js';
import { assembleVideo } from './video/assemble.js';
import { uploadShort, youtubeReady } from './youtube/upload.js';
import { refreshAnalytics, topPerformers } from './youtube/analytics.js';
import { log, warn, makeId, argFlag } from './util.js';

function usedKeys(queue, published) {
  const keys = new Set();
  for (const d of [...queue, ...published]) {
    if (d.sourceLink) keys.add(d.sourceLink);
    if (d.theme) keys.add(d.theme.toLowerCase());
  }
  return keys;
}

// Deriva as preferências efetivas combinando settings + feedback recente.
function effectivePreferences(settings, feedback) {
  const p = settings.preferences || {};
  const recent = feedback
    .slice(-15)
    .map((f) => `- ${f.text}`)
    .join('\n');
  return {
    ...p,
    guidance: [p.guidance, recent && `Feedback recente do usuário:\n${recent}`].filter(Boolean).join('\n\n'),
  };
}

async function main() {
  const [config, settings, queue, published, feedback] = await Promise.all([
    store.config(),
    store.settings(),
    store.queue(),
    store.published(),
    store.feedback(),
  ]);

  if (settings.mode === 'paused' && !argFlag('force')) {
    log('Modo pausado — nada a gerar. (use --force para ignorar)');
    return;
  }

  // Analytics primeiro, para orientar a geração.
  try {
    await refreshAnalytics();
  } catch (e) {
    warn('Analytics falhou:', e.message);
  }
  const performers = await topPerformers(5);

  // Coleta e deduplicação.
  const items = await collectItems(config.sources || []);
  const used = usedKeys(queue, published);
  const fresh = items.filter((it) => it.link && !used.has(it.link));
  log(`${items.length} itens coletados, ${fresh.length} inéditos.`);

  const count = Number(argFlag('count', settings.shortsPerDay || 2));
  const drafts = await generateShorts({
    items: fresh,
    preferences: effectivePreferences(settings, feedback),
    topPerformers: performers,
    count,
    niche: config.niche,
    model: config.llm?.model,
  });
  log(`${drafts.length} drafts gerados.`);

  const workDir = await mkdtemp(join(tmpdir(), 'shorts-'));
  const mock = Boolean(argFlag('mock'));
  const now = new Date().toISOString();
  const newEntries = [];

  for (const d of drafts) {
    const id = makeId();
    const entry = {
      id,
      status: 'draft',
      createdAt: now,
      theme: d.theme,
      title: d.title,
      hook: d.hook,
      script: d.script,
      tags: d.tags || [],
      captionKeywords: d.captionKeywords || [],
      sourceLink: d.sourceLink,
      rationale: d.rationale,
      video: { rendered: false },
    };

    if (!mock) {
      const asm = await assembleVideo(entry, { config, workDir });
      entry.video = { rendered: asm.rendered, durationSec: asm.durationSec, ttsProvider: asm.ttsProvider };

      // Upload de preview (não listado) quando há vídeo e credenciais.
      if (asm.rendered && youtubeReady()) {
        try {
          const privacy = settings.mode === 'auto' ? 'public' : 'unlisted';
          const up = await uploadShort(entry, asm.videoPath, { privacyStatus: privacy });
          if (up) {
            entry.youtubeId = up.youtubeId;
            entry.previewUrl = up.url;
            entry.privacyStatus = privacy;
            if (settings.mode === 'auto') {
              entry.status = 'published';
              entry.publishedAt = now;
            }
          }
        } catch (e) {
          warn(`Upload de preview falhou (${id}):`, e.message);
        }
      }
    }
    newEntries.push(entry);
  }

  // Vídeos publicados automaticamente migram para published.json.
  const publishedNow = newEntries.filter((e) => e.status === 'published');
  const stillDraft = newEntries.filter((e) => e.status !== 'published');

  await store.saveQueue([...queue, ...stillDraft]);
  if (publishedNow.length) {
    await store.savePublished([...published, ...publishedNow.map((e) => ({ ...e, views: 0, likes: 0, comments: 0, score: 0 }))]);
  }

  log(`Ciclo concluído: ${stillDraft.length} em fila, ${publishedNow.length} publicados automaticamente.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

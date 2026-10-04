// Camada de IA: recebe itens de notícias + preferências do usuário + vídeos que
// performaram melhor, e devolve N "drafts" de shorts (tema + roteiro + metadados).
//
// Usa a Claude API se ANTHROPIC_API_KEY estiver presente; caso contrário cai num
// gerador mock determinístico, para o pipeline rodar ponta-a-ponta sem segredos.
import { log, warn, truncate } from '../util.js';

const SYSTEM = `Você é um roteirista especialista em YouTube Shorts sobre atualidades.
Seu trabalho: a partir de manchetes reais, escolher os temas com maior potencial de
engajamento e escrever roteiros curtos (30–50s de narração), em português do Brasil.

Regras do roteiro:
- Gancho forte nos primeiros 3 segundos.
- Linguagem clara, ritmo rápido, frases curtas (feitas para narração/TTS).
- Informar com precisão; nada de sensacionalismo ou desinformação.
- Encerrar com uma pergunta ou chamada para engajamento.
- Respeitar as preferências e o feedback do usuário fornecidos.`;

// Monta o schema de saída estruturada que a Claude deve preencher.
function outputToolSchema(count) {
  return {
    name: 'entregar_shorts',
    description: `Entrega exatamente ${count} ideias de shorts prontas para produção.`,
    input_schema: {
      type: 'object',
      properties: {
        shorts: {
          type: 'array',
          minItems: count,
          maxItems: count,
          items: {
            type: 'object',
            properties: {
              theme: { type: 'string', description: 'Tema central em poucas palavras.' },
              title: { type: 'string', description: 'Título do YouTube (<= 90 chars), com apelo.' },
              hook: { type: 'string', description: 'Primeira frase, o gancho.' },
              script: { type: 'string', description: 'Roteiro completo da narração, 30–50s.' },
              captionKeywords: { type: 'array', items: { type: 'string' }, description: '4–8 termos p/ legenda em tela.' },
              tags: { type: 'array', items: { type: 'string' } },
              sourceLink: { type: 'string' },
              rationale: { type: 'string', description: 'Por que esse tema tende a performar.' },
            },
            required: ['theme', 'title', 'hook', 'script', 'tags', 'sourceLink'],
          },
        },
      },
      required: ['shorts'],
    },
  };
}

// O free tier da Groq limita ~8k tokens por minuto, então o prompt precisa ser
// enxuto. `size` permite encolher ainda mais caso a API responda 413.
function buildUserPrompt({ items, preferences, topPerformers, count, niche }, size = {}) {
  const maxItems = size.maxItems ?? 15;
  const summaryLen = size.summaryLen ?? 90;
  const headlines = items
    .slice(0, maxItems)
    .map((it, i) => {
      const resumo = summaryLen > 0 ? ` — ${truncate(it.summary, summaryLen)}` : '';
      return `${i + 1}. [${it.sourceLabel}] ${it.title}${resumo} (${it.link})`;
    })
    .join('\n');

  const liked = (preferences?.likedThemes || []).join(', ') || '(nenhum ainda)';
  const disliked = (preferences?.dislikedThemes || []).join(', ') || '(nenhum ainda)';
  const guidance = preferences?.guidance || '(sem orientação específica)';

  const performers = (topPerformers || [])
    .slice(0, 5)
    .map((p) => `- "${p.title}" → ${p.views ?? 0} views, ${p.likes ?? 0} likes (tema: ${p.theme || '?'})`)
    .join('\n') || '(sem histórico de performance ainda)';

  return `NICHO DO CANAL: ${niche}

MANCHETES ATUAIS DISPONÍVEIS:
${headlines}

ORIENTAÇÃO/ESTILO DO USUÁRIO:
${guidance}

TEMAS QUE O USUÁRIO GOSTA: ${liked}
TEMAS QUE O USUÁRIO NÃO QUER: ${disliked}

VÍDEOS QUE MAIS PERFORMARAM (priorize temas/formatos parecidos):
${performers}

Selecione os ${count} melhores temas dentre as manchetes acima (evite os temas indesejados)
e entregue os shorts via a ferramenta 'entregar_shorts'.`;
}

async function generateWithClaude({ items, preferences, topPerformers, count, niche, llm }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tool = outputToolSchema(count);

  const resp = await client.messages.create({
    model: llm?.anthropicModel || llm?.model || 'claude-opus-4-8',
    max_tokens: 4000,
    system: SYSTEM,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: buildUserPrompt({ items, preferences, topPerformers, count, niche }) }],
  });

  const block = resp.content.find((b) => b.type === 'tool_use');
  if (!block) throw new Error('Claude não retornou tool_use');
  return block.input.shorts;
}

// Schema de saída para o Gemini (tipos em MAIÚSCULAS, subconjunto OpenAPI).
function geminiSchema() {
  const S = { type: 'STRING' };
  return {
    type: 'OBJECT',
    properties: {
      shorts: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            theme: S, title: S, hook: S, script: S,
            captionKeywords: { type: 'ARRAY', items: S },
            tags: { type: 'ARRAY', items: S },
            sourceLink: S, rationale: S,
          },
          required: ['theme', 'title', 'hook', 'script', 'tags', 'sourceLink'],
        },
      },
    },
    required: ['shorts'],
  };
}

const GEMINI_DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Uma chamada a um modelo específico do Gemini.
async function callGemini(model, { items, preferences, topPerformers, count, niche }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt({ items, preferences, topPerformers, count, niche }) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: geminiSchema(), temperature: 0.9, maxOutputTokens: 4096 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new Error('resposta vazia');
  return (JSON.parse(text).shorts || []).slice(0, count);
}

// Cada modelo do free tier tem cota diária própria; se um estourar (429),
// tentamos o próximo. Também 1 retry curto para limite por minuto.
async function generateWithGemini(opts) {
  const { llm } = opts;
  const models = llm?.geminiModels?.length
    ? llm.geminiModels
    : llm?.geminiModel
      ? [llm.geminiModel]
      : GEMINI_DEFAULT_MODELS;

  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const shorts = await callGemini(model, opts);
        log(`Gemini OK com modelo ${model}`);
        return shorts;
      } catch (e) {
        lastErr = e;
        if (e.status === 429 && attempt === 0) {
          await sleep(4000); // pode ser limite por minuto — tenta uma vez mais
          continue;
        }
        warn(`Gemini modelo ${model} falhou (${e.message}); tentando próximo…`);
        break;
      }
    }
  }
  throw lastErr || new Error('Gemini indisponível em todos os modelos');
}

// Groq (free tier): endpoint compatível com OpenAI, hospeda Llama 3.3 70B.
// Alternativa confiável quando o free tier do Gemini não tem quota.
// A Groq descontinua modelos com frequência (um modelo fixo quebrou silenciosamente
// por 2 meses). Por isso consultamos /models e escolhemos o melhor disponível.
let groqModelCache = null;

// Modelos que NÃO servem para gerar texto (áudio, imagem, moderação...).
const GROQ_NOT_TEXT = /whisper|tts|speech|audio|orpheus|playai|guard|embed|moderation|rerank|vision|ocr|image|diffus/i;
// Famílias conhecidas de modelos de texto — preferidas na escolha.
const GROQ_TEXT_FAMILY = /llama|gpt-oss|qwen|kimi|mixtral|mistral|gemma|deepseek|compound/i;

async function groqAvailableModels() {
  if (groqModelCache) return groqModelCache;
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Groq /models HTTP ${res.status}`);
  const data = await res.json();
  const ids = (data.data || []).map((m) => m.id).filter((id) => id && !GROQ_NOT_TEXT.test(id));
  // Se houver modelos de família conhecida, usa só eles: evita cair num modelo
  // de áudio/experimental que aceita a chamada mas não gera roteiro.
  const known = ids.filter((id) => GROQ_TEXT_FAMILY.test(id));
  groqModelCache = known.length ? known : ids;
  return groqModelCache;
}

// Ordena por adequação a roteiro: preferidos primeiro, depois modelos grandes.
function rankGroqModels(ids, preferred = []) {
  const score = (id) => {
    const i = preferred.indexOf(id);
    if (i !== -1) return 1000 - i;
    let s = 0;
    if (/versatile/i.test(id)) s += 50;
    if (/70b|120b|k2|maverick|large/i.test(id)) s += 40;
    if (/instruct/i.test(id)) s += 20;
    if (/instant|8b|mini|small|preview/i.test(id)) s -= 25;
    return s;
  };
  return [...ids].sort((a, b) => score(b) - score(a));
}

async function groqComplete(model, opts, size) {
  const { count } = opts;
  const sys =
    SYSTEM +
    `\n\nResponda APENAS com um objeto JSON no formato ` +
    `{"shorts":[{"theme","title","hook","script","captionKeywords":[],"tags":[],"sourceLink","rationale"}]} ` +
    `contendo exatamente ${count} itens.`;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: buildUserPrompt(opts, size) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.9,
      // Alguns modelos limitam a saída a 1000 tokens/min (OTPM); fica abaixo disso.
      // Um roteiro de short tem ~200 palavras, então isso é de sobra.
      max_tokens: Math.min(900, 300 * Math.max(1, count) + 300),
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    const err = new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    // A Groq diz quanto esperar, no header ou no próprio texto ("try again in 12.5s").
    const header = Number(res.headers.get('retry-after'));
    const inBody = /try again in ([\d.]+)\s*(ms|s)/i.exec(body);
    err.retryAfter = Number.isFinite(header) && header > 0
      ? header
      : inBody
        ? Number(inBody[1]) / (inBody[2].toLowerCase() === 'ms' ? 1000 : 1)
        : 0;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('resposta vazia');
  return (JSON.parse(text).shorts || []).slice(0, count);
}

async function generateWithGroq(opts) {
  const { llm } = opts;
  const preferred = [llm?.groqModel, ...(llm?.groqModels || [])].filter(Boolean);

  // Lista real de modelos disponíveis na conta (à prova de descontinuação).
  let candidates = [];
  try {
    candidates = rankGroqModels(await groqAvailableModels(), preferred);
  } catch (e) {
    warn(`Não foi possível listar modelos da Groq (${e.message}); usando preferidos.`);
    candidates = preferred;
  }
  if (!candidates.length) throw new Error('nenhum modelo Groq disponível');

  // Prompt enxuto e fixo: ~2k tokens por chamada, longe do teto de 8k TPM do free tier.
  const SIZE = { maxItems: 8, summaryLen: 60 };

  // O free tier limita *tokens por minuto*, não por requisição. Uma rajada de
  // tentativas soma tudo no mesmo minuto e estoura a cota — então aqui vai
  // pouca tentativa e com espera de verdade entre elas.
  const MAX_MODELS = 2;
  const MAX_WAIT = 40; // segundos

  let lastErr;
  const models = candidates.slice(0, MAX_MODELS);
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const shorts = await groqComplete(model, opts, SIZE);
        log(`Groq OK com modelo ${model}`);
        return shorts;
      } catch (e) {
        lastErr = e;
        const rateLimited = e.status === 413 || e.status === 429;
        if (rateLimited && attempt === 1) {
          const wait = Math.min(Math.max(e.retryAfter || 20, 5), MAX_WAIT);
          warn(`Groq ${model}: limite por minuto atingido; aguardando ${Math.round(wait)}s…`);
          await sleep(wait * 1000);
          continue; // mesma chamada, depois da cota renovar
        }
        warn(`Groq modelo ${model} falhou (${e.message})`);
        break;
      }
    }
    // Pausa antes de trocar de modelo: a cota de tokens/min é da conta, não do modelo.
    if (i < models.length - 1) await sleep(15000);
  }
  throw lastErr || new Error('Groq indisponível');
}

// Fallback sem IA: transforma manchetes diretamente em drafts simples.
function generateMock({ items, count }) {
  const picked = items.slice(0, count);
  return picked.map((it) => ({
    theme: truncate(it.title, 60),
    title: truncate(it.title, 90),
    hook: `Você viu isso? ${truncate(it.title, 80)}`,
    script: `${it.title}. ${truncate(it.summary, 220)} Isso importa porque afeta o dia a dia de muita gente. O que você acha disso? Comente aqui embaixo!`,
    captionKeywords: it.title.split(/\s+/).filter((w) => w.length > 4).slice(0, 6),
    tags: ['atualidades', 'noticias', 'brasil', 'shorts'],
    sourceLink: it.link,
    rationale: '[mock] gerado sem IA — configure GEMINI_API_KEY para roteiros reais e gratuitos.',
  }));
}

// Escolhe o provedor de IA: config.llm.provider (ou 'auto') + chaves disponíveis.
// Groq vem primeiro no 'auto' por ser o free tier mais confiável.
function pickProvider(llm) {
  const p = llm?.provider || 'auto';
  if (p !== 'auto') return p;
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'mock';
}

const RUNNERS = { groq: generateWithGroq, gemini: generateWithGemini, anthropic: generateWithClaude };
const LABELS = { groq: 'Groq (grátis)', gemini: 'Gemini (grátis)', anthropic: 'Claude API' };

export async function generateShorts(opts) {
  const { items, llm } = opts;
  if (!items?.length) {
    warn('Nenhum item de notícia disponível — nada a gerar.');
    return [];
  }
  // Por padrão NÃO caímos no mock: publicar roteiro de template é pior que
  // não publicar nada (e mascara falhas silenciosas da IA por semanas).
  const allowMock = llm?.allowMockFallback === true;
  const tag = (drafts, aiProvider) => drafts.map((d) => ({ ...d, aiProvider }));

  const provider = pickProvider(llm);
  if (RUNNERS[provider]) {
    try {
      log(`Gerando shorts com ${LABELS[provider]}…`);
      return tag(await RUNNERS[provider](opts), provider);
    } catch (err) {
      warn(`FALHA no provedor "${provider}": ${err.message}`);
      if (!allowMock) {
        warn('Gerador mock desabilitado (llm.allowMockFallback=false) — nenhum short será gerado neste ciclo.');
        return [];
      }
      warn('Usando fallback mock (qualidade baixa).');
      return tag(generateMock(opts), 'mock');
    }
  }
  if (!allowMock) {
    warn('Sem chave de IA (GROQ/GEMINI/ANTHROPIC) — nenhum short será gerado. Configure uma chave.');
    return [];
  }
  log('Sem chave de IA — usando gerador mock.');
  return tag(generateMock(opts), 'mock');
}

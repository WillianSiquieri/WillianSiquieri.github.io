// Camada de IA: para cada peça recebida (legenda da fornecedora + imagem),
// devolve os campos descritivos e a legenda pronta do Instagram — SEM o preço,
// que é calculado de forma determinística (pricing.js) e injetado depois.
//
// Provedores (mesma pilha grátis do shorts): Groq -> Gemini -> Claude -> mock.
// O Gemini, quando há imagem local, também "olha" a foto para descrever melhor a peça.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, log, warn, truncate } from '../util.js';

const SYSTEM = `Você é um redator de e-commerce de moda que escreve posts de venda para o Instagram, em português do Brasil.
A partir da mensagem de uma fornecedora (e, quando disponível, a foto da peça), você:
- Descreve a roupa de forma atraente e honesta (tipo de peça, cor, tecido/caimento quando der para inferir).
- Escreve uma legenda curta e vendedora (2 a 4 linhas), com emojis com moderação.
- NÃO inclui o preço na legenda (o preço é adicionado pelo sistema depois).
- Sugere de 4 a 8 hashtags de moda/venda em português (sem o #, só as palavras).
- Respeita as preferências e o feedback do usuário.`;

const FIELDS_DESC = {
  title: 'Nome curto da peça (ex.: "Vestido midi floral").',
  description: 'Descrição atraente da peça em 1–2 frases.',
  category: 'Categoria (ex.: vestido, blusa, calça, conjunto, jaqueta).',
  size: 'Tamanho, se informado na mensagem (ex.: "M", "38", "único"); senão vazio.',
  color: 'Cor predominante, se der para saber; senão vazio.',
  captionBody: 'Legenda do post SEM o preço e SEM as hashtags (o sistema adiciona).',
  hashtags: 'Lista de 4–8 hashtags (só as palavras, sem #).',
  rationale: 'Curta justificativa do apelo de venda da peça.',
};

function buildUserPrompt({ item, preferences, storeName, niche }) {
  const guidance = preferences?.guidance || '(sem orientação específica)';
  const liked = (preferences?.likedThemes || []).join(', ') || '(nenhum ainda)';
  const disliked = (preferences?.dislikedThemes || []).join(', ') || '(nenhum ainda)';
  return `LOJA: ${storeName || ''}
NICHO: ${niche || 'moda / revenda de roupas'}

MENSAGEM DA FORNECEDORA (${item.vendorName || item.from}):
"${item.caption || '(sem texto — descreva a peça pela foto)'}"

ORIENTAÇÃO/ESTILO DO USUÁRIO:
${guidance}

ESTILOS QUE O USUÁRIO GOSTA: ${liked}
ESTILOS QUE O USUÁRIO NÃO QUER: ${disliked}

Gere o conteúdo do post para esta peça. Lembre: NÃO inclua preço na legenda.`;
}

/* ---------- Claude ---------- */
function claudeToolSchema() {
  const S = (description) => ({ type: 'string', description });
  return {
    name: 'entregar_post',
    description: 'Entrega o conteúdo de um post de roupa para o Instagram.',
    input_schema: {
      type: 'object',
      properties: {
        title: S(FIELDS_DESC.title),
        description: S(FIELDS_DESC.description),
        category: S(FIELDS_DESC.category),
        size: S(FIELDS_DESC.size),
        color: S(FIELDS_DESC.color),
        captionBody: S(FIELDS_DESC.captionBody),
        hashtags: { type: 'array', items: { type: 'string' }, description: FIELDS_DESC.hashtags },
        rationale: S(FIELDS_DESC.rationale),
      },
      required: ['title', 'description', 'captionBody', 'hashtags'],
    },
  };
}

async function generateWithClaude(opts) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tool = claudeToolSchema();
  const resp = await client.messages.create({
    model: opts.llm?.anthropicModel || 'claude-opus-4-8',
    max_tokens: 1200,
    system: SYSTEM,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: buildUserPrompt(opts) }],
  });
  const block = resp.content.find((b) => b.type === 'tool_use');
  if (!block) throw new Error('Claude não retornou tool_use');
  return block.input;
}

/* ---------- Gemini (com visão quando há imagem local) ---------- */
function geminiSchema() {
  const S = { type: 'STRING' };
  return {
    type: 'OBJECT',
    properties: {
      title: S, description: S, category: S, size: S, color: S, captionBody: S,
      hashtags: { type: 'ARRAY', items: S },
      rationale: S,
    },
    required: ['title', 'description', 'captionBody', 'hashtags'],
  };
}

const GEMINI_DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function imagePart(rel) {
  try {
    const buf = await readFile(join(ROOT, rel));
    const ext = rel.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { inline_data: { mime_type: mime, data: buf.toString('base64') } };
  } catch {
    return null;
  }
}

async function callGemini(model, opts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const parts = [{ text: buildUserPrompt(opts) }];
  const firstImage = opts.item.localImages?.[0];
  if (firstImage) {
    const p = await imagePart(firstImage);
    if (p) parts.push(p);
  }
  const body = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: geminiSchema(), temperature: 0.8, maxOutputTokens: 1200 },
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
  return JSON.parse(text);
}

async function generateWithGemini(opts) {
  const models = opts.llm?.geminiModels?.length
    ? opts.llm.geminiModels
    : opts.llm?.geminiModel
      ? [opts.llm.geminiModel]
      : GEMINI_DEFAULT_MODELS;
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await callGemini(model, opts);
        log(`Gemini OK com modelo ${model}`);
        return out;
      } catch (e) {
        lastErr = e;
        if (e.status === 429 && attempt === 0) { await sleep(4000); continue; }
        warn(`Gemini modelo ${model} falhou (${e.message}); tentando próximo…`);
        break;
      }
    }
  }
  throw lastErr || new Error('Gemini indisponível');
}

/* ---------- Groq ---------- */
async function generateWithGroq(opts) {
  const model = opts.llm?.groqModel || 'llama-3.3-70b-versatile';
  const sys =
    SYSTEM +
    `\n\nResponda APENAS com um objeto JSON no formato ` +
    `{"title","description","category","size","color","captionBody","hashtags":[],"rationale"}.`;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: buildUserPrompt(opts) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Groq retornou vazio');
  return JSON.parse(text);
}

/* ---------- Mock ---------- */
function generateMock({ item }) {
  const caption = (item.caption || '').replace(/r\$\s*[\d.,]+/gi, '').trim();
  const title = truncate(caption || 'Peça nova', 40);
  return {
    title,
    description: caption || 'Peça linda que acabou de chegar.',
    category: '',
    size: (item.caption.match(/tam\w*\.?\s*([\w/]+)/i) || [])[1] || '',
    color: '',
    captionBody: `✨ ${title} ✨\nAcabou de chegar e é perfeita pra compor vários looks. Poucas unidades!`,
    hashtags: ['moda', 'lookdodia', 'novidades', 'modafeminina', 'vendas'],
    rationale: '[mock] gerado sem IA — configure GROQ/GEMINI/ANTHROPIC para legendas reais.',
  };
}

function pickProvider(llm) {
  const p = llm?.provider || 'auto';
  if (p !== 'auto') return p;
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'mock';
}

const RUNNERS = { groq: generateWithGroq, gemini: generateWithGemini, anthropic: generateWithClaude };
const LABELS = { groq: 'Groq (grátis)', gemini: 'Gemini (grátis, com visão)', anthropic: 'Claude API' };

// Gera o conteúdo de UM post. Sempre resolve (cai no mock em caso de erro).
export async function generatePost(opts) {
  const provider = pickProvider(opts.llm);
  if (RUNNERS[provider]) {
    try {
      log(`Gerando post com ${LABELS[provider]}…`);
      const out = await RUNNERS[provider](opts);
      return normalize(out, opts);
    } catch (err) {
      warn(`Falha no provedor "${provider}", usando mock:`, err.message);
      return normalize(generateMock(opts), opts);
    }
  }
  log('Sem chave de IA — usando gerador mock.');
  return normalize(generateMock(opts), opts);
}

function normalize(out = {}, opts) {
  return {
    title: out.title || truncate(opts.item.caption || 'Peça', 40),
    description: out.description || '',
    category: out.category || '',
    size: out.size || '',
    color: out.color || '',
    captionBody: out.captionBody || out.description || '',
    hashtags: Array.isArray(out.hashtags) ? out.hashtags.map((h) => String(h).replace(/^#/, '')).slice(0, 12) : [],
    rationale: out.rationale || '',
  };
}

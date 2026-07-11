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

function buildUserPrompt({ items, preferences, topPerformers, count, niche }) {
  const headlines = items
    .slice(0, 40)
    .map((it, i) => `${i + 1}. [${it.sourceLabel}] ${it.title} — ${truncate(it.summary, 160)} (${it.link})`)
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

async function generateWithClaude({ items, preferences, topPerformers, count, niche, model }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tool = outputToolSchema(count);

  const resp = await client.messages.create({
    model: model || 'claude-opus-4-8',
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
    rationale: '[mock] gerado sem IA — configure ANTHROPIC_API_KEY para roteiros reais.',
  }));
}

export async function generateShorts(opts) {
  const { items } = opts;
  if (!items?.length) {
    warn('Nenhum item de notícia disponível — nada a gerar.');
    return [];
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      log('Gerando shorts com Claude API…');
      return await generateWithClaude(opts);
    } catch (err) {
      warn('Falha na Claude API, usando fallback mock:', err.message);
      return generateMock(opts);
    }
  }
  log('ANTHROPIC_API_KEY ausente — usando gerador mock.');
  return generateMock(opts);
}

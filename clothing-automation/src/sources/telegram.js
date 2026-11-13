// Fonte Telegram: lê as fotos que você encaminha do WhatsApp para o seu bot.
//
// Por que Telegram: o `getUpdates` da Bot API já é exatamente a "caixa de entrada
// com cursor" que este motor precisa — sem servidor, sem webhook, sem OAuth e sem
// mensalidade. Você compartilha a foto da fornecedora para o bot, escreve o preço
// na legenda, e o ciclo seguinte transforma isso em anúncio.
//
// Fluxo da API:
//   getUpdates(offset) -> mensagens novas   (offset = cursor, persistido em data/telegram.json)
//   getFile(file_id)   -> file_path         -> download em api.telegram.org/file/bot<token>/<path>
import { log, warn } from '../util.js';

// Base da API. Só muda em teste (stub local); em produção é sempre o Telegram.
const API = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';

export function telegramReady() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function token() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

async function call(method, params = {}) {
  const url = `${API}/bot${token()}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    // description vem da API; a URL nunca é logada (carrega o token).
    throw new Error(`Telegram ${method}: ${data.description || `HTTP ${res.status}`}`);
  }
  return data.result;
}

// URL de download de um arquivo. Contém o token — nunca registrar em log/estado.
async function fileUrl(fileId) {
  const f = await call('getFile', { file_id: fileId });
  return `${API}/file/bot${token()}/${f.file_path}`;
}

// Extrai o melhor anexo de imagem de uma mensagem (foto ou documento-imagem).
function imageFileId(msg) {
  if (Array.isArray(msg.photo) && msg.photo.length) {
    // photo vem em tamanhos crescentes; o último é o maior.
    return msg.photo[msg.photo.length - 1].file_id;
  }
  if (msg.document && /^image\//.test(msg.document.mime_type || '')) {
    return msg.document.file_id;
  }
  return null;
}

function chatName(msg) {
  const c = msg.chat || {};
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.title || c.username || String(c.id);
}

// Busca as mensagens novas. Devolve também o maior update_id visto, para o ciclo
// confirmar o cursor só DEPOIS de salvar a fila com sucesso (se o processo morrer
// no meio, as mensagens voltam no próximo ciclo em vez de se perderem).
export async function fetchMessages({ offset = 0, allowedChatIds = [], limit = 100 } = {}) {
  const updates = await call('getUpdates', {
    offset: offset || undefined,
    limit,
    timeout: 0,
    allowed_updates: ['message', 'channel_post'],
  });
  log(`Telegram: ${updates.length} updates novos.`);

  const allowed = new Set((allowedChatIds || []).map(String));
  let maxUpdateId = offset ? offset - 1 : 0;
  const seenChats = new Set();

  // Fotos enviadas juntas chegam como updates separados com o mesmo
  // media_group_id — viram UM anúncio com carrossel.
  const groups = new Map();

  for (const u of updates) {
    if (u.update_id > maxUpdateId) maxUpdateId = u.update_id;
    const msg = u.message || u.channel_post;
    if (!msg) continue;

    const chatId = String(msg.chat?.id ?? '');
    seenChats.add(chatId);
    if (allowed.size && !allowed.has(chatId)) {
      warn(`Telegram: mensagem de chat não autorizado (${chatId}) ignorada.`);
      continue;
    }

    const fileId = imageFileId(msg);
    if (!fileId) continue; // mensagem de texto puro: ignorada

    const key = msg.media_group_id ? `g:${msg.media_group_id}` : `m:${msg.message_id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.fileIds.push(fileId);
      // A legenda costuma vir só na primeira foto do grupo.
      if (!existing.caption && msg.caption) existing.caption = msg.caption;
    } else {
      groups.set(key, {
        messageId: `tg_${msg.media_group_id ? `g${msg.media_group_id}` : msg.message_id}`,
        from: chatId,
        senderName: chatName(msg),
        caption: msg.caption || '',
        fileIds: [fileId],
        receivedAt: new Date((msg.date || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      });
    }
  }

  if (!allowed.size && seenChats.size) {
    warn(
      `Telegram: SEM allowlist de chat configurada — aceitando qualquer remetente. ` +
        `Adicione em config.json → telegram.allowedChatIds: [${[...seenChats].join(', ')}]`,
    );
  }

  // Resolve as URLs de download (uma chamada getFile por imagem).
  const messages = [];
  for (const g of groups.values()) {
    const images = [];
    for (const fid of g.fileIds) {
      try {
        images.push(await fileUrl(fid));
      } catch (e) {
        warn(`Telegram: não foi possível obter arquivo (${e.message}).`);
      }
    }
    if (!images.length) continue;
    const { fileIds, ...rest } = g;
    messages.push({ ...rest, images });
  }

  log(`Telegram: ${messages.length} peças com foto prontas para anunciar.`);
  return { messages, maxUpdateId };
}

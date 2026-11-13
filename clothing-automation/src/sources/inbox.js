// Fonte genérica "inbox": um endpoint HTTP que devolve as mensagens recebidas em
// JSON. Serve para plugar qualquer provedor de WhatsApp (Cloud API, Z-API,
// Evolution API…) que acumule as mensagens em algum lugar acessível.
//
// Mantido como alternativa ao Telegram, que é o caminho padrão (sem infra).
import { makeId } from '../util.js';

export function inboxReady() {
  return Boolean(process.env.WHATSAPP_INBOX_URL);
}

export async function fetchMessages() {
  const url = process.env.WHATSAPP_INBOX_URL;
  const headers = { Accept: 'application/json' };
  if (process.env.WHATSAPP_INBOX_TOKEN) headers.Authorization = `Bearer ${process.env.WHATSAPP_INBOX_TOKEN}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000), cache: 'no-store' });
  if (!res.ok) throw new Error(`inbox HTTP ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.messages || data.items || data.data || [];
  return rows.map(normalizeRow).filter(Boolean);
}

// Tolerante a nomes de campos diferentes entre provedores.
function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;
  const from = row.from || row.phone || row.sender || row.number || row.chatId || row.author || '';
  const caption = row.caption || row.text || row.body || row.message || row.description || '';
  const images = collectImages(row);
  if (!images.length) return null; // sem imagem não vira post de roupa
  return {
    messageId: String(row.messageId || row.id || row.msgId || makeId('wa')),
    from: String(from),
    senderName: row.senderName || row.name || row.pushName || '',
    caption: String(caption),
    images,
    receivedAt: row.receivedAt || row.timestamp || row.date || null,
  };
}

function collectImages(row) {
  const out = [];
  const push = (u) => {
    if (typeof u === 'string' && /^https?:\/\//i.test(u)) out.push(u);
    else if (u && typeof u === 'object' && (u.url || u.link)) out.push(u.url || u.link);
  };
  if (Array.isArray(row.images)) row.images.forEach(push);
  if (Array.isArray(row.media)) row.media.forEach(push);
  if (Array.isArray(row.attachments)) row.attachments.forEach(push);
  push(row.imageUrl);
  push(row.image);
  push(row.mediaUrl);
  return [...new Set(out)];
}

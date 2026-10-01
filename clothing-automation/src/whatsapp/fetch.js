// Camada de entrada: busca as mensagens de roupa recebidas no WhatsApp das
// fornecedoras cadastradas e as normaliza para o pipeline.
//
// O WhatsApp não expõe um "puxe minhas mensagens" nativo para um cron; o padrão
// é um provedor (Cloud API oficial, Z-API, Evolution API, etc.) que recebe as
// mensagens por webhook e as acumula. Aqui abstraímos isso num provedor genérico
// "inbox": um endpoint HTTP que devolve as mensagens recebidas em JSON. Assim o
// motor funciona com QUALQUER provedor, bastando apontar a URL — e cai para um
// gerador mock quando não há nada configurado (pipeline roda ponta-a-ponta sem
// segredos).
import { log, warn, normalizePhone, makeId } from '../util.js';

// Formato normalizado devolvido ao ciclo:
//   { messageId, from, senderName, caption, images: [url...], receivedAt }

function pickProvider(cfg) {
  const p = (process.env.WHATSAPP_PROVIDER || cfg?.provider || 'auto').toLowerCase();
  if (p !== 'auto') return p;
  if (process.env.WHATSAPP_INBOX_URL) return 'inbox';
  return 'mock';
}

// Conjunto de números habilitados (só dígitos) para filtrar remetentes.
function enabledNumbers(vendors = []) {
  return new Map(
    vendors
      .filter((v) => v.enabled !== false)
      .map((v) => [normalizePhone(v.number), v.name || v.number]),
  );
}

// Provedor "inbox": GET num endpoint que devolve as mensagens recebidas.
// Aceita alguns formatos comuns e normaliza. Espera um array (ou {messages:[...]})
// de objetos com, no mínimo, um remetente e uma ou mais imagens.
async function fetchFromInbox() {
  const url = process.env.WHATSAPP_INBOX_URL;
  const headers = { Accept: 'application/json' };
  if (process.env.WHATSAPP_INBOX_TOKEN) headers.Authorization = `Bearer ${process.env.WHATSAPP_INBOX_TOKEN}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000), cache: 'no-store' });
  if (!res.ok) throw new Error(`inbox HTTP ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.messages || data.items || data.data || [];
  return rows.map(normalizeInboxRow).filter(Boolean);
}

// Tolerante a nomes de campos diferentes entre provedores.
function normalizeInboxRow(row) {
  if (!row || typeof row !== 'object') return null;
  const from =
    row.from || row.phone || row.sender || row.number || row.chatId || row.author || '';
  const caption =
    row.caption || row.text || row.body || row.message || row.description || '';
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

// Gerador mock: simula fornecedoras mandando fotos de roupa com preço.
// Usa imagens públicas de placeholder para o pipeline (download + Instagram) ter
// URLs reais para exercitar.
function fetchMock(vendors, count) {
  const enabled = [...enabledNumbers(vendors).entries()];
  const catalog = [
    { caption: 'Vestido midi floral, tecido viscose, tam M. R$ 79,90', seed: 'vestido' },
    { caption: 'Blusa cropped canelada branca, tam P/M. 49,90', seed: 'blusa' },
    { caption: 'Calça jeans wide leg, cintura alta, tam 40. R$ 119,90', seed: 'jeans' },
    { caption: 'Conjunto tricot bege (blusa + saia), único. R$ 139,90', seed: 'tricot' },
    { caption: 'Jaqueta jeans oversized, tam G. 149,90', seed: 'jaqueta' },
  ];
  const now = Date.now();
  return catalog.slice(0, count).map((c, i) => {
    const vendor = enabled[i % Math.max(enabled.length, 1)] || ['5511999990001', 'Fornecedora Demo'];
    return {
      messageId: `mock_${now}_${i}`,
      from: vendor[0],
      senderName: vendor[1],
      caption: c.caption,
      images: [placeholderImage(c.seed, i)],
      receivedAt: new Date(now - i * 60000).toISOString(),
    };
  });
}

// Placeholder autossuficiente (data URI SVG) — não depende de rede, serve só para
// exercitar o pipeline (download → painel) em modo mock.
function placeholderImage(seed, i) {
  const hues = [340, 210, 40, 160, 280];
  const h = hues[i % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
  <rect width="1080" height="1350" fill="hsl(${h},60%,88%)"/>
  <rect x="60" y="60" width="960" height="1230" rx="40" fill="hsl(${h},55%,78%)"/>
  <text x="540" y="700" font-family="sans-serif" font-size="90" font-weight="bold"
    fill="hsl(${h},45%,32%)" text-anchor="middle">${seed}</text>
  <text x="540" y="800" font-family="sans-serif" font-size="42"
    fill="hsl(${h},35%,42%)" text-anchor="middle">foto de exemplo</text>
</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// Busca e filtra as mensagens das fornecedoras cadastradas.
export async function collectMessages(whatsappCfg = {}, { count = 20 } = {}) {
  const provider = pickProvider(whatsappCfg);
  const vendors = whatsappCfg.vendors || [];
  const numbers = enabledNumbers(vendors);

  let raw = [];
  if (provider === 'inbox') {
    try {
      log('Buscando mensagens no inbox do WhatsApp…');
      raw = await fetchFromInbox();
    } catch (e) {
      warn('Inbox do WhatsApp falhou, usando mock:', e.message);
      raw = fetchMock(vendors, count);
    }
  } else {
    log('Sem provedor de WhatsApp configurado — usando mensagens mock.');
    raw = fetchMock(vendors, count);
  }

  // Anexa o nome do fornecedor a partir do cadastro e filtra remetentes não cadastrados
  // (quando há cadastro). Sem cadastro, aceita todos.
  const filtered = [];
  for (const m of raw) {
    const key = normalizePhone(m.from);
    if (numbers.size && !numbers.has(key)) continue;
    filtered.push({ ...m, vendorName: numbers.get(key) || m.senderName || m.from });
  }
  log(`${raw.length} mensagens recebidas, ${filtered.length} de fornecedoras cadastradas.`);
  return filtered.slice(0, count);
}

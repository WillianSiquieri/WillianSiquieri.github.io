// Orquestrador das fontes de entrada.
//
// Regra de ouro: fonte de verdade nunca é inventada. Sem fonte real configurada,
// o ciclo não gera nada — o mock só entra com a flag explícita `--mock`.
// (Ver src/sources/mock.js para o episódio que motivou essa regra.)
import { log, warn, normalizePhone } from '../util.js';
import * as telegram from './telegram.js';
import * as inbox from './inbox.js';
import * as mock from './mock.js';

// Escolhe a fonte: config/env explícitos, senão a primeira configurada de fato.
function pickSource(cfg, allowMock) {
  const explicit = (process.env.SOURCE_PROVIDER || cfg?.provider || 'auto').toLowerCase();
  if (explicit !== 'auto') return explicit;
  if (telegram.telegramReady()) return 'telegram';
  if (inbox.inboxReady()) return 'inbox';
  return allowMock ? 'mock' : 'none';
}

// Filtra por remetentes autorizados quando há cadastro (usado pelo inbox/WhatsApp).
function filterVendors(messages, vendors = []) {
  const known = new Map(
    vendors.filter((v) => v.enabled !== false).map((v) => [normalizePhone(v.number), v.name || v.number]),
  );
  if (!known.size) return messages;
  const out = [];
  for (const m of messages) {
    const key = normalizePhone(m.from);
    if (!known.has(key)) continue;
    out.push({ ...m, vendorName: known.get(key) });
  }
  return out;
}

// Devolve { messages, commit } — `commit()` persiste o cursor da fonte e deve ser
// chamado só DEPOIS de a fila ser salva com sucesso, para não perder mensagens
// se o processo morrer no meio.
export async function collectMessages(config = {}, { count = 20, allowMock = false, state } = {}) {
  const source = pickSource(config.source || config.whatsapp, allowMock);
  const noop = async () => {};

  if (source === 'none') {
    warn(
      'Nenhuma fonte de entrada configurada (defina TELEGRAM_BOT_TOKEN ou WHATSAPP_INBOX_URL). ' +
        'Nada será gerado — o mock só roda com --mock.',
    );
    return { messages: [], commit: noop };
  }

  if (source === 'mock') {
    log('Fonte: mock (--mock).');
    return { messages: mock.fetchMessages({ count }), commit: noop };
  }

  if (source === 'telegram') {
    const offset = (await state?.telegram?.()) ?? 0;
    const { messages, maxUpdateId } = await telegram.fetchMessages({
      offset,
      allowedChatIds: config.telegram?.allowedChatIds || [],
    });
    return {
      messages: messages.map((m) => ({ ...m, vendorName: m.senderName })),
      // Confirma o cursor (offset = último update + 1) só após o sucesso do ciclo.
      commit: async () => {
        if (maxUpdateId >= offset) await state?.saveTelegram?.(maxUpdateId + 1);
      },
    };
  }

  if (source === 'inbox') {
    log('Fonte: inbox HTTP.');
    const raw = await inbox.fetchMessages();
    const vendors = (config.whatsapp || config.source || {}).vendors || [];
    const messages = filterVendors(raw, vendors).map((m) => ({
      ...m,
      vendorName: m.vendorName || m.senderName || m.from,
    }));
    log(`${raw.length} mensagens recebidas, ${messages.length} de remetentes cadastrados.`);
    return { messages: messages.slice(0, count), commit: noop };
  }

  warn(`Fonte desconhecida: "${source}".`);
  return { messages: [], commit: noop };
}

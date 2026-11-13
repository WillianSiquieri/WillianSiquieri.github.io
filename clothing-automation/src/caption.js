// Monta a legenda final do Instagram: corpo (IA) + preço (determinístico) + CTA + hashtags.
import { formatBRL } from './pricing.js';

// Rede de segurança: o preço de CUSTO da fornecedora nunca pode aparecer no anúncio.
// A instrução para a IA já diz isso, mas um modelo (ou o gerador mock) pode ecoar a
// legenda recebida — que agora contém exatamente o custo e mais nada.
export function stripCostPrice(text = '', basePrice) {
  if (!text || basePrice == null) return String(text || '').trim();
  const reais = Math.floor(basePrice);
  const cents = Math.round((basePrice - reais) * 100);
  const int = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '[.\\s]?'); // 1299 -> 1[.\s]?299
  const cc = String(cents).padStart(2, '0');
  const patterns = [
    // Com centavos: "R$ 79,90", "79.90", "79,9"
    new RegExp(`(?:r\\$\\s*)?${int}\\s*[.,]\\s*(?:${cc}|${cc[0]})\\b`, 'gi'),
    // Só o inteiro, mas marcado como dinheiro: "R$ 79"
    new RegExp(`r\\$\\s*${int}\\b`, 'gi'),
  ];
  let out = String(text);
  for (const re of patterns) out = out.replace(re, ' ');
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}

export function buildCaption({ post, price, size, contact, hashtags }) {
  const lines = [];
  if (post.captionBody) lines.push(post.captionBody.trim());
  const details = [];
  if (size) details.push(`Tam: ${size}`);
  if (post.color) details.push(post.color);
  if (details.length) lines.push(details.join(' · '));
  lines.push(`💰 ${formatBRL(price)}`);
  if (contact) lines.push(contact);
  const tags = (hashtags || []).map((h) => `#${String(h).replace(/^#/, '').replace(/\s+/g, '')}`).join(' ');
  if (tags) lines.push('\n' + tags);
  return lines.join('\n');
}

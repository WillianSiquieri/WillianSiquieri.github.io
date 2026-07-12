// Monta a legenda final do Instagram: corpo (IA) + preço (determinístico) + CTA + hashtags.
import { formatBRL } from './pricing.js';

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

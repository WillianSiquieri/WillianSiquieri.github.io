// mentor.js — o Prefeito Walt Parker, guia do jogo: cartão com retrato e balão de
// fala (abertura, subir de nível) e lista de presentes recebidos.

import { MENTOR, ITEMS } from '../game/config.js';
import { avatarURL } from '../render/avatars.js';
import { t, tn, fmtNum } from '../i18n.js';

export const mentorFace = () => avatarURL(MENTOR);                       // rosto (dica)
export const mentorFigure = () => 'assets/characters/micah/mayor-full.svg'; // corpo inteiro

// Cartão do prefeito: fala + conteúdo opcional + botões.
export function mentorCard({ text, body = '', buttons = '' }) {
  return `
    <div class="mentor">
      <div class="mentor-head">
        <img class="mentor-figure" src="${mentorFigure()}" alt="">
        <div class="mentor-talk">
          <div class="mentor-name">${tn(MENTOR.name)}</div>
          <div class="mentor-say">${text}</div>
        </div>
      </div>
      ${body}
      <div class="mentor-actions">${buttons}</div>
    </div>`;
}

// Chips com o que foi recebido: { coins, items, converted }.
export function rewardChips(got) {
  const chips = [];
  if (got.coins) chips.push(`<span class="gift-chip coin">🪙 +${fmtNum(got.coins)}</span>`);
  for (const [k, v] of Object.entries(got.items || {})) {
    if (v) chips.push(`<span class="gift-chip" title="${tn(ITEMS[k].name)}">${ITEMS[k].icon} +${v}</span>`);
  }
  return `<div class="gift-chips">${chips.join('')}</div>` +
    (got.converted ? `<p class="muted small">${t('convertedNote', { n: fmtNum(got.converted) })}</p>` : '');
}

// Soma vários presentes (vários níveis de uma vez).
export function sumRewards(list) {
  const out = { coins: 0, items: {}, converted: 0 };
  for (const g of list) {
    out.coins += g.coins || 0; out.converted += g.converted || 0;
    for (const [k, v] of Object.entries(g.items || {})) out.items[k] = (out.items[k] || 0) + v;
  }
  return out;
}

// Frase de parabéns que varia com o nível.
// `city` já deve vir escapado (HTML).
export function congratsLine(level, phase, city) {
  if (phase) return t('mayorPhase', { p: `${phase.icon} ${tn(phase.name)}` });
  const lines = t('mayorLevel').split('|');
  return lines[level % lines.length].replace('{n}', level).replace('{c}', city);
}

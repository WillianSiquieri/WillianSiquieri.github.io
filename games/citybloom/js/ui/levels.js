// levels.js — lista de níveis agrupada pelas fases da cidade: XP para chegar,
// XP total acumulado e o que cada nível libera. Destaca o nível atual.

import { PHASES, BUILDINGS, ITEMS, xpToNext, phaseOf } from '../game/config.js';
import { unlocksAt, levelBlocked } from '../game/economy.js';
import { population, happiness } from '../game/state.js';
import { t, tn, fmtNum } from '../i18n.js';

export const MAX_LEVEL_SHOWN = 45;

export function levelsView(game) {
  const s = game.state;
  let total = 0;
  const totals = [0, 0]; // XP total acumulado para chegar ao nível n
  for (let n = 2; n <= MAX_LEVEL_SHOWN; n++) { total += xpToNext(n - 1); totals[n] = total; }

  const cur = phaseOf(s), blocked = levelBlocked(s);
  // resumo da cidade (moradores e felicidade saíram do topo da tela)
  let html = `<div class="citysum">
    <div class="cs"><span>${PHASES[cur].icon}</span><b>${tn(PHASES[cur].name)}</b><small>${t('stage')}</small></div>
    <div class="cs"><span>👥</span><b>${fmtNum(population(s))}</b><small>${t('residents')}</small></div>
    <div class="cs"><span>⭐</span><b>${fmtNum(happiness(s))}</b><small>${t('happinessLbl')}</small></div>
  </div>
  ${blocked ? `<button class="btn primary lockgo" data-act="levelPill">🔒 ${t('levelLocked')}</button>` : ''}`;
  PHASES.forEach((ph, idx) => {
    const from = ph.minLevel;
    const to = idx + 1 < PHASES.length ? PHASES[idx + 1].minLevel - 1 : MAX_LEVEL_SHOWN;
    const state = idx < cur ? 'past' : idx === cur ? 'now' : 'next';
    if (idx === cur + 1) html += `<div class="phase-lock">🔒 ${t('phaseLockNote', { p: tn(ph.name) })}</div>`;
    html += `<div class="phase-head ${state}"><span class="pi">${ph.icon}</span>
      <div><b>${tn(ph.name)}</b><small>${t('level')} ${from}${to > from ? `–${to}${idx + 1 === PHASES.length ? '+' : ''}` : ''}</small></div></div>`;
    for (let n = from; n <= to; n++) {
      const un = unlocksAt(n).map(u => u.kind === 'building'
        ? `<span class="chip">${tn(BUILDINGS[u.key].name)}</span>`
        : `<span class="chip">${ITEMS[u.key].icon} ${tn(ITEMS[u.key].name)}</span>`).join('');
      const cls = n < s.level ? 'done' : n === s.level ? 'cur' : '';
      const need = n === 1 ? t('start') : `+${fmtNum(xpToNext(n - 1))} XP`;
      const prog = n === s.level
        ? `<div class="pbar"><div style="width:${Math.min(100, (s.xp / xpToNext(n)) * 100)}%"></div></div>
           <small class="muted">${fmtNum(s.xp)}/${fmtNum(xpToNext(n))} XP ${t('toNext')}</small>` : '';
      html += `<div class="lvl-row ${cls}" ${n === s.level ? 'id="lvl-current"' : ''}>
        <div class="ln">${n < s.level ? '✓' : n}</div>
        <div class="lb">
          <div class="lt"><b>${t('level')} ${n}</b><span class="lx">${need}${n > 1 ? ` · ${t('total')} ${fmtNum(totals[n])}` : ''}</span></div>
          ${un ? `<div class="chips">${un}</div>` : ''}
          ${prog}
        </div>
      </div>`;
    }
  });
  return `<div class="levels">${html}</div>`;
}

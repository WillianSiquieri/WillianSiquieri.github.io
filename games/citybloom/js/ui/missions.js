// missions.js — painel 🏆: missões ativas (3), metas da fase atual (com prêmio grande
// ao completar tudo) e conquistas com medalhas Bronze, Prata e Ouro.

import { PHASES, BUILDINGS, ITEMS } from '../game/config.js';
import * as E from '../game/economy.js';
import { t, tn, fmtNum } from '../i18n.js';

const MEDAL = ['🥉', '🥈', '🥇'];
const bar = (p) => `<div class="pbar"><div style="width:${Math.round(Math.max(0, Math.min(1, p)) * 100)}%"></div></div>`;
const reward = (r) => `<span class="mreward">🪙 ${fmtNum(r.coins)}${r.xp ? ` · ⭐ ${r.xp} XP` : ''}${r.items ? Object.entries(r.items).map(([k, v]) => ` · ${ITEMS[k].icon} ${v}`).join('') : ''}</span>`;

function goalText(g) {
  if (g.k === 'pop') return t('goal_pop', { n: fmtNum(g.target) });
  if (g.k === 'houses') return t('goal_houses', { n: g.target });
  if (g.k === 'chunks') return t('goal_chunks', { n: g.target });
  if (g.k === 'has') return g.target > 1 ? t('goal_hasN', { n: g.target, b: tn(BUILDINGS[g.type].name) }) : t('goal_has', { b: tn(BUILDINGS[g.type].name) });
  return t('goal_' + g.stat, { n: fmtNum(g.target) });
}

export function missionsView(game) {
  const s = game.state, tab = game.missionTab || 'missions';
  const pending = { missions: E.missionsList(s).filter(m => m.done).length, goals: (() => { const p = E.phaseGoals(s); return p.allDone && !p.claimed ? 1 : 0; })(), ach: E.achievements(s).filter(a => a.claimable).length };
  const TABS = [['missions', '🎯', t('tabMissions')], ['goals', PHASES[E.phaseGoals(s).phase].icon, t('tabGoals')], ['ach', '🏅', t('tabAch')]];
  const tabs = TABS.map(([id, ic, name]) => `<button class="tab${id === tab ? ' on' : ''}" data-act="mtab" data-arg="${id}">${ic}<span>${name}</span>${pending[id] ? `<i class="dot">${pending[id]}</i>` : ''}</button>`).join('');
  let body = '';

  if (tab === 'missions') {
    body = `<p class="muted mhint">${t('missionsHint')}</p>` + E.missionsList(s).map((m, k) => `
      <div class="mcard${m.done ? ' done' : ''}">
        <div class="mtop"><b>${t('mission_' + m.k, { n: m.target })}</b><span class="mprog">${m.progress}/${m.target}</span></div>
        ${bar(m.progress / m.target)}
        <div class="mbot">${reward(m.reward)}
          <button class="btn ${m.done ? 'primary' : 'ghost'} small" data-act="claimMission" data-arg="${k}"${m.done ? '' : ' disabled'}>${m.done ? t('claim') : t('inProgress')}</button></div>
      </div>`).join('');
  } else if (tab === 'goals') {
    const pg = E.phaseGoals(s), next = PHASES[pg.phase + 1];
    const done = pg.goals.filter(g => g.done).length;
    body = `<div class="ghead"><span class="gph">${PHASES[pg.phase].icon}</span><div><b>${next ? t('goalsTo', { p: tn(next.name) }) : t('goalsLast')}</b>
        <small class="muted">${done}/${pg.goals.length} · ${t('goalsHint')}</small></div></div>
      ${bar(done / pg.goals.length)}
      <div class="glist">${pg.goals.map(g => `
        <div class="grow${g.done ? ' done' : ''}"><span class="gck">${g.done ? '✅' : '⬜'}</span>
          <div class="gtx"><span>${goalText(g)}</span>${g.done ? '' : bar(g.progress / g.target)}</div>
          <small>${fmtNum(g.progress)}/${fmtNum(g.target)}</small></div>`).join('')}</div>
      <div class="gprize"><b>🎁 ${t('goalsPrize')}</b>${reward(pg.reward)}
        <button class="btn ${pg.allDone && !pg.claimed ? 'primary' : 'ghost'}" data-act="claimGoals"${pg.allDone && !pg.claimed ? '' : ' disabled'}>${pg.claimed ? '✅ ' + t('claimed') : t('claim')}</button></div>`;
  } else {
    body = `<div class="achs">${E.achievements(s).map(a => {
      const medals = MEDAL.map((m, k) => `<span class="medal${k < a.tier ? ' got' : k < a.reached ? ' ready' : ''}">${m}</span>`).join('');
      return `<div class="ach${a.claimable ? ' ready' : ''}">
        <div class="ai">${a.icon}</div>
        <div class="ab"><b>${t('ach_' + a.id)}</b><small class="muted">${t('ach_' + a.id + '_d', { n: fmtNum(a.next) })}</small>
          ${a.tier < 3 ? bar(a.progress / a.next) + `<small class="muted">${fmtNum(a.progress)}/${fmtNum(a.next)}</small>` : `<small class="ok">${t('achMax')}</small>`}</div>
        <div class="am"><div class="medals">${medals}</div>
          ${a.claimable ? `<button class="btn primary small" data-act="claimAch" data-arg="${a.id}">${t('claim')}</button>${reward(a.reward)}` : ''}</div>
      </div>`;
    }).join('')}</div>`;
  }
  return `<div class="tabs mtabs">${tabs}</div><div class="mbody">${body}</div>`;
}

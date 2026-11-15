// daily.js — baú diário: calendário de 7 dias + baú extra por anúncio.

import { DAILY, ITEMS } from '../game/config.js';
import * as E from '../game/economy.js';
import { mentorFace, rewardChips } from './mentor.js';
import { t, fmtNum } from '../i18n.js';

function preview(r) {
  const parts = [];
  if (r.coins) parts.push(`<span>🪙${fmtNum(r.coins)}</span>`);
  for (const [k, v] of Object.entries(r.items)) parts.push(`<span>${ITEMS[k].icon}${v}</span>`);
  return parts.join('');
}

export function dailyView(game) {
  const s = game.state, now = game.now();
  const st = E.dailyStatus(s, now);
  const res = game.dailyResult;   // último baú aberto nesta sessão

  const say = st.canClaim
    ? (st.streakBroken ? t('dailySayBroken') : t('dailySayReady', { d: st.day + 1 }))
    : t('dailySayDone', { d: (st.day + 1) % 7 + 1 });

  const days = DAILY.map((def, k) => {
    const done = st.claimedToday ? k <= st.day : k < st.day;
    const today = st.canClaim ? k === st.day : (st.claimedToday && k === st.day);
    const cls = ['day', done ? 'done' : '', today && st.canClaim ? 'today' : '', def.big ? 'big' : ''].join(' ');
    return `<div class="${cls}">
      <div class="dlabel">${t('day')} ${k + 1}</div>
      <div class="dicon">${done ? '✅' : def.big ? '🧰' : '🎁'}</div>
      <div class="dprize">${preview(E.dailyReward(s, k))}</div>
    </div>`;
  }).join('');

  // Antes de abrir: botão embaixo do calendário. Depois: resultado e baú extra
  // em cima, para ficarem visíveis sem rolar.
  let top = '', bottom = '';
  if (st.canClaim) {
    bottom = `<button class="btn primary big-claim" data-act="claimDaily">🎁 ${t('openChest')}</button>`;
  } else {
    top = (res ? `<div class="chest-open"><span class="chest-burst">🎉</span><b>${t('youGot')}</b>${rewardChips(res.got)}</div>` : '') +
      (st.extraAvailable
        ? `<button class="btn ad big-claim" data-act="claimExtra">▶ ${t('extraChest')}</button>`
        : `<p class="muted center">${t('comeBack')}</p>`);
  }

  return `
    <div class="mentor-mini">
      <img class="mentor-face" src="${mentorFace()}" alt="">
      <div class="mentor-say">${say}</div>
    </div>
    ${top}
    <div class="daily-grid">${days}</div>
    ${bottom}`;
}

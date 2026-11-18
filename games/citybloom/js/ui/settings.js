// settings.js — menu de configurações: nome da cidade, música (tema e volume),
// efeitos sonoros e idioma.

import { THEMES, music } from '../engine/music.js';
import { sfx } from '../engine/audio.js';
import { t, tn, getLang } from '../i18n.js';

// Escapa texto do usuário antes de pôr em HTML/atributos.
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function settingsView(game) {
  const name = game.state.cityName || '';
  const themes = THEMES.map(th =>
    `<button class="chipbtn${music.theme === th.id ? ' on' : ''}" data-act="music" data-arg="${th.id}">${th.id === 'off' ? '🔇' : '🎵'} ${tn(th.name)}</button>`).join('');
  return `
    <div class="setting">
      <label>🏙️ ${t('cityName')}</label>
      <div class="row">
        <input id="set-city" maxlength="20" autocomplete="off" value="${esc(name)}" placeholder="${esc(t('cityNameDefault'))}">
        <button class="btn primary small" data-act="renameSave">${t('save')}</button>
      </div>
    </div>
    <div class="setting">
      <label>🎶 ${t('music')}</label>
      <div class="chips">${themes}</div>
      <div class="row vol"><span>🔈</span><input id="music-vol" type="range" min="0" max="100" value="${Math.round(music.volume * 100)}"><span>🔊</span></div>
    </div>
    <div class="setting">
      <label>🔔 ${t('effects')}</label>
      <div class="chips">
        <button class="chipbtn${!sfx.muted ? ' on' : ''}" data-act="sfx" data-arg="on">${t('on')}</button>
        <button class="chipbtn${sfx.muted ? ' on' : ''}" data-act="sfx" data-arg="off">${t('off')}</button>
      </div>
    </div>
    <div class="setting">
      <label>🌐 ${t('language')}</label>
      <div class="chips">
        <button class="chipbtn${getLang() === 'pt' ? ' on' : ''}" data-act="setLang" data-arg="pt">Português</button>
        <button class="chipbtn${getLang() === 'en' ? ' on' : ''}" data-act="setLang" data-arg="en">English</button>
      </div>
    </div>
    <div class="setting credits">
      <label>📜 ${t('credits')}</label>
      <p>🎵 ${t('creditMusic')}</p>
      <p>🎻 ${t('creditInstruments')} (CC BY 3.0)</p>
      <p>🧑‍🔧 ${t('creditCharacters')} (CC BY 4.0)</p>
      <p>🏙️ ${t('creditModels')}</p>
      <p>⭐ ${t('creditIcons')}</p>
    </div>`;
}

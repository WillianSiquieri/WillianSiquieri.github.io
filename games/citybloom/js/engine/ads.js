// ads.js — adaptador de anúncios. O resto do jogo só conhece esta interface:
//   ads.rewarded(placement) -> Promise<boolean>  (true = assistiu até o fim)
//   ads.interstitial()      -> Promise<void>
//   ads.gameplay(on)        -> avisa o portal que o jogador está/não está jogando
//
// O portal é escolhido em js/portal.js (window.CB_PORTAL), gravado pelo script
// tools/citybloom/build-portal.mjs ao gerar o .zip de cada portal:
//   'local'            — GitHub Pages / testes: não mostra anúncio, concede o prêmio
//   'crazygames'       — CrazyGames SDK v3 (window.CrazyGames.SDK)
//   'gamedistribution' — GameDistribution SDK (window.gdsdk)
//
// Pontos de anúncio (placements):
//   'speedup' terminar produção · 'double' dobrar aluguel · 'chest' baú extra ·
//   'reroll' trocar pedido · intersticial: ao mudar de fase (com intervalo mínimo)
//
// Durante o anúncio o jogo fica em silêncio (onPause/onResume, ligados no main.js).

const INTERSTITIAL_GAP = 180 * 1000;   // no máximo 1 intersticial a cada 3 min
const INTERSTITIAL_FIRST = 60 * 1000;  // e nunca no primeiro minuto

const portal = () => (typeof window !== 'undefined' && window.CB_PORTAL) || 'local';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

export const ads = {
  provider: 'local',
  ready: false,
  startedAt: Date.now(),
  lastInterstitial: 0,
  busy: false,
  onPause: () => {},
  onResume: () => {},

  // ------------------------------------------------------------------ início
  async init() {
    this.provider = portal();
    this.startedAt = Date.now();
    try {
      if (this.provider === 'crazygames') await this._initCrazy();
      else if (this.provider === 'gamedistribution') await this._initGD();
      this.ready = true;
    } catch (e) {
      console.warn('[ads] SDK indisponível:', (e && (e.message || e.type)) || e);
      this.ready = false;
    }
  },

  async _initCrazy() {
    if (!(window.CrazyGames && window.CrazyGames.SDK)) await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
    this.sdk = window.CrazyGames.SDK;
    await this.sdk.init();
  },

  _initGD() {
    return new Promise((resolve, reject) => {
      const gameId = window.CB_GD_GAME_ID;
      if (!gameId) { reject(new Error('CB_GD_GAME_ID vazio')); return; }
      window.GD_OPTIONS = {
        gameId,
        onEvent: (ev) => {
          const n = ev && ev.name;
          if (n === 'SDK_READY') resolve();
          else if (n === 'SDK_GAME_PAUSE') this.onPause();
          else if (n === 'SDK_GAME_START') this.onResume();
          else if (n === 'SDK_REWARDED_WATCH_COMPLETE') this._gdRewarded = true;
        },
      };
      if (window.gdsdk && window.gdsdk.showAd) { resolve(); return; }
      loadScript('https://html5.api.gamedistribution.com/main.min.js').catch(reject);
      setTimeout(resolve, 8000); // segue o jogo mesmo se o SDK demorar
    });
  },

  // ------------------------------------------------------------------ eventos de jogo
  loading(done) {
    if (this.provider === 'crazygames' && this.sdk) {
      try { done ? this.sdk.game.loadingStop() : this.sdk.game.loadingStart(); } catch (_) {}
    }
  },
  gameplay(on) {
    if (this.provider === 'crazygames' && this.sdk) {
      try { on ? this.sdk.game.gameplayStart() : this.sdk.game.gameplayStop(); } catch (_) {}
    }
  },

  // ------------------------------------------------------------------ premiado
  async rewarded(placement) {
    if (this.provider === 'local') {
      console.info(`[ads] rewarded "${placement}" (modo local: concedido)`);
      return true;
    }
    if (!this.ready || this.busy) return false;
    this.busy = true;
    try {
      if (this.provider === 'crazygames') return await this._crazyAd('rewarded');
      if (this.provider === 'gamedistribution') return await this._gdAd('rewarded');
      return false;
    } finally { this.busy = false; }
  },

  // ------------------------------------------------------------------ intersticial
  async interstitial() {
    const now = Date.now();
    if (now - this.startedAt < INTERSTITIAL_FIRST || now - this.lastInterstitial < INTERSTITIAL_GAP) return;
    if (this.provider === 'local') { console.info('[ads] interstitial (modo local)'); this.lastInterstitial = now; return; }
    if (!this.ready || this.busy) return;
    this.busy = true;
    this.lastInterstitial = now;
    try {
      if (this.provider === 'crazygames') await this._crazyAd('midgame');
      else if (this.provider === 'gamedistribution') await this._gdAd('interstitial');
    } finally { this.busy = false; }
  },

  // ------------------------------------------------------------------ provedores
  _crazyAd(type) {
    return new Promise((resolve) => {
      let paused = false;
      const end = (ok) => { if (paused) this.onResume(); resolve(ok); };
      try {
        this.sdk.ad.requestAd(type, {
          adStarted: () => { paused = true; this.onPause(); },
          adFinished: () => end(true),
          adError: () => end(false),
        });
      } catch (_) { end(false); }
    });
  },

  async _gdAd(type) {
    this._gdRewarded = false;
    try {
      if (type === 'rewarded') {
        await window.gdsdk.showAd('rewarded');
        return this._gdRewarded === true; // só com SDK_REWARDED_WATCH_COMPLETE
      }
      await window.gdsdk.showAd();
      return true;
    } catch (_) {
      this.onResume();
      return false;
    }
  },
};

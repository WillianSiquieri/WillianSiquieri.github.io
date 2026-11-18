// main.js — CityBloom: liga estado, regras, desenho e interface.

import { Camera } from './engine/camera.js';
import { InputManager } from './engine/input.js';
import { ads } from './engine/ads.js';
import { sfx } from './engine/audio.js';
import { pt, tileAt, center, TW } from './engine/iso.js';
import { Scene } from './render/scene.js';
import { Fx } from './ui/fx.js';
import { panelView } from './ui/panels.js';
import { buildMenuView } from './ui/build.js';
import { ordersView } from './ui/orders.js';
import { levelsView } from './ui/levels.js';
import { settingsView, esc } from './ui/settings.js';
import { mentorCard, rewardChips, sumRewards, congratsLine, mentorFace } from './ui/mentor.js';
import { dailyView } from './ui/daily.js';
import { Tutorial } from './ui/tutorial.js';
import { watchIcons } from './ui/icons.js';
import { inventoryView } from './ui/inventory.js';
import { thumb, setThumbProvider } from './ui/build.js';
import { music } from './engine/music.js';
import { BUILDINGS, ITEMS, RESOURCE_LOTS, PHASES, phaseForLevel, xpToNext } from './game/config.js';
import * as E from './game/economy.js';
import { newGame, showcaseGame, load, save, resetSave, tileOf, population, happiness, setStorage } from './game/state.js';
import { t, tn, toggleLang, setLang, fmtTime, fmtNum, applyPortalLocale } from './i18n.js';

const $ = (id) => document.getElementById(id);

class CityGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = new Camera();
    this.fx = new Fx();
    this.selected = null;
    this.sheet = null;            // 'build' | 'orders' | null
    this.buildTab = 'houses';
    this.placing = null;          // { type, i, j, valid }
    this.buildAt = null;          // tile sugerido pelo "Construir aqui"
    this.modalQueue = [];
    this.t0 = performance.now();
    this.lastFrame = this.t0;

    // ?reset=1 e ?showcase=1 são ferramentas de teste: desligadas nos portais
    const params = new URLSearchParams((window.CB_PORTAL || 'local') === 'local' ? location.search : '');
    if (params.get('reset') === '1') resetSave();
    if (params.get('showcase') === '1') {
      this.state = showcaseGame();
    } else {
      const loaded = load();
      this.state = loaded || newGame();
      const away = loaded ? Date.now() - loaded.lastSeen : 0; // antes de salvar (save atualiza lastSeen)
      if (away > 60000) setTimeout(() => toast(t('welcome', { t: fmtTime(away / 1000) })), 600);
      E.tick(this.state, Date.now());
      save(this.state);
    }

    this.scene = new Scene(this.state);
    this.world = null;            // cidade 3D (quando WebGL e modelos carregarem)
    this.tutorial = new Tutorial(this);
    this.camTween = null;
    this.greetUntil = 0;
    this.input = new InputManager(canvas, this);
    this._resize();
    this.ready3d = this._init3d();
    window.addEventListener('resize', () => this._resize());
    this.fitView();

    setInterval(() => this._second(), 1000);
    setInterval(() => save(this.state), 10000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(this.state); });

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);

    // O jogador cai direto na cidade (regra dos portais): o Prefeito se apresenta
    // num balão que não bloqueia e a mão do tutorial mostra o primeiro toque.
    if (!this.state.showcase && !this.state.mentor.intro) {
      this.state.mentor.intro = true;
      this.greetUntil = this.time() + 7;
      save(this.state);
    }
  }

  // ---------------------------------------------------------------- cidade 3D
  // Carrega o Three.js e os modelos; se algo falhar, o jogo segue no desenho 2D.
  async _init3d() {
    // 3D é o padrão; ?r3d=0 (ou ?r2d=1) usa o desenho 2D (testes/aparelhos fracos).
    const q = new URLSearchParams(location.search);
    if (q.get('r3d') === '0' || q.get('r2d') === '1') return false;
    try {
      const { World3D } = await import('./render3d/world3d.js');
      if (!World3D.supported()) return false;
      const w = new World3D($('city3d'));
      w.setSize(window.innerWidth, window.innerHeight, this.dpr);
      await w.load(p => { if (this.onLoad) this.onLoad(p); });
      this.world = w;
      this.scene.heightOf = (o) => w.heightPx(o);
      setThumbProvider(type => w.thumb(type));
      document.body.classList.add('r3d');
      if (this.sheet) this.renderSheet();
      return true;
    } catch (e) {
      console.warn('[3d] indisponível, usando 2D:', e && e.message);
      return false;
    }
  }

  // ---------------------------------------------------------------- nome da cidade
  openName(rename) {
    $('name-title').textContent = t(rename ? 'renameTitle' : 'nameTitle');
    $('name-sub').textContent = rename ? '' : t('nameSub');
    $('name-btn').textContent = t(rename ? 'save' : 'nameGo');
    const inp = $('name-input');
    inp.value = this.state.cityName || '';
    inp.placeholder = t('cityNameDefault');
    $('namebox').classList.add('show');
    setTimeout(() => inp.focus(), 50);
  }

  saveName(raw, fromModal) {
    // remove caracteres de controle e espaços extras; limite de 20
    const name = String(raw || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20)
      || (fromModal ? t('cityNameDefault') : '');
    if (!name) { toast(t('nameEmpty'), true); return false; }
    this.state.cityName = name;
    save(this.state);
    hudKey = '';
    if (fromModal) $('namebox').classList.remove('show');
    toast(t('nameSaved', { n: name }));
    sfx.collect();
    return true;
  }

  panelOpen() { return $('panel').classList.contains('show'); }

  // Moedas, itens e XP voam do prédio até o contador do HUD, que pulsa.
  _fly(r, i, j, size) {
    const c = center(i, j, size);
    const from = this.camera.toScreen(c.x, c.y - 20);
    const go = (icon, targetSel, n) => {
      const tgt = document.querySelector(targetSel);
      if (!tgt || n <= 0) return;
      const tr = tgt.getBoundingClientRect(), tx = tr.left + 20, ty = tr.top + tr.height / 2;
      for (let k = 0; k < n; k++) {
        const el = document.createElement('img');
        el.className = 'flyer'; el.src = icon; el.alt = '';
        document.body.append(el);
        const sx = from.x + (Math.random() - 0.5) * 40, sy = from.y + (Math.random() - 0.5) * 20;
        const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 80, my = Math.min(sy, ty) - 60 - Math.random() * 40;
        const a = el.animate([
          { transform: `translate(${sx - 15}px, ${sy - 15}px) scale(0.4)`, opacity: 0 },
          { transform: `translate(${sx - 15}px, ${sy - 35}px) scale(1.1)`, opacity: 1, offset: 0.15 },
          { transform: `translate(${mx - 15}px, ${my - 15}px) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${tx - 15}px, ${ty - 15}px) scale(0.7)`, opacity: 1 },
        ], { duration: 750 + k * 60, delay: k * 70, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'both' });
        a.onfinish = () => {
          el.remove();
          const pill = tgt.closest('.pill') || tgt;
          if (k === n - 1) { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
        };
      }
    };
    if (r.coins) go('assets/icons/1fa99.webp', '#hud-coins', Math.min(6, 2 + Math.floor(Math.log2(r.coins + 1) / 2)));
    const items = Object.entries(r.items || {});
    if (items.length || r.drop) go('assets/icons/1f4e6.webp', '[data-act="inventory"]', Math.min(4, 1 + items.length));
    if (r.xp) go('assets/icons/2b50.webp', '.level-pill', 1);
  }

  // Leva a câmera com calma até um ponto do mundo.
  panTo(wx, wy, dur = 0.8) {
    const c = this.camera;
    this.camTween = { x0: c.x, y0: c.y, x1: wx, y1: wy, t0: this.time(), dur };
  }

  now() { return Date.now(); }
  time() { return (performance.now() - this.t0) / 1000; }

  // ---------------------------------------------------------------- câmera
  fitView() {
    const s = this.state, cam = this.camera;
    let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity;
    for (let j = 0; j < s.size; j++) for (let i = 0; i < s.size; i++) {
      if (!tileOf(s, i, j).locked) { i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i + 1); j1 = Math.max(j1, j + 1); }
    }
    const L = pt(i0, j1), R = pt(i1, j0), T = pt(i0, j0), B = pt(i1, j1);
    // folga menor em telas estreitas: a cidade começa grande no celular
    const narrow = cam.vw < 600;
    const w = (R.x - L.x) + TW * (narrow ? 0.5 : 2.2), h = (B.y - T.y) + (narrow ? 160 : 220);
    cam.zoom = Math.max(cam.minZoom, Math.min(cam.maxZoom, Math.min(cam.vw / w, (cam.vh - 150) / h)));
    cam.x = (L.x + R.x) / 2;
    cam.y = (T.y + B.y) / 2 - 30;
  }
  panByScreen(dx, dy) { this.camera.panByScreen(dx, dy); }
  zoomAt(sx, sy, f) { this.camera.zoomAt(sx, sy, f); }
  zoomStep(d) { this.camera.zoomAt(this.camera.vw / 2, this.camera.vh / 2, d > 0 ? 1.25 : 0.8); }

  // ---------------------------------------------------------------- toque
  tap(sx, sy) {
    sfx.unlock();
    const w = this.camera.toWorld(sx, sy);
    if (this.placing) {
      const { i, j } = tileAt(w.x, w.y);
      const s = BUILDINGS[this.placing.type].size;
      this.placing.i = Math.max(0, Math.min(this.state.size - s, i));
      this.placing.j = Math.max(0, Math.min(this.state.size - s, j));
      this._updatePlacing();
      return;
    }
    if (this.sheet) this.closeSheet();
    const cur = this.selected && this.selected.kind === 'object' ? this.selected.obj : null;
    const sel = this.scene.pick(this.state, w, tileAt, cur);
    if (!sel) return this.select(null);
    if (sel.kind === 'object' && !this.state.showcase) {
      const o = sel.obj;
      const r = E.quickCollect(this.state, o, this.now());
      if (r) this._result(r, o.i, o.j, o.size);
      if (o.type === 'townhall') { this.select(sel); return this.openSheet('orders'); }
    }
    this.select(sel);
    sfx.click();
  }

  select(sel) {
    this.selected = sel;
    this.renderPanel();
  }

  // ---------------------------------------------------------------- ações
  act(act, arg) {
    sfx.unlock();
    const s = this.state, now = this.now();
    const o = this.selected && this.selected.kind === 'object' ? this.selected.obj : null;
    const tile = this.selected && this.selected.kind === 'tile' ? this.selected : null;
    let r = null, at = o ? [o.i, o.j, o.size] : tile ? [tile.i, tile.j, 1] : null;

    switch (act) {
      case 'collect': if (o) r = E.quickCollect(s, o, now) || { ok: false, err: 'notReady' }; break;
      case 'collect2':
        if (o) this._rewarded('double').then(ok => {
          if (!ok) return;
          E.adUsed(s, 'double', this.now());
          const d = BUILDINGS[o.type];
          const rr = d.type === 'house' ? E.collectRent(s, o, this.now(), 2) : E.collectIncome(s, o, this.now(), 2);
          this._result(rr, o.i, o.j, o.size); this.renderPanel();
        });
        return;
      case 'speed':
        if (o) this._rewarded('speedup').then(ok => {
          if (!ok) return;
          const rr = E.speedUp(s, o, this.now());
          if (rr.ok) { sfx.coin(); save(s); } else this._error(rr);
          this.renderPanel();
        });
        return;
      case 'speedCoins': if (o) { r = E.speedUpCoins(s, o, now); if (r.ok) { r.silent = 'build'; this.fx.burst(o.i, o.j, o.size, this.time()); } } break;
      case 'chestCoins': {
        const rr = E.claimDailyExtraCoins(s, now);
        if (!rr.ok) return this._error(rr);
        this.dailyResult = rr; this._gift(rr.got); this.renderSheet();
        return;
      }
      case 'rerollCoins': { const rr = E.rerollOrderCoins(s, Number(arg)); if (!rr.ok) return this._error(rr); sfx.click(); save(s); this.renderSheet(); return; }
      case 'startLot': if (o) r = E.startLot(s, o, arg, now); if (r && r.ok) r.silent = 'build'; break;
      case 'recipe': if (o) r = E.startRecipe(s, o, Number(arg), now); if (r && r.ok) r.silent = 'build'; break;
      case 'upgrade': if (o) r = E.upgradeHouse(s, o, now); if (r && r.ok) { this.fx.burst(o.i, o.j, o.size, this.time()); sfx.build(); } break;
      case 'buyChunk': if (tile) {
        const { ci, cj } = E.chunkOf(tile.i, tile.j);
        r = E.buyChunk(s, ci, cj);
        if (r.ok) { at = [ci * 3 + 1, cj * 3 + 1, 1]; this.fx.burst(ci * 3 + 1, cj * 3 + 1, 1, this.time()); sfx.build(); this.selected = null; }
      } break;
      case 'clear': if (tile) {
        r = E.clearObstacle(s, tile.i, tile.j);
        if (r.ok) { this.fx.burst(tile.i, tile.j, 1, this.time()); this.selected = null; }
      } break;
      case 'move': if (o && !s.showcase) this.startMove(o); return;
      case 'buildHere': if (tile) { this.buildAt = { i: tile.i, j: tile.j }; this.select(null); this.openSheet('build'); } return;
      case 'orders': this.openSheet('orders'); return;
      case 'levels': if (!s.showcase) this.openSheet('levels'); return;
      case 'settings': this.openSheet('settings'); return;
      case 'rename': if (!s.showcase) this.openName(true); return;
      case 'nameSave': this.saveName($('name-input').value, true); return;
      case 'renameSave': if (this.saveName($('set-city').value, false)) this.renderSheet(); return;
      case 'music': music.setTheme(arg); this.renderSheet(); return;
      case 'sfx': if ((arg === 'off') !== sfx.muted) sfx.toggleMute(); sfx.click(); this.renderSheet(); return;
      case 'setLang': setLang(arg); this.refreshTexts(); return;
      case 'whUpgrade': r = E.upgradeWarehouse(s); break;
      case 'deliver': {
        r = E.deliverOrder(s, Number(arg));
        const th = s.objects.find(x => x.type === 'townhall');
        if (th) at = [th.i, th.j, th.size];
        if (r.ok) this.fx.burst(at[0], at[1], at[2], this.time());
      } break;
      case 'discard': r = E.discardOrder(s, Number(arg), now); if (r.ok) r.silent = 'click'; break;
      case 'reroll':
        this._rewarded('reroll').then(ok => { if (ok && E.rerollOrder(s, Number(arg)).ok) { save(s); this.renderSheet(); } });
        return;
      case 'tab': this.buildTab = arg; this.renderSheet(); sfx.click(); return;
      case 'pick': this.startPlacing(arg); return;
      case 'placeOk': this.confirmPlacing(); return;
      case 'placeCancel': this.cancelPlacing(); return;
      case 'closePanel': this.select(null); return;
      case 'closeSheet': this.closeSheet(); return;
      case 'modalOk': this.closeModal(); return;
      case 'daily': if (!s.showcase) this.openSheet('daily'); return;
      case 'tutSkip': s.mentor.tut = false; this.greetUntil = 0; save(s); hudKey = ''; sfx.click(); return;
      case 'claimMission': {
        const rr = E.claimMission(s);
        if (!rr.ok) return this._error(rr);
        const th = s.objects.find(x => x.type === 'townhall');
        this._result(rr, th ? th.i : 0, th ? th.j : 0, th ? th.size : 1);
        toast(t('missionDone'));
        hudKey = '';
        return;
      }
      case 'inventory': if (!s.showcase) { this.select(null); this.openSheet('inventory'); } return;
      case 'claimDaily': {
        const rr = E.claimDaily(s, now);
        if (!rr.ok) return this._error(rr);
        this.dailyResult = rr;
        this._gift(rr.got);
        this.renderSheet();
        return;
      }
      case 'claimExtra':
        this._rewarded('chest').then(ok => {
          if (!ok) return;
          const rr = E.claimDailyExtra(s, this.now());
          if (!rr.ok) return this._error(rr);
          this.dailyResult = rr;
          this._gift(rr.got);
          this.renderSheet();
        });
        return;
      default: return;
    }
    if (r) this._result(r, ...(at || [0, 0, 1]));
    this.renderPanel();
    if (this.sheet) this.renderSheet();
  }

  // Anúncio premiado: avisa quando não houver anúncio (não concede nada).
  _rewarded(placement) {
    return ads.rewarded(placement).then(ok => {
      if (!ok) { toast(t('adUnavailable'), true); this.renderPanel(); if (this.sheet) this.renderSheet(); }
      return ok;
    });
  }

  // Trata o resultado de uma ação: efeitos, sons, nível, salvar.
  _result(r, i, j, size) {
    if (!r.ok) return this._error(r);
    const lines = [];
    if (r.items) for (const [k, v] of Object.entries(r.items)) lines.push({ text: `+${v} ${ITEMS[k].icon}`, color: '#1f2430' });
    if (r.coins) lines.push({ text: `+${fmtNum(r.coins)} 🪙`, color: '#b07800' });
    if (r.drop) lines.push({ text: `+1 ${ITEMS[r.drop].icon}`, color: '#7b3fe4' });
    if (r.xp) lines.push({ text: `+${r.xp} XP`, color: '#2e7dff' });
    if (lines.length) this.fx.float(i, j, size, lines, this.time());
    this._fly(r, i, j, size);
    if (this.world) this.world.bump(i, j, this.time());
    if (r.silent === 'build') sfx.build();
    else if (r.silent === 'click') sfx.click();
    else if (r.coins) sfx.coin();
    else if (r.items || r.drop) sfx.collect();
    else if (r.xp) sfx.build();
    if (r.levels && r.levels.length) this.levelUp(r.levels, r.phaseChanged, r.rewards);
    E.tick(this.state, this.now());
    save(this.state);
    return true;
  }

  _error(r) {
    sfx.error();
    const map = {
      noCoins: 'errNoCoins', noItems: 'errNoItems', storageFull: 'errStorageFull', locked: 'errLocked',
      queueFull: 'errQueueFull', invalidPlace: 'errInvalidPlace', maxCount: 'errMaxCount', notAdjacent: 'errNotAdjacent',
    };
    const need = r.need ? Object.entries(r.need).map(([k, v]) => `${v}× ${k === 'coins' ? '🪙' : ITEMS[k].icon}`).join('  ') : '';
    toast(t(map[r.err] || 'errGeneric', { need, level: r.level }), true);
    return false;
  }

  // ---------------------------------------------------------------- construir
  startPlacing(type) {
    const c = E.buildCheck(this.state, type);
    if (!c.ok) return this._error(c);
    const s = this.state, size = BUILDINGS[type].size;
    let spot = null;
    if (this.buildAt && E.canPlace(s, type, this.buildAt.i, this.buildAt.j)) spot = this.buildAt;
    if (!spot) {
      // procura o lugar livre mais perto do centro da tela
      const w = this.camera.toWorld(this.camera.vw / 2, this.camera.vh / 2);
      const c0 = tileAt(w.x, w.y);
      let best = null, bd = Infinity;
      for (let j = 0; j <= s.size - size; j++) for (let i = 0; i <= s.size - size; i++) {
        if (!E.canPlace(s, type, i, j)) continue;
        const d = (i - c0.i) ** 2 + (j - c0.j) ** 2;
        if (d < bd) { bd = d; best = { i, j }; }
      }
      spot = best || { i: c0.i, j: c0.j };
    }
    this.buildAt = null;
    this.placing = { type, i: spot.i, j: spot.j, valid: false };
    this.closeSheet();
    this.select(null);
    this._updatePlacing();
    document.body.classList.add('placing');
  }

  // Mover uma construção já feita: usa o mesmo modo de posicionar.
  startMove(o) {
    this.placing = { type: o.type, i: o.i, j: o.j, valid: true, moving: o };
    this.closeSheet();
    this.select(null);
    this._updatePlacing();
    document.body.classList.add('placing');
    sfx.click();
  }

  _updatePlacing() {
    const p = this.placing;
    p.valid = E.canPlace(this.state, p.type, p.i, p.j, p.moving || null);
    const def = BUILDINGS[p.type];
    $('place-name').textContent = (p.moving ? t('move') + ' · ' : '') + tn(def.name);
    if (p.moving) {
      $('place-cost').innerHTML = '';
      $('place-hint').textContent = p.valid ? t('moveHint') : t('errInvalidPlace');
      $('place-ok').disabled = !p.valid;
      return;
    }
    $('place-cost').innerHTML = Object.entries(def.build || {}).map(([k, v]) => {
      const have = k === 'coins' ? this.state.coins : (this.state.inventory[k] || 0);
      return `<span class="cost${have >= v ? '' : ' miss'}">${k === 'coins' ? '🪙' : ITEMS[k].icon} ${fmtNum(v)}</span>`;
    }).join('');
    $('place-hint').textContent = p.valid ? t('placeHint') : t('errInvalidPlace');
    $('place-ok').disabled = !p.valid;
  }

  confirmPlacing() {
    const p = this.placing;
    if (!p) return;
    if (p.moving) {
      const r = E.moveObject(this.state, p.moving, p.i, p.j);
      if (!r.ok) return this._error(r);
      this.placing = null;
      document.body.classList.remove('placing');
      if (!r.same) { this.fx.burst(p.i, p.j, p.moving.size, this.time()); sfx.build(); toast(t('moved')); save(this.state); }
      this.select({ kind: 'object', obj: p.moving });
      return;
    }
    const r = E.build(this.state, p.type, p.i, p.j, this.now());
    if (!r.ok) return this._error(r);
    this.placing = null;
    document.body.classList.remove('placing');
    this.fx.burst(p.i, p.j, BUILDINGS[p.type].size, this.time());
    sfx.build();
    this._result({ ...r, silent: 'build' }, p.i, p.j, BUILDINGS[p.type].size);
    this.select({ kind: 'object', obj: r.obj });
  }

  cancelPlacing() {
    this.placing = null;
    document.body.classList.remove('placing');
  }

  // ---------------------------------------------------------------- folhas (menus)
  openSheet(kind) {
    this.sheet = kind;
    $('sheet-body').scrollTop = 0;
    this.renderSheet(true);
    $('sheet').classList.add('show');
    sfx.click();
  }
  closeSheet() {
    this.sheet = null;
    $('sheet').classList.remove('show');
  }
  renderSheet(first = false) {
    if (!this.sheet) return;
    const views = {
      build: [`🔨 ${t('buildTitle')}`, buildMenuView],
      orders: [`📋 ${t('ordersTitle')}`, ordersView],
      levels: [`⭐ ${t('levelsTitle')}`, levelsView],
      settings: [`⚙️ ${t('settings')}`, settingsView],
      daily: [`🎁 ${t('dailyTitle')}`, dailyView],
      inventory: [`📦 ${t('inventoryTitle')}`, inventoryView],
    };
    const [title, view] = views[this.sheet];
    $('sheet-title').textContent = title;
    const body = $('sheet-body');
    const scroll = body.scrollTop;
    // não redesenha configurações enquanto o usuário digita o nome
    if (this.sheet === 'settings' && !first && document.activeElement && document.activeElement.id === 'set-city') return;
    body.innerHTML = view(this);
    body.scrollTop = scroll;
    if (first && this.sheet === 'levels') {
      const cur = $('lvl-current');
      if (cur) body.scrollTop = cur.offsetTop - body.clientHeight / 2 + cur.clientHeight / 2;
    }
  }

  // Atualiza todos os textos visíveis após trocar o idioma.
  refreshTexts() {
    hudKey = '';
    this.renderPanel();
    this.renderSheet();
    if (this.placing) this._updatePlacing();
  }

  renderPanel() {
    const panel = $('panel');
    const v = this.state.showcase ? null : panelView(this);
    if (!v) { panel.classList.remove('show'); return; }
    $('panel-title').textContent = v.title;
    $('panel-body').innerHTML = v.body;
    $('panel-actions').innerHTML = v.actions || '';
    $('panel-actions').style.display = v.actions ? 'flex' : 'none';
    const mv = $('panel-move');
    const movable = this.selected && this.selected.kind === 'object';
    mv.classList.toggle('show', !!movable);
    if (movable) mv.textContent = t('move');
    panel.classList.add('show');
  }

  // ---------------------------------------------------------------- nível
  levelUp(levels, phaseChanged, rewards = []) {
    const lv = levels[levels.length - 1];
    const unlocked = levels.flatMap(l => E.unlocksAt(l));
    const phase = phaseChanged ? phaseForLevel(lv) : null;
    const got = sumRewards(rewards);
    this.pushModal({
      render: () => {
        const list = unlocked.map(u => u.kind === 'building'
          ? `<li><img src="${thumb(u.key)}" alt=""><span>${tn(BUILDINGS[u.key].name)}</span></li>`
          : `<li><span class="uicon">${ITEMS[u.key].icon}</span><span>${tn(ITEMS[u.key].name)}</span></li>`).join('');
        return mentorCard({
          text: congratsLine(lv, phase, esc(this.state.cityName || t('cityNameDefault'))),
          body: `
            <div class="lv-badge"><span class="burst">⭐</span><b>${t('levelUp', { n: lv })}</b></div>
            ${list ? `<p class="sec">${t('unlocked')}</p><ul class="unlocks">${list}</ul>` : `<p class="muted">${t('nothingNew')}</p>`}
            ${got.coins || Object.keys(got.items).length ? `<p class="sec">${t('yourReward')}</p>${rewardChips(got)}` : ''}`,
          buttons: `<button class="btn primary" data-act="modalOk">${t('collectGift')}</button>`,
        });
      },
      onOk: () => { this._gift(got); if (phase) ads.interstitial(); },
    });
    sfx.levelUp();
  }

  // Moedas/itens flutuando sobre a Prefeitura + som.
  _gift(got) {
    const th = this.state.objects.find(x => x.type === 'townhall');
    const lines = [];
    if (got.coins) lines.push({ text: `+${fmtNum(got.coins)} 🪙`, color: '#b07800' });
    for (const [k, v] of Object.entries(got.items || {})) lines.push({ text: `+${v} ${ITEMS[k].icon}`, color: '#1f2430' });
    if (th && lines.length) { this.fx.float(th.i, th.j, th.size, lines, this.time()); this.fx.burst(th.i, th.j, th.size, this.time()); }
    sfx.coin();
    hudKey = '';
    save(this.state);
  }

  // Fila de cartões (prefeito / nível). Cada item: { render(), onOk?(), focus? }.
  // onOk devolvendo false mantém o cartão aberto (ex.: nome inválido).
  pushModal(item) {
    this.modalQueue.push(item);
    if (!$('modal').classList.contains('show')) this._showModal();
  }
  _showModal() {
    const m = this.modalQueue[0];
    if (!m) return;
    $('modal-body').innerHTML = m.render();
    $('modal').classList.add('show');
    if (m.focus) setTimeout(() => { const el = $(m.focus); if (el) el.focus(); }, 80);
  }
  closeModal() {
    const m = this.modalQueue[0];
    if (m && m.onOk && m.onOk() === false) return;
    this.modalQueue.shift();
    $('modal').classList.remove('show');
    if (this.modalQueue.length) setTimeout(() => this._showModal(), 200);
  }

  // ---------------------------------------------------------------- tempo
  _second() {
    if (this.state.showcase) return;
    const changed = E.tick(this.state, this.now());
    if (this.selected) this.renderPanel();
    if (this.sheet === 'orders' || this.sheet === 'inventory' || (changed && this.sheet === 'build')) this.renderSheet();
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.setViewport(w, h);
    if (this.world) this.world.setSize(w, h, this.dpr);
  }

  _loop() {
    const nowP = performance.now();
    const dt = Math.min(0.1, (nowP - this.lastFrame) / 1000);
    this.lastFrame = nowP;
    const time = this.time();
    this.scene.update(dt);
    if (this.camTween) {
      const k = Math.min(1, (time - this.camTween.t0) / this.camTween.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.camera.x = this.camTween.x0 + (this.camTween.x1 - this.camTween.x0) * e;
      this.camera.y = this.camTween.y0 + (this.camTween.y1 - this.camTween.y0) * e;
      if (k >= 1) this.camTween = null;
    }
    if (this.world) {
      this.world.render(this.camera, this.state, time, this.now(), {
        selected: this.placing ? null : this.selected,
        ghost: this.placing,
      }, this.scene.traffic);
      this.scene.renderOverlay(this.ctx, this.camera, this.dpr, this.state, time, this.now());
    } else {
      this.scene.render(this.ctx, this.camera, this.dpr, this.state, time, this.now(), {
        selected: this.placing ? null : this.selected,
        ghost: this.placing,
        labels: this.state.showcase ? (ctx, o) => drawLabel(ctx, o, this.camera.zoom) : null,
      });
    }
    this.fx.render(this.ctx, time);
    renderHud(this);
    this.tutorial.update(time);
    requestAnimationFrame(this._loop);
  }
}

// ------------------------------------------------------------------ HUD
let hudKey = '';
function renderHud(game) {
  const s = game.state;
  const ph = phaseForLevel(s.level);
  const deliverable = s.orders.filter(o => E.canDeliver(s, o)).length;
  const tut = !s.showcase && s.mentor && s.mentor.tut !== false;
  const tip = s.showcase ? null : (tut ? E.currentTip(s) : null);
  const greet = !s.showcase && game.time() < game.greetUntil;
  const ms = s.showcase || tip || greet ? null : E.mission(s);
  const daily = !s.showcase && E.dailyStatus(s, game.now());
  const gift = daily ? (daily.canClaim ? 2 : daily.extraAvailable ? 1 : 0) : -1;
  const key = [s.level, s.xp, s.coins, population(s), happiness(s), E.used(s), s.capacity, deliverable, tip, greet, ms && [ms.k, ms.progress, ms.target, ms.done].join(), s.cityName, gift, document.documentElement.lang].join('|');
  if (key === hudKey) return;
  hudKey = key;
  $('hud-city').textContent = s.showcase ? 'CityBloom' : (s.cityName || t('cityNameDefault'));
  $('hud-phase').textContent = s.showcase ? `🧪 ${t('showcase')}` : `${ph.icon} ${tn(ph.name)}`;
  $('hud-level').textContent = `${t('level')} ${s.level}`;
  $('hud-xpbar').style.width = `${Math.min(100, (s.xp / xpToNext(s.level)) * 100)}%`;
  $('hud-coins').textContent = fmtNum(s.coins);
  $('hud-pop').textContent = fmtNum(population(s));
  $('hud-happy').textContent = fmtNum(happiness(s));
  $('hud-storage').textContent = `${E.used(s)}/${s.capacity}`;
  $('hud-storage').parentElement.classList.toggle('full', E.used(s) >= s.capacity);
  $('btn-lang').textContent = t('lang');
  const badge = $('orders-badge');
  badge.textContent = deliverable; badge.style.display = deliverable ? 'flex' : 'none';
  $('lbl-build').textContent = t('build'); $('lbl-orders').textContent = t('orders');
  const tipEl = $('tip');
  const tbtn = $('tip-btn'), sub = $('tip-sub');
  tipEl.classList.toggle('mission', !!ms); tipEl.classList.toggle('done', !!(ms && ms.done));
  if (greet || tip) {
    $('tip-text').textContent = greet ? t('mayorHi') : t(tip);
    sub.textContent = '';
    tbtn.textContent = t('skip'); tbtn.dataset.act = 'tutSkip'; tbtn.className = 'tip-btn ghost';
    tipEl.classList.add('show');
  } else if (ms) {
    $('tip-text').textContent = t('mission_' + ms.k, { n: ms.target });
    sub.innerHTML = `${ms.progress}/${ms.target} · 🪙 ${fmtNum(ms.reward.coins)} · ${ms.reward.xp} XP`;
    tbtn.textContent = t('claim'); tbtn.dataset.act = 'claimMission'; tbtn.className = 'tip-btn' + (ms.done ? '' : ' hidden');
    tipEl.classList.add('show');
  } else tipEl.classList.remove('show');
  $('btn-daily').style.display = gift < 0 ? 'none' : '';
  $('daily-badge').style.display = gift === 2 ? 'flex' : 'none';
  $('btn-daily').classList.toggle('ready', gift === 2);
}

function drawLabel(ctx, o, zoom) {
  const def = BUILDINGS[o.type];
  const c = center(o.i, o.j, o.size);
  const y = c.y + 16 * o.size + 6;
  ctx.font = `700 ${12 / zoom}px -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const label = tn(def.name) + (o.resource ? ` · ${ITEMS[o.resource].icon}` : '');
  ctx.lineWidth = 3.5 / zoom; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.strokeText(label, c.x, y);
  ctx.fillStyle = '#1f2430'; ctx.fillText(label, c.x, y);
}

let toastTimer;
function toast(msg, bad = false) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('bad', bad);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ------------------------------------------------------------------ boot
async function boot() {
  // anúncios: silencia o jogo durante o anúncio; avisa o portal do carregamento
  ads.onPause = () => { music.hold(true); sfx.hold(true); };
  ads.onResume = () => { music.hold(false); sfx.hold(false); };
  watchIcons();
  const adsReady = ads.init();
  // No CrazyGames: espera o SDK (até 4 s) para usar o save da conta (Data module)
  // e o idioma do jogador antes de montar a cidade.
  if ((window.CB_PORTAL || 'local') === 'crazygames') {
    await Promise.race([adsReady, new Promise(r => setTimeout(r, 4000))]);
    const store = ads.storage();
    if (store) setStorage(store);
    applyPortalLocale(ads.locale);
  }
  const game = new CityGame($('city'));
  window.__city = game;
  // tela de carregamento: some quando a cidade 3D (ou a 2D) está pronta
  const bar = $('load-bar');
  game.onLoad = (p) => { bar.style.width = Math.round(10 + p * 90) + '%'; };
  bar.style.width = '10%';
  const done = () => { bar.style.width = '100%'; setTimeout(() => $('loading').classList.add('hide'), 150); };
  Promise.race([game.ready3d, new Promise(r => setTimeout(r, 15000))]).then(done);
  // o portal só conta "jogando" quando a cidade aparece
  Promise.all([adsReady, Promise.race([game.ready3d, new Promise(r => setTimeout(r, 15000))])]).then(() => { ads.loading(true); ads.gameplay(true); });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) game.act(b.dataset.act, b.dataset.arg);
  });
  $('btn-zoom-in').onclick = () => game.zoomStep(1);
  $('btn-zoom-out').onclick = () => game.zoomStep(-1);
  $('btn-home').onclick = () => game.fitView();
  $('btn-build').onclick = () => { sfx.unlock(); game.select(null); game.openSheet('build'); };
  $('btn-orders').onclick = () => { sfx.unlock(); game.openSheet('orders'); };
  $('btn-lang').onclick = () => { toggleLang(); game.refreshTexts(); };
  // volume da música (slider do menu ⚙️)
  document.addEventListener('input', (e) => { if (e.target.id === 'music-vol') music.setVolume(e.target.value / 100); });
  // Enter no campo de nome confirma
  $('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') game.saveName(e.target.value, true); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'intro-name') game.closeModal(); });
  $('tip-face').src = mentorFace();
  // áudio (efeitos e música) só pode começar após um gesto do usuário
  window.addEventListener('pointerdown', () => { sfx.unlock(); music.start(); }, { capture: true, once: true });
  // iOS suspende o áudio ao sair do app ou numa ligação: volta no próximo toque
  const resumeAudio = () => {
    if (ads.busy || document.hidden) return;
    for (const ctx of [sfx.ctx, music.theme !== 'off' && music.ctx]) if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
  };
  document.addEventListener('touchend', resumeAudio, { passive: true });
  document.addEventListener('click', resumeAudio);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

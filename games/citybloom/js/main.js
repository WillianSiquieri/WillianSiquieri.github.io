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
import { settingsView } from './ui/settings.js';
import { music } from './engine/music.js';
import { BUILDINGS, ITEMS, RESOURCE_LOTS, PHASES, phaseForLevel, xpToNext } from './game/config.js';
import * as E from './game/economy.js';
import { newGame, showcaseGame, load, save, resetSave, tileOf, population, happiness } from './game/state.js';
import { t, tn, toggleLang, setLang, fmtTime, fmtNum } from './i18n.js';

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

    const params = new URLSearchParams(location.search);
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
    this.input = new InputManager(canvas, this);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.fitView();

    setInterval(() => this._second(), 1000);
    setInterval(() => save(this.state), 10000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(this.state); });

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);

    // Cidade sem nome (jogo novo ou save antigo): pede um nome.
    if (!this.state.showcase && !this.state.cityName) setTimeout(() => this.openName(false), 700);
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
    const w = (R.x - L.x) + TW * 2.2, h = (B.y - T.y) + 220;
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
    const sel = this.scene.pick(this.state, w, tileAt);
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
        if (o) ads.rewarded('double').then(ok => {
          if (!ok) return;
          const d = BUILDINGS[o.type];
          const rr = d.type === 'house' ? E.collectRent(s, o, this.now(), 2) : E.collectIncome(s, o, this.now(), 2);
          this._result(rr, o.i, o.j, o.size); this.renderPanel();
        });
        return;
      case 'speed':
        if (o) ads.rewarded('speedup').then(ok => {
          if (!ok) return;
          const rr = E.speedUp(s, o, this.now());
          if (rr.ok) { sfx.coin(); save(s); } else this._error(rr);
          this.renderPanel();
        });
        return;
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
        ads.rewarded('reroll').then(ok => { if (ok && E.rerollOrder(s, Number(arg)).ok) { save(s); this.renderSheet(); } });
        return;
      case 'tab': this.buildTab = arg; this.renderSheet(); sfx.click(); return;
      case 'pick': this.startPlacing(arg); return;
      case 'placeOk': this.confirmPlacing(); return;
      case 'placeCancel': this.cancelPlacing(); return;
      case 'closePanel': this.select(null); return;
      case 'closeSheet': this.closeSheet(); return;
      case 'modalOk': this.closeModal(); return;
      default: return;
    }
    if (r) this._result(r, ...(at || [0, 0, 1]));
    this.renderPanel();
    if (this.sheet) this.renderSheet();
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
    if (r.silent === 'build') sfx.build();
    else if (r.silent === 'click') sfx.click();
    else if (r.coins) sfx.coin();
    else if (r.items || r.drop) sfx.collect();
    else if (r.xp) sfx.build();
    if (r.levels && r.levels.length) this.levelUp(r.levels, r.phaseChanged);
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

  _updatePlacing() {
    const p = this.placing;
    p.valid = E.canPlace(this.state, p.type, p.i, p.j);
    const def = BUILDINGS[p.type];
    $('place-name').textContent = tn(def.name);
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
    panel.classList.add('show');
  }

  // ---------------------------------------------------------------- nível
  levelUp(levels, phaseChanged) {
    const lv = levels[levels.length - 1];
    const unlocked = levels.flatMap(l => E.unlocksAt(l));
    this.modalQueue.push({ lv, unlocked, phase: phaseChanged ? phaseForLevel(lv) : null });
    if (!$('modal').classList.contains('show')) this._showModal();
    sfx.levelUp();
  }
  _showModal() {
    const m = this.modalQueue[0];
    if (!m) return;
    const list = m.unlocked.map(u => u.kind === 'building'
      ? `<li>${tn(BUILDINGS[u.key].name)}</li>`
      : `<li>${ITEMS[u.key].icon} ${tn(ITEMS[u.key].name)}</li>`).join('');
    $('modal-body').innerHTML = `
      <div class="burst">⭐</div>
      <h2>${t('levelUp', { n: m.lv })}</h2>
      ${m.phase ? `<p class="phase">${m.phase.icon} ${t('newPhase', { p: tn(m.phase.name) })}</p>` : ''}
      ${list ? `<p class="muted">${t('unlocked')}</p><ul>${list}</ul>` : `<p class="muted">${t('nothingNew')}</p>`}
      <button class="btn primary" data-act="modalOk">${t('great')}</button>`;
    $('modal').classList.add('show');
  }
  closeModal() {
    const m = this.modalQueue.shift();
    $('modal').classList.remove('show');
    if (m && m.phase) ads.interstitial();
    if (this.modalQueue.length) setTimeout(() => this._showModal(), 250);
  }

  // ---------------------------------------------------------------- tempo
  _second() {
    if (this.state.showcase) return;
    const changed = E.tick(this.state, this.now());
    if (this.selected) this.renderPanel();
    if (this.sheet === 'orders' || (changed && this.sheet === 'build')) this.renderSheet();
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.setViewport(w, h);
  }

  _loop() {
    const nowP = performance.now();
    const dt = Math.min(0.1, (nowP - this.lastFrame) / 1000);
    this.lastFrame = nowP;
    const time = this.time();
    this.scene.update(dt);
    this.scene.render(this.ctx, this.camera, this.dpr, this.state, time, this.now(), {
      selected: this.placing ? null : this.selected,
      ghost: this.placing,
      labels: this.state.showcase ? (ctx, o) => drawLabel(ctx, o, this.camera.zoom) : null,
    });
    this.fx.render(this.ctx, time);
    renderHud(this);
    requestAnimationFrame(this._loop);
  }
}

// ------------------------------------------------------------------ HUD
let hudKey = '';
function renderHud(game) {
  const s = game.state;
  const ph = phaseForLevel(s.level);
  const deliverable = s.orders.filter(o => E.canDeliver(s, o)).length;
  const tip = s.showcase ? null : E.currentTip(s);
  const key = [s.level, s.xp, s.coins, population(s), happiness(s), E.used(s), s.capacity, deliverable, tip, s.cityName, document.documentElement.lang].join('|');
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
  if (tip) { tipEl.textContent = '💡 ' + t(tip); tipEl.classList.add('show'); } else tipEl.classList.remove('show');
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
function boot() {
  ads.init();
  const game = new CityGame($('city'));
  window.__city = game;

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
  // áudio (efeitos e música) só pode começar após um gesto do usuário
  window.addEventListener('pointerdown', () => { sfx.unlock(); music.start(); }, { capture: true, once: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

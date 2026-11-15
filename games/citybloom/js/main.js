// main.js — CityBloom: boot, render isométrico, câmera e interface.
// Etapa atual ("preparar o terreno"): mapa com lotes livres/bloqueados, ruas,
// obstáculos e prédios iniciais; pan/zoom/pinça; tocar mostra informações.
// A mecânica de produção/coleta/pedidos entra na próxima etapa.

import { Camera } from './engine/camera.js';
import { InputManager } from './engine/input.js';
import { ads } from './engine/ads.js';
import {
  TW, TH, pt, tileAt, center,
  drawTile, drawSelection, drawBuilding, buildingHull, drawDecor, drawLot, drawObstacle, pointInPoly,
} from './engine/iso.js';
import { BUILDINGS, ITEMS, RESOURCE_LOTS, OBSTACLES, phaseForLevel, xpToNext } from './game/config.js';
import {
  newGame, showcaseGame, load, save, resetSave,
  tileOf, objectAt, population, happiness, lotPrice,
} from './game/state.js';
import { t, tn, toggleLang, fmtTime } from './i18n.js';

class CityGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.camera = new Camera();
    this.selected = null;   // { kind:'object', obj } | { kind:'tile', i, j }
    this.startT = performance.now();

    const params = new URLSearchParams(location.search);
    if (params.get('reset') === '1') resetSave();
    if (params.get('showcase') === '1') {
      this.state = showcaseGame();
    } else {
      const loaded = load();
      this.state = loaded || newGame();
      if (loaded) this._welcomeBack(Date.now() - loaded.lastSeen);
      save(this.state);
    }

    this.input = new InputManager(canvas, this);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.fitView();

    // Salva periodicamente e ao sair da aba (marca o horário para o offline).
    setInterval(() => save(this.state), 10000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(this.state); });

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---------- Câmera ----------
  fitView() {
    const s = this.state, cam = this.camera;
    let i0 = 0, j0 = 0, i1 = s.size, j1 = s.size;
    if (!s.showcase) {
      // enquadra a área liberada
      i0 = j0 = Infinity; i1 = j1 = -Infinity;
      for (let j = 0; j < s.size; j++) for (let i = 0; i < s.size; i++) {
        if (!tileOf(s, i, j).locked) { i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i + 1); j1 = Math.max(j1, j + 1); }
      }
    }
    const L = pt(i0, j1), R = pt(i1, j0), T = pt(i0, j0), B = pt(i1, j1);
    const w = (R.x - L.x) + TW * 1.5, h = (B.y - T.y) + 140;
    cam.zoom = Math.max(cam.minZoom, Math.min(cam.maxZoom, Math.min(cam.vw / w, (cam.vh - 120) / h)));
    cam.x = (L.x + R.x) / 2;
    cam.y = (T.y + B.y) / 2 - 20;
  }

  panByScreen(dx, dy) { this.camera.panByScreen(dx, dy); }
  zoomAt(sx, sy, f) { this.camera.zoomAt(sx, sy, f); }
  zoomStep(dir) { this.camera.zoomAt(this.camera.vw / 2, this.camera.vh / 2, dir > 0 ? 1.25 : 0.8); }

  // ---------- Toque ----------
  tap(sx, sy) {
    const w = this.camera.toWorld(sx, sy);
    // 1) prédios altos: testa o contorno de cada um, da frente para trás
    const list = this._drawList();
    for (let k = list.length - 1; k >= 0; k--) {
      const it = list[k];
      if (it.kind !== 'object') continue;
      const def = BUILDINGS[it.obj.type];
      if (def.type === 'lot' || def.type === 'decor') continue;
      if (pointInPoly(w, buildingHull(it.obj.i, it.obj.j, it.obj.size, def.look))) {
        return this._select({ kind: 'object', obj: it.obj });
      }
    }
    // 2) tile no chão
    const { i, j } = tileAt(w.x, w.y);
    const tile = tileOf(this.state, i, j);
    if (!tile) return this._select(null);
    const o = objectAt(this.state, i, j);
    this._select(o ? { kind: 'object', obj: o } : { kind: 'tile', i, j });
  }

  _select(sel) {
    this.selected = sel;
    renderInfo(this);
  }

  // ---------- Loop ----------
  _loop() {
    this._render((performance.now() - this.startT) / 1000);
    renderHud(this);
    requestAnimationFrame(this._loop);
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

  // Lista de desenho ordenada por profundidade (algoritmo do pintor).
  _drawList() {
    const s = this.state, list = [];
    for (const o of s.objects) {
      list.push({ kind: 'object', obj: o, depth: (o.i + o.size - 1) + (o.j + o.size - 1), i: o.i });
    }
    for (let j = 0; j < s.size; j++) for (let i = 0; i < s.size; i++) {
      const tl = s.tiles[j * s.size + i];
      if (tl.obstacle && !objectAt(s, i, j)) list.push({ kind: 'obstacle', i, j, type: tl.obstacle, depth: i + j });
    }
    list.sort((a, b) => a.depth - b.depth || a.i - b.i);
    return list;
  }

  _render(time) {
    const ctx = this.ctx, cam = this.camera, d = this.dpr, s = this.state;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    g.addColorStop(0, '#bfe6f7'); g.addColorStop(1, '#e6f6ee');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.setTransform(cam.zoom * d, 0, 0, cam.zoom * d,
      (cam.vw / 2 - cam.x * cam.zoom) * d, (cam.vh / 2 - cam.y * cam.zoom) * d);

    // Base de terra sob o mapa (efeito "maquete").
    const n = s.size, depth = 22;
    const L = pt(0, n), B = pt(n, n), R = pt(n, 0);
    const down = (p) => ({ x: p.x, y: p.y + depth });
    ctx.fillStyle = '#9b6b43';
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(B.x, B.y); ctx.lineTo(down(B).x, down(B).y); ctx.lineTo(down(L).x, down(L).y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7f5534';
    ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(R.x, R.y); ctx.lineTo(down(R).x, down(R).y); ctx.lineTo(down(B).x, down(B).y); ctx.closePath(); ctx.fill();

    // Chão
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const tl = s.tiles[j * n + i];
      drawTile(ctx, i, j, tl.kind, tl.locked);
    }

    // Seleção (no chão, antes dos prédios)
    const sel = this.selected;
    if (sel) {
      if (sel.kind === 'tile') drawSelection(ctx, sel.i, sel.j, 1);
      else drawSelection(ctx, sel.obj.i, sel.obj.j, sel.obj.size, '#ffe066');
    }

    // Objetos por profundidade
    const now = Date.now();
    const labels = [];
    for (const it of this._drawList()) {
      if (it.kind === 'obstacle') { drawObstacle(ctx, it.i, it.j, it.type); continue; }
      const o = it.obj, def = BUILDINGS[o.type];
      if (def.type === 'lot') {
        const prog = o.resource ? lotProgress(o, now) : 0;
        drawLot(ctx, o.i, o.j, o.resource, prog);
        if (o.resource && prog >= 1) drawBubble(ctx, center(o.i, o.j), ITEMS[o.resource].icon, time);
      } else if (def.type === 'decor') {
        drawDecor(ctx, o.i, o.j, def.look, time);
      } else {
        drawBuilding(ctx, o.i, o.j, o.size, def.look, time, o.id);
      }
      if (s.showcase) labels.push([o, def]);
    }
    // Rótulos (vitrine) por último, para nunca ficarem atrás de prédios.
    for (const [o, def] of labels) drawLabel(ctx, o, def, cam.zoom);
  }

  _welcomeBack(ms) {
    if (ms < 60 * 1000) return;
    const sec = Math.round(ms / 1000);
    toast((navigator.language || '').toLowerCase().startsWith('pt')
      ? `Bem-vindo de volta! Você ficou fora ${fmtTime(sec)}.`
      : `Welcome back! You were away for ${fmtTime(sec)}.`);
  }
}

// ---------------------------------------------------------------------------
// Auxiliares de desenho
// ---------------------------------------------------------------------------
function lotProgress(o, now) {
  const r = RESOURCE_LOTS[o.resource];
  if (!r || !o.startedAt) return 0;
  return Math.min(1, (now - o.startedAt) / (r.time * 1000));
}

function drawBubble(ctx, c, icon, time) {
  const bob = Math.sin(time * 3) * 2;
  const x = c.x, y = c.y - 34 + bob;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 4, y + 9); ctx.lineTo(x, y + 15); ctx.lineTo(x + 4, y + 9); ctx.fill();
  ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(icon, x, y + 1);
}

function drawLabel(ctx, o, def, zoom) {
  const c = center(o.i, o.j, o.size);
  const fs = Math.max(9, Math.min(16, 11 / zoom));
  ctx.font = `600 ${fs}px -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const label = tn(def.name) + (o.resource ? ` (${tn(ITEMS[o.resource].name)})` : '');
  const y = c.y + (TH / 2) * o.size + 4;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(label, c.x, y);
  ctx.fillStyle = '#1f2430';
  ctx.fillText(label, c.x, y);
}

// ---------------------------------------------------------------------------
// HUD (DOM)
// ---------------------------------------------------------------------------
let hudCache = '';
function renderHud(game) {
  const s = game.state;
  const ph = phaseForLevel(s.level);
  const need = xpToNext(s.level);
  const key = [s.level, s.xp, s.coins, population(s), happiness(s), ph.id, document.documentElement.lang].join('|');
  if (key === hudCache) return;
  hudCache = key;
  document.getElementById('hud-phase').textContent = `${ph.icon} ${tn(ph.name)}`;
  document.getElementById('hud-level').textContent = `${t('level')} ${s.level}`;
  document.getElementById('hud-xpbar').style.width = `${Math.min(100, (s.xp / need) * 100)}%`;
  document.getElementById('hud-coins').textContent = `🪙 ${s.coins}`;
  document.getElementById('hud-pop').textContent = `👥 ${population(s)}`;
  document.getElementById('hud-happy').textContent = `⭐ ${happiness(s)}`;
  document.getElementById('btn-lang').textContent = t('lang');
  if (s.showcase) document.getElementById('hud-phase').textContent = `🧪 ${t('showcase')}`;
}

// ---------------------------------------------------------------------------
// Painel de informações (bottom sheet)
// ---------------------------------------------------------------------------
function renderInfo(game) {
  const panel = document.getElementById('info');
  const sel = game.selected;
  if (!sel) { panel.classList.remove('show'); return; }
  const s = game.state;
  let title = '', lines = [];

  if (sel.kind === 'tile') {
    const tile = tileOf(s, sel.i, sel.j);
    if (tile.obstacle) {
      const ob = OBSTACLES[tile.obstacle];
      title = tn(ob.name);
      lines.push(`${t('clearFor')} ${ob.clear} 🪙 · +${ob.xp} XP`);
    } else if (tile.locked) {
      title = t('locked');
      lines.push(t('lockedDesc'));
      lines.push(`${t('buyFor')} ${lotPrice(s, sel.i, sel.j)} 🪙`);
    } else if (tile.kind === 'road') {
      title = t('road'); lines.push(t('roadDesc'));
    } else {
      title = t('grass'); lines.push(t('grassDesc'));
    }
  } else {
    const o = sel.obj, def = BUILDINGS[o.type];
    title = tn(def.name);
    if (def.desc) lines.push(tn(def.desc));
    if (def.type === 'house') {
      lines.push(`👥 ${def.residents} ${t('residents')} · 🪙 ${def.rent} ${t('rent')} ${t('every')} ${fmtTime(def.rentTime)}`);
    }
    if (def.recipes) {
      for (const r of def.recipes) {
        const ins = Object.entries(r.in).map(([k, v]) => `${v}× ${ITEMS[k].icon}`).join(' + ');
        lines.push(`${t('producing')}: ${ins} → ${ITEMS[r.out].icon} ${tn(ITEMS[r.out].name)} (${fmtTime(r.time)})`);
      }
    }
    if (def.type === 'lot') {
      if (o.resource) {
        const r = RESOURCE_LOTS[o.resource];
        const left = Math.max(0, Math.ceil(r.time - (Date.now() - o.startedAt) / 1000));
        lines.push(`${ITEMS[o.resource].icon} ${tn(ITEMS[o.resource].name)} — ${left > 0 ? fmtTime(left) : '✅'}`);
      } else {
        lines.push(t('emptyLot'));
      }
    }
    if (def.unlock > 1) lines.push(`${t('unlocksAt')} ${def.unlock}`);
  }
  lines.push(`<span class="soon">${t('comingSoon')}</span>`);

  panel.querySelector('.info-title').textContent = title;
  panel.querySelector('.info-body').innerHTML = lines.map(l => `<p>${l}</p>`).join('');
  panel.classList.add('show');
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function boot() {
  ads.init();
  const game = new CityGame(document.getElementById('city'));
  window.__city = game; // depuração

  const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
  on('btn-zoom-in', () => game.zoomStep(1));
  on('btn-zoom-out', () => game.zoomStep(-1));
  on('btn-home', () => game.fitView());
  on('btn-lang', () => { toggleLang(); hudCache = ''; renderInfo(game); });
  on('info-close', () => game._select(null));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

// main.js — orquestrador do jogo.
// Marco 1: desenhar + deslizar (sandbox). Marco 3: fases com objetivos
// (início, estrelas, bandeira de chegada), cronômetro e telas de menu/vitória.

import { Camera } from './engine/camera.js';
import { integrate, satisfyConstraints, collide } from './engine/physics.js';
import { Track, simplifyStroke } from './game/track.js';
import { Rider, RIDER_RADIUS } from './game/rider.js';
import { InputManager } from './ui/input.js';
import { History } from './ui/history.js';
import { LEVELS, getLevel, nextLevelId } from './game/levels.js';
import { getProgress, recordLevelResult, saveSandbox, loadSandbox } from './game/storage.js';
import { sfx } from './engine/audio.js';

// ---- Parâmetros de física (por passo fixo) ----
const FIXED_DT = 1 / 60;
const STEPS_MAX = 5;
const GRAVITY = 0.52;        // gravidade um pouco mais forte = descida mais viva
const DAMPING = 0.9995;      // menos perda de energia no ar (mantém velocidade)
const FRICTION = 0.008;      // menos atrito com a pista = desliza mais solto
const CONSTRAINT_ITERS = 4;
const MIN_STROKE_DIST = 6;
const ERASE_RADIUS = 16;
const KICK_VX = 4.0;         // empurrão inicial maior = largada mais rápida
const ZOOM_STEP = 1.25;      // fator dos botões +/-

// ---- Objetivos ----
const STAR_RADIUS = 26;
const FINISH_RADIUS = 30;
const FALL_MARGIN = 1400;   // quão abaixo do nível o personagem pode cair antes de falhar

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.camera = new Camera();
    this.track = new Track();
    this.history = new History();

    this.mode = 'edit';          // 'edit' | 'play'
    this.tool = 'pencil';
    this.screen = 'menu';        // 'menu' | 'game'
    this.level = null;           // fase atual (null = sandbox)
    this.isSandbox = false;

    this.startPoint = { x: 0, y: -40 };
    this.rider = new Rider(this.startPoint.x, this.startPoint.y);

    this.stars = [];             // [{x,y,collected}]
    this.finish = null;          // {x,y} ou null (sandbox)
    this.playTime = 0;
    this.result = null;          // 'won' | 'lost' | null
    this.failY = Infinity;

    this.currentStroke = null;
    this.eraseBatch = null;

    this.acc = 0;
    this.lastT = performance.now();

    this.input = new InputManager(canvas, this.camera, this);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => this._resize());

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---------- Carregar fase / sandbox ----------
  loadLevel(id) {
    const lvl = getLevel(id);
    if (!lvl) return;
    this.level = lvl;
    this.isSandbox = false;
    this.screen = 'game';
    this.track.clear();
    for (const [ax, ay, bx, by] of (lvl.fixed || [])) {
      this.track.addSegment(ax, ay, bx, by, true); // fixo
    }
    this.startPoint = { ...lvl.start };
    this.finish = { ...lvl.finish };
    this.stars = (lvl.stars || []).map(s => ({ x: s.x, y: s.y, collected: false }));
    this._computeFailY();
    this.history.clear();
    this._enterEdit(true);
    this._hideOverlays();
    this._setHint(lvl.hint);
    this._syncHud();
  }

  loadSandboxMode() {
    this.level = null;
    this.isSandbox = true;
    this.screen = 'game';
    this.track.clear();
    const saved = loadSandbox();
    if (saved && saved.length) {
      for (const [ax, ay, bx, by] of saved) this.track.addSegment(ax, ay, bx, by, false);
    }
    this.startPoint = { x: 0, y: -40 };
    this.finish = null;
    this.stars = [];
    this.failY = Infinity;
    this.history.clear();
    this._enterEdit(true);
    this._hideOverlays();
    this._setHint('Modo livre: desenhe o que quiser e toque em ▶.');
    this._syncHud();
  }

  goToMenu() {
    this.mode = 'edit';
    this.screen = 'menu';
    this._hideOverlays();
    document.getElementById('menu').classList.add('show');
    renderMenu(this);
    this._syncHud();
  }

  _computeFailY() {
    let maxY = this.startPoint.y;
    if (this.finish) maxY = Math.max(maxY, this.finish.y);
    for (const s of this.stars) maxY = Math.max(maxY, s.y);
    for (const seg of this.track.segments) maxY = Math.max(maxY, seg.a.y, seg.b.y);
    this.failY = maxY + FALL_MARGIN;
  }

  // ---------- Delegate de entrada ----------
  getTool() { return this.mode === 'play' ? 'pan' : this.tool; }

  strokeStart(w) { if (this.mode === 'edit') this.currentStroke = [w]; }
  strokeMove(w) { if (this.currentStroke) this.currentStroke.push(w); }
  strokeEnd() {
    if (this.currentStroke) {
      const pts = simplifyStroke(this.currentStroke, MIN_STROKE_DIST);
      this.currentStroke = null;
      if (pts.length >= 2) {
        const added = [];
        for (let i = 0; i < pts.length - 1; i++)
          added.push(this.track.addSegment(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y));
        const track = this.track;
        this.history.push({
          undo: () => track.removeSegments(added),
          redo: () => track.addSegments(added),
        });
      }
    }
    if (this.eraseBatch && this.eraseBatch.length) {
      const removed = this.eraseBatch;
      const track = this.track;
      this.history.push({
        undo: () => track.addSegments(removed),
        redo: () => track.removeSegments(removed),
      });
    }
    this.eraseBatch = null;
    this._syncHud();
  }

  eraseAt(w) {
    if (this.mode !== 'edit') return;
    if (!this.eraseBatch) this.eraseBatch = [];
    const removed = this.track.eraseAt(w.x, w.y, ERASE_RADIUS / this.camera.zoom);
    if (removed.length) this.eraseBatch.push(...removed);
  }

  panByScreen(dx, dy) { this.camera.panByScreen(dx, dy); }
  zoomAt(sx, sy, factor) { this.camera.zoomAt(sx, sy, factor); }

  // Zoom pelos botões +/- (ancorado no centro da tela).
  zoomInOut(dir) {
    const factor = dir > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.camera.zoomAt(this.camera.vw / 2, this.camera.vh / 2, factor);
  }

  toggleMute() {
    const muted = sfx.toggleMute();
    const b = document.getElementById('btn-mute');
    if (b) b.textContent = muted ? '🔇' : '🔊';
    if (!muted) sfx.click();
  }

  // ---------- Controles ----------
  setTool(tool) { this.tool = tool; sfx.click(); this._syncHud(); }

  _enterEdit(recenter) {
    this.mode = 'edit';
    this.result = null;
    this.rider.start = { ...this.startPoint };
    this.rider.reset();
    for (const s of this.stars) s.collected = false;
    this.playTime = 0;
    if (recenter) {
      if (!this.isSandbox && this.finish) this._fitToLevel();
      else { this.camera.x = this.startPoint.x; this.camera.y = this.startPoint.y + 120; }
    }
    this._syncHud();
  }

  // Enquadra a câmera para mostrar início, chegada, estrelas e obstáculos.
  _fitToLevel() {
    const pts = [this.startPoint, this.finish, ...this.stars];
    for (const s of this.track.segments) { if (s.locked) { pts.push(s.a, s.b); } }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const pad = 110;
    const w = (maxX - minX) + pad * 2;
    const h = (maxY - minY) + pad * 2;
    const cam = this.camera;
    const zoom = Math.min(cam.vw / w, cam.vh / h, cam.maxZoom);
    cam.zoom = Math.max(cam.minZoom, zoom);
    cam.x = (minX + maxX) / 2;
    cam.y = (minY + maxY) / 2;
  }

  play() {
    if (this.mode === 'play') return;
    this.mode = 'play';
    this.result = null;
    this.rider.start = { ...this.startPoint };
    this.rider.reset();
    this.rider.kick(KICK_VX);
    for (const s of this.stars) s.collected = false;
    this.playTime = 0;
    this.acc = 0;
    this._hideOverlays();
    sfx.start();
    this._syncHud();
  }
  pause() { this.mode = 'edit'; this._syncHud(); }
  reset() { this._enterEdit(true); this._hideOverlays(); }

  clearTrack() {
    if (this.isSandbox) { this.track.clear(); }
    else { this.track.clearUnlocked(); }
    this.history.clear();
    this._syncHud();
  }

  undo() { this.history.undo(); this._syncHud(); }
  redo() { this.history.redo(); this._syncHud(); }

  saveSandboxNow() {
    const ok = saveSandbox(this.track.userSegments().map(s => [
      Math.round(s.a.x), Math.round(s.a.y), Math.round(s.b.x), Math.round(s.b.y),
    ]));
    toast(ok ? 'Pista salva neste navegador ✓' : 'Não foi possível salvar :(');
  }

  // ---------- Loop ----------
  _loop(t) {
    const dtMs = t - this.lastT;
    this.lastT = t;

    if (this.mode === 'play') {
      this.acc += Math.min(dtMs / 1000, 0.1);
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < STEPS_MAX) {
        this._physicsStep();
        this.playTime += FIXED_DT;
        this.acc -= FIXED_DT;
        steps++;
        if (this.mode !== 'play') break; // ganhou/perdeu dentro do passo
      }
      const c = this.rider.center();
      this.camera.follow(c.x, c.y, 0.12);
      this._syncHud();
    }

    this._render();
    requestAnimationFrame(this._loop);
  }

  _physicsStep() {
    const r = this.rider;
    integrate(r.points, 1, GRAVITY, DAMPING);
    for (let i = 0; i < CONSTRAINT_ITERS; i++) {
      satisfyConstraints(r.constraints, 1);
      collide(r.points, this.track.grid, RIDER_RADIUS, FRICTION);
    }
    this._checkObjectives();
  }

  _checkObjectives() {
    const c = this.rider.center();
    // Coleta de estrelas
    for (const s of this.stars) {
      if (!s.collected) {
        const dx = c.x - s.x, dy = c.y - s.y;
        if (dx * dx + dy * dy <= STAR_RADIUS * STAR_RADIUS) { s.collected = true; sfx.star(); }
      }
    }
    // Chegada
    if (this.finish) {
      const dx = c.x - this.finish.x, dy = c.y - this.finish.y;
      if (dx * dx + dy * dy <= FINISH_RADIUS * FINISH_RADIUS) { this._win(); return; }
    }
    // Queda
    if (c.y > this.failY) this._lose();
  }

  _win() {
    this.mode = 'edit';
    this.result = 'won';
    const total = this.stars.length;
    const got = this.stars.filter(s => s.collected).length;
    if (this.level) recordLevelResult(this.level.id, this.playTime, got);
    sfx.win();
    showWin(this, got, total, this.playTime);
  }
  _lose() {
    this.mode = 'edit';
    this.result = 'lost';
    sfx.lose();
    showLose(this);
  }

  // ---------- Render ----------
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.setViewport(w, h);
  }

  _worldTransform() {
    const cam = this.camera, d = this.dpr;
    this.ctx.setTransform(
      cam.zoom * d, 0, 0, cam.zoom * d,
      (cam.vw / 2 - cam.x * cam.zoom) * d,
      (cam.vh / 2 - cam.y * cam.zoom) * d
    );
  }

  _render() {
    const ctx = this.ctx;
    const css = getComputedStyle(document.documentElement);
    const C = {
      bg: css.getPropertyValue('--bg').trim() || '#f4f6f8',
      line: css.getPropertyValue('--line').trim() || '#222',
      grid: css.getPropertyValue('--grid').trim() || 'rgba(0,0,0,0.06)',
      accent: css.getPropertyValue('--accent').trim() || '#2e7dff',
      fixed: css.getPropertyValue('--fixed').trim() || '#8a93a6',
      star: '#f5b301',
      finish: '#17b26a',
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this._worldTransform();
    this._drawGrid(C.grid);

    // Segmentos: fixos primeiro (cinza), depois os do jogador.
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    // fixos
    ctx.strokeStyle = C.fixed;
    ctx.beginPath();
    for (const s of this.track.segments) if (s.locked) { ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); }
    ctx.stroke();
    // jogador
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    for (const s of this.track.segments) if (!s.locked) { ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); }
    ctx.stroke();

    if (this.currentStroke && this.currentStroke.length > 1) {
      ctx.strokeStyle = C.accent;
      ctx.beginPath();
      ctx.moveTo(this.currentStroke[0].x, this.currentStroke[0].y);
      for (const p of this.currentStroke) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    for (const s of this.stars) this._drawStar(s, C.star);
    if (this.finish) this._drawFinish(this.finish, C.finish);
    this._drawStart(C.accent);
    this._drawRider(C.line, C.accent);
  }

  _drawGrid(color) {
    const ctx = this.ctx, cam = this.camera, step = 80;
    const left = cam.x - cam.vw / (2 * cam.zoom);
    const right = cam.x + cam.vw / (2 * cam.zoom);
    const top = cam.y - cam.vh / (2 * cam.zoom);
    const bottom = cam.y + cam.vh / (2 * cam.zoom);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / cam.zoom;
    ctx.beginPath();
    for (let x = Math.floor(left / step) * step; x < right; x += step) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (let y = Math.floor(top / step) * step; y < bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();
  }

  _drawStart(accent) {
    const ctx = this.ctx, s = this.startPoint;
    ctx.fillStyle = accent; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawStar(s, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalAlpha = s.collected ? 0.2 : 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    const R = 13, r = 5.5;
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI / 5) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? R : r;
      const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawFinish(f, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(f.x, f.y + 22); ctx.lineTo(f.x, f.y - 26); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - 26); ctx.lineTo(f.x + 26, f.y - 18); ctx.lineTo(f.x, f.y - 8);
    ctx.closePath(); ctx.fill();
  }

  _drawRider(line, accent) {
    const ctx = this.ctx, r = this.rider;
    ctx.strokeStyle = line; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(r.tail.x, r.tail.y); ctx.lineTo(r.nose.x, r.nose.y); ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(r.nose.x, r.nose.y); ctx.lineTo(r.tail.x, r.tail.y); ctx.lineTo(r.body.x, r.body.y);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(r.body.x, r.body.y, 6, 0, Math.PI * 2); ctx.fillStyle = line; ctx.fill();
  }

  // ---------- HUD ----------
  _syncHud() {
    for (const [id, tool] of [['tool-pencil', 'pencil'], ['tool-eraser', 'eraser'], ['tool-pan', 'pan']]) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', this.tool === tool && this.mode === 'edit');
    }
    const playing = this.mode === 'play';
    const pb = document.getElementById('btn-play');
    if (pb) pb.textContent = playing ? '❚❚' : '▶';
    const u = document.getElementById('btn-undo'), rd = document.getElementById('btn-redo');
    if (u) u.disabled = !this.history.canUndo();
    if (rd) rd.disabled = !this.history.canRedo();
    document.body.classList.toggle('playing', playing);
    document.body.classList.toggle('sandbox', this.isSandbox);

    // HUD de objetivos
    const hud = document.getElementById('hud');
    if (hud) {
      if (this.screen === 'game' && (this.finish || this.stars.length)) {
        hud.style.display = 'flex';
        const got = this.stars.filter(s => s.collected).length;
        const name = document.getElementById('hud-level');
        const stars = document.getElementById('hud-stars');
        const time = document.getElementById('hud-time');
        if (name) name.textContent = this.level ? this.level.name : 'Sandbox';
        if (stars) stars.textContent = this.stars.length ? `⭐ ${got}/${this.stars.length}` : '';
        if (time) time.textContent = `⏱ ${this.playTime.toFixed(1)}s`;
      } else {
        hud.style.display = 'none';
      }
    }
  }

  _setHint(text) {
    const h = document.getElementById('hint');
    if (!h) return;
    h.textContent = text || '';
    h.style.display = text ? 'block' : 'none';
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => { h.style.display = 'none'; }, 5000);
  }

  _hideOverlays() {
    for (const id of ['menu', 'win', 'lose']) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    }
  }
}

// ---------- Overlays (UI em DOM) ----------
function fmt(t) { return t.toFixed(1) + 's'; }

function renderMenu(game) {
  const list = document.getElementById('level-list');
  if (!list) return;
  const progress = getProgress();
  list.innerHTML = '';
  for (const lvl of LEVELS) {
    const p = progress[lvl.id];
    const btn = document.createElement('button');
    btn.className = 'level-card' + (p && p.completed ? ' done' : '');
    btn.innerHTML = `
      <span class="lv-name">${lvl.name}</span>
      <span class="lv-meta">${p && p.completed
        ? `✓ melhor: ${fmt(p.bestTime)} · ⭐${p.bestStars}/${lvl.stars.length}`
        : `⭐ ${lvl.stars.length} estrela(s)`}</span>`;
    btn.addEventListener('click', () => game.loadLevel(lvl.id));
    list.appendChild(btn);
  }
}

function showWin(game, got, total, time) {
  const el = document.getElementById('win');
  if (!el) return;
  document.getElementById('win-time').textContent = fmt(time);
  document.getElementById('win-stars').textContent = total ? `⭐ ${got}/${total}` : '';
  const nextId = game.level ? nextLevelId(game.level.id) : null;
  const nextBtn = document.getElementById('win-next');
  nextBtn.style.display = nextId ? 'inline-flex' : 'none';
  nextBtn.onclick = () => nextId && game.loadLevel(nextId);
  document.getElementById('win-retry').onclick = () => game.reset();
  document.getElementById('win-menu').onclick = () => game.goToMenu();
  el.classList.add('show');
}

function showLose(game) {
  const el = document.getElementById('lose');
  if (!el) return;
  document.getElementById('lose-retry').onclick = () => game.reset();
  document.getElementById('lose-menu').onclick = () => game.goToMenu();
  el.classList.add('show');
}

let toastTimer;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ---------- Bootstrap ----------
function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.__game = game;

  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

  on('tool-pencil', () => game.setTool('pencil'));
  on('tool-eraser', () => game.setTool('eraser'));
  on('tool-pan', () => game.setTool('pan'));
  on('btn-play', () => (game.mode === 'play' ? game.pause() : game.play()));
  on('btn-reset', () => game.reset());
  on('btn-clear', () => { if (confirm('Apagar suas linhas desta pista?')) game.clearTrack(); });
  on('btn-undo', () => game.undo());
  on('btn-redo', () => game.redo());
  on('btn-menu', () => game.goToMenu());
  on('btn-save', () => game.saveSandboxNow());
  on('open-sandbox', () => game.loadSandboxMode());
  on('btn-zoom-in', () => game.zoomInOut(1));
  on('btn-zoom-out', () => game.zoomInOut(-1));
  on('btn-mute', () => game.toggleMute());
  on('btn-theme', () => {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  });

  // Destrava o áudio no primeiro gesto do usuário (política de autoplay).
  const unlock = () => sfx.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  // Estado inicial do botão de mudo.
  const mb = document.getElementById('btn-mute');
  if (mb) mb.textContent = sfx.isMuted() ? '🔇' : '🔊';

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ') { e.preventDefault(); game.mode === 'play' ? game.pause() : game.play(); }
    else if (e.key === 'r' || e.key === 'R') game.reset();
    else if (e.key === 'p' || e.key === 'P') game.setTool('pencil');
    else if (e.key === 'e' || e.key === 'E') game.setTool('eraser');
    else if (e.key === 'h' || e.key === 'H') game.setTool('pan');
    else if (e.key === '+' || e.key === '=') game.zoomInOut(1);
    else if (e.key === '-' || e.key === '_') game.zoomInOut(-1);
    else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? game.redo() : game.undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); game.redo(); }
  });

  // Começa no menu.
  game.goToMenu();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

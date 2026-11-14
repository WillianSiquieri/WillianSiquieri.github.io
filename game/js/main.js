// main.js — orquestrador do jogo (Marco 1: MVP).
// Monta canvas, câmera, pista, personagem, entrada e o game loop.

import { Camera } from './engine/camera.js';
import { integrate, satisfyConstraints, collide } from './engine/physics.js';
import { Track, simplifyStroke } from './game/track.js';
import { Rider, RIDER_RADIUS } from './game/rider.js';
import { InputManager } from './ui/input.js';
import { History } from './ui/history.js';

// ---- Parâmetros de física (por passo fixo) ----
const FIXED_DT = 1 / 60;
const STEPS_MAX = 5;            // evita "espiral da morte" se o frame travar
const GRAVITY = 0.4;            // aceleração por passo (unidades de mundo)
const DAMPING = 0.999;          // atrito do ar
const FRICTION = 0.02;          // atrito com a pista
const CONSTRAINT_ITERS = 4;     // rigidez do corpo por passo
const MIN_STROKE_DIST = 6;      // simplificação do traço do lápis
const ERASE_RADIUS = 16;

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.camera = new Camera();
    this.track = new Track();
    this.history = new History();

    this.mode = 'edit';         // 'edit' | 'play'
    this.tool = 'pencil';       // 'pencil' | 'eraser' | 'pan'

    this.startPoint = { x: 0, y: 40 };
    this.rider = new Rider(this.startPoint.x, this.startPoint.y);

    this.currentStroke = null;  // traço do lápis em andamento (pontos de mundo)
    this.eraseBatch = null;     // segmentos removidos no gesto da borracha

    this.acc = 0;
    this.lastT = performance.now();

    this.input = new InputManager(canvas, this.camera, this);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => this._resize());

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---------- Delegate de entrada ----------
  getTool() { return this.mode === 'play' ? 'pan' : this.tool; }

  strokeStart(w) {
    if (this.mode !== 'edit') return;
    this.currentStroke = [w];
  }
  strokeMove(w) {
    if (!this.currentStroke) return;
    this.currentStroke.push(w);
  }
  strokeEnd() {
    // Finaliza lápis
    if (this.currentStroke) {
      const pts = simplifyStroke(this.currentStroke, MIN_STROKE_DIST);
      this.currentStroke = null;
      if (pts.length >= 2) {
        const added = [];
        for (let i = 0; i < pts.length - 1; i++) {
          added.push(this.track.addSegment(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y));
        }
        const track = this.track;
        this.history.push({
          undo: () => track.removeSegments(added),
          redo: () => track.addSegments(added),
        });
      }
    }
    // Finaliza lote da borracha
    if (this.eraseBatch && this.eraseBatch.length) {
      const removed = this.eraseBatch;
      const track = this.track;
      this.history.push({
        undo: () => track.addSegments(removed),
        redo: () => track.removeSegments(removed),
      });
    }
    this.eraseBatch = null;
    this._updateButtons();
  }

  eraseAt(w) {
    if (this.mode !== 'edit') return;
    if (!this.eraseBatch) this.eraseBatch = [];
    const removed = this.track.eraseAt(w.x, w.y, ERASE_RADIUS / this.camera.zoom);
    if (removed.length) this.eraseBatch.push(...removed);
  }

  panByScreen(dx, dy) { this.camera.panByScreen(dx, dy); }
  zoomAt(sx, sy, factor) { this.camera.zoomAt(sx, sy, factor); }

  // ---------- Controles ----------
  setTool(tool) {
    this.tool = tool;
    this._updateButtons();
  }

  play() {
    if (this.mode === 'play') return;
    this.mode = 'play';
    this.rider.reset();
    this.rider.kick();
    this.acc = 0;
    this._updateButtons();
  }
  pause() {
    this.mode = 'edit';
    this._updateButtons();
  }
  reset() {
    this.mode = 'edit';
    this.rider.reset();
    this.camera.follow(this.startPoint.x, this.startPoint.y, 1);
    this._updateButtons();
  }
  clearTrack() {
    this.track.clear();
    this.history.clear();
    this._updateButtons();
  }
  undo() { this.history.undo(); this._updateButtons(); }
  redo() { this.history.redo(); this._updateButtons(); }

  // ---------- Loop ----------
  _loop(t) {
    const dtMs = t - this.lastT;
    this.lastT = t;

    if (this.mode === 'play') {
      this.acc += Math.min(dtMs / 1000, 0.1);
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < STEPS_MAX) {
        this._physicsStep();
        this.acc -= FIXED_DT;
        steps++;
      }
      const c = this.rider.center();
      this.camera.follow(c.x, c.y, 0.12);
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
  }

  // ---------- Render ----------
  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
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
    const bg = css.getPropertyValue('--bg').trim() || '#f4f6f8';
    const line = css.getPropertyValue('--line').trim() || '#222';
    const grid = css.getPropertyValue('--grid').trim() || 'rgba(0,0,0,0.06)';
    const accent = css.getPropertyValue('--accent').trim() || '#2e7dff';

    // limpa (coordenadas de dispositivo)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this._worldTransform();
    this._drawGrid(grid);

    // pista
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const s of this.track.segments) {
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();

    // traço em andamento
    if (this.currentStroke && this.currentStroke.length > 1) {
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.moveTo(this.currentStroke[0].x, this.currentStroke[0].y);
      for (const p of this.currentStroke) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    this._drawStart(accent);
    this._drawRider(line, accent);
  }

  _drawGrid(color) {
    const ctx = this.ctx;
    const cam = this.camera;
    const step = 80;
    const left = cam.x - cam.vw / (2 * cam.zoom);
    const right = cam.x + cam.vw / (2 * cam.zoom);
    const top = cam.y - cam.vh / (2 * cam.zoom);
    const bottom = cam.y + cam.vh / (2 * cam.zoom);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / cam.zoom;
    ctx.beginPath();
    for (let x = Math.floor(left / step) * step; x < right; x += step) {
      ctx.moveTo(x, top); ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / step) * step; y < bottom; y += step) {
      ctx.moveTo(left, y); ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  _drawStart(accent) {
    const ctx = this.ctx;
    const s = this.startPoint;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawRider(line, accent) {
    const ctx = this.ctx;
    const r = this.rider;
    // trenó (base nariz->cauda)
    ctx.strokeStyle = line;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(r.tail.x, r.tail.y);
    ctx.lineTo(r.nose.x, r.nose.y);
    ctx.stroke();
    // corpo (triângulo preenchido)
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(r.nose.x, r.nose.y);
    ctx.lineTo(r.tail.x, r.tail.y);
    ctx.lineTo(r.body.x, r.body.y);
    ctx.closePath();
    ctx.fill();
    // cabeça
    ctx.beginPath();
    ctx.arc(r.body.x, r.body.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = line;
    ctx.fill();
  }

  // ---------- UI ----------
  _updateButtons() {
    for (const [id, tool] of [['tool-pencil', 'pencil'], ['tool-eraser', 'eraser'], ['tool-pan', 'pan']]) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', this.tool === tool && this.mode === 'edit');
    }
    const playing = this.mode === 'play';
    const pb = document.getElementById('btn-play');
    if (pb) pb.textContent = playing ? '❚❚' : '▶';
    const u = document.getElementById('btn-undo');
    const rd = document.getElementById('btn-redo');
    if (u) u.disabled = !this.history.canUndo();
    if (rd) rd.disabled = !this.history.canRedo();
    document.body.classList.toggle('playing', playing);
  }
}

// ---------- Bootstrap ----------
function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.__game = game; // útil para depurar no console

  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  on('tool-pencil', () => game.setTool('pencil'));
  on('tool-eraser', () => game.setTool('eraser'));
  on('tool-pan', () => game.setTool('pan'));
  on('btn-play', () => (game.mode === 'play' ? game.pause() : game.play()));
  on('btn-reset', () => game.reset());
  on('btn-clear', () => { if (confirm('Limpar toda a pista?')) game.clearTrack(); });
  on('btn-undo', () => game.undo());
  on('btn-redo', () => game.redo());
  on('btn-theme', () => {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  });

  // Atalhos de teclado (desktop)
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ') { e.preventDefault(); game.mode === 'play' ? game.pause() : game.play(); }
    else if (e.key === 'r' || e.key === 'R') game.reset();
    else if (e.key === 'p' || e.key === 'P') game.setTool('pencil');
    else if (e.key === 'e' || e.key === 'E') game.setTool('eraser');
    else if (e.key === 'h' || e.key === 'H') game.setTool('pan');
    else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? game.redo() : game.undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); game.redo(); }
  });

  game._updateButtons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

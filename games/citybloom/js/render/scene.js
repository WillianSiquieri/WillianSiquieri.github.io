// scene.js — monta o quadro: céu, base do mapa, chão (sprites), terra à venda,
// seleção, objetos em ordem de profundidade (prédios, lotes, obstáculos, postes,
// carros, placas), animações, bolhas de "pronto" e fantasma de construção.

import { pt, center } from '../engine/iso.js';
import { up, poly, roundRect } from './kit.js';
import { grassTile, roadTile, roadType, lotSprite, lockedOverlay, forSaleSign, mapBase } from './terrain.js';
import { bush, rubble, abandonedCar, lamp, car, hash } from './props.js';
import { PAINT, ANIM, HEIGHT } from './buildings.js';
import { SpriteCache, bboxBuilding, BBOX_TILE, BBOX_LOT, BBOX_PROP } from './sprites.js';
import { Traffic } from './traffic.js';
import { BUILDINGS, MAP } from '../game/config.js';
import { lotProgress, readyIcon, chunkBuyable, chunkPrice } from '../game/economy.js';
import { objectAt } from '../game/state.js';

const OBSTACLE_PAINT = {
  bush: (cx) => bush(cx, 0.5, 0.5, 1.05),
  rubble: (cx) => rubble(cx, 0, 0),
  car: (cx) => abandonedCar(cx, 0, 0),
};

export class Scene {
  constructor(state) {
    this.cache = new SpriteCache();
    this.traffic = new Traffic(state);
    this.roadTypes = null;
  }

  setState(state) {
    this.traffic.reset(state);
    this.roadTypes = null;
  }

  _roads(state) {
    if (this.roadTypes && this.roadTypes.n === state.size) return this.roadTypes;
    const n = state.size, types = new Array(n * n).fill(null), lamps = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (state.tiles[j * n + i].kind !== 'road') continue;
      const ty = roadType(state, i, j);
      types[j * n + i] = ty;
      if (ty === 'i' && i % 3 === 1) lamps.push([i + 0.5, j + 0.94]);
      if (ty === 'j' && j % 3 === 1) lamps.push([i + 0.94, j + 0.5]);
    }
    this.roadTypes = { n, types, lamps };
    return this.roadTypes;
  }

  // Contorno clicável de uma construção (prédios altos).
  hull(o) {
    const h = HEIGHT[o.type] || 30, s = o.size;
    const T = pt(o.i, o.j), R = pt(o.i + s, o.j), B = pt(o.i + s, o.j + s), L = pt(o.i, o.j + s);
    return [L, B, R, up(R, h), up(T, h), up(L, h)];
  }

  update(dt) { this.traffic.update(dt); }

  render(ctx, cam, dpr, state, t, now, ui = {}) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#a9dcf3'); sky.addColorStop(0.6, '#d6f0f4'); sky.addColorStop(1, '#eaf6ec');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    ctx.setTransform(cam.zoom * dpr, 0, 0, cam.zoom * dpr,
      (cam.vw / 2 - cam.x * cam.zoom) * dpr, (cam.vh / 2 - cam.y * cam.zoom) * dpr);
    this.cache.frame(cam.zoom * dpr);

    const n = state.size;
    mapBase(ctx, n);

    // ---- chão ----
    const roads = this._roads(state);
    const view = this._viewRange(cam, n);
    for (let j = view.j0; j <= view.j1; j++) for (let i = view.i0; i <= view.i1; i++) {
      const tl = state.tiles[j * n + i];
      const o = pt(i, j);
      if (tl.kind === 'road') {
        const ty = roads.types[j * n + i];
        this.cache.draw(ctx, 'r:' + ty, BBOX_TILE, (cx) => roadTile(cx, ty), o.x, o.y);
      } else {
        const v = Math.floor(hash(i, j, 3) * 4);
        this.cache.draw(ctx, 'g:' + v, BBOX_TILE, (cx) => grassTile(cx, v), o.x, o.y);
      }
      if (tl.locked) lockedOverlay(ctx, i, j);
    }

    // ---- seleção no chão ----
    const sel = ui.selected;
    if (sel) {
      const [si, sj, ss] = sel.kind === 'object' ? [sel.obj.i, sel.obj.j, sel.obj.size] : [sel.i, sel.j, 1];
      poly(ctx, [pt(si, sj), pt(si + ss, sj), pt(si + ss, sj + ss), pt(si, sj + ss)], 'rgba(255,230,102,0.28)', '#ffd23f', 2.5);
    }

    // ---- lista de desenho por profundidade ----
    const list = [];
    const movingObj = ui.ghost && ui.ghost.moving;
    for (const o of state.objects) {
      if (o === movingObj) continue;   // sendo movido: só o fantasma aparece
      list.push({ k: 'obj', o, d: (o.i + o.size - 1) + (o.j + o.size - 1), i: o.i });
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const tl = state.tiles[j * n + i];
      if (tl.obstacle) list.push({ k: 'obs', i, j, type: tl.obstacle, dim: tl.locked, d: i + j });
    }
    for (const [li, lj] of roads.lamps) list.push({ k: 'lamp', li, lj, d: Math.floor(li) + Math.floor(lj) + 0.6, i: li });
    for (const c of this.traffic.items()) list.push({ k: 'car', c, d: c.depth, i: c.ci });
    if (!state.showcase) {
      const C = MAP.chunk, nc = n / C, price = chunkPrice(state);
      for (let cj = 0; cj < nc; cj++) for (let ci = 0; ci < nc; ci++) {
        if (chunkBuyable(state, ci, cj)) list.push({ k: 'sign', ci, cj, price, d: ci * C + 1 + cj * C + 1 + 0.9, i: ci * C + 1 });
      }
    }
    if (ui.ghost) {
      const g = ui.ghost, s = BUILDINGS[g.type].size;
      list.push({ k: 'ghost', g, d: (g.i + s - 1) + (g.j + s - 1) + 0.95, i: g.i });
    }
    list.sort((a, b) => a.d - b.d || a.i - b.i);

    const bubbles = [];
    for (const it of list) {
      if (it.k === 'obj') {
        const o = it.o, def = BUILDINGS[o.type], org = pt(o.i, o.j);
        if (def.type === 'lot') {
          const p = lotProgress(o, now);
          const stage = !o.resource ? 0 : (now >= o.readyAt ? 3 : Math.min(2, Math.floor(p * 3)));
          const res = o.resource;
          this.cache.draw(ctx, `lot:${res || 'none'}:${stage}`, BBOX_LOT, (cx) => lotSprite(cx, res, stage), org.x, org.y);
          if (res && now < o.readyAt) this._progressBar(ctx, center(o.i, o.j), p);
        } else {
          const bb = bboxBuilding(o.size, HEIGHT[o.type] || 40);
          this.cache.draw(ctx, 'b:' + o.type, bb, (cx) => PAINT[o.type](cx), org.x, org.y);
          if (ANIM[o.type]) { ctx.save(); ctx.translate(org.x, org.y); ANIM[o.type](ctx, t + o.id * 0.37); ctx.restore(); }
        }
        if (!state.showcase) {
          const icon = readyIcon(state, o, now);
          if (icon) bubbles.push({ o, icon });
        }
      } else if (it.k === 'obs') {
        const org = pt(it.i, it.j);
        this.cache.draw(ctx, 'ob:' + it.type, BBOX_PROP, OBSTACLE_PAINT[it.type], org.x, org.y, it.dim);
      } else if (it.k === 'lamp') {
        lamp(ctx, it.li, it.lj, 20);
      } else if (it.k === 'car') {
        car(ctx, it.c.ci, it.c.cj, it.c.dir, it.c.color);
      } else if (it.k === 'sign') {
        forSaleSign(ctx, pt(it.ci * MAP.chunk + 1.5, it.cj * MAP.chunk + 1.5), `🏷️ ${it.price}`, true);
      } else if (it.k === 'ghost') {
        this._ghost(ctx, it.g);
      }
    }

    // ---- bolhas "pronto" por cima de tudo ----
    for (const b of bubbles) this._bubble(ctx, b.o, b.icon, t);

    // ---- rótulos (vitrine) ----
    if (ui.labels) for (const o of state.objects) ui.labels(ctx, o);
  }

  _viewRange(cam, n) {
    // limites aproximados visíveis (com folga) para não desenhar tiles fora da tela
    const halfW = cam.vw / 2 / cam.zoom + 80, halfH = cam.vh / 2 / cam.zoom + 160;
    const corners = [[cam.x - halfW, cam.y - halfH], [cam.x + halfW, cam.y - halfH], [cam.x - halfW, cam.y + halfH], [cam.x + halfW, cam.y + halfH]];
    let i0 = n, i1 = 0, j0 = n, j1 = 0;
    for (const [x, y] of corners) {
      const a = y / 16, b = x / 32;
      const i = (a + b) / 2, j = (a - b) / 2;
      i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j);
    }
    return {
      i0: Math.max(0, Math.floor(i0)), i1: Math.min(n - 1, Math.ceil(i1)),
      j0: Math.max(0, Math.floor(j0)), j1: Math.min(n - 1, Math.ceil(j1)),
    };
  }

  _progressBar(ctx, c, p) {
    const w = 30, h = 5, x = c.x - w / 2, y = c.y + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 3); ctx.fill();
    ctx.fillStyle = '#ffffff'; roundRect(ctx, x, y, w, h, 2.5); ctx.fill();
    ctx.fillStyle = '#34c759'; roundRect(ctx, x, y, Math.max(h, w * p), h, 2.5); ctx.fill();
  }

  _bubble(ctx, o, icon, t) {
    const h = BUILDINGS[o.type].type === 'lot' ? 26 : Math.min(HEIGHT[o.type] || 30, 80);
    const c = up(center(o.i, o.j, o.size), h + 12 + Math.sin(t * 3 + o.id) * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(c.x + 1, c.y + 2, 12, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(0, c.y - 12, 0, c.y + 12);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e9eef3');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(c.x - 4, c.y + 10); ctx.lineTo(c.x, c.y + 16); ctx.lineTo(c.x + 4, c.y + 10); ctx.fill();
    ctx.strokeStyle = '#34c759'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '14px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, c.x, c.y + 1);
  }

  _ghost(ctx, g) {
    const def = BUILDINGS[g.type], s = def.size;
    const d = [pt(g.i, g.j), pt(g.i + s, g.j), pt(g.i + s, g.j + s), pt(g.i, g.j + s)];
    poly(ctx, d, g.valid ? 'rgba(52,199,89,0.35)' : 'rgba(255,59,48,0.35)', g.valid ? '#34c759' : '#ff3b30', 2.5);
    const org = pt(g.i, g.j);
    ctx.save();
    ctx.globalAlpha = 0.72;
    if (def.type === 'lot') {
      const m = g.moving, res = m && m.resource, stage = res ? 2 : 0;
      this.cache.draw(ctx, `lot:${res || 'none'}:${stage}`, BBOX_LOT, (cx) => lotSprite(cx, res, stage), org.x, org.y);
    }
    else this.cache.draw(ctx, 'b:' + g.type, bboxBuilding(s, HEIGHT[g.type] || 40), (cx) => PAINT[g.type](cx), org.x, org.y);
    ctx.restore();
  }

  // Toque: primeiro testa contornos de prédios (frente → trás), depois o chão.
  // Se o prédio da frente já está selecionado, tocar de novo no mesmo ponto
  // seleciona o que está escondido atrás dele.
  pick(state, w, tileAt, current = null) {
    const objs = state.objects
      .filter(o => BUILDINGS[o.type].type !== 'lot')
      .sort((a, b) => ((b.i + b.size) + (b.j + b.size)) - ((a.i + a.size) + (a.j + a.size)));
    const hits = objs.filter(o => pointIn(w, this.hull(o)));
    if (hits.length) {
      const k = hits.indexOf(current);
      return { kind: 'object', obj: hits[k < 0 ? 0 : (k + 1) % hits.length] };
    }
    const { i, j } = tileAt(w.x, w.y);
    if (i < 0 || j < 0 || i >= state.size || j >= state.size) return null;
    const o = objectAt(state, i, j);
    return o ? { kind: 'object', obj: o } : { kind: 'tile', i, j };
  }
}

function pointIn(p, pts) {
  let inside = false;
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
    const xi = pts[a].x, yi = pts[a].y, xj = pts[b].x, yj = pts[b].y;
    if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

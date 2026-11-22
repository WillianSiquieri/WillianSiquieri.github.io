// tutorial.js — primeiros passos jogando: uma mão animada aponta o próximo
// toque (no mapa ou no botão certo), seguindo as dicas de economy.currentTip.
// Não bloqueia nada e pode ser desligada com "Pular".

import { BUILDINGS, MAP } from '../game/config.js';
import { currentTip, chunkBuyable, canAfford, chunkOf } from '../game/economy.js';
import { center, tileAt } from '../engine/iso.js';

const HAND = `<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
  <path d="M24 30V10a5 5 0 0 1 10 0v16l1-1a5 5 0 0 1 9 3v1a5 5 0 0 1 9 3v2a5 5 0 0 1 8 4v8c0 9-7 16-16 16H36c-5 0-9-2-12-6L14 42a5 5 0 0 1 8-6z"
    fill="#fff" stroke="#1f2a44" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M34 26v10M44 31v6M53 36v4" stroke="#1f2a44" stroke-width="2.6" stroke-linecap="round"/></svg>`;

const $ = (sel) => document.querySelector(sel);
// Visível e tocável de verdade (nem ele nem os pais escondidos/transparentes).
const visible = (el) => {
  if (!el || el.disabled) return false;
  const r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight)) return false;
  if (getComputedStyle(el).pointerEvents === 'none') return false;
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.2) return false;
  }
  return true;
};

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'tut-hand';
    this.el.innerHTML = `<div class="tut-ring"></div><div class="tut-finger">${HAND}</div>`;
    document.body.append(this.el);
    this.lastTip = null;
  }

  active() {
    const s = this.game.state;
    return !s.showcase && s.mentor && s.mentor.tut !== false && !!currentTip(s);
  }

  // Ponto da tela (px CSS) para onde a mão aponta, ou null.
  target() {
    const g = this.game, s = g.state, tip = currentTip(s), now = g.now();
    const sel = g.selected && g.selected.kind === 'object' ? g.selected.obj : null;
    const el = (q) => { const e = typeof q === 'string' ? $(q) : q; return visible(e) ? e : null; };
    const ui = (q) => { const e = el(q); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, ui: true }; };
    const obj = (o) => {
      if (!o) return null;
      const c = center(o.i, o.j, o.size), h = BUILDINGS[o.type].type === 'lot' ? 10 : Math.min(g.scene.height(o) * 0.55, 60);
      const p = g.camera.toScreen(c.x, c.y - h);
      return { x: p.x, y: p.y, world: { x: c.x, y: c.y - h } };
    };
    const first = (type, f = () => true) => s.objects.find(o => o.type === type && f(o));
    if (document.querySelector('#modal.show')) return null;

    switch (tip) {
      case 'tipCollect':
        return obj(first('lot', o => o.resource && now >= o.readyAt) || first('lot', o => o.resource));
      case 'tipPlant':
        if (sel && sel.type === 'lot' && !sel.resource) return ui('[data-act="startLot"][data-arg="wood"]');
        return obj(first('lot', o => !o.resource));
      case 'tipPlank': {
        const saw = first('sawmill');
        if (sel === saw && g.panelOpen()) return ui('[data-act="recipe"]:not([disabled])');
        return obj(saw);
      }
      case 'tipRent':
        return obj(first('house1', o => now >= o.rentReadyAt) || s.objects.find(o => BUILDINGS[o.type].type === 'house' && now >= o.rentReadyAt)
          || s.objects.find(o => BUILDINGS[o.type].type === 'house'));
      case 'tipOrder':
        if (g.sheet === 'orders') return ui('[data-act="deliver"]:not([disabled])');
        if (g.sheet) return ui('[data-act="closeSheet"]');
        return obj(first('townhall'));
      case 'tipBuild':
        if (g.placing) return canAfford(s, BUILDINGS[g.placing.type].build || {}) ? ui('#place-ok') : ui('[data-act="placeCancel"]');
        if (g.sheet === 'build') {
          const card = [...document.querySelectorAll('[data-act="pick"]:not([disabled])')].find(e => canAfford(s, BUILDINGS[e.dataset.arg].build || {}));
          if (card) return ui(card);
          return ui(`[data-act="tab"][data-arg="${g.buildTab === 'production' ? 'decor' : 'production'}"]`);
        }
        if (g.sheet) return ui('[data-act="closeSheet"]');
        return ui('#btn-build') || ui('[data-act="closePanel"]');
      case 'tipMissions': return g.sheet ? null : (document.body.classList.contains('menu-open') ? ui('#menu [data-act="missions"]') : ui('#btn-menu'));
      case 'tipExpand': {
        if (g.panelOpen()) { const b = ui('[data-act="buyChunk"]:not([disabled])'); if (b) return b; }
        // quadra à venda mais perto cujo centro dá para tocar (sem prédio na frente)
        const C = MAP.chunk, nc = s.size / C;
        let best = null, bd = Infinity;
        for (let cj = 0; cj < nc; cj++) for (let ci = 0; ci < nc; ci++) {
          if (!chunkBuyable(s, ci, cj)) continue;
          for (const [di, dj] of [[1, 1], [2, 2], [1, 2], [2, 1], [0, 0]]) {
            const w = center(ci * C + di, cj * C + dj);
            // o ponto e uma folga em volta precisam cair na própria quadra (nada na frente)
            const okAt = (dx, dy) => {
              const hit = g.scene.pick(s, { x: w.x + dx, y: w.y + dy }, tileAt);
              if (!hit || hit.kind !== 'tile') return false;
              const ch = chunkOf(hit.i, hit.j);
              return ch.ci === ci && ch.cj === cj;
            };
            if (![[0, 0], [8, 0], [-8, 0], [0, 6], [0, -6]].every(([dx, dy]) => okAt(dx, dy))) continue;
            const d = Math.hypot(w.x - g.camera.x, w.y - g.camera.y);
            if (d < bd) { bd = d; best = w; }
            break;
          }
        }
        if (!best) return null;
        const p = g.camera.toScreen(best.x, best.y);
        return { x: p.x, y: p.y, world: { x: best.x, y: best.y } };
      }
    }
    return null;
  }

  // Alvo no mapa coberto por um painel/menu: aponta para o botão de fechar.
  unblock(p) {
    if (!p || p.ui) return p;
    const hit = document.elementFromPoint(p.x, p.y);
    if (!hit || hit.id === 'city' || hit.id === 'city3d' || this.el.contains(hit)) return p;
    if (this.game.sheet) return null;            // menu aberto pelo jogador: a mão espera
    for (const q of ['[data-act="closePanel"]']) {
      const e = document.querySelector(q);
      if (visible(e)) { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, ui: true }; }
    }
    return p;
  }

  update(t) {
    if (!this.active()) { this.el.style.display = 'none'; this.lastTip = null; return; }
    const tip = currentTip(this.game.state);
    const p = this.unblock(this.target());
    if (!p) { this.el.style.display = 'none'; return; }
    // dica nova com alvo fora da tela: a câmera vai até ele com calma
    if (tip !== this.lastTip) {
      this.lastTip = tip;
      const cam = this.game.camera, m = 0.18;
      if (p.world && (p.x < cam.vw * m || p.x > cam.vw * (1 - m) || p.y < cam.vh * m || p.y > cam.vh * (1 - m))) this.game.panTo(p.world.x, p.world.y);
    }
    const bob = Math.sin(t * 5) * 6;
    this.el.style.display = 'block';
    this.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    this.el.firstElementChild.style.transform = `translate(-50%, -50%) scale(${0.8 + (Math.sin(t * 5) + 1) * 0.2})`;
    this.el.lastElementChild.style.transform = `translate(${-12 + bob * 0.4}px, ${2 + bob}px) rotate(-20deg)`;
    this.el.classList.toggle('on-ui', !!p.ui);
  }
}

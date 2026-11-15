// input.js — entrada unificada (mouse + toque) via Pointer Events, adaptada
// para jogo de cidade (baseada na do Trace Rider):
//   1 dedo/mouse: arrastar = mover o mapa; toque rápido sem arrastar = "tap"
//   2 dedos: pinça = zoom + mover
//   roda do mouse: zoom
// Chama o `delegate`: tap(sx, sy), panByScreen(dx, dy), zoomAt(sx, sy, f).

const TAP_SLOP = 8; // px que o dedo pode mexer e ainda contar como toque

export class InputManager {
  constructor(canvas, delegate) {
    this.canvas = canvas;
    this.d = delegate;
    this.pointers = new Map();
    this.downAt = null;      // posição inicial do toque único
    this.dragging = false;
    this.gesture = false;    // houve dois dedos neste toque (não vira tap)
    this.pinchDist = 0;
    this.pinchMid = null;

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => this._down(e));
    canvas.addEventListener('pointermove', e => this._move(e));
    canvas.addEventListener('pointerup', e => this._up(e));
    canvas.addEventListener('pointercancel', e => this._up(e, true));
    canvas.addEventListener('wheel', e => this._wheel(e), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  _down(e) {
    try { this.canvas.setPointerCapture?.(e.pointerId); } catch (_) {}
    const p = this._pos(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.downAt = p; this.dragging = false; this.gesture = false;
    } else if (this.pointers.size === 2) {
      this.gesture = true; this._initPinch();
    }
  }

  _move(e) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const p = this._pos(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size >= 2) { this._updatePinch(); return; }
    if (this.gesture) return; // sobrou 1 dedo depois da pinça: ignora até soltar

    if (!this.dragging && this.downAt &&
        Math.hypot(p.sx - this.downAt.sx, p.sy - this.downAt.sy) > TAP_SLOP) {
      this.dragging = true;
    }
    if (this.dragging) this.d.panByScreen(p.sx - prev.sx, p.sy - prev.sy);
  }

  _up(e, cancelled = false) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this._pos(e);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      if (!cancelled && !this.dragging && !this.gesture) this.d.tap(p.sx, p.sy);
      this.downAt = null; this.dragging = false; this.gesture = false;
    } else if (this.pointers.size >= 2) {
      this._initPinch();
    }
  }

  _initPinch() {
    const [a, b] = [...this.pointers.values()];
    this.pinchDist = Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1;
    this.pinchMid = { sx: (a.sx + b.sx) / 2, sy: (a.sy + b.sy) / 2 };
  }

  _updatePinch() {
    const [a, b] = [...this.pointers.values()];
    const dist = Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1;
    const mid = { sx: (a.sx + b.sx) / 2, sy: (a.sy + b.sy) / 2 };
    this.d.zoomAt(mid.sx, mid.sy, dist / this.pinchDist);
    this.d.panByScreen(mid.sx - this.pinchMid.sx, mid.sy - this.pinchMid.sy);
    this.pinchDist = dist; this.pinchMid = mid;
  }

  _wheel(e) {
    e.preventDefault();
    const p = this._pos(e);
    this.d.zoomAt(p.sx, p.sy, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }
}

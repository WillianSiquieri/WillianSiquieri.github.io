// input.js — entrada unificada mouse + toque via Pointer Events.
// Um ponteiro aciona a ferramenta ativa (lápis/borracha/mover). Dois ponteiros
// sempre fazem pinça (zoom) + arrasto da câmera, independente da ferramenta.
// A roda do mouse faz zoom no desktop.
//
// O InputManager não conhece a lógica do jogo: ele chama métodos do `delegate`:
//   delegate.getTool()            -> 'pencil' | 'eraser' | 'pan'
//   delegate.strokeStart(world)
//   delegate.strokeMove(world)
//   delegate.strokeEnd()
//   delegate.eraseAt(world)
//   delegate.panByScreen(dx, dy)
//   delegate.zoomAt(sx, sy, factor)

export class InputManager {
  constructor(canvas, camera, delegate) {
    this.canvas = canvas;
    this.camera = camera;
    this.delegate = delegate;
    this.pointers = new Map(); // pointerId -> {sx, sy}
    this.mode = null;          // 'tool' | 'gesture'
    this.pinchDist = 0;
    this.pinchMid = null;
    this._bind();
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  _bind() {
    const c = this.canvas;
    c.style.touchAction = 'none'; // impede scroll/zoom nativo do navegador
    c.addEventListener('pointerdown', e => this._down(e));
    c.addEventListener('pointermove', e => this._move(e));
    c.addEventListener('pointerup', e => this._up(e));
    c.addEventListener('pointercancel', e => this._up(e));
    c.addEventListener('pointerleave', e => this._up(e));
    c.addEventListener('wheel', e => this._wheel(e), { passive: false });
    // Evita o menu de contexto ao segurar no toque/botão direito.
    c.addEventListener('contextmenu', e => e.preventDefault());
  }

  _down(e) {
    try { this.canvas.setPointerCapture?.(e.pointerId); } catch (_) {}
    const p = this._pos(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) {
      // Entra em gesto: cancela qualquer traço em andamento.
      if (this.mode === 'tool') this.delegate.strokeEnd?.();
      this.mode = 'gesture';
      this._initPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    this.mode = 'tool';
    const tool = this.delegate.getTool();
    const w = this.camera.toWorld(p.sx, p.sy);
    if (tool === 'pencil') this.delegate.strokeStart(w);
    else if (tool === 'eraser') this.delegate.eraseAt(w);
    // 'pan' trata no move
  }

  _move(e) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const p = this._pos(e);
    this.pointers.set(e.pointerId, p);

    if (this.mode === 'gesture' && this.pointers.size >= 2) {
      this._updatePinch();
      return;
    }
    if (this.mode !== 'tool') return;

    const tool = this.delegate.getTool();
    const w = this.camera.toWorld(p.sx, p.sy);
    if (tool === 'pencil') this.delegate.strokeMove(w);
    else if (tool === 'eraser') this.delegate.eraseAt(w);
    else if (tool === 'pan') this.delegate.panByScreen(p.sx - prev.sx, p.sy - prev.sy);
  }

  _up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);

    if (this.mode === 'tool') {
      // Finaliza o traço em andamento (lápis ou lote da borracha).
      this.delegate.strokeEnd?.();
    }

    if (this.pointers.size === 1) {
      // Saiu de gesto para um ponteiro só: não retoma ferramenta no meio.
      this.mode = null;
    } else if (this.pointers.size === 0) {
      this.mode = null;
    } else if (this.pointers.size >= 2) {
      this._initPinch();
    }
  }

  _initPinch() {
    const pts = [...this.pointers.values()];
    const [a, b] = pts;
    this.pinchDist = Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1;
    this.pinchMid = { sx: (a.sx + b.sx) / 2, sy: (a.sy + b.sy) / 2 };
  }

  _updatePinch() {
    const pts = [...this.pointers.values()];
    const [a, b] = pts;
    const dist = Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1;
    const mid = { sx: (a.sx + b.sx) / 2, sy: (a.sy + b.sy) / 2 };

    // Zoom proporcional à variação da distância entre os dedos.
    const factor = dist / this.pinchDist;
    this.delegate.zoomAt(mid.sx, mid.sy, factor);
    // Pan pelo deslocamento do ponto médio.
    this.delegate.panByScreen(mid.sx - this.pinchMid.sx, mid.sy - this.pinchMid.sy);

    this.pinchDist = dist;
    this.pinchMid = mid;
  }

  _wheel(e) {
    e.preventDefault();
    const p = this._pos(e);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.delegate.zoomAt(p.sx, p.sy, factor);
  }
}

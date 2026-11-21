// camera.js — transformação de mundo<->tela com pan, zoom e "seguir" alvo.

export class Camera {
  constructor() {
    this.x = 0;        // centro da câmera no mundo
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.35;
    this.maxZoom = 2.5;
    this.vw = 1;       // tamanho da viewport (pixels CSS)
    this.vh = 1;
    this.limit = null; // { n, margin }: o centro fica no mapa (± margem, em tiles)
  }

  setViewport(w, h) { this.vw = w; this.vh = h; this.clamp(); }

  // Limita a câmera ao mapa: o centro não sai do losango do mapa (com folga) e o
  // zoom mínimo não deixa ver além da névoa da borda.
  setLimit(n, margin = 1.5) { this.limit = { n, margin }; this.clamp(); }
  clamp() {
    const L = this.limit; if (!L) return;
    const span = L.n + 12;
    this.minZoom = Math.max(0.35, this.vw / (span * 64), this.vh / (span * 32));
    if (this.zoom < this.minZoom) this.zoom = this.minZoom;
    let gi = (this.x / 32 + this.y / 16) / 2, gj = (this.y / 16 - this.x / 32) / 2;
    const lo = -L.margin, hi = L.n + L.margin;
    gi = Math.min(hi, Math.max(lo, gi)); gj = Math.min(hi, Math.max(lo, gj));
    this.x = (gi - gj) * 32; this.y = (gi + gj) * 16;
  }

  // Mundo -> tela
  toScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.vw / 2,
      y: (wy - this.y) * this.zoom + this.vh / 2,
    };
  }

  // Tela -> mundo
  toWorld(sx, sy) {
    return {
      x: (sx - this.vw / 2) / this.zoom + this.x,
      y: (sy - this.vh / 2) / this.zoom + this.y,
    };
  }

  // Move a câmera por um delta em pixels de tela (usado no pan).
  panByScreen(dx, dy) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clamp();
  }

  // Zoom mantendo o ponto de tela (sx, sy) fixo no mesmo ponto de mundo.
  zoomAt(sx, sy, factor) {
    const before = this.toWorld(sx, sy);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    const after = this.toWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  // Interpola suavemente o centro da câmera em direção a (tx, ty).
  follow(tx, ty, lerp = 0.1) {
    this.x += (tx - this.x) * lerp;
    this.y += (ty - this.y) * lerp;
  }

  // Aplica a transformação ao contexto 2D (para desenhar em coordenadas de mundo).
  applyTo(ctx) {
    ctx.setTransform(
      this.zoom, 0, 0, this.zoom,
      this.vw / 2 - this.x * this.zoom,
      this.vh / 2 - this.y * this.zoom
    );
  }
}

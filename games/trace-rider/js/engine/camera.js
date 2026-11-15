// camera.js — transformação de mundo<->tela com pan, zoom e "seguir" alvo.

export class Camera {
  constructor() {
    this.x = 0;        // centro da câmera no mundo
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.25;
    this.maxZoom = 4;
    this.vw = 1;       // tamanho da viewport (pixels CSS)
    this.vh = 1;
  }

  setViewport(w, h) { this.vw = w; this.vh = h; }

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
  }

  // Zoom mantendo o ponto de tela (sx, sy) fixo no mesmo ponto de mundo.
  zoomAt(sx, sy, factor) {
    const before = this.toWorld(sx, sy);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    const after = this.toWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
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

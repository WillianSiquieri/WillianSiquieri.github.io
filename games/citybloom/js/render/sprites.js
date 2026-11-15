// sprites.js — cache de desenhos em canvas fora da tela.
// Cada construção/tile é desenhado com todo o detalhe UMA vez, numa escala
// próxima do zoom atual (×DPR), e depois só "carimbado" com drawImage.
// Ao mudar a faixa de zoom, os sprites são refeitos aos poucos (orçamento por
// quadro), usando os antigos esticados enquanto isso — sem travadas.

const BUCKETS = [0.5, 0.75, 1, 1.5, 2, 3, 4, 5];
const BUDGET_PER_FRAME = 10;

export class SpriteCache {
  constructor() {
    this.k = 1;
    this.map = new Map();
    this.old = new Map();
    this.budget = BUDGET_PER_FRAME;
  }

  // Chamar 1×/quadro com zoom×dpr.
  frame(rawScale) {
    const k = BUCKETS.find(b => b >= rawScale * 0.92) || BUCKETS[BUCKETS.length - 1];
    if (k !== this.k) {
      this.old = this.map;
      this.map = new Map();
      this.k = k;
    }
    this.budget = BUDGET_PER_FRAME;
  }

  _make(bbox, paint, dim) {
    const k = this.k;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(bbox.w * k));
    c.height = Math.max(1, Math.ceil(bbox.h * k));
    const cx = c.getContext('2d');
    cx.setTransform(k, 0, 0, k, -bbox.x * k, -bbox.y * k);
    paint(cx);
    if (dim) { // escurece para "terra à venda"
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.globalCompositeOperation = 'source-atop';
      cx.fillStyle = 'rgba(45, 58, 50, 0.34)';
      cx.fillRect(0, 0, c.width, c.height);
    }
    return c;
  }

  // Desenha o sprite `key` com a origem do objeto em (ox, oy) (mundo).
  draw(ctx, key, bbox, paint, ox, oy, dim = false) {
    const fullKey = dim ? key + '|dim' : key;
    let c = this.map.get(fullKey);
    if (!c) {
      const stale = this.old.get(fullKey);
      if (stale && this.budget <= 0) {
        c = stale;
      } else {
        c = this._make(bbox, paint, dim);
        this.map.set(fullKey, c);
        this.budget--;
      }
    }
    ctx.drawImage(c, ox + bbox.x, oy + bbox.y, bbox.w, bbox.h);
  }

  clear() { this.map.clear(); this.old.clear(); }
}

// Caixas de recorte (em px de mundo, relativas ao canto de fundo do objeto).
export function bboxBuilding(size, height) {
  return { x: -size * 32 - 30, y: -height - 30, w: size * 64 + 92, h: height + 30 + size * 32 + 36 };
}
export const BBOX_TILE = { x: -33, y: -1, w: 66, h: 34 };
export const BBOX_LOT = { x: -36, y: -34, w: 72, h: 70 };
export const BBOX_PROP = { x: -40, y: -36, w: 84, h: 74 };

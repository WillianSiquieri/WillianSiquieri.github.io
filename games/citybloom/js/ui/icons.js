// icons.js — ícones 3D (Fluent Emoji, Microsoft, MIT) no lugar dos emoji do
// sistema: ficam iguais em qualquer aparelho e combinam com a cidade 3D.
//
// - No HTML: um observador troca, em todo texto que aparece na tela, cada emoji
//   conhecido por <img class="emo">. O código continua escrevendo emoji normais.
// - No canvas: drawRich() desenha texto com os ícones no lugar dos emoji.

const FILES = {
  '⏱': '23f1-fe0f',
  '⏳': '23f3',
  '▶': '25b6-fe0f',
  '⚙': '2699-fe0f',
  '⛏': '26cf-fe0f',
  '✅': '2705',
  '✏': '270f-fe0f',
  '⬆': '2b06-fe0f',
  '⭐': '2b50',
  '🌃': '1f303',
  '🌆': '1f306',
  '🌐': '1f310',
  '🌱': '1f331',
  '🌲': '1f332',
  '🌳': '1f333',
  '🎁': '1f381',
  '🎉': '1f389',
  '🎯': '1f3af',
  '🎵': '1f3b5',
  '🎶': '1f3b6',
  '🎻': '1f3bb',
  '🏖': '1f3d6-fe0f',
  '🏘': '1f3d8-fe0f',
  '🏙': '1f3d9-fe0f',
  '🏠': '1f3e0',
  '🏡': '1f3e1',
  '🏥': '1f3e5',
  '🏭': '1f3ed',
  '🏷': '1f3f7-fe0f',
  '👏': '1f44f',
  '👥': '1f46a',
  '📋': '1f4cb',
  '📐': '1f4d0',
  '📜': '1f4dc',
  '📦': '1f4e6',
  '🔇': '1f507',
  '🔈': '1f508',
  '🔊': '1f50a',
  '🔒': '1f512',
  '🔔': '1f514',
  '🔨': '1f528',
  '🔩': '1f529',
  '🗑': '1f5d1-fe0f',
  '🗓': '1f5d3-fe0f',
  '😉': '1f609',
  '🛋': '1f6cb-fe0f',
  '🛍': '1f6cd-fe0f',
  '🛣': '1f6e3-fe0f',
  '🟤': '1f7e4',
  '🧑‍🔧': '1f9d1-200d-1f527',
  '🧪': '1f9ea',
  '🧰': '1f9f0',
  '🧱': '1f9f1',
  '🪙': '1fa99',
  '🪚': '1fa9a',
  '🪟': '1fa9f',
  '🪵': '1fab5'
};

const keys = Object.keys(FILES).sort((a, b) => b.length - a.length)
  .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const RX = new RegExp('(' + keys.join('|') + ')\uFE0F?', 'gu');
const src = (e) => 'assets/icons/' + FILES[e.replace(/\uFE0F/g, '')] + '.webp';

// ---------------------------------------------------------------- HTML
function iconizeTextNode(node) {
  const text = node.nodeValue;
  RX.lastIndex = 0;
  if (!RX.test(text)) return;
  RX.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let last = 0, m;
  while ((m = RX.exec(text))) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const img = document.createElement('img');
    img.className = 'emo'; img.alt = ''; img.draggable = false; img.src = src(m[1]);
    frag.append(img);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  node.replaceWith(frag);
}

export function iconize(root) {
  if (!root) return;
  if (root.nodeType === 3) { if (root.parentNode && !skip(root.parentNode)) iconizeTextNode(root); return; }
  if (root.nodeType !== 1 || skip(root)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => skip(n.parentNode) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const list = []; for (let n = w.nextNode(); n; n = w.nextNode()) list.push(n);
  list.forEach(iconizeTextNode);
}
const skip = (el) => !el || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|TITLE)$/.test(el.nodeName) || (el.closest && el.closest('[data-noemo]'));

// Observa o documento todo: qualquer texto novo já aparece com ícones.
export function watchIcons() {
  iconize(document.body);
  new MutationObserver(list => {
    for (const r of list) {
      if (r.type === 'characterData') iconize(r.target);
      else r.addedNodes.forEach(n => iconize(n));
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

// ---------------------------------------------------------------- canvas
const imgs = new Map();
export function emojiImage(e) {
  const k = e.replace(/\uFE0F/g, '');
  if (!FILES[k]) return null;
  if (!imgs.has(k)) { const im = new Image(); im.src = src(k); imgs.set(k, im); }
  return imgs.get(k);
}
export function hasIcon(e) { return !!FILES[e.replace(/\uFE0F/g, '')]; }

// Divide o texto em pedaços de texto e de ícone.
export function splitRich(text) {
  const out = []; let last = 0, m;
  RX.lastIndex = 0;
  while ((m = RX.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    out.push({ e: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

// Desenha texto + ícones centralizado em (x, y). `px` = tamanho da fonte.
// opts.stroke: contorno do texto (cor) · opts.fill: cor do texto.
export function drawRich(ctx, text, x, y, px, opts = {}) {
  const parts = splitRich(text);
  const isz = px * 1.25, gap = px * 0.12;
  let w = 0;
  for (const p of parts) w += p.e ? isz + gap : ctx.measureText(p.t).width;
  let cx = x - w / 2;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const p of parts) {
    if (p.e) {
      const im = emojiImage(p.e);
      if (im && im.complete && im.naturalWidth) ctx.drawImage(im, cx, y - isz / 2, isz, isz);
      cx += isz + gap;
    } else {
      if (opts.stroke) { ctx.lineWidth = opts.lineWidth || px * 0.28; ctx.strokeStyle = opts.stroke; ctx.lineJoin = 'round'; ctx.strokeText(p.t, cx, y); }
      ctx.fillStyle = opts.fill || '#1f2430'; ctx.fillText(p.t, cx, y);
      cx += ctx.measureText(p.t).width;
    }
  }
}

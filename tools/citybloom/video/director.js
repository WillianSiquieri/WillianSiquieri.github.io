// Diretor do vídeo de prévia do CityBloom (roda dentro da página do jogo).
(() => {
const D = window.__dir = {};
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, k) => a + (b - a) * k;

D.setup = async (opt) => {
  const { BUILDINGS, xpToNext } = await import('/games/citybloom/js/game/config.js');
  const E = await import('/games/citybloom/js/game/economy.js');
  const S = await import('/games/citybloom/js/game/state.js');
  const ISO = await import('/games/citybloom/js/engine/iso.js');
  D.ISO = ISO; D.E = E;
  const g = __city; g.modalQueue.length = 0; document.querySelector('#modal').classList.remove('show'); g.closeSheet();
  const now = Date.now();
  const sc = S.showcaseGame(now); const s = g.state;
  Object.assign(s, { tiles: sc.tiles, objects: sc.objects, nextId: sc.nextId, size: sc.size, chunksBought: 20 });
  // nível com novidades no próximo
  let L = 14; while (L < 40 && !E.unlocksAt(L + 1).some(u => u.kind === 'building')) L++;
  s.cityName = 'Bloomville'; s.level = L; s.xp = Math.floor(xpToNext(L) * 0.55); s.coins = 8640; s.capacity = 200;
  s.inventory = { wood: 18, plank: 12, clay: 10, brick: 14, sand: 8, glass: 7, furniture: 4, steel: 3, iron: 4, hammer: 3, tape: 3 };
  s.mentor.intro = true; s.mentor.tut = false; g.greetUntil = 0; s.stats = { lotStarted: 9, factoryStarted: 9, rentCollected: 9, ordersDone: 9, built: 9, chunksBought: 9 };
  s.daily = { next: 1, last: E.dayKey(now), extra: E.dayKey(now) };
  let seed = opt.seed || 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const houses = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].type === 'house');
  const decor = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].type === 'decor' && BUILDINGS[k].size === 1);
  for (const t of s.tiles) { t.obstacle = null; t.locked = false; }
  const W = [3, 4, 4, 3, 1.6, 0.6, 0.3], tot = W.reduce((a, b) => a + b, 0);
  const pickHouse = () => { let x = rnd() * tot; for (let k = 0; k < W.length; k++) { x -= W[k]; if (x <= 0) return houses[k]; } return houses[0]; };
  const keepFree = opt.free || [];
  s.rev++;
  for (let j = 0; j < s.size; j++) for (let i = 0; i < s.size; i++) {
    const t = S.tileOf(s, i, j); if (t.kind === 'road' || S.objectAt(s, i, j)) continue;
    if (keepFree.some(([a, b]) => a === i && b === j)) continue;
    const dn = opt.density || 1, r = rnd(); const type = r < 0.42 * dn ? pickHouse() : r < 0.7 * dn ? 'tree' : r < 0.8 * dn ? decor[Math.floor(rnd() * decor.length)] : null;
    if (!type || !E.canPlace(s, type, i, j)) continue;
    s.objects.push(S.makeObject(s, type, i, j, now, BUILDINGS[type].type === 'house' ? { rentReadyAt: now + 600000 + rnd() * 600000 } : {})); s.rev++;
  }
  s.showcase = false; s.orders = []; E.refillOrders(s, now);
  // 1º pedido pronto para entregar
  for (const [k, v] of Object.entries(s.orders[0].items)) s.inventory[k] = Math.max(s.inventory[k] || 0, v + 2);
  // lotes prontos
  for (const o of s.objects) if (o.type === 'lot') { o.readyAt = now - 1000; }
  g.scene = new (g.scene.constructor)(s);
  g.select(null);
  D.g = g; D.s = s; D.L = L;
  // gravação: a cidade 3D só é desenhada no último rAF de cada quadro do vídeo
  D.allowRender = true;
  if (g.world && !g.world.__gated) { const orig = g.world.render.bind(g.world); g.world.render = (...a) => { if (D.allowRender) orig(...a); }; g.world.__gated = true; } D.xpNext = xpToNext(L);
  return { L, size: s.size, order: s.orders[0], unlock: E.unlocksAt(L + 1) };
};

// ---- alvos na tela
D.objTop = (o) => { const c = D.ISO.center(o.i, o.j, o.size); const p = D.g.camera.toScreen(c.x, c.y - 16 * o.size); return p; };
D.tile = (i, j, size = 1) => { const c = D.ISO.center(i, j, size); return D.g.camera.toScreen(c.x, c.y); };
D.el = (sel) => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
D.find = (type, near) => D.s.objects.filter(o => o.type === type).sort((a, b) => (Math.hypot(a.i - near[0], a.j - near[1]) - Math.hypot(b.i - near[0], b.j - near[1])))[0];

// ---- cursor (toque)
D.cursor = () => {
  if (D.cur) return D.cur;
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid rgba(30,40,60,.75);box-shadow:0 3px 10px rgba(0,0,0,.35);z-index:99999;pointer-events:none;opacity:0;';
  const r = document.createElement('div');
  r.style.cssText = 'position:fixed;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:4px solid rgba(255,255,255,.95);z-index:99998;pointer-events:none;opacity:0;';
  document.body.append(r, c);
  return (D.cur = { c, r });
};

// ---- linha do tempo
D.plan = (p) => { D.P = p; D.fired = new Set(); D.lastTap = -9; };
D.frame = (t) => {
  const P = D.P, cam = D.g.camera;
  // câmera: keyframes {t, x, y, z}
  const K = P.cam; let a = K[0], b = K[K.length - 1];
  for (let k = 0; k < K.length - 1; k++) if (t >= K[k].t && t <= K[k + 1].t) { a = K[k]; b = K[k + 1]; break; }
  if (t > K[K.length - 1].t) a = b;
  const k = a === b ? 1 : ease((t - a.t) / (b.t - a.t));
  cam.x = lerp(a.x, b.x, k); cam.y = lerp(a.y, b.y, k); cam.zoom = lerp(a.z, b.z, k);
  // ações
  for (let i = 0; i < P.acts.length; i++) {
    const ac = P.acts[i];
    if (t >= ac.t && !D.fired.has(i)) { D.fired.add(i); if (ac.tap) D.lastTap = t; try { ac.fn && ac.fn(); } catch (e) { console.log('act err', e); } }
  }
  // cursor: waypoints {t (chegada), dur, at()}
  const { c, r } = D.cursor(); const WP = P.wps;
  let pos = null, vis = 0;
  for (let i = 0; i < WP.length; i++) {
    const w = WP[i];
    if (t < w.t - (w.dur || 0)) break;
    const target = w.at && w.at();
    if (!target) continue;
    if (t >= w.t || i === 0 || !WP[i - 1].at) pos = target;
    else { const prev = WP[i - 1].at() || target; const kk = ease((t - (w.t - w.dur)) / w.dur); pos = { x: lerp(prev.x, target.x, kk), y: lerp(prev.y, target.y, kk) }; }
    vis = w.hide ? 0 : 1;
  }
  if (pos) {
    const since = t - D.lastTap, press = since >= 0 && since < .18 ? 0.82 : 1;
    c.style.transform = `translate(${pos.x}px,${pos.y}px) scale(${press})`; c.style.opacity = vis;
    const rk = since / .45;
    if (since >= 0 && rk < 1) { r.style.transform = `translate(${pos.x}px,${pos.y}px) scale(${1 + rk * 1.6})`; r.style.opacity = (1 - rk) * vis; }
    else r.style.opacity = 0;
  } else { c.style.opacity = 0; r.style.opacity = 0; }
};

// animações CSS seguem o relógio falso
D.sync = () => {
  const now = performance.now();
  for (const a of document.getAnimations()) {
    if (a.__t0 === undefined) { a.__t0 = now; a.pause(); }
    a.currentTime = now - a.__t0;
  }
};
})();

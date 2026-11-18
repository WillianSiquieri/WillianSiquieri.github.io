// node rec.cjs W H DSF ZOOM OUTNAME [--stills=t1,t2] [--fps=30]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const a = process.argv.slice(2);
const [W, H, DSF, Z, NAME] = a;
const opt = Object.fromEntries(a.filter(x => x.startsWith('--')).map(x => x.slice(2).split('=')));
const FPS = +(opt.fps || 30), DUR = +(opt.dur || 18.5);
const DIR = path.join(__dirname, 'frames-' + NAME);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DSF, locale: 'en-US' });
  p.on('console', m => { if (/err/i.test(m.text())) console.log('[page]', m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('citybloom.lang.v1', 'en'); } catch (_) {} });
  await p.clock.install({ time: Date.parse('2026-11-17T15:00:00') });
  await p.goto('http://127.0.0.1:8099/games/citybloom/?reset=1');
  for (;;) { if (await p.evaluate(() => !!window.__city)) break; await new Promise(r => setTimeout(r, 100)); }
  // espera a cidade 3D (modelos chegam pela rede; o relógio falso não atrapalha)
  for (;;) { const ok = await p.evaluate(() => !!(window.__city.world && window.__city.world.ready)); if (ok) break; await p.clock.runFor(100); await new Promise(r => setTimeout(r, 200)); }
  await p.evaluate(() => { __city.world.autoQuality = false; });
  await p.clock.runFor(1500);
  await p.addStyleTag({ content: '.tip,.tut-hand,#loading{display:none!important}' });
  await p.evaluate(fs.readFileSync(path.join(__dirname, 'director.js'), 'utf8'));
  const FREE = []; for (let i = 11; i <= 14; i++) for (let j = 15; j <= 18; j++) FREE.push([i, j]);
  const info = await p.evaluate((free) => __dir.setup({ free }), FREE);
  console.log(JSON.stringify(info));
  await p.evaluate(([Z, BUILD]) => {
    const D = __dir, g = D.g, s = D.s, E = D.E, cam = g.camera;
    const F = D.ISO.center(10, 14.6, 1);
    const now = Date.now();
    const portrait = cam.vh > cam.vw; const xpToNextL = D.xpNext;
    // casas prontas: perto de pontos da tela
    cam.x = F.x; cam.y = F.y; cam.zoom = Z;
    const spots = portrait ? [[.3, .3], [.72, .42], [.35, .62]] : [[.25, .42], [.5, .7], [.8, .45]];
    const used = new Set(), houses = [];
    for (const [fx, fy] of spots) {
      let best = null, bd = 1e9;
      for (const o of s.objects) {
        if (o.type.indexOf('house') !== 0 || used.has(o)) continue;
        const q = D.objTop(o); const d = Math.hypot(q.x - fx * cam.vw, q.y - fy * cam.vh);
        if (d < bd) { bd = d; best = o; }
      }
      used.add(best); houses.push(best); best.rentReadyAt = now - 1000;
    }
    const th = s.objects.find(o => o.type === 'townhall');
    const lots = s.objects.filter(o => o.type === 'lot' && o.resource).sort((a, b) => Math.hypot(a.i - 10, a.j - 15) - Math.hypot(b.i - 10, b.j - 15)).slice(0, 2);
    const collect = (o) => () => { const r = E.quickCollect(s, o, g.now()); if (r) g._result(r, o.i, o.j, o.size); g.select({ kind: 'object', obj: o }); };
    const click = (sel) => () => { const e = document.querySelector(sel); if (e) e.click(); };
    const target = { i: 12, j: 16 };
    D.plan({
      cam: [
        { t: 0, x: F.x - 40, y: F.y - 10, z: Z * 0.82 },
        { t: 2.0, x: F.x, y: F.y, z: Z },
        { t: 10.4, x: F.x, y: F.y, z: Z },
        { t: 11.2, x: F.x + 10, y: F.y - 30, z: Z * 1.05 },
        { t: 16.2, x: F.x + 10, y: F.y - 30, z: Z * 1.05 },
        { t: 18.5, x: F.x, y: F.y, z: Z * 0.8 },
      ],
      wps: [
        { t: 1.6, at: () => D.objTop(houses[0]) },
        { t: 2.7, dur: .45, at: () => D.objTop(houses[1]) },
        { t: 3.4, dur: .45, at: () => D.objTop(houses[2]) },
        { t: 4.3, dur: .55, at: () => D.objTop(lots[0]) },
        { t: 5.0, dur: .45, at: () => D.objTop(lots[1]) },
        { t: 6.2, dur: .7, at: () => D.el('#btn-build') },
        { t: 7.3, dur: .55, at: () => D.el(`[data-act="pick"][data-arg="${BUILD}"]`) },
        { t: 8.5, dur: .6, at: () => D.tile(target.i, target.j) },
        { t: 9.4, dur: .5, at: () => D.el('#place-ok') },
        { t: 11.3, dur: .8, at: () => D.objTop(th) },
        { t: 12.5, dur: .6, at: () => D.el('[data-act="deliver"]') },
        { t: 13.4, dur: .5, at: () => ({ x: cam.vw * .5, y: cam.vh * .92 }), hide: true },
        { t: 15.6, dur: .1, at: () => D.el('#modal [data-act="modalOk"]') },
        { t: 16.6, dur: .1, at: () => D.el('#modal [data-act="modalOk"]') || { x: -99, y: -99 }, hide: true },
      ],
      acts: [
        { t: 2.0, tap: 1, fn: collect(houses[0]) },
        { t: 2.7, tap: 1, fn: collect(houses[1]) },
        { t: 3.4, tap: 1, fn: collect(houses[2]) },
        { t: 4.3, tap: 1, fn: collect(lots[0]) },
        { t: 5.0, tap: 1, fn: collect(lots[1]) },
        { t: 6.2, tap: 1, fn: () => { g.select(null); click('#btn-build')(); } },
        { t: 7.3, tap: 1, fn: () => { g.buildAt = { i: 13, j: 17 }; click(`[data-act="pick"][data-arg="${BUILD}"]`)(); } },
        { t: 8.5, tap: 1, fn: () => { const q = D.tile(target.i, target.j); g.tap(q.x, q.y); } },
        { t: 9.4, tap: 1, fn: click('#place-ok') },
        { t: 11.3, tap: 1, fn: () => { g.select({ kind: 'object', obj: th }); g.openSheet('orders'); } },
        { t: 12.5, tap: 1, fn: () => { s.xp = Math.max(s.xp, (s.level === D.L ? xpToNextL : 0) - 1); click('[data-act="deliver"]')(); } },
        { t: 13.1, fn: () => g.closeSheet() },
        { t: 15.6, tap: 1, fn: () => { g.select(null); click('#modal [data-act="modalOk"]')(); } },
      ],
    });
  }, [+Z, opt.build || 'house3']);
  await new Promise(r => setTimeout(r, 1200)); // imagens
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
  const stills = opt.stills ? opt.stills.split(',').map(Number) : null;
  const N = Math.round(DUR * FPS);
  let si = 0;
  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    await p.evaluate((t) => __dir.frame(t), t);
    await p.clock.runFor(Math.round((f + 1) * 1000 / FPS) - Math.round(f * 1000 / FPS));
    await p.evaluate(() => __dir.sync());
    if (stills) {
      if (si < stills.length && t + 1e-6 >= stills[si]) { await p.screenshot({ path: path.join(DIR, `still-${stills[si]}.jpg`), type: 'jpeg', quality: 80 }); si++; }
      continue;
    }
    await p.screenshot({ path: path.join(DIR, String(f).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93, timeout: 120000 });
  }
  await b.close();
  if (!stills) {
    const out = path.join(__dirname, NAME + '.mp4');
    // --cover=arquivo: o vídeo começa pela capa (regra do CrazyGames) e funde no jogo
    const Wp = Math.round(+W * +DSF), Hp = Math.round(+H * +DSF);
    const input = ['-framerate', String(FPS), '-i', path.join(DIR, '%04d.jpg')];
    const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out];
    if (opt.cover) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-t', '1.1', '-i', opt.cover, ...input, '-filter_complex',
        `[0]scale=${Wp}:${Hp}:force_original_aspect_ratio=increase,crop=${Wp}:${Hp},setsar=1,fps=${FPS},format=yuv420p[c];` +
        `[1]scale=${Wp}:${Hp},setsar=1,format=yuv420p[g];[c][g]xfade=transition=fade:duration=0.5:offset=0.6,format=yuv420p`, ...enc]);
    } else execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...input, ...enc]);
    console.log(out, Math.round(fs.statSync(out).size / 1024) + ' KB');
  }
})();

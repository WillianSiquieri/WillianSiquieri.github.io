// Gera os .zip do CityBloom para os portais de jogos (CrazyGames, GameDistribution).
//
//   node tools/citybloom/build-portal.mjs [pasta-de-saída] [--gd-id=GAME_ID]
//
// Para cada portal: copia games/citybloom/ sem arquivos de desenvolvimento
// (laboratório, documentos, retratos de teste, instrumentos que a música do jogo
// não usa), grava js/portal.js com o portal certo e compacta com index.html na raiz.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = new URL('../../games/citybloom/', import.meta.url).pathname;
const args = process.argv.slice(2);
const OUT = path.resolve(args.find(a => !a.startsWith('--')) || 'dist-citybloom');
const GD_ID = (args.find(a => a.startsWith('--gd-id=')) || '').split('=')[1] || '';

// instrumentos usados pelas músicas ligadas no jogo (ENABLED em music.js)
const { SONGS } = await import(path.join(ROOT, 'js/game/songs.js'));
const enabled = JSON.parse(/const ENABLED = (\[[^\]]*\])/.exec(fs.readFileSync(path.join(ROOT, 'js/engine/music.js'), 'utf8'))[1].replace(/'/g, '"'));
const instruments = new Set(SONGS.filter(s => enabled.includes(s.id)).flatMap(s => s.events.filter(e => e.n).map(e => e.inst)));

const SKIP = [
  /^lab\.html$/, /^DESIGN\.md$/, /^PORTAIS\.md$/, /^marketing\//,
  /^assets\/characters\/(lab|raw)\//,
];
function keep(rel) {
  if (SKIP.some(r => r.test(rel))) return false;
  const m = /^assets\/instruments\/([^/]+)\//.exec(rel);
  if (m && !instruments.has(m[1])) return false;
  return true;
}

function copyTree(src, dst, base = '') {
  for (const name of fs.readdirSync(src)) {
    const rel = base ? `${base}/${name}` : name;
    const from = path.join(src, name), to = path.join(dst, name);
    if (fs.statSync(from).isDirectory()) { if (keep(rel + '/')) copyTree(from, to, rel); continue; }
    if (!keep(rel)) continue;
    fs.mkdirSync(dst, { recursive: true });
    fs.copyFileSync(from, to);
  }
}

const PORTALS = {
  crazygames: '',
  gamedistribution: GD_ID,
};

fs.mkdirSync(OUT, { recursive: true });
for (const [portal, gameId] of Object.entries(PORTALS)) {
  const dir = path.join(OUT, `citybloom-${portal}`);
  fs.rmSync(dir, { recursive: true, force: true });
  copyTree(ROOT, dir);
  fs.writeFileSync(path.join(dir, 'js/portal.js'),
    `// Gerado por tools/citybloom/build-portal.mjs\nwindow.CB_PORTAL = '${portal}';\nwindow.CB_GD_GAME_ID = '${gameId}';\n`);
  const zip = path.join(OUT, `citybloom-${portal}.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-r', '-X', '-q', zip, '.'], { cwd: dir });
  const kb = Math.round(fs.statSync(zip).size / 1024);
  console.log(`${portal}: ${zip} (${kb} KB)${portal === 'gamedistribution' && !gameId ? '  ⚠ sem --gd-id: preencha o Game ID antes de enviar' : ''}`);
}
console.log('instrumentos incluídos:', [...instruments].join(', '));

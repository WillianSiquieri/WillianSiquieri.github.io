// Gera os retratos dos 8 personagens dos pedidos no estilo escolhido (Micah,
// por Micah Lanier, CC BY 4.0, via DiceBear) com cenário e acessório da profissão.
// Saída: games/citybloom/assets/characters/micah/<id>.svg
//
//   cd tools/citybloom && npm install @dicebear/core@9.4.2 @dicebear/micah@9.4.2
//   node characters.mjs
import { createAvatar } from '@dicebear/core';
import * as micah from '@dicebear/micah';
import fs from 'fs';

const OUT = new URL('../../games/citybloom/assets/characters/micah', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ personagens
const NO = { glassesProbability: 0, earringsProbability: 0, facialHairProbability: 0 };
const PEOPLE = {
  builder: { ...NO, hair: ['dougFunny'], hairColor: ['3b2a1e'], facialHair: ['scruff'], facialHairProbability: 100, facialHairColor: ['3b2a1e'],
    baseColor: ['ac6651'], shirt: ['collared'], shirtColor: ['f08a24'], mouth: ['laughing'], eyes: ['smiling'] },
  shop: { ...NO, hair: ['full'], hairColor: ['6b3e26'], baseColor: ['f9c9b6'], shirt: ['crew'], shirtColor: ['2a9d8f'],
    mouth: ['smile'], eyes: ['eyes'], eyebrows: ['eyelashesUp'], earrings: ['hoop'], earringsProbability: 100, earringColor: ['f5b301'] },
  business: { ...NO, hair: ['fonze'], hairColor: ['1f1f1f'], baseColor: ['77311d'], shirt: ['collared'], shirtColor: ['2b3a55'],
    mouth: ['smirk'], eyes: ['eyes'], eyebrows: ['down'] },
  teacher: { ...NO, hair: ['pixie'], hairColor: ['a0522d'], baseColor: ['f9c9b6'], shirt: ['crew'], shirtColor: ['7b5cd6'],
    mouth: ['smile'], eyes: ['round'], eyebrows: ['eyelashesUp'], glasses: ['round'], glassesProbability: 100, glassesColor: ['3b2a1e'] },
  chef: { ...NO, hair: ['mrClean'], baseColor: ['f9c9b6'], facialHair: ['beard'], facialHairProbability: 100, facialHairColor: ['2c1b18'],
    shirt: ['crew'], shirtColor: ['ffffff'], mouth: ['smirk'], eyes: ['smiling'] },
  architect: { ...NO, hair: ['full'], hairColor: ['1b1b1b'], baseColor: ['77311d'], shirt: ['open'], shirtColor: ['e63946'],
    mouth: ['laughing'], eyes: ['eyes'], eyebrows: ['eyelashesUp'], glasses: ['square'], glassesProbability: 100, glassesColor: ['1b1b1b'],
    earrings: ['stud'], earringsProbability: 100, earringColor: ['ffd166'] },
  neighbor: { ...NO, hair: ['mrClean'], baseColor: ['f9c9b6'], facialHair: ['beard'], facialHairProbability: 100, facialHairColor: ['d9d9d9'],
    shirt: ['collared'], shirtColor: ['6c757d'], mouth: ['smile'], eyes: ['smilingShadow'] },
  firefighter: { ...NO, hair: ['pixie'], hairColor: ['4a2c17'], baseColor: ['ac6651'], shirt: ['crew'], shirtColor: ['d64933'],
    mouth: ['smile'], eyes: ['eyesShadow'], eyebrows: ['eyelashesUp'] },
  // guia do jogo: Prefeito Otávio
  mayor: { ...NO, hair: ['fonze'], hairColor: ['c9ccd1'], baseColor: ['f9c9b6'], shirt: ['collared'], shirtColor: ['24324d'],
    mouth: ['smile'], eyes: ['smiling'], eyebrows: ['up'] },
};

// ------------------------------------------------------------------ cenários (200×200)
const stripes = (n, w, y, h, a, b) => Array.from({ length: n }, (_, k) => `<rect x="${k * w}" y="${y}" width="${w}" height="${h}" fill="${k % 2 ? b : a}"/>`).join('');
const SCENE = {
  builder: `
    <linearGradient id="s-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#e8f6ff"/></linearGradient>
    <rect width="200" height="200" fill="url(#s-sky)"/><circle cx="160" cy="38" r="16" fill="#fff3b0" opacity=".9"/>
    <g fill="#b9d3e6"><rect x="8" y="96" width="26" height="74"/><rect x="38" y="78" width="22" height="92"/><rect x="150" y="88" width="30" height="82"/><rect x="182" y="110" width="18" height="60"/></g>
    <g stroke="#f5b700" stroke-width="3" fill="none"><path d="M138 170 V40 H196"/><path d="M138 52 L150 40 M138 64 L162 40 M138 76 L174 40"/><path d="M188 40 V70"/></g>
    <rect x="182" y="70" width="12" height="9" fill="#e08e0b"/>
    <rect x="0" y="176" width="200" height="24" fill="#f5b700"/>
    <g fill="#2b2f36">${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M${k * 28 - 6} 200 L${k * 28 + 8} 176 H${k * 28 + 22} L${k * 28 + 8} 200 Z"/>`).join('')}</g>`,
  shop: `
    <linearGradient id="s-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7d6"/><stop offset="1" stop-color="#ffd4ba"/></linearGradient>
    <rect width="200" height="200" fill="url(#s-wall)"/>
    <g>${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M${k * 25} 0 H${k * 25 + 25} V30 Q${k * 25 + 12.5} 40 ${k * 25} 30 Z" fill="${k % 2 ? '#ffffff' : '#2a9d8f'}"/>`).join('')}</g>
    <g opacity=".55"><rect x="10" y="60" width="52" height="5" rx="2" fill="#c58a55"/><rect x="138" y="60" width="54" height="5" rx="2" fill="#c58a55"/><rect x="10" y="102" width="52" height="5" rx="2" fill="#c58a55"/><rect x="138" y="102" width="54" height="5" rx="2" fill="#c58a55"/>
      <rect x="14" y="44" width="10" height="16" rx="3" fill="#ef476f"/><rect x="28" y="48" width="10" height="12" rx="3" fill="#ffd166"/><rect x="42" y="42" width="12" height="18" rx="3" fill="#06d6a0"/>
      <rect x="142" y="46" width="12" height="14" rx="3" fill="#118ab2"/><rect x="158" y="42" width="10" height="18" rx="3" fill="#ef476f"/><rect x="172" y="48" width="14" height="12" rx="3" fill="#ffd166"/>
      <circle cx="20" cy="94" r="7" fill="#f4a261"/><circle cx="36" cy="94" r="7" fill="#e76f51"/><circle cx="150" cy="94" r="7" fill="#90be6d"/><circle cx="168" cy="94" r="7" fill="#f9c74f"/></g>`,
  business: `
    <linearGradient id="s-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b7fbf"/><stop offset="1" stop-color="#f6b38a"/></linearGradient>
    <rect width="200" height="200" fill="#e9edf3"/>
    <rect x="10" y="12" width="180" height="150" rx="6" fill="url(#s-dusk)"/>
    <g fill="#2f3f63" opacity=".85"><rect x="18" y="80" width="24" height="82"/><rect x="46" y="56" width="20" height="106"/><rect x="70" y="92" width="26" height="70"/><rect x="128" y="64" width="22" height="98"/><rect x="154" y="88" width="28" height="74"/></g>
    <g fill="#ffd77a">${[[22, 88], [30, 100], [50, 64], [58, 80], [50, 96], [134, 72], [142, 90], [160, 96], [170, 110]].map(([x, y]) => `<rect x="${x}" y="${y}" width="4" height="5"/>`).join('')}</g>
    <path d="M100 12 V162 M10 87 H190" stroke="#e9edf3" stroke-width="5"/>
    <rect x="0" y="168" width="200" height="32" fill="#7a5236"/><rect x="0" y="168" width="200" height="5" fill="#946545"/>`,
  teacher: `
    <rect width="200" height="200" fill="#fdf1d8"/>
    <rect x="12" y="16" width="176" height="110" rx="6" fill="#8b5a2b"/><rect x="18" y="22" width="164" height="98" rx="3" fill="#2f6b4f"/>
    <g fill="none" stroke="#f1f5ee" stroke-width="2.4" stroke-linecap="round" opacity=".9">
      <path d="M30 44 l6 -14 l6 14 M32 39 h8"/><path d="M50 30 v14 h5 q5 0 5 -4 q0 -3 -5 -3 h-5 m5 0 q4 0 4 -3.5 q0 -3.5 -4 -3.5 h-5"/><path d="M78 32 q-8 -4 -10 4 q-1 8 10 6"/>
      <path d="M136 36 h12 M142 30 v12 M156 36 h10 M170 33 h8 M170 39 h8"/><path d="M30 70 q16 -12 30 0 t30 0"/><circle cx="150" cy="78" r="12"/></g>
    <rect x="12" y="126" width="176" height="6" fill="#a9763f"/><rect x="40" y="122" width="14" height="4" rx="1" fill="#ffffff"/>
    <g>${stripes(10, 20, 172, 28, '#f6d55c', '#ef8354')}</g>`,
  chef: `
    <rect width="200" height="200" fill="#f4efe8"/>
    <g stroke="#e3dbd0" stroke-width="1.5">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<path d="M${k * 20} 0 V200"/><path d="M0 ${k * 20} H200"/>`).join('')}</g>
    <rect x="0" y="0" width="200" height="22" fill="#d6c7b5"/>
    <g stroke="#8d99a6" stroke-width="2.5" fill="none" stroke-linecap="round">
      <path d="M24 22 V52"/><circle cx="24" cy="58" r="7"/><path d="M44 22 V60"/><path d="M40 60 h8"/>
      <path d="M160 22 V48"/><ellipse cx="160" cy="58" rx="8" ry="10"/><path d="M180 22 V56"/><path d="M176 56 l8 8"/></g>
    <rect x="0" y="178" width="200" height="22" fill="#cdb8a0"/>`,
  architect: `
    <rect width="200" height="200" fill="#1f5f9e"/>
    <g stroke="#5f9be0" stroke-width=".8">${Array.from({ length: 20 }, (_, k) => `<path d="M${k * 10} 0 V200"/><path d="M0 ${k * 10} H200"/>`).join('')}</g>
    <g fill="none" stroke="#e8f3ff" stroke-width="2" opacity=".9">
      <rect x="18" y="20" width="60" height="44"/><path d="M18 42 H50 V64 M50 20 V34"/><path d="M60 42 h18"/>
      <rect x="126" y="24" width="56" height="56"/><path d="M126 52 H154 V80 M154 24 V40"/><circle cx="168" cy="66" r="8"/>
      <path d="M18 90 l30 -20 l30 20 Z"/></g>
    <g transform="rotate(-18 40 150)"><rect x="10" y="140" width="80" height="8" fill="#ffd166"/><path d="M14 140 v4 M22 140 v6 M30 140 v4 M38 140 v6 M46 140 v4 M54 140 v6 M62 140 v4 M70 140 v6 M78 140 v4" stroke="#8a6a1e" stroke-width="1"/></g>
    <path d="M150 120 l30 50 h-60 Z" fill="none" stroke="#ffd166" stroke-width="4"/>`,
  neighbor: `
    <linearGradient id="s-sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9edcff"/><stop offset="1" stop-color="#e6f7ff"/></linearGradient>
    <rect width="200" height="200" fill="url(#s-sky2)"/>
    <circle cx="36" cy="34" r="14" fill="#fff3b0"/>
    <ellipse cx="60" cy="40" rx="22" ry="8" fill="#ffffff" opacity=".9"/><ellipse cx="150" cy="30" rx="26" ry="9" fill="#ffffff" opacity=".9"/>
    <g fill="#f3e2c3" stroke="#d4bb92" stroke-width="1.2">${Array.from({ length: 11 }, (_, k) => `<path d="M${k * 19 + 2} 150 V104 l7 -8 l7 8 V150 Z"/>`).join('')}</g>
    <rect x="0" y="114" width="200" height="6" fill="#e2cda6"/><rect x="0" y="136" width="200" height="6" fill="#e2cda6"/>
    <rect x="0" y="148" width="200" height="52" fill="#7cc35f"/>
    <g>${[[20, 152, '#ff6b8b'], [40, 158, '#ffd166'], [160, 154, '#c084fc'], [180, 160, '#ff6b8b'], [140, 162, '#ffffff']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.6" fill="#ffe066"/>`).join('')}</g>`,
  firefighter: `
    <rect width="200" height="200" fill="#c83d2d"/>
    <g fill="#b33426">${Array.from({ length: 12 }, (_, r) => Array.from({ length: 7 }, (_, c) => `<rect x="${c * 30 + (r % 2 ? 15 : 0) - 10}" y="${r * 16}" width="28" height="14" rx="1"/>`).join('')).join('')}</g>
    <rect x="30" y="40" width="140" height="160" rx="6" fill="#f1f1f1"/>
    <g fill="#d9dde2">${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<rect x="30" y="${52 + k * 18}" width="140" height="3"/>`).join('')}</g>
    <rect x="44" y="52" width="112" height="18" rx="3" fill="#9fc5df" opacity=".9"/>
    <circle cx="100" cy="26" r="10" fill="#ffd166"/><path d="M100 18 l2.4 5 5.4.6-4 3.7 1 5.3-4.8-2.6-4.8 2.6 1-5.3-4-3.7 5.4-.6Z" fill="#c83d2d"/>`,
  mayor: `
    <linearGradient id="s-sky3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#dff1ff"/></linearGradient>
    <rect width="200" height="200" fill="url(#s-sky3)"/>
    <ellipse cx="34" cy="30" rx="20" ry="7" fill="#ffffff" opacity=".9"/><ellipse cx="172" cy="22" rx="18" ry="6" fill="#ffffff" opacity=".9"/>
    <path d="M100 6 V40" stroke="#6b7280" stroke-width="2"/><path d="M100 7 h22 l-5 6 5 6 h-22 Z" fill="#2bb673"/><circle cx="109" cy="13" r="3" fill="#ffd166"/>
    <path d="M100 40 C76 40 70 58 70 58 H130 C130 58 124 40 100 40 Z" fill="#e9eef5" stroke="#c7d0dc" stroke-width="1.5"/>
    <path d="M6 82 L100 52 L194 82 Z" fill="#f6f1e7" stroke="#d8cbb3" stroke-width="2"/>
    <rect x="0" y="82" width="200" height="10" fill="#e7dcc6"/>
    <rect x="0" y="92" width="200" height="108" fill="#fbf7ef"/>
    <g fill="#ffffff" stroke="#e0d4bd" stroke-width="1.5">${[8, 40, 140, 172].map(x => `<rect x="${x}" y="92" width="20" height="108"/><rect x="${x - 3}" y="92" width="26" height="6"/>`).join('')}</g>
    <g fill="#9cc7e6" opacity=".8"><rect x="60" y="104" width="16" height="26" rx="8"/><rect x="124" y="104" width="16" height="26" rx="8"/></g>
    <rect x="0" y="186" width="200" height="14" fill="#d9cdb3"/>`,
};

// ------------------------------------------------------------------ acessórios
const hardHat = (cx, y, w) => { const s = w / 100; return `<g transform="translate(${cx} ${y}) scale(${s})">
  <path d="M-46 0 Q-46 -46 0 -48 Q46 -46 46 0 Z" fill="#ffc300"/>
  <path d="M-46 0 Q-46 -46 0 -48 Q8 -47.6 14 -46 Q-30 -40 -34 0 Z" fill="#ffe066" opacity=".8"/>
  <path d="M-8 -47 H8 V0 H-8 Z" fill="#f2b400"/>
  <path d="M-58 0 Q0 -8 58 0 Q60 7 54 9 Q0 3 -54 9 Q-60 7 -58 0 Z" fill="#e8a800"/>
  <path d="M-46 0 Q-46 -46 0 -48 Q46 -46 46 0" fill="none" stroke="#c98e00" stroke-width="2.5"/></g>`; };

const fireHelmet = (cx, y, w) => { const s = w / 100; return `<g transform="translate(${cx} ${y}) scale(${s})">
  <path d="M-46 0 Q-48 -50 0 -52 Q48 -50 46 0 Z" fill="#d62828"/>
  <path d="M-46 0 Q-48 -50 0 -52 Q8 -51.6 14 -50 Q-30 -44 -34 0 Z" fill="#ef5b4b" opacity=".8"/>
  <path d="M-5 -51 H5 V0 H-5 Z" fill="#a91d1d"/>
  <path d="M-62 -2 Q0 -10 62 -2 Q66 10 50 12 Q0 4 -50 12 Q-66 10 -62 -2 Z" fill="#a91d1d"/>
  <path d="M-12 -40 L12 -40 L14 -18 L0 -10 L-14 -18 Z" fill="#ffd166" stroke="#c99a1e" stroke-width="2"/>
  <text x="0" y="-21" font-family="Arial" font-weight="900" font-size="16" text-anchor="middle" fill="#a91d1d">1</text></g>`; };

const chefHat = (cx, y, w) => { const s = w / 100; return `<g transform="translate(${cx} ${y}) scale(${s})">
  <circle cx="-26" cy="-34" r="24" fill="#ffffff"/><circle cx="26" cy="-34" r="24" fill="#ffffff"/>
  <circle cx="-26" cy="-34" r="24" fill="none" stroke="#dfe4ea" stroke-width="2"/><circle cx="26" cy="-34" r="24" fill="none" stroke="#dfe4ea" stroke-width="2"/>
  <circle cx="0" cy="-48" r="28" fill="#ffffff"/>
  <path d="M-40 -18 H40 V2 Q0 6 -40 2 Z" fill="#ffffff" stroke="#dfe4ea" stroke-width="2"/>
  <path d="M-12 -64 Q-2 -70 10 -64" fill="none" stroke="#eef1f5" stroke-width="3"/></g>`; };

const cap = (cx, y, w) => { const s = w / 100; return `<g transform="translate(${cx} ${y}) scale(${s})">
  <path d="M-46 2 Q-46 -44 0 -46 Q46 -44 46 2 Z" fill="#2f6f8e"/>
  <path d="M-46 2 Q-46 -44 0 -46 Q6 -45.8 12 -44 Q-30 -38 -34 2 Z" fill="#4a8db0" opacity=".8"/>
  <path d="M-46 2 Q-80 0 -88 10 Q-60 14 -30 8 Z" fill="#245a74"/>
  <circle cx="0" cy="-45" r="4" fill="#245a74"/><path d="M0 -44 V0 M-28 -36 Q-20 -12 -22 2 M28 -36 Q20 -12 22 2" stroke="#245a74" stroke-width="1.6" fill="none"/></g>`; };

const tie = (cx, y, w) => { const s = w / 100; return `<g transform="translate(${cx} ${y}) scale(${s})">
  <path d="M-12 0 H12 L8 14 H-8 Z" fill="#c1121f"/><path d="M-8 14 H8 L14 70 L0 86 L-14 70 Z" fill="#e63946"/>
  <path d="M-6 30 L8 22 M-9 48 L11 38 M-12 66 L12 54" stroke="#ffb3b8" stroke-width="3" opacity=".7"/></g>`; };

// faixa de prefeito (verde-amarela, na diagonal do ombro ao quadril)
const sash = () => `<g>
  <path d="M132 160 L150 168 L74 200 L48 200 Z" fill="#1f9d55"/>
  <path d="M138 163 L144 165.5 L66 200 L58 200 Z" fill="#ffd23f"/>
  <circle cx="100" cy="182" r="8" fill="#ffd23f" stroke="#c99a1e" stroke-width="1.5"/><circle cx="100" cy="182" r="3.4" fill="#1f9d55"/></g>`;

const mustache = (cx, y, w) => { const s = w / 100; return `<g transform="translate(${cx} ${y}) scale(${s})">
  <path d="M0 -4 C-10 -12 -30 -10 -40 2 C-34 8 -22 4 -14 6 C-6 8 -2 4 0 2 C2 4 6 8 14 6 C22 4 34 8 40 2 C30 -10 10 -12 0 -4 Z" fill="#b9bec6" stroke="#7d848e" stroke-width="2"/></g>`; };

const X = 15, Y = 32, S = 168;
const ACCESSORY = {
  builder: () => hardHat(X + S * 0.48, Y + S * 0.23, S * 0.56),
  chef: () => chefHat(X + S * 0.48, Y + S * 0.24, S * 0.49),
  firefighter: () => fireHelmet(X + S * 0.5, Y + S * 0.23, S * 0.55),
  neighbor: () => cap(X + S * 0.5, Y + S * 0.23, S * 0.52),
  business: () => tie(X + S * 0.5, Y + S * 0.9, S * 0.2),
  mayor: () => tie(X + S * 0.5, Y + S * 0.9, S * 0.2) + sash() + mustache(MX, MY, MW),
};
const [MX, MY, MW] = (process.env.MUST || '108,125,40').split(',').map(Number);

function inline(svg) {
  const raw = svg.replace(/<\?xml[^>]*>/, '');
  const vb = /viewBox="([^"]+)"/.exec(raw)[1];
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  // preserva atributos da raiz (ex.: fill="none", que deixa as lentes dos óculos transparentes)
  const attrs = /<svg([^>]*)>/.exec(raw)[1].replace(/\s(xmlns(:\w+)?|width|height|viewBox)="[^"]*"/g, '');
  return `<svg x="${X}" y="${Y}" width="${S}" height="${S}" viewBox="${vb}"${attrs}>${inner}</svg>`;
}

for (const [id, opts] of Object.entries(PEOPLE)) {
  const avatar = createAvatar(micah, { seed: id, backgroundColor: ['transparent'], ...opts }).toString();
  const acc = ACCESSORY[id] ? ACCESSORY[id]() : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs><clipPath id="s-clip"><rect width="200" height="200" rx="28"/></clipPath></defs>
  <g clip-path="url(#s-clip)">${SCENE[id]}${inline(avatar)}${acc}</g></svg>`;
  fs.writeFileSync(`${OUT}/${id}.svg`, svg);
}
// ------------------------------------------------------------------ prefeito de corpo inteiro
// Cabeça Micah (a mesma do retrato) sobre um corpo desenhado no mesmo traço:
// paletó, faixa de prefeito, um braço acenando e o outro com uma prancheta.
// Fundo transparente, viewBox 200×400.
function fullBody() {
  const K = 2.8, INK = '#111', NAVY = '#24324d', SKIN = '#f9c9b6';
  const A = 170, AX = 15, AY = 0;                       // cabeça: 170×170 no topo
  const head = createAvatar(micah, { seed: 'mayor', backgroundColor: ['transparent'], ...PEOPLE.mayor }).toString();
  const headSvg = inline(head).replace(/x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*"/, `x="${AX}" y="${AY}" width="${A}" height="${A}"`);
  const st = `stroke="${INK}" stroke-width="${K}" stroke-linejoin="round" stroke-linecap="round"`;
  const limb = (d, w, c) => `<path d="${d}" stroke="${INK}" stroke-width="${w + 2 * K}" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="9.5" fill="${SKIN}" ${st}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400" width="200" height="400">
  <ellipse cx="100" cy="391" rx="64" ry="7" fill="#1a2a40" opacity=".18"/>
  <path d="M62 288 L60 372 H97 L100 288 Z" fill="#1b2438" ${st}/>
  <path d="M100 288 L103 372 H140 L138 288 Z" fill="#1b2438" ${st}/>
  <path d="M57 371 H98 V379 Q98 386 91 386 H52 Q45 386 47 379 Q49 371 57 371 Z" fill="#4a2e1c" ${st}/>
  <path d="M102 371 H143 Q151 371 153 379 Q155 386 148 386 H109 Q102 386 102 379 Z" fill="#4a2e1c" ${st}/>
  <path d="M34 168 C30 200 32 250 36 292 H164 C168 250 170 200 164 168 Z" fill="${NAVY}"/>
  <path d="M34 168 C30 200 32 250 36 292 H164 C168 250 170 200 164 168" fill="none" ${st}/>
  <path d="M38 280 H162" stroke="#1b2438" stroke-width="5" opacity=".6"/>
  ${headSvg}
  <path d="M88 166 H112 L100 228 Z" fill="#ffffff" ${st}/>
  <path d="M96 167 H104 L102.5 175 H97.5 Z" fill="#c1121f" ${st}/>
  <path d="M97.5 175 H102.5 L106 212 L100 220 L94 212 Z" fill="#e63946" ${st}/>
  <path d="M86 168 L77 196 L100 232 M114 168 L123 196 L100 232" fill="none" ${st}/>
  <circle cx="100" cy="250" r="2.6" fill="#0f1626"/><circle cx="100" cy="268" r="2.6" fill="#0f1626"/>
  <path d="M140 169 L163 179 L62 292 L38 282 Z" fill="#1f9d55" ${st}/>
  <path d="M152 174 L50 287" stroke="#ffd23f" stroke-width="6"/>
  <circle cx="94" cy="236" r="9" fill="#ffd23f" ${st}/><circle cx="94" cy="236" r="3.8" fill="#1f9d55"/>
  <g transform="rotate(-10 136 250)">
    <rect x="116" y="226" width="40" height="50" rx="4" fill="#c58a55" ${st}/>
    <rect x="121" y="234" width="30" height="37" rx="2" fill="#ffffff"/>
    <path d="M125 244 H147 M125 251 H147 M125 258 H141" stroke="#9aa5b5" stroke-width="2"/>
    <rect x="128" y="222" width="16" height="8" rx="2" fill="#b8c0cc" ${st}/>
  </g>
  ${limb('M42 186 L20 224 L19 178', 21, NAVY)}
  <g fill="${SKIN}" ${st}>
    <rect x="10.5" y="146" width="6" height="14" rx="3" transform="rotate(-12 13 153)"/>
    <rect x="16.5" y="143" width="6" height="15" rx="3"/>
    <rect x="22.5" y="145" width="6" height="14" rx="3" transform="rotate(12 25 152)"/>
    <ellipse cx="29" cy="165" rx="4" ry="6.5" transform="rotate(35 29 165)"/>
    <ellipse cx="19.5" cy="166" rx="10.5" ry="11"/>
  </g>
  <path d="M15 156 V162 M20 155 V161 M24.5 156 V162" stroke="${SKIN}" stroke-width="3.2" stroke-linecap="round"/>
  ${limb('M158 186 L174 234 L152 254', 21, NAVY)}
  ${hand(146, 256)}
  ${mustache(AX + 0.5536 * A, AY + 0.5536 * A, 0.238 * A)}
</svg>`;
}
fs.writeFileSync(`${OUT}/mayor-full.svg`, fullBody());

console.log('ok:', fs.readdirSync(OUT).join(' '));

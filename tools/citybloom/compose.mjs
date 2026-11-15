// Gera os cartões de personagem do laboratório (4 estilos × 3 personagens)
// em games/citybloom/assets/characters/lab/<estilo>/<quem>.svg
import fs from 'fs';
const ROOT = new URL('../../games/citybloom/assets/characters', import.meta.url).pathname;
const RAW = ROOT + '/raw';

// ------------------------------------------------------------------ cenários
const SCENE = {
  builder: `
    <linearGradient id="cb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#e8f6ff"/></linearGradient>
    <rect width="200" height="200" fill="url(#cb-sky)"/>
    <circle cx="160" cy="38" r="16" fill="#fff3b0" opacity=".9"/>
    <g fill="#b9d3e6"><rect x="8" y="96" width="26" height="74"/><rect x="38" y="78" width="22" height="92"/><rect x="150" y="88" width="30" height="82"/><rect x="182" y="110" width="18" height="60"/></g>
    <g fill="#d6e6f2"><rect x="12" y="102" width="6" height="6"/><rect x="22" y="102" width="6" height="6"/><rect x="12" y="114" width="6" height="6"/><rect x="42" y="86" width="5" height="6"/><rect x="51" y="86" width="5" height="6"/><rect x="156" y="96" width="6" height="6"/><rect x="167" y="96" width="6" height="6"/></g>
    <g stroke="#f5b700" stroke-width="3" fill="none"><path d="M138 170 V40 H196"/><path d="M138 52 L150 40 M138 64 L162 40 M138 76 L174 40"/><path d="M188 40 V70"/></g>
    <rect x="182" y="70" width="12" height="9" fill="#e08e0b"/>
    <rect x="0" y="176" width="200" height="24" fill="#f5b700"/>
    <g fill="#2b2f36">${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M${k * 28 - 6} 200 L${k * 28 + 8} 176 H${k * 28 + 22} L${k * 28 + 8} 200 Z"/>`).join('')}</g>`,
  shop: `
    <linearGradient id="cb-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7d6"/><stop offset="1" stop-color="#ffd4ba"/></linearGradient>
    <rect width="200" height="200" fill="url(#cb-wall)"/>
    <g>${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M${k * 25} 0 H${k * 25 + 25} V30 Q${k * 25 + 12.5} 40 ${k * 25} 30 Z" fill="${k % 2 ? '#ffffff' : '#2a9d8f'}"/>`).join('')}</g>
    <g opacity=".55"><rect x="10" y="60" width="52" height="5" rx="2" fill="#c58a55"/><rect x="138" y="60" width="54" height="5" rx="2" fill="#c58a55"/><rect x="10" y="102" width="52" height="5" rx="2" fill="#c58a55"/><rect x="138" y="102" width="54" height="5" rx="2" fill="#c58a55"/>
      <rect x="14" y="44" width="10" height="16" rx="3" fill="#ef476f"/><rect x="28" y="48" width="10" height="12" rx="3" fill="#ffd166"/><rect x="42" y="42" width="12" height="18" rx="3" fill="#06d6a0"/>
      <rect x="142" y="46" width="12" height="14" rx="3" fill="#118ab2"/><rect x="158" y="42" width="10" height="18" rx="3" fill="#ef476f"/><rect x="172" y="48" width="14" height="12" rx="3" fill="#ffd166"/>
      <circle cx="20" cy="94" r="7" fill="#f4a261"/><circle cx="36" cy="94" r="7" fill="#e76f51"/><circle cx="150" cy="94" r="7" fill="#90be6d"/><circle cx="168" cy="94" r="7" fill="#f9c74f"/></g>`,
  chef: `
    <rect width="200" height="200" fill="#f4efe8"/>
    <g stroke="#e3dbd0" stroke-width="1.5">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<path d="M${k * 20} 0 V200"/><path d="M0 ${k * 20} H200"/>`).join('')}</g>
    <rect x="0" y="0" width="200" height="22" fill="#d6c7b5"/>
    <g stroke="#8d99a6" stroke-width="2.5" fill="none" stroke-linecap="round">
      <path d="M24 22 V52"/><circle cx="24" cy="58" r="7"/><path d="M44 22 V60"/><path d="M40 60 h8"/>
      <path d="M160 22 V48"/><ellipse cx="160" cy="58" rx="8" ry="10"/><path d="M180 22 V56"/><path d="M176 56 l8 8"/></g>
    <rect x="0" y="178" width="200" height="22" fill="#cdb8a0"/>`,
};

const card = (who, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs><clipPath id="cb-clip"><rect width="200" height="200" rx="28"/></clipPath></defs>
  <g clip-path="url(#cb-clip)">${SCENE[who]}${body}</g></svg>`;

// ------------------------------------------------------------------ acessórios
const hardHat = (cx, y, w) => { const s = w / 100; return `<g transform="translate(${cx} ${y}) scale(${s})">
  <path d="M-46 0 Q-46 -46 0 -48 Q46 -46 46 0 Z" fill="#ffc300"/>
  <path d="M-46 0 Q-46 -46 0 -48 Q8 -47.6 14 -46 Q-30 -40 -34 0 Z" fill="#ffe066" opacity=".8"/>
  <path d="M-8 -47 H8 V0 H-8 Z" fill="#f2b400"/>
  <path d="M-58 0 Q0 -8 58 0 Q60 7 54 9 Q0 3 -54 9 Q-60 7 -58 0 Z" fill="#e8a800"/>
  <path d="M-46 0 Q-46 -46 0 -48 Q46 -46 46 0" fill="none" stroke="#c98e00" stroke-width="2.5"/></g>`; };

const chefHat = (cx, y, w) => { const s = w / 100; return `<g transform="translate(${cx} ${y}) scale(${s})">
  <circle cx="-26" cy="-34" r="24" fill="#ffffff"/><circle cx="26" cy="-34" r="24" fill="#ffffff"/><circle cx="0" cy="-48" r="28" fill="#ffffff"/>
  <circle cx="-26" cy="-34" r="24" fill="none" stroke="#dfe4ea" stroke-width="2"/><circle cx="26" cy="-34" r="24" fill="none" stroke="#dfe4ea" stroke-width="2"/>
  <circle cx="0" cy="-48" r="28" fill="#ffffff"/>
  <path d="M-40 -18 H40 V2 Q0 6 -40 2 Z" fill="#ffffff" stroke="#dfe4ea" stroke-width="2"/>
  <path d="M-12 -64 Q-2 -70 10 -64" fill="none" stroke="#eef1f5" stroke-width="3"/></g>`; };

// ------------------------------------------------------------------ estilos da biblioteca
function inlineRaw(file, x, y, size) {
  const raw = fs.readFileSync(`${RAW}/${file}`, 'utf8').replace(/<\?xml[^>]*>/, '');
  const vb = /viewBox="([^"]+)"/.exec(raw)[1];
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const attrs = /<svg([^>]*)>/.exec(raw)[1].replace(/\s(xmlns(:\w+)?|width|height|viewBox)="[^"]*"/g, '');
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}"${attrs}>${inner}</svg>`;
}

// posição da cabeça em frações da caixa do avatar: topo, largura, centro x
const HEAD = {
  avataaars: { builder: [0.07, 0.5, 0.5], shop: [0.0, 0.48, 0.5], chef: [0.1, 0.47, 0.5] },
  personas:  { builder: [0.18, 0.5, 0.5], shop: [0.1, 0.5, 0.5], chef: [0.2, 0.48, 0.5] },
  micah:     { builder: [0.12, 0.5, 0.48], shop: [0.06, 0.5, 0.5], chef: [0.12, 0.47, 0.48] },
};

function libraryCard(style, who) {
  const X = 15, Y = 32, S = 168;
  const [top, wid, cx] = HEAD[style][who];
  let hat = '';
  if (who === 'builder') hat = hardHat(X + S * cx, Y + S * (top + 0.11), S * wid * 1.12);
  if (who === 'chef') hat = chefHat(X + S * cx, Y + S * (top + 0.12), S * wid * 1.05);
  return card(who, inlineRaw(`${who}-${style}.svg`, X, Y, S) + hat);
}

// ------------------------------------------------------------------ ilustração própria
// Partes reutilizáveis (coordenadas no cartão 200×200).
function face({ skin, skinShade, iris, brow, mouth = 'smile', blush = true }) {
  return `
  <!-- orelhas -->
  <ellipse cx="66" cy="96" rx="9" ry="12" fill="${skin}"/><ellipse cx="66" cy="96" rx="4.5" ry="7" fill="${skinShade}"/>
  <ellipse cx="134" cy="96" rx="9" ry="12" fill="${skin}"/><ellipse cx="134" cy="96" rx="4.5" ry="7" fill="${skinShade}"/>
  <!-- cabeça -->
  <path d="M100 46 C126 46 136 64 136 88 C136 116 122 136 100 138 C78 136 64 116 64 88 C64 64 74 46 100 46 Z" fill="url(#cb-skin)"/>
  <path d="M70 108 C76 126 88 136 100 138 C112 136 124 126 130 108 C124 122 112 130 100 131 C88 130 76 122 70 108 Z" fill="${skinShade}" opacity=".35"/>
  ${blush ? `<ellipse cx="80" cy="108" rx="8" ry="5" fill="#ff8a80" opacity=".3"/><ellipse cx="120" cy="108" rx="8" ry="5" fill="#ff8a80" opacity=".3"/>` : ''}
  <!-- olhos -->
  <g>
    <ellipse cx="85" cy="94" rx="8.5" ry="7.5" fill="#ffffff"/><ellipse cx="115" cy="94" rx="8.5" ry="7.5" fill="#ffffff"/>
    <circle cx="86" cy="95" r="5.4" fill="${iris}"/><circle cx="116" cy="95" r="5.4" fill="${iris}"/>
    <circle cx="86" cy="95" r="2.8" fill="#1d1d24"/><circle cx="116" cy="95" r="2.8" fill="#1d1d24"/>
    <circle cx="88" cy="92.6" r="1.7" fill="#fff"/><circle cx="118" cy="92.6" r="1.7" fill="#fff"/>
    <circle cx="84" cy="97" r=".8" fill="#fff" opacity=".8"/><circle cx="114" cy="97" r=".8" fill="#fff" opacity=".8"/>
    <path d="M76.5 92 Q85 84.5 93.5 91" fill="none" stroke="#2b2b33" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M106.5 91 Q115 84.5 123.5 92" fill="none" stroke="#2b2b33" stroke-width="2.2" stroke-linecap="round"/>
  </g>
  <!-- sobrancelhas -->
  <path d="M75 82 Q84 76 93 80" fill="none" stroke="${brow}" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M107 80 Q116 76 125 82" fill="none" stroke="${brow}" stroke-width="3.6" stroke-linecap="round"/>
  <!-- nariz -->
  <path d="M100 98 Q96 108 99 111 Q102 113 105 110" fill="none" stroke="${skinShade}" stroke-width="2.4" stroke-linecap="round"/>
  <!-- boca -->
  ${mouth === 'smile'
    ? `<path d="M88 117 Q100 129 112 117 Q100 121 88 117 Z" fill="#8f2d2d"/><path d="M90.5 118 Q100 121.4 109.5 118 L108 120.5 Q100 122.6 92 120.5 Z" fill="#ffffff"/><path d="M95 124 Q100 127 105 124 Q100 125.5 95 124Z" fill="#e57373"/>`
    : `<path d="M90 118 Q100 126 110 118" fill="none" stroke="#8f2d2d" stroke-width="3" stroke-linecap="round"/>`}`;
}

const skinDefs = (skin, light) => `<radialGradient id="cb-skin" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${skin}"/></radialGradient>`;

// --- Beto, construtor: colete laranja refletivo, capacete, tábua no ombro
function illBuilder() {
  const skin = '#d9956b', light = '#f0b98f', shade = '#b8744d';
  return card('builder', `
  <defs>${skinDefs(skin, light)}
    <linearGradient id="cb-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f7cc4"/><stop offset="1" stop-color="#36599a"/></linearGradient>
    <linearGradient id="cb-vest" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa23a"/><stop offset="1" stop-color="#ea7a12"/></linearGradient>
    <linearGradient id="cb-plank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7b77d"/><stop offset="1" stop-color="#c58a4c"/></linearGradient></defs>
  <!-- tábua atrás, apoiada no ombro -->
  <g transform="rotate(-24 150 120)"><rect x="96" y="112" width="110" height="18" rx="3" fill="url(#cb-plank)"/>
    <path d="M100 118 H200 M104 124 H196" stroke="#a96f37" stroke-width="1.2" opacity=".6"/><ellipse cx="170" cy="121" rx="4" ry="2.5" fill="#a96f37" opacity=".7"/></g>
  <!-- tronco -->
  <path d="M38 200 C38 168 54 150 80 144 L100 152 L120 144 C146 150 162 168 162 200 Z" fill="url(#cb-shirt)"/>
  <path d="M86 146 L100 166 L114 146 L120 144 L100 176 L80 144 Z" fill="#2f4f8a"/>
  <!-- colete -->
  <path d="M46 200 C46 172 58 156 80 148 L92 200 Z" fill="url(#cb-vest)"/><path d="M154 200 C154 172 142 156 120 148 L108 200 Z" fill="url(#cb-vest)"/>
  <path d="M52 178 L88 182 L89 190 L50 187 Z" fill="#e8eef5"/><path d="M148 178 L112 182 L111 190 L150 187 Z" fill="#e8eef5"/>
  <path d="M52 178 L88 182" stroke="#b8c4d0" stroke-width="1"/><path d="M148 178 L112 182" stroke="#b8c4d0" stroke-width="1"/>
  <rect x="122" y="160" width="14" height="10" rx="2" fill="#d96a0c"/><path d="M125 160 v-6" stroke="#555" stroke-width="2"/>
  <!-- braço levantado segurando a tábua -->
  <path d="M150 158 C162 150 168 132 164 118 L152 116 C154 128 150 140 140 150 Z" fill="url(#cb-shirt)"/>
  <ellipse cx="158" cy="114" rx="9" ry="8" fill="${skin}"/><path d="M151 112 q7 -6 14 0" fill="none" stroke="${shade}" stroke-width="1.5"/>
  <!-- pescoço -->
  <path d="M88 128 H112 V150 Q100 158 88 150 Z" fill="${skin}"/><path d="M88 138 Q100 146 112 138 V146 Q100 152 88 146 Z" fill="${shade}" opacity=".5"/>
  ${face({ skin, skinShade: shade, iris: '#6b4226', brow: '#3b2a1e' })}
  <!-- bigode e barba por fazer -->
  <path d="M86 113 Q93 108 100 112 Q107 108 114 113 Q108 118 100 115 Q92 118 86 113 Z" fill="#3b2a1e"/>
  <g fill="#3b2a1e" opacity=".25">${Array.from({ length: 26 }, (_, k) => `<circle cx="${78 + (k * 37) % 44}" cy="${116 + (k * 13) % 16}" r=".9"/>`).join('')}</g>
  <!-- cabelo nas laterais -->
  <path d="M65 84 Q64 70 72 64 L74 86 Z" fill="#3b2a1e"/><path d="M135 84 Q136 70 128 64 L126 86 Z" fill="#3b2a1e"/>
  ${hardHat(100, 70, 92)}`);
}

// --- Dona Lúcia, lojista: coque, brincos, avental com etiqueta, sacola de compras
function illShop() {
  const skin = '#f2c29b', light = '#ffdcbc', shade = '#d39b74';
  return card('shop', `
  <defs>${skinDefs(skin, light)}
    <linearGradient id="cb-blouse" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fb3a3"/><stop offset="1" stop-color="#1f8a7d"/></linearGradient>
    <linearGradient id="cb-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4f30"/><stop offset="1" stop-color="#5f3420"/></linearGradient>
    <linearGradient id="cb-bag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8c28e"/><stop offset="1" stop-color="#c99a5e"/></linearGradient></defs>
  <!-- coque atrás -->
  <circle cx="100" cy="40" r="17" fill="url(#cb-hair)"/><path d="M88 34 Q100 26 112 34" fill="none" stroke="#b07a52" stroke-width="2" opacity=".7"/>
  <!-- tronco -->
  <path d="M40 200 C40 168 56 150 82 144 L100 156 L118 144 C144 150 160 168 160 200 Z" fill="url(#cb-blouse)"/>
  <!-- avental -->
  <path d="M70 200 L74 160 Q100 168 126 160 L130 200 Z" fill="#fff8ee"/>
  <path d="M74 160 L84 146 M126 160 L116 146" stroke="#fff8ee" stroke-width="4" stroke-linecap="round"/>
  <rect x="86" y="182" width="28" height="14" rx="3" fill="#f3e6d3"/><path d="M86 186 H114" stroke="#e2d2bb" stroke-width="1"/>
  <rect x="108" y="166" width="16" height="9" rx="2" fill="#ffffff" stroke="#2a9d8f" stroke-width="1.2"/><path d="M111 170.5 h10" stroke="#2a9d8f" stroke-width="1.5"/>
  <!-- sacola de compras segurada na frente -->
  <path d="M40 160 Q48 142 60 160" fill="none" stroke="#a87a45" stroke-width="3"/>
  <path d="M34 160 H66 L70 200 H30 Z" fill="url(#cb-bag)"/>
  <path d="M38 160 C40 150 44 146 48 150 M50 160 C52 146 58 144 60 152" fill="none" stroke="#3fae5a" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="44" cy="158" rx="7" ry="4" fill="#f4a261"/><circle cx="58" cy="157" r="4.5" fill="#e63946"/>
  <path d="M38 172 H62" stroke="#b9894f" stroke-width="1.5" opacity=".6"/>
  <ellipse cx="62" cy="168" rx="8" ry="7" fill="${skin}"/>
  <!-- pescoço -->
  <path d="M89 128 H111 V150 Q100 158 89 150 Z" fill="${skin}"/><path d="M89 138 Q100 146 111 138 V146 Q100 152 89 146 Z" fill="${shade}" opacity=".5"/>
  ${face({ skin, skinShade: shade, iris: '#3f7d5a', brow: '#5f3420' })}
  <!-- cílios e batom -->
  <path d="M77 90 l-3 -2 M93 89 l3 -2 M107 89 l-3 -2 M123 90 l3 -2" stroke="#2b2b33" stroke-width="1.6" stroke-linecap="round"/>
  <!-- cabelo -->
  <path d="M64 92 C60 62 78 46 100 46 C122 46 140 62 136 92 C132 76 126 66 112 62 C102 70 84 72 70 70 C66 76 65 84 64 92 Z" fill="url(#cb-hair)"/>
  <path d="M78 60 Q96 54 112 62 M74 70 Q90 64 104 66" fill="none" stroke="#b07a52" stroke-width="1.8" opacity=".6"/>
  <!-- brincos -->
  <circle cx="66" cy="110" r="3.5" fill="none" stroke="#f5b301" stroke-width="2"/><circle cx="134" cy="110" r="3.5" fill="none" stroke="#f5b301" stroke-width="2"/>`);
}

// --- Chef Marco: dólmã branco com botões, lenço vermelho, toque, bigode, frigideira
function illChef() {
  const skin = '#e3a77f', light = '#f7c9a5', shade = '#c0835c';
  return card('chef', `
  <defs>${skinDefs(skin, light)}
    <linearGradient id="cb-coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e8ee"/></linearGradient>
    <linearGradient id="cb-pan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b6470"/><stop offset="1" stop-color="#2d333b"/></linearGradient></defs>
  <!-- tronco -->
  <path d="M38 200 C38 168 54 150 80 144 L100 152 L120 144 C146 150 162 168 162 200 Z" fill="url(#cb-coat)"/>
  <path d="M100 152 L120 144 C126 160 124 186 118 200 H100 Z" fill="#eef2f6"/>
  <g fill="#c9d1da">${[164, 178, 192].map(y => `<circle cx="90" cy="${y}" r="2.6"/><circle cx="112" cy="${y}" r="2.6"/>`).join('')}</g>
  <path d="M80 144 Q100 160 120 144 L114 156 Q100 164 86 156 Z" fill="#e63946"/><path d="M96 158 L100 172 L104 158 Z" fill="#c62e3b"/>
  <!-- braço com frigideira -->
  <path d="M146 156 C158 150 164 140 162 128 L150 126 C150 136 146 144 136 150 Z" fill="url(#cb-coat)"/>
  <rect x="156" y="88" width="7" height="44" rx="3" fill="#3b2a1e" transform="rotate(18 159 110)"/>
  <ellipse cx="170" cy="84" rx="26" ry="10" fill="url(#cb-pan)" transform="rotate(-10 170 84)"/>
  <ellipse cx="170" cy="82" rx="20" ry="6.5" fill="#1f242b" transform="rotate(-10 170 84)"/>
  <ellipse cx="166" cy="80" rx="7" ry="3.2" fill="#ffd166"/><circle cx="168" cy="79.5" r="2.2" fill="#ff9f1c"/>
  <path d="M160 70 q-4 -8 2 -14 M172 68 q-4 -8 2 -14 M182 70 q-4 -8 2 -14" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>
  <ellipse cx="156" cy="126" rx="9" ry="8" fill="${skin}"/>
  <!-- pescoço -->
  <path d="M88 128 H112 V148 Q100 156 88 148 Z" fill="${skin}"/>
  ${face({ skin, skinShade: shade, iris: '#4a3423', brow: '#2c1b18' })}
  <!-- bigode -->
  <path d="M82 114 Q90 104 100 111 Q110 104 118 114 Q122 118 116 117 Q108 112 100 116 Q92 112 84 117 Q78 118 82 114 Z" fill="#2c1b18"/>
  <!-- cabelo nas laterais -->
  <path d="M65 90 Q63 74 70 66 L74 92 Z" fill="#2c1b18"/><path d="M135 90 Q137 74 130 66 L126 92 Z" fill="#2c1b18"/>
  ${chefHat(100, 74, 84)}`);
}

// ------------------------------------------------------------------ saída
const OUT = ROOT + '/lab';
for (const st of ['illustrated', 'avataaars', 'personas', 'micah']) fs.mkdirSync(`${OUT}/${st}`, { recursive: true });
fs.writeFileSync(`${OUT}/illustrated/builder.svg`, illBuilder());
fs.writeFileSync(`${OUT}/illustrated/shop.svg`, illShop());
fs.writeFileSync(`${OUT}/illustrated/chef.svg`, illChef());
for (const st of ['avataaars', 'personas', 'micah']) for (const who of ['builder', 'shop', 'chef']) {
  fs.writeFileSync(`${OUT}/${st}/${who}.svg`, libraryCard(st, who));
}
console.log('ok');

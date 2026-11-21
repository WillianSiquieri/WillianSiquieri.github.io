// roads.js — traçado fixo do mapa 36×36: ruas (com curvas, cruzamentos em T, rotatória,
// ponte e ruas sem saída), o litoral com praia e um rio. O miolo 18×18 (deslocado em 9)
// é idêntico ao mapa antigo, para os saves antigos caberem sem conflito.

export const OLD_OFFSET = 9;

// Trechos retos de rua: [i0, j0, i1, j1] (inclusive; horizontal ou vertical).
const SEGMENTS = [
  // miolo antigo (ruas em 9/15 e 3/12 do mapa 18×18)
  [9, 18, 26, 18], [9, 24, 26, 24], [12, 9, 12, 26], [21, 9, 21, 26],
  // avenida oeste até a névoa
  [0, 18, 8, 18],
  // avenida leste: faz uma curva para o norte e sai pelo leste
  [27, 18, 30, 18], [30, 14, 30, 17], [31, 14, 35, 14],
  // estrada norte (passa pela ponte do rio) até a névoa
  [21, 0, 21, 8],
  // rua noroeste: sobe e vira para oeste
  [12, 4, 12, 8], [0, 4, 11, 4],
  // rua oeste do bairro sul: desce até a beira-mar
  [4, 24, 8, 24], [4, 25, 4, 29],
  // avenida da praia
  [5, 29, 27, 29],
  [12, 27, 12, 28], [21, 27, 21, 28], [21, 30, 21, 30],
  // volta da praia para o bairro leste e rua sem saída
  [27, 25, 27, 28], [27, 24, 32, 24],
];

// Rotatória 3×3 (centro): os 8 tiles em volta do centro também viram rua.
export const ROUNDABOUTS = [[21, 29]];

// Linha da costa: água a partir de j = coast(i).
function coast(i) {
  if (i > 30) return 999;
  const base = 31 + Math.round(Math.sin(i * 0.45) * 0.8 + 0.3);
  return i <= 24 ? base : base + Math.round((i - 24) * (i - 24) * 0.18);
}

// Natureza em qualquer coordenada (também fora do mapa): mar, praia, rio ou grama.
export function natureAt(i, j) {
  const c = coast(Math.max(i, -40));
  if (j >= c || river(i, j)) return 'water';
  if (j >= c - 1) return 'sand';
  return 'grass';
}

// Rio: entra pelo norte (i 16..17) e sai pelo leste (j 5..6), passando sob a ponte em i = 21.
function river(i, j) {
  if (j < 0) return i === 16 || i === 17;
  if (j <= 4 && (i === 16 || i === 17)) return true;
  if ((j === 5 || j === 6) && i >= 16) return true;
  return false;
}

// Mapa de tipos: 'road' | 'water' | 'sand' | 'grass' (+ bridge nas ruas sobre água).
export function layout(n) {
  const kind = new Array(n * n).fill('grass');
  const bridge = new Set();
  const at = (i, j) => j * n + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = coast(i);
    if (j >= c || river(i, j)) kind[at(i, j)] = 'water';
    else if (j >= c - 1) kind[at(i, j)] = 'sand';
  }
  for (const [i0, j0, i1, j1] of SEGMENTS) {
    for (let j = Math.min(j0, j1); j <= Math.max(j0, j1); j++)
      for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) {
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        if (kind[at(i, j)] === 'water') bridge.add(at(i, j));
        kind[at(i, j)] = 'road';
      }
  }
  const ra = new Map();   // tile → 'center' | 'arm' | 'corner'
  for (const [ci, cj] of ROUNDABOUTS) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const k = at(ci + di, cj + dj);
    kind[k] = 'road'; ra.set(k, di && dj ? 'corner' : di || dj ? 'arm' : 'center');
  }
  return { kind, bridge, ra };
}

// Ruas que continuam além da borda do mapa (veículos e pessoas entram e saem pela névoa).
export function edgeExits(state) {
  const n = state.size, out = [];
  const road = (i, j) => state.tiles[j * n + i].kind === 'road';
  for (let k = 0; k < n; k++) {
    if (road(k, 0)) out.push([k, 0, 0, -1]);
    if (road(k, n - 1)) out.push([k, n - 1, 0, 1]);
    if (road(0, k)) out.push([0, k, -1, 0]);
    if (road(n - 1, k)) out.push([n - 1, k, 1, 0]);
  }
  return out;
}

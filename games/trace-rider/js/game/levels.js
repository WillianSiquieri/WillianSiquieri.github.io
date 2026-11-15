// levels.js — fases feitas à mão (dados puros, sem fetch/JSON externo).
// Cada fase: início do personagem, bandeira de chegada, estrelas colecionáveis
// e segmentos fixos (obstáculos/terreno que o jogador NÃO pode apagar).
// O jogador desenha suas próprias linhas para levar o personagem do início até
// a chegada, coletando as estrelas no caminho.
//
// Coordenadas em unidades de mundo (y cresce para baixo). O personagem começa
// perto de (0,0) e a câmera é centrada no início.
//
// fixed: lista de segmentos [ax, ay, bx, by].

export const LEVELS = [
  {
    id: 'l1',
    name: '1 · Primeiros passos',
    hint: 'Desenhe uma ladeira do início até a bandeira.',
    start: { x: 0, y: -40 },
    finish: { x: 620, y: 300 },
    stars: [{ x: 320, y: 150 }],
    fixed: [
      [-120, 40, 40, 40],        // plataforma de partida
      [560, 320, 720, 320],      // plataforma de chegada
    ],
  },
  {
    id: 'l2',
    name: '2 · O salto',
    hint: 'Monte uma rampa para pular o buraco e alcançar a outra plataforma.',
    start: { x: 0, y: -40 },
    finish: { x: 860, y: 60 },
    stars: [{ x: 430, y: 60 }, { x: 600, y: 10 }],
    fixed: [
      [-140, 40, 220, 40],       // plataforma esquerda
      [700, 90, 1000, 90],       // plataforma direita (chegada)
      [700, 90, 700, 260],       // paredinha da plataforma direita
    ],
  },
  {
    id: 'l3',
    name: '3 · Montanha-russa',
    hint: 'Faça uma pista ondulada, pegue as 3 estrelas e chegue ao fim.',
    start: { x: 0, y: -60 },
    finish: { x: 1180, y: 360 },
    stars: [{ x: 300, y: 120 }, { x: 640, y: 220 }, { x: 940, y: 300 }],
    fixed: [
      [-140, 20, 20, 20],        // partida
      [1120, 380, 1280, 380],    // chegada
      [480, 360, 560, 360],      // obstáculo baixo (opcional desviar)
    ],
  },
  {
    id: 'l4',
    name: '4 · Ponte dupla',
    hint: 'Dois buracos! Faça rampas para saltar os dois até a bandeira.',
    start: { x: 0, y: -40 },
    finish: { x: 1180, y: 120 },
    stars: [{ x: 360, y: 70 }, { x: 720, y: 90 }, { x: 1000, y: 120 }],
    fixed: [
      [-140, 40, 160, 40],        // plataforma 1 (partida)
      [460, 90, 640, 90],         // plataforma 2 (meio)
      [1020, 150, 1300, 150],     // plataforma 3 (chegada)
      [1020, 150, 1020, 320],     // paredinha da chegada
    ],
  },
  {
    id: 'l5',
    name: '5 · Vale fundo',
    hint: 'Desça o vale, pegue a estrela do fundo e use o embalo para subir.',
    start: { x: 0, y: -60 },
    finish: { x: 1040, y: -40 },
    stars: [{ x: 300, y: 260 }, { x: 520, y: 360 }, { x: 760, y: 180 }],
    fixed: [
      [-150, -20, 20, -20],       // partida (alta, esquerda)
      [980, 10, 1200, 10],        // chegada (alta, direita)
      [980, 10, 980, 180],        // paredinha da chegada
    ],
  },
  {
    id: 'l6',
    name: '6 · Teto baixo',
    hint: 'Cuidado com os tetos! Passe por baixo deles sem bater a cabeça.',
    start: { x: 0, y: -40 },
    finish: { x: 1120, y: 300 },
    stars: [{ x: 300, y: 180 }, { x: 600, y: 240 }, { x: 900, y: 300 }],
    fixed: [
      [-140, 20, 40, 20],         // partida
      [1060, 320, 1260, 320],     // chegada
      [240, 80, 420, 80],         // teto 1
      [560, 140, 740, 140],       // teto 2
      [840, 200, 1020, 200],      // teto 3
    ],
  },
  {
    id: 'l7',
    name: '7 · Zigue-zague',
    hint: 'Pule de plataforma em plataforma pegando as estrelas.',
    start: { x: 0, y: -60 },
    finish: { x: 1240, y: 180 },
    stars: [
      { x: 260, y: 40 }, { x: 520, y: 120 },
      { x: 780, y: 60 }, { x: 1040, y: 160 },
    ],
    fixed: [
      [-140, -20, 60, -20],       // partida
      [340, 80, 480, 80],         // plataforma A
      [640, 20, 780, 20],         // plataforma B (mais alta)
      [900, 120, 1040, 120],      // plataforma C
      [1160, 200, 1360, 200],     // chegada
      [1160, 200, 1160, 360],     // paredinha da chegada
    ],
  },
  {
    id: 'l8',
    name: '8 · Grande descida',
    hint: 'A mais longa! Faça uma pista fluida, pegue as 4 estrelas e desça.',
    start: { x: 0, y: -80 },
    finish: { x: 1560, y: 520 },
    stars: [
      { x: 300, y: 120 }, { x: 640, y: 280 },
      { x: 980, y: 380 }, { x: 1300, y: 470 },
    ],
    fixed: [
      [-160, -40, 40, -40],       // partida
      [1500, 540, 1720, 540],     // chegada
      [520, 420, 620, 420],       // obstáculo 1
      [860, 520, 960, 520],       // obstáculo 2
      [1180, 600, 1280, 600],     // obstáculo 3
    ],
  },
];

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}

export function nextLevelId(id) {
  const i = LEVELS.findIndex(l => l.id === id);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1].id : null;
}

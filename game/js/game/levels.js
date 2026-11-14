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
];

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}

export function nextLevelId(id) {
  const i = LEVELS.findIndex(l => l.id === id);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1].id : null;
}

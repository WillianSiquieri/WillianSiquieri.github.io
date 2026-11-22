// Fonte de histórias bíblicas.
//
// Diferente do RSS, aqui o acervo não muda sozinho: é um catálogo fixo de
// passagens. O adaptador devolve itens no MESMO formato dos itens de RSS
// ({ title, summary, link, sourceLabel }) para que o resto do pipeline — geração,
// montagem, upload, fila de aprovação — funcione sem saber a diferença.
//
// O campo `link` é o que o ciclo usa para não repetir tema, então aqui ele é um
// identificador estável (`biblia:moises-mar-vermelho`), não uma URL.
//
// `visual` carrega os termos de busca de imagem daquela história: é o que faz o
// vídeo combinar com o que está sendo contado (Moisés → Egito, deserto) em vez
// de cair num b-roll genérico.
import { log } from '../util.js';

export const HISTORIAS = [
  {
    id: 'criacao',
    titulo: 'A Criação',
    resumo: 'Nos sete dias, a luz separada das trevas, o céu, a terra, a vida — e o descanso.',
    visual: ['starry night sky galaxy', 'ocean waves aerial', 'forest sunrise light', 'desert dunes sunrise'],
  },
  {
    id: 'noe-arca',
    titulo: 'Noé e o Dilúvio',
    resumo: 'Um homem constrói um barco enorme sob escárnio, e a chuva lhe dá razão.',
    visual: ['heavy rain storm clouds', 'wooden boat sea', 'animals pair walking', 'rainbow after rain'],
  },
  {
    id: 'abraao-isaque',
    titulo: 'Abraão e Isaque',
    resumo: 'O pedido mais difícil já feito a um pai, e a mão que o interrompe.',
    visual: ['desert mountain path', 'stone altar ancient', 'ram sheep desert', 'father son walking silhouette'],
  },
  {
    id: 'jose-egito',
    titulo: 'José e seus irmãos',
    resumo: 'Vendido pelos próprios irmãos, vira a segunda pessoa mais poderosa do Egito.',
    visual: ['ancient egypt pyramids', 'egyptian temple columns', 'wheat grain harvest', 'desert caravan camels'],
  },
  {
    id: 'moises-mar-vermelho',
    titulo: 'Moisés e a travessia do mar',
    resumo: 'Um povo encurralado entre o exército e a água, e o caminho que se abre.',
    visual: ['ancient egypt pyramids', 'red sea coast waves', 'desert crowd walking', 'sandstorm desert wind'],
  },
  {
    id: 'dez-mandamentos',
    titulo: 'Os Dez Mandamentos',
    resumo: 'Na montanha coberta de fumaça, dez frases que atravessaram três milênios.',
    visual: ['mountain summit clouds', 'stone tablets carved', 'thunderstorm lightning mountain', 'desert camp tents'],
  },
  {
    id: 'davi-golias',
    titulo: 'Davi e Golias',
    resumo: 'O menor do exército contra o maior do inimigo, com uma pedra e um estilingue.',
    visual: ['ancient armor sword', 'shepherd boy sheep field', 'stone river pebbles', 'ancient battlefield valley'],
  },
  {
    id: 'salomao-sabedoria',
    titulo: 'A sabedoria de Salomão',
    resumo: 'Duas mulheres, um bebê, e a sentença que revelou a verdade sem nenhuma testemunha.',
    visual: ['ancient palace interior', 'golden throne ornate', 'scales of justice', 'jerusalem old city stone'],
  },
  {
    id: 'daniel-leoes',
    titulo: 'Daniel na cova dos leões',
    resumo: 'Condenado por rezar, passa a noite entre leões e sai andando.',
    visual: ['lion close up', 'stone cave dark', 'ancient persian palace', 'sunrise through stone window'],
  },
  {
    id: 'jonas-peixe',
    titulo: 'Jonas e o grande peixe',
    resumo: 'Tenta fugir de uma missão no navio errado, e o mar cobra a conta.',
    visual: ['stormy sea ship', 'whale underwater', 'harbor old boats', 'man walking city gate'],
  },
  {
    id: 'jo-provacao',
    titulo: 'A provação de Jó',
    resumo: 'Perde tudo em um dia e passa o livro inteiro fazendo a pergunta que todo mundo faz.',
    visual: ['desert ruins wind', 'ash ground burnt', 'storm clouds dramatic', 'sunrise desert horizon'],
  },
  {
    id: 'natividade',
    titulo: 'O nascimento de Jesus',
    resumo: 'Um casal sem lugar para ficar, um estábulo, e pastores avisados antes dos reis.',
    visual: ['stable barn night', 'star bright night sky', 'shepherd sheep night', 'bethlehem old town'],
  },
  {
    id: 'bom-samaritano',
    titulo: 'O Bom Samaritano',
    resumo: 'Dois homens religiosos passam direto. O terceiro, o estrangeiro, para.',
    visual: ['desert road winding', 'helping hand reaching', 'donkey path countryside', 'old inn stone building'],
  },
  {
    id: 'filho-prodigo',
    titulo: 'O Filho Pródigo',
    resumo: 'Gasta a herança toda e volta para casa esperando castigo. Recebe festa.',
    visual: ['road home sunset', 'pig farm mud', 'father embrace silhouette', 'celebration table feast'],
  },
  {
    id: 'multiplicacao-paes',
    titulo: 'A multiplicação dos pães',
    resumo: 'Cinco pães, dois peixes, cinco mil pessoas — e sobrou.',
    visual: ['bread loaves rustic', 'fish basket market', 'crowd hillside gathering', 'sea of galilee shore'],
  },
  {
    id: 'ressurreicao',
    titulo: 'A Ressurreição',
    resumo: 'A pedra estava no lugar errado, e o túmulo estava vazio.',
    visual: ['stone tomb entrance', 'sunrise rays through clouds', 'empty cave light', 'olive garden morning'],
  },
];

/**
 * Devolve as histórias ainda não usadas, no formato de item do pipeline.
 * `source.order`: 'catalogo' (padrão, segue a ordem acima) ou 'aleatorio'.
 */
export async function fetchBible(source = {}) {
  let lista = HISTORIAS;
  if (source.order === 'aleatorio') {
    lista = [...HISTORIAS].sort(() => Math.random() - 0.5);
  }
  const itens = lista.map((h) => ({
    title: h.titulo,
    summary: h.resumo,
    link: `biblia:${h.id}`,
    sourceLabel: source.label || 'Bíblia',
    visual: h.visual,
  }));
  log(`Catálogo bíblico: ${itens.length} histórias disponíveis`);
  return itens;
}

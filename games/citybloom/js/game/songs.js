// songs.js — as músicas do CityBloom, compostas nota a nota (dados puros).
// Tocadas por js/engine/sampler.js com instrumentos reais gravados
// (soundfont FluidR3_GM, CC BY 3.0).
//
// Notação das melodias: "E5:.5 G5:.5 C6:1 r:1 | ..." → nota:duração em tempos,
// "r" = pausa, "C4+E4+G4" = notas juntas, "|" separa compassos (cada compasso
// tem que somar 4 tempos — validado ao montar a música).

const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export function midiOf(name) {
  const mm = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!mm) throw new Error('nota inválida: ' + name);
  return 12 * (Number(mm[2]) + 1) + PC[mm[1]];
}

// ---------------------------------------------------------------- acordes
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  m6: [0, 3, 7, 9], sus4: [0, 5, 7], add9: [0, 4, 7, 14],
};
export function chord(sym) {
  const [main, slash] = sym.split('/');
  const mm = /^([A-G](?:#|b)?)(.*)$/.exec(main);
  const root = PC[mm[1]];
  const tones = QUAL[mm[2]];
  if (!tones) throw new Error('acorde inválido: ' + sym);
  return { root, tones, bass: slash ? PC[slash] : root };
}

// Notas do acorde a partir de `low` (midi), subindo, `count` notas.
function spread(ch, low, count) {
  const pcs = ch.tones.map(t => (ch.root + t) % 12);
  const out = [];
  let n = low;
  while (out.length < count && n < low + 36) {
    if (pcs.includes(((n % 12) + 12) % 12) && (out.length || ((n % 12) === ch.root % 12) || count < 4)) out.push(n);
    n++;
  }
  return out;
}

// Nota mais próxima acima de `low` com a classe de altura `pc`.
const fromPc = (pc, low) => { let n = low; while (((n % 12) + 12) % 12 !== pc) n++; return n; };

// ---------------------------------------------------------------- montagem
function parseLine(str) {
  const bars = str.split('|');
  const out = [];
  bars.forEach((bar, bi) => {
    let sum = 0;
    for (const tok of bar.trim().split(/\s+/).filter(Boolean)) {
      const [a, b] = tok.split(':');
      const d = parseFloat(b);
      if (!(d > 0)) throw new Error(`duração inválida "${tok}"`);
      out.push({ notes: a === 'r' ? [] : a.split('+').map(midiOf), d });
      sum += d;
    }
    if (bars.length > 1 && Math.abs(sum - 4) > 1e-6) throw new Error(`compasso ${bi + 1} soma ${sum} tempos: "${bar.trim()}"`);
  });
  return out;
}

class Song {
  constructor(meta) { Object.assign(this, meta); this.events = []; this.beat = 0; }

  // melodia escrita
  line(inst, str, start, opts = {}) {
    const { vel = 0.8, tr = 0, legato = 0.95 } = opts;
    let t = start;
    for (const ev of parseLine(str)) {
      for (const n of ev.notes) this.events.push({ b: t, inst, n: n + tr, d: ev.d * legato, v: vel });
      t += ev.d;
    }
    return t;
  }

  // acompanhamento de acordes: hits = [[tempo, duração, vel?], ...] por compasso
  chords(inst, prog, start, hits, voicing, vel = 0.5, strum = 0) {
    let t = start;
    for (const [sym, beats] of prog) {
      const ch = chord(sym);
      const notes = voicing(ch);
      for (const [hb, hd, hv = 1] of hits) {
        if (hb >= beats) continue;
        notes.forEach((n, k) => this.events.push({ b: t + hb + k * strum, inst, n, d: Math.min(hd, beats - hb), v: vel * hv }));
      }
      t += beats;
    }
    return t;
  }

  // arpejo: ordem = índices nas notas do voicing; passo em tempos
  arp(inst, prog, start, order, step, voicing, vel = 0.5, len = null) {
    let t = start;
    for (const [sym, beats] of prog) {
      const notes = voicing(chord(sym));
      const steps = Math.floor((len || beats) / step);
      for (let k = 0; k < steps; k++) {
        const n = notes[order[k % order.length] % notes.length];
        this.events.push({ b: t + k * step, inst, n, d: step * 1.6, v: vel * (k % 2 ? 0.85 : 1) });
      }
      t += beats;
    }
    return t;
  }

  // baixo: padrão [[tempo, 'root'|'fifth'|'oct'|'third', duração]]
  bass(inst, prog, start, pattern, low = 36, vel = 0.7) {
    let t = start;
    for (const [sym, beats] of prog) {
      const ch = chord(sym);
      const r = fromPc(ch.bass, low);
      const iv = { root: 0, fifth: 7, oct: 12, third: ch.tones[1] };
      for (const [pb, deg, pd] of pattern) {
        if (pb >= beats) continue;
        const n = deg === 'fifth' && ch.bass !== ch.root ? fromPc((ch.root + 7) % 12, low) : r + iv[deg];
        this.events.push({ b: t + pb, inst, n, d: Math.min(pd, beats - pb), v: vel });
      }
      t += beats;
    }
    return t;
  }

  // percussão sintetizada: tipo e tempos dentro do compasso
  perc(type, start, bars, beats, vel = 0.5, accent = null) {
    for (let bar = 0; bar < bars; bar++) {
      for (const pb of beats) {
        const v = accent && accent.includes(pb) ? vel * 1.4 : vel;
        this.events.push({ b: start + bar * 4 + pb, inst: type, n: 0, d: 0.1, v });
      }
    }
    return start + bars * 4;
  }

  done(loopBeats) {
    this.loopBeats = loopBeats;
    this.events.sort((a, b) => a.b - b.b);
    return this;
  }
}

const P = (s) => s.trim().split(/\s+/).map(x => { const [c, b] = x.split(':'); return [c, b ? Number(b) : 4]; });

// ===========================================================================
// 1) PRAÇA AO SOL — alegre, de cidade (Dó maior, 112 BPM)
// ===========================================================================
function pracaAoSol() {
  const s = new Song({
    id: 'praca', bpm: 112, swing: 0,
    name: { pt: 'Praça ao Sol', en: 'Sunny Square' },
    desc: { pt: 'Alegre e animada', en: 'Bright and cheerful' },
    instruments: { pt: 'Violão, glockenspiel, pizzicato, baixo', en: 'Guitar, glockenspiel, pizzicato, bass' },
  });
  const A = P('C G Am F C G F:2 G:2 C');
  const B = P('F G Em Am Dm G C/E:2 F:2 G');
  const melA = `E5:.5 G5:.5 C6:1 B5:.5 A5:.5 G5:1 | D5:.5 G5:.5 B5:1 A5:.5 G5:.5 D5:1 |
    C5:.5 E5:.5 A5:1 G5:.5 E5:.5 C5:1 | F5:1 A5:.5 G5:.5 F5:1 E5:1 |
    E5:.5 G5:.5 C6:1 D6:.5 C6:.5 B5:.5 A5:.5 | G5:1.5 D5:.5 G5:1 B5:1 |
    A5:.5 G5:.5 F5:1 D5:.5 E5:.5 F5:.5 G5:.5 | E5:1 C5:1 r:2`;
  const melB = `A5:1 C6:1 A5:.5 G5:.5 F5:1 | G5:1 B5:1 D6:1 B5:1 | G5:.5 E5:.5 B5:1 G5:1 E5:1 |
    A5:1.5 G5:.5 E5:1 C5:1 | F5:1 A5:1 D6:1 C6:.5 A5:.5 | B5:1 G5:1 D5:1 G5:1 |
    E5:1 G5:1 A5:1 C6:1 | D6:2 B5:1 G5:1`;
  const gtr = (ch) => spread(ch, 48, 4);
  const strumHits = [[0, 1, 1], [1, .5, .7], [1.5, .5, .8], [2.5, .5, .7], [3, .5, .9], [3.5, .5, .7]];
  const bassPat = [[0, 'root', 1.4], [1.5, 'fifth', .5], [2, 'root', 1], [3, 'fifth', .9]];
  // introdução: 2 compassos de violão
  let t = s.chords('acoustic_guitar_steel', P('C G'), 0, strumHits, gtr, 0.42, 0.012);
  s.perc('shaker', 0, 2, [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], 0.1, [.5, 1.5, 2.5, 3.5]);
  const sections = [['A', 1], ['B', 1], ['A', 2], ['B', 2], ['A', 3]];
  for (const [sec, n] of sections) {
    const prog = sec === 'A' ? A : B;
    s.chords('acoustic_guitar_steel', prog, t, strumHits, gtr, 0.4, 0.012);
    s.bass('acoustic_bass', prog, t, bassPat, 36, 0.75);
    s.perc('shaker', t, 8, [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], 0.1, [.5, 1.5, 2.5, 3.5]);
    s.perc('clap', t, 8, [1, 3], 0.22);
    if (sec === 'A') {
      s.line('glockenspiel', melA, t, { vel: 0.55 });
      if (n >= 2) s.line('pizzicato_strings', melA, t, { vel: 0.45, tr: -12, legato: 0.6 });
    } else {
      s.line('pizzicato_strings', melB, t, { vel: 0.6, tr: -12, legato: 0.6 });
      if (n === 2) s.line('glockenspiel', melB, t, { vel: 0.35 });
      s.arp('pizzicato_strings', prog, t, [0, 1, 2, 1], 1, (ch) => spread(ch, 55, 3), 0.25);
    }
    t += 32;
  }
  return s.done(t);
}

// ===========================================================================
// 2) BOSSA DA PREFEITURA — bossa nova (Dó maior, 128 BPM)
// ===========================================================================
function bossaPrefeitura() {
  const s = new Song({
    id: 'bossa', bpm: 128, swing: 0, gain: 0.8,
    name: { pt: 'Bossa da Prefeitura', en: 'Town Hall Bossa' },
    desc: { pt: 'Bossa nova suave, bem brasileira', en: 'Smooth Brazilian bossa nova' },
    instruments: { pt: 'Violão nylon, flauta, piano, baixo', en: 'Nylon guitar, flute, piano, bass' },
  });
  const A = P('Cmaj7 Am7 Dm7 G7 Em7 A7 Dm7 G7');
  const B = P('Fmaj7 Fm6 Em7 A7 Dm7 G7 Cmaj7 Dm7:2 G7:2');
  const melA = `E5:1.5 G5:.5 B5:1.5 A5:.5 | G5:1 E5:.5 C5:1.5 r:1 | F5:.5 A5:.5 C6:1.5 B5:.5 A5:1 |
    G5:2.5 F5:.5 D5:1 | E5:.5 G5:.5 B5:1.5 D6:.5 B5:1 | C#6:1.5 A5:.5 G5:1 E5:1 |
    F5:1 A5:.5 D6:1.5 C6:1 | B5:1.5 A5:.5 G5:1 D5:1`;
  const melB = `A5:1 C6:.5 E6:1.5 D6:.5 C6:.5 | Ab5:1.5 F5:.5 D5:1 C5:1 | B5:1 G5:.5 E5:1.5 D5:1 |
    C#5:1 E5:.5 G5:1 A5:1.5 | F5:.5 A5:.5 D6:1 C6:.5 A5:1.5 | B5:1 G5:1 F5:1 D5:1 |
    E5:3 r:1 | D5:.5 F5:.5 A5:1 G5:1 B5:1`;
  // voicing sem a fundamental (estilo bossa), região média do violão
  const bossaVoice = (ch) => ch.tones.slice(1).map(tn => fromPc((ch.root + tn) % 12, 52));
  // levada de bossa (dedos) em 2 compassos: colcheias 0,3,6,10,13 → tempos
  const fingers1 = [[0, .45, 1], [1.5, .45, .8], [3, .45, .9]];
  const fingers2 = [[1, .45, .9], [2.5, .45, .8]];
  const thumb = [[0, 'root', 1.4], [1.5, 'fifth', .45], [2, 'root', 1.4], [3.5, 'fifth', .45]];
  const comp = (prog, t) => {
    let tt = t;
    prog.forEach(([sym, beats], k) => {
      const hits = beats === 2 ? [[0, .45, 1], [1, .45, .8]] : (k % 2 === 0 ? fingers1 : fingers2);
      s.chords('acoustic_guitar_nylon', [[sym, beats]], tt, hits, bossaVoice, 0.42, 0.008);
      tt += beats;
    });
    s.bass('acoustic_guitar_nylon', prog, t, thumb, 40, 0.5);   // polegar do violão
    s.bass('acoustic_bass', prog, t, thumb, 36, 0.5);
    s.perc('shaker', t, 8, [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], 0.07, [0, 2]);
    s.perc('rim', t, 8, [0, 1.5, 3], 0.18);
  };
  let t = 0;
  comp(P('Cmaj7 G7'), t); t += 8; // introdução
  const sections = [['A', 1], ['A', 2], ['B', 1], ['A', 3], ['B', 2], ['A', 4]];
  for (const [sec, n] of sections) {
    const prog = sec === 'A' ? A : B;
    comp(prog, t);
    s.line('flute', sec === 'A' ? melA : melB, t, { vel: 0.5, legato: 0.9 });
    if (n >= 2 || sec === 'B') s.chords('acoustic_grand_piano', prog, t, [[0, 3.5, 1]], (ch) => spread(ch, 60, 4), 0.18);
    t += 32;
  }
  return s.done(t);
}

// ===========================================================================
// 3) MANHÃ TRANQUILA — calma (Fá maior, 80 BPM)
// ===========================================================================
function manhaTranquila() {
  const s = new Song({
    id: 'manha', bpm: 80, swing: 0, gain: 3.4,
    name: { pt: 'Manhã Tranquila', en: 'Quiet Morning' },
    desc: { pt: 'Calma e acolhedora', en: 'Calm and cozy' },
    instruments: { pt: 'Piano, cordas, harpa', en: 'Piano, strings, harp' },
  });
  const A = P('F C/E Dm Bb F/A Gm7 C C7');
  const B = P('Bb C Am Dm Gm C F F');
  const melA = `A5:1.5 G5:.5 F5:1 C5:1 | G5:1.5 F5:.5 E5:1 C5:1 | F5:1 A5:1 D6:1.5 C6:.5 |
    Bb5:2 A5:1 G5:1 | A5:1.5 Bb5:.5 A5:1 F5:1 | G5:1 Bb5:1 D6:1 C6:1 | C6:2 Bb5:1 G5:1 | E5:2 r:2`;
  const melB = `D5:2 F5:2 | E5:2 G5:2 | A5:3 G5:1 | F5:2 D5:2 | D5:2 G5:2 | E5:2 G5:1 Bb5:1 | A5:4 | F5:2 r:2`;
  const lh = (ch) => spread(ch, 41, 5);
  const lhArp = (prog, t, vel) => s.arp('acoustic_grand_piano', prog, t, [0, 1, 2, 3, 4, 3, 2, 1], .5, lh, vel);
  let t = 0;
  lhArp(P('F F'), t, 0.32); t += 8; // introdução
  const sections = [['A', 1], ['B', 1], ['A', 2], ['B', 2]];
  for (const [sec, n] of sections) {
    const prog = sec === 'A' ? A : B;
    lhArp(prog, t, sec === 'A' ? 0.3 : 0.24);
    if (sec === 'A') {
      s.line('acoustic_grand_piano', melA, t, { vel: 0.55 });
      if (n === 2) s.chords('string_ensemble_1', prog, t, [[0, 4, 1]], (ch) => spread(ch, 53, 4), 0.2);
    } else {
      s.line('string_ensemble_1', melB, t, { vel: 0.42, tr: -12 });
      s.line('string_ensemble_1', melB, t, { vel: 0.3 });
      s.arp('orchestral_harp', prog, t, [0, 1, 2, 3, 4, 5, 6, 7], .25, (ch) => spread(ch, 55, 8), 0.3, 2);
    }
    t += 32;
  }
  return s.done(t);
}

// ===========================================================================
// 4) PASSEIO DE BICICLETA — brincalhona, estilo fazendinha (Sol maior, 120 BPM)
// ===========================================================================
function passeioBicicleta() {
  const s = new Song({
    id: 'passeio', bpm: 120, swing: 0.12,
    name: { pt: 'Passeio de Bicicleta', en: 'Bike Ride' },
    desc: { pt: 'Brincalhona, estilo jogo de fazendinha', en: 'Playful, farm-game style' },
    instruments: { pt: 'Marimba, violão, assobio, baixo', en: 'Marimba, guitar, whistle, bass' },
  });
  const A = P('G Em C D G Em C:2 D:2 G');
  const B = P('C D Bm Em Am D G/B:2 C:2 D');
  const melA = `B5:.5 D6:.5 B5:.5 G5:.5 A5:1 B5:1 | G5:.5 B5:.5 G5:.5 E5:.5 F#5:1 G5:1 |
    E5:.5 G5:.5 C6:.5 B5:.5 A5:1 G5:1 | F#5:.5 A5:.5 D6:1 C6:.5 A5:.5 F#5:1 |
    B5:.5 D6:.5 G6:1 F#6:.5 E6:.5 D6:1 | B5:1 G5:.5 E5:.5 G5:1 B5:1 |
    C6:.5 B5:.5 A5:.5 G5:.5 F#5:.5 A5:.5 D6:1 | G5:1.5 D5:.5 G5:1 r:1`;
  const melB = `E6:1 G6:1 E6:1 C6:1 | F#6:1 A6:1 F#6:1 D6:1 | D6:1.5 B5:.5 F#5:1 B5:1 |
    G6:2 E6:1 B5:1 | C6:1 E6:1 A6:1 G6:.5 E6:.5 | F#6:2 D6:1 A5:1 |
    B5:1 D6:1 E6:1 G6:1 | A6:2 F#6:1 D6:1`;
  const chop = [[.5, .2, 1], [1.5, .2, .9], [2.5, .2, 1], [3.5, .2, .9]];
  const bassPat = [[0, 'root', .5], [1, 'oct', .4], [2, 'fifth', .5], [3, 'oct', .4]];
  let t = 0;
  s.chords('acoustic_guitar_nylon', P('G D'), t, chop, (ch) => spread(ch, 55, 3), 0.42, 0.006);
  s.perc('shaker', t, 2, [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], 0.09); t += 8;
  const sections = [['A', 1], ['B', 1], ['A', 2], ['B', 2], ['A', 3]];
  for (const [sec, n] of sections) {
    const prog = sec === 'A' ? A : B;
    s.chords('acoustic_guitar_nylon', prog, t, chop, (ch) => spread(ch, 55, 3), 0.42, 0.006);
    s.bass('acoustic_bass', prog, t, bassPat, 36, 0.7);
    s.perc('shaker', t, 8, [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], 0.09);
    s.perc('clap', t, 8, [1, 3], 0.2);
    if (sec === 'A') {
      s.line('marimba', melA, t, { vel: 0.62, legato: 0.8 });
      if (n === 2) s.line('glockenspiel', melA, t, { vel: 0.18 });
    } else {
      s.line('whistle', melB, t, { vel: 0.36, tr: -12, legato: 0.92 });
      s.arp('marimba', prog, t, [0, 1, 2, 1], 1, (ch) => spread(ch, 60, 3), 0.25);
    }
    t += 32;
  }
  return s.done(t);
}

export const SONGS = [pracaAoSol(), bossaPrefeitura(), manhaTranquila(), passeioBicicleta()];

// Notas usadas por instrumento (para baixar só as amostras necessárias).
export function notesUsed() {
  const used = {};
  for (const s of SONGS) for (const e of s.events) {
    if (!e.n) continue;
    (used[e.inst] = used[e.inst] || new Set()).add(e.n);
  }
  return used;
}

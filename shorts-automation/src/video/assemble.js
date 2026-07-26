// Montagem do vídeo faceless (1080x1920) via ffmpeg.
//
// Estilo inspirado em Shorts de sucesso: fundo dinâmico + legendas grandes,
// em blocos curtos (2–3 palavras) sincronizados com a narração, quebrando dentro
// de margens seguras (nada de texto cortado). Legendas via arquivo .ass (libass),
// que faz o wrapping e o contorno automaticamente.
//
// Se ffmpeg não estiver disponível, retorna { rendered: false } sem falhar o pipeline.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { log, warn } from '../util.js';
import { hasFfmpeg, run } from './ffmpeg.js';
import { synthesize } from './tts.js';
import { fetchBroll } from './broll.js';

// --- Legendas -------------------------------------------------------------

// Agrupa palavras em blocos curtos (para caber grande na tela e ler no ritmo da fala).
function chunkWords(words, maxWords = 3, maxChars = 16) {
  const chunks = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    chunks.push({
      text: cur.map((c) => c.part).join(' '),
      start: cur[0].start,
      end: cur[cur.length - 1].end,
    });
    cur = [];
  };
  for (const w of words) {
    const tentative = [...cur, w].map((c) => c.part).join(' ');
    if (cur.length && (cur.length >= maxWords || tentative.length > maxChars)) flush();
    cur.push(w);
  }
  flush();
  return chunks;
}

// Blocos a partir do timing real de cada palavra (edge-tts).
function chunksFromCues(cues) {
  return chunkWords(cues);
}

// Fallback sem timing: distribui os blocos proporcionalmente pela duração.
function chunksFromScript(script, durationSec) {
  const words = String(script)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => ({ part }));
  const groups = chunkWords(words).map((g) => g.text);
  const totalWords = words.length || 1;
  let acc = 0;
  const out = [];
  for (const text of groups) {
    const wc = text.split(/\s+/).length;
    const start = (acc / totalWords) * durationSec * 1000;
    acc += wc;
    const end = (acc / totalWords) * durationSec * 1000;
    out.push({ text, start, end });
  }
  return out;
}

function msToAss(ms) {
  const cs = Math.max(0, Math.round(ms / 10));
  const c = cs % 100;
  const s = Math.floor(cs / 100) % 60;
  const m = Math.floor(cs / 6000) % 60;
  const h = Math.floor(cs / 360000);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

function assEscape(t) {
  return String(t).replace(/[{}]/g, '').replace(/\r?\n/g, ' ').trim();
}

// Monta o arquivo .ass. Alignment 2 (rodapé-central) + MarginV alta = zona de leitura
// no meio-inferior, longe da UI do YouTube. Contorno grosso para ler sobre qualquer fundo.
function buildAss(chunks, { width, height }) {
  const style =
    'Style: Main,DejaVu Sans,104,&H00FFFFFF,&H00FFFFFF,&H00101010,&H96000000,' +
    '-1,0,0,0,100,100,1,0,1,8,4,2,140,140,560,1';
  const header =
    `[Script Info]\n` +
    `ScriptType: v4.00+\n` +
    `PlayResX: ${width}\n` +
    `PlayResY: ${height}\n` +
    `WrapStyle: 2\n` +
    `ScaledBorderAndShadow: yes\n\n` +
    `[V4+ Styles]\n` +
    `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
    `${style}\n\n` +
    `[Events]\n` +
    `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const events = chunks
    .filter((c) => c.text)
    .map((c) => `Dialogue: 0,${msToAss(c.start)},${msToAss(c.end)},Main,,0,0,0,,${assEscape(c.text)}`)
    .join('\n');
  return header + events + '\n';
}

// --- Fundo ----------------------------------------------------------------

// Fonte de vídeo lavfi: gradiente radial escuro com leve movimento (menos "chapado").
function backgroundSource(width, height, durationSec) {
  return (
    `gradients=s=${width}x${height}:c0=0x0a1930:c1=0x0f2038:c2=0x152a48:` +
    `x0=0:y0=0:x1=${width}:y1=${height}:type=radial:speed=0.02:duration=${durationSec}`
  );
}

// --- Montagem -------------------------------------------------------------

export async function assembleVideo(draft, { config, workDir, previewDir }) {
  const dir = join(workDir, draft.id);
  await mkdir(dir, { recursive: true });

  // 1) Narração (com timing de palavras quando o provider suporta).
  const tts = await synthesize(draft.script, dir, config.tts || {});
  const durationSec = tts?.durationSec || config.video?.targetDurationSec || 45;

  if (!(await hasFfmpeg())) {
    warn('ffmpeg ausente — vídeo não renderizado (roteiro/áudio prontos).');
    return { rendered: false, audioPath: tts?.audioPath || null, durationSec, reason: 'ffmpeg-missing' };
  }

  const { width = 1080, height = 1920 } = config.video || {};
  const outPath = join(dir, 'short.mp4');

  // 2) Legendas → arquivo .ass
  const chunks = tts?.cues ? chunksFromCues(tts.cues) : chunksFromScript(draft.script, durationSec);
  const assPath = join(dir, 'subs.ass');
  await writeFile(assPath, buildAss(chunks, { width, height }), 'utf8');

  // 3) Fundo: b-roll de vídeo (Pexels) quando disponível; senão gradiente.
  const style = config.video?.backgroundStyle || 'auto';
  let brollPath = null;
  if (style === 'stock' || style === 'auto') {
    brollPath = await fetchBroll(draft, join(dir, 'broll.mp4'), width, height);
  }

  let args;
  if (brollPath) {
    // Cobre 9:16, escurece (scrim) para a legenda saltar, e queima o .ass.
    const vf =
      `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,` +
      `eq=brightness=-0.16:saturation=1.05,` +
      `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.32:t=fill,` +
      `ass=${assPath}`;
    args = ['-stream_loop', '-1', '-i', brollPath];
    if (tts?.audioPath) args.push('-i', tts.audioPath);
    args.push('-vf', vf, '-t', String(durationSec), '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast');
    if (tts?.audioPath) args.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '160k', '-shortest');
    args.push('-y', outPath);
  } else {
    args = ['-f', 'lavfi', '-i', backgroundSource(width, height, durationSec)];
    if (tts?.audioPath) args.push('-i', tts.audioPath);
    args.push('-vf', `vignette=PI/5,ass=${assPath}`, '-t', String(durationSec), '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast');
    if (tts?.audioPath) args.push('-c:a', 'aac', '-b:a', '160k', '-shortest');
    args.push('-y', outPath);
  }

  try {
    await run(args);
    log(`Vídeo renderizado → ${outPath} (${chunks.length} blocos de legenda)`);

    // Preview leve e auto-hospedado (540x960), commitado no repo para o painel tocar.
    let previewFile = null;
    if (previewDir) {
      await mkdir(previewDir, { recursive: true });
      const prev = join(previewDir, `${draft.id}.mp4`);
      try {
        await run(['-i', outPath, '-vf', 'scale=540:960', '-c:v', 'libx264', '-crf', '30',
          '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-y', prev]);
        previewFile = `data/previews/${draft.id}.mp4`;
        log(`Preview gerado → ${previewFile}`);
      } catch (e) {
        warn('Preview leve falhou (segue sem):', e.message);
      }
    }

    return { rendered: true, videoPath: outPath, previewFile, audioPath: tts?.audioPath || null, durationSec, ttsProvider: tts?.provider };
  } catch (err) {
    warn('Falha ao renderizar vídeo:', err.message);
    return { rendered: false, audioPath: tts?.audioPath || null, durationSec, reason: err.message };
  }
}

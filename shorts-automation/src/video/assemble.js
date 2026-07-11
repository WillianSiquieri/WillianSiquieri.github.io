// Montagem do vídeo faceless (1080x1920) via ffmpeg:
//   fundo (gradiente animado ou imagem) + narração (áudio TTS) + legendas queimadas.
//
// Se ffmpeg não estiver disponível, retorna { rendered: false } sem falhar o pipeline —
// o draft segue com roteiro/áudio prontos e pode ser renderizado depois.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, log, warn } from '../util.js';
import { hasFfmpeg, run } from './ffmpeg.js';
import { synthesize } from './tts.js';

// Escapa texto para o filtro drawtext do ffmpeg.
function esc(t) {
  return String(t).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "’").replace(/%/g, '\\%');
}

// Quebra o roteiro em blocos curtos de legenda, distribuídos ao longo da duração.
function buildCaptions(script, durationSec) {
  const sentences = String(script).split(/(?<=[.!?])\s+/).filter(Boolean);
  const per = durationSec / Math.max(1, sentences.length);
  return sentences.map((text, i) => ({
    text: text.length > 90 ? text.slice(0, 89) + '…' : text,
    start: +(i * per).toFixed(2),
    end: +((i + 1) * per).toFixed(2),
  }));
}

export async function assembleVideo(draft, { config, workDir, previewDir }) {
  const dir = join(workDir, draft.id);
  await mkdir(dir, { recursive: true });

  // 1) Narração
  const tts = await synthesize(draft.script, dir, config.tts || {});
  const durationSec = tts?.durationSec || config.video?.targetDurationSec || 45;

  if (!(await hasFfmpeg())) {
    warn('ffmpeg ausente — vídeo não renderizado (roteiro/áudio prontos).');
    return { rendered: false, audioPath: tts?.audioPath || null, durationSec, reason: 'ffmpeg-missing' };
  }

  const { width = 1080, height = 1920 } = config.video || {};
  const outPath = join(dir, 'short.mp4');
  const captions = buildCaptions(draft.script, durationSec);

  // 2) Fundo: gradiente animado gerado proceduralmente (sem depender de assets externos).
  const bg =
    `gradients=s=${width}x${height}:c0=0x0b1e3f:c1=0x14284a:c2=0x1e3a5f:x0=0:y0=0:` +
    `x1=${width}:y1=${height}:type=radial:duration=${durationSec}`;

  // 3) Legendas: uma cadeia de drawtext temporizada.
  const drawtexts = captions
    .map(
      (c) =>
        `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
        `text='${esc(c.text)}':fontcolor=white:fontsize=54:box=1:boxcolor=black@0.55:boxborderw=24:` +
        `x=(w-text_w)/2:y=h*0.62:line_spacing=12:` +
        `enable='between(t,${c.start},${c.end})'`
    )
    .join(',');

  // Título fixo no topo.
  const titleText =
    `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
    `text='${esc(draft.title)}':fontcolor=white:fontsize=46:box=1:boxcolor=0xE50914@0.9:boxborderw=18:` +
    `x=(w-text_w)/2:y=h*0.10`;

  const filter = `${drawtexts ? drawtexts + ',' : ''}${titleText}`;

  const args = ['-f', 'lavfi', '-i', bg];
  if (tts?.audioPath) args.push('-i', tts.audioPath);
  args.push(
    '-vf', filter,
    '-t', String(durationSec),
    '-r', '30',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast'
  );
  if (tts?.audioPath) args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
  args.push('-y', outPath);

  try {
    await run(args);
    log(`Vídeo renderizado → ${outPath}`);

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

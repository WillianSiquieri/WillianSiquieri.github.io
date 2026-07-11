// Síntese de voz (TTS) com providers plugáveis.
// - elevenlabs: se ELEVENLABS_API_KEY estiver definido (qualidade alta, pago).
// - piper:      binário local 'piper' (open-source, grátis) se disponível.
// - silent:     gera uma trilha silenciosa com a duração estimada (fallback total).
//
// Retorna { audioPath, durationSec } ou null se não foi possível produzir áudio.
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { log, warn } from '../util.js';
import { hasFfmpeg, run } from './ffmpeg.js';

// Estima duração da narração: ~2.6 palavras/segundo em PT-BR.
export function estimateDuration(text) {
  const words = String(text).trim().split(/\s+/).length;
  return Math.max(8, Math.round(words / 2.6));
}

async function ttsElevenLabs(text, outPath, cfg) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}: ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
  return outPath;
}

function ttsPiper(text, outPath) {
  return new Promise((resolve, reject) => {
    const model = process.env.PIPER_MODEL || 'pt_BR-faber-medium.onnx';
    const wav = outPath.replace(/\.\w+$/, '.wav');
    const p = spawn('piper', ['--model', model, '--output_file', wav]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(wav) : reject(new Error(`piper falhou: ${err}`))));
    p.stdin.write(text);
    p.stdin.end();
  });
}

// edge-tts: vozes neurais da Microsoft, gratuitas e sem chave de API.
async function ttsEdge(text, outPath, cfg) {
  const { EdgeTTS } = await import('node-edge-tts');
  const voice = cfg.voice && /Neural$/.test(cfg.voice) ? cfg.voice : 'pt-BR-AntonioNeural';
  const tts = new EdgeTTS({ voice });
  await tts.ttsPromise(text, outPath);
  return outPath;
}

async function ttsSilent(text, outPath) {
  if (!(await hasFfmpeg())) return null;
  const dur = estimateDuration(text);
  await run(['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`, '-t', String(dur), '-q:a', '9', '-y', outPath]);
  return outPath;
}

export async function synthesize(text, workDir, cfg = {}) {
  const provider = cfg.provider === 'auto' ? autoProvider() : cfg.provider || autoProvider();
  const out = join(workDir, `narration.${provider === 'piper' ? 'wav' : 'mp3'}`);
  try {
    let audioPath = null;
    if (provider === 'elevenlabs') audioPath = await ttsElevenLabs(text, out, cfg);
    else if (provider === 'edge') audioPath = await ttsEdge(text, out, cfg);
    else if (provider === 'piper') audioPath = await ttsPiper(text, out);
    else audioPath = await ttsSilent(text, join(workDir, 'narration.mp3'));

    if (!audioPath) return null;
    log(`TTS (${provider}) → ${audioPath}`);
    return { audioPath, provider, durationSec: estimateDuration(text) };
  } catch (err) {
    warn(`TTS provider "${provider}" falhou (${err.message}); tentando trilha silenciosa.`);
    const fallback = await ttsSilent(text, join(workDir, 'narration.mp3'));
    return fallback ? { audioPath: fallback, provider: 'silent', durationSec: estimateDuration(text) } : null;
  }
}

function autoProvider() {
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (process.env.PIPER_MODEL) return 'piper';
  // edge-tts é grátis e não precisa de chave — padrão para ter voz natural sem custo.
  // Se falhar (rede/serviço), o synthesize cai para trilha silenciosa.
  return 'edge';
}

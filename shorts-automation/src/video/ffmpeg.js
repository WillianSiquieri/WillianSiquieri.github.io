// Wrapper fino sobre o binário ffmpeg. Centraliza a detecção de disponibilidade
// e a execução de comandos, para o resto do código degradar com elegância.
import { spawn } from 'node:child_process';

let _has = null;

export function run(args, bin = 'ffmpeg') {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${bin} saiu ${code}: ${err.slice(-500)}`))));
  });
}

export async function hasFfmpeg() {
  if (_has !== null) return _has;
  _has = await new Promise((resolve) => {
    const p = spawn('ffmpeg', ['-version']);
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
  return _has;
}

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {commandFromEnv} from './bins.mjs';

// Sound for shot films, synthesised with FFmpeg so it carries no licence: three short effects and an optional placeholder bed.
// The effects are plain (a swish, a tick, a low hit). The synthetic bed is a placeholder to judge the mix; real music comes from a
// file the user supplies or from generate-music.mjs.
const SR = 48000;
const EFFECTS = {
  whoosh: {seconds: 0.5, args: ['-f', 'lavfi', '-i', `anoisesrc=d=0.5:c=pink:r=${SR}:a=0.7`, '-af', 'highpass=f=500,lowpass=f=6500,afade=t=in:d=0.2,afade=t=out:st=0.18:d=0.32,volume=0.9']},
  click: {seconds: 0.1, args: ['-f', 'lavfi', '-i', `aevalsrc='0.8*sin(2*PI*2600*t)*exp(-t*90)':d=0.1:s=${SR}`]},
  thump: {seconds: 0.6, args: ['-f', 'lavfi', '-i', `aevalsrc='0.95*sin(2*PI*(55+95*exp(-t*14))*t)*exp(-t*6.5)':d=0.6:s=${SR}`]},
};
export const SFX_KINDS = Object.keys(EFFECTS);

const ffmpeg = (args) => execFileSync(commandFromEnv('ffmpeg'), ['-hide_banner', '-v', 'error', '-nostdin', '-y', ...args], {stdio: 'pipe', timeout: 60000});

export function ensureSfx(job, kinds = SFX_KINDS) {
  const dir = path.join(job, 'audio/sfx'), out = {};
  fs.mkdirSync(dir, {recursive: true});
  for (const k of kinds) {
    const file = path.join(dir, `${k}.wav`);
    if (!fs.existsSync(file) || fs.statSync(file).size < 1000) ffmpeg([...EFFECTS[k].args, '-ac', '2', '-ar', String(SR), file]);
    out[k] = `audio/sfx/${k}.wav`;
  }
  return out;
}

export function synthBed(job, seconds) {
  const rel = 'audio/bgm-synth.wav', file = path.join(job, rel);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const chord = (d) => [110, 164.81, 220, 277.18, 329.63].map((f, i) => `${[1, 0.8, 0.7, 0.5, 0.4][i]}*sin(2*PI*${(f * d).toFixed(3)}*t)`).join('+');
  const tremolo = '(0.75+0.25*sin(2*PI*0.12*t))';
  ffmpeg(['-f', 'lavfi', '-i', `aevalsrc='0.045*(${chord(1)})*${tremolo}|0.045*(${chord(1.003)})*${tremolo}':d=${Math.ceil(seconds)}:s=${SR}`, '-af', 'lowpass=f=1800', file]);
  return rel;
}

// Integrated loudness (LUFS) of a file, so a music bed can be set to a level under the narration instead of a guessed volume.
export function measureLufs(file) {
  const r = spawnSync(commandFromEnv('ffmpeg'), ['-nostdin', '-hide_banner', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], {encoding: 'utf8', timeout: 120000});
  const m = /Summary:[\s\S]*?\n\s*I:\s*(-?[\d.]+)\s*LUFS/.exec(r.stderr ?? '');
  if (!m) throw new Error(`could not measure loudness of ${file}`);
  return Number(m[1]);
}
export const gainFor = (measured, target) => Math.min(1, Math.pow(10, (target - measured) / 20));

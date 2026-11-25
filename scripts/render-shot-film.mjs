#!/usr/bin/env node
// Renders a film made from real pictures with the ShotFilm composition. `--stills` renders the middle frame of every shot and a
// contact sheet (the frame review of references/quality-bar.md); otherwise the full video. The job folder is the public directory.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {compileFromArgs} from './lib/shot-options.mjs';
import {commandFromEnv} from './lib/bins.mjs';
import {validateOverlays} from './lib/shot-film-validate.mjs';

const [jobArg, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name) => args.includes(`--${name}`);
if (!jobArg) { console.error('Usage: node scripts/render-shot-film.mjs <job> [--stills] [--scale=0.5] [--narration | --captions=<file>] [--audio=<job-relative>] [--theme=dark|light] [--out=<mp4>]'); process.exit(2); }
const job = fs.realpathSync(jobArg), remotion = fileURLToPath(new URL('../remotion/', import.meta.url));
const entry = 'src/templates/frame/shots/index.tsx', bin = path.join(remotion, 'node_modules/.bin/remotion');
if (!fs.existsSync(bin)) throw new Error('Remotion dependencies are not installed in remotion/; nothing is installed automatically');
const {film, audit, timingSource} = compileFromArgs(job, option, flag);
audit.warnings.forEach((w) => console.log(`warning: ${w}`));
const overlays = await validateOverlays(film);
overlays.warnings.forEach((w) => console.log(`warning: ${w}`));
if (overlays.errors.length) { console.error(`overlay props are invalid:\n  ${overlays.errors.join('\n  ')}`); process.exit(1); }
const props = path.join(job, 'shot-film.json');
fs.writeFileSync(props, `${JSON.stringify(film, null, 2)}\n`);
const common = ['--props', props, '--public-dir', job, '--log=error', ...(process.env.REMOTION_BROWSER_EXECUTABLE ? [`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`] : [])];
const run = (cmd) => execFileSync(bin, cmd, {cwd: remotion, stdio: 'inherit', timeout: 1800000});

if (option('cover')) {
  // cover: the hook on the first picture, or the middle of the first shot when there is no hook
  const t = film.hook ? Math.min(1.9, Math.max(0.8, film.hook.seconds - 0.7)) : (film.shots[0].start + film.shots[0].end) / 2;
  const out = path.resolve(option('cover')); fs.mkdirSync(path.dirname(out), {recursive: true});
  run(['still', entry, 'ShotFilm', out, `--frame=${Math.round(t * film.fps)}`, ...common]);
  console.log(`cover: ${out} (frame at ${t.toFixed(1)} s)`);
} else if (args.includes('--stills')) {
  const dir = path.join(job, 'output/shot-stills'); fs.mkdirSync(dir, {recursive: true});
  const files = film.shots.map((s, i) => {
    const frame = Math.min(film.durationInFrames - 1, Math.round(((s.start + s.end) / 2) * film.fps));
    const file = path.join(dir, `${String(i + 1).padStart(2, '0')}-${s.id}.png`);
    run(['still', entry, 'ShotFilm', file, `--frame=${frame}`, ...common]);
    return file;
  });
  const sheet = path.join(job, 'output/shot-contact-sheet.png'), cols = Math.min(film.shots.length, 6), rows = Math.ceil(film.shots.length / cols);
  execFileSync(commandFromEnv('ffmpeg'), ['-hide_banner', '-v', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex',
    `${files.map((_, i) => `[${i}:v]scale=270:-1[s${i}]`).join(';')};${files.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % cols) * 270}_${Math.floor(i / cols) * 480}`).join('|')}[o]`, '-map', '[o]', '-frames:v', '1', sheet], {stdio: 'inherit'});
  console.log(`${files.length} stills in ${dir}\ncontact sheet: ${sheet} (timing ${timingSource}; ${cols}x${rows})`);
} else {
  const out = path.resolve(option('out') ?? path.join(job, 'output/shot-film.mp4')); fs.mkdirSync(path.dirname(out), {recursive: true});
  run(['render', entry, 'ShotFilm', out, '--codec=h264', ...(option('scale') ? [`--scale=${option('scale')}`] : []), ...common]);
  console.log(`rendered ${out} (${film.shots.length} shots, timing ${timingSource})`);
}

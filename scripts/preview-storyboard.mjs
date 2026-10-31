#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveRemotionBin, commandFromEnv} from './lib/bins.mjs';
import {runCommand} from './lib/process.mjs';
import {sha256} from './lib/production-audit.mjs';
const [input, ...args] = process.argv.slice(2);
if (!input) throw new Error('Usage: node scripts/preview-storyboard.mjs <plan> [--safe-area]');
const file = path.resolve(input); const job = path.dirname(file); const plan = JSON.parse(fs.readFileSync(file));
if (!plan.scenes.length || plan.scenes.length > 40) throw new Error('Storyboard preview supports 1..40 scenes');
const root = fileURLToPath(new URL('../', import.meta.url)); const remotion = path.join(root, 'remotion');
const dir = path.join(job, 'preview'); fs.mkdirSync(dir, {recursive: true});
const fallback = path.join(remotion, 'public/video-plan.json');
if (!fs.existsSync(fallback)) {fs.mkdirSync(path.dirname(fallback), {recursive: true}); fs.copyFileSync(file, fallback, fs.constants.COPYFILE_EXCL);}
const fps = plan.meta.fps;
const offset = Math.round((plan.cover.introSeconds ?? 0.5) * fps);
const total = offset + Math.ceil(plan.meta.durationSeconds * fps);
const frames = plan.scenes.map((s) => Math.min(total - 1, offset + Math.round((s.start + s.end) / 2 * fps)));
const variants = args.includes('--safe-area') ? ['scene', 'safe'] : ['scene'];
for (const variant of variants) {
  const props = path.join(dir, `${variant}-props.json`);
  fs.writeFileSync(props, JSON.stringify({plan: {...plan, style: {...plan.style, safeAreaOverlay: variant === 'safe'}}}));
  for (const [index, frame] of frames.entries()) {
    runCommand(resolveRemotionBin(remotion), ['still', 'src/index.ts', 'ShortVideo', path.join(dir, `${variant}-${String(index).padStart(3, '0')}.png`), `--frame=${frame}`, `--props=${props}`, `--public-dir=${job}`,
      ...(process.env.REMOTION_BROWSER_EXECUTABLE ? [`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`] : [])], {cwd: remotion, label: `${variant} scene ${index + 1}`, timeoutMs: 300000});
  }
  runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-y', '-framerate', '1', '-i', path.join(dir, `${variant}-%03d.png`),
    '-vf', `scale=270:-2,tile=4x${Math.ceil(frames.length / 4)}:nb_frames=${frames.length}:padding=4:margin=4`, '-frames:v', '1', path.join(dir, `${variant}-contact-sheet.jpg`)], {stdio: 'pipe', timeoutMs: 120000});
}
fs.writeFileSync(path.join(dir, 'preview-report.json'), `${JSON.stringify({planSha256: sha256(JSON.stringify(plan)), width: plan.meta.width, height: plan.meta.height,
  scenes: plan.scenes.map((s, i) => ({id: s.id, frame: frames[i]})), variants, review: 'images-generated-not-yet-editorially-approved'}, null, 2)}\n`);
console.log(`Generated ${frames.length} scene midpoint previews for ${variants.join(', ')}`);

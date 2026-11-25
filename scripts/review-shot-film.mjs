#!/usr/bin/env node
// Review loop for a shot film: render a small preview, measure it, build contact sheets, and report whether the film may go to the
// user. Measurements can only refuse. `ready-for-user` also needs a frame review (frame-review.json) recorded against this exact film.
//   node scripts/review-shot-film.mjs <job> [--narration | --captions=..] [--audio=..] [--theme=..] [--scale=0.25] [--no-render] [--json]
//   node scripts/review-shot-film.mjs <job> --record=<review.json>      bind a frame review you actually performed
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {compileFromArgs} from './lib/shot-options.mjs';
import {SAMPLE, audioStats, checkRecord, contactSheets, evaluate, extractGray, measureFrames, reviewTemplate, verdict} from './lib/film-review.mjs';

const [jobArg, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name) => args.includes(`--${name}`);
if (!jobArg) { console.error('Usage: node scripts/review-shot-film.mjs <job> [--narration | --captions=..] [--audio=..] [--theme=..] [--scale=0.25] [--no-render] [--record=<review.json>] [--json]'); process.exit(2); }
const job = fs.realpathSync(jobArg), dir = path.join(job, 'output/review'), preview = path.join(dir, 'preview.mp4'), recordFile = path.join(job, 'frame-review.json');
fs.mkdirSync(dir, {recursive: true});

const {film} = compileFromArgs(job, option, flag);
// The hash covers the compiled film and every file it plays, so any change to timing, pictures or sound invalidates a review.
const hash = (() => {
  const h = createHash('sha256').update(JSON.stringify(film));
  const files = [...film.shots.flatMap((s) => [s.media?.src, s.mediaB?.src]), film.audio, film.bgm?.src, ...(film.sfx ?? []).map((e) => e.src)].filter(Boolean);
  for (const f of [...new Set(files)].sort()) { const p = path.join(job, f); h.update(f); if (fs.existsSync(p)) h.update(fs.readFileSync(p)); }
  return h.digest('hex');
})();

if (option('record')) {
  const draft = JSON.parse(fs.readFileSync(path.resolve(option('record')), 'utf8'));
  const state = checkRecord(draft, film, hash);
  if (state.state === 'stale' || state.state === 'missing') { console.error(`refused: ${state.problems.join('; ')}`); process.exit(1); }
  fs.writeFileSync(recordFile, `${JSON.stringify({...draft, recordedAt: new Date().toISOString()}, null, 2)}\n`);
  console.log(`frame review recorded: ${state.state}${state.problems.length ? `\n  ${state.problems.slice(0, 12).join('\n  ')}` : ''}`);
  process.exit(state.state === 'needs-fix' ? 1 : 0);
}

if (!args.includes('--no-render') || !fs.existsSync(preview)) {
  const here = fileURLToPath(new URL('./render-shot-film.mjs', import.meta.url));
  const pass = [...['captions', 'audio', 'theme'].filter((n) => option(n)).map((n) => `--${n}=${option(n)}`), ...(flag('narration') ? ['--narration'] : [])];
  const r = spawnSync(process.execPath, [here, job, `--scale=${option('scale') ?? '0.25'}`, `--out=${preview}`, ...pass], {stdio: 'inherit'});
  if (r.status !== 0) { console.error('preview render failed'); process.exit(1); }
}

const frames = extractGray(preview), measures = measureFrames(frames, SAMPLE), audio = audioStats(preview);
const checks = evaluate({measures, audio, film});
const seconds = film.durationInFrames / film.fps, sheets = contactSheets(preview, dir, seconds);
const record = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : null;
const recordState = checkRecord(record, film, hash), v = verdict(checks, recordState);
fs.writeFileSync(path.join(dir, 'frame-review.template.json'), `${JSON.stringify(reviewTemplate(film, hash), null, 2)}\n`);
const report = {filmSha256: hash, seconds, verdict: v, checks, frameReview: {state: recordState.state, problems: recordState.problems}, sheets: sheets.map((s) => ({file: path.relative(job, s.file), fromSecond: s.from, toSecond: s.to, tilesPerRow: s.cols, note: 'one tile per second, left to right, top to bottom'})),
  shots: film.shots.map((s) => ({id: s.id, from: +s.start.toFixed(2), to: +s.end.toFixed(2), move: s.move, rung: s.rung})), measuredAt: new Date().toISOString(),
  limits: 'Measurements refuse; only a recorded frame review plus passing measurements allows ready-for-user. Nothing here auditions the sound or judges taste.'};
fs.writeFileSync(path.join(dir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Film review (${seconds.toFixed(1)} s, ${film.shots.length} shots)`);
  for (const c of checks) console.log(`  ${c.status.padEnd(5)} ${c.label}: ${c.shown}  [${c.rule}]`);
  console.log(`Frame review: ${recordState.state}${recordState.problems.length ? ` (${recordState.problems.length} note${recordState.problems.length > 1 ? 's' : ''})` : ''}`);
  recordState.problems.slice(0, 8).forEach((p) => console.log(`    ${p}`));
  console.log(`Verdict: ${v.state.toUpperCase()}: ${v.why}`);
  console.log(`Contact sheets: ${sheets.map((s) => path.relative(job, s.file)).join(', ')}\nReview template: ${path.relative(job, path.join(dir, 'frame-review.template.json'))}`);
}
process.exit(v.state === 'needs-fix' ? 1 : 0);

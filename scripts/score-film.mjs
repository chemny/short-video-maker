#!/usr/bin/env node
// Structural quality score for a film plan (references/quality-bar.md). It measures what a plan can show about
// material, rhythm and variety. It cannot measure beauty: pass here is necessary, never sufficient.
import fs from 'node:fs';
import path from 'node:path';

const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|mp4|webm|mov)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const TEXT_LAYOUTS = new Set(['text-card', 'quote-card', 'step-list', 'ending-card', 'data-card', 'takeaway', 'definition', 'signal', 'flow', 'scenario-matrix']);

// Thresholds are the contract in references/quality-bar.md; change both together.
export const LIMITS = {
  mediaShare: {fail: 0.5, pass: 0.7},      // share of screen time with an image or video asset on screen (provenance is not checked)
  textOnlyShare: {pass: 0.3, fail: 0.5},   // share of screen time with no media (text or diagram cards only)
  videoShare: {pass: 0.1},                 // share of screen time with real moving footage (warn only)
  longestShot: {pass: 8, fail: 12},        // seconds
  meanShot: {min: 2.5, max: 6},            // seconds
  firstChange: {pass: 4.5, fail: 7},       // seconds until the picture first changes
  layoutRun: {pass: 2, fail: 3},           // longest run of one layout in a row
  layoutKinds: {pass: 4},                  // distinct layouts, capped by the number of shots
  motionShare: {pass: 0.8, fail: 0.5},     // share of shots with a camera or element motion
  variation: {pass: 0.15},                 // standard deviation / mean of shot length, warn only (needs five shots)
  bgm: true,                               // a music bed is planned
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const dur = (s) => Math.max(0, Number(s.end) - Number(s.start));
const assetOf = (s) => {
  const v = s.visual || {};
  const cands = [v.asset, v.video, v.image, s.video, s.image, s.asset].filter((x) => typeof x === 'string');
  return cands.find((x) => MEDIA_EXT.test(x));
};

export function load(target) {
  const abs = path.resolve(target);
  const planPath = fs.statSync(abs).isDirectory() ? path.join(abs, 'video-plan.json') : abs;
  const dir = path.dirname(planPath);
  const plan = readJson(planPath);
  const sbPath = path.join(dir, 'sentence-storyboard.json');
  const storyboard = fs.existsSync(sbPath) ? readJson(sbPath) : null;
  return {plan, storyboard, dir};
}

// Units are the shots of an authored storyboard when there is one, otherwise the plan's scenes.
export function units({plan, storyboard}) {
  if (storyboard?.shots?.length) {
    return {unit: 'shot', items: storyboard.shots.map((s) => ({
      start: s.start, end: s.end, media: Boolean(s.asset) && ['video', 'image'].includes(s.kind), video: s.kind === 'video' && Boolean(s.asset),
      layout: `${s.kind}${s.recipe ? ':' + s.recipe : ''}`, motion: undefined,
    }))};
  }
  return {unit: 'scene', items: (plan.scenes || []).map((s) => {
    const a = assetOf(s);
    return {start: s.start, end: s.end, media: Boolean(a), video: Boolean(a && VIDEO_EXT.test(a)), layout: s.layout || s.type || 'unknown',
      textLayout: TEXT_LAYOUTS.has(s.layout), motion: s.motion ? !['none', undefined, null].includes(s.motion.type) : false};
  })};
}

const share = (items, pred) => {
  const total = items.reduce((a, s) => a + dur(s), 0);
  return total ? items.filter(pred).reduce((a, s) => a + dur(s), 0) / total : 0;
};
const longestRun = (items) => {
  let best = 0, run = 0, prev;
  for (const s of items) { run = s.layout === prev ? run + 1 : 1; prev = s.layout; best = Math.max(best, run); }
  return best;
};

export function score(loaded) {
  const {unit, items} = units(loaded);
  const L = LIMITS, checks = [];
  const add = (id, label, value, shown, status, rule) => checks.push({id, label, value, shown, status, rule});
  const grade = (v, pass, fail, higherBetter) => higherBetter ? (v >= pass ? 'pass' : v >= fail ? 'warn' : 'fail') : (v <= pass ? 'pass' : v <= fail ? 'warn' : 'fail');
  if (!items.length) return {unit, shots: 0, checks: [{id: 'shots', label: 'no scenes or shots', status: 'fail', shown: '0', rule: 'at least one'}], score: 0, passed: 0, total: 1};

  const media = share(items, (s) => s.media), video = share(items, (s) => s.video);
  const textOnly = share(items, (s) => !s.media);
  add('mediaShare', 'Screen time with an image or video asset', media, `${(media * 100).toFixed(0)}%`, grade(media, L.mediaShare.pass, L.mediaShare.fail, true), `pass ≥ ${L.mediaShare.pass * 100}%, fail < ${L.mediaShare.fail * 100}%`);
  add('textOnlyShare', 'Screen time with no media at all', textOnly, `${(textOnly * 100).toFixed(0)}%`, grade(textOnly, L.textOnlyShare.pass, L.textOnlyShare.fail, false), `pass ≤ ${L.textOnlyShare.pass * 100}%, fail > ${L.textOnlyShare.fail * 100}%`);
  add('videoShare', 'Screen time with moving footage', video, `${(video * 100).toFixed(0)}%`, video >= L.videoShare.pass ? 'pass' : 'warn', `pass ≥ ${L.videoShare.pass * 100}%, otherwise warn`);

  const lens = items.map(dur), longest = Math.max(...lens), mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  add('longestShot', `Longest ${unit}`, longest, `${longest.toFixed(1)} s`, grade(longest, L.longestShot.pass, L.longestShot.fail, false), `pass ≤ ${L.longestShot.pass} s, fail > ${L.longestShot.fail} s`);
  add('meanShot', `Average ${unit} length`, mean, `${mean.toFixed(1)} s`, mean >= L.meanShot.min && mean <= L.meanShot.max ? 'pass' : (mean > L.meanShot.max * 2 ? 'fail' : 'warn'), `pass ${L.meanShot.min} to ${L.meanShot.max} s`);
  const first = Number(items[0].end) - Number(items[0].start);
  add('firstChange', 'First picture change', first, `${first.toFixed(1)} s`, grade(first, L.firstChange.pass, L.firstChange.fail, false), `pass ≤ ${L.firstChange.pass} s, fail > ${L.firstChange.fail} s`);

  const run = longestRun(items), kinds = new Set(items.map((s) => s.layout)).size, need = Math.min(L.layoutKinds.pass, items.length);
  add('layoutRun', 'Longest run of one layout', run, String(run), run <= L.layoutRun.pass ? 'pass' : run <= L.layoutRun.fail ? 'warn' : 'fail', `pass ≤ ${L.layoutRun.pass}, fail > ${L.layoutRun.fail}`);
  add('layoutKinds', 'Distinct layouts', kinds, String(kinds), kinds >= need ? 'pass' : 'warn', `pass ≥ ${need}`);

  if (items.some((s) => s.motion !== undefined)) {
    const m = items.filter((s) => s.motion).length / items.length;
    add('motionShare', `${unit}s with motion`, m, `${(m * 100).toFixed(0)}%`, grade(m, L.motionShare.pass, L.motionShare.fail, true), `pass ≥ ${L.motionShare.pass * 100}%, fail < ${L.motionShare.fail * 100}%`);
  } else add('motionShare', `${unit}s with motion`, null, 'not measured', 'skip', 'storyboard shots carry no motion field');

  if (items.length >= 5) { const sd = Math.sqrt(lens.reduce((a, c) => a + (c - mean) ** 2, 0) / lens.length) / mean; add('variation', 'Shot length variation', sd, `${(sd * 100).toFixed(0)}%`, sd >= L.variation.pass ? 'pass' : 'warn', `pass ≥ ${L.variation.pass * 100}%, otherwise warn`); }
  const bgm = Boolean(loaded.plan.audio?.bgm);
  add('bgm', 'Music bed planned', bgm, bgm ? 'yes' : 'no', bgm ? 'pass' : 'warn', 'audio.bgm set');

  const measured = checks.filter((c) => c.status !== 'skip');
  const points = measured.reduce((a, c) => a + (c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0), 0);
  return {unit, shots: items.length, checks, passed: measured.filter((c) => c.status === 'pass').length, total: measured.length,
    failed: measured.filter((c) => c.status === 'fail').map((c) => c.id), score: Math.round((points / measured.length) * 100)};
}

export function report(r) {
  const mark = {pass: 'pass', warn: 'warn', fail: 'FAIL', skip: 'skip'};
  const lines = [`Structural score ${r.score}/100 (${r.passed}/${r.total} checks pass, ${r.shots} ${r.unit}s)`];
  for (const c of r.checks) lines.push(`  ${mark[c.status].padEnd(5)} ${c.label}: ${c.shown}  [${c.rule}]`);
  lines.push(r.failed?.length ? `Blocked by: ${r.failed.join(', ')}` : 'No failing check. This does not show the film looks good; the visual and listening review is still needed.');
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2), target = args.find((a) => !a.startsWith('--'));
  if (!target) { console.error('Usage: node scripts/score-film.mjs <job-dir|video-plan.json> [--json] [--strict]'); process.exit(2); }
  const r = score(load(target));
  console.log(args.includes('--json') ? JSON.stringify(r, null, 2) : report(r));
  if (args.includes('--strict') && r.failed?.length) process.exit(1);
}

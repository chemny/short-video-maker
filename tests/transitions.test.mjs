import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {assignTransitions, assignLayouts, varietyFindings, FRAMES, TRANSITIONS} from '../scripts/lib/transitions-plan.mjs';
import {evaluate} from '../scripts/lib/film-review.mjs';

// Entry and exit effects (references/shot-script.md, step 8): the plan varies, never repeats three times, and every effect ends at rest.
const beat = (over = {}) => ({rung: 'image', move: 'push', material: Math.random().toString(36).slice(2), ...over});
const many = (n, f = () => ({})) => Array.from({length: n}, (_, i) => beat(f(i)));

test('transition plan: sections, text, counts and recordings get fitting entries; short beats and the first beat cut', () => {
  const filler = many(8), pad = filler.map(() => 2);
  const beats = [beat({rung: 'recording'}), beat({move: 'count'}), beat({section: true}), beat(), beat({rung: 'recording'}), beat({section: true}), beat({rung: 'text', move: 'hold'}), ...filler];
  const plan = assignTransitions(beats, [3, 3, 3, 3, 3, 3, 3, ...pad]);
  assert.equal(plan[0].type, 'cut');
  assert.equal(plan[1].type, 'blur', 'a figure over a blurred picture');
  assert.equal(plan[2].type, 'stack', 'first new section');
  assert.equal(plan[6].type, 'dissolve', 'closing text');
  assert.equal(assignTransitions(beats, [3, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, ...pad]).slice(1, 6).every((x) => x.type === 'cut'), true, 'short beats cut');
  const same = assignTransitions([beat({material: 'a'}), beat({material: 'a'})], [3, 3]);
  assert.equal(same[1].type, 'zoom', 'a new crop of the same picture');
});

test('transition plan: deterministic, varied, never the same moving effect three times, at most 40% moving', () => {
  const beats = many(14, (i) => (i % 5 === 3 ? {section: true} : {}));
  const secs = beats.map(() => 4.2);
  const a = assignTransitions(beats, secs), b = assignTransitions(beats, secs);
  assert.deepEqual(a, b);
  const types = a.map((x) => x.type);
  assert.deepEqual(varietyFindings(types), []);
  assert.ok(new Set(types.filter((t) => t !== 'cut')).size >= 3, types.join(','));
  assert.ok(types.slice(1).filter((t) => t !== 'cut').length <= Math.floor(13 * 0.4));
  const explicit = assignTransitions([beat(), beat({transition: 'wipe'}), beat({transition: 'wipe'})], [3, 3, 3]);
  assert.deepEqual(explicit.map((x) => x.type), ['cut', 'wipe', 'wipe'], 'an explicit choice always wins');
  assert.ok(a.filter((x) => x.type === 'push').every((x, i, l) => i === 0 || x.dir !== l[i - 1].dir), 'push alternates its side');
  assert.match(varietyFindings(['cut', 'push', 'push', 'push', 'cut', 'cut', 'cut', 'cut', 'cut', 'cut']).join('|'), /three times/);
  assert.match(varietyFindings(['cut', 'push', 'cut', 'cut', 'cut', 'cut', 'cut', 'cut', 'cut', 'cut']).join('|'), /only 1 kind/);
});

test('picture layouts: float only on long still pictures that do not fill the frame, at most three, an explicit layout wins', () => {
  const beats = many(8, () => ({move: 'push'}));
  const layouts = assignLayouts(beats, beats.map(() => 5), beats.map(() => 'contain'));
  assert.equal(layouts.filter((l) => l === 'float').length, 3);
  assert.deepEqual(assignLayouts(many(2), [5, 5], ['cover', 'cover']), ['card', 'card']);
  assert.deepEqual(assignLayouts(many(1), [3], ['contain']), ['card'], 'too short to tilt');
  assert.deepEqual(assignLayouts([beat({layout: 'stack'})], [5], ['contain']), ['stack']);
});

test('review: the entry variety check fails a film that repeats one effect three times', () => {
  const shots = (types) => types.map((t, i) => ({id: `s${i}`, start: i * 3, end: i * 3 + 3, rung: 'image', transition: t}));
  const status = (types) => evaluate({measures: [{t: 0, mean: 100, diff: 3, captionLuma: 40}, {t: 0.5, mean: 100, diff: 9, captionLuma: 40}], film: {captions: [], shots: shots(types)}}).find((c) => c.id === 'entryVariety')?.status;
  assert.equal(status(['cut', 'push', 'cut', 'wipe', 'cut', 'zoom', 'cut', 'cut', 'cut', 'cut']), 'pass');
  assert.equal(status(['cut', 'push', 'push', 'push', 'cut']), 'fail');
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), remotion = path.join(root, 'remotion');
let esbuild;
try { esbuild = createRequire(path.join(remotion, 'package.json'))('esbuild'); } catch { /* not installed */ }
test('effects: frame counts match the plan, entries end at rest and exits start at rest', {skip: !esbuild && 'remotion dependencies are not installed'}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'svm-fx-')), out = path.join(dir, 'transitions.mjs');
  try {
    await esbuild.build({entryPoints: [path.join(remotion, 'src/templates/frame/shots/transitions.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent', external: ['react']});
    const fx = await import(pathToFileURL(out).href);
    assert.deepEqual(fx.TRANSITION_FRAMES, FRAMES, 'the JS plan and the renderer agree on durations');
    assert.deepEqual([...fx.TRANSITIONS], TRANSITIONS);
    const atRest = (f) => (f.opacity ?? 1) === 1 && (!f.transform || /^(translate\(-?0(px)?, -?0(px)?\)|translateY\(0px\)|scale\(1\)|translate\(0px, 0px\))$/.test(f.transform.replace(/-0px/g, '0px').replace(/\s+/g, ' ').trim())) && (!f.filter || /^blur\(0px\)$/.test(f.filter)) && (!f.clipPath || /^circle\(150%/.test(f.clipPath));
    for (const t of fx.TRANSITIONS.filter((x) => x !== 'cut')) {
      for (const dir of ['left', 'right', 'up', 'down']) assert.ok(atRest(fx.enterFx(t, 1, dir)), `${t} ${dir} entry at progress 1: ${JSON.stringify(fx.enterFx(t, 1, dir))}`);
      const e0 = fx.exitFx(t, 0, 'left');
      assert.ok(!e0.transform || /^(scale\(1\)|translate\(-?0px, -?0px\)|translate\(0px, 0px\))/.test(e0.transform.replace(/-0px/g, '0px')), `${t} exit at progress 0: ${JSON.stringify(e0)}`);
      assert.deepEqual(fx.enterFx(t, 0.5, 'left'), fx.enterFx(t, 0.5, 'left'), 'deterministic');
    }
    assert.notEqual(fx.enterFx('push', 0.3, 'left').transform, fx.enterFx('push', 0.3, 'right').transform, 'direction changes the motion');
  } finally { await rm(dir, {recursive: true, force: true}); }
});

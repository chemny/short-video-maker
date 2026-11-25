import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

// The frame component library's contract (references/component-library.md): every sample validates, an over-limit prop is
// refused with its name, and a shot shorter than the component's minimum is refused. The TSX registry is bundled with esbuild
// from the Remotion project, so this runs without a render.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const remotion = path.join(root, 'remotion');
const require = createRequire(path.join(remotion, 'package.json'));
let esbuild;
try { esbuild = require('esbuild'); } catch { /* remotion dependencies not installed */ }

const load = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'svm-frame-'));
  const out = path.join(dir, 'registry.mjs');
  await esbuild.build({entryPoints: [path.join(remotion, 'src/templates/frame/registry.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent', nodePaths: [path.join(remotion, 'node_modules')]});
  return {mod: await import(pathToFileURL(out).href), dir};
};

test('frame components: samples validate and bad props name the offender', {skip: !esbuild && 'remotion dependencies are not installed'}, async () => {
  const {mod, dir} = await load();
  try {
    assert.equal(new Set(mod.components.map((c) => c.type)).size, mod.components.length, 'one component per type');
    for (const c of mod.components) {
      assert.doesNotThrow(() => c.validate(c.sample), `${c.id} sample`);
      assert.doesNotThrow(() => c.validate(c.sampleMax), `${c.id} maximum sample`);
      assert.equal(mod.byType(c.type), c);
    }
    const by = (id) => mod.components.find((c) => c.id === id);
    assert.throws(() => by('BigLine').validate({lines: [{text: '这一行话实在是太长了所以不行', at: 0}]}), /BigLine\.lines\[0\]\.text/);
    assert.throws(() => by('BigLine').validate({lines: []}), /BigLine\.lines/);
    assert.throws(() => by('BigFigure').validate({parts: [{value: '1234567'}], at: 0}), /BigFigure\.parts/);
    assert.throws(() => by('BigFigure').validate({parts: [{value: 'abc'}], at: 0}), /BigFigure\.parts\[0\]\.value/);
    assert.throws(() => by('Timeline').validate({points: [{when: '11月', what: '开始', at: 0}]}), /Timeline\.points/);
    assert.throws(() => by('BraceExpand').validate({conditions: [{text: '甲', at: 0}, {text: '乙', at: 1}], joiner: '或者'}), /BraceExpand\.joiner/);
    assert.throws(() => by('ConvergeMerge').validate({sources: [{label: '甲', at: 2}, {label: '乙', at: 3}], target: '千问', mergeAt: 1}), /ConvergeMerge\.mergeAt/);
    assert.throws(() => by('Timeline').validate({points: [{when: '11月', what: '开始', at: -1}, {when: '12月', what: '上线', at: 1}]}), /Timeline\.points\[0\]\.at/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('frame components: a shot shorter than the minimum is refused', {skip: !esbuild && 'remotion dependencies are not installed'}, async () => {
  const {mod, dir} = await load();
  try {
    for (const c of mod.components) {
      assert.ok(c.minSeconds >= 2, `${c.id} minimum visible time is at least 2 s`);
      assert.ok(c.sampleSeconds >= c.minSeconds, `${c.id} sample is long enough for its own minimum`);
      assert.throws(() => mod.checkSpan(c, 0, c.minSeconds - 0.5), new RegExp(`${c.id}\\.span`));
      assert.doesNotThrow(() => mod.checkSpan(c, 0, c.minSeconds));
    }
  } finally { await rm(dir, {recursive: true, force: true}); }
});

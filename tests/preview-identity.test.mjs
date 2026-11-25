import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {previewIdentity} from '../scripts/lib/complete-preview.mjs';
import {reachableSources} from '../scripts/lib/import-graph.mjs';

// A throwaway shared root and job: only files the authored entry can import may change its identity.
const setup = (t, entrySource) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'preview-identity-')));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const shared = path.join(dir, 'skill'), job = path.join(dir, 'job');
  fs.mkdirSync(path.join(shared, 'remotion/src/components'), {recursive: true}); fs.mkdirSync(path.join(job, 'src'), {recursive: true});
  fs.writeFileSync(path.join(shared, 'remotion/src/components/Used.tsx'), 'export const Used = 1;');
  fs.writeFileSync(path.join(shared, 'remotion/src/components/Chain.tsx'), "import {Used} from './Used';\nexport const Chain = Used;");
  fs.writeFileSync(path.join(shared, 'remotion/src/components/Unused.tsx'), 'export const Unused = 1;');
  fs.writeFileSync(path.join(shared, 'remotion/package-lock.json'), '{}');
  fs.writeFileSync(path.join(job, 'src/index.tsx'), entrySource(shared));
  const plan = {meta: {renderSource: {kind: 'authored-remotion', entry: 'src/index.tsx', composition: 'Film', layoutProtocol: 'svm-layout-v1'}, width: 1080, height: 1920, productionWorkflow: 'reviewed-v1'}, style: {}};
  const identity = () => previewIdentity(plan, job, {root: shared});
  return {shared, job, plan, identity, write: (file, text) => fs.appendFileSync(path.join(shared, file), text)};
};
const entry = (shared) => `import {Chain} from '${shared}/remotion/src/components/Chain';\nexport default Chain;\n`;

test('shared files an authored composition imports change its preview identity; unrelated ones do not', (t) => {
  const s = setup(t, entry); const before = s.identity();
  s.write('remotion/src/components/Unused.tsx', '\n// unrelated shared edit');
  assert.equal(s.identity(), before);
  s.write('remotion/src/components/Used.tsx', '\n// transitive dependency edit');
  assert.notEqual(s.identity(), before);
});

test('job-local source and the dependency lockfile still bind the identity', (t) => {
  const s = setup(t, entry); const before = s.identity();
  fs.appendFileSync(path.join(s.job, 'src/index.tsx'), '\n// composition edit');
  const edited = s.identity(); assert.notEqual(edited, before);
  s.write('remotion/package-lock.json', ' ');
  assert.notEqual(s.identity(), edited);
});

test('an unresolvable local import falls back to the whole shared tree instead of missing a dependency', (t) => {
  const s = setup(t, (shared) => `import {Chain} from '${shared}/remotion/src/components/Chain';\nimport './missing-local';\nexport default Chain;\n`);
  assert.equal(reachableSources(path.join(s.job, 'src/index.tsx')), null);
  const before = s.identity();
  s.write('remotion/src/components/Unused.tsx', '\n// now relevant because the graph is unknown');
  assert.notEqual(s.identity(), before);
});

test('import graph follows relative, absolute, index and dynamic imports but ignores packages', (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'import-graph-'))); t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  fs.mkdirSync(path.join(dir, 'lib')); fs.writeFileSync(path.join(dir, 'lib/index.ts'), "export * from './leaf';"); fs.writeFileSync(path.join(dir, 'lib/leaf.ts'), 'export const leaf = 1;');
  fs.writeFileSync(path.join(dir, 'data.json'), '{}'); fs.writeFileSync(path.join(dir, 'late.ts'), 'export const late = 1;');
  fs.writeFileSync(path.join(dir, 'entry.tsx'), `import React from 'react';\nimport {leaf} from './lib';\nimport data from './data.json';\nconst later = () => import('./late');\n`);
  assert.deepEqual(reachableSources(path.join(dir, 'entry.tsx')).map(f => path.relative(dir, f)), ['data.json', 'entry.tsx', 'late.ts', 'lib/index.ts', 'lib/leaf.ts']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {cameraWarnings} from '../scripts/lib/shot-film-validate.mjs';

// Camera grammar (remotion/src/templates/frame/shots/camera.ts): the picture never exposes an edge, moves are deterministic,
// and a focus lands where the viewer can see it. The TS is bundled with esbuild so this runs without a render.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), remotion = path.join(root, 'remotion');
let esbuild;
try { esbuild = createRequire(path.join(remotion, 'package.json'))('esbuild'); } catch { /* not installed */ }
const load = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'svm-cam-')), out = path.join(dir, 'camera.mjs');
  await esbuild.build({entryPoints: [path.join(remotion, 'src/templates/frame/shots/camera.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent'});
  return {cam: await import(pathToFileURL(out).href), dir};
};
const skip = !esbuild && 'remotion dependencies are not installed';
const R = {x: 0.3, y: 0.4, w: 0.3, h: 0.25};

test('camera: no move exposes an edge of a large picture, and a small one stays inside the frame', {skip}, async () => {
  const {cam, dir} = await load();
  try {
    for (const [mw, mh] of [[1080, 1920], [1080, 640], [3000, 2000], [800, 1400]]) for (const move of cam.MOVES) {
      for (let i = 0; i <= 20; i++) {
        const v = cam.viewAt({move, mw, mh, region: R, regionEnd: {x: 0.55, y: 0.5, w: 0.3, h: 0.3}}, i / 20), pl = cam.placement(v, mw, mh);
        for (const [pos, size, frame] of [[pl.left, pl.width, 1080], [pl.top, pl.height, 1920]]) {
          if (size >= frame) assert.ok(pos <= 0.001 && pos + size >= frame - 0.001, `${move} ${mw}x${mh} p${i} exposes an edge`);
          else assert.ok(pos >= -0.001 && pos + size <= frame + 0.001, `${move} ${mw}x${mh} p${i} leaves the frame`);
        }
      }
    }
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('camera: moves are deterministic, start at rest, and focus zooms in', {skip}, async () => {
  const {cam, dir} = await load();
  try {
    const shot = {move: 'focus', mw: 2000, mh: 3000, region: {x: 0.35, y: 0.4, w: 0.2, h: 0.1}};
    assert.deepEqual(cam.viewAt(shot, 0.37), cam.viewAt(shot, 0.37));
    assert.equal(cam.viewAt(shot, 0).z, 1);
    assert.ok(cam.viewAt(shot, 1).z > 2, 'a small region is magnified');
    assert.ok(cam.viewAt({...shot, move: 'push'}, 1).z > 1.1);
    assert.ok(cam.viewAt({...shot, move: 'pull', region: undefined}, 0).z > cam.viewAt({...shot, move: 'pull', region: undefined}, 1).z);
    assert.equal(cam.zoomFor({x: 0, y: 0, w: 1, h: 1}, 2000, 3000), 1, 'zoom never drops below 1');
    assert.ok(cam.zoomFor({x: 0, y: 0, w: 0.03, h: 0.03}, 2000, 3000) <= cam.Z_MAX);
    assert.equal(cam.fitFor(1080, 1920), 'cover');
    assert.equal(cam.fitFor(1920, 1080), 'contain');
    assert.ok(cam.regionOk(R) && !cam.regionOk({x: 0.9, y: 0, w: 0.3, h: 0.3}) && !cam.regionOk({x: 0, y: 0, w: 0, h: 0.3}));
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('camera: warnings flag a weak focus and a region the picture edge keeps out of the safe area', {skip}, async () => {
  const {cam, dir} = await load();
  try {
    const media = {kind: 'image', src: 'a.png', mw: 1080, mh: 1920};
    const film = {shots: [
      {id: 'big', move: 'focus', media, region: {x: 0.1, y: 0.2, w: 0.8, h: 0.6}},
      {id: 'tight', move: 'focus', media, region: {x: 0.35, y: 0.45, w: 0.3, h: 0.12}},
      {id: 'corner', move: 'focus', media, region: {x: 0.7, y: 0.0, w: 0.3, h: 0.08}},
    ]};
    const w = cameraWarnings(film, cam).join('|');
    assert.match(w, /big: focus zooms only/);
    assert.doesNotMatch(w, /tight:/);
    assert.match(w, /corner: the region's centre ends/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

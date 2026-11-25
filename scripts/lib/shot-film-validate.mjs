import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Validates the overlay props of a compiled film with the component library's own validators, so a bad figure or on-screen
// line is refused at compile time with the offending prop named, not midway through a render.
const bundle = async (esbuild, entry, out, remotion) => esbuild.build({entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent', nodePaths: [path.join(remotion, 'node_modules')]});

// Camera checks need the real picture sizes: a focus that barely moves, or a region that ends up outside the platform-safe band,
// is reported as a warning naming the shot.
const SAFE = {top: 290, bottom: 1535};
export function cameraWarnings(film, camera) {
  const warnings = [];
  for (const s of film.shots) {
    if (!s.media || !s.region || !['focus', 'highlight', 'cursor', 'pan', 'push', 'pull'].includes(s.move)) continue;
    const cam = {move: s.move, mw: s.media.mw, mh: s.media.mh, region: s.region, regionEnd: s.regionEnd, fit: s.fit};
    for (const [label, p, r] of [['at the end', 1, s.region], ...(s.regionEnd ? [['at the end of the pan', 1, s.regionEnd]] : [])]) {
      const view = camera.viewAt(cam, p), pl = camera.placement(view, cam.mw, cam.mh, s.fit), c = camera.centre(r);
      const y = pl.top + c.y * pl.height, x = pl.left + c.x * pl.width;
      if (['focus', 'highlight', 'cursor', 'pan'].includes(s.move) && (y < SAFE.top || y > SAFE.bottom || x < 0 || x > camera.FRAME.w)) warnings.push(`${s.id}: the region's centre ends at x ${Math.round(x)}, y ${Math.round(y)}, outside the safe area (x 0..${camera.FRAME.w}, y ${SAFE.top}..${SAFE.bottom}); the picture edge stops it centring, pick a region nearer the middle`);
      if (s.move === 'focus' && label === 'at the end') {
        const gain = view.z / 1;
        if (gain < 1.2) warnings.push(`${s.id}: ${s.move} zooms only ${gain.toFixed(2)}x because the region is already large in the frame; choose a tighter region or use push`);
      }
    }
  }
  return warnings;
}

export async function validateOverlays(film) {
  const remotion = fileURLToPath(new URL('../../remotion/', import.meta.url));
  let esbuild;
  try { esbuild = createRequire(path.join(remotion, 'package.json'))('esbuild'); } catch { return {checked: false, errors: [], warnings: []}; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-overlay-')), out = path.join(dir, 'registry.mjs');
  try {
    await esbuild.build({entryPoints: [path.join(remotion, 'src/templates/frame/registry.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent', nodePaths: [path.join(remotion, 'node_modules')]});
    const lib = await import(pathToFileURL(out).href), errors = [];
    const camOut = path.join(dir, 'camera.mjs');
    await bundle(esbuild, path.join(remotion, 'src/templates/frame/shots/camera.ts'), camOut, remotion);
    const warnings = cameraWarnings(film, await import(pathToFileURL(camOut).href));
    if (film.hook) { const spec = lib.byType('hook'); try { spec.validate({lines: film.hook.lines}); } catch (e) { errors.push(`hook: ${e.message}`); } }
    for (const s of film.shots) {
      const seconds = s.end - s.start;
      for (const [field, type] of [['figure', 'figure'], ['onScreen', 'hook']]) {
        if (s[field] === undefined) continue;
        const spec = lib.byType(type);
        try {
          spec.validate(s[field]);
          lib.checkSpan(spec, 0, seconds);
        } catch (e) { errors.push(`${s.id}: ${e.message}`); }
      }
    }
    return {checked: true, errors, warnings};
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}

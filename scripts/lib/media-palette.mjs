import {spawnSync} from 'node:child_process';
import {commandFromEnv} from './bins.mjs';

// The four corner colours of a picture (top left, top right, bottom left, bottom right) as #rrggbb, from a 2x2 area-averaged copy.
// The renderer draws the backdrop of a picture that does not fill the frame from them (shots/Shot.tsx, Backdrop).
export function cornerPalette(file) {
  const r = spawnSync(commandFromEnv('ffmpeg'), ['-nostdin', '-v', 'error', '-i', file, '-vf', 'scale=2:2:flags=area', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {maxBuffer: 1024 * 1024});
  if (r.status !== 0 || r.stdout.length < 12) return null;
  const px = (i) => `#${[0, 1, 2].map((k) => r.stdout[i * 3 + k].toString(16).padStart(2, '0')).join('')}`;
  return [px(0), px(1), px(2), px(3)];
}

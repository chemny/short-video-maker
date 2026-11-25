import {compileFilm} from './shot-film.mjs';
import {timingsFromPlan} from './shot-narration.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Shared by compile, render and review: `--narration` takes timing and audio from the narration stage (<job>/narration/);
// otherwise `--captions` / `--audio` name them by hand, and with neither the timing is estimated (preview only).
export function compileFromArgs(job, option, flag) {
  const theme = option('theme') ?? 'dark';
  if (flag('narration')) {
    const script = JSON.parse(fs.readFileSync(path.join(job, 'shot-script.json'), 'utf8'));
    const {timing, audio} = timingsFromPlan(job, script);
    return compileFilm(job, {timing, audio, theme});
  }
  return compileFilm(job, {captionsFile: option('captions'), audio: option('audio'), theme});
}

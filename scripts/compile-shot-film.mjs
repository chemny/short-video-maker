#!/usr/bin/env node
// shot-script.json + visual inventory -> shot-film.json (props for the ShotFilm composition). Nothing is rendered or downloaded.
import fs from 'node:fs';
import path from 'node:path';
import {compileFromArgs} from './lib/shot-options.mjs';
import {validateOverlays} from './lib/shot-film-validate.mjs';

const [jobArg, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name) => args.includes(`--${name}`);
if (!jobArg) { console.error('Usage: node scripts/compile-shot-film.mjs <job> [--narration | --captions=<aligned captions.json>] [--audio=<job-relative audio>] [--theme=dark|light] [--out=<file>]'); process.exit(2); }
const job = fs.realpathSync(jobArg);
try {
  const {film, audit, timingSource} = compileFromArgs(job, option, flag);
  const overlays = await validateOverlays(film);
  overlays.warnings.forEach((w) => console.log(`warning: ${w}`));
  if (overlays.errors.length) throw new Error(`overlay props are invalid:\n  ${overlays.errors.join('\n  ')}`);
  const out = path.resolve(option('out') ?? path.join(job, 'shot-film.json'));
  fs.writeFileSync(out, `${JSON.stringify(film, null, 2)}\n`);
  for (const w of audit.warnings) console.log(`warning: ${w}`);
  console.log(`${film.shots.length} shots, ${(film.durationInFrames / film.fps).toFixed(1)} s, timing ${timingSource}${timingSource === 'estimated' ? ' (preview only; real timing comes from the narration)' : ''} -> ${out}`);
} catch (error) { console.error(error.message); process.exit(1); }

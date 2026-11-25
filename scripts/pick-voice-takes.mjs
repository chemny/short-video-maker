#!/usr/bin/env node
// Choose, per scene, the VoxCPM2 take whose ASR transcript reproduces the approved text with the most confident words.
//   node scripts/pick-voice-takes.mjs <job> [--seeds=42,7,11,23] [--scenes=b1,b3] [--min=0.4] [--avoid=b11:42] [--all] [--refine] [--rounds=6] [--voice-profile=<profile.json>]
// Writes <job>/narration/takes.json; `make-shot-film.mjs --stage=narration --provider=voxcpm2 --redo` then uses those seeds.
import fs from 'node:fs';
import {pickTakes, refineTakes, DEFAULT_SEEDS} from './lib/voice-takes.mjs';

const [jobArg, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!jobArg) { console.error('Usage: node scripts/pick-voice-takes.mjs <job> [--seeds=42,7,11,23] [--scenes=b1,b3] [--min=0.4] [--avoid=b11:42] [--all] [--refine] [--rounds=6] [--voice-profile=<profile.json>]'); process.exit(2); }
const job = fs.realpathSync(jobArg);
const seeds = option('seeds') ? option('seeds').split(',').map(Number) : DEFAULT_SEEDS;
const avoid = {};
for (const item of (option('avoid') ?? '').split(',').filter(Boolean)) { const [id, seed] = item.split(':'); (avoid[id] ??= []).push(Number(seed)); }
const run = args.includes('--refine') ? refineTakes : pickTakes;
const rounds = option('rounds') ? Number(option('rounds')) : undefined;
const voiceProfile = option('voice-profile');
const r = run({voiceProfile, ...(rounds ? {rounds} : {}),job, seeds, minProbability: Number(option('min') ?? 0.4), scenes: option('scenes')?.split(','), avoid, exhaustive: args.includes('--all'), log: (m) => console.log(m)});
console.log(Object.entries(r.scenes).map(([id, s]) => `${id}: ${s.seed ?? 'none'}${s.minProbability != null ? ` (${s.minProbability.toFixed(2)})` : ''}`).join('  '));
if (args.includes('--refine')) { console.log(r.aligned ? `alignment matched after ${r.rounds} round(s); seeds ${r.sceneSeeds.join(',')}` : `alignment not matched: ${r.reason}`); process.exit(r.aligned ? 0 : 1); }
if (r.failing.length) { console.error(`no acceptable take for: ${r.failing.join(', ')}; try more seeds or reword those lines`); process.exit(1); }
console.log(`scene seeds: ${r.sceneSeeds.join(',')}`);

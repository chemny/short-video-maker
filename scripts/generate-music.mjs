#!/usr/bin/env node
// Background music through a local mlx-serve (POST /v1/audio/music-generations). Nothing runs without --confirm --purpose.
// Start the server first, for example: mlx-serve serve --model <YuE2 dir> --host 127.0.0.1 --port 11240 (needs about 12.5 GB free).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import './tts/load-env.mjs';

const [jobArg, ...rest] = process.argv.slice(2);
const flag = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!jobArg || !flag('prompt')) { console.error('Usage: node scripts/generate-music.mjs <job-dir> --prompt=... [--lyrics=...] [--duration=75] [--seed=7] [--steps=32] [--confirm --purpose=...]'); process.exit(2); }
const base = (process.env.MLX_MUSIC_URL || 'http://127.0.0.1:11240').replace(/\/+$/, '');
const body = {prompt: flag('prompt'), lyrics: (flag('lyrics') ?? '[verse]\n嗯\n').replaceAll('\\n', '\n'), duration_seconds: Number(flag('duration') ?? 75), seed: Number(flag('seed') ?? 7), steps: Number(flag('steps') ?? 32)};
if (!rest.includes('--confirm')) { console.log('Dry run (nothing generated). Add --confirm --purpose="..." to run:'); console.log(JSON.stringify({server: base, ...body}, null, 2)); process.exit(0); }
const purpose = flag('purpose')?.trim();
if (!purpose) { console.error('error: --confirm needs --purpose'); process.exit(1); }
const job = path.resolve(jobArg);
const models = await fetch(`${base}/v1/models`).then((r) => r.json()).catch(() => null);
const model = process.env.MLX_MUSIC_MODEL || models?.data?.[0]?.id;
if (!model) { console.error(`error: no model answered at ${base}/v1/models; start mlx-serve first`); process.exit(1); }
const key = createHash('sha256').update(JSON.stringify({model, ...body})).digest('hex').slice(0, 16);
const relative = `audio/bgm/${key}.wav`, target = path.join(job, relative);
fs.mkdirSync(path.dirname(target), {recursive: true});
if (!fs.existsSync(target)) {
  // curl rather than fetch: generation can take far longer than fetch's header timeout before the first byte.
  const partial = `${target}.part`;
  execFileSync('curl', ['--noproxy', '*', '-sS', '--fail-with-body', '-m', '7200', '-H', 'Content-Type: application/json', '-d', JSON.stringify({model, ...body}), '-o', partial, `${base}/v1/audio/music-generations`], {stdio: 'inherit'});
  fs.renameSync(partial, target);
}
const bytes = fs.readFileSync(target);
const recordFile = path.join(job, 'research/generated.json');
const records = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : {schemaVersion: 1, items: []};
records.items = [...records.items.filter((x) => x.idempotencyKey !== `music-${key}`), {idempotencyKey: `music-${key}`, status: 'downloaded', createdAt: new Date().toISOString(), workflow: 'mlx-serve.music', model, request: body, purpose, outputs: [{file: relative, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length}]}];
fs.mkdirSync(path.dirname(recordFile), {recursive: true});
fs.writeFileSync(recordFile, `${JSON.stringify(records, null, 2)}\n`);
console.log(`saved ${relative} (${bytes.length} bytes)`);

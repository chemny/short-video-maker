import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runCommand, envMilliseconds} from '../../lib/process.mjs';
import {commandFromEnv} from '../../lib/bins.mjs';
import {inspectAsset} from '../../lib/media-assets.mjs';
import {prepareNarration, alignGenerated} from '../aligned.mjs';

export const name = 'voxcpm2';
const hash = (data) => createHash('sha256').update(data).digest('hex');
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
export const resolveRuntime = () => {
  const folder = path.resolve(process.env.SHORT_VIDEO_VOXCPM2_DIR ?? path.join(os.homedir(), 'Codex/inbox/voxcpm2-local'));
  const python = path.join(folder, '.venv', 'bin', 'python');
  const script = path.join(folder, 'generate.py');
  for (const file of [python, script, path.join(folder, 'model-spec.json')]) {
    if (!fs.existsSync(file)) throw new Error('VoxCPM2 runtime unavailable. Set SHORT_VIDEO_VOXCPM2_DIR to an existing installation; no automatic install or download; explicit selection does not switch providers.');
  }
  const spec = JSON.parse(fs.readFileSync(path.join(folder, 'model-spec.json')));
  return {folder, python, script, model: spec.repository, revision: spec.revision,
    fingerprint: hash(Buffer.concat([fs.readFileSync(script), fs.readFileSync(path.join(folder, 'model-spec.json'))]))};
};
const settings = (options = {}) => {
  const seed = Number(options.seed ?? process.env.SHORT_VIDEO_VOXCPM2_SEED ?? 42);
  const steps = Number(options.steps ?? process.env.SHORT_VIDEO_VOXCPM2_STEPS ?? 10);
  if (!Number.isInteger(seed) || seed < 0 || !Number.isInteger(steps) || steps < 1 || steps > 30) throw new Error('VoxCPM2 requires seed>=0 and steps=1..30');
  return {seed, steps, mode: 'plain', maxTokens: 2000};
};
export const listVoices = () => {
  const runtime = resolveRuntime();
  return [{id: 'plain', name: 'VoxCPM2 local plain speech', note: `${runtime.model}@${runtime.revision}; no fixed personal speaker identity`}];
};

// Content-addressed WAVs, not a filename-only skip: text/settings/runtime changes regenerate.
export const synthesize = ({texts, audioDir, options = {}}) => {
  const runtime = resolveRuntime(); const config = settings(options);
  if (!texts.length || texts.some((text) => !String(text).trim())) throw new Error('Nonempty approved narration required');
  // Each approved scene is immutable and reusable independently of order/other scenes.
  const chunks = texts;
  if (chunks.some((text) => text.length > 300)) throw new Error('Split narration scenes longer than 300 characters before local synthesis');
  const dir = path.join(audioDir, '.tts-cache', 'voxcpm2'); fs.mkdirSync(dir, {recursive: true});
  const segments = chunks.map((text) => {
    const key = hash(JSON.stringify({schema: 'scene-v1', text, config, runtime})).slice(0, 24);
    const file = path.join(dir, `scene-${key}.wav`), metadata = path.join(dir, `scene-${key}.json`);
    if (fs.existsSync(file) && fs.existsSync(metadata)) {
      const meta = JSON.parse(fs.readFileSync(metadata));
      if (meta.audioSha256 !== hash(fs.readFileSync(file))) throw new Error('VoxCPM2 scene cache hash mismatch; preserve the modified file before retrying');
      inspectAsset(file); return {key, file, meta, reused: true};
    }
    const stage = fs.mkdtempSync(path.join(dir, '.generating-'));
    try {
      const out = path.join(stage, 'scene.wav');
      runCommand(runtime.python, [runtime.script, '--mode', 'plain', '--text', text, '--seed', String(config.seed), '--steps', String(config.steps), '--max-tokens', String(config.maxTokens), '--output', out],
        {cwd: runtime.folder, label: 'local VoxCPM2 scene cache miss', timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000)});
      const duration = inspectAsset(out).duration;
      const meta = {text, config, engineFingerprint: runtime.fingerprint, duration, audioSha256: hash(fs.readFileSync(out)),
        generation: JSON.parse(fs.readFileSync(out.replace(/\.wav$/, '.json')))};
      fs.renameSync(out, file); write(metadata, meta);
      return {key, file, meta, reused: false};
    } finally {fs.rmSync(stage, {recursive: true, force: true});}
  });
  const key = hash(JSON.stringify({schema: 'scene-assembly-v1', segments: segments.map(s => s.key)})).slice(0, 24);
  const output = path.join(dir, `${key}.wav`), metadata = path.join(dir, `${key}.json`);
  const sceneCache = segments.map(({key, file, meta, reused}, index) => ({index, key, file: path.relative(audioDir, file), duration: meta.duration, audioSha256: meta.audioSha256, reused}));
  if (fs.existsSync(output) && fs.existsSync(metadata)) {
    const cached = JSON.parse(fs.readFileSync(metadata));
    if (cached.audioSha256 !== hash(fs.readFileSync(output))) throw new Error('VoxCPM2 cache hash mismatch; preserve the modified file before retrying');
    inspectAsset(output); return {file: output, meta: {...cached, sceneCache}, segments: segments.map(s => ({file: s.file, audioSha256: s.meta.audioSha256})), reused: true};
  }
  const stage = fs.mkdtempSync(path.join(dir, '.assembling-'));
  try {
    const joined = path.join(stage, 'joined.wav');
    runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-n', ...segments.flatMap(s => ['-i', s.file]),
      '-filter_complex', `${segments.map((_, i) => `[${i}:a]`).join('')}concat=n=${segments.length}:v=0:a=1[a]`, '-map', '[a]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', joined], {stdio: 'pipe'});
    const meta = {provider: name, providerMeta: {model: runtime.model, voice: `plain-seed-${config.seed}`}, model: runtime.model, revision: runtime.revision, config, texts, chunks, duration: inspectAsset(joined).duration,
      engineFingerprint: runtime.fingerprint, audioSha256: hash(fs.readFileSync(joined)), sceneCache, generation: segments.map(s => s.meta.generation)};
    fs.renameSync(joined, output); write(metadata, meta);
    return {file: output, meta, segments: segments.map(s => ({file: s.file, audioSha256: s.meta.audioSha256})), reused: segments.every(s => s.reused)};
  } finally {fs.rmSync(stage, {recursive: true, force: true});}
};

export const preview = async ({text, outputPath, options}) => {
  const result = synthesize({texts: [text], audioDir: path.dirname(outputPath), options});
  runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-n', '-i', result.file, outputPath], {stdio: 'pipe'});
  return {...result.meta, reused: result.reused};
};

export const generateAligned = ({planPath, options = {}}) => {
  const plan = JSON.parse(fs.readFileSync(planPath));
  prepareNarration(plan);
  let generated;
  try {generated = synthesize({texts: plan.scenes.map((s) => s.voiceover), audioDir: path.join(path.dirname(planPath), 'audio'), options});}
  catch (error) {error.ttsSynthesisFailed = true; throw error;}
  // Older verified caches may predate the common provider metadata field.
  generated.meta.providerMeta ??= {model: generated.meta.model, voice: `plain-seed-${generated.meta.config.seed}`};
  return alignGenerated({planPath, options, provider: name, generated});
};

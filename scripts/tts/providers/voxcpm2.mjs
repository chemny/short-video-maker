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
// A personal voice profile clones from the ORIGINAL reference recording and applies its tempo once to the output.
// The approved sped-up sample is only a listening benchmark and is rejected as a cloning input.
export const loadVoiceProfile = (file) => {
  const profilePath = path.resolve(file);
  if (!fs.existsSync(profilePath)) throw new Error('Voice profile not found; no voice is substituted');
  const raw = fs.readFileSync(profilePath), profile = JSON.parse(raw);
  if (profile.mode !== 'clone' || !/voxcpm2/i.test(profile.provider ?? '')) throw new Error('Voice profile must be a VoxCPM2 clone profile');
  const reference = path.resolve(path.dirname(profilePath), profile.reference_audio ?? '');
  if (!profile.reference_audio || !fs.existsSync(reference)) throw new Error('Voice profile reference recording is missing');
  const referenceSha256 = hash(fs.readFileSync(reference)), expected = profile.sha256?.[path.basename(reference)];
  if (!expected) throw new Error('Voice profile has no recorded SHA256 for its reference recording');
  if (expected !== referenceSha256) throw new Error('Voice profile reference recording changed; it no longer matches the recorded SHA256');
  if (profile.approved_sample) {
    const sample = path.resolve(path.dirname(profilePath), profile.approved_sample);
    if (sample === reference || (fs.existsSync(sample) && hash(fs.readFileSync(sample)) === referenceSha256)) throw new Error('The approved sped-up sample must not be the cloning reference');
  }
  const speed = Number(profile.speed ?? 1);
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) throw new Error('Voice profile speed must be between 0.5 and 2');
  const generation = profile.generation_settings ?? {};
  return {path: profilePath, sha256: hash(raw), name: String(profile.name ?? path.basename(path.dirname(profilePath))), reference, referenceSha256, speed,
    preservePitch: profile.preserve_pitch !== false, seed: generation.seed, steps: generation.steps};
};
const resolveProfile = (options = {}) => {
  const choice = options.voiceProfile ?? process.env.SHORT_VIDEO_VOXCPM2_VOICE_PROFILE;
  return choice && choice !== 'none' ? loadVoiceProfile(choice) : null;
};
const settings = (options = {}, profile = null) => {
  const seed = Number(options.seed ?? profile?.seed ?? process.env.SHORT_VIDEO_VOXCPM2_SEED ?? 42);
  const steps = Number(options.steps ?? profile?.steps ?? process.env.SHORT_VIDEO_VOXCPM2_STEPS ?? 10);
  if (!Number.isInteger(seed) || seed < 0 || !Number.isInteger(steps) || steps < 1 || steps > 30) throw new Error('VoxCPM2 requires seed>=0 and steps=1..30');
  if (!profile) return {seed, steps, mode: 'plain', maxTokens: 2000};
  return {seed, steps, mode: 'clone', maxTokens: 2000, referenceSha256: profile.referenceSha256, speed: profile.speed};
};
export const listVoices = () => {
  const runtime = resolveRuntime();
  return [{id: 'plain', name: 'VoxCPM2 local plain speech', note: `${runtime.model}@${runtime.revision}; no fixed personal speaker identity`},
    {id: 'profile', name: 'VoxCPM2 personal clone profile', note: 'Select with --voice-profile=/path/profile.json; clones the original reference and applies tempo once'}];
};

// Content-addressed WAVs, not a filename-only skip: text/settings/runtime changes regenerate.
export const synthesize = ({texts, audioDir, options = {}}) => {
  const runtime = resolveRuntime(); const profile = resolveProfile(options); const config = settings(options, profile);
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
      let out = path.join(stage, profile ? 'raw.wav' : 'scene.wav');
      runCommand(runtime.python, [runtime.script, '--mode', config.mode, ...(profile ? ['--ref-audio', profile.reference] : []), '--text', text, '--seed', String(config.seed), '--steps', String(config.steps), '--max-tokens', String(config.maxTokens), '--output', out],
        {cwd: runtime.folder, label: 'local VoxCPM2 scene cache miss', timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000)});
      const generation = JSON.parse(fs.readFileSync(out.replace(/\.wav$/, '.json')));
      let rawAudioSha256;
      if (profile) {
        // Tempo is applied exactly once, to the raw clone output; pitch is preserved by atempo.
        rawAudioSha256 = hash(fs.readFileSync(out));
        runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-n', '-i', out, '-af', `atempo=${profile.speed}`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', path.join(stage, 'scene.wav')], {stdio: 'pipe'});
        fs.rmSync(out); fs.rmSync(out.replace(/\.wav$/, '.json'));
        out = path.join(stage, 'scene.wav');
      }
      const duration = inspectAsset(out).duration;
      const meta = {text, config, engineFingerprint: runtime.fingerprint, duration, audioSha256: hash(fs.readFileSync(out)),
        ...(profile ? {rawAudioSha256, speedAppliedOnce: profile.speed, voiceProfileSha256: profile.sha256} : {}), generation};
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
    const meta = {provider: name, providerMeta: profile
      ? {model: runtime.model, voice: profile.name, voiceMode: 'clone', voiceProfilePath: profile.path, voiceProfileSha256: profile.sha256, voiceReferenceSha256: profile.referenceSha256, voiceSpeed: profile.speed, voiceSpeedAppliedOnce: true}
      : {model: runtime.model, voice: `plain-seed-${config.seed}`}, model: runtime.model, revision: runtime.revision, config, texts, chunks, duration: inspectAsset(joined).duration,
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
  // A job remembers its personal profile; --voice-profile=none returns to plain speech.
  const voiceProfile = options.voiceProfile ?? plan.audio?.voiceProfilePath;
  let generated;
  try {generated = synthesize({texts: plan.scenes.map((s) => s.voiceover), audioDir: path.join(path.dirname(planPath), 'audio'), options: {...options, voiceProfile}});}
  catch (error) {error.ttsSynthesisFailed = true; throw error;}
  // Older verified caches may predate the common provider metadata field.
  generated.meta.providerMeta ??= {model: generated.meta.model, voice: `plain-seed-${generated.meta.config.seed}`};
  return alignGenerated({planPath, options, provider: name, generated});
};

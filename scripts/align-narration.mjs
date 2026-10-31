#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {alignCaptions, retimeScenes} from './lib/alignment.mjs';
import {inspectAsset, copyAsset} from './lib/media-assets.mjs';
import {commandFromEnv} from './lib/bins.mjs';
import {sceneTranscripts} from './lib/scene-transcripts.mjs';
import {resolveLocalAsr, transcribeLocal} from './lib/local-asr.mjs';
const [input, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!input) throw new Error('Usage: node scripts/align-narration.mjs <plan> [--audio=<file>] [--transcript=<Whisper JSON>] [--model=<local.pt-or-MLX-directory>] [--language=zh] [--apply]');
const file = path.resolve(input); const job = path.dirname(file);
const plan = JSON.parse(fs.readFileSync(file));
const asset = inspectAsset(option('audio') ? path.resolve(option('audio')) : path.resolve(job, plan.audio?.sourceVoiceover ?? plan.audio?.voiceover ?? 'MISSING'));
if (!asset.hasAudio || !asset.duration) throw new Error('Usable narration is required');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const audioSha256 = hash(fs.readFileSync(asset.path));
const folder = path.join(job, 'alignment'); fs.mkdirSync(folder, {recursive: true});
// Explicit --model wins. Without it, the common resolver may select an existing
// configured MLX model; externally supplied evidence never requires an ASR model.
const runtime = option('transcript') ? null : resolveLocalAsr({model: option('model')});
const language = option('language') ?? plan.meta.language?.split('-')[0] ?? 'auto';
const transcriptFile = option('transcript') ? path.resolve(option('transcript')) : path.join(folder, `transcript-${audioSha256.slice(0, 16)}-${runtime.modelSha256.slice(0, 12)}-${runtime.engineSha256.slice(0, 10)}-${language}-${option('segments')?'scenes':'full'}.json`);
if (!option('transcript') && option('segments')) {
  const segments = JSON.parse(fs.readFileSync(path.resolve(option('segments'))));
  const observed = sceneTranscripts({segments, audioFile: asset.path, audioSha256, model: runtime.model, python: runtime.python, language, folder: option('scene-cache') ?? folder});
  if (Math.abs(observed.duration - asset.duration) > .002) throw new Error('Scene ASR durations do not cover the assembled audio');
  fs.writeFileSync(transcriptFile, JSON.stringify(observed, null, 2));
} else if (!option('transcript') && !fs.existsSync(transcriptFile)) transcribeLocal({audioFile: asset.path, out: transcriptFile, language, model: runtime.model, python: runtime.python});
const transcript = JSON.parse(fs.readFileSync(transcriptFile));
if (transcript.audioSha256 !== audioSha256) throw new Error('Transcript does not match the current narration hash');
if (runtime && transcript.modelSha256 !== runtime.modelSha256) throw new Error('Transcript does not match the selected local ASR model');
let result;
let normalization;
try {
  if (language === 'zh' && Array.isArray(transcript.words)) {
    const texts = [...plan.captions.map((c) => c.text), ...transcript.words.map((w) => w.word)];
    const converted = JSON.parse(execFileSync(commandFromEnv('python3'), [fileURLToPath(new URL('./normalize-chinese.py', import.meta.url))], {input: JSON.stringify(texts), maxBuffer: 4 * 1024 * 1024, timeout: 30000}).toString());
    normalization = {captionTexts: converted.slice(0, plan.captions.length), wordTexts: converted.slice(plan.captions.length)};
  }
  result = alignCaptions(plan.captions, transcript, asset.duration, normalization);
}
catch (error) {result = {status: 'needs-review', proposed: [], issues: [{code: 'invalid-transcript', message: error.message}]};}
const report = {...result, audioSha256,
  scriptSha256: hash(JSON.stringify(plan.captions.map(({id, text}) => ({id, text})))), engine: transcript.engine,
  normalization: normalization ? 'OpenCC t2s for matching only; display text unchanged' : 'NFKC/case/punctuation', applied: false};
let scenes;
try { scenes = retimeScenes(plan.scenes, report.proposed, asset.duration); }
catch (error) {report.issues.push({code: 'scene-mapping', message: error.message}); report.status = 'needs-review';}
fs.writeFileSync(path.join(folder, 'alignment-report.json'), `${JSON.stringify(report, null, 2)}\n`);
if (args.includes('--apply')) {
  if (report.status !== 'matched') throw new Error('Alignment needs review; original plan retained. See alignment/alignment-report.json. No guessed fallback was applied.');
  const before = fs.readFileSync(file);
  fs.writeFileSync(path.join(folder, `plan-before-${hash(before).slice(0, 16)}.json`), before);
  const existing = path.relative(job, asset.path).split(path.sep).join('/');
  const isSnapshot = existing.startsWith('audio/source/') && path.basename(asset.path, path.extname(asset.path)).endsWith(`-${audioSha256.slice(0, 16)}`);
  const voiceover = isSnapshot ? existing : copyAsset(asset, job, 'audio/source');
  plan.captions = report.proposed.map(({alignment, ...caption}) => caption);
  plan.scenes = scenes; plan.meta.durationSeconds = asset.duration;
  plan.audio = {...plan.audio, sourceMode: 'imported', timingSource: 'asr-matched', voiceover, sourceVoiceover: voiceover};
  delete plan.audio.mix; delete plan.audio.mixIncludesBgm;
  delete plan.audio.acousticTiming;
  if (plan.cover.overlaySeconds) plan.cover.overlaySeconds = plan.captions[0].start;
  report.applied = true;
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
  fs.writeFileSync(path.join(folder, 'alignment-report.json'), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`Alignment: ${report.status}; applied=${report.applied}; ${report.issues.length} review item(s)`);

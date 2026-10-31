#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {scanAssets, chooseAsset, copyAsset, inspectAsset} from './lib/media-assets.mjs';

const [jobDirArg, ...args] = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!jobDirArg || !option('input-dir')) {
  throw new Error('Usage: node scripts/import-media.mjs <job-dir> --input-dir=<folder> [--narration=<file>] [--music=<file>|none] [--scene-map=<json>] [--clean=none|light] [--normalize]');
}
const jobDir = fs.realpathSync(jobDirArg);
const inputDir = fs.realpathSync(option('input-dir'));
if (jobDir === inputDir) throw new Error('Keep the job directory separate from the source folder');
const planPath = path.join(jobDir, 'video-plan.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const manifest = scanAssets(inputDir, {exclude: [jobDir]});
const narration = chooseAsset(manifest, 'narration', option('narration'), {required: true});
const music = chooseAsset(manifest, 'bgm', option('music'));
if (music?.path === narration.path) throw new Error('Narration and BGM must be different files');
const cleanup = option('clean') ?? 'none';
if (!['none', 'light'].includes(cleanup)) throw new Error('clean must be none or light');
if (!Number.isFinite(narration.duration) || narration.duration <= 0) throw new Error('Narration has no valid duration');
if (!plan.scenes?.length || !plan.captions?.length) {
  throw new Error('Provide an authored canonical plan with timed scenes and captions first. Phase 1 does not guess alignment or automatically arrange pictures.');
}
if (Math.abs(plan.meta.durationSeconds - narration.duration) > 0.15) {
  throw new Error(`Plan duration (${plan.meta.durationSeconds}s) and narration (${narration.duration}s) differ. Supply a matching timeline; no proportional retiming is performed.`);
}
for (const item of [...plan.scenes, ...plan.captions]) {
  if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.start < 0 || item.end <= item.start || item.end > narration.duration + 0.05) {
    throw new Error(`Invalid supplied timing: ${item.id}`);
  }
}
const sceneMap = option('scene-map') ? JSON.parse(fs.readFileSync(path.resolve(option('scene-map')), 'utf8')) : {};
if (!sceneMap || typeof sceneMap !== 'object' || Array.isArray(sceneMap)) throw new Error('scene-map must be an object: {"scene-id": "image-path"}');
for (const id of Object.keys(sceneMap)) {
  if (!plan.scenes.some((scene) => scene.id === id)) throw new Error(`Unknown scene in scene-map: ${id}`);
}
// Inspect all selections before copying anything or updating the plan.
const selections = plan.scenes.map((scene) => {
  if (sceneMap[scene.id] === undefined) return null;
  if (typeof sceneMap[scene.id] !== 'string') throw new Error(`Invalid visual path for ${scene.id}`);
  const selection = sceneMap[scene.id];
  const file = path.resolve(inputDir, selection);
  const asset = inspectAsset(file, inputDir);
  if (asset.kind !== 'image') throw new Error(`Scene ${scene.id}: use import-clips.mjs for a video selection with an explicit sourceStart; do not pass video as an image (phase-2 feature)`);
  return asset;
});
const voiceover = copyAsset(narration, jobDir, 'audio/source');
const sameAsAlignedAudio = plan.audio?.timingSource === 'asr-matched' && plan.audio.voiceover &&
  fs.existsSync(path.resolve(jobDir, plan.audio.sourceVoiceover ?? plan.audio.voiceover)) &&
  createHash('sha256').update(fs.readFileSync(path.resolve(jobDir, plan.audio.sourceVoiceover ?? plan.audio.voiceover))).digest('hex') === createHash('sha256').update(fs.readFileSync(narration.path)).digest('hex');
const bgm = music ? copyAsset(music, jobDir, 'audio/source') : undefined;
plan.scenes = plan.scenes.map((scene, index) => selections[index]
  ? {...scene, visual: {...scene.visual, asset: copyAsset(selections[index], jobDir, 'assets/imported')}}
  : scene);
plan.audio = {
  sourceMode: 'imported', timingSource: sameAsAlignedAudio ? 'asr-matched' : 'provided',
  voiceover, sourceVoiceover: voiceover,
  ...(bgm ? {bgm, sourceBgm: bgm} : {}),
  voiceVolume: plan.audio?.voiceVolume ?? 1,
  bgmVolume: plan.audio?.bgmVolume ?? 0.12,
  duckBgm: plan.audio?.duckBgm ?? true,
  processing: {cleanup, normalize: args.includes('--normalize')},
};
plan.meta.durationSeconds = narration.duration;
manifest.selections = {narration: narration.path, music: music?.path ?? null,
  scenes: Object.fromEntries(plan.scenes.map((scene, index) => [scene.id, selections[index]?.path ?? scene.visual?.asset ?? null]))};
fs.writeFileSync(path.join(jobDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
console.log(`Imported media into ${jobDir}. Source files and supplied scene/caption timings were preserved. Use run-job.mjs; imported audio disables TTS by default.`);

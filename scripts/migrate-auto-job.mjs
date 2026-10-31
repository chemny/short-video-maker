#!/usr/bin/env node
// Explicit one-way conversion. No import or execution of the retired Auto skill.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {copyAsset, inspectAsset} from './lib/media-assets.mjs';
import {writeAssetNeeds} from './lib/asset-needs.mjs';

const [sourceArg, destinationArg, ...args] = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!sourceArg || !destinationArg || !args.includes('--accept-existing-timing')) {
  throw new Error('Usage: node scripts/migrate-auto-job.mjs <old-job> <new-job> --accept-existing-timing [--narration=<file>] [--music=<file>|none]. Review legacy captions first; this converter does not align speech.');
}
const source = fs.realpathSync(sourceArg);
const destination = path.resolve(destinationArg);
if (destination === source || destination.startsWith(`${source}${path.sep}`) || fs.existsSync(destination)) throw new Error('Use a new destination outside the original job');
const planFile = path.join(source, 'video-plan.json');
const legacy = JSON.parse(fs.readFileSync(planFile, 'utf8'));
if (!legacy.audio?.narration || !legacy.scenes?.length || !legacy.captions?.length) throw new Error('Expected an Auto job with narration, scenes and captions');
const selected = (value, fallback) => {
  const file = value ?? fallback;
  if (!file || file === 'none') return null;
  return inspectAsset(path.resolve(source, file));
};
const narration = selected(option('narration'), legacy.audio.narration);
const music = selected(option('music'), legacy.audio.bgm);
if (!narration?.hasAudio || !narration.duration) throw new Error('Usable legacy narration is required; specify --narration if its old path is unavailable');
if (music && (!music.hasAudio || music.path === narration.path)) throw new Error('Select separate music with an audio stream or --music=none');
if (Math.abs(narration.duration - legacy.meta.durationSeconds) > 0.15) throw new Error('Narration differs from old timeline; supply matching audio, do not scale captions');
const duration = narration.duration;
for (const [index, caption] of legacy.captions.entries()) {
  if (!Number.isFinite(caption.start) || !Number.isFinite(caption.end) || caption.start < 0 || caption.end <= caption.start || caption.end > duration + 0.05 || (index && caption.start < legacy.captions[index - 1].end)) throw new Error('Legacy captions require timing review');
}
const visuals = legacy.scenes.map((scene) => {
  if (!scene.asset) throw new Error(`Missing legacy visual for ${scene.id}; author a canonical plan instead`);
  const candidates = [path.resolve(source, 'public', scene.asset), path.resolve(source, scene.asset)];
  const asset = inspectAsset(candidates.find((p) => fs.existsSync(p)) ?? candidates[0]);
  if (asset.kind !== 'image') throw new Error('Only legacy still-image scenes can be converted');
  return asset;
});
const bounds = legacy.scenes.map((s) => s.start);
if (bounds[0] !== 0 || bounds.some((s, i) => !Number.isFinite(s) || s < 0 || s >= duration || (i && s <= bounds[i - 1]))) throw new Error('Invalid legacy scene starts; author/review the timeline');
const sceneCaptions = legacy.scenes.map((s) => {
  const caption = legacy.captions.find((c) => c.id === s.captionId);
  if (!caption) throw new Error(`No caption for ${s.id}`);
  return caption;
});
// Old visuals overlap. The newer scene takes over at its start: flatten to those same boundaries.
const adjustments = legacy.scenes.map((s, i) => ({id: s.id, oldEnd: s.end, end: bounds[i + 1] ?? duration})).filter((s) => s.oldEnd !== s.end);
fs.mkdirSync(destination, {recursive: true});
const plan = {
  meta: {...legacy.meta, durationSeconds: duration, topic: legacy.meta.topic ?? legacy.meta.title, language: legacy.meta.language ?? 'zh-CN', platforms: legacy.meta.platforms ?? []},
  style: {template: 'image-overlay', background: '#101014', textPrimary: '#ffffff', accent: '#F6C85F', captionPosition: 'bottom', captionMode: 'sentence', captionScale: 1.35, captionBackdrop: true, motionIntensity: 'low'},
  cover: {title: legacy.meta.title, ...(legacy.meta.speaker ? {subtitle: `朗诵者：${legacy.meta.speaker}`} : {}), layout: 'bold-title', introSeconds: 0, overlaySeconds: legacy.captions[0].start},
  audio: {sourceMode: 'imported', timingSource: 'provided', voiceover: copyAsset(narration, destination, 'audio/source'),
    ...(music ? {bgm: copyAsset(music, destination, 'audio/source')} : {}), voiceVolume: 1, bgmVolume: 0.12, duckBgm: true, processing: {cleanup: 'none', normalize: false}},
  captions: legacy.captions,
  scenes: legacy.scenes.map((s, i) => {
    const caption = sceneCaptions[i];
    return {id: s.id, start: bounds[i], end: bounds[i + 1] ?? duration, type: 'explain', layout: 'image-with-caption',
      voiceover: caption.text, caption: caption.text, visual: {asset: copyAsset(visuals[i], destination, 'assets/imported'), alt: caption.text, bare: true},
      motion: {type: typeof s.motion === 'string' ? s.motion : 'none'}, transition: s.transition ?? 'fade'};
  }), publish: {},
};
plan.cover.backgroundAsset = plan.scenes[0].visual.asset;
plan.audio.sourceVoiceover = plan.audio.voiceover;
if (plan.audio.bgm) plan.audio.sourceBgm = plan.audio.bgm;
const report = {
  source, sourcePlanSha256: createHash('sha256').update(fs.readFileSync(planFile)).digest('hex'),
  narration: narration.path, music: music?.path ?? null, timing: 'copied-existing-not-independently-aligned',
  sceneBoundaryAdjustments: adjustments, legacyWarnings: legacy.warnings ?? [],
  limits: ['No ASR or forced alignment', 'Preserves chosen visuals; does not establish their semantic relevance', 'Legacy overlaps flattened at next scene start; old crossfade is not pixel-identical'],
};
fs.writeFileSync(path.join(destination, 'video-plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
fs.writeFileSync(path.join(destination, 'migration-report.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(destination, 'manifest.json'), `${JSON.stringify({schemaVersion: 1, source, assets: [narration, ...(music ? [music] : []), ...visuals]}, null, 2)}\n`);
writeAssetNeeds(plan, destination);
console.log(`Converted to ${destination}; existing captions retained, scene boundaries normalized. Review migration-report.json before rendering.`);

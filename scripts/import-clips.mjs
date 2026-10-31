#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {inspectAsset, copyAsset} from './lib/media-assets.mjs';
import {auditProduction} from './lib/production-audit.mjs';
const [input, mapFile] = process.argv.slice(2);
if (!input || !mapFile) throw new Error('Usage: node scripts/import-clips.mjs <plan> <clip-map.json>');
const file = path.resolve(input); const job = path.dirname(file);
const plan = JSON.parse(fs.readFileSync(file)); const map = JSON.parse(fs.readFileSync(mapFile));
if (!map || Array.isArray(map) || typeof map !== 'object') throw new Error('clip-map must be an object keyed by scene id');
const pending = [];
for (const [id, selection] of Object.entries(map)) {
  const scene = plan.scenes.find((s) => s.id === id);
  if (!scene || !selection?.file || !Number.isFinite(selection.sourceStart) || selection.sourceStart < 0) throw new Error(`Invalid scene or selection: ${id}`);
  const asset = inspectAsset(path.resolve(path.dirname(path.resolve(mapFile)), selection.file));
  if (asset.kind !== 'video' || selection.sourceStart + scene.end - scene.start > asset.duration + 0.01) throw new Error(`Clip ${id} does not cover the requested interval`);
  if (![undefined, 'contain', 'cover'].includes(selection.fit) || !Number.isFinite(selection.sourceVolume ?? 0) || (selection.sourceVolume ?? 0) < 0 || (selection.sourceVolume ?? 0) > 1 || (selection.sourceVolume && !asset.hasAudio)) throw new Error(`Invalid fit/audio controls: ${id}`);
  if (selection.focalPoint && ![selection.focalPoint.x, selection.focalPoint.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error(`Invalid focal point: ${id}`);
  pending.push({scene, selection, asset});
}
for (const {scene, selection, asset} of pending) {
  scene.visual = {...scene.visual, kind: 'video', asset: copyAsset(asset, job, 'assets/clips'), sourceStart: selection.sourceStart,
    sourceVolume: selection.sourceVolume ?? 0, fit: selection.fit ?? 'contain', ...(selection.focalPoint ? {focalPoint: selection.focalPoint} : {})};
  scene.transition = 'cut';
}
const report = auditProduction(plan, job);
if (report.errors.length) throw new Error(report.errors.join('\n'));
fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
fs.writeFileSync(path.join(job, 'clip-import-report.json'), `${JSON.stringify({selections: pending.map(({scene, asset, selection}) => ({sceneId: scene.id, original: asset.path, ...selection}))}, null, 2)}\n`);
console.log(`Imported ${pending.length} explicit clips; source audio defaults to muted`);

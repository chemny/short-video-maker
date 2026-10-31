import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {previewIdentity, completePreview} from '../scripts/lib/complete-preview.mjs';

test('preview identity invalidates changed captions, timing, aspect and in-place assets', t => {
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-preview-'));
  t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  fs.writeFileSync(path.join(job, 'voice.wav'), 'old');
  const plan = {meta: {width: 1920}, audio: {voiceover: 'voice.wav'}, captions: [{text: 'A', start: 0}]};
  const id = previewIdentity(plan, job);
  assert.equal(previewIdentity(structuredClone(plan), job), id);
  for (const change of [p => p.captions[0].text = 'B', p => p.captions[0].start = .3, p => p.meta.width = 1080]) {
    const changed = structuredClone(plan); change(changed); assert.notEqual(previewIdentity(changed, job), id);
  }
  fs.writeFileSync(path.join(job, 'voice.wav'), 'changed');
  assert.notEqual(previewIdentity(plan, job), id);
  const current = previewIdentity(plan, job);
  fs.writeFileSync(path.join(job, 'sentence-storyboard.json'), '{"understanding":"changed"}');
  assert.notEqual(previewIdentity(plan, job), current);
});

test('complete preview renders all frames, preserves HD delivery and reuses only verified output', {skip: process.env.SHORT_VIDEO_RENDER_SMOKE !== '1', timeout: 180000}, t => {
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-full-preview-'));
  t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const plan = JSON.parse(fs.readFileSync(new URL('../examples/material-plan.json', import.meta.url)));
  plan.meta.durationSeconds = 2; plan.meta.width = 640; plan.meta.height = 360;
  plan.style.template = 'responsive-report'; plan.cover.introSeconds = 0; plan.audio = {intent: 'silent'};
  plan.scenes = [{...plan.scenes[0], id: 's', start: 0, end: 2, layout: 'text-card', caption: '完整预览', visual: undefined}];
  plan.captions = [{id: 'c', text: '保留完整时间线', start: 0, end: 2}];
  const file = path.join(job, 'video-plan.json'); fs.writeFileSync(file, JSON.stringify(plan));
  fs.mkdirSync(path.join(job, 'output')); fs.writeFileSync(path.join(job, 'output/video.mp4'), 'existing HD');
  const first = completePreview(file); assert.equal(first.reused, false); assert.ok(fs.statSync(first.video).size > 1000);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', first.video]));
  const stream = probe.streams.find(s => s.codec_type === 'video');
  assert.equal(Number(stream.nb_frames), 2 * plan.meta.fps);
  assert.equal(stream.width, 160); assert.equal(stream.height, 90);
  fs.writeFileSync(path.join(job, 'preview/complete/latest.json'), JSON.stringify({identity:'older-preview',video:'old/video.mp4'}));
  assert.equal(completePreview(file).reused, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(job, 'preview/complete/latest.json'))).identity, first.identity);
  fs.appendFileSync(first.video, Buffer.from([0])); assert.equal(completePreview(file).reused, false);
  assert.equal(fs.readFileSync(path.join(job, 'output/video.mp4'), 'utf8'), 'existing HD');
});

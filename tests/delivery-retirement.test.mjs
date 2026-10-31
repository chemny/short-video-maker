import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inspectDelivery} from '../scripts/lib/delivery-diagnostics.mjs';
import {writeAssetNeeds} from '../scripts/lib/asset-needs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'video-retirement-')));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
};
const run = (bin, args) => execFileSync(bin, args, {encoding: 'utf8', stdio: 'pipe', timeout: 60000});
const ffmpeg = (args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args]);
const write = (p, value) => fs.writeFileSync(p, JSON.stringify(value));
const hash = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

test('diagnostics identify black/silent delivery and distinguish no audio from measured audio', (t) => {
  const dir = workspace(t);
  const file = path.join(dir, 'video.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=160x90:r=10:d=4', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '4', '-c:v', 'libx264', '-c:a', 'aac', file]);
  const report = inspectDelivery(file, dir);
  assert.ok(report.errors.some((e) => e.includes('black')));
  assert.ok(report.errors.some((e) => e.includes('silent')));
  assert.ok(report.checks.silencedetect.some((s) => s.duration >= 3.9));
  assert.ok(fs.statSync(path.join(dir, 'contact-sheet.jpg')).size > 0);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=orange:s=160x90:r=10:d=1', '-an', file]);
  const noAudio = inspectDelivery(file, dir);
  assert.equal(noAudio.checks.volumedetect, null);
  assert.deepEqual(noAudio.checks.silencedetect, []);
  assert.deepEqual(noAudio.errors, []);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=orange:s=160x90:r=30:d=1',
    '-vf', "drawbox=color=black:t=fill:enable='eq(n,10)'", '-an', file]);
  const briefBlack = inspectDelivery(file, dir);
  assert.ok(briefBlack.checks.blackdetect.some((s) => s.duration > 0 && s.duration < 0.04), 'An isolated interior black frame at 30fps must be detected');
});

test('contact sheet samples beyond 45 seconds and covers the final portion', (t) => {
  const dir = workspace(t);
  const file = path.join(dir, 'video.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=2:d=46', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=2:d=14',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-an', '-c:v', 'libx264', file]);
  inspectDelivery(file, dir);
  const pixel = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(dir, 'contact-sheet.jpg'),
    '-vf', 'crop=2:2:856:354,scale=1:1', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  assert.ok(pixel[2] > pixel[0] + 100, 'Final sample must show the blue tail after 46s');
});

test('quality CLI saves failures for wrong FPS, black/silent content and corrupted media', (t) => {
  const dir = workspace(t);
  const file = path.join(dir, 'video.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=160x90:r=10:d=2', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '2', '-c:v', 'libx264', '-c:a', 'aac', file]);
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'examples/material-plan.json')));
  plan.meta = {...plan.meta, width: 160, height: 90, fps: 30, durationSeconds: 2};
  plan.audio = {voiceover: 'video.mp4'};
  write(path.join(dir, 'video-plan.json'), plan);
  const check = () => spawnSync(process.execPath, [path.join(root, 'scripts/quality-check.mjs'), path.join(dir, 'video-plan.json'), dir, '--require-render']);
  assert.notEqual(check().status, 0);
  let report = JSON.parse(fs.readFileSync(path.join(dir, 'quality-report.json')));
  assert.equal(report.status, 'failed');
  for (const message of ['FPS', 'black', 'silent']) assert.ok(report.errors.some((e) => e.includes(message)), message);
  fs.writeFileSync(file, 'corrupted render');
  assert.notEqual(check().status, 0);
  report = JSON.parse(fs.readFileSync(path.join(dir, 'quality-report.json')));
  assert.equal(report.status, 'failed');
  assert.ok(report.errors.some((e) => e.includes('diagnostics failed')));
});

test('asset requests identify missing/unreadable/small images and allow text cards', (t) => {
  const dir = workspace(t);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=orange:s=160x90', '-frames:v', '1', path.join(dir, 'small.png')]);
  const plan = {meta: {title: 'test', width: 1080, height: 1920}, scenes: [
    {id: 'missing', layout: 'image-with-caption', caption: '官网产品演示'},
    {id: 'broken', visual: {asset: 'gone.png'}},
    {id: 'small', visual: {asset: 'small.png'}},
    {id: 'text', layout: 'text-card', caption: 'Use authored text'},
  ]};
  const report = writeAssetNeeds(plan, dir);
  assert.deepEqual(report.needs.map((n) => n.reason), ['missing-selection', 'missing-or-unreadable', 'low-resolution']);
  assert.match(fs.readFileSync(path.join(dir, 'assets-needed.md'), 'utf8'), /官网产品演示/);
  plan.scenes = [{id: 'text', layout: 'text-card'}];
  assert.equal(writeAssetNeeds(plan, dir).needs.length, 0, 'Rerun must remove resolved needs');
});

test('legacy conversion is standalone, retains sources/captions/credits and refuses overwrite or unaccepted timing', (t) => {
  const dir = workspace(t);
  const old = path.join(dir, 'old'); fs.mkdirSync(old);
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=700:duration=3', path.join(old, 'voice.wav')]);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=orange:s=320x568', '-frames:v', '1', path.join(old, 'image.png')]);
  const captions = [{id: 'line', start: 0.5, end: 2.8, text: '留存旁白'}];
  write(path.join(old, 'video-plan.json'), {meta: {title: '诗', speaker: '讲述者', width: 1080, height: 1920, fps: 30, durationSeconds: 3},
    audio: {narration: 'voice.wav'}, captions, scenes: [{id: 'one', captionId: 'line', start: 0, end: 3, asset: 'image.png'}]});
  const before = ['voice.wav', 'image.png', 'video-plan.json'].map((f) => hash(path.join(old, f)));
  const destination = path.join(dir, 'new');
  const script = path.join(root, 'scripts/migrate-auto-job.mjs');
  assert.notEqual(spawnSync(process.execPath, [script, old, destination]).status, 0);
  assert.equal(fs.existsSync(destination), false);
  run(process.execPath, [script, old, destination, '--accept-existing-timing']);
  const plan = JSON.parse(fs.readFileSync(path.join(destination, 'video-plan.json')));
  assert.deepEqual(plan.captions, captions);
  assert.equal(plan.meta.speaker, '讲述者');
  assert.equal(plan.cover.introSeconds, 0);
  assert.equal(plan.cover.overlaySeconds, 0.5);
  assert.equal(hash(path.join(destination, plan.audio.voiceover)), before[0]);
  assert.deepEqual(['voice.wav', 'image.png', 'video-plan.json'].map((f) => hash(path.join(old, f))), before);
  assert.notEqual(spawnSync(process.execPath, [script, old, destination, '--accept-existing-timing']).status, 0);
});

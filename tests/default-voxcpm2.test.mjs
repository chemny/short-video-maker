import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {synthesize, generateAligned} from '../scripts/tts/providers/voxcpm2.mjs';
import {prepareAudio} from '../scripts/lib/audio-processing.mjs';
import {finalizeAudio} from '../scripts/lib/audio-export.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (file) => JSON.parse(fs.readFileSync(file));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', ...args], {stdio: 'pipe'});
const workspace = (t) => {const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'voxcpm2-default-'))); t.after(() => fs.rmSync(dir, {recursive: true, force: true})); return dir;};
const cli = (name, args) => execFileSync(process.execPath, [path.join(root, 'scripts', name), ...args], {stdio: 'pipe'});

test('VoxCPM2 caches by text/settings and commits only audio-bound successful alignment', (t) => {
  const dir = workspace(t); const runtime = path.join(dir, 'runtime'); fs.mkdirSync(path.join(runtime, '.venv/bin'), {recursive: true});
  const python = execFileSync('which', ['python3'], {encoding: 'utf8'}).trim();
  fs.symlinkSync(python, path.join(runtime, '.venv/bin/python'));
  write(path.join(runtime, 'model-spec.json'), {repository: 'fixture/voxcpm2', revision: 'fixture'});
  // Synthetic audio tests the file/transaction contract; real speech is verified separately.
  fs.writeFileSync(path.join(runtime, 'generate.py'), `import argparse,json,wave,math,struct\np=argparse.ArgumentParser();p.add_argument('--text');p.add_argument('--output');a,_=p.parse_known_args()\nw=wave.open(a.output,'wb');w.setparams((1,2,48000,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',int(3000*math.sin(i*2*math.pi*997/48000))) for i in range(96000)));w.close()\nopen(a.output.replace('.wav','.json'),'w').write(json.dumps({'text':a.text,'fixture':True}))\n`);
  const old = process.env.SHORT_VIDEO_VOXCPM2_DIR; process.env.SHORT_VIDEO_VOXCPM2_DIR = runtime;
  t.after(() => {if (old === undefined) delete process.env.SHORT_VIDEO_VOXCPM2_DIR; else process.env.SHORT_VIDEO_VOXCPM2_DIR = old;});
  const audioDir = path.join(dir, 'audio'); const args = {texts: ['Hello world.'], audioDir};
  const first = synthesize(args); assert.equal(first.reused, false);
  assert.equal(synthesize(args).reused, true);
  assert.notEqual(synthesize({...args, texts: ['New text.']}).file, first.file);
  assert.notEqual(synthesize({...args, options: {seed: 43}}).file, first.file);
  const scenes = synthesize({...args, texts: ['Scene one.', 'Scene two.']});
  assert.deepEqual(scenes.meta.sceneCache.map(s => s.reused), [false, false]);
  const changed = synthesize({...args, texts: ['Scene one.', 'Changed two.']});
  assert.deepEqual(changed.meta.sceneCache.map(s => s.reused), [true, false]);
  assert.equal(changed.meta.sceneCache[0].audioSha256, scenes.meta.sceneCache[0].audioSha256);
  const reordered = synthesize({...args, texts: ['Changed two.', 'Scene one.']});
  assert.deepEqual(reordered.meta.sceneCache.map(s => s.reused), [true, true]);
  const settingsChanged = synthesize({...args, texts: ['Scene one.', 'Changed two.'], options: {steps: 11}});
  assert.deepEqual(settingsChanged.meta.sceneCache.map(s => s.reused), [false, false]);
  const corrupt = path.join(audioDir, settingsChanged.meta.sceneCache[1].file);
  fs.appendFileSync(corrupt, Buffer.from([0]));
  assert.throws(() => synthesize({...args, texts: ['Scene one.', 'Changed two.'], options: {steps: 11}}), /scene cache hash mismatch/);
  const file = path.join(dir, 'video-plan.json');
  const plan = {meta: {language: 'en-US', durationSeconds: 3}, audio: {sourceMode: 'tts'}, cover: {},
    scenes: [{id: 's', start: 0, end: 3, voiceover: 'Hello world.'}], captions: [{id: 'c', text: 'Hello world.', start: 0, end: 3}]};
  write(file, plan); const transcript = path.join(dir, 'observed.json');
  write(transcript, {audioSha256: hash(first.file), engine: 'synthetic-boundary-contract', words: [{word: 'Hello', start: .2, end: .8, probability: .99}, {word: 'world', start: .8, end: 1.7, probability: .99}]});
  generateAligned({planPath: file, options: {transcript}});
  const aligned = json(file); assert.equal(aligned.audio.provider, 'voxcpm2'); assert.equal(aligned.audio.sourceMode, 'tts');
  assert.equal(aligned.audio.timingSource, 'asr-matched'); assert.equal(aligned.meta.durationSeconds, 2);
  assert.deepEqual(aligned.captions.map(({start, end}) => [start, end]), [[.2, 1.7]]);
  assert.equal(hash(path.join(dir, aligned.audio.voiceover)), hash(first.file));
  const before = fs.readFileSync(file); const evidence = fs.readFileSync(path.join(dir, 'alignment/alignment-report.json'));
  fs.mkdirSync(path.join(dir, 'output')); fs.writeFileSync(path.join(dir, 'output/video.mp4'), 'prior delivery');
  const invalid = json(transcript); invalid.words.pop(); write(transcript, invalid);
  assert.throws(() => generateAligned({planPath: file, options: {transcript}}), /alignment blocked/);
  assert.deepEqual(fs.readFileSync(file), before); assert.deepEqual(fs.readFileSync(path.join(dir, 'alignment/alignment-report.json')), evidence);
  assert.equal(fs.readFileSync(path.join(dir, 'output/video.mp4'), 'utf8'), 'prior delivery');
  assert.ok(fs.readdirSync(path.join(dir, 'alignment')).some((f) => f.startsWith('voxcpm2-rejected-')));
  write(file, {...aligned, audio: {...aligned.audio, sourceMode: 'imported'}});
  assert.throws(() => generateAligned({planPath: file, options: {transcript}}), /protected/);
  const broken = path.join(dir, 'missing-runtime'); process.env.SHORT_VIDEO_VOXCPM2_DIR = broken;
  assert.throws(() => synthesize(args), /no automatic install/);
});

test('final PCM audio preserves BGM and selected native clip sound including transition overlap, with no doubled render audio', (t) => {
  const dir = workspace(t); const output = path.join(dir, 'output'); fs.mkdirSync(output);
  const voice = path.join(dir, 'voice.wav'); const music = path.join(dir, 'bgm.wav'); const clip = path.join(dir, 'clip.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=997:duration=4:sample_rate=48000', voice]);
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=421:duration=5:sample_rate=48000', music]);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=orange:s=320x180:r=30:d=3.5', '-f', 'lavfi', '-i', 'sine=frequency=1901:duration=0.5:sample_rate=48000', '-f', 'lavfi', '-i', 'sine=frequency=1499:duration=3:sample_rate=48000', '-filter_complex', '[1:a][2:a]concat=n=2:v=0:a=1[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-c:a', 'aac', clip]);
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'examples/material-plan.json')));
  plan.meta = {...plan.meta, width: 320, height: 180, fps: 30, durationSeconds: 4}; plan.cover.introSeconds = .5;
  plan.audio = {sourceMode: 'imported', timingSource: 'provided', voiceover: 'voice.wav', bgm: 'bgm.wav', voiceVolume: 1, bgmVolume: .1, duckBgm: false, exportPipeline: 'pcm-master-v1'};
  const scene = {...plan.scenes[0], layout: 'text-card'}; delete scene.visual;
  plan.scenes = [{...scene, id: 'one', start: 0, end: 2, transition: 'fade', visual: {kind: 'video', asset: 'clip.mp4', sourceStart: .5, sourceVolume: .4}}, {...scene, id: 'two', start: 2, end: 4, transition: 'cut'}];
  plan.captions = [{id: 'c', start: 0, end: 4, text: 'Synthetic audio fixture.'}];
  const file = path.join(dir, 'video-plan.json'); write(file, plan); prepareAudio(file);
  cli('package-output.mjs', [file, output]);
  const video = path.join(output, 'video.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=orange:s=320x180:r=30:d=4.5', '-f', 'lavfi', '-i', 'sine=frequency=101:duration=4.5:sample_rate=48000', '-c:v', 'libx264', '-c:a', 'aac', video]);
  const report = finalizeAudio(file, output); assert.equal(report.status, 'passed'); assert.deepEqual(report.audibleClips, ['one']);
  assert.ok(Math.abs(report.verification.offsetSeconds) < .001);
  // Frequency-specific checks prove clip/BGM preservation and removal of the old rendered mix.
  const decoded = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-']);
  const samples = new Float32Array(decoded.buffer, decoded.byteOffset, decoded.byteLength / 4);
  const magnitude = (freq, from) => {
    const part = samples.slice(Math.round(from * 8000), Math.round((from + .2) * 8000));
    let re = 0, im = 0;
    for (let i = 0; i < part.length; i++) {re += part[i] * Math.cos(2 * Math.PI * freq * i / 8000); im += part[i] * Math.sin(2 * Math.PI * freq * i / 8000);}
    return 2 * Math.hypot(re, im) / part.length;
  };
  assert.ok(magnitude(997, 1) > .10 && magnitude(997, 1) < .15, 'Voice is neither lost nor doubled');
  assert.ok(magnitude(421, 2) > .008, 'BGM survives after its intentional fade-in');
  assert.ok(magnitude(1499, 1) > .035, 'Selected clip audio survives');
  assert.ok(magnitude(1499, 2.6) > .035, 'Outgoing clip stays audible for its 12-frame transition overlap');
  assert.ok(magnitude(1499, 3.1) < .003, 'Clip stops at selected scene/transition boundary');
  assert.ok(magnitude(1901, 1) < .003, 'sourceStart excludes the earlier clip interval');
  assert.ok(magnitude(101, 1) < .003, 'Old Remotion audio is replaced, not doubled');
  cli('quality-check.mjs', [file, output, '--require-render']);
  fs.appendFileSync(video, Buffer.from([0]));
  const stale = spawnSync(process.execPath, [path.join(root, 'scripts/quality-check.mjs'), file, output, '--require-render']);
  assert.notEqual(stale.status, 0); assert.ok(json(path.join(output, 'quality-report.json')).errors.some((e) => /audio export evidence/.test(e)));
});

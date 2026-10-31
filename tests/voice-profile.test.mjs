import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {synthesize, loadVoiceProfile} from '../scripts/tts/providers/voxcpm2.mjs';

const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
const tone = (file, seconds = 2) => execFileSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}:sample_rate=48000`, '-ac', '1', file], {stdio: 'pipe'});
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}));

// The fixture generator records the mode and reference it was asked to use; audio is a 2s tone.
const fixture = (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'voice-profile-')));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const runtime = path.join(dir, 'runtime'); fs.mkdirSync(path.join(runtime, '.venv/bin'), {recursive: true});
  fs.symlinkSync(execFileSync('which', ['python3'], {encoding: 'utf8'}).trim(), path.join(runtime, '.venv/bin/python'));
  write(path.join(runtime, 'model-spec.json'), {repository: 'fixture/voxcpm2', revision: 'fixture'});
  fs.writeFileSync(path.join(runtime, 'generate.py'), `import argparse,json,wave,math,struct\np=argparse.ArgumentParser();p.add_argument('--text');p.add_argument('--output');p.add_argument('--mode');p.add_argument('--ref-audio')\na,_=p.parse_known_args()\nw=wave.open(a.output,'wb');w.setparams((1,2,48000,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',int(3000*math.sin(i*2*math.pi*440/48000))) for i in range(96000)));w.close()\nopen(a.output.replace('.wav','.json'),'w').write(json.dumps({'mode':a.mode,'ref':a.ref_audio}))\n`);
  const old = process.env.SHORT_VIDEO_VOXCPM2_DIR; process.env.SHORT_VIDEO_VOXCPM2_DIR = runtime;
  t.after(() => {if (old === undefined) delete process.env.SHORT_VIDEO_VOXCPM2_DIR; else process.env.SHORT_VIDEO_VOXCPM2_DIR = old;});
  const voice = path.join(dir, 'voice'); fs.mkdirSync(voice);
  const reference = path.join(voice, 'reference-original.wav'), sample = path.join(voice, 'approved-1.15x.wav');
  tone(reference, 3); tone(sample, 1);
  const profile = {name: 'Test voice', provider: 'local VoxCPM2', mode: 'clone', reference_audio: 'reference-original.wav', approved_sample: 'approved-1.15x.wav',
    speed: 1.15, preserve_pitch: true, generation_settings: {steps: 10, seed: 42, cfg_value: 2.0},
    sha256: {'reference-original.wav': hash(reference), 'approved-1.15x.wav': hash(sample)}};
  const profilePath = path.join(voice, 'profile.json'); write(profilePath, profile);
  return {dir, voice, reference, sample, profile, profilePath, audioDir: path.join(dir, 'audio')};
};

test('personal profile clones the original reference, applies tempo once and caches by identity', (t) => {
  const f = fixture(t); const options = {voiceProfile: f.profilePath};
  const first = synthesize({texts: ['你好。'], audioDir: f.audioDir, options});
  assert.equal(first.reused, false);
  const generation = first.meta.generation[0];
  assert.equal(generation.mode, 'clone');
  assert.equal(generation.ref, f.reference);
  assert.notEqual(generation.ref, f.sample);
  assert.ok(Math.abs(duration(first.file) - 2 / 1.15) < 0.03, 'tempo applied exactly once to the 2s raw output');
  assert.equal(first.meta.sceneCache.length, 1);
  assert.equal(first.meta.config.mode, 'clone');
  assert.equal(first.meta.config.referenceSha256, hash(f.reference));
  assert.equal(synthesize({texts: ['你好。'], audioDir: f.audioDir, options}).reused, true);
  const plain = synthesize({texts: ['你好。'], audioDir: f.audioDir});
  assert.notEqual(plain.file, first.file);
  assert.equal(plain.meta.generation[0].mode, 'plain');
  assert.ok(Math.abs(duration(plain.file) - 2) < 0.03, 'plain speech is not tempo adjusted');
  write(f.profilePath, {...f.profile, speed: 1.25});
  const faster = synthesize({texts: ['你好。'], audioDir: f.audioDir, options});
  assert.notEqual(faster.file, first.file);
  assert.ok(Math.abs(duration(faster.file) - 2 / 1.25) < 0.03);
});

test('profile validation never substitutes another voice', (t) => {
  const f = fixture(t);
  assert.equal(loadVoiceProfile(f.profilePath).speed, 1.15);
  assert.throws(() => loadVoiceProfile(path.join(f.voice, 'missing.json')), /not found/);
  write(f.profilePath, {...f.profile, reference_audio: 'approved-1.15x.wav'});
  assert.throws(() => loadVoiceProfile(f.profilePath), /sped-up sample must not/);
  write(f.profilePath, {...f.profile, sha256: {...f.profile.sha256, 'reference-original.wav': '0'.repeat(64)}});
  assert.throws(() => loadVoiceProfile(f.profilePath), /no longer matches/);
  write(f.profilePath, {...f.profile, sha256: {}});
  assert.throws(() => loadVoiceProfile(f.profilePath), /no recorded SHA256/);
  write(f.profilePath, {...f.profile, speed: 5});
  assert.throws(() => loadVoiceProfile(f.profilePath), /speed must be/);
  write(f.profilePath, {...f.profile, mode: 'plain'});
  assert.throws(() => loadVoiceProfile(f.profilePath), /clone profile/);
  write(f.profilePath, f.profile);
  assert.throws(() => synthesize({texts: ['你好。'], audioDir: f.audioDir, options: {voiceProfile: path.join(f.voice, 'missing.json')}}), /not found/);
});

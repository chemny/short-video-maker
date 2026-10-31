import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {selectProvider} from '../scripts/tts/select-provider.mjs';
import {generateCloudAligned} from '../scripts/tts/cloud-aligned.mjs';
import {auditProduction} from '../scripts/lib/production-audit.mjs';
import {compareWaveforms} from '../scripts/lib/audio-sync.mjs';
import * as volcano from '../scripts/tts/providers/volcengine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v));
const json = (f) => JSON.parse(fs.readFileSync(f));
const workspace = (t) => {const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'multi-tts-'))); t.after(() => fs.rmSync(dir, {recursive: true, force: true})); return dir;};
const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', ...args], {stdio: 'pipe'});
const plan = () => {
  const p = json(path.join(root, 'examples/material-plan.json')); p.audio = {};
  const s = {...p.scenes[0], layout: 'text-card', transition: 'cut'}; delete s.visual;
  p.meta.durationSeconds = 4; p.meta.language = 'en-US';
  p.scenes = ['Hello.', 'World.'].map((text, i) => ({...s, id: `s${i}`, start: i * 2, end: i * 2 + 2, voiceover: text, captionIds: [`c${i}`]}));
  p.captions = p.scenes.map((s, i) => ({id: `c${i}`, text: s.voiceover, start: s.start, end: s.end})); return p;
};

test('automatic TTS selection is local when complete, Edge otherwise; explicit/job choices and imported protection win', () => {
  const ready = () => ({ready: true, reason: 'fixture'}), absent = () => ({ready: false, reason: 'fixture'});
  assert.equal(selectProvider({env: {}, capability: ready}).provider, 'voxcpm2');
  assert.equal(selectProvider({env: {}, capability: absent}).provider, 'edge');
  for (const provider of ['voxcpm2', 'edge', 'volcengine']) assert.equal(selectProvider({explicit: provider, env: {}, capability: () => {throw new Error('explicit choice must not probe/fallback');}}).provider, provider);
  assert.equal(selectProvider({env: {}, plan: {audio: {provider: 'volcengine'}}, capability: ready}).provider, 'volcengine');
  assert.equal(selectProvider({env: {SHORT_VIDEO_TTS_PROVIDER: 'auto'}, plan: {audio: {provider: 'volcengine'}}, capability: ready}).provider, 'volcengine');
  assert.equal(selectProvider({explicit: 'auto', env: {SHORT_VIDEO_TTS_PROVIDER: 'volcengine'}, capability: absent}).provider, 'edge');
  assert.equal(selectProvider({plan: {audio: {sourceMode: 'imported'}}, env: {SHORT_VIDEO_TTS_PROVIDER: 'edge'}}).provider, 'none');
  assert.equal(selectProvider({explicit: 'auto', plan: {audio: {sourceMode: 'imported'}}}).provider, 'none');
  assert.throws(() => selectProvider({explicit: 'edge', plan: {audio: {sourceMode: 'imported'}}}), /protected/);
});

test('cloud timing aligns decoded PCM segments without Python and rejects unmatched words atomically', async (t) => {
  const dir = workspace(t); const audio = path.join(dir, 'sample.mp3');
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=997:duration=2:sample_rate=48000', audio]);
  const file = path.join(dir, 'video-plan.json'); write(file, plan());
  let bad = false;
  const provider = {name: 'edge', generate: async () => ({segments: ['Hello', 'World'].map((word) => ({segmentPath: audio, words: [{word: bad === true ? 'wrong' : word, start: bad === 'invalid' ? 999 : .2, end: bad === 'invalid' ? 1000 : 1.7, probability: 1}]})), providerMeta: {voice: 'fixture-edge'}})};
  const old = process.env.PYTHON3_BIN; process.env.PYTHON3_BIN = '/no-python-required';
  t.after(() => {if (old === undefined) delete process.env.PYTHON3_BIN; else process.env.PYTHON3_BIN = old;});
  await generateCloudAligned({planPath: file, provider, skillRoot: root});
  const aligned = json(file); assert.equal(aligned.audio.timingSource, 'provider-matched'); assert.equal(aligned.audio.sourceMode, 'tts');
  assert.ok(Math.abs(aligned.scenes[1].start - (aligned.meta.durationSeconds / 2 + .2)) < .002);
  assert.deepEqual(auditProduction(aligned, dir).errors, []);
  const before = fs.readFileSync(file); const evidence = fs.readFileSync(path.join(dir, 'alignment/alignment-report.json'));
  bad = true; await assert.rejects(generateCloudAligned({planPath: file, provider, skillRoot: root}), /alignment blocked/);
  assert.deepEqual(fs.readFileSync(file), before); assert.deepEqual(fs.readFileSync(path.join(dir, 'alignment/alignment-report.json')), evidence);
  bad = 'invalid'; await assert.rejects(generateCloudAligned({planPath: file, provider, skillRoot: root}), /alignment blocked/);
  assert.deepEqual(fs.readFileSync(file), before);
  assert.ok(fs.readdirSync(path.join(dir, 'alignment')).some((f) => f.startsWith('edge-rejected-') && json(path.join(dir, 'alignment', f)).issues.some((i) => i.code === 'invalid-provider-timestamps')));
  fs.appendFileSync(path.join(dir, 'alignment/provider-timing.json'), ' ');
  assert.ok(auditProduction(aligned, dir).errors.some((s) => /Provider timing/.test(s)));
});

test('Volcengine request/response uses real timestamp metadata and cache without persisting credentials', async (t) => {
  const dir = workspace(t); const audio = path.join(dir, 'sample.mp3');
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=997:duration=2:sample_rate=48000', audio]);
  let requests = 0;
  const server = http.createServer(async (req, res) => {
    let text = ''; for await (const part of req) text += part;
    const body = JSON.parse(text); assert.equal(body.request.with_timestamp, 1); requests++;
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify({code: 3000, data: fs.readFileSync(audio).toString('base64'), addition: {frontend: JSON.stringify({words: [{word: body.request.text, start_time: 200, end_time: 1700}]})}}));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); t.after(() => {server.closeAllConnections(); server.close();});
  const vars = {VOLCENGINE_TTS_ENDPOINT: `http://127.0.0.1:${server.address().port}`, VOLCENGINE_TTS_APPID: 'fixture-app', VOLCENGINE_TTS_ACCESS_TOKEN: 'fixture-secret', VOLCENGINE_TTS_TIMESTAMP_UNIT: 'ms'};
  const prior = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]])); Object.assign(process.env, vars);
  t.after(() => {for (const [k, v] of Object.entries(prior)) if (v === undefined) delete process.env[k]; else process.env[k] = v;});
  const file = path.join(dir, 'video-plan.json'); write(file, plan());
  await generateCloudAligned({planPath: file, provider: volcano, skillRoot: root}); assert.equal(requests, 2);
  await generateCloudAligned({planPath: file, provider: volcano, skillRoot: root}); assert.equal(requests, 2, 'Verified segment audio and word times must be reused');
  const generation = fs.readFileSync(path.join(dir, 'audio/volcengine-generation.json'), 'utf8'); assert.ok(!generation.includes('fixture-secret'));
  assert.equal(json(file).audio.timingSource, 'provider-matched');
});

test('Node waveform verifier detects a fixed encoder delay rather than certifying it', () => {
  const ref = Float32Array.from({length: 24000}, (_, i) => Math.sin(i * .013 + i * i * .000017) * .2);
  const actual = new Float32Array(ref.length + 320); actual.set(ref, 320);
  const result = compareWaveforms(ref, actual); assert.ok(Math.abs(result.offsetSeconds - .04) < .00013); assert.ok(result.correlation > .999);
  const equal = compareWaveforms(ref, ref); assert.equal(equal.offsetSeconds, 0); assert.ok(equal.correlation > .999);
});

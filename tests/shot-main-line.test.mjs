import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildNarrationPlan, narrationSha, planPath, statePath, timingsFromPlan} from '../scripts/lib/shot-narration.mjs';
import {deliveryProblems, finalCheck, materialsUsed, writePackage} from '../scripts/lib/shot-package.mjs';

// Main line integration (SKILL.md): the narration bridge, the delivery package and the cloud guard.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beats = [
  {id: 'b1', narration: '苹果把 Siri 重做了一遍。', rung: 'image', material: 'a', move: 'push', why: 'x'},
  {id: 'b2', narration: '页面上的口号很直白：真正有用，真正属于你。', rung: 'image', material: 'b', move: 'hold', why: 'x'},
];
const script = (over = {}) => ({title: '测试片', topic: '测试', beats, publish: {douyin: {title: '抖音标题', body: '抖音正文', tags: ['a']}, channels: {title: '视频号标题', body: '视频号正文', tags: ['b']}}, provenance: {a: '自有素材', b: '自有素材'}, ...over});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'svm-main-'));

test('narration bridge: beats become scenes, phrases reproduce the text, timings come back only for current narration', () => {
  const plan = buildNarrationPlan(script());
  assert.equal(plan.scenes.length, 2);
  assert.equal(plan.scenes[1].captionIds.length >= 2, true, 'a long beat splits into phrase captions');
  assert.equal(plan.captions.map((c) => c.text).join('').replace(/[^一-鿿A-Za-z0-9]/g, ''), beats.map((b) => b.narration).join('').replace(/[^一-鿿A-Za-z0-9]/g, ''));
  assert.equal(plan.meta.width, 1080); assert.equal(plan.meta.height, 1920);
  const job = tmp();
  try {
    fs.mkdirSync(path.join(job, 'narration/audio'), {recursive: true});
    const done = {...plan, audio: {...plan.audio, voiceover: 'audio/voiceover.mp3', timingSource: 'provider-matched'}};
    done.scenes[0].start = 0; done.scenes[0].end = 2.5; done.scenes[1].start = 2.5; done.scenes[1].end = 7;
    fs.writeFileSync(planPath(job), JSON.stringify(done)); fs.writeFileSync(path.join(job, 'narration/audio/voiceover.mp3'), 'x');
    assert.throws(() => timingsFromPlan(job, script()), /out of date/, 'no state, no trust');
    fs.writeFileSync(statePath(job), JSON.stringify({narrationSha256: narrationSha(script()), normalized: false}));
    const t = timingsFromPlan(job, script());
    assert.deepEqual(t.timing.spans, [{start: 0, end: 2.5}, {start: 2.5, end: 7}]);
    assert.equal(t.audio, 'narration/audio/voiceover.mp3');
    fs.writeFileSync(path.join(job, 'narration/audio/voiceover-norm.wav'), 'x'); fs.writeFileSync(statePath(job), JSON.stringify({narrationSha256: narrationSha(script()), normalized: true}));
    assert.equal(timingsFromPlan(job, script()).audio, 'narration/audio/voiceover-norm.wav', 'the levelled copy is what plays');
    const changed = script({beats: [{...beats[0], narration: '苹果把 Siri 重做了两遍。'}, beats[1]]});
    assert.throws(() => timingsFromPlan(job, changed), /out of date/);
  } finally { fs.rmSync(job, {recursive: true, force: true}); }
});

test('delivery: publish copy per platform and a rights note for every picture are required', () => {
  const m = (over = {}) => ({id: 'a', file: 'assets/a.png', rights: 'noted', ...over});
  assert.deepEqual(deliveryProblems(script(), [m()]), []);
  assert.match(deliveryProblems(script({publish: {}}), [m()]).join('|'), /publish.douyin/);
  const same = script(); same.publish.channels = {...same.publish.douyin};
  assert.match(deliveryProblems(same, [m()]).join('|'), /identical/);
  const long = script(); long.publish.douyin.title = '字'.repeat(31);
  assert.match(deliveryProblems(long, [m()]).join('|'), /within 30/);
  assert.match(deliveryProblems(script(), [m({rights: 'unknown'})]).join('|'), /no rights note/);
  assert.match(deliveryProblems(script(), [m({file: null})]).join('|'), /not on disk/);
});

test('delivery: provenance comes from the research records, and the package lists everything', () => {
  const job = tmp();
  try {
    fs.mkdirSync(path.join(job, 'research'), {recursive: true}); fs.mkdirSync(path.join(job, 'assets/official'), {recursive: true});
    fs.writeFileSync(path.join(job, 'assets/official/a.png'), 'pic'); fs.writeFileSync(path.join(job, 'assets/b.png'), 'pic2');
    fs.writeFileSync(path.join(job, 'research/sources.json'), JSON.stringify({sources: [{id: 's1', url: 'https://example.com/p', title: '官方页'}]}));
    fs.writeFileSync(path.join(job, 'research/downloads.json'), JSON.stringify({downloads: [{sourceId: 's1', mediaId: 'a', file: 'assets/official/a.png', finalUrl: 'https://example.com/a.png', rightsNote: '新闻稿素材包', relevanceReason: '主视觉'}]}));
    const inv = new Map([['a', {id: 'a', file: 'assets/official/a.png', kind: 'image', origin: 'official'}], ['b', {id: 'b', file: 'assets/b.png', kind: 'image', origin: 'local-unrecorded'}]]);
    const mats = materialsUsed(job, script(), inv);
    assert.equal(mats.find((x) => x.id === 'a').sourceUrl, 'https://example.com/a.png');
    assert.equal(mats.find((x) => x.id === 'a').rightsNote, '新闻稿素材包');
    assert.equal(mats.find((x) => x.id === 'b').rights, 'noted', 'a provenance note in the script counts');
    const bare = materialsUsed(job, script({provenance: {}}), inv);
    assert.equal(bare.find((x) => x.id === 'b').rights, 'unknown');
    const film = {fps: 30, durationInFrames: 210, captions: [{start: 0, end: 2.5, text: '苹果把 Siri 重做了一遍。'}], shots: [{start: 0, end: 2.5}, {start: 2.5, end: 7}]};
    const out = path.join(job, 'output'); fs.mkdirSync(out); fs.writeFileSync(path.join(out, 'video.mp4'), 'v');
    const meta = writePackage({job, script: script(), film, materials: mats, outDir: out, narration: {provider: 'local'}, review: {verdict: 'ready-for-user'}, bgm: {src: 'audio/x.wav', synthetic: true, targetLufs: -32}});
    for (const f of ['script.md', 'captions.srt', 'captions.json', 'publish.md', 'sources.md', 'metadata.json']) assert.ok(fs.existsSync(path.join(out, f)), f);
    assert.match(fs.readFileSync(path.join(out, 'publish.md'), 'utf8'), /## 视频号[\s\S]*#b/);
    assert.equal(meta.materials.length, 2); assert.equal(meta.music.synthetic, true); assert.ok(meta.files['video.mp4'].sha256);
  } finally { fs.rmSync(job, {recursive: true, force: true}); }
});

const hasFfmpeg = (() => { try { return spawnSync('ffmpeg', ['-version']).status === 0; } catch { return false; } })();
test('final check: a 1080x1920 30 fps file with audio passes, a wrong size fails', {skip: !hasFfmpeg && 'FFmpeg is not available'}, () => {
  const dir = tmp();
  try {
    const make = (name, size) => { const f = path.join(dir, name); const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=s=${size}:r=30:d=3`, '-f', 'lavfi', '-i', 'sine=f=300:d=3', '-shortest', '-pix_fmt', 'yuv420p', '-c:a', 'aac', f]); assert.equal(r.status, 0); return f; };
    const film = {fps: 30, durationInFrames: 90};
    const status = (c, id) => c.find((x) => x.id === id).status;
    const good = finalCheck(make('good.mp4', '1080x1920'), film);
    assert.deepEqual(['size', 'fps', 'audio', 'duration', 'avSync'].map((id) => status(good, id)), ['pass', 'pass', 'pass', 'pass', 'pass']);
    assert.equal(status(finalCheck(make('bad.mp4', '540x960'), film), 'size'), 'fail');
    assert.equal(status(finalCheck(make('long.mp4', '1080x1920'), {fps: 30, durationInFrames: 150}), 'duration'), 'fail');
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('make-shot-film: an online voice is refused without --allow-cloud, before any text leaves the machine', () => {
  const job = tmp();
  try {
    fs.mkdirSync(path.join(job, 'research'), {recursive: true});
    const item = (id) => ({id, status: 'on-disk', kind: 'image', moving: false, grade: 'A', file: `assets/${id}.png`, width: 1080, height: 1920, rights: 'noted', reasons: []});
    fs.writeFileSync(path.join(job, 'research/visual-inventory.json'), JSON.stringify({items: [item('a'), item('b')]}));
    fs.writeFileSync(path.join(job, 'shot-script.json'), JSON.stringify(script()));
    const r = spawnSync(process.execPath, [path.join(root, 'scripts/make-shot-film.mjs'), job, '--provider=edge'], {encoding: 'utf8', timeout: 60000});
    assert.equal(r.status, 3, r.stderr);
    assert.match(r.stderr, /sends the narration text to an online service/);
    assert.ok(!fs.existsSync(path.join(job, 'narration/state.json')));
    assert.ok(!fs.existsSync(path.join(job, 'narration/audio/voiceover.mp3')));
  } finally { fs.rmSync(job, {recursive: true, force: true}); }
});

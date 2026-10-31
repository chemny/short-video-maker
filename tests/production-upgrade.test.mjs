import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import {alignCaptions} from '../scripts/lib/alignment.mjs';
import {auditProduction, sha256} from '../scripts/lib/production-audit.mjs';
import {fetchPublic, validatePublicUrl} from '../scripts/lib/official-sources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const workspace = (t) => {const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'production-upgrade-'))); t.after(() => fs.rmSync(dir, {recursive: true, force: true})); return dir;};
const command = (bin, args) => execFileSync(bin, args, {encoding: 'utf8', stdio: 'pipe', timeout: 120000});
const cli = (name, args) => command(process.execPath, [path.join(root, 'scripts', name), ...args]);
const ffmpeg = (args) => command('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-y', ...args]);
const plan = () => {
  const value = JSON.parse(fs.readFileSync(path.join(root, 'examples/material-plan.json')));
  value.style.template = 'responsive-report'; value.scenes[0].layout = 'text-card'; delete value.scenes[0].visual;
  return value;
};
const captions = [{id: 'a', text: 'Hello world.', start: 0, end: 1.5}, {id: 'b', text: 'Video works.', start: 1.5, end: 3}];
const words = [{word: 'Hello', start: 0.2, end: 0.6, probability: 0.99}, {word: 'world', start: 0.6, end: 1, probability: 0.98},
  {word: 'Video', start: 2, end: 2.3, probability: 0.99}, {word: 'works', start: 2.3, end: 2.8, probability: 0.99}];

test('ASR matching follows observed boundaries and flags missing/repeated/uncertain speech', () => {
  const transcript = {words, text: 'Hello world. Video works.'};
  const result = alignCaptions(captions, transcript, 3);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.proposed.map(({start, end}) => ({start, end})), [{start: 0.2, end: 1}, {start: 2, end: 2.8}]);
  const missing = alignCaptions(captions, {...transcript, words: words.filter((w) => w.word !== 'Video')}, 3);
  assert.ok(missing.issues.some((i) => i.code === 'missing-or-misread-text'));
  const extra = alignCaptions(captions, {words: [...words, {word: 'again', start: 2.8, end: 2.99, probability: 0.99}]}, 3);
  assert.ok(extra.issues.some((i) => i.code === 'extra-or-repeated-speech'));
  const uncertain = alignCaptions(captions, {words: words.map((w, i) => ({...w, probability: i ? w.probability : 0.1}))}, 3);
  assert.equal(uncertain.status, 'needs-review');
  const ambiguous = alignCaptions(captions, {words: words.map((w, i) => i ? w : {...w, end: w.start})}, 3);
  assert.ok(ambiguous.issues.some((i) => i.code === 'ambiguous-zero-duration-boundary'));
});

test('Chinese matching normalization preserves authored display text and does not equate homophones', () => {
  const caption = [{id: 'zh', text: '欢迎来这里', start: 0, end: 2}];
  const transcript = {words: [{word: '歡迎來這裡', start: 0.2, end: 1.8, probability: 0.99}]};
  const result = alignCaptions(caption, transcript, 2, {captionTexts: ['欢迎来这里'], wordTexts: ['欢迎来这里']});
  assert.equal(result.status, 'matched'); assert.equal(result.proposed[0].text, '欢迎来这里');
  const homophone = alignCaptions([{id: 'x', text: '示意'}], {words: [{word: '事业', start: 0.2, end: 1.8, probability: 0.99}]}, 2);
  assert.equal(homophone.status, 'needs-review');
});

test('alignment apply is explicit, source-bound and rejects stale evidence without modifying failed plans', (t) => {
  const dir = workspace(t); const file = path.join(dir, 'video-plan.json'); const voice = path.join(dir, 'voice.wav');
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=700:duration=3', voice]);
  const value = plan(); value.meta.language = 'en-US'; value.captions = captions;
  value.scenes = captions.map((c, i) => ({...value.scenes[0], id: `scene-${i}`, start: c.start, end: c.end, voiceover: c.text, caption: c.text, transition: 'cut', captionIds: [c.id]}));
  write(file, value);
  const transcript = path.join(dir, 'transcript.json');
  write(transcript, {words, text: 'Hello world. Video works.', audioSha256: sha256(fs.readFileSync(voice)), engine: 'fixture-real-boundary-contract'});
  const args = [file, `--audio=${voice}`, `--transcript=${transcript}`];
  const before = fs.readFileSync(file, 'utf8'); cli('align-narration.mjs', args);
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'Report-only must not mutate plan');
  cli('align-narration.mjs', [...args, '--apply']);
  const aligned = JSON.parse(fs.readFileSync(file));
  assert.equal(aligned.scenes[1].start, 2);
  assert.equal(aligned.captions[0].text, captions[0].text);
  assert.equal(aligned.audio.timingSource, 'asr-matched');
  assert.deepEqual(auditProduction(aligned, dir).errors, []);
  cli('align-narration.mjs', [file, `--transcript=${transcript}`, '--apply']);
  assert.equal(JSON.parse(fs.readFileSync(file)).audio.voiceover, aligned.audio.voiceover, 'Repeated application must reuse the immutable narration snapshot');
  const materials = workspace(t); fs.copyFileSync(voice, path.join(materials, 'voice.wav'));
  cli('import-media.mjs', [dir, `--input-dir=${materials}`, '--narration=voice.wav', '--music=none']);
  assert.equal(JSON.parse(fs.readFileSync(file)).audio.timingSource, 'asr-matched', 'Importing the identical audio must retain valid ASR provenance');
  aligned.captions[0].end = 1.1;
  assert.ok(auditProduction(aligned, dir).errors.some((e) => e.includes('stale')));
  write(transcript, {words: words.slice(0, 3), audioSha256: sha256(fs.readFileSync(voice))});
  const saved = fs.readFileSync(file, 'utf8');
  assert.notEqual(spawnSync(process.execPath, [path.join(root, 'scripts/align-narration.mjs'), ...args, '--apply']).status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), saved);
});

test('clip selection enforces window/audio controls and does not alter source media', (t) => {
  const dir = workspace(t); const file = path.join(dir, 'video-plan.json');
  const video = path.join(dir, 'input.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video]);
  const before = sha256(fs.readFileSync(video)); const value = plan(); write(file, value);
  const map = path.join(dir, 'map.json'); write(map, {'scene-01': {file: video, sourceStart: 1, fit: 'contain'}});
  cli('import-clips.mjs', [file, map]);
  const selected = JSON.parse(fs.readFileSync(file));
  assert.equal(selected.scenes[0].visual.kind, 'video'); assert.equal(selected.scenes[0].visual.sourceVolume, 0);
  assert.deepEqual(auditProduction(selected, dir).errors, []);
  selected.scenes[0].visual.sourceStart = 1.2;
  assert.ok(auditProduction(selected, dir).errors.some((e) => e.includes('too short')));
  write(map, {'scene-01': {file: video, sourceStart: 1, sourceVolume: 0.5}});
  assert.notEqual(spawnSync(process.execPath, [path.join(root, 'scripts/import-clips.mjs'), file, map]).status, 0);
  assert.equal(sha256(fs.readFileSync(video)), before);
});

test('research audit verifies quote/asset provenance and invalidates editorial review on changed plans', (t) => {
  const dir = workspace(t); const research = path.join(dir, 'research'); fs.mkdirSync(research);
  const value = plan(); value.meta.productionMode = 'researched';
  const text = 'Official documentation supports this specific statement.';
  fs.writeFileSync(path.join(research, 'source.txt'), text);
  write(path.join(research, 'sources.json'), {sources: [{id: 'official', textFile: 'research/source.txt', textSha256: sha256(text)}]});
  write(path.join(research, 'claims.json'), {claims: [{id: 'claim', sourceId: 'official', reviewed: true, evidenceQuote: 'supports this specific statement'}]});
  value.scenes[0].evidence = {claimIds: ['claim'], sourceIds: ['official'], visualReason: 'Authored explanation', visualOrigin: 'authored'};
  assert.deepEqual(auditProduction(value, dir).errors, []);
  const checks = Object.fromEntries(['narrationIntelligible', 'captionSync', 'visualRelevance', 'layoutReadable', 'tailIntentional'].map((k) => [k, true]));
  write(path.join(dir, 'editorial-review.json'), {planSha256: sha256(JSON.stringify(value)), reviewer: 'test reviewer', notes: 'Test assertion only', checks});
  assert.equal(auditProduction(value, dir).contentApproved, true);
  value.scenes[0].body = 'Changed after review';
  assert.equal(auditProduction(value, dir).contentApproved, false);
  fs.writeFileSync(path.join(research, 'source.txt'), 'Different evidence now');
  assert.ok(auditProduction(value, dir).errors.some((e) => e.includes('stale')));
});

test('official fetch handles redirects, bounds response size and rejects private/unapproved URLs', async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') {res.writeHead(302, {location: '/page'}); res.end();}
    else if (req.url === '/external') {res.writeHead(302, {location: 'http://localhost/page'}); res.end();}
    else if (req.url === '/large') {res.writeHead(200); res.end('x'.repeat(5000));}
    else {res.writeHead(200, {'content-type': 'text/html'}); res.end('<h1>Official fixture page</h1>');}
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections(); server.close();});
  const url = `http://127.0.0.1:${server.address().port}`;
  const result = await fetchPublic(`${url}/redirect`, ['127.0.0.1'], {allowLocal: true});
  assert.ok(result.url.endsWith('/page'));
  await assert.rejects(fetchPublic(`${url}/external`, ['127.0.0.1'], {allowLocal: true}), /not approved/);
  await assert.rejects(fetchPublic(`${url}/large`, ['127.0.0.1'], {allowLocal: true, maxBytes: 200}), /exceeds/);
  const head = await fetchPublic(`${url}/large`, ['127.0.0.1'], {allowLocal: true, maxBytes: 200, method: 'HEAD'});
  assert.equal(head.body.length, 0);
  await assert.rejects(validatePublicUrl(`${url}/page`, ['127.0.0.1']), /non-public/);
  await assert.rejects(validatePublicUrl('file:///etc/passwd', ['example.com']), /HTTP/);
});

test('aspect adaptation creates independent variants and does not copy stale reviews or outputs', (t) => {
  const dir = workspace(t); const source = path.join(dir, 'source'); fs.mkdirSync(source);
  const file = path.join(source, 'video-plan.json'); write(file, plan()); fs.mkdirSync(path.join(source, 'output'));
  fs.writeFileSync(path.join(source, 'output/video.mp4'), 'old delivery'); write(path.join(source, 'editorial-review.json'), {approved: true});
  for (const [aspect, dimensions] of Object.entries({'9:16': [1080, 1920], '3:4': [1080, 1440], '16:9': [1920, 1080]})) {
    const target = path.join(dir, aspect.replace(':', '-')); cli('adapt-aspect.mjs', [file, target, aspect]);
    const adapted = JSON.parse(fs.readFileSync(path.join(target, 'video-plan.json')));
    assert.deepEqual([adapted.meta.width, adapted.meta.height], dimensions);
    assert.equal(adapted.style.template, 'responsive-report');
    assert.equal(fs.existsSync(path.join(target, 'output')), false);
    assert.equal(fs.existsSync(path.join(target, 'editorial-review.json')), false);
  }
  assert.ok(fs.existsSync(path.join(source, 'output/video.mp4')));
});

test('strict delivery review is bound to the actual plan and video bytes', (t) => {
  const dir = workspace(t); const file = path.join(dir, 'video-plan.json'); const value = plan();
  const video = path.join(dir, 'video.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=orange:s=320x180:r=30:d=3', '-f', 'lavfi', '-i', 'sine=frequency=700:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video]);
  value.meta.width = 320; value.meta.height = 180; value.cover.introSeconds = 0; write(file, value);
  const args = [file, dir, '--require-render', '--require-content-review'];
  const check = () => spawnSync(process.execPath, [path.join(root, 'scripts/quality-check.mjs'), ...args]);
  assert.notEqual(check().status, 0);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'quality-report.json')));
  const checks = Object.fromEntries(report.production.checks.editorial.requiredChecks.map((k) => [k, true]));
  write(path.join(dir, 'editorial-review.json'), {planSha256: report.production.checks.editorial.planSha256, videoSha256: report.production.checks.editorial.videoSha256, reviewer: 'fixture-reviewer', notes: 'Fixture assertions only; not a real editorial approval', checks});
  assert.equal(check().status, 0);
  fs.appendFileSync(video, Buffer.from([0]));
  assert.notEqual(check().status, 0, 'Different video bytes must invalidate old review');
});

test('source extraction ignores scripts and inventories embedded/direct video candidates', () => {
  const html = '<title>Official demo</title><script>ignore this claim</script><style>ignore styles</style><p>Documented demo</p><video src="/demo.mp4"></video><iframe src="https://player.example.com/embed/1"></iframe><a href="/clip.webm">download</a>';
  const result = JSON.parse(execFileSync('python3', [path.join(root, 'scripts/extract-source.py'), 'https://official.example.com/page'], {input: html}).toString());
  assert.ok(!result.text.includes('ignore'));
  assert.ok(result.media.some((m) => m.url === 'https://official.example.com/demo.mp4'));
  assert.ok(result.media.some((m) => m.tag === 'iframe'));
  assert.ok(result.media.some((m) => m.url.endsWith('/clip.webm')));
});

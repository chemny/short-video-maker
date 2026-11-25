import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {gradeCandidate, gradeFile, rate, buildInventory} from '../scripts/lib/visual-inventory.mjs';
import {scrollPath, defaultBrowser, recordScroll} from '../scripts/lib/page-recorder.mjs';

// Visual inventory (references/quality-bar.md, step 2): candidates and files are graded, a poor topic is flagged before scripting.
test('visual inventory: candidates are graded from kind and text, never above B', () => {
  assert.equal(gradeCandidate({url: 'https://x.com/logo.svg', tag: 'img'}).grade, 'X');
  assert.equal(gradeCandidate({url: 'https://x.com/nav-icon.png', tag: 'img', alt: 'menu icon'}).grade, 'X');
  assert.equal(gradeCandidate({url: 'https://x.com/demo.mp4', tag: 'video', type: 'video/mp4'}).grade, 'B');
  assert.equal(gradeCandidate({url: 'https://x.com/a.jpg', tag: 'img', alt: 'Product screenshot of the app'}).grade, 'B');
  assert.equal(gradeCandidate({url: 'https://x.com/a.jpg', tag: 'img', alt: ''}).grade, 'C');
});

test('visual inventory: file grades follow resolution, duration and acquisition', () => {
  assert.equal(gradeFile({kind: 'image', width: 2000, height: 1200}).grade, 'A');
  assert.equal(gradeFile({kind: 'image', width: 1000, height: 800}).grade, 'B');
  assert.equal(gradeFile({kind: 'image', width: 800, height: 600}).grade, 'C');
  assert.equal(gradeFile({kind: 'image', width: 300, height: 200}).grade, 'X');
  assert.equal(gradeFile({kind: 'video', width: 1920, height: 1080, duration: 8}).grade, 'A');
  assert.equal(gradeFile({kind: 'video', width: 1920, height: 1080, duration: 1}).grade, 'C');
  assert.equal(gradeFile({kind: 'image', width: 1440, height: 1000}, {tag: 'page-capture'}).grade, 'C');
  assert.equal(gradeFile({kind: 'video', width: 1080, height: 1920, duration: 6}, {acquisition: 'isolated-headless-Chrome-scroll-recording'}).grade, 'B');
});

test('visual inventory: rating needs enough usable pictures and at least one moving one', () => {
  const still = (n) => Array.from({length: n}, (_, i) => ({id: `i${i}`, status: 'on-disk', grade: 'A', moving: false}));
  assert.equal(rate([]).rating, 'poor');
  assert.equal(rate(still(4)).rating, 'medium');
  assert.equal(rate(still(9)).rating, 'medium', 'nine stills and no footage is not rich');
  assert.equal(rate([...still(8), {id: 'v', status: 'candidate', grade: 'B', moving: true}]).rating, 'rich');
  assert.equal(rate([{id: 'x', status: 'on-disk', grade: 'X', moving: false}]).rating, 'poor');
  const cands = (n) => Array.from({length: n}, (_, i) => ({id: `c${i}`, status: 'candidate', grade: 'B', moving: i === 0}));
  assert.equal(rate(cands(8)).rating, 'medium', 'undownloaded candidates count half');
  assert.equal(rate(cands(16)).rating, 'rich');
  assert.match(rate([]).note, /before writing the script/);
});

test('visual inventory: a job with records and an unrecorded local file lists both with their rights', () => {
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-inv-'));
  try {
    fs.mkdirSync(path.join(job, 'research'), {recursive: true});
    fs.writeFileSync(path.join(job, 'research/sources.json'), JSON.stringify({sources: [{id: 's1', url: 'https://a.example.com/', officialDomains: ['example.com'],
      mediaCandidates: [{id: 's1-media-1', url: 'https://a.example.com/hero-demo.mp4', tag: 'video', type: 'video/mp4'}, {id: 's1-media-2', url: 'https://a.example.com/logo.png', tag: 'img', alt: 'logo'}]}]}));
    fs.writeFileSync(path.join(job, 'research/downloads.json'), JSON.stringify({downloads: [{sourceId: 's1', mediaId: 's1-media-9', file: 'assets/official/gone.png', kind: 'image', width: 2000, height: 1000, finalUrl: 'https://a.example.com/x.png', rightsNote: 'press kit'}]}));
    const items = buildInventory(job);
    assert.equal(items.find((i) => i.id === 's1-media-1').status, 'candidate');
    assert.equal(items.find((i) => i.id === 's1-media-2').grade, 'X');
    assert.equal(items.find((i) => i.id === 's1-media-9').status, 'missing-file');
    assert.equal(rate(items).usable, 1);
  } finally { fs.rmSync(job, {recursive: true, force: true}); }
});

test('page recorder: scroll path holds, eases and never overshoots', () => {
  const p = scrollPath({travel: 600, seconds: 4, fps: 10, holdSeconds: 0.5});
  assert.equal(p.length, 40);
  assert.equal(p[0], 0);
  assert.equal(p.at(-1), 600);
  assert.ok(p.every((v, i) => i === 0 || v >= p[i - 1]), 'monotonic');
  assert.ok(p.slice(0, 5).every((v) => v === 0), 'holds at the start');
});

const ready = (() => { try { execFileSync('ffmpeg', ['-version'], {stdio: 'ignore'}); return fs.existsSync(defaultBrowser()); } catch { return false; } })();
test('page recorder: records a tall local page as a 1080x1920 video', {skip: !ready && 'Chrome or FFmpeg is not available'}, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-rec-'));
  try {
    const html = path.join(dir, 'p.html'), out = path.join(dir, 'o.mp4');
    fs.writeFileSync(html, `<!doctype html><meta name=viewport content="width=device-width"><body style="margin:0">${'<section style="height:600px;background:#ddd;border-bottom:4px solid #999">x</section>'.repeat(8)}`);
    const r = await recordScroll({url: `file://${html}`, outFile: out, seconds: 2, fps: 10, settleMs: 300});
    assert.equal(r.width, 1080); assert.equal(r.height, 1920); assert.equal(r.frames, 20);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', out]).toString()).streams[0];
    assert.equal(probe.width, 1080); assert.equal(probe.height, 1920);
    const flat = path.join(dir, 'flat.html');
    fs.writeFileSync(flat, '<!doctype html><meta name=viewport content="width=device-width"><body>short</body>');
    await assert.rejects(() => recordScroll({url: `file://${flat}`, outFile: out, seconds: 2, fps: 10, settleMs: 200}), /scrolls only/);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

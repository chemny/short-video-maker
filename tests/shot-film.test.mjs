import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {splitPhrases, estimateTimings, alignTimings, compileFilm} from '../scripts/lib/shot-film.mjs';

// Compiling a shot script into the ShotFilm props: timing from estimates or aligned captions, media must exist on disk.
const beats = [{id: 'a', narration: '苹果把助手重做了一遍。'}, {id: 'b', narration: '它能找到你几年前的照片，也能翻出邮件。'}];

test('shot film: phrases are split at punctuation and tiny pieces are merged', () => {
  const p = splitPhrases('它能找到你几年前的照片，也能翻出收件箱里的邮件，还有很久以前的备忘录。');
  assert.ok(p.length >= 2 && p.every((x) => x.replace(/[^一-鿿]/g, '').length >= 7));
  assert.equal(splitPhrases('短。').length, 1);
});

test('shot film: estimated timings are contiguous and cover each beat', () => {
  const t = estimateTimings(beats);
  assert.equal(t.spans[0].start, 0);
  assert.ok(Math.abs(t.spans[0].end - t.spans[1].start) < 1e-9);
  assert.ok(t.captions.at(-1).end - t.spans.at(-1).end < 1e-9);
  assert.equal(t.source, 'estimated');
});

test('shot film: aligned captions are handed to beats by characters, mismatches are refused', () => {
  const caps = [{start: 0.2, end: 2.0, text: '苹果把助手重做了一遍'}, {start: 2.2, end: 4.0, text: '它能找到你几年前的照片'}, {start: 4.1, end: 5.5, text: '也能翻出邮件'}];
  const t = alignTimings(beats, caps);
  assert.deepEqual(t.spans, [{start: 0.2, end: 2.0}, {start: 2.2, end: 5.5}]);
  assert.throws(() => alignTimings(beats, caps.slice(0, 2)), /do not cover|differ/);
  assert.throws(() => alignTimings(beats, [...caps, {start: 6, end: 7, text: '多出来的一句'}]), /continue after/);
});

test('shot film: media must be on disk, diagrams have no renderer, and a good script compiles', () => {
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-film-'));
  try {
    fs.mkdirSync(path.join(job, 'research'), {recursive: true}); fs.mkdirSync(path.join(job, 'assets'));
    fs.writeFileSync(path.join(job, 'assets/a.png'), 'x');
    const item = (id, over) => ({id, status: 'on-disk', kind: 'image', moving: false, grade: 'A', file: `assets/${id}.png`, width: 1080, height: 1920, rights: 'noted', reasons: [], ...over});
    fs.writeFileSync(path.join(job, 'research/visual-inventory.json'), JSON.stringify({items: [item('a', {file: 'assets/a.png'}), item('gone'), item('cand', {status: 'candidate', file: undefined})]}));
    const beat = (id, material, over = {}) => ({id, narration: '苹果把助手重做了一遍。', rung: 'image', material, move: 'push', why: '官方页面的主视觉', ...over});
    const write = (bs) => fs.writeFileSync(path.join(job, 'shot-script.json'), JSON.stringify({beats: bs}));
    write([beat('b1', 'a'), beat('b2', 'a', {move: 'hold', narration: '它能找到你几年前的照片。'})]);
    const {film, timingSource} = compileFilm(job);
    assert.equal(film.shots.length, 2); assert.equal(timingSource, 'estimated');
    assert.equal(film.shots[0].media.src, 'assets/a.png');
    assert.equal(film.durationInFrames, Math.ceil(film.shots.at(-1).end * 30));
    write([beat('b1', 'gone'), beat('b2', 'cand', {move: 'hold', narration: '它能找到你几年前的照片。'})]);
    assert.throws(() => compileFilm(job), /not on disk/);
    write([beat('b1', 'a'), beat('b2', 'a', {move: 'hold', narration: '它能找到你几年前的照片。'}), beat('b3', null, {rung: 'diagram', move: 'hold', noMaterialReason: '无', narration: '再加上一个很短的图解。'})]);
    assert.throws(() => compileFilm(job), /diagram beats have no renderer/);
    write([beat('b1', 'a', {move: 'focus'})]);
    assert.throws(() => compileFilm(job), /needs region/);
  } finally { fs.rmSync(job, {recursive: true, force: true}); }
});

test('shot film: the picture is never empty, shots are contiguous from zero even when speech has gaps', () => {
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-gap-'));
  try {
    fs.mkdirSync(path.join(job, 'research'), {recursive: true}); fs.mkdirSync(path.join(job, 'assets'));
    for (const m of ['a', 'b', 'c']) fs.writeFileSync(path.join(job, `assets/${m}.png`), 'x');
    fs.writeFileSync(path.join(job, 'research/visual-inventory.json'), JSON.stringify({items: ['a', 'b', 'c'].map((m) => ({id: m, status: 'on-disk', kind: 'image', grade: 'A', file: `assets/${m}.png`, width: 1080, height: 1920, rights: 'noted', reasons: []}))}));
    const beat = (id, n, move) => ({id, narration: n, rung: 'image', material: {b1: 'a', b2: 'b', b3: 'c'}[id], move, why: '官方页面的主视觉', ...(move === 'highlight' ? {region: {x: 0.2, y: 0.3, w: 0.5, h: 0.2}} : {})});
    fs.writeFileSync(path.join(job, 'shot-script.json'), JSON.stringify({hook: {lines: [{text: '重做的助手', at: 0.1}]}, bgm: {file: 'nope.mp3'}, beats: [beat('b1', '苹果把助手重做了一遍。', 'push'), beat('b2', '它能找到你几年前的照片。', 'highlight'), beat('b3', '还能在应用里替你操作。', 'pull')]}));
    const caps = path.join(job, 'caps.json');
    fs.writeFileSync(caps, JSON.stringify([{start: 0.4, end: 2.0, text: '苹果把助手重做了一遍'}, {start: 2.3, end: 4.1, text: '它能找到你几年前的照片'}, {start: 4.5, end: 6.0, text: '还能在应用里替你操作'}]));
    assert.throws(() => compileFilm(job, {captionsFile: caps}), /bgm file not found/);
    fs.writeFileSync(path.join(job, 'shot-script.json'), JSON.stringify({hook: {lines: [{text: '重做的助手', at: 0.1}]}, beats: [beat('b1', '苹果把助手重做了一遍。', 'push'), beat('b2', '它能找到你几年前的照片。', 'highlight'), beat('b3', '还能在应用里替你操作。', 'pull')]}));
    const {film} = compileFilm(job, {captionsFile: caps});
    assert.equal(film.shots[0].start, 0);
    for (let i = 1; i < film.shots.length; i++) assert.equal(film.shots[i].start, film.shots[i - 1].end);
    assert.ok(film.shots.at(-1).end >= 6.0);
    assert.equal(film.hook.lines.length, 1);
    assert.deepEqual(film.sfx.map((e) => e.kind), ['thump', 'click']);
    assert.ok(film.sfx.every((e, i, a) => i === 0 || e.t >= a[i - 1].t));
    assert.ok(film.shots.every((s) => s.transition === 'cut'));
  } finally { fs.rmSync(job, {recursive: true, force: true}); }
});

test('shot film: backdrops come from the picture colours and pictures that leave room alternate above and below the middle', async () => {
  const {cornerPalette} = await import('../scripts/lib/media-palette.mjs');
  const {spawnSync} = await import('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-pal-'));
  try {
    const png = path.join(dir, 'p.png');
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xff0000:s=64x64,drawbox=x=32:y=0:w=32:h=64:color=0x0000ff:t=fill', '-frames:v', '1', png]);
    assert.equal(r.status, 0);
    const pal = cornerPalette(png);
    assert.equal(pal.length, 4);
    assert.ok(parseInt(pal[0].slice(1, 3), 16) > 200 && parseInt(pal[1].slice(5, 7), 16) > 200, `left red, right blue: ${pal}`);
    assert.equal(cornerPalette(path.join(dir, 'missing.png')), null);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

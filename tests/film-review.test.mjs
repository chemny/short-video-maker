import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {SAMPLE, audioStats, checkRecord, contrastWhite, evaluate, extractGray, measureFrames, reviewTemplate, verdict, JUDGEMENTS} from '../scripts/lib/film-review.mjs';

// Review loop (references/quality-bar.md): measurements refuse, only a current frame review approves.
const m = (t, over = {}) => ({t, mean: 120, diff: 3, captionLuma: 40, ...over});
const steady = (n, over) => Array.from({length: n}, (_, i) => m(i / 2, over));
const status = (checks, id) => checks.find((c) => c.id === id)?.status;
const film = {captions: [{start: 0, end: 20, text: 'x'}], shots: [{id: 'a', start: 0, end: 5}, {id: 'b', start: 5, end: 10}]};

test('film review: blank, stalled, low-contrast and slow-to-change films are caught', () => {
  assert.equal(status(evaluate({measures: steady(20), film}), 'blank'), 'pass');
  assert.equal(status(evaluate({measures: [...steady(5), m(2.5, {mean: 2})], film}), 'blank'), 'fail');
  const still = steady(20, {diff: 0.05}); still[0].diff = 0;
  assert.equal(status(evaluate({measures: still, film}), 'static'), 'fail');
  assert.equal(status(evaluate({measures: steady(20), film}), 'static'), 'pass');
  assert.equal(status(evaluate({measures: steady(20, {captionLuma: 230}), film}), 'contrast'), 'fail');
  assert.equal(status(evaluate({measures: steady(20, {captionLuma: 40}), film}), 'contrast'), 'pass');
  const late = steady(20, {diff: 1}); late[16].diff = 30;
  assert.equal(status(evaluate({measures: late, film}), 'firstChange'), 'fail');
  assert.equal(status(evaluate({measures: steady(20, {diff: 8}), film}), 'firstChange'), 'pass');
  assert.equal(status(evaluate({measures: steady(20), film}), 'firstChange'), 'fail', 'a film that never visibly changes fails');
  assert.ok(contrastWhite(0) > 15 && contrastWhite(255) < 1.1);
});

test('film review: a still shot that runs long on the aligned timeline is caught', () => {
  const mk = (len) => ({captions: [], shots: [{id: 'a', start: 0, end: len, rung: 'image'}, {id: 'v', start: len, end: len + 30, rung: 'recording'}]});
  assert.equal(status(evaluate({measures: steady(10), film: mk(6)}), 'shotLength'), 'pass');
  assert.equal(status(evaluate({measures: steady(10), film: mk(9)}), 'shotLength'), 'warn');
  assert.equal(status(evaluate({measures: steady(10), film: mk(13)}), 'shotLength'), 'fail', 'footage shots are exempt, stills are not');
});

test('film review: loudness, peak and silence', () => {
  const ok = evaluate({measures: steady(10), film, audio: {lufs: -14, peak: -2, silences: []}});
  assert.deepEqual(['loudness', 'peak', 'silence'].map((id) => status(ok, id)), ['pass', 'pass', 'pass']);
  const bad = evaluate({measures: steady(10), film, audio: {lufs: -25, peak: 0.6, silences: [{at: 3, seconds: 2}]}});
  assert.deepEqual(['loudness', 'peak', 'silence'].map((id) => status(bad, id)), ['warn', 'fail', 'warn']);
});

test('film review: the frame review must be current, complete and honest before a film is ready', () => {
  const tpl = reviewTemplate(film, 'h1');
  assert.equal(tpl.shots.length, 2);
  assert.equal(checkRecord(null, film, 'h1').state, 'missing');
  assert.equal(checkRecord(tpl, film, 'h2').state, 'stale');
  assert.equal(checkRecord({...tpl, reviewer: 'x'}, film, 'h1').state, 'incomplete', 'not-performed judgements keep it pending');
  const done = (over = {}) => ({filmSha256: 'h1', reviewer: 'agent', shots: film.shots.map((s) => ({id: s.id, ...Object.fromEntries(JUDGEMENTS.map((j) => [j, {status: 'passed', notes: 'looked at the 1 fps sheet'}]))})), ...over});
  assert.equal(checkRecord(done(), film, 'h1').state, 'passed');
  const noNotes = done(); noNotes.shots[0].focal.notes = '';
  assert.equal(checkRecord(noNotes, film, 'h1').state, 'incomplete');
  const fix = done(); fix.shots[1].relevance = {status: 'needs-fix', notes: 'picture shows the wrong device'};
  const r = checkRecord(fix, film, 'h1');
  assert.equal(r.state, 'needs-fix'); assert.match(r.problems.join('|'), /b.relevance needs a fix/);
  const missingRow = done(); missingRow.shots.pop();
  assert.equal(checkRecord(missingRow, film, 'h1').state, 'incomplete');

  const pass = [{id: 'x', status: 'pass'}], fail = [{id: 'blank', status: 'fail'}];
  assert.equal(verdict(pass, {state: 'passed'}).state, 'ready-for-user');
  assert.equal(verdict(pass, {state: 'missing'}).state, 'review-pending');
  assert.equal(verdict(pass, {state: 'stale'}).state, 'review-pending');
  assert.equal(verdict(pass, {state: 'needs-fix', needsFix: 1}).state, 'needs-fix');
  assert.equal(verdict(fail, {state: 'passed'}).state, 'needs-fix', 'a failed measurement cannot be overridden by a review');
});

const hasFfmpeg = (() => { try { return spawnSync('ffmpeg', ['-version']).status === 0; } catch { return false; } })();
test('film review: real FFmpeg measurements on generated clips', {skip: !hasFfmpeg && 'FFmpeg is not available'}, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-review-'));
  try {
    const make = (name, src, extra = []) => { const f = path.join(dir, name); const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', src, '-f', 'lavfi', '-i', 'sine=f=440:d=6', '-shortest', '-pix_fmt', 'yuv420p', ...extra, f]); assert.equal(r.status, 0, r.stderr?.toString()); return f; };
    const stillClip = make('still.mp4', 'color=c=0x808080:s=270x480:r=30:d=6'), moving = make('moving.mp4', 'testsrc2=s=270x480:r=30:d=6'), white = make('white.mp4', 'color=c=white:s=270x480:r=30:d=6'), black = make('black.mp4', 'color=c=black:s=270x480:r=30:d=6');
    const stats = (f) => measureFrames(extractGray(f), SAMPLE);
    assert.equal(stats(stillClip).length, 12);
    assert.equal(status(evaluate({measures: stats(stillClip), film: {captions: []}}), 'static'), 'fail');
    assert.equal(status(evaluate({measures: stats(moving), film: {captions: []}}), 'static'), 'pass');
    assert.equal(status(evaluate({measures: stats(black), film: {captions: []}}), 'blank'), 'fail');
    assert.equal(status(evaluate({measures: stats(white), film: {captions: [{start: 0, end: 6, text: 'x'}]}}), 'contrast'), 'fail');
    const a = audioStats(moving);
    assert.ok(Number.isFinite(a.lufs) && a.lufs < 0 && Number.isFinite(a.peak), `loudness ${a.lufs}, peak ${a.peak}`);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

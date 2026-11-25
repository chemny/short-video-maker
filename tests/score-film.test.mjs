import test from 'node:test';
import assert from 'node:assert/strict';
import {score, units, LIMITS} from '../scripts/score-film.mjs';

// The structural score (references/quality-bar.md): a text-card film fails on media and rhythm, a paced film with assets passes.
const scene = (i, len, over = {}) => ({id: `s${i}`, start: i * len, end: (i + 1) * len, layout: 'text-card', motion: {type: 'fade-up'}, visual: {prompt: 'x'}, ...over});
const plan = (scenes, audio = {}) => ({meta: {}, audio, scenes});

test('score-film: an all-text, slow film fails the media and rhythm checks', () => {
  const r = score({plan: plan(Array.from({length: 6}, (_, i) => scene(i, 14))), storyboard: null});
  for (const id of ['mediaShare', 'textOnlyShare', 'longestShot', 'firstChange']) assert.equal(r.checks.find((c) => c.id === id).status, 'fail', id);
  assert.ok(r.failed.includes('mediaShare'));
  assert.ok(r.score < 60);
});

test('score-film: a paced film with assets, varied layouts and a music bed passes', () => {
  const layouts = ['full-image-title', 'image-with-caption', 'data-card', 'hook', 'full-image-title', 'image-with-caption'];
  const lens = [4, 5.5, 3, 4.5, 6, 3.5];
  let at = 0;
  const scenes = layouts.map((layout, i) => { const s = scene(i, 4, {layout, visual: {asset: `assets/s${i}.png`}}); s.start = at; at += lens[i]; s.end = at; return s; });
  scenes[2].visual = {asset: 'assets/clip.mp4'};
  const r = score({plan: plan(scenes, {bgm: 'audio/bgm.mp3'}), storyboard: null});
  assert.deepEqual(r.failed, []);
  assert.equal(r.checks.find((c) => c.id === 'mediaShare').status, 'pass');
  assert.equal(r.checks.find((c) => c.id === 'videoShare').status, 'pass');
  assert.equal(r.score, 100);
});

test('score-film: storyboard shots are the unit when present, and a one-layout run fails', () => {
  const shots = Array.from({length: 5}, (_, i) => ({id: `sh${i}`, start: i * 3, end: (i + 1) * 3, kind: 'image', asset: `a${i}.png`}));
  const loaded = {plan: plan([scene(0, 15)]), storyboard: {shots}};
  assert.equal(units(loaded).unit, 'shot');
  const r = score(loaded);
  assert.equal(r.checks.find((c) => c.id === 'layoutRun').status, 'fail');
  assert.equal(r.checks.find((c) => c.id === 'motionShare').status, 'skip');
  assert.ok(LIMITS.longestShot.pass < LIMITS.longestShot.fail);
});

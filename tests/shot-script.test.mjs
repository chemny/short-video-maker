import test from 'node:test';
import assert from 'node:assert/strict';
import {auditShotScript, estimateSeconds, narrationText, MOVES} from '../scripts/lib/shot-script.mjs';

// Shot script gate (references/shot-script.md): every beat is bound to a picture and a move before the narration is recorded.
const inv = new Map([
  ['v1', {id: 'v1', status: 'on-disk', kind: 'video', moving: true, grade: 'A', rights: 'noted'}],
  ['i1', {id: 'i1', status: 'on-disk', kind: 'image', moving: false, grade: 'A', rights: 'noted'}],
  ['i2', {id: 'i2', status: 'on-disk', kind: 'image', moving: false, grade: 'B', rights: 'noted'}],
  ['i3', {id: 'i3', status: 'on-disk', kind: 'image', moving: false, grade: 'B', rights: 'noted'}],
  ['x1', {id: 'x1', status: 'candidate', kind: 'image', moving: false, grade: 'X', reasons: ['logo'], rights: 'unreviewed'}],
  ['r1', {id: 'r1', status: 'on-disk', kind: 'video', moving: true, grade: 'B', acquisition: 'isolated-headless-Chrome-scroll-recording', rights: 'noted'}],
]);
const beat = (id, narration, over = {}) => ({id, narration, rung: 'image', material: 'i1', move: 'push', why: '画面里是官方演示的界面', ...over});
const R = {x: 0.2, y: 0.3, w: 0.5, h: 0.3};
const good = () => ({beats: [
  beat('a', '苹果把助手重做了一遍。', {rung: 'video', material: 'v1', move: 'hold'}),
  beat('b', '它能找到你几年前的照片。', {material: 'i1', move: 'focus', region: R}),
  beat('c', '还能在应用里替你操作。', {material: 'i2', move: 'highlight', region: R}),
  beat('d', '所有对话集中在一个应用里。', {material: 'i3', move: 'pan', region: R, regionEnd: {x: 0.5, y: 0.3, w: 0.4, h: 0.3}}),
  beat('e', '目前只支持英语。', {rung: 'text', material: undefined, move: 'hold', noMaterialReason: '没有对应画面', onScreen: [{text: '只支持英语', at: 0.2}]}),
]});

test('shot script: a bound, paced script has no errors', () => {
  const r = auditShotScript(good(), {inventory: inv});
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.beats, 5);
  assert.ok(MOVES.includes('hold'));
});

test('shot script: unbound or unusable material is an error', () => {
  const s = good(); s.beats[1].material = undefined;
  assert.match(auditShotScript(s, {inventory: inv}).errors.join('|'), /needs a material id/);
  const t = good(); t.beats[1].material = 'nope';
  assert.match(auditShotScript(t, {inventory: inv}).errors.join('|'), /not in the visual inventory/);
  const u = good(); u.beats[1].material = 'x1';
  assert.match(auditShotScript(u, {inventory: inv}).errors.join('|'), /unusable/);
  const v = good(); v.beats[1].rung = 'video';
  assert.match(auditShotScript(v, {inventory: inv}).errors.join('|'), /does not match the material/);
  const w = good(); w.beats[0] = beat('a', '苹果把助手重做了一遍。', {rung: 'recording', material: 'r1', move: 'hold'});
  assert.deepEqual(auditShotScript(w, {inventory: inv}).errors, []);
});

test('shot script: text-heavy and text-opening scripts are blocked', () => {
  const t = {beats: Array.from({length: 4}, (_, i) => beat(`t${i}`, '这是一句没有画面支撑的话需要文字顶替。', {rung: 'text', material: undefined, noMaterialReason: '无素材', onScreen: [{text: '无', at: 0}]}))};
  const r = auditShotScript(t, {inventory: inv});
  assert.match(r.errors.join('|'), /opening beat must show a real picture/);
  assert.match(r.errors.join('|'), /text-only beats take 100%/);
  const noReason = good(); delete noReason.beats[4].noMaterialReason;
  assert.match(auditShotScript(noReason, {inventory: inv}).errors.join('|'), /noMaterialReason/);
});

test('shot script: reuse, pacing and repetition', () => {
  const s = good();
  for (const i of [1, 2, 3]) s.beats[i].material = 'i1';
  assert.match(auditShotScript(s, {inventory: inv}).errors.join('|'), /used in 3 beats/);
  const same = good(); same.beats[2].material = 'i1'; same.beats[2].move = 'focus'; same.beats[2].region = R;
  assert.match(auditShotScript(same, {inventory: inv}).warnings.join('|'), /same move and crop/);
  const long = good(); long.beats[1].narration = '它能找到你几年前的照片，也能翻出埋在收件箱里的邮件，还能找到你很久以前保存的那条备忘录里的内容，甚至连你随手记在购物清单里的几个名字也能一并翻出来给你看。';
  assert.match(auditShotScript(long, {inventory: inv}).errors.join('|'), /split the beat/);
  const slowOpen = good(); slowOpen.beats[0].narration = '苹果这次把它的语音助手从头到尾重新设计了一遍，口号也跟着换了，页面从上到下全部是新的内容。';
  assert.match(auditShotScript(slowOpen, {inventory: inv}).errors.join('|'), /opening beat/);
  const run = good(); for (const b of run.beats.slice(1, 4)) { b.move = 'push'; }
  assert.match(auditShotScript(run, {inventory: inv}).warnings.join('|'), /repeat the same rung and move/);
});

test('shot script: candidates need download approval, claims are checked, narration is emitted', () => {
  const s = good(); s.beats[1].claimIds = ['c9'];
  const withCandidate = new Map(inv); withCandidate.set('i1', {...inv.get('i1'), status: 'candidate'});
  const r = auditShotScript(s, {inventory: withCandidate, claimIds: new Set(['c1'])});
  assert.match(r.errors.join('|'), /claim c9/);
  assert.match(r.warnings.join('|'), /not downloaded yet/);
  assert.equal(narrationText(good()).split('\n\n').length, 5);
  assert.ok(estimateSeconds('一二三四五六七八九十') > 2 && estimateSeconds('') === 0.8);
});

test('shot script: moves need their own fields', () => {
  const noRegion = good(); delete noRegion.beats[1].region;
  assert.match(auditShotScript(noRegion, {inventory: inv}).errors.join('|'), /focus needs region/);
  const badRegion = good(); badRegion.beats[1].region = {x: 0.8, y: 0.3, w: 0.5, h: 0.3};
  assert.match(auditShotScript(badRegion, {inventory: inv}).errors.join('|'), /focus needs region/);
  const noEnd = good(); delete noEnd.beats[3].regionEnd;
  assert.match(auditShotScript(noEnd, {inventory: inv}).errors.join('|'), /pan needs regionEnd/);
  const count = good(); count.beats[1].move = 'count';
  assert.match(auditShotScript(count, {inventory: inv}).errors.join('|'), /count needs figure/);
  const compare = good(); compare.beats[1].move = 'compare';
  assert.match(auditShotScript(compare, {inventory: inv}).errors.join('|'), /compare needs materialB/);
  const text = good(); delete text.beats[4].onScreen;
  assert.match(auditShotScript(text, {inventory: inv}).errors.join('|'), /needs onScreen/);
});

test('shot script: film layer checks rhythm, transitions, hook and music', () => {
  const flat = good();
  flat.beats = Array.from({length: 6}, (_, i) => beat(`f${i}`, '苹果把助手重做了一遍啊。', {material: ['i1', 'i2', 'i3', 'v1', 'r1', 'i1'][i], rung: ['image', 'image', 'image', 'video', 'recording', 'image'][i], move: ['push', 'pull', 'hold', 'hold', 'hold', 'pull'][i]}));
  const w = auditShotScript(flat, {inventory: inv}).warnings.join('|');
  assert.match(w, /about the same length/);
  assert.match(w, /no hook/);
  assert.match(w, /no music bed/);
  const quick = good(); quick.beats[1].narration = '好。';
  assert.match(auditShotScript(quick, {inventory: inv}).warnings.join('|'), /under 1.6 s are hard to read: b/);
  const dis = good(); for (const b of dis.beats) b.transition = 'dissolve';
  assert.match(auditShotScript(dis, {inventory: inv}).warnings.join('|'), /entries move, more than 40%/);
  const bad = good(); bad.beats[1].transition = 'spin';
  assert.match(auditShotScript(bad, {inventory: inv}).errors.join('|'), /transition must be one of/);
  const hooked = {...good(), hook: {lines: [{text: '重做的 Siri', at: 0.1}, {text: '到底变了什么', at: 0.9}]}, bgm: {file: 'synth'}};
  const r = auditShotScript(hooked, {inventory: inv});
  assert.ok(!r.warnings.some((m) => /no hook|no music/.test(m)));
  const longHook = {...good(), hook: {lines: [{text: '这一行话实在是太长了所以不行', at: 0}]}};
  assert.match(auditShotScript(longHook, {inventory: inv}).errors.join('|'), /hook.lines\[0\].text/);
  const threeLines = {...good(), hook: {lines: [{text: '一', at: 0}, {text: '二', at: 0}, {text: '三', at: 0}]}};
  assert.match(auditShotScript(threeLines, {inventory: inv}).errors.join('|'), /hook.lines must be/);
});

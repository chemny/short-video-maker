import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDirectorContent} from '../scripts/lib/director.mjs';

// Content decisions only; cue and timeline compilation is covered by director-workflow tests.
const build = () => {
  const captions = [
    {id: 'c1', text: '两家公司在争取投资人', start: 0, end: 2},
    {id: 'c2', text: '预算有限', start: 2, end: 3.5},
    {id: 'c3', text: '所以空间会变小', start: 3.5, end: 5},
    {id: 'c4', text: '这是我的判断', start: 5, end: 6.5},
  ];
  const rows = captions.map((c, i) => ({captionId: c.id, sceneId: 's1', text: c.text, start: c.start, end: c.end, shotId: 'one', shows: `画面${i}`, change: `变化${i}`, reason: `理由${i}`, screenText: `文字${i}`,
    understanding: ['明白两家在争同一类资金', '理解预算是约束条件', '理解空间被挤压的因果', '区分判断与报道'][i], visualContribution: ['出现投资人节点并连线', '加入约束标签', '一侧连线变细', '切换到观点底色'][i], claimType: 'fact'}));
  const plan = {meta: {directorVersion: 'director-v1', renderSource: {kind: 'authored-remotion'}}, style: {template: 'directed-news'}, captions};
  const board = {directorVersion: 1, rows, shots: [{id: 'one', start: 0, end: 6.5, kind: 'diagram', recipe: 'own', title: '融资竞争', revealPolicy: 'context-first', motionPurpose: '说明约束如何传导'}]};
  return {plan, board};
};

test('distinct sentence decisions pass with no content findings', () => {
  const {plan, board} = build();
  assert.deepEqual(auditDirectorContent(plan, board), {errors: [], warnings: []});
});

test('copy-paste decisions are rejected instead of merely non-empty', () => {
  let {plan, board} = build();
  board.rows[0].visualContribution = board.rows[0].understanding;
  assert.match(auditDirectorContent(plan, board).errors.join(), /c1: understanding and visualContribution must differ/);
  ({plan, board} = build());
  board.rows[1].understanding = '。。。';
  assert.match(auditDirectorContent(plan, board).errors.join(), /c2: understanding is too short/);
  ({plan, board} = build());
  board.rows[2].understanding = board.rows[2].text;
  assert.match(auditDirectorContent(plan, board).errors.join(), /c3: understanding only repeats the narration/);
  ({plan, board} = build());
  for (const r of board.rows) r.visualContribution = '保持原图并强调重点';
  assert.match(auditDirectorContent(plan, board).errors.join(), /visualContribution repeats across 4\/4 rows/);
});

test('boilerplate rationale and shared motion purpose are warnings, not silent passes', () => {
  const {plan, board} = build();
  for (const r of board.rows) r.reason = r.understanding;
  board.shots.push({...board.shots[0], id: 'two'}, {...board.shots[0], id: 'three'});
  const {warnings} = auditDirectorContent(plan, board);
  assert.ok(warnings.some(w => /copies understanding into reason/.test(w)));
  assert.ok(warnings.some(w => /share one motionPurpose/.test(w)));
});

test('persistent shot title that previews later speech is flagged; a neutral or on-time title is not', () => {
  const {plan, board} = build();
  board.shots[0].title = '空间会变小';
  assert.match(auditDirectorContent(plan, board).warnings.join(), /first spoken at 3\.50s \(c3\)/);
  board.shots[0].title = '融资竞争';
  assert.deepEqual(auditDirectorContent(plan, board).warnings, []);
  board.shots[0].title = '两家公司';
  assert.deepEqual(auditDirectorContent(plan, board).warnings, []);
});

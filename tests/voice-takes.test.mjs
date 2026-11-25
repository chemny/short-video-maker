import test from 'node:test';
import assert from 'node:assert/strict';
import {judgeTake, chooseTake} from '../scripts/lib/voice-takes.mjs';
import {splitForLines, formatCaption, units, MAX_UNITS} from '../scripts/lib/caption-style.mjs';

// Take selection (references/shot-script.md, narration): a take is accepted only if its ASR transcript reproduces the text.
const words = (...pairs) => ({words: pairs.map(([word, probability]) => ({word, probability}))});
const t2s = (xs) => xs.map((x) => x.replace('蘋', '苹').replace(/六/g, '6'));

test('voice takes: a transcript counts only when it reproduces the text, whatever the script of the digits or characters', () => {
  const ok = judgeTake('苹果把 Siri 重做了一遍。', words(['蘋果', 0.9], ['把', 0.8], ['Siri', 0.7], ['重做了一遍', 0.55]), t2s);
  assert.equal(ok.textMatches, true); assert.equal(ok.minProbability, 0.55);
  assert.equal(judgeTake('苹果把 Siri 重做了一遍。', words(['苹果把Siri重做了一遍', 0.9], ['哼', 0.9]), t2s).textMatches, false, 'a stray sound is extra speech');
  assert.equal(judgeTake('分成了6类', words(['分成了', 0.9], ['六类', 0.8]), t2s).textMatches, true, 'a spoken number written as a numeral still matches');
  assert.equal(judgeTake('支持英语', words(['支持', 0.9], ['著', 0.6]), t2s).textMatches, false);
  assert.equal(judgeTake('需要外部知识', words(['需要外部', 0.9], ['支持', 0.9]), t2s).textMatches, false, 'a misread word is refused');
});

test('voice takes: the take with the most confident words wins, below the threshold nothing is chosen', () => {
  const takes = [{seed: 1, textMatches: true, minProbability: 0.45}, {seed: 2, textMatches: false, minProbability: 0.9}, {seed: 3, textMatches: true, minProbability: 0.7}];
  assert.equal(chooseTake(takes).seed, 3);
  assert.equal(chooseTake(takes.slice(0, 2)).seed, 1);
  assert.equal(chooseTake([{seed: 1, textMatches: true, minProbability: 0.2}]), null);
  assert.equal(chooseTake([{seed: 1, textMatches: false, minProbability: 0.9}]), null);
});

test('caption splitting: cuts fall at natural points and never inside a phrase', () => {
  const cases = {
    '也能在信息、音乐、提醒事项这些应用里替你动手。': ['也能在信息、音乐、提醒事项', '这些应用里替你动手'],
    '开车时，也可以问 Siri 朋友推荐的步道在哪，直接得到答案。': ['开车时 也可以问 Siri', '朋友推荐的步道在哪', '直接得到答案'],
    '拍完照片之后，还能重新取景，移动视角，调整角度。': ['拍完照片之后', '还能重新取景', '移动视角 调整角度'],
  };
  for (const [text, want] of Object.entries(cases)) {
    const got = splitForLines(text).map((p) => formatCaption(p));
    assert.deepEqual(got, want, text);
    for (const p of got) assert.ok(units(p) <= MAX_UNITS);
  }
  const tail = splitForLines('在 iPad 上，用手指点一下，或者用 Apple Pencil 圈一下，就能查询。').map((p) => units(formatCaption(p)));
  assert.ok(tail.every((u) => u >= 6), 'no caption shorter than about six units is left as a tail');
});

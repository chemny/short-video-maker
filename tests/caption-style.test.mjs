import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCaption, splitForLines, units, speechChars, lintCaption, lintCaptions, styleCaptions, MAX_UNITS} from '../scripts/lib/caption-style.mjs';

// Caption standard (references/caption-standard.md): Netflix Simplified Chinese rules, adapted to a 700 px caption box.
test('caption standard: commas and full stops become one space, nothing punctuates the end', () => {
  assert.equal(formatCaption('真正有用，真正属于你。'), '真正有用 真正属于你');
  assert.equal(formatCaption('页面上的口号很直白：'), '页面上的口号很直白');
  assert.equal(formatCaption('他说：好的。'), '他说：好的', 'a colon that introduces speech stays');
  assert.equal(formatCaption('苹果、谷歌、微软、'), '苹果、谷歌、微软', 'the enumeration comma is never last');
  assert.equal(formatCaption('这是真的吗?'), '这是真的吗？', 'questions keep a full-width question mark');
  assert.equal(formatCaption('太好了!!'), '太好了！');
  assert.equal(formatCaption('什么?!'), '什么？', 'no combined marks');
  assert.equal(formatCaption('等一下...'), '等一下…');
  assert.equal(formatCaption('价格是 1,250 元。'), '价格是 1,250 元', 'a comma inside a number is not punctuation');
  assert.equal(formatCaption('第 3.5 版发布了。'), '第 3.5 版发布了');
});

test('caption standard: every piece fits one line, Latin words and numbers are never cut', () => {
  for (const t of ['新增了独立的 Siri 应用，在 iPhone 上问到一半，换到 iPad 上接着聊。', '在 iPad 上，用手指点一下，或者用 Apple Pencil 圈一下，就能查询。', '不过要注意，目前只支持英语，部分功能可能有使用次数限制。', '它能理解你的个人情境，比如帮你找出几年前的照片。']) {
    const parts = splitForLines(t);
    assert.ok(parts.length >= 2);
    for (const p of parts) assert.ok(units(formatCaption(p)) <= MAX_UNITS, `${p}: ${units(formatCaption(p))}`);
    assert.equal(parts.join('').replace(/[\s，。、；：]/g, ''), t.replace(/[\s，。、；：]/g, ''), 'the text is only split, never changed');
    for (const p of parts) assert.ok(!/^[a-z0-9]/i.test(p.replace(/^\s+/, '')) || /^[A-Za-z0-9]/.test(p), 'sanity');
  }
  const long = splitForLines('在 iPhone 17 Pro Max 上可以直接使用这项新功能');
  assert.ok(long.every((p) => !/\b(iPhone|Pro|Max)$/.test('') ), 'sanity');
  assert.ok(!long.some((p, i) => /[A-Za-z0-9]$/.test(p) && i + 1 < long.length && /^[A-Za-z0-9]/.test(long[i + 1])), 'no Latin word is cut in two');
  assert.deepEqual(splitForLines('苹果把 Siri 重做了一遍。'), ['苹果把 Siri 重做了一遍。']);
});

test('caption standard: lint finds each violation and passes a clean caption', () => {
  const ok = {text: '真正有用 真正属于你', start: 0, end: 2.5};
  assert.deepEqual(lintCaption(ok), []);
  const rule = (text, start = 0, end = 3) => lintCaption({text, start, end}).map((i) => `${i.level}:${i.rule}`);
  assert.ok(rule('真正有用，真正属于你').includes('fail:§12'));
  assert.ok(rule('真正有用。').includes('fail:§12'));
  assert.ok(rule('这是真的吗?').includes('fail:§12'));
  assert.ok(rule('字'.repeat(15)).includes('fail:§1/§10'));
  assert.ok(rule('价格 1,250 元').includes('fail:§11'));
  assert.ok(rule('第３项').includes('fail:§11'));
  assert.ok(rule('一二三四五六七八九十一二', 0, 0.5).includes('warn:§14'), 'too fast to read');
  assert.ok(rule('好的', 0, 0.4).includes('warn:timing'), 'under 20 frames at 24 fps');
  assert.ok(speechChars('真正 有用！') === 4);
  const r = lintCaptions([{text: '一二三四五六七八', start: 0, end: 2}, {text: '甲乙丙丁戊己庚辛', start: 2.3, end: 4.5}]);
  assert.equal(r.fails.length, 0); assert.equal(r.gaps.length, 1, 'a 0.3 s gap should have been closed');
});

test('caption standard: styled captions have standard text, closed gaps, a minimum duration and a tail', () => {
  const styled = styleCaptions([{start: 0, end: 1.9, text: '真正有用，'}, {start: 2.2, end: 2.5, text: '真正属于你。'}, {start: 5, end: 6.4, text: '就这样。'}], {endAt: 8});
  assert.deepEqual(styled.map((c) => c.text), ['真正有用', '真正属于你', '就这样']);
  assert.ok(Math.abs(styled[0].end - (2.2 - 2 / 30)) < 0.002, 'the 0.3 s gap is closed to two frames');
  assert.ok(styled[1].end - styled[1].start >= 20 / 24 - 1e-6, 'short captions are extended');
  assert.ok(styled[2].end >= 6.4 + 0.45 && styled[2].end <= 8, 'the last caption lingers after the audio');
  assert.equal(lintCaptions(styled).fails.length, 0);
  assert.equal(lintCaptions(styled).gaps.length, 0);
});

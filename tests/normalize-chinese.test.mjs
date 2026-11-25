import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Matching normalisation: Traditional to Simplified and single-digit numerals to digits, on both sides of a comparison.
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/normalize-chinese.py');
const run = (values) => spawnSync(process.env.PYTHON3_BIN ?? 'python3', [script], {input: JSON.stringify(values), encoding: 'utf8'});
const probe = run(['苹果']);
test('normalize-chinese: a spoken number matches whether it is written 六 or 6', {skip: probe.status !== 0 && 'OpenCC is not available in this Python'}, () => {
  const [a, b, c, d] = JSON.parse(run(['分成了6类', '分成了六类', '蘋果', '十二']).stdout);
  assert.equal(a, b, 'digit and numeral agree');
  assert.equal(c, '苹果', 'Traditional becomes Simplified');
  assert.equal(d, '十2', 'only the single-digit numerals change, the display text is never touched');
});

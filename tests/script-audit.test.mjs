import test from 'node:test';
import assert from 'node:assert/strict';
import {auditScript} from '../scripts/lib/script-audit.mjs';

const press = `10月31日，苹果和阿里巴巴宣布合作：千问将接入Apple智能，中国用户可以在Siri、写作工具和视觉智能里直接调用。

用户可以在Siri里提问。用户可以在写作里生成内容。用户可以在相机里识别物体。

目前只在iOS上提供，面向在中国购买了支持Apple智能的iPhone用户，或设备定位和Apple账户地区都在中国的用户。

关键在入口。`;

const viewer = `以后在国行iPhone上问Siri，答案可能来自阿里的千问。10月31日，苹果和阿里巴巴宣布合作。

接入的是三个系统入口。Siri能调用千问回答问题；写作工具有了“千问创作”；视觉智能里选“询问千问”。

我的判断是，真正的变化是入口。接下来要看的，是12月正式版的实际体验。`;

test('press-release shaped script is flagged on opening, length, list pattern and ending', () => {
  const {errors, warnings} = auditScript(press, {headline: '苹果官宣：Apple智能接入阿里千问'});
  assert.deepEqual(errors, []);
  const text = warnings.join('\n');
  assert.match(text, /opens with a date and event/);
  assert.match(text, /over 28/);
  assert.match(text, /all start with "用户"/);
  assert.match(text, /ending has no judgment or watch point/);
});

test('viewer-first script has no findings', () => {
  assert.deepEqual(auditScript(viewer).warnings, []);
});

test('headline repetition, number density and duration target are reported', () => {
  const headline = '阿里千问接入苹果智能开放测试';
  assert.match(auditScript('阿里千问接入苹果智能开放测试。接下来值得关注。', {headline}).warnings.join(), /repeats the headline/);
  assert.match(auditScript('2026年10月31日11点50分上线。我的判断是好。').warnings.join(), /5 numbers/);
  assert.match(auditScript(viewer, {target: 60}).warnings.join(), /20% from the 60s target/);
});

test('empty script is an error', () => {
  assert.match(auditScript('  ').errors[0], /no Chinese text/);
});

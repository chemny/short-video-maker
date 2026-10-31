import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateSelected} from '../scripts/tts/generate-selected.mjs';
import {selectProvider} from '../scripts/tts/select-provider.mjs';
import {generateCloudAligned} from '../scripts/tts/cloud-aligned.mjs';
import * as local from '../scripts/tts/providers/local.mjs';
import {auditProduction} from '../scripts/lib/production-audit.mjs';
const setup = (t) => {
 const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'macos-fallback-')));
 t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
 const p = JSON.parse(fs.readFileSync(new URL('../examples/material-plan.json', import.meta.url)));
 p.audio = {}; p.scenes = [{...p.scenes[0], id: 's1', voiceover: '你好。欢迎使用系统配音。', captionIds: ['c1', 'c2']}];
 p.captions = [{id:'c1',text:'你好。',start:0,end:1},{id:'c2',text:'欢迎使用系统配音。',start:1,end:4}];
 const file = path.join(dir, 'video-plan.json'); fs.writeFileSync(file, JSON.stringify(p)); return file;
};
const unavailable = () => Object.assign(new Error('fixture offline'), {ttsSynthesisFailed: true});
test('auto falls through local model and Edge to system without leaking voice options; saved auto remains auto', async (t) => {
 const file = setup(t), called = [];
 const result = await generateSelected({planPath:file, selection:{provider:'voxcpm2',source:'auto'},providers:{}, options:{voice:'cloud-id',rate:'+10%'},systemAvailable:()=>true,warn:()=>{},
 generate: async (name, options) => {called.push(name); if(name!=='local') throw unavailable(); assert.equal(options.voice,undefined); assert.equal(options.rate,undefined); return {};}});
 assert.deepEqual(called,['voxcpm2','edge','local']); assert.equal(result.selection.fallback,true);
 assert.equal(selectProvider({plan:JSON.parse(fs.readFileSync(file)),capability:()=>({ready:false})}).source,'auto');
});
test('explicit failures, alignment rejection, imported/text mismatch, and unavailable system never switch silently', async(t)=>{
 for(const [selection,error,available,expected] of [
 [{provider:'edge',source:'explicit'},unavailable(),true,['edge']],
 [{provider:'edge',source:'auto'},new Error('alignment blocked'),true,['edge']],
 [{provider:'edge',source:'auto'},unavailable(),false,['edge']],
 ]) {const file=setup(t),called=[],before=fs.readFileSync(file); await assert.rejects(generateSelected({planPath:file,selection,providers:{},systemAvailable:()=>available,generate:async(name)=>{called.push(name);throw error;},warn:()=>{}}));assert.deepEqual(called,expected);assert.deepEqual(fs.readFileSync(file),before);}
 const file=setup(t); const p=JSON.parse(fs.readFileSync(file));p.audio.sourceMode='imported';fs.writeFileSync(file,JSON.stringify(p));
 await assert.rejects(generateSelected({planPath:file,selection:{provider:'edge',source:'auto'},providers:{},generate:()=>assert.fail('must not synthesize')}),/Imported/);
 delete p.audio.sourceMode;p.captions[0].text='不匹配';fs.writeFileSync(file,JSON.stringify(p));
 await assert.rejects(generateSelected({planPath:file,selection:{provider:'edge',source:'auto'},providers:{},generate:()=>assert.fail('must not synthesize')}),/must match/);
});
test('real installed macOS Chinese voice uses measured caption phrase boundaries without Python', {skip:process.platform!=='darwin'}, async(t)=>{
 const file=setup(t),old=process.env.PYTHON3_BIN;process.env.PYTHON3_BIN='/no-python';t.after(()=>{if(old===undefined)delete process.env.PYTHON3_BIN;else process.env.PYTHON3_BIN=old;});
 await generateCloudAligned({planPath:file,provider:local});
 const p=JSON.parse(fs.readFileSync(file)),report=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'alignment/alignment-report.json')));
 assert.equal(p.audio.voiceSelection,process.env.MACOS_TTS_VOICE ? 'configured' : 'installed-language-default');assert.ok(p.meta.durationSeconds > 1);assert.equal(p.audio.timingSource,'provider-matched');
 assert.equal(report.method,'system-phrase-segment-matching');assert.equal(report.status,'matched');
 assert.ok(p.captions[0].end>0);assert.ok(Math.abs(p.captions[1].start-p.captions[0].end)<0.001);
 assert.ok(Math.abs(p.captions.at(-1).end-p.meta.durationSeconds)<0.001);
 assert.ok(!auditProduction(p,path.dirname(file)).errors.some(e=>/timing|alignment/i.test(e)));
});

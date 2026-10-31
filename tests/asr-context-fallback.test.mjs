import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {alignGenerated} from '../scripts/tts/aligned.mjs';

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file));
const fixture = (t, mode) => {
  const job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'svm-asr-context-')));
  t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const ff = args => execFileSync('ffmpeg', ['-v','error','-nostdin','-n',...args]);
  const a=path.join(job,'scene-a.wav'),b=path.join(job,'scene-b.wav'),audio=path.join(job,'narration.wav');
  [a,b].forEach((file,i)=>ff(['-f','lavfi','-i',`sine=frequency=${440+i*200}:duration=1:sample_rate=48000`,'-c:a','pcm_s16le',file]));
  ff(['-i',a,'-i',b,'-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[out]','-map','[out]','-c:a','pcm_s16le',audio]);
  const model=path.join(job,'fixture.pt');fs.writeFileSync(model,'synthetic model contract');
  const python=path.join(job,'fixture-python'),log=path.join(job,'observed.log');
  // This observer uses synthetic tones to test context routing/rollback only.
  // It does not model real recognition quality or certify pronunciation.
  fs.writeFileSync(python,`#!/usr/bin/env python3
import sys,json,hashlib,pathlib
a=sys.argv[1:];audio=pathlib.Path(a[1]);opts=dict(zip(a[2::2],a[3::2]));name=audio.name
if name=='scene-a.wav':words=[{'word':'Yellow','start':.1,'end':.8,'probability':.99}];engine='fixture-scene'
elif name=='scene-b.wav':words=[{'word':'world','start':.1,'end':.8,'probability':.99}];engine='fixture-scene'
else:words=[{'word':${JSON.stringify(mode === 'success' ? 'Hello' : 'Hollow')},'start':.1,'end':.8,'probability':.99},{'word':'world','start':1.1,'end':1.8,'probability':.99}];engine='fixture-full'
report={'schemaVersion':1,'audioSha256':hashlib.sha256(audio.read_bytes()).hexdigest(),'modelSha256':hashlib.sha256(pathlib.Path(opts['--model']).read_bytes()).hexdigest(),'engine':engine,'text':' '.join(w['word'] for w in words),'words':words}
pathlib.Path(opts['--out']).write_text(json.dumps(report))
with open(${JSON.stringify(log)},'a') as out:out.write(name+'\\n')
`);fs.chmodSync(python,0o755);
  const old=process.env.PYTHON3_BIN;process.env.PYTHON3_BIN=python;
  t.after(()=>{if(old===undefined)delete process.env.PYTHON3_BIN;else process.env.PYTHON3_BIN=old;});
  const file=path.join(job,'video-plan.json');
  fs.writeFileSync(file,JSON.stringify({meta:{language:'en-US',durationSeconds:2},cover:{},audio:{sourceMode:'tts',timingSource:'provided'},
    scenes:[{id:'a',start:0,end:1,voiceover:'Hello.',captionIds:['a']},{id:'b',start:1,end:2,voiceover:'world.',captionIds:['b']}],
    captions:[{id:'a',text:'Hello.',start:0,end:1},{id:'b',text:'world.',start:1,end:2}]}));
  const generated={file:audio,reused:true,segments:[a,b].map(file=>({file,audioSha256:hash(file)})),
    meta:{provider:'voxcpm2',providerMeta:{voice:'fixture'},audioSha256:hash(audio),texts:['Hello.','world.']}};
  return {job,file,log,args:{planPath:file,provider:'voxcpm2',options:{asrModel:model},generated}};
};

test('isolated scene mismatch gets a real full-audio observation with separate cache scope before commit', t => {
  const {job,file,log,args}=fixture(t,'success');
  const result=alignGenerated(args);assert.equal(result.durationSeconds,2);
  const plan=json(file),report=json(path.join(job,'alignment/alignment-report.json')),first=json(path.join(job,'alignment/alignment-scene-pass.json'));
  assert.equal(report.status,'matched');assert.equal(report.engine,'fixture-full');assert.equal(first.status,'needs-review');
  assert.ok(first.issues.some(i=>i.code==='missing-or-misread-text'));
  assert.equal(plan.audio.sourceMode,'tts');assert.deepEqual(plan.captions.map(c=>c.start),[.1,1.1]);
  const files=fs.readdirSync(path.join(job,'alignment')).filter(f=>f.startsWith('transcript-'));
  assert.equal(files.filter(f=>f.endsWith('-scenes.json')).length,1);assert.equal(files.filter(f=>f.endsWith('-full.json')).length,1);
  const lines=fs.readFileSync(log,'utf8').trim().split('\n');assert.deepEqual(lines,['scene-a.wav','scene-b.wav','narration.wav']);
  alignGenerated(args);assert.deepEqual(fs.readFileSync(log,'utf8').trim().split('\n'),lines,'Second run independently reuses scene and full observations, not the wrong scope');
});

test('scene and full-audio mismatches preserve prior plan, canonical evidence and delivery without rewriting observed words', t => {
  const {job,file,log,args}=fixture(t,'failure');
  fs.mkdirSync(path.join(job,'alignment'));fs.writeFileSync(path.join(job,'alignment/alignment-report.json'),JSON.stringify({priorEvidence:true,status:'matched'}));
  fs.mkdirSync(path.join(job,'output'));fs.writeFileSync(path.join(job,'output/video.mp4'),'prior delivery');
  const before=fs.readFileSync(file),evidence=fs.readFileSync(path.join(job,'alignment/alignment-report.json'));
  assert.throws(()=>alignGenerated(args),/alignment blocked; original plan and delivery retained/);
  assert.deepEqual(fs.readFileSync(file),before);assert.deepEqual(fs.readFileSync(path.join(job,'alignment/alignment-report.json')),evidence);
  assert.equal(fs.readFileSync(path.join(job,'output/video.mp4'),'utf8'),'prior delivery');
  assert.deepEqual(fs.readFileSync(log,'utf8').trim().split('\n'),['scene-a.wav','scene-b.wav','narration.wav']);
  const reports=fs.readdirSync(path.join(job,'alignment'));
  const rejected=json(path.join(job,'alignment',reports.find(f=>f.startsWith('voxcpm2-rejected-'))));
  assert.equal(rejected.status,'needs-review');assert.equal(rejected.applied,false);assert.ok(rejected.transcriptText.includes('Hollow'));
  const full=json(path.join(job,'alignment',reports.find(f=>f.startsWith('transcript-')&&f.endsWith('-full.json'))));
  assert.equal(full.words[0].word,'Hollow');assert.equal(full.words[0].probability,.99);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {repairAcousticTiming, planRepairs} from '../scripts/lib/acoustic-timing.mjs';

// Synthetic tones test measurable silence/timeline/transaction contracts, not pronunciation.
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const write = (file,value) => fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const wav = (file,duration,bands) => {
  const rate=48000, count=Math.round(duration*rate), data=Buffer.alloc(count*2);
  for(let i=0;i<count;i++) {const t=i/rate,b=bands.find(b=>b.start<=t&&t<b.end); data.writeInt16LE(b?Math.round((b.amplitude??4000)*Math.sin(2*Math.PI*(b.frequency??997)*t)):0,i*2);}
  const head=Buffer.alloc(44);head.write('RIFF',0);head.writeUInt32LE(36+data.length,4);head.write('WAVEfmt ',8);head.writeUInt32LE(16,16);head.writeUInt16LE(1,20);head.writeUInt16LE(1,22);head.writeUInt32LE(rate,24);head.writeUInt32LE(rate*2,28);head.writeUInt16LE(2,32);head.writeUInt16LE(16,34);head.write('data',36);head.writeUInt32LE(data.length,40);fs.writeFileSync(file,Buffer.concat([head,data]));
};
const workspace = t => {const job=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'svm-acoustic-')));t.after(()=>fs.rmSync(job,{recursive:true,force:true}));fs.mkdirSync(path.join(job,'audio'));fs.mkdirSync(path.join(job,'alignment'));return job;};
const fixture = (t,{duration=3.7,bands=[{start:0,end:1},{start:2.4,end:3.4}],captions=[{id:'c1',text:'First.',start:0,end:1},{id:'c2',text:'Second.',start:2.1,end:3.4}],sourceMode='tts',bgm=false}={}) => {
  const job=workspace(t),source=path.join(job,'audio/voice.wav');wav(source,duration,bands);
  const scenes=captions.map((c,i)=>({id:`s${i}`,start:i?c.start:0,end:captions[i+1]?.start??duration,voiceover:c.text,captionIds:[c.id],layout:'text-card',transition:'cut'}));
  const plan={meta:{language:'en-US',title:'Synthetic timing fixture',topic:'Measured boundary contract',durationSeconds:duration,width:1920,height:1080,fps:30},cover:{introSeconds:0},style:{template:'responsive-report'},audio:{sourceMode,provider:'voxcpm2',timingSource:'asr-matched',voiceover:'audio/voice.wav',sourceVoiceover:'audio/voice.wav',processing:{normalize:true}},scenes,captions};
  if(bgm){wav(path.join(job,'audio/bgm.wav'),duration,[{start:0,end:duration,amplitude:9000,frequency:251}]);plan.audio.bgm='audio/bgm.wav';plan.audio.bgmVolume=.6;}
  const file=path.join(job,'video-plan.json');write(file,plan);write(path.join(job,'alignment/alignment-report.json'),{status:'matched',applied:true,method:'asr-word-boundary-matching',engine:'synthetic-test-timestamps-no-speech-claim',audioSha256:hash(source),scriptSha256:createHash('sha256').update(JSON.stringify(captions.map(({id,text})=>({id,text})))).digest('hex'),proposed:captions.map(c=>({...c,alignment:{coverage:1,minimumWordProbability:.99}})),issues:[],limits:['Synthetic fixture only']});
  return {job,file,source,plan};
};
const pcmHash = file => createHash('sha256').update(execFileSync('ffmpeg',['-v','error','-i',file,'-ac','1','-ar','48000','-f','s16le','-'])).digest('hex');

test('default acoustic repair cuts a measured sentence pause, shifts subsequent timing and is idempotent',async t=>{
  const {job,file,source,plan}=fixture(t),original=hash(source);
  const report=await repairAcousticTiming(file);const after=read(file);
  assert.equal(report.state,'applied');assert.ok(report.changes.pauseCuts.length>=1);
  assert.ok(after.meta.durationSeconds<plan.meta.durationSeconds-.3&&after.meta.durationSeconds>plan.meta.durationSeconds-1);
  assert.ok(after.captions[1].start<plan.captions[1].start);
  assert.ok(Math.abs(after.scenes[0].end-after.scenes[1].start)<.001);assert.ok(Math.abs(after.scenes.at(-1).end-after.meta.durationSeconds)<.001);
  assert.equal(hash(source),original,'original source is immutable');
  assert.equal(report.outputAudioSha256,hash(path.join(job,after.audio.sourceVoiceover??after.audio.voiceover)));
  assert.equal(after.audio.acousticTiming.version,'acoustic-v1');
  const beforePlan=fs.readFileSync(file),beforeAlignment=fs.readFileSync(path.join(job,'alignment/alignment-report.json'));
  const again=await repairAcousticTiming(file);assert.ok(['verified','applied'].includes(again.state));assert.deepEqual(fs.readFileSync(file),beforePlan);assert.deepEqual(fs.readFileSync(path.join(job,'alignment/alignment-report.json')),beforeAlignment);
});

test('onset checks use separately normalized voice even when continuous BGM covers its silent lead',async t=>{
  const {file}=fixture(t,{duration:1.5,bands:[{start:.3,end:1.4}],captions:[{id:'c',text:'Hello.',start:0,end:1.4}],bgm:true});
  const report=await repairAcousticTiming(file);const after=read(file);
  assert.equal(report.state,'applied');assert.ok(after.captions[0].start>.23&&after.captions[0].start<.32);
  assert.ok(report.changes.captionOnsets.length>=1);assert.equal(after.meta.durationSeconds,1.5);
});

test('quiet audible initial syllables are preserved after voice normalization instead of raw-level trimming',async t=>{
  const {file}=fixture(t,{duration:1.6,bands:[{start:0,end:.3,amplitude:75},{start:.3,end:1.5,amplitude:2000}],captions:[{id:'c',text:'Hello.',start:0,end:1.5}]});
  await repairAcousticTiming(file);assert.equal(read(file).captions[0].start,0);
});

test('video demonstrations, explicit scene holds and protected windows preserve deliberate pauses',async t=>{
  for(const kind of ['video','scene','window']){
    const f=fixture(t);const p=read(f.file);
    if(kind==='video')for(const s of p.scenes)s.visual={kind:'video',asset:'demonstration.mp4',sourceStart:0,sourceVolume:0};
    if(kind==='scene')for(const s of p.scenes)s.preservePauses=true;
    if(kind==='window')p.audio.timingRepair={preserveWindows:[{start:0,end:p.meta.durationSeconds,reason:'Wait for the demonstrated action'}]};
    write(f.file,p);const sourcePcm=pcmHash(f.source);const report=await repairAcousticTiming(f.file);const after=read(f.file);
    assert.equal(report.changes.pauseCuts.length,0,kind);assert.ok(report.protectedWindows.length>0,kind);assert.equal(after.meta.durationSeconds,p.meta.durationSeconds,kind);assert.equal(pcmHash(path.join(f.job,after.audio.sourceVoiceover??after.audio.voiceover)),sourcePcm,kind);
  }
});

test('imported narration is audit-only by default and does not modify authored timing or source',async t=>{
  const {job,file,source}=fixture(t,{sourceMode:'imported'});const before=fs.readFileSync(file),alignment=fs.readFileSync(path.join(job,'alignment/alignment-report.json')),audio=hash(source);
  const report=await repairAcousticTiming(file);assert.equal(report.state,'audit-only');assert.deepEqual(fs.readFileSync(file),before);assert.deepEqual(fs.readFileSync(path.join(job,'alignment/alignment-report.json')),alignment);assert.equal(hash(source),audio);
});

test('stale narration alignment blocks automatic acoustic edits without replacing prior delivery or canonical evidence',async t=>{
  const {job,file}=fixture(t);fs.mkdirSync(path.join(job,'output'));fs.writeFileSync(path.join(job,'output/video.mp4'),'prior delivery');
  const rfile=path.join(job,'alignment/alignment-report.json'),r=read(rfile);r.audioSha256='stale';write(rfile,r);const before=fs.readFileSync(file),alignment=fs.readFileSync(rfile);
  await assert.rejects(repairAcousticTiming(file),e=>e.acousticTimingBlocked===true);
  assert.deepEqual(fs.readFileSync(file),before);assert.deepEqual(fs.readFileSync(rfile),alignment);assert.equal(fs.readFileSync(path.join(job,'output/video.mp4'),'utf8'),'prior delivery');
});

test('protection includes the outgoing twelve-frame demonstration transition',()=>{
  const plan={meta:{fps:30,durationSeconds:5},audio:{},scenes:[{id:'demo',start:0,end:2,visual:{kind:'video'},transition:'fade',captionIds:['a']},{id:'next',start:2,end:5,transition:'cut',captionIds:['b']}],captions:[{id:'a',text:'A.',start:0,end:1},{id:'b',text:'B.',start:3,end:4}]};
  const result=planRepairs(plan,[{start:1.7,end:3,duration:1.3}]);assert.ok(result.protectedWindows.some(w=>w.start<=2&&w.end>=2.4));assert.equal(result.cuts.length,0);
});

const phraseFixture = t => {
  const f=fixture(t,{duration:2.8,bands:[{start:0,end:1},{start:1.5,end:2.6}],captions:[{id:'c',text:'Hello world.',start:0,end:2.6}]});
  const candidate=path.join(f.job,'audio/candidate.wav');wav(candidate,2.3,[{start:.08,end:2.1}]);
  const verification={status:'matched',audioSha256:hash(candidate),proposed:[{id:'c',text:'Hello world.',start:.08,end:2.1,alignment:{coverage:1,minimumWordProbability:.99}}],issues:[]};
  const result={file:candidate,words:[{word:'Hello',start:.08,end:1,probability:.99},{word:'world',start:1,end:2.1,probability:.99}],meta:{text:'Hello world.',audioSha256:hash(candidate),verification}};
  fs.mkdirSync(path.join(f.job,'output'));fs.writeFileSync(path.join(f.job,'output/video.mp4'),'old delivery');
  return {...f,result};
};

test('unpunctuated phrase interruption is replaced only with verified whole-phrase audio and preserves other source/delivery',async t=>{
  const f=phraseFixture(t),oldSource=hash(f.source),oldAlignment=fs.readFileSync(path.join(f.job,'alignment/alignment-report.json'));let called=0;
  const report=await repairAcousticTiming(f.file,{repairPhrase:async args=>{called++;assert.equal(args.caption.text,'Hello world.');assert.equal(args.provider,'voxcpm2');return f.result;}});
  assert.equal(called,1);assert.equal(report.state,'applied');assert.equal(report.changes.phraseRepairs.length,1);
  const p=read(f.file);assert.deepEqual(p.captions.map(c=>c.text),['Hello world.']);assert.ok(p.captions[0].start>=.07&&p.captions[0].start<=.1);
  assert.equal(hash(f.source),oldSource);assert.equal(fs.readFileSync(path.join(f.job,'output/video.mp4'),'utf8'),'old delivery');
  assert.equal(report.outputAudioSha256,hash(path.join(f.job,p.audio.sourceVoiceover)));
  assert.deepEqual(fs.readFileSync(path.join(f.job,report.originalAlignment.file)),oldAlignment);
});

test('failed phrase synthesis or text verification preserves canonical plan, accepted evidence and delivery',async t=>{
  for(const fail of ['throw','unmatched']){
    const f=phraseFixture(t),before=fs.readFileSync(f.file),alignmentFile=path.join(f.job,'alignment/alignment-report.json'),alignment=fs.readFileSync(alignmentFile),sourceHash=hash(f.source);
    await assert.rejects(repairAcousticTiming(f.file,{repairPhrase:async()=>{if(fail==='throw')throw Error('fixture synthesis unavailable');return {...f.result,meta:{...f.result.meta,verification:{...f.result.meta.verification,status:'needs-review'}}};}}),e=>e.acousticTimingBlocked===true);
    assert.deepEqual(fs.readFileSync(f.file),before);assert.deepEqual(fs.readFileSync(alignmentFile),alignment);assert.equal(hash(f.source),sourceHash);assert.equal(fs.readFileSync(path.join(f.job,'output/video.mp4'),'utf8'),'old delivery');
    assert.ok(fs.readdirSync(path.join(f.job,'alignment')).some(n=>n.startsWith('acoustic-timing-rejected-')));
  }
});

test('malformed phrase word times are rejected before committing new audio/timeline evidence',async t=>{
  const f=phraseFixture(t),before=fs.readFileSync(f.file),a=path.join(f.job,'alignment/alignment-report.json'),evidence=fs.readFileSync(a);
  const invalid={...f.result,words:[{...f.result.words[0],start:NaN},f.result.words[1]]};
  await assert.rejects(repairAcousticTiming(f.file,{repairPhrase:async()=>invalid}),e=>e.acousticTimingBlocked===true);
  assert.deepEqual(fs.readFileSync(f.file),before);assert.deepEqual(fs.readFileSync(a),evidence);
});

test('same-source acoustic evidence cannot be silently regenerated after deletion or modification',async t=>{
  for(const kind of ['missing','modified']){
    const f=fixture(t);await repairAcousticTiming(f.file);const before=fs.readFileSync(f.file),evidenceFile=path.join(f.job,'alignment/acoustic-timing-report.json');
    if(kind==='missing')fs.rmSync(evidenceFile);else fs.appendFileSync(evidenceFile,' ');
    await assert.rejects(repairAcousticTiming(f.file),e=>e.acousticTimingBlocked===true);
    assert.deepEqual(fs.readFileSync(f.file),before);
  }
});

test('explicit minimum demonstration duration inserts only silence, preserves spoken samples and does not extend old captions into the hold',async t=>{
  const f=fixture(t,{duration:3.2,bands:[{start:0,end:1.2,frequency:997},{start:1.2,end:2.8,frequency:1901}],captions:[{id:'c1',text:'Demonstration.',start:0,end:1.2},{id:'c2',text:'After.',start:1.2,end:2.8}]});
  const p=read(f.file);p.scenes[0].preservePauses=true;p.scenes[0].minimumDurationSeconds=2;p.scenes[0].pausePreservationReason='Allow the demonstrated action to finish after re-synthesis';write(f.file,p);
  const sourceHash=hash(f.source),decode=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-ac','1','-ar','48000','-f','s16le','-']);
  const originalPcm=decode(f.source),at=Math.round(1.2*48000)*2,addedBytes=Math.round(.8*48000)*2;
  const report=await repairAcousticTiming(f.file),after=read(f.file),editedPcm=decode(path.join(f.job,after.audio.sourceVoiceover));
  assert.equal(report.state,'applied');assert.equal(report.changes.demonstrationHolds.length,1);assert.equal(report.changes.demonstrationHolds[0].sceneId,'s0');assert.ok(Math.abs(report.changes.demonstrationHolds[0].addedSeconds-.8)<1/48000);
  assert.equal(report.changes.pauseCuts.length,0);assert.equal(report.changes.phraseRepairs.length,0);
  assert.deepEqual(editedPcm,Buffer.concat([originalPcm.subarray(0,at),Buffer.alloc(addedBytes),originalPcm.subarray(at)]),'only zero PCM samples are inserted; every speech sample is preserved');
  assert.equal(hash(f.source),sourceHash);assert.deepEqual(after.captions.map(c=>c.text),p.captions.map(c=>c.text));
  assert.equal(after.captions[0].end,1.2,'the old spoken caption must not remain displayed across new demonstration silence');
  assert.equal(after.captions[1].start,2);assert.equal(after.captions[1].end,3.6);assert.equal(after.scenes[0].start,0);assert.equal(after.scenes[0].end,2);assert.equal(after.scenes[1].start,2);assert.equal(after.scenes[1].end,4);assert.equal(after.meta.durationSeconds,4);
  const canonical=fs.readFileSync(f.file),alignment=fs.readFileSync(path.join(f.job,'alignment/alignment-report.json'));
  const again=await repairAcousticTiming(f.file);assert.equal(again.reused,true);assert.deepEqual(fs.readFileSync(f.file),canonical);assert.deepEqual(fs.readFileSync(path.join(f.job,'alignment/alignment-report.json')),alignment);assert.deepEqual(decode(path.join(f.job,read(f.file).audio.sourceVoiceover)),editedPcm);
});

test('explicitly disabled re-synthesis never invokes a phrase provider and retains canonical plan, evidence and prior delivery',async t=>{
  const f=phraseFixture(t),before=fs.readFileSync(f.file),alignmentFile=path.join(f.job,'alignment/alignment-report.json'),alignment=fs.readFileSync(alignmentFile),source=hash(f.source);let called=0;
  await assert.rejects(repairAcousticTiming(f.file,{allowResynthesis:false,repairPhrase:async()=>{called++;return f.result;}}),e=>e.acousticTimingBlocked===true);
  assert.equal(called,0,'--tts=none must not trigger local or paid cloud phrase synthesis');
  assert.deepEqual(fs.readFileSync(f.file),before);assert.deepEqual(fs.readFileSync(alignmentFile),alignment);assert.equal(hash(f.source),source);assert.equal(fs.readFileSync(path.join(f.job,'output/video.mp4'),'utf8'),'old delivery');
});

test('subtitle onset ignores a sub-four-millisecond transient inside silence without deleting the pulse from narration',async t=>{
  const f=fixture(t,{duration:2.2,bands:[{start:0,end:.6},{start:.9,end:.901,amplitude:4000},{start:1.3,end:2}],captions:[{id:'c1',text:'First.',start:0,end:.6},{id:'c2',text:'Second.',start:.8,end:2}]});
  const original=hash(f.source),decode=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-ac','1','-ar','48000','-f','s16le','-']),before=decode(f.source);
  const pulseStart=Math.round(.9*48000)*2,pulseEnd=Math.round(.901*48000)*2;assert.ok(before.subarray(pulseStart,pulseEnd).some(v=>v!==0));
  const report=await repairAcousticTiming(f.file),after=read(f.file),output=path.join(f.job,after.audio.sourceVoiceover??after.audio.voiceover);
  assert.equal(report.state,'applied');assert.ok(after.captions[1].start>=1.24&&after.captions[1].start<=1.30,`expected onset near 1.27, got ${after.captions[1].start}`);
  assert.equal(report.changes.pauseCuts.length,0);assert.equal(report.changes.phraseRepairs.length,0);assert.equal(after.meta.durationSeconds,2.2);
  assert.equal(hash(f.source),original);assert.deepEqual(decode(output),before,'activity merging is only an onset decision; source waveform and the pulse remain byte-identical');
});

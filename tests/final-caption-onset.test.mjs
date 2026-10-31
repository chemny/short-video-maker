import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {inspectExportedCaptionOnsets} from '../scripts/lib/acoustic-timing.mjs';

// Real AAC fixtures exercise post-encode silence evidence, not spoken pronunciation.
const fixture = t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'svm-final-onset-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const video=path.join(dir,'final.mp4');
  execFileSync('ffmpeg',['-v','error','-nostdin','-n','-f','lavfi','-i','color=c=navy:s=320x180:r=30:d=1.4','-f','lavfi','-i','sine=frequency=997:sample_rate=48000:duration=1','-filter_complex','[1:a]adelay=400:all=1[a]','-map','0:v','-map','[a]','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t','1.4',video],{stdio:'pipe'});
  const plan={meta:{fps:30},cover:{introSeconds:0},audio:{acousticTiming:{version:'acoustic-v1'}},scenes:[],captions:[{id:'c',text:'Synthetic tone fixture.',start:0,end:1.4}]};
  return {video,plan};
};

test('final AAC caption check rejects a 400ms silent lead and passes a caption 30ms before measured speech',t=>{
  const {video,plan}=fixture(t);
  const streams=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',video],{encoding:'utf8'})).streams;
  assert.equal(streams.find(s=>s.codec_type==='audio').codec_name,'aac');
  const early=inspectExportedCaptionOnsets(video,plan);assert.equal(early.status,'needs-review');assert.equal(early.issues.length,1);assert.equal(early.issues[0].captionId,'c');assert.ok(early.issues[0].silentLead>=.35&&early.issues[0].silentLead<.46);
  const aligned=structuredClone(plan);aligned.captions[0].start=.37;
  const passed=inspectExportedCaptionOnsets(video,aligned);assert.equal(passed.status,'passed');assert.deepEqual(passed.issues,[]);assert.equal(passed.thresholdSeconds,.2);
});

test('BGM and audible native media report an explicit mixed-audio limitation rather than measured human-voice silence approval',t=>{
  const {video,plan}=fixture(t);
  for(const kind of ['bgm','native']){
    const mixed=structuredClone(plan);if(kind==='bgm')mixed.audio.bgm='background-music.wav';else mixed.scenes=[{visual:{kind:'video',sourceVolume:.3}}];
    const result=inspectExportedCaptionOnsets(video,mixed);assert.equal(result.status,'isolated-source-verified',kind);assert.deepEqual(result.issues,[]);assert.ok(result.limits?.some(s=>/masks|mask|遮蔽/i.test(s)),kind);assert.ok(result.limits.some(s=>/isolated narration|独立旁白/i.test(s)),kind);
  }
});

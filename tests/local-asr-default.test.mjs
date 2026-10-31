import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sceneTranscripts} from '../scripts/lib/scene-transcripts.mjs';
import {resolveLocalAsr} from '../scripts/lib/local-asr.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixture = t => {
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'svm-default-asr-')));
  t.after(() => fs.rmSync(folder, {recursive: true, force: true}));
  const audio = path.join(folder, 'speech.wav');
  execFileSync('ffmpeg', ['-v','error','-nostdin','-n','-f','lavfi','-i','sine=frequency=440:duration=2:sample_rate=48000','-c:a','pcm_s16le',audio]);
  const model = path.join(folder,'mlx'); fs.mkdirSync(model);fs.writeFileSync(path.join(model,'config.json'),'{}');fs.writeFileSync(path.join(model,'weights.safetensors'),'fixture');
  return {folder,audio,model};
};

test('default alignment honors configured MLX while explicit --model wins and stale acoustic evidence is removed', t => {
  const {folder,audio,model}=fixture(t),python=path.join(folder,'fixture-python');
  fs.writeFileSync(python,`#!/usr/bin/env python3
import sys,json,hashlib,pathlib,os
a=sys.argv[1:]
if a[0]=='-c':
 model,audio,out,lang,mhash=a[2:];engine='fixture-mlx'
else:
 audio=a[1];opts=dict(zip(a[2::2],a[3::2]));out=opts['--out'];model=opts['--model'];lang=opts['--language'];mhash=hashlib.sha256(pathlib.Path(model).read_bytes()).hexdigest();engine='fixture-torch'
pathlib.Path(out).write_text(json.dumps({'audioSha256':hashlib.sha256(pathlib.Path(audio).read_bytes()).hexdigest(),'modelSha256':mhash,'engine':engine,'text':'Hello world.','words':[{'word':'Hello','start':.1,'end':.8,'probability':.99},{'word':'world','start':.8,'end':1.7,'probability':.99}]}))
with open(os.environ['ASR_SELECTION_LOG'],'a') as log:log.write(engine+' '+model+'\\n')
`);fs.chmodSync(python,0o755);
  const file=path.join(folder,'video-plan.json');fs.writeFileSync(file,JSON.stringify({meta:{language:'en-US',durationSeconds:2},cover:{},audio:{sourceVoiceover:'speech.wav',voiceover:'speech.wav',acousticTiming:{stale:true}},captions:[{id:'c',text:'Hello world.',start:0,end:2}],scenes:[{id:'s',start:0,end:2,voiceover:'Hello world.',captionIds:['c']}]}));
  const log=path.join(folder,'selected.log'),env={...process.env,SHORT_VIDEO_MLX_WHISPER_MODEL:model,SHORT_VIDEO_MLX_PYTHON:python,PYTHON3_BIN:python,ASR_SELECTION_LOG:log};
  const run=args=>execFileSync(process.execPath,[path.join(root,'scripts/align-narration.mjs'),file,'--apply',...args],{env,stdio:'pipe'});
  run([]);assert.equal(JSON.parse(fs.readFileSync(path.join(folder,'alignment/alignment-report.json'))).engine,'fixture-mlx');assert.equal(JSON.parse(fs.readFileSync(file)).audio.acousticTiming,undefined);
  const explicit=path.join(folder,'explicit.pt');fs.writeFileSync(explicit,'explicit fixture');run([`--model=${explicit}`]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(folder,'alignment/alignment-report.json'))).engine,'fixture-torch');
  assert.match(fs.readFileSync(log,'utf8'),/fixture-mlx .*mlx\nfixture-torch .*explicit\.pt\n/);
});

test('scene recognition caches a configured MLX directory by model and engine fingerprints', t => {
  const {folder,audio,model}=fixture(t);let calls=0;
  const transcribe=(file,out)=>{calls++;fs.writeFileSync(out,JSON.stringify({audioSha256:hash(file),modelSha256:resolveLocalAsr({model}).modelSha256,text:'one',words:[{word:'one',start:.1,end:1.7,probability:.99}]}));};
  const run=()=>sceneTranscripts({segments:[{file:audio,audioSha256:hash(audio)}],audioFile:audio,audioSha256:hash(audio),model,language:'en',folder,transcribe});
  const first=run();assert.equal(first.backend,'mlx');assert.equal(first.sceneCache[0].reused,false);assert.equal(run().sceneCache[0].reused,true);assert.equal(calls,1);
  fs.writeFileSync(path.join(model,'weights.safetensors'),'changed');assert.equal(run().sceneCache[0].reused,false);assert.equal(calls,2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {repairPhrase} from '../scripts/tts/repair-phrase.mjs';
import {resolveLocalAsr} from '../scripts/lib/local-asr.mjs';

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file));
const workspace = t => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'svm-phrase-repair-')));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const source = path.join(dir, 'source.wav'), generated = path.join(dir, 'generated.wav');
  for (const file of [source, generated]) execFileSync('ffmpeg', ['-v','error','-nostdin','-n','-f','lavfi','-i','sine=frequency=440:duration=2:sample_rate=48000','-c:a','pcm_s16le',file]);
  const planPath = path.join(dir, 'video-plan.json');
  fs.writeFileSync(planPath, JSON.stringify({meta: {language: 'en-US'}, audio: {sourceMode: 'tts', provider: 'voxcpm2', voice: 'plain-seed-42'},
    scenes: [{id: 's', voiceover: 'Hello world.', captionIds: ['c']}], captions: [{id: 'c', text: 'Hello world.', start: 0, end: 2}]}));
  fs.mkdirSync(path.join(dir, 'output')); fs.writeFileSync(path.join(dir, 'output/video.mp4'), 'prior delivery');
  return {dir, source, generated, planPath, outputDir: path.join(dir, 'candidates'), caption: {id: 'c', text: 'Hello world.'}};
};

test('phrase candidate requires real audio-bound exact words, retains probabilities and never commits the original job', async t => {
  const w = workspace(t), before = fs.readFileSync(w.planPath), original = hash(w.source);
  let observations = 0;
  const words = [{word:'Hello',start:.1,end:.8,probability:.97},{word:'world',start:.8,end:1.7,probability:.98}];
  const options = {adapters: {
    synthesize: async ({provider, options}) => {assert.equal(provider,'voxcpm2');assert.equal(options.seed,42);return {file:w.generated,meta:{fixture:true}};},
    observe: async ({audioFile}) => {observations++;return {audioSha256:hash(audioFile),text:'Hello world.',words};},
  }};
  const result = await repairPhrase({...w,sourceFile:w.source,provider:'voxcpm2',options});
  assert.equal(result.meta.verification.status,'matched'); assert.deepEqual(result.words,words);
  assert.equal(result.meta.timingOrigin,'independent-local-ASR-word-boundaries');
  assert.equal(result.meta.sourceSha256,original); assert.equal(hash(result.file),result.meta.audioSha256);
  await repairPhrase({...w,sourceFile:w.source,provider:'voxcpm2',options}); assert.equal(observations,1,'Exact cached independent observation reused');
  assert.deepEqual(fs.readFileSync(w.planPath),before);assert.equal(hash(w.source),original);
  assert.equal(fs.readFileSync(path.join(w.dir,'output/video.mp4'),'utf8'),'prior delivery');
  fs.appendFileSync(result.meta.transcriptFile,' ');
  await assert.rejects(()=>repairPhrase({...w,sourceFile:w.source,provider:'voxcpm2',options}),/ASR cache modified/);
});

test('mismatched recognition and wrong audio hash reject candidates without provider switching or approved-text changes', async t => {
  const w = workspace(t), before = fs.readFileSync(w.planPath);const providers=[];
  const options={adapters:{synthesize:async({provider})=>{providers.push(provider);return{file:w.generated};},observe:async({audioFile})=>({audioSha256:hash(audioFile),text:'Hello friend.',words:[{word:'Hello',start:.1,end:.8,probability:.99},{word:'friend',start:.8,end:1.7,probability:.99}]})}};
  await assert.rejects(()=>repairPhrase({...w,provider:'voxcpm2',options}),/text\/timing verification rejected/);
  assert.deepEqual(providers,['voxcpm2']);assert.deepEqual(fs.readFileSync(w.planPath),before);
  assert.equal(fs.readdirSync(w.outputDir).some(f=>/^phrase-.*\.wav$/.test(f)),false);
  await assert.rejects(()=>repairPhrase({...w,provider:'voxcpm2',outputDir:path.join(w.dir,'wrong-hash'),options:{adapters:{...options.adapters,observe:async()=>({audioSha256:'wrong',words:[]})}}}),/transcript does not match/);
  await assert.rejects(()=>repairPhrase({...w,caption:{...w.caption,text:'Unapproved text.'},provider:'voxcpm2',options}),/unchanged approved caption/);
  await assert.rejects(()=>repairPhrase({...w,provider:'http',options}),/provider is never switched/);
});

test('supplier word timestamps can verify a cloud phrase, while macOS phrase durations alone cannot replace recognition', async t => {
  const w=workspace(t);let observations=0;
  const plan=json(w.planPath);plan.audio={sourceMode:'tts',provider:'edge',voice:'fixture-voice',rate:'+10%'};fs.writeFileSync(w.planPath,JSON.stringify(plan));
  const words=[{word:'Hello',start:.1,end:.8,probability:1},{word:'world',start:.8,end:1.7,probability:1}];
  const adapters={synthesize:async({provider,options})=>{if(provider==='edge'){assert.equal(options.voice,'fixture-voice');assert.equal(options.rate,'+10%');}else{assert.equal(options.voice,undefined);assert.equal(options.rate,undefined);}return {file:w.generated,words,meta:{timingOrigin:'fixture-provider-words'}};},observe:async({audioFile})=>{observations++;return {audioSha256:hash(audioFile),words};}};
  const cloud=await repairPhrase({...w,provider:'edge',options:{adapters}});assert.equal(observations,0);assert.match(cloud.meta.timingOrigin,/not ASR confidence/);
  assert.deepEqual(json(cloud.meta.transcriptFile).words,words);
  await assert.rejects(()=>repairPhrase({...w,provider:'local',options:{adapters}}),/must match the current narration provider/);
  plan.audio={sourceMode:'tts',provider:'local',voice:'system-default',rate:'system-default'};fs.writeFileSync(w.planPath,JSON.stringify(plan));
  const local=await repairPhrase({...w,provider:'local',outputDir:path.join(w.dir,'mac-candidate'),options:{adapters}});assert.equal(observations,1);assert.equal(local.meta.timingOrigin,'independent-local-ASR-word-boundaries');
  plan.audio.sourceMode='imported';fs.writeFileSync(w.planPath,JSON.stringify(plan));
  await assert.rejects(()=>repairPhrase({...w,provider:'local',options:{adapters}}),/Imported narration is protected/);assert.equal(observations,1);
});

test('fixture-only Chinese Edge word contract verifies without local Python or local ASR', async t => {
  const w=workspace(t),plan=json(w.planPath),text='你好，世界。';
  plan.meta.language='zh-CN';plan.audio={sourceMode:'tts',provider:'edge',voice:'zh-CN-XiaoxiaoNeural'};
  plan.captions[0].text=text;plan.scenes[0].voiceover=text;fs.writeFileSync(w.planPath,JSON.stringify(plan));
  const before=fs.readFileSync(w.planPath),old=process.env.PYTHON3_BIN;process.env.PYTHON3_BIN='/no-local-python';
  t.after(()=>{if(old===undefined)delete process.env.PYTHON3_BIN;else process.env.PYTHON3_BIN=old;});
  // Synthetic audio exercises the supplier timestamp contract only. This does
  // not represent a real cloud call or certify the tone fixture as Chinese speech.
  const words=[{word:'你好',start:.1,end:.8,probability:1},{word:'世界',start:.8,end:1.7,probability:1}];
  let observations=0;
  const result=await repairPhrase({...w,caption:{...w.caption,text},provider:'edge',options:{adapters:{
    synthesize:async({provider})=>{assert.equal(provider,'edge');return {file:w.generated,words,meta:{timingOrigin:'fixture-provider-word-contract'}};},
    observe:async()=>{observations++;throw Error('Cloud word-contract fixture must not call local ASR');},
  }}});
  assert.equal(observations,0);assert.equal(result.meta.verification.status,'matched');
  assert.deepEqual(result.words,words);assert.match(result.meta.timingOrigin,/not ASR confidence/);
  assert.deepEqual(json(result.meta.transcriptFile).words,words);assert.deepEqual(fs.readFileSync(w.planPath),before);
});

test('local ASR resolves explicit existing model files or MLX directories with fingerprint invalidation and no download', t => {
  const w=workspace(t),model=path.join(w.dir,'model.pt'),mlx=path.join(w.dir,'mlx');fs.writeFileSync(model,'fixture model');fs.mkdirSync(mlx);
  fs.writeFileSync(path.join(mlx,'config.json'),'{}');fs.writeFileSync(path.join(mlx,'weights.safetensors'),'fixture weights');
  const old=process.env.SHORT_VIDEO_MLX_WHISPER_MODEL;process.env.SHORT_VIDEO_MLX_WHISPER_MODEL=mlx;
  t.after(()=>{if(old===undefined)delete process.env.SHORT_VIDEO_MLX_WHISPER_MODEL;else process.env.SHORT_VIDEO_MLX_WHISPER_MODEL=old;});
  assert.equal(resolveLocalAsr({model}).backend,'torch');const first=resolveLocalAsr({mlxModel:mlx,python:'/existing/python'});assert.equal(first.backend,'mlx');assert.equal(first.python,'/existing/python');
  fs.writeFileSync(path.join(mlx,'weights.safetensors'),'changed weights');assert.notEqual(resolveLocalAsr({mlxModel:mlx}).modelSha256,first.modelSha256);
  assert.throws(()=>resolveLocalAsr({model:path.join(w.dir,'missing.pt')}),/No model is installed or downloaded/);
});

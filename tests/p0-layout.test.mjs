import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('actual browser measures all three aspects and blocks overflowing text instead of clipping it', {skip:process.env.SHORT_VIDEO_RENDER_SMOKE!=='1',timeout:300000},t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'svm-layout-test-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const [w,h]of [[1920,1080],[1080,1920],[1080,1440]])for(const bad of [false,true]){
  const job=path.join(dir,`${w}-${h}-${bad}`);fs.mkdirSync(job);
  const p=JSON.parse(fs.readFileSync(path.join(root,'examples/material-plan.json')));p.meta.width=w;p.meta.height=h;p.meta.durationSeconds=2;p.style.template='responsive-report';p.cover.introSeconds=0;p.audio={intent:'silent'};
  p.scenes=[{id:'s',start:0,end:2,type:'explanation',layout:'flow',caption:bad?'必须完整显示的标题'.repeat(90):'图片格式怎么选',body:'先看内容，再看展示环境',voiceover:'这是测量样例。',captionIds:['c'],steps:['内容与透明度','兼容和清晰度','比较实际文件'],transition:'cut',motion:{type:'none'}}];
  p.captions=[{id:'c',text:'这是需要完整显示的字幕，包含相同关键词，字幕里的相同关键词不会消失。',start:0,end:2,keywords:['相同关键词']}];
  const file=path.join(job,'video-plan.json');fs.writeFileSync(file,JSON.stringify(p));
  const r=spawnSync(process.execPath,[path.join(root,'scripts/check-layout.mjs'),file],{timeout:240000,encoding:'utf8',maxBuffer:12*1024*1024});
  const report=JSON.parse(fs.readFileSync(path.join(job,'layout-report.json')));
  if(bad){assert.notEqual(r.status,0);assert.equal(report.status,'blocked');assert.ok(report.errors.some(e=>/bounds|content area/.test(e)));}
  else{assert.equal(r.status,0,r.stderr);assert.equal(report.status,'passed');assert.equal(report.width,w);assert.ok(report.samples.length>=3);}
 }
});

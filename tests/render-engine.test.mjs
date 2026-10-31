import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {selectRenderEngine} from '../scripts/lib/render-engine.mjs';
import {buildHyperframesProject} from '../scripts/lib/hyperframes-project.mjs';
test('engine precedence preserves Remotion and rejects typos',()=>{
 assert.equal(selectRenderEngine({env:{}}),'remotion');
 assert.equal(selectRenderEngine({plan:{meta:{renderEngine:'hyperframes'}},env:{SHORT_VIDEO_RENDER_ENGINE:'remotion'}}),'hyperframes');
 assert.equal(selectRenderEngine({explicit:'remotion',plan:{meta:{renderEngine:'hyperframes'}},env:{}}),'remotion');
 assert.equal(selectRenderEngine({env:{SHORT_VIDEO_RENDER_ENGINE:'hyperframes'}}),'hyperframes');
 assert.throws(()=>selectRenderEngine({explicit:'hyperframe'}),/Unknown render engine/);
});
test('Hyperframes preserves source times, escapes text, fingerprints media and protects edits',t=>{
 if(!fs.existsSync(new URL('../hyperframes/node_modules/gsap/dist/gsap.min.js',import.meta.url)))return t.skip('Optional Hyperframes runtime not installed');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'svm-hf-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'clip.mp4'),'fixture-v1');fs.writeFileSync(path.join(dir,'mix.wav'),'fixture-audio');
 const p={meta:{width:1080,height:1920,fps:30,durationSeconds:3,topic:'<script>x</script>'},style:{},cover:{introSeconds:.5,title:'Test'},audio:{mix:'mix.wav'},scenes:[{start:0,end:3,caption:'A & B',visual:{asset:'clip.mp4',kind:'video',sourceStart:7,fit:'contain'}}],captions:[{start:.2,end:2.8,text:'<img src=x onerror=bad>'}]};
 const pp=path.join(dir,'video-plan.json');fs.writeFileSync(pp,JSON.stringify(p));const a=buildHyperframesProject(pp),html=fs.readFileSync(path.join(a.project,'index.html'),'utf8');
 assert.equal(a.durationSeconds,3.5);assert.match(html,/data-media-start="7"/);assert.match(html,/data-start="0.7" data-duration="2.5999999999999996"/);assert.match(html,/&lt;img src=x onerror=bad&gt;/);assert.doesNotMatch(html,/<script>x<\/script>/);assert.match(html,/muted playsinline/);assert.match(html,/<\/video>/);
 assert.equal(buildHyperframesProject(pp).identity,a.identity);
 fs.writeFileSync(path.join(dir,'clip.mp4'),'fixture-v2');assert.notEqual(buildHyperframesProject(pp).identity,a.identity);
 fs.writeFileSync(path.join(a.project,'index.html'),'human edit');fs.writeFileSync(path.join(dir,'clip.mp4'),'fixture-v1');assert.throws(()=>buildHyperframesProject(pp),/edited/);assert.equal(fs.readFileSync(path.join(a.project,'index.html'),'utf8'),'human edit');
});

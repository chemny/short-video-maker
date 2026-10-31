#!/usr/bin/env node
import {renderSource} from './lib/render-source.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {sha256} from './lib/production-audit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),remotion=path.join(root,'remotion');
const require=createRequire(path.join(remotion,'package.json'));
const {bundle}=require('@remotion/bundler');const {openBrowser,selectComposition,renderStill}=require('@remotion/renderer');
const file=path.resolve(process.argv[2]??'video-plan.json'),job=path.dirname(file),plan=JSON.parse(fs.readFileSync(file));
if(!['responsive-report','shotcraft-brief','directed-news'].includes(plan.style.template)&&!plan.meta.renderSource&&plan.style.componentSystem!=='semantic-v1')throw new Error('Measured layout coverage currently requires responsive-report; adapt to a supported aspect/template first');
const dir=path.join(job,'preview','layout');fs.mkdirSync(dir,{recursive:true});
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'svm-layout-'));
const offset=Math.round((plan.cover.introSeconds??.5)*plan.meta.fps),total=offset+Math.ceil(plan.meta.durationSeconds*plan.meta.fps);
const frames=new Set([0,total-1]);
for(const s of plan.scenes){
 const cues=plan.captions.filter(c=>s.captionIds?.includes(c.id));
 const longest=[...cues].sort((a,b)=>(b.lines?.map(l=>l.text).join('').length??b.text.length)-(a.lines?.map(l=>l.text).join('').length??a.text.length))[0];
 for(const t of [s.start+Math.min(.5,(s.end-s.start)/4),(s.start+s.end)/2,s.end-1/plan.meta.fps,...(longest?[(longest.start+longest.end)/2]:[])])frames.add(Math.max(0,Math.min(total-1,offset+Math.round(t*plan.meta.fps))));
}
if(plan.meta.directorVersion==='director-v1'){
 for(const c of plan.captions)frames.add(offset+Math.ceil((c.start+c.end)*plan.meta.fps/2));
 for(const s of plan.directorRender?.shots??[]){for(const t of [s.start,(s.start+s.end)/2,s.end-1/plan.meta.fps])frames.add(Math.max(0,offset+Math.ceil(t*plan.meta.fps)));const visit=x=>{if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if((k==='at'||k.endsWith('At'))&&typeof v==='number')for(const delta of[-1,15])frames.add(Math.max(0,Math.min(total-1,offset+Math.ceil(v*plan.meta.fps)+delta)));else visit(v);}};visit(s);}
}
const samples=[];let browser;const source=renderSource(plan,job);
try{
 const serveUrl=await bundle({entryPoint:source.entry,rootDir:source.cwd,publicDir:job,outDir:path.join(temporary,'bundle'),symlinkPublicDir:true});
 browser=await openBrowser('chrome',{browserExecutable:process.env.REMOTION_BROWSER_EXECUTABLE??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined)});
 const inputProps={plan:{...plan,style:{...plan.style,layoutAudit:true}}};
 const cover=await selectComposition({serveUrl,id:source.cover,inputProps,puppeteerInstance:browser});
 const coverLogs=[];
 await renderStill({serveUrl,composition:cover,inputProps,frame:0,output:path.join(dir,'cover.jpg'),imageFormat:'jpeg',scale:.5,puppeteerInstance:browser,
  onBrowserLog:log=>{if(log.text?.startsWith('SVM_LAYOUT ')){try{coverLogs.push(JSON.parse(log.text.slice(11)));}catch{}}}});
 samples.push({composition:'CoverStill',image:path.relative(job,path.join(dir,'cover.jpg')),...(coverLogs.at(-1)??{frame:0,errors:['No cover measurement received'],measurements:[]})});
 const composition=await selectComposition({serveUrl,id:source.composition,inputProps,puppeteerInstance:browser});
 for(const frame of [...frames].sort((a,b)=>a-b)){
  const logs=[];const image=path.join(dir,`${String(frame).padStart(6,'0')}.jpg`);
  await renderStill({serveUrl,composition,inputProps,frame,output:image,imageFormat:'jpeg',jpegQuality:86,scale:.5,puppeteerInstance:browser,
    onBrowserLog:log=>{if(log.text?.startsWith('SVM_LAYOUT ')){try{logs.push(JSON.parse(log.text.slice(11)));}catch{}}}});
  const measured=logs.filter(l=>l.frame===frame).at(-1);
  samples.push({composition:'ShortVideo',frame,image:path.relative(job,image),...(measured??{errors:['No browser measurement received'],measurements:[]})});
  console.log(`Layout frame ${frame}: ${samples.at(-1).errors.length} issue(s)`);
 }
 const errors=samples.flatMap(s=>s.errors.map(e=>`frame ${s.frame}: ${e}`));
 const report={schemaVersion:1,planSha256:sha256(JSON.stringify(plan)),width:plan.meta.width,height:plan.meta.height,status:errors.length?'blocked':'passed',errors,samples,
  limits:'Browser-measured sampled geometry and readable font size; not proof of semantic relevance, screenshot detail readability or every animation frame. Inspect saved frames and final render.'};
 fs.writeFileSync(path.join(job,'layout-report.json'),JSON.stringify(report,null,2)+'\n');
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
}finally{
 // Headless Chrome can exit before its page-disposal promises settle after
 // media-heavy still sampling. Bound teardown after the real report is saved;
 // never turn unfinished measurements into a successful report.
 let timeout;
 try{await Promise.race([browser?.close({silent:true}),new Promise(resolve=>{timeout=setTimeout(()=>{console.warn('Layout browser teardown timed out after measurements; closing the CLI.');resolve();},5000);})]);}
 finally{clearTimeout(timeout);fs.rmSync(temporary,{recursive:true,force:true});}
}
// This is a standalone CLI; renderer download streams may otherwise keep Node
// alive after Chrome and all measurements have completed.
process.exit(process.exitCode??0);

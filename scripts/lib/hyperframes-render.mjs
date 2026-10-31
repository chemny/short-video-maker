import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildHyperframesProject,digest} from './hyperframes-project.mjs';
import {finalizeAudio} from './audio-export.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export const hyperframesBin=()=>process.env.SHORT_VIDEO_HYPERFRAMES_BIN??path.join(root,'hyperframes/node_modules/.bin',process.platform==='win32'?'hyperframes.cmd':'hyperframes');
const cli=(args,cwd)=>execFileSync(hyperframesBin(),args,{cwd,stdio:'inherit',timeout:1800000,env:{...process.env,HYPERFRAMES_NO_TELEMETRY:'1'}});
export const runHyperframesJob=({planPath,preview=false,render=false,previewFrame,requireReview=false})=>{
 if(!fs.existsSync(hyperframesBin()))throw Error('Hyperframes CLI unavailable. Install the pinned optional runtime with npm ci --prefix hyperframes, or set SHORT_VIDEO_HYPERFRAMES_BIN. No fallback to Remotion.');
 const manifest=buildHyperframesProject(planPath),job=path.dirname(planPath),plan=JSON.parse(fs.readFileSync(planPath));
 cli(['lint',manifest.project],job);cli(['validate',manifest.project],job);cli(['inspect',manifest.project],job);
 if(previewFrame!==undefined){cli(['snapshot',manifest.project,'--at',String(previewFrame/plan.meta.fps),'--describe','false'],job);}
 fs.mkdirSync(path.join(job,'hyperframes'),{recursive:true});fs.writeFileSync(path.join(job,'hyperframes/latest.json'),JSON.stringify(manifest,null,2));
 if(!preview&&!render){console.log(`Hyperframes project prepared: ${manifest.project}`);return manifest;}
 const output=path.join(job,render?'hyperframes/delivery':'preview/hyperframes',manifest.identity.slice(0,24));fs.mkdirSync(output,{recursive:true});
 const video=path.join(output,'video.mp4'),reportPath=path.join(output,'engine-report.json');
 let reused=false;
 if(fs.existsSync(video)&&fs.existsSync(reportPath)){const r=JSON.parse(fs.readFileSync(reportPath));reused=r.status==='rendered'&&r.identity===manifest.identity&&r.videoSha256===digest(fs.readFileSync(video));}
 if(!reused){
  fs.rmSync(reportPath,{force:true});
  cli(['render',manifest.project,'--output',video,'--fps',String(plan.meta.fps),'--quality',render?'high':'draft','--workers','2'],job);
  const audio=finalizeAudio(planPath,output);
  const report={status:'rendered',engine:'hyperframes',identity:manifest.identity,video,videoSha256:digest(fs.readFileSync(video)),audioVerification:audio?.verification??null,editorialStatus:'review-required',quality:render?'high':'draft'};
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 }
 if(render){
  execFileSync(process.execPath,[path.join(root,'scripts/package-output.mjs'),planPath,output],{cwd:root,stdio:'inherit',timeout:180000});
  execFileSync('ffmpeg',['-v','error','-i',video,'-frames:v','1','-y',path.join(output,'cover.png')],{timeout:120000});
  execFileSync(process.execPath,[path.join(root,'scripts/quality-check.mjs'),planPath,output,'--require-render',...(requireReview?['--require-content-review']:[])],{cwd:root,stdio:'inherit',timeout:180000});
  fs.writeFileSync(path.join(output,'delivery-status.json'),JSON.stringify({status:'rendered',rendered:true,engine:'hyperframes',contentReview:'review-required'},null,2));
 }
 fs.writeFileSync(path.join(job,'hyperframes/latest.json'),JSON.stringify({...manifest,video,report:reportPath,reused},null,2));
 console.log(`Hyperframes ${render?'delivery':'complete draft preview'}: ${video} (reused: ${reused}; editorial review required)`);
 return {...manifest,video,reused};
};

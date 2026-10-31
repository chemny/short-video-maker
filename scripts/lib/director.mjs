import fs from 'node:fs';import path from 'node:path';import {createHash}from'node:crypto';
import{auditSentenceStoryboard,sentenceTimelineHash}from'./sentence-storyboard.mjs';
export const recipes=['media','question','list','evidence','keyword','comparison','steps','ability','distinction','ending','statement','time-budget'];
export const digest=v=>createHash('sha256').update(v).digest('hex');
export const directorIdentity=(plan,board)=>digest(JSON.stringify({timeline:sentenceTimelineHash(plan),board,template:plan.style.template}));
export function compileDirector(plan,board,{job}={}){
 if(plan.meta.directorVersion!=='director-v1')return {plan,report:{status:'not-selected',errors:[]}};
 const errors=[],fail=m=>errors.push('Director: '+m);if(job){errors.push(...auditSentenceStoryboard(plan,job).errors);try{const base=JSON.parse(fs.readFileSync(path.join(job,'baseline.json')));if(base.scriptSha256!==digest(fs.readFileSync(path.join(job,'script.md'))))fail('locked script is missing/stale');const brief=JSON.parse(fs.readFileSync(path.join(job,'narrative-brief.json')));for(const k of ['audience','thesis','context_gap','takeaway'])if(!brief[k]?.trim())fail(`narrative brief needs ${k}`);}catch(e){fail('script/brief evidence: '+e.message);}}
 if(board.directorVersion!==1)fail('authored director version required');
 const rowFields=['understanding','visualContribution','claimType'];
 for(const r of board.rows??[]){for(const k of rowFields)if(typeof r[k]!=='string'||!r[k].trim())fail(`${r.captionId}: ${k} required`);if(!['fact','opinion','context','instruction','historical-example'].includes(r.claimType))fail(`${r.captionId}: invalid claimType`);}
 if(plan.style.template!=='directed-news'&& !plan.meta.renderSource)fail('select directed-news or a declared authored renderer');
 if(plan.style.componentSystem==='semantic-v1')fail('directed recipes cannot be combined with implicit semantic routing');
 if(plan.meta.renderEngine&&plan.meta.renderEngine!=='remotion')fail('director-v1 currently requires Remotion');
 if(!plan.meta.renderSource&&(plan.meta.width!==1080||plan.meta.height!==1920||plan.meta.fps!==30))fail('directed-news candidate currently supports1080x1920/30fps only');
 const bounded=(obj)=>{if(typeof obj==='string'&&obj.length>160)fail('screen text exceeds160characters; split the expression');if(Array.isArray(obj)){if(obj.length>8)fail('too many elements in a recipe');obj.forEach(bounded);}else if(obj&&typeof obj==='object')Object.values(obj).forEach(bounded);};
 const shots=(board.shots??[]).map(s=>{
  if(!recipes.includes(s.recipe)&&!plan.meta.renderSource)fail(`${s.id}: unsupported recipe ${s.recipe}`);
  if(!['context-first','spoken-cues'].includes(s.revealPolicy)||typeof s.motionPurpose!=='string'||!s.motionPurpose.trim())fail(`${s.id}: revealPolicy and motionPurpose required`);
  const owns=c=>(board.rows??[]).some(r=>r.shotId===s.id&&r.captionId===c.id);
  let anchors=0;
  const resolve=(value,key='')=>{
   if(value&&typeof value==='object'&&!Array.isArray(value)&&'captionId'in value){
    const c=plan.captions.find(c=>c.id===value.captionId);if(!c||!owns(c)){fail(`${s.id}: cue references a caption outside its shot`);return s.start;}
    const offset=value.offsetSeconds??0,edge=value.edge??'start';if(!['start','end'].includes(edge)||!Number.isFinite(offset)){fail(`${s.id}: invalid caption cue`);return s.start;}
    const at=(edge==='end'?c.end:Math.max(c.start,c.displayStart??c.start))+offset;anchors++;
    if(at<c.start-.001||at>c.end+.001||at<s.start-.001||at>=s.end)fail(`${s.id}: cue outside caption or shot`);return at;
   }
   if((key==='at'||key.endsWith('At'))&&typeof value==='number')fail(`${s.id}: ${key} must use a real caption anchor`);
   if(Array.isArray(value))return value.map(x=>resolve(x));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v,k)]));return value;
  };
  const result=resolve(s);bounded(s.blocks??[]);for(const key of ['title','kicker','result','body','lead'])if(typeof s[key]==='string'&&s[key].length>(key==='title'?24:80))fail(`${s.id}: ${key} exceeds recipe text limit`);
  if(s.items?.length>3||s.cards?.length>2||s.blocks?.length>4)fail(`${s.id}: recipe outside bounded layout`);
  if(s.recipe==='media'&&!['image','video'].includes(s.kind))fail(`${s.id}: media recipe needs actual image/video`);
  if(s.recipe==='list'&&!s.items?.length)fail(`${s.id}: list needs authored items`);
  if(s.recipe==='evidence'&&(!s.number||!s.numberAt||!s.source))fail(`${s.id}: evidence needs value, source and spoken anchor`);
  const required={question:['context','subject','lead','value','at'],keyword:['value','bodyAt'],comparison:['cards'],steps:['items'],ability:['context','value','question','questionAt','task','taskAt'],distinction:['a','aAt','aResult','aResultAt','b','bAt','bResult','bResultAt'],statement:['blocks'],'time-budget':['parts','contrast','contrastAt','total','totalAt']}[s.recipe]??[];
  for(const key of required)if(s[key]===undefined||s[key]===''||Array.isArray(s[key])&&!s[key].length)fail(`${s.id}: ${s.recipe} needs ${key}`);
  if(s.result&&!s.resultAt)fail(`${s.id}: result needs its own spoken anchor`);
  if(s.recipe==='time-budget'&&s.parts?.length!==4)fail(`${s.id}: time-budget needs four named phases`);
  for(const key of ['items','cards','blocks','parts'])for(const item of s[key]??[]){if(!item.at)fail(`${s.id}: ${key} item needs an explicit cue`);if(!String(item.label??item.text??'').trim())fail(`${s.id}: empty ${key} content`);}
  if(s.recipe==='ending'&&(!s.cards?.length||!s.lead||!s.leadAt))fail(`${s.id}: ending needs role cards and an anchored lead`);
  if(s.revealPolicy==='spoken-cues'&&!anchors)fail(`${s.id}: spoken-cues has no actual caption anchor`);
  return result;
 });
 const out=structuredClone(plan);out.directorRender={version:1,sourceSha256:directorIdentity(plan,board),shots};
 return{plan:out,report:{status:errors.length?'blocked':'compiled',errors,captionRows:board.rows?.length??0,shots:shots.length,sourceSha256:out.directorRender.sourceSha256,limits:'Checks declared decisions and actual caption anchors. Semantic relevance and aesthetic/listening quality require real review.'}};
}
export function compileDirectorFile(planPath){const plan=JSON.parse(fs.readFileSync(planPath));if(plan.meta.directorVersion!=='director-v1')return {status:'not-selected',errors:[]};const job=path.dirname(planPath),board=JSON.parse(fs.readFileSync(path.join(job,'sentence-storyboard.json'))),r=compileDirector(plan,board,{job});fs.writeFileSync(path.join(job,'director-report.json'),JSON.stringify(r.report,null,2)+'\n');if(r.report.errors.length)throw Error(r.report.errors.join('\n'));fs.writeFileSync(planPath,JSON.stringify(r.plan,null,2)+'\n');return r.report;}

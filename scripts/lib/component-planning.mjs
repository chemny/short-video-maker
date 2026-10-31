import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {componentSource} from '../../components/source.mjs';
import {inspectAsset} from './media-assets.mjs';
export const componentRegistry=JSON.parse(fs.readFileSync(new URL('../../components/registry.json',import.meta.url)));
const entries=new Map(componentRegistry.components.map(c=>[c.id,c]));const sha=s=>createHash('sha256').update(s).digest('hex');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const localAsset=x=>typeof x==='string'&&x&&!path.isAbsolute(x)&&!x.includes('://')&&!x.split(/[\\/]/).includes('..');
const arrays=(p,key,min,max,check)=>p[key]!==undefined&&(!Array.isArray(p[key])||p[key].length<min||p[key].length>max||p[key].some(x=>!check(x)));
export const validateComponentInput=plan=>{
 const errors=[];
 if(plan.style?.componentSystem!==undefined&&!['semantic-v1','off'].includes(plan.style.componentSystem))errors.push('Unknown style.componentSystem');
 for(const s of plan.scenes??[]){const c=s.visualComponent;if(!c)continue;const e=entries.get(c.id);if(!e){errors.push(`${s.id}: unknown component ${c.id}`);continue;}
 if(c.variant!==undefined&&!e.variants.includes(c.variant))errors.push(`${s.id}: unsupported component variant`);
 if(c.props!==undefined&&(!c.props||typeof c.props!=='object'||Array.isArray(c.props))){errors.push(`${s.id}: component props must be an object`);continue;}
 const p=c.props??{};
 const allowed=new Set(['title','body','items','columns','metric','stats','labels','series','shares','person','focus','routes','panels','quote','attribution','from','to','prompt']);for(const key of Object.keys(p))if(!allowed.has(key))errors.push(`${s.id}: unknown component prop ${key}`);
 if(p.items?.length>3&&p.items.some(x=>typeof x==='string'&&x.length>20))errors.push(`${s.id}: dense lists need at most 20 characters per item`);
 for(const [key,max] of [['title',50],['body',180],['quote',100],['attribution',70],['from',14],['to',14],['prompt',60]])if(p[key]!==undefined&&(typeof p[key]!=='string'||!p[key].trim()||[...p[key]].length>max))errors.push(`${s.id}: invalid ${key} text (limit ${max})`);
 if(arrays(p,'items',1,6,x=>typeof x==='string'&&x.trim()&&[...x].length<=50))errors.push(`${s.id}: items require 1–6 strings up to 50 characters`);
 if(arrays(p,'columns',2,2,x=>x&&typeof x.title==='string'&&x.title.length<=20&&(x.body===undefined||typeof x.body==='string'&&x.body.length<=80)))errors.push(`${s.id}: comparison requires two bounded columns`);
 if(p.metric&&(!finite(p.metric.value)||typeof p.metric.label!=='string'||p.metric.label.length>30||p.metric.unit&&typeof p.metric.unit!=='string'))errors.push(`${s.id}: metric requires numeric value and label`);
 if(arrays(p,'stats',1,4,x=>typeof x.value==='string'&&x.value.length<=14&&typeof x.label==='string'&&x.label.length<=30))errors.push(`${s.id}: invalid stats`);
 if(arrays(p,'labels',2,6,x=>typeof x==='string'&&x.length<=16))errors.push(`${s.id}: invalid chart labels`);
 if(arrays(p,'series',1,4,x=>typeof x.label==='string'&&x.label.length<=16&&Array.isArray(x.values)&&x.values.length>=2&&x.values.length<=6&&x.values.every(v=>finite(v)&&v>=0)))errors.push(`${s.id}: invalid numeric series`);
 if(p.series?.length&&(!p.labels||p.series.some(x=>x.values.length!==p.labels.length)))errors.push(`${s.id}: series and labels must have equal length`);
 if(arrays(p,'shares',2,4,x=>typeof x.label==='string'&&x.label.length<=20&&finite(x.value)&&x.value>0))errors.push(`${s.id}: invalid shares`);
 if(p.person&&(!p.person.name||typeof p.person.name!=='string'||p.person.name.length>20||p.person.role&&p.person.role.length>50))errors.push(`${s.id}: invalid person`);
 if(p.focus&&(!['x','y','width','height'].every(k=>finite(p.focus[k])&&p.focus[k]>=0&&p.focus[k]<=1)||p.focus.width<.4||p.focus.height<.3||p.focus.x+p.focus.width>1||p.focus.y+p.focus.height>1))errors.push(`${s.id}: focus must be a bounded normalized crop (width>=.4, height>=.3)`);
 if(arrays(p,'routes',1,3,x=>['from','to'].every(k=>x[k]&&finite(x[k].lng)&&Math.abs(x[k].lng)<=180&&finite(x[k].lat)&&Math.abs(x[k].lat)<=90&&(!x[k].label||typeof x[k].label==='string'&&x[k].label.length<=10))))errors.push(`${s.id}: invalid routes`);
 if(arrays(p,'panels',2,3,x=>x&&(!x.asset||localAsset(x.asset))&&(!x.asset||['image','video'].includes(x.kind))&&(!x.text||typeof x.text==='string'&&x.text.length<=80)&&(!x.label||typeof x.label==='string'&&x.label.length<=35)&&(!x.asset||x.kind!=='video'||finite(x.sourceStart)&&x.sourceStart>=0)&&(!x.sourceVolume||x.sourceVolume===0)))errors.push(`${s.id}: invalid panels; extra videos are explicitly muted`);
 if(c.cues!==undefined&&(!Array.isArray(c.cues)||c.cues.length>12))errors.push(`${s.id}: cues must be an array of at most 12 items`);
 for(const cue of Array.isArray(c.cues)?c.cues:[]){const cap=plan.captions?.find(x=>x.id===cue.captionId);if(!cap||!s.captionIds?.includes(cap.id))errors.push(`${s.id}: cue must refer to an owned caption`);if(cue.edge!==undefined&&!['start','end'].includes(cue.edge))errors.push(`${s.id}: invalid cue edge`);if(cue.offsetSeconds!==undefined&&!finite(cue.offsetSeconds))errors.push(`${s.id}: invalid cue offset`);if(cue.target!==undefined&&(!Number.isInteger(cue.target)||cue.target<0||cue.target>5))errors.push(`${s.id}: invalid cue target`);if(cue.action!==undefined&&!['reveal','focus','step','replace','open'].includes(cue.action))errors.push(`${s.id}: invalid cue action`);}
 }
 return errors;
};
const inferred=(s,plan)=>{
 if(s.visual?.asset)return s.visual.kind==='video'?'media':'evidence';
 if(s.data?.metric)return 'metric';if(s.data?.comparison)return 'compare';if(s.data?.stats?.length)return 'metric';
 const shape=s.contentShape;const m={comparison:'compare',process:'flow',timeline:'flow',list:'cards',chapter:'chapter',opinion:'takeaway',takeaway:'takeaway'};
 if(m[shape])return m[shape];if(s.steps?.length)return s.layout==='flow'?'flow':'cards';return s.type==='ending'||s.layout==='ending-card'?'takeaway':s.type==='hook'?'chapter':'takeaway';
};
const propsFor=(s,id)=>{
 const p={...(s.visualComponent?.props??{})};p.title??=s.caption;if(s.body)p.body??=s.body;
 if(s.steps?.length)p.items??=s.steps;
 if(s.data?.metric)p.metric??=s.data.metric;if(s.data?.stats)p.stats??=s.data.stats;
 if(id==='compare'&&!p.columns&&s.data?.comparison){const x=s.data.comparison;p.columns=[{title:'之前',body:String(x.before)},{title:'之后',body:String(x.after)}];p.body??=x.label;}
 if(id==='compare'&&!p.columns&&p.items?.length===2)p.columns=p.items.map(title=>({title}));
 return p;
};
const ready=(id,p,s)=>({media:!!s.visual?.asset,evidence:true,demo:!!s.visual?.asset,camera:!!s.visual?.asset&&!!p.focus,device:!!s.visual?.asset,parallax:!!s.visual?.asset,flow:!!p.items?.length,cards:!!p.items?.length,compare:!!p.columns?.length,metric:!!p.metric||!!p.stats?.length,identity:!!p.person,quote:!!p.quote&&!!p.attribution,chart:!!p.series?.length||!!p.shares?.length,montage:!!p.panels?.length,kinetic:!!p.from&&!!p.to,generation:!!p.prompt&&!!p.items?.length,globe:!!p.routes?.length,race:!!p.series?.length&&!!p.labels?.length,chapter:true,takeaway:true}[id]);
export const planComponents=(input,{job,mode}={})=>{
 const plan=structuredClone(input), errors=validateComponentInput(plan),warnings=[],rows=[];
 if(mode&&!['auto','off'].includes(mode))errors.push('components mode must be auto or off');
 if(mode==='auto')plan.style.componentSystem='semantic-v1';if(mode==='off')plan.style.componentSystem='off';
 if(plan.style.componentSystem!=='semantic-v1'){for(const s of plan.scenes??[])delete s.componentRender;return {plan,report:{status:errors.length?'blocked':'legacy',errors,warnings,rows}};}
 if(plan.meta.renderEngine==='hyperframes')errors.push('semantic-v1 components require Remotion; choose componentSystem=off for Hyperframes');
 if(errors.length)return {plan,report:{status:'blocked',errors,warnings,rows}};
 const videoUses=[];
 for(const [i,s]of plan.scenes.entries()){
  let id=s.visualComponent?.id??inferred(s,plan),p=propsFor(s,id),reason=s.visualComponent?'explicit authored choice':s.visual?.asset?'verified media first':'structured scene content';
  if(!ready(id,p,s)){if(s.visualComponent)errors.push(`${s.id}: ${id} lacks required content; see component registry`);else{id='takeaway';p=propsFor(s,id);reason='safe text fallback; insufficient structured content';}}
  const variant=s.visualComponent?.variant??(entries.get(id)?.enhanced?'default':(id==='chart'&&p.shares||id==='flow'&&s.contentShape==='timeline'||id==='metric'&&p.stats||id==='cards'&&(p.items?.length??0)<=3)?'b':'a');
  if(variant==='b'&&['evidence','media','demo'].includes(id)&&!p.focus)errors.push(`${s.id}: focused variant requires an authored focus rectangle`);
  if(id==='demo'&&variant==='b'&&!p.items?.length)errors.push(`${s.id}: demo step variant requires items`);
  if(id==='metric'&&variant==='b'&&!p.stats?.length)errors.push(`${s.id}: metric variant b requires stats`);
  if(id==='chart'&&(variant==='b'?!p.shares?.length:!p.series?.length))errors.push(`${s.id}: chart variant must match series or shares`);
  const capIds=s.captionIds??[];const caps=capIds.map(k=>plan.captions.find(c=>c.id===k)).filter(Boolean);
  if(!caps.length)errors.push(`${s.id}: semantic components require explicit captionIds; do not estimate timing from text length`);
  let count=p.items?.length??p.columns?.length??p.stats?.length??p.panels?.length??p.labels?.length??1;
  if(id==='race')count=p.labels?.length??1;if(id==='kinetic')count=2;if(id==='globe')count=p.routes?.length??1;
  const specs=s.visualComponent?.cues??Array.from({length:count},(_,n)=>({captionId:caps[0]?.id,target:n,action:'reveal'}));
  const events=specs.map((cue,n)=>{const c=caps.find(x=>x.id===cue.captionId);if(!c)return {id:`${s.id}-event-${n}`,at:NaN,target:cue.target??n,action:cue.action??'reveal'};
   const at=(cue.edge==='end'?c.end:Math.max(c.start,c.displayStart??c.start))+(cue.offsetSeconds??0);
   if(at<s.start-.001||at>=s.end||at<c.start-.001||at>c.end+.001)errors.push(`${s.id}: cue outside its caption/scene`);
   if(s.end-at<.45)warnings.push(`${s.id}: less than 450ms reading hold after cue ${n}`);
   return {id:`${s.id}-event-${n}`,at,target:cue.target??n,action:cue.action??'reveal',captionId:c.id};
  });
  if(events.some((e,n)=>!Number.isFinite(e.at)||n&&e.at<events[n-1].at))errors.push(`${s.id}: cue order must follow the approved caption timeline`);
  if(id==='kinetic'&&(events.length!==2||events[1].at<=events[0].at))errors.push(`${s.id}: correction requires two explicit chronological caption anchors`);
  if(id==='montage'&&variant==='b'&&events.some((e,n)=>n&&e.at<=events[n-1].at))errors.push(`${s.id}: sequential panels require distinct caption anchors`);
  if(id==='race'&&(events.length!==p.labels?.length||events.some((e,n)=>n&&e.at<=events[n-1].at)))errors.push(`${s.id}: ranking steps require distinct chronological caption anchors`);
  if(p.panels&&job)for(const [n,panel]of p.panels.entries())if(panel.asset){try{const file=path.resolve(job,panel.asset);if(!localAsset(panel.asset)||!fs.realpathSync(file).startsWith(fs.realpathSync(job)+path.sep))throw Error('outside job');const asset=inspectAsset(file);if(asset.kind!==panel.kind)throw Error('kind mismatch');if(panel.kind==='video'){const t=events.find(e=>e.target===n)?.at??s.start,next=events.find(e=>e.target===n+1)?.at??s.end;if((panel.sourceStart??0)+(variant==='a'?s.end-s.start:next-t)+(i<plan.scenes.length-1&&!['cut','none'].includes(s.transition)?.4:0)>asset.duration+.01)throw Error('too short; no looping or freezing');}}catch(e){errors.push(`${s.id}: panel ${n}: ${e.message}`);}}
  if(s.visual?.kind==='video'&&s.visual.asset){const a=s.visual.sourceStart??0,b=a+s.end-s.start;for(const old of videoUses)if(old.asset===s.visual.asset&&Math.max(0,Math.min(b,old.end)-Math.max(a,old.start))>Math.min(b-a,old.end-old.start)*.8&&!s.visualReuseReason)errors.push(`${s.id}: repeated video source interval requires visualReuseReason`);videoUses.push({asset:s.visual.asset,start:a,end:b});}
  const source=componentSource(plan,s);s.componentRender={version:1,id,variant,props:p,events,source,sourceSha256:sha(source)};
  rows.push({sceneId:s.id,id,variant,reason,start:s.start,end:s.end,events,timingMode:s.visualComponent?.cues?'authored-caption-anchors':'whole-group-onset',sourceSha256:sha(source),enhanced:entries.get(id)?.enhanced});
  if(i>=2&&rows.slice(-3).every(x=>x.id===id))warnings.push(`${s.id}: three consecutive ${id} scenes; review repetition or record a deliberate same-structure sequence`);
 }
 return {plan,report:{schemaVersion:1,status:errors.length?'blocked':'compiled',registrySha256:sha(JSON.stringify(componentRegistry)),errors,warnings,rows,limits:'Rule-based matching of authored structure; no claim of automatic semantic or listening approval. No guessed word timing.'}};
};
export const compileComponents=(file,options={})=>{const original=JSON.parse(fs.readFileSync(file)),{plan,report}=planComponents(original,{job:path.dirname(file),...options});fs.writeFileSync(path.join(path.dirname(file),'component-plan.json'),JSON.stringify(report,null,2)+'\n');if(report.errors.length)throw Error(report.errors.join('\n'));if(JSON.stringify(original)!==JSON.stringify(plan))fs.writeFileSync(file,JSON.stringify(plan,null,2)+'\n');return report;};

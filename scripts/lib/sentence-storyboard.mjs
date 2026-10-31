import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectAsset} from './media-assets.mjs';
export const sentenceTimelineHash = plan => createHash('sha256').update(JSON.stringify({audio:{voiceover:plan.audio?.voiceover,sourceVoiceover:plan.audio?.sourceVoiceover,sourceMode:plan.audio?.sourceMode},captions:plan.captions,scenes:plan.scenes.map(s=>({id:s.id,start:s.start,end:s.end,voiceover:s.voiceover,captionIds:s.captionIds}))})).digest('hex');
export function auditSentenceStoryboard(plan,job){
 const errors=[];const fail=x=>errors.push(`Sentence storyboard: ${x}`);let map;
 if(plan.audio?.voiceover)try{const b=JSON.parse(fs.readFileSync(path.join(job,'baseline.json'),'utf8'));const f=path.resolve(job,plan.audio.voiceover);if(!fs.realpathSync(f).startsWith(fs.realpathSync(job)+path.sep)||b.voiceover!==plan.audio.voiceover||b.voiceoverSha256!==createHash('sha256').update(fs.readFileSync(f)).digest('hex'))throw Error('audio baseline mismatch');}catch{fail('missing/stale locked voice baseline');}
 try{map=JSON.parse(fs.readFileSync(path.join(job,'sentence-storyboard.json'),'utf8'));}catch{fail('missing or unreadable sentence-storyboard.json');return {status:'blocked',errors};}
 if(map.schemaVersion!==1||map.timelineSha256!==sentenceTimelineHash(plan))fail('stale timeline fingerprint');
 const rows=Array.isArray(map.rows)?map.rows:[],shots=Array.isArray(map.shots)?map.shots:[],caps=plan.captions??[];
 if(rows.length!==caps.length)fail('one ordered row per caption required');
 const ids=new Set();let end=0;const videos=[];
 for(const s of shots){
  if(!s||ids.has(s.id)||typeof s.id!=='string'){fail('invalid/duplicate shot');continue;}ids.add(s.id);
  if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.end<=s.start||Math.abs(s.start-end)>.035)fail(`${s.id}: shot timeline gap/overlap`);end=s.end;
  if(!['video','image','diagram','quote','comparison','takeaway'].includes(s.kind))fail(`${s.id}: unsupported shot kind`);
  if(['video','image'].includes(s.kind))try{
   if(typeof s.asset!=='string'||path.isAbsolute(s.asset))throw Error('job-local media required');const f=path.resolve(job,s.asset),root=fs.realpathSync(job)+path.sep;if(!fs.realpathSync(f).startsWith(root))throw Error('media escapes job');const m=inspectAsset(f);if(m.kind!==s.kind)throw Error('media kind mismatch');if(s.fit!=='contain'&&s.fit!=='cover')throw Error('explicit fit required');if(s.fit==='cover'&&!s.cropReason)throw Error('crop requires reviewed reason');
   if(s.kind==='video'){if(!Number.isFinite(s.sourceStart)||s.sourceStart<0||s.sourceStart+s.end-s.start>m.duration+.02)throw Error('invalid/short source interval');if(s.sourceVolume!==0)throw Error('storyboard videos must be muted; use reviewed scene PCM tracks for native sound');const a=s.sourceStart,b=a+s.end-s.start;for(const v of videos)if(v.asset===s.asset&&Math.min(v.b,b)-Math.max(v.a,a)>.1&&!s.reuseReason)throw Error('repeated source interval without reason');videos.push({asset:s.asset,a,b});}
  }catch(e){fail(`${s.id}: ${e.message}`);}
 }
 if(Math.abs(end-plan.meta.durationSeconds)>.035)fail('shots do not cover the full film');
 for(const [i,c]of caps.entries()){
  const row=rows[i],scene=plan.scenes.find(s=>s.captionIds?.includes(c.id)),shot=shots.find(s=>s.id===row?.shotId);
  if(!row||row.captionId!==c.id||row.sceneId!==scene?.id||row.text!==c.text||row.start!==c.start||row.end!==c.end){fail(`${c.id}: missing/out-of-order/stale authored row`);continue;}
  if(!shot||c.start<shot.start-.035||c.end>shot.end+.035)fail(`${c.id}: caption outside authored shot`);
  for(const f of ['shows','change','reason','screenText'])if(typeof row[f]!=='string'||!row[f].trim())fail(`${c.id}: concrete ${f} required`);
 }
 const t=map.typography,scale=390/plan.meta.width;
 if(!t||t.width!==plan.meta.width||t.height!==plan.meta.height||t.referenceWidth!==390)fail('missing aspect-specific typography');
 else for(const [k,min,max]of [['title',18,32],['body',15,25],['caption',16,23],['source',10,15]])if(!Number.isFinite(t[k])||t[k]*scale<min||t[k]*scale>max)fail(`${k}: phone-reference font outside readable hierarchy`);
 return {status:errors.length?'blocked':'passed',errors,captionRows:rows.length,shots:shots.length,limits:'Structure, source intervals and typography tokens only; does not establish relevance, listening or visual approval'};
}

import fs from'node:fs';import path from'node:path';import{createHash}from'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
export const reviewChecks=['semanticsClear','visualRelevance','layoutReadable','captionSync','narrationIntelligible'];
export const needsPreviewReview=plan=>plan.meta.productionWorkflow==='reviewed-v1';
export const inspectPreviewReview=(job,preview)=>{
 try{const r=JSON.parse(fs.readFileSync(path.join(job,'preview-review.json')));if(r.previewIdentity!==preview.identity||r.videoSha256!==preview.videoSha256||hash(fs.readFileSync(preview.video))!==r.videoSha256)throw Error('stale preview');if(typeof r.reviewer!=='string'||!r.reviewer.trim()||!r.notes?.trim())throw Error('reviewer and notes required');
 const pending=reviewChecks.filter(k=>r.checks?.[k]?.status!=='passed'||!r.checks?.[k]?.notes?.trim());return{status:pending.length?'review-required':'reviewed',pending,reviewer:r.reviewer,limits:'A bound, explicitly authored review record, not an automated guarantee of aesthetics or listening.'};
 }catch(e){return{status:'review-required',pending:reviewChecks,reason:e.message};}
};
export const bindPreviewReview=(job,draft)=>{const latest=JSON.parse(fs.readFileSync(path.join(job,'preview/complete/latest.json'))),dir=path.dirname(path.join(job,latest.video)),preview=JSON.parse(fs.readFileSync(path.join(dir,'preview-report.json'))),video=path.join(job,latest.video);if(preview.status!=='rendered'||hash(fs.readFileSync(video))!==preview.videoSha256)throw Error('No intact complete preview');
 if(!draft.reviewer?.trim()||!draft.notes?.trim())throw Error('Name actual reviewer and describe actual review');for(const k of reviewChecks)if(!['passed','needs-fix','not-performed'].includes(draft.checks?.[k]?.status)||!draft.checks[k].notes?.trim())throw Error(`Explicit truthful result/notes required for ${k}`);
 const result={schemaVersion:1,previewIdentity:preview.identity,videoSha256:preview.videoSha256,reviewer:draft.reviewer,notes:draft.notes,checks:draft.checks};fs.writeFileSync(path.join(job,'preview-review.json'),JSON.stringify(result,null,2)+'\n');return inspectPreviewReview(job,{...preview,video});};

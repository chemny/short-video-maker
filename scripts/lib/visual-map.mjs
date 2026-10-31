import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha256 = value => createHash('sha256').update(value).digest('hex');

export const visualMap = (plan) => {
  const errors = [], rows = [];
  const strict = plan.meta?.productionVersion === 'p0-v1';
  const seen = new Set();
  for (const scene of plan.scenes ?? []) {
    const cues = (scene.captionIds ?? []).map(id => plan.captions.find(c => c.id === id)).filter(Boolean);
    const links = scene.visualBindings ?? [];
    if (strict && !links.length) errors.push(`Scene ${scene.id}: explicit visualBindings required`);
    let end = scene.start;
    for (const [index, link] of links.entries()) {
      const selected = (link.captionIds ?? []).map(id => plan.captions.find(c => c.id === id));
      if (!selected.length || selected.some(c => !c || !scene.captionIds?.includes(c.id))) {errors.push(`Scene ${scene.id}: visual binding has unknown/cross-scene caption IDs`);continue;}
      if (selected.some((c, k) => k && plan.captions.indexOf(c) !== plan.captions.indexOf(selected[k-1]) + 1)) errors.push(`Scene ${scene.id}: binding captions must be contiguous`);
      const start = Math.max(scene.start, selected[0].start), stop = Math.min(scene.end, selected.at(-1).end);
      if (start < end - 0.02 || stop <= start) errors.push(`Scene ${scene.id}: visual binding order/interval invalid`);
      end = stop;
      for (const c of selected) {if(seen.has(c.id))errors.push(`Caption ${c.id}: duplicate visual binding`);seen.add(c.id);}
      if (!link.shows?.trim() || !link.reason?.trim()) errors.push(`Scene ${scene.id}: binding needs shows and reason`);
      if (!['official-demo','official-image','authored-diagram','authored-card','user-media'].includes(link.kind)) errors.push(`Scene ${scene.id}: unsupported visual binding kind`);
      if (link.kind?.startsWith('official-') && (!scene.visual?.asset || scene.evidence?.visualOrigin!=='official')) errors.push(`Scene ${scene.id}: official binding requires a verified official asset`);
      if (link.kind==='official-demo' && scene.visual?.kind!=='video') errors.push(`Scene ${scene.id}: demo requires a video`);
      if (scene.visual?.kind==='video' && scene.visual?.asset) {
        const expected = (scene.visual.sourceStart ?? 0) + start - scene.start;
        if (!Number.isFinite(link.sourceStart) || Math.abs(link.sourceStart-expected)>0.05 || !Number.isFinite(link.sourceEnd) || Math.abs(link.sourceEnd-(expected+stop-start))>0.05) errors.push(`Scene ${scene.id}: binding source interval must match actual clip playback`);
      }
      rows.push({sceneId:scene.id,binding:index+1,start,end:stop,captionIds:link.captionIds,narration:selected.map(c=>c.text).join(''),kind:link.kind,shows:link.shows,reason:link.reason,
        asset:scene.visual?.asset??null,sceneSourceStart:scene.visual?.kind==='video'?(scene.visual.sourceStart??0):null,sceneSourceEnd:scene.visual?.kind==='video'?(scene.visual.sourceStart??0)+scene.end-scene.start:null,sourceStart:link.sourceStart??null,sourceEnd:link.sourceEnd??null,sourceIds:scene.evidence?.sourceIds??[],claimIds:scene.evidence?.claimIds??[]});
    }
    if(strict)for(const c of cues)if(!seen.has(c.id))errors.push(`Caption ${c.id}: missing narration-to-visual binding`);
  }
  return {schemaVersion:1,planSha256:sha256(JSON.stringify(plan)),strict,status:errors.length?'blocked':'mapped',errors,rows,
    limits:'A recorded editorial association and real playback interval, not automated semantic proof; review each selected view.'};
};
export const writeVisualMap = (plan, dir) => {
  const report = visualMap(plan);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'visual-map.json'),JSON.stringify(report,null,2)+'\n');
  const safe = s => String(s??'').replaceAll('|','／').replaceAll('\n',' ');
  fs.writeFileSync(path.join(dir,'visual-map.md'),['# 旁白与画面对应表','',`状态：${report.status}；语义对应需要实际审看。`,'',
    '| 镜头／时间 | 旁白 | 展示内容 | 对应理由 | 素材区间 |','|---|---|---|---|---|',...report.rows.map(r=>`| ${r.sceneId} ${r.start.toFixed(2)}–${r.end.toFixed(2)}s | ${safe(r.narration)} | ${safe(r.shows)} | ${safe(r.reason)} | ${safe(r.asset??'原创图解／卡片')} ${r.sceneSourceStart??r.sourceStart??''}–${r.sceneSourceEnd??r.sourceEnd??''}（旁白对应 ${r.sourceStart??''}–${r.sourceEnd??''}） |`),...report.errors.map(e=>`\n- ${e}`),''].join('\n'));
  return report;
};

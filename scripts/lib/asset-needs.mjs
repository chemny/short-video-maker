import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {inspectAsset} from './media-assets.mjs';

const imageLayouts = new Set(['full-image-title', 'image-with-caption']);
const remote = (value) => /^https?:\/\//i.test(value);

export const writeAssetNeeds = (plan, jobDir, outputDir = jobDir) => {
  const needs = [], inspected=[];
  let measured;
  if(plan.style?.componentSystem==='semantic-v1')try{const r=JSON.parse(fs.readFileSync(path.join(jobDir,'layout-report.json')));if(r.status==='passed'&&r.planSha256===createHash('sha256').update(JSON.stringify(plan)).digest('hex')&&r.width===plan.meta.width&&r.height===plan.meta.height)measured=r;}catch{}

  const targets = [...(plan.scenes ?? []).map((s) => ({id: s.id, start: s.start, end: s.end,
    asset: s.visual?.asset, intent: s.visual?.alt ?? s.caption, prompt: s.visual?.prompt,
    required: (plan.style?.componentSystem!=='semantic-v1'&&imageLayouts.has(s.layout)) || Boolean(s.visual?.prompt) || Boolean(s.visual?.asset), bare: s.visual?.bare, kind: s.visual?.kind, fit: s.visual?.fit})),
    ...(plan.cover?.backgroundAsset ? [{id: 'cover', asset: plan.cover.backgroundAsset, intent: plan.cover.title, required: true}] : [])];
  for (const target of targets) {
    if (!target.required) continue; // Authored text/diagram cards do not need filler images.
    let reason;
    let dimensions;
    if (!target.asset) reason = 'missing-selection';
    else if (remote(target.asset)) reason = 'remote-not-verified';
    else {
      try {
        const info = inspectAsset(path.resolve(jobDir, target.asset));
        if (info.kind !== (target.kind === 'video' ? 'video' : 'image')) reason = 'unsupported-visual';
        else {
          dimensions = {width: info.width, height: info.height};
          // Responsive media occupies a panel, not the entire output canvas.
          // Conservative panel bounds avoid reporting every landscape image as
          // low-resolution merely because it sits inside a portrait canvas.
          const responsive = target.id !== 'cover' && (plan.style?.template === 'responsive-report' || target.kind === 'video');
          const landscape = plan.meta.width > plan.meta.height;
          const width = plan.meta.width * (responsive ? landscape ? 0.52 : 0.80 : 1);
          const height = plan.meta.height * (responsive ? landscape ? 0.72 : 0.60 : 1);
          const contain = target.bare || target.fit === 'contain' || (responsive && target.fit !== 'cover');
          let scale = contain ? Math.min(width / info.width, height / info.height) : Math.max(width / info.width, height / info.height);
          const panels=(measured?.samples??[]).flatMap(s=>s.measurements??[]).filter(r=>r.sceneId===target.id&&r.role==='media'&&r.rect?.width>0&&r.rect?.height>0);
          const component=plan.scenes?.find(s=>s.id===target.id)?.componentRender;
          const focus=component?.props?.focus;
          const zoom=(component?.id==='camera'||(['evidence','media','demo'].includes(component?.id)&&component?.variant==='b'))&&focus?Math.min(2,1/focus.width):component?.id==='parallax'?1.03:1;
          if(panels.length)scale=Math.max(...panels.map(r=>(contain?Math.min(r.rect.width/info.width,r.rect.height/info.height):Math.max(r.rect.width/info.width,r.rect.height/info.height))*zoom));
          inspected.push({id:target.id,dimensions,scale,sizing:panels.length?'hash-bound measured panel':'conservative canvas estimate',zoom});
          if (!Number.isFinite(scale)) reason = 'invalid-image';
          else if (scale > 1.25) reason = 'low-resolution';
        }
      } catch { reason = 'missing-or-unreadable'; }
    }
    if (reason) needs.push({...target, reason, ...(dimensions ? {dimensions} : {})});
  }
  fs.mkdirSync(outputDir, {recursive: true});
  const report = {schemaVersion: 1, title: plan.meta.title, target: {width: plan.meta.width, height: plan.meta.height}, needs, inspected};
  fs.writeFileSync(path.join(outputDir, 'assets-needed.json'), `${JSON.stringify(report, null, 2)}\n`);
  const text = ['# 素材需求清单', '', `项目：${plan.meta.title}`, `目标画幅：${plan.meta.width}×${plan.meta.height}`, '',
    '本清单不下载或生成素材；优先查找官网、官方说明及相关演示，不用无关图库填充。远程素材需先下载核验。', '',
    ...(needs.length ? needs.flatMap((n) => [`## ${n.id}`, '', `- 问题：${n.reason}`,
      ...(n.start !== undefined ? [`- 时间：${n.start}–${n.end}s`] : []),
      `- 画面意图：${n.intent ?? ''}`, `- 当前素材：${n.asset ?? '未选择'}`,
      ...(n.dimensions ? [`- 当前尺寸：${n.dimensions.width}×${n.dimensions.height}`] : []),
      `- 搜索或绘制说明：${n.prompt ?? n.intent ?? '请补充与该场景相关的画面说明'}`, '']) : ['未发现缺图、不可读图片或明显分辨率缺口。语义相关性仍需人工检查。', ''])];
  fs.writeFileSync(path.join(outputDir, 'assets-needed.md'), text.join('\n'));
  return report;
};

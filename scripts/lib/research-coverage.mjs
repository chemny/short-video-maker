import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
export const classifyCandidate = (m) => {
 if(/\.(mp4|webm)(?:[?#]|$)/i.test(m.url)||/^video\/(mp4|webm)/i.test(m.type))return 'direct-video';
 if(/\.m3u8(?:[?#]|$)/i.test(m.url)||/mpegurl/i.test(m.type??''))return 'hls-playlist';
 if(/iframe|player|embedUrl/.test(m.tag)||/youtube\.com|youtu\.be|vimeo\.com/.test(m.url))return 'embedded-player';
 if(/\.(png|jpe?g|webp)(?:[?#]|$)/i.test(m.url)||/img|poster|image|thumbnail/.test(m.tag))return 'image';
 return 'unclassified';
};
export const writeResearchCoverage = (job, registry) => {
 let downloads=[],acquisitionFailures=[];try{const record=JSON.parse(fs.readFileSync(path.join(job,'research/downloads.json')));downloads=record.downloads;acquisitionFailures=record.failures??[];}catch{}
 const sources=registry.sources.map(s=>({sourceId:s.id,url:s.url,title:s.title,
  candidates:s.mediaCandidates.map(m=>({...m,kind:classifyCandidate(m),acquired:downloads.some(d=>d.sourceId===s.id&&d.mediaId===m.id)}))}));
 const gaps=sources.flatMap(s=>{
  const videos=s.candidates.filter(c=>['direct-video','hls-playlist','embedded-player'].includes(c.kind));
  return videos.length?videos.filter(c=>!c.acquired).map(c=>({sourceId:s.sourceId,mediaId:c.id,url:c.url,kind:c.kind,reason:c.kind==='embedded-player'?'explicit player resolution and media-domain approval required':c.kind==='hls-playlist'?'explicit HLS acquisition request required':'candidate not selected; inspect relevance before download'})):
   [{sourceId:s.sourceId,reason:'No official video discovered on this page; inspect related documentation/demo pages or use a labelled authored diagram.'}];
 });
 const report={schemaVersion:1,sourceRegistrySha256:createHash('sha256').update(JSON.stringify(registry)).digest('hex'),crawl:registry.crawl??null,sources,acquisitionFailures,failures:registry.failures??[],gaps,checkedAt:new Date().toISOString(),limits:'Coverage of inspected pages only, not proof all official media has been found. Candidates are not licensing grants.'};
 fs.writeFileSync(path.join(job,'research/coverage.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(job,'research/coverage.md'),['# 官方素材搜集覆盖与缺口','',...sources.flatMap(s=>[`## ${s.title}`,s.url,...s.candidates.map(c=>`- ${c.id} [${c.kind} / ${c.acquired?'已获取':'待选用'}] ${c.context??c.alt??''} ${c.url}`),'']), '## 未完成项',...gaps.map(g=>`- ${g.sourceId}: ${g.reason} ${g.url??''}`),...acquisitionFailures.map(f=>`- 获取失败 ${f.mediaId}: ${f.message}`),...report.failures.map(f=>`- 读取失败 ${f.url}: ${f.error}`),''].join('\n'));
 return report;
};

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const [jobArg, type = 'article', ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!jobArg || !['product', 'article', 'daily'].includes(type)) throw new Error('Usage: node scripts/init-report.mjs <new-job> product|article|daily --topic=<topic> [--date=YYYY-MM-DD]');
const job = path.resolve(jobArg); if (fs.existsSync(job)) throw new Error('Job already exists; use a new directory');
const topic = option('topic'); if (!topic) throw new Error('Provide the topic or article title');
if (type === 'daily' && !/^\d{4}-\d{2}-\d{2}$/.test(option('date') ?? '')) throw new Error('Daily report requires an explicit editorial date; do not infer it from the machine timezone');
const componentMode=option('components');if(componentMode&&!['auto','off'].includes(componentMode))throw new Error('components must be auto or off');
const defaults=JSON.parse(fs.readFileSync(new URL('../components/defaults.json',import.meta.url)));
// A brief cannot select a visual system before the script and Director plan.
// In particular, do not silently route the new director contract to a legacy
// template that does not consume its authored cue decisions.
const renderDefaults={productionWorkflow:'reviewed-v1',layoutReadability:'phone-v1',componentSystem:componentMode==='off'?'off':(componentMode==='auto'||defaults.enabled)?'semantic-v1':'off'};
const beats = type === 'product' ? ['解决什么问题', '官方演示与机制', '使用边界', '适合谁与结论'] : type === 'daily' ? ['今日重点', '事件与证据', '影响与限制', '后续观察'] : ['文章核心判断', '依据与解释', '限制与不同观点', '读者可用的结论'];
fs.mkdirSync(job, {recursive: true}); fs.mkdirSync(path.join(job, 'research'));
const brief = {schemaVersion: 1, productionVersion: 'p0-v1', productionWorkflow:'reviewed-v1', directorRequired:true, topic, type, ...(type === 'daily' ? {editorialDate: option('date')} : {}), status: 'research-required',
  beats, editorialWorkflow: 'sentence-v1', renderDefaults, directorRendererChoices:['directed-news (1080x1920/30fps)','declared authored Remotion composition with svm-layout-v1'], sourcePolicy: 'official-primary-sources-first', requiredArtifacts: ['research/sources.json', 'research/claims.json', 'approved-script.md', 'baseline.json', 'sentence-storyboard.json', 'video-plan.json', 'visual-map.json', 'layout-report.json', 'research/coverage.json'],
  stages: ['research', 'approved-script', 'storyboard-evidence', 'narration-alignment', 'media-selection', 'preview-each-aspect', 'render', 'editorial-review'],
  limits: 'A brief is not a factual script or ready video. The agent must research/write/review; no fabricated plan is emitted.'};
fs.writeFileSync(path.join(job, 'production-brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
fs.writeFileSync(path.join(job, 'research/claims.json'), `${JSON.stringify({claims: []}, null, 2)}\n`);
console.log(`Created ${type} brief: ${job}`);

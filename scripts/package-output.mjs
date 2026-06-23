#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const planPath = process.argv[2];
const outputDirArg = process.argv[3] ?? 'output';

if (!planPath) {
  console.error('Usage: node scripts/package-output.mjs <path-to-video-plan.json> [output-dir]');
  process.exit(2);
}

const absolutePlanPath = path.resolve(planPath);
const planDir = path.dirname(absolutePlanPath);
const outputDir = path.resolve(planDir, outputDirArg);
const plan = JSON.parse(fs.readFileSync(absolutePlanPath, 'utf8'));

fs.mkdirSync(outputDir, {recursive: true});

const scriptMarkdown = [
  `# ${plan.meta.title}`,
  '',
  `主题：${plan.meta.topic}`,
  `时长：${plan.meta.durationSeconds}s`,
  '',
  '## 分镜脚本',
  '',
  ...plan.scenes.flatMap((scene, index) => [
    `### ${index + 1}. ${scene.caption}`,
    '',
    `时间：${scene.start}s - ${scene.end}s`,
    '',
    `旁白：${scene.voiceover}`,
    '',
    `画面：${scene.visual?.prompt ?? scene.visual?.alt ?? scene.layout}`,
    '',
  ]),
].join('\n');

const formatTags = (name, tags) => {
  if (!Array.isArray(tags)) {
    return '';
  }

  if (name === '小红书') {
    return tags.map((tag) => `#${String(tag).replaceAll('#', '')}#`).join(' ');
  }

  return tags.map((tag) => `#${String(tag).replaceAll('#', '')}`).join(' ');
};

const formatPlatform = (name, value) => {
  if (!value) {
    return '';
  }

  return [
    `## ${name}`,
    '',
    `标题：${value.title ?? ''}`,
    '',
    value.body ?? '',
    '',
    formatTags(name, value.tags),
    '',
  ].join('\n');
};

const publishMarkdown = [
  `# ${plan.meta.title}`,
  '',
  formatPlatform('小红书', plan.publish?.xiaohongshu),
  formatPlatform('抖音', plan.publish?.douyin),
]
  .filter(Boolean)
  .join('\n');

const metadata = {
  title: plan.meta.title,
  topic: plan.meta.topic,
  platforms: plan.meta.platforms,
  durationSeconds: plan.meta.durationSeconds,
  width: plan.meta.width,
  height: plan.meta.height,
  fps: plan.meta.fps,
  sceneCount: plan.scenes.length,
  captionCount: plan.captions.length,
  audio: plan.audio ?? {},
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(outputDir, 'script.md'), scriptMarkdown, 'utf8');
fs.writeFileSync(path.join(outputDir, 'publish.md'), publishMarkdown, 'utf8');
fs.writeFileSync(path.join(outputDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

console.log(`Wrote ${path.join(outputDir, 'script.md')}`);
console.log(`Wrote ${path.join(outputDir, 'publish.md')}`);
console.log(`Wrote ${path.join(outputDir, 'metadata.json')}`);

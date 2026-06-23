#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2];
const slugArg = process.argv[3];

if (!inputPath) {
  console.error('Usage: node scripts/init-job.mjs <input.md> [slug]');
  process.exit(2);
}

const absoluteInputPath = path.resolve(inputPath);

if (!fs.existsSync(absoluteInputPath)) {
  console.error(`Input file not found: ${absoluteInputPath}`);
  process.exit(1);
}

const skillRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const jobsRoot = path.join(skillRoot, 'jobs');
const rawInput = fs.readFileSync(absoluteInputPath, 'utf8').trim();
const baseSlug =
  slugArg ??
  path
    .basename(absoluteInputPath, path.extname(absoluteInputPath))
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') ??
  'video-job';
const slug = baseSlug || 'video-job';
const jobDir = path.join(jobsRoot, slug);

fs.mkdirSync(jobDir, {recursive: true});
fs.mkdirSync(path.join(jobDir, 'audio'), {recursive: true});
fs.mkdirSync(path.join(jobDir, 'captions'), {recursive: true});
fs.mkdirSync(path.join(jobDir, 'assets'), {recursive: true});
fs.mkdirSync(path.join(jobDir, 'output'), {recursive: true});

const writeIfMissing = (filePath, value) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, value, 'utf8');
  }
};

writeIfMissing(path.join(jobDir, 'input.md'), `${rawInput}\n`);
writeIfMissing(
  path.join(jobDir, 'analysis.json'),
  `${JSON.stringify(
    {
      topic: '',
      input_type: '',
      target_platforms: ['xiaohongshu', 'douyin'],
      target_audience: '',
      content_type: 'knowledge-explainer',
      main_angle: '',
      core_thesis: '',
      hook_strategy: '',
      supporting_points: [],
      risk_notes: [],
      source_notes: [],
    },
    null,
    2,
  )}\n`,
);
writeIfMissing(
  path.join(jobDir, 'script.json'),
  `${JSON.stringify(
    {
      title: '',
      cover_title: '',
      cover_subtitle: '',
      voiceover_full_text: '',
      estimated_duration_seconds: 120,
      scenes: [],
    },
    null,
    2,
  )}\n`,
);
writeIfMissing(
  path.join(jobDir, 'storyboard.json'),
  `${JSON.stringify(
    {
      visual_style: '',
      scenes: [],
    },
    null,
    2,
  )}\n`,
);
writeIfMissing(
  path.join(jobDir, 'video-plan.json'),
  `${JSON.stringify(
    {
      meta: {
        title: '',
        topic: '',
        platforms: ['xiaohongshu', 'douyin'],
        language: 'zh-CN',
        width: 1080,
        height: 1920,
        fps: 30,
        durationSeconds: 120,
      },
      style: {
        template: 'knowledge-explainer-v1',
        background: '#101014',
        textPrimary: '#FFFFFF',
        textSecondary: '#D7D7DF',
        accent: '#F6C85F',
        captionPosition: 'bottom',
        captionMode: 'sentence',
        motionIntensity: 'medium',
      },
      audio: {},
      cover: {
        title: '',
        subtitle: '',
        label: '',
        layout: 'bold-title',
      },
      captions: [],
      scenes: [],
      publish: {
        xiaohongshu: {
          title: '',
          body: '',
          tags: [],
        },
        douyin: {
          title: '',
          body: '',
          tags: [],
        },
      },
    },
    null,
    2,
  )}\n`,
);

console.log(`Created job: ${jobDir}`);
console.log('Next: fill analysis.json, script.json, storyboard.json, and video-plan.json using references/agent-generation-guide.md');

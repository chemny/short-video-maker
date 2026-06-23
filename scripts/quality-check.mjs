#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const planPath = process.argv[2];
const outputDirArg = process.argv[3] ?? 'output';

if (!planPath) {
  console.error('Usage: node scripts/quality-check.mjs <path-to-video-plan.json> [output-dir]');
  process.exit(2);
}

const absolutePlanPath = path.resolve(planPath);
const planDir = path.dirname(absolutePlanPath);
const resolveOutputDir = (value) => {
  if (path.isAbsolute(value)) {
    return value;
  }

  const fromCwd = path.resolve(value);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }

  return path.resolve(planDir, value);
};
const outputDir = resolveOutputDir(outputDirArg);
const plan = JSON.parse(fs.readFileSync(absolutePlanPath, 'utf8'));
const errors = [];
const warnings = [];

const existsNonEmpty = (filePath) => fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
const countChars = (value) => [...String(value ?? '')].length;

const durationOf = (filePath) => {
  try {
    return Number(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ])
        .toString()
        .trim(),
    );
  } catch {
    return null;
  }
};

const expectedRenderedDuration = () => {
  const introSeconds = Number.isFinite(plan.cover?.introSeconds) ? plan.cover.introSeconds : 0.5;
  return plan.meta.durationSeconds + Math.max(0, introSeconds);
};

if (plan.meta.width !== 1080 || plan.meta.height !== 1920) {
  warnings.push(`Expected 1080x1920, got ${plan.meta.width}x${plan.meta.height}`);
}

if (plan.meta.durationSeconds < 75 || plan.meta.durationSeconds > 140) {
  warnings.push(`Duration ${plan.meta.durationSeconds}s is outside the broad 75-140s range`);
}

if (!Array.isArray(plan.scenes) || plan.scenes.length < 5) {
  warnings.push('Expected at least 5 scenes for a complete short video');
}

if (!Array.isArray(plan.captions) || plan.captions.length === 0) {
  errors.push('No captions found');
}

for (const [index, caption] of (plan.captions ?? []).entries()) {
  if (countChars(caption.text) > 34) {
    warnings.push(`caption[${index}] is long and may wrap heavily: ${caption.text}`);
  }

  if (index > 0) {
    const previous = plan.captions[index - 1];
    if (Number.isFinite(previous.end) && Number.isFinite(caption.start) && caption.start - previous.end > 2) {
      warnings.push(`caption[${index}] starts more than 2s after the previous caption`);
    }
  }
}

for (const [index, scene] of (plan.scenes ?? []).entries()) {
  if (!scene.visual?.prompt && !scene.visual?.asset && scene.layout !== 'text-card') {
    warnings.push(`scene[${index}] has no visual prompt or asset`);
  }

  if (countChars(scene.caption) > 24) {
    warnings.push(`scene[${index}] caption is long for a large title: ${scene.caption}`);
  }

  if (Number.isFinite(scene.start) && Number.isFinite(scene.end) && scene.end - scene.start < 3 && scene.type !== 'hook') {
    warnings.push(`scene[${index}] is shorter than 3s outside a hook beat`);
  }

  if (scene.visual?.asset) {
    const assetPath = path.join(planDir, scene.visual.asset);
    if (!existsNonEmpty(assetPath) && !String(scene.visual.asset).startsWith('http')) {
      warnings.push(`scene[${index}] references missing visual asset: ${assetPath}`);
    }
  }
}

if (plan.audio?.voiceover) {
  const audioPath = path.join(planDir, plan.audio.voiceover);
  if (!existsNonEmpty(audioPath)) {
    errors.push(`Missing voiceover audio: ${audioPath}`);
  } else {
    const audioDuration = durationOf(audioPath);
    if (audioDuration && Math.abs(audioDuration - plan.meta.durationSeconds) > 1.5) {
      warnings.push(
        `Audio duration ${audioDuration.toFixed(2)}s differs from plan duration ${plan.meta.durationSeconds}s`,
      );
    }
  }
} else {
  warnings.push('No audio.voiceover configured yet');
}

if (plan.audio?.bgm) {
  const bgmPath = path.join(planDir, plan.audio.bgm);
  if (!existsNonEmpty(bgmPath) && !String(plan.audio.bgm).startsWith('http')) {
    warnings.push(`Missing BGM audio: ${bgmPath}`);
  }

  if (Number.isFinite(plan.audio.bgmVolume) && plan.audio.bgmVolume > 0.18) {
    warnings.push(`BGM volume ${plan.audio.bgmVolume} may compete with Chinese narration`);
  }
}

for (const required of ['script.md', 'publish.md', 'metadata.json']) {
  const filePath = path.join(outputDir, required);
  if (!existsNonEmpty(filePath)) {
    warnings.push(`Missing packaged output: ${filePath}`);
  }
}

const videoPath = path.join(outputDir, 'video.mp4');
if (existsNonEmpty(videoPath)) {
  const videoDuration = durationOf(videoPath);
  const expectedDuration = expectedRenderedDuration();
  if (videoDuration && Math.abs(videoDuration - expectedDuration) > 1.5) {
    warnings.push(
      `Video duration ${videoDuration.toFixed(2)}s differs from expected rendered duration ${expectedDuration.toFixed(2)}s`,
    );
  }
}

const coverPath = path.join(outputDir, 'cover.png');
if (!existsNonEmpty(coverPath)) {
  warnings.push(`Missing packaged cover: ${coverPath}`);
}

if (countChars(plan.cover?.title) > 14) {
  warnings.push('Cover title is longer than the preferred 8-14 Chinese character range');
}

const publish = plan.publish ?? {};
if (publish.xiaohongshu) {
  if (countChars(publish.xiaohongshu.title) > 20) {
    warnings.push('Xiaohongshu title is longer than the preferred 20-character limit');
  }

  if (Array.isArray(publish.xiaohongshu.tags) && (publish.xiaohongshu.tags.length < 5 || publish.xiaohongshu.tags.length > 10)) {
    warnings.push('Xiaohongshu usually works best with 5-10 tags');
  }
}

if (publish.douyin) {
  if (Array.isArray(publish.douyin.tags) && (publish.douyin.tags.length < 3 || publish.douyin.tags.length > 8)) {
    warnings.push('Douyin usually works best with 3-8 tags');
  }
}

if (errors.length > 0) {
  console.error('Quality check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }

  for (const warning of warnings) {
    console.error(`- warning: ${warning}`);
  }

  process.exit(1);
}

console.log('Quality check passed');

if (warnings.length > 0) {
  console.log('Warnings:');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

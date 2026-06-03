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
const outputDir = path.resolve(planDir, outputDirArg);
const plan = JSON.parse(fs.readFileSync(absolutePlanPath, 'utf8'));
const errors = [];
const warnings = [];

const existsNonEmpty = (filePath) => fs.existsSync(filePath) && fs.statSync(filePath).size > 0;

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
  if (caption.text.length > 34) {
    warnings.push(`caption[${index}] is long and may wrap heavily: ${caption.text}`);
  }
}

for (const [index, scene] of (plan.scenes ?? []).entries()) {
  if (!scene.visual?.prompt && !scene.visual?.asset && scene.layout !== 'text-card') {
    warnings.push(`scene[${index}] has no visual prompt or asset`);
  }

  if (scene.caption.length > 24) {
    warnings.push(`scene[${index}] caption is long for a large title: ${scene.caption}`);
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

for (const required of ['script.md', 'publish.md', 'metadata.json']) {
  const filePath = path.join(outputDir, required);
  if (!existsNonEmpty(filePath)) {
    warnings.push(`Missing packaged output: ${filePath}`);
  }
}

const videoPath = path.join(outputDir, 'video.mp4');
if (existsNonEmpty(videoPath)) {
  const videoDuration = durationOf(videoPath);
  if (videoDuration && Math.abs(videoDuration - plan.meta.durationSeconds) > 1.5) {
    warnings.push(
      `Video duration ${videoDuration.toFixed(2)}s differs from plan duration ${plan.meta.durationSeconds}s`,
    );
  }
}

const coverPath = path.join(outputDir, 'cover.png');
if (!existsNonEmpty(coverPath)) {
  warnings.push(`Missing packaged cover: ${coverPath}`);
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

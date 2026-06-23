#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const planPath = process.argv[2];

if (!planPath) {
  console.error('Usage: node scripts/audit-timing.mjs <path-to-video-plan.json>');
  process.exit(2);
}

const absolutePlanPath = path.resolve(planPath);
const plan = JSON.parse(fs.readFileSync(absolutePlanPath, 'utf8'));
const warnings = [];
const errors = [];

const auditSeries = (items, name) => {
  if (!Array.isArray(items) || items.length === 0) {
    warnings.push(`${name} is empty`);
    return;
  }

  let previousEnd = 0;

  for (const [index, item] of items.entries()) {
    if (!Number.isFinite(item.start) || !Number.isFinite(item.end)) {
      errors.push(`${name}[${index}] has non-numeric timing`);
      continue;
    }

    if (item.start >= item.end) {
      errors.push(`${name}[${index}] start must be before end`);
      continue;
    }

    const gap = item.start - previousEnd;
    const overlap = previousEnd - item.start;

    if (index > 0 && gap > 1.5) {
      warnings.push(`${name}[${index}] has a ${gap.toFixed(2)}s gap before it`);
    }

    if (index > 0 && overlap > 0.25) {
      warnings.push(`${name}[${index}] overlaps the previous item by ${overlap.toFixed(2)}s`);
    }

    previousEnd = item.end;
  }

  if (Number.isFinite(plan.meta?.durationSeconds)) {
    const tailGap = plan.meta.durationSeconds - previousEnd;
    if (tailGap > 2) {
      warnings.push(`${name} ends ${tailGap.toFixed(2)}s before meta.durationSeconds`);
    }
  }
};

auditSeries(plan.scenes, 'scenes');
auditSeries(plan.captions, 'captions');

if (Array.isArray(plan.scenes) && Array.isArray(plan.captions) && plan.scenes.length > 0 && plan.captions.length > 0) {
  const sceneStart = plan.scenes[0].start;
  const captionStart = plan.captions[0].start;
  if (Math.abs(sceneStart - captionStart) > 1.5) {
    warnings.push('first scene and first caption start more than 1.5s apart');
  }

  const sceneEnd = plan.scenes.at(-1).end;
  const captionEnd = plan.captions.at(-1).end;
  if (Math.abs(sceneEnd - captionEnd) > 3) {
    warnings.push('last scene and last caption end more than 3s apart');
  }
}

if (errors.length > 0) {
  console.error(`Timing audit failed: ${absolutePlanPath}`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Timing audit passed: ${absolutePlanPath}`);

if (warnings.length > 0) {
  console.log('Warnings:');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

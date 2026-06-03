#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const planPath = process.argv[2];

if (!planPath) {
  console.error('Usage: node scripts/validate-plan.mjs <path-to-video-plan.json>');
  process.exit(2);
}

const absolutePath = path.resolve(planPath);
const plan = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
const errors = [];

const requireObject = (value, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${name} must be an object`);
  }
};

requireObject(plan.meta, 'meta');
requireObject(plan.style, 'style');
requireObject(plan.cover, 'cover');

if (!Array.isArray(plan.captions)) {
  errors.push('captions must be an array');
}

if (!Array.isArray(plan.scenes)) {
  errors.push('scenes must be an array');
}

if (plan.meta) {
  for (const field of ['title', 'topic', 'language']) {
    if (!plan.meta[field]) {
      errors.push(`meta.${field} is required`);
    }
  }

  if (!Number.isFinite(plan.meta.width) || !Number.isFinite(plan.meta.height)) {
    errors.push('meta.width and meta.height must be numbers');
  }

  if (!Number.isFinite(plan.meta.fps) || plan.meta.fps <= 0) {
    errors.push('meta.fps must be a positive number');
  }

  if (!Number.isFinite(plan.meta.durationSeconds) || plan.meta.durationSeconds <= 0) {
    errors.push('meta.durationSeconds must be a positive number');
  }
}

const validateTimedItems = (items, name) => {
  if (!Array.isArray(items)) {
    return;
  }

  let previousStart = -Infinity;

  for (const [index, item] of items.entries()) {
    if (!item.id) {
      errors.push(`${name}[${index}].id is required`);
    }

    if (!Number.isFinite(item.start) || !Number.isFinite(item.end)) {
      errors.push(`${name}[${index}] must have numeric start and end`);
      continue;
    }

    if (item.start >= item.end) {
      errors.push(`${name}[${index}] start must be less than end`);
    }

    if (item.start < previousStart) {
      errors.push(`${name}[${index}] starts before the previous item`);
    }

    if (plan.meta?.durationSeconds && item.end > plan.meta.durationSeconds + 0.25) {
      errors.push(`${name}[${index}] ends after meta.durationSeconds`);
    }

    previousStart = item.start;
  }
};

validateTimedItems(plan.captions, 'captions');
validateTimedItems(plan.scenes, 'scenes');

if (Array.isArray(plan.scenes)) {
  for (const [index, scene] of plan.scenes.entries()) {
    for (const field of ['type', 'layout', 'voiceover', 'caption']) {
      if (!scene[field]) {
        errors.push(`scenes[${index}].${field} is required`);
      }
    }
  }
}

if (plan.cover) {
  if (!plan.cover.title) {
    errors.push('cover.title is required');
  }

  if (typeof plan.cover.title === 'string' && plan.cover.title.length > 18) {
    errors.push('cover.title should be 18 characters or less for thumbnail readability');
  }
}

if (errors.length > 0) {
  console.error(`Invalid video plan: ${absolutePath}`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Valid video plan: ${absolutePath}`);

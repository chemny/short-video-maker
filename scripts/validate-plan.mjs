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
const warnings = [];

const supportedLayouts = new Set([
  'full-image-title',
  'image-with-caption',
  'text-card',
  'quote-card',
  'data-card',
  'step-list',
  'ending-card',
]);

const supportedMotions = new Set([
  'none',
  'slow-zoom-in',
  'slow-zoom-out',
  'pan-left',
  'pan-right',
  'fade-up',
]);

const supportedTemplates = new Set([
  'clean-explainer',
  'app-workflow',
  'sketch-notes',
  'dark-card',
  'apple-text-video',
  'data-punch',
  'image-overlay',
]);

const supportedPresets = new Set(['warm-note', 'mono-tech', 'soft-product', 'dark-cinematic']);

const countChars = (value) => [...String(value ?? '')].length;

const requireObject = (value, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${name} must be an object`);
  }
};

requireObject(plan.meta, 'meta');
requireObject(plan.style, 'style');
requireObject(plan.cover, 'cover');
requireObject(plan.publish, 'publish');

if (plan.style) {
  if (plan.style.template && !supportedTemplates.has(plan.style.template)) {
    warnings.push(`style.template "${plan.style.template}" is not in the supported template set`);
  }

  if (plan.style.preset && !supportedPresets.has(plan.style.preset)) {
    warnings.push(`style.preset "${plan.style.preset}" is not in the supported preset set`);
  }
}

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

  if (plan.meta.width !== 1080 || plan.meta.height !== 1920) {
    warnings.push(`meta.width/meta.height is ${plan.meta.width}x${plan.meta.height}; 1080x1920 is the default short-video target`);
  }

  if (Number.isFinite(plan.meta.durationSeconds) && (plan.meta.durationSeconds < 75 || plan.meta.durationSeconds > 140)) {
    warnings.push(`meta.durationSeconds ${plan.meta.durationSeconds}s is outside the broad 75-140s short-video range`);
  }

  if (!Array.isArray(plan.meta.platforms) || plan.meta.platforms.length === 0) {
    warnings.push('meta.platforms should list at least one target platform');
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

    if (scene.layout && !supportedLayouts.has(scene.layout)) {
      warnings.push(`scenes[${index}].layout "${scene.layout}" is not in the documented MVP layout set`);
    }

    if (scene.motion?.type && !supportedMotions.has(scene.motion.type)) {
      warnings.push(`scenes[${index}].motion.type "${scene.motion.type}" is not in the documented MVP motion set`);
    }

    if (typeof scene.caption === 'string' && countChars(scene.caption) > 24) {
      warnings.push(`scenes[${index}].caption is long for mobile title text`);
    }

    if (scene.tags && !Array.isArray(scene.tags)) {
      errors.push(`scenes[${index}].tags must be an array when provided`);
    }

    if (scene.steps && !Array.isArray(scene.steps)) {
      errors.push(`scenes[${index}].steps must be an array when provided`);
    }

    if (Array.isArray(scene.steps) && scene.steps.length > 4) {
      warnings.push(`scenes[${index}].steps should usually contain 2-4 short visual steps`);
    }
  }
}

if (plan.cover) {
  if (!plan.cover.title) {
    errors.push('cover.title is required');
  }

  if (typeof plan.cover.title === 'string' && countChars(plan.cover.title) > 18) {
    errors.push('cover.title should be 18 characters or less for thumbnail readability');
  }

  if (typeof plan.cover.title === 'string' && countChars(plan.cover.title) > 14) {
    warnings.push('cover.title should ideally be 8-14 Chinese characters');
  }
}

if (plan.audio?.bgmVolume !== undefined) {
  if (!Number.isFinite(plan.audio.bgmVolume) || plan.audio.bgmVolume < 0 || plan.audio.bgmVolume > 0.3) {
    warnings.push('audio.bgmVolume should usually be between 0 and 0.3');
  }
}

const validatePlatform = (platform, value) => {
  if (!value) {
    return;
  }

  if (!value.title) {
    errors.push(`publish.${platform}.title is required`);
  }

  if (!value.body) {
    warnings.push(`publish.${platform}.body is empty`);
  }

  if (!Array.isArray(value.tags)) {
    errors.push(`publish.${platform}.tags must be an array`);
  }

  if (Array.isArray(value.tags) && value.tags.some((tag) => String(tag).includes('#'))) {
    warnings.push(`publish.${platform}.tags should be raw tag text without #; package-output formats tags`);
  }

  if (platform === 'xiaohongshu') {
    if (countChars(value.title) > 20) {
      warnings.push('publish.xiaohongshu.title should usually be 20 Chinese characters or less');
    }

    if (Array.isArray(value.tags) && (value.tags.length < 5 || value.tags.length > 10)) {
      warnings.push('publish.xiaohongshu.tags should usually contain 5-10 tags');
    }
  }

  if (platform === 'douyin') {
    if (Array.isArray(value.tags) && (value.tags.length < 3 || value.tags.length > 8)) {
      warnings.push('publish.douyin.tags should usually contain 3-8 tags');
    }
  }
};

if (plan.publish) {
  validatePlatform('xiaohongshu', plan.publish.xiaohongshu);
  validatePlatform('douyin', plan.publish.douyin);
}

if (errors.length > 0) {
  console.error(`Invalid video plan: ${absolutePath}`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Valid video plan: ${absolutePath}`);

if (warnings.length > 0) {
  console.log('Warnings:');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

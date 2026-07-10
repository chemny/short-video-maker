#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const roundTime = (value) => Math.round(value * 1000) / 1000;
const textWeight = (value) => Math.max(1, String(value ?? '').replace(/\s+/g, '').length);
const hasLatinWords = (value) => /[A-Za-z][A-Za-z\s-]*[A-Za-z]/.test(value);
const captionWeightLimit = 16;

const cleanCaptionText = (value) =>
  String(value ?? '')
    .replace(/[，,。.!！?？、；;：:“”"‘’'（）()《》【】[\]{}…·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const visualWeight = (value) => {
  const compact = String(value ?? '').replace(/\s+/g, ' ').trim();
  let weight = 0;
  for (const token of compact.split(/(\s+)/).filter((part) => !/^\s+$/.test(part))) {
    if (/^[A-Za-z0-9-]+$/.test(token)) {
      weight += Math.min(8, token.length * 0.45);
    } else {
      weight += token.length;
    }
  }
  return weight;
};

const splitCjkChunk = (chunk, size = 12) => {
  const result = [];
  for (let index = 0; index < chunk.length; index += size) {
    result.push(cleanCaptionText(chunk.slice(index, index + size)));
  }
  return result.filter(Boolean);
};

const splitBreaths = (value) => {
  const parts = String(value ?? '')
    .split(/[，,。.!！?？、；;：:\n]+/)
    .map(cleanCaptionText)
    .filter(Boolean);
  const chunks = parts.length > 0 ? parts : [cleanCaptionText(value)].filter(Boolean);

  return chunks.flatMap((chunk) => {
    if (visualWeight(chunk) <= captionWeightLimit) return [chunk];
    if (hasLatinWords(chunk)) {
      const words = chunk.split(/\s+/).filter(Boolean);
      const lines = [];
      let line = '';
      for (const word of words) {
        const wordParts = visualWeight(word) > captionWeightLimit ? splitCjkChunk(word) : [word];
        for (const part of wordParts) {
          const candidate = line ? `${line} ${part}` : part;
          if (visualWeight(candidate) > captionWeightLimit && line) {
            lines.push(line);
            line = part;
          } else {
            line = candidate;
          }
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    return splitCjkChunk(chunk);
  });
};

const srtTime = (seconds) => {
  const milliseconds = Math.round(seconds * 1000);
  const ms = String(milliseconds % 1000).padStart(3, '0');
  const totalSeconds = Math.floor(milliseconds / 1000);
  const ss = String(totalSeconds % 60).padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mm = String(totalMinutes % 60).padStart(2, '0');
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  return `${hh}:${mm}:${ss},${ms}`;
};

const planPath = process.argv[2];
if (!planPath) {
  console.error('Usage: node scripts/normalize-captions.mjs <video-plan.json>');
  process.exit(1);
}

const absolutePlanPath = path.resolve(planPath);
const plan = JSON.parse(fs.readFileSync(absolutePlanPath, 'utf8'));
const sourceCaptions = Array.isArray(plan.scenes) && plan.scenes.length > 0
  ? plan.scenes
      .filter((scene) => Number.isFinite(Number(scene.start)) && Number.isFinite(Number(scene.end)))
      .map((scene) => ({
        start: scene.start,
        end: scene.end,
        text: scene.voiceover ?? scene.caption ?? '',
        keywords: scene.caption ? [scene.caption] : [],
      }))
  : Array.isArray(plan.captions)
    ? plan.captions
    : [];
const captions = [];

for (const caption of sourceCaptions) {
  const chunks = splitBreaths(caption.text);
  if (chunks.length === 0) continue;

  const start = Number(caption.start);
  const end = Number(caption.end);
  const duration = Math.max(0, end - start);
  const weights = chunks.map(textWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = start;

  chunks.forEach((chunk, index) => {
    const chunkDuration =
      index === chunks.length - 1
        ? end - cursor
        : (duration * weights[index]) / totalWeight;
    const captionStart = roundTime(cursor);
    const captionEnd = roundTime(Math.min(end, cursor + chunkDuration));

    if (captionEnd > captionStart) {
      captions.push({
        ...caption,
        id: `cap-${String(captions.length + 1).padStart(3, '0')}`,
        start: captionStart,
        end: captionEnd,
        text: chunk,
      });
    }

    cursor = captionEnd;
  });
}

plan.captions = captions;

const planDir = path.dirname(absolutePlanPath);
const captionsDir = path.join(planDir, 'captions');
fs.mkdirSync(captionsDir, {recursive: true});

const captionsJsonPath = path.join(captionsDir, 'captions.json');
const captionsSrtPath = path.join(captionsDir, 'captions.srt');
const srt = captions
  .map(
    (caption, index) =>
      `${index + 1}\n${srtTime(caption.start)} --> ${srtTime(caption.end)}\n${caption.text}\n`,
  )
  .join('\n');

fs.writeFileSync(absolutePlanPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
fs.writeFileSync(captionsJsonPath, `${JSON.stringify(captions, null, 2)}\n`, 'utf8');
fs.writeFileSync(captionsSrtPath, srt, 'utf8');

console.log(`Normalized ${sourceCaptions.length} captions into ${captions.length} breath captions.`);
console.log(captionsJsonPath);
console.log(captionsSrtPath);

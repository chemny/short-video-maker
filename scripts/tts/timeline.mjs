import fs from 'node:fs';
import path from 'node:path';
import {commandFromEnv} from '../lib/bins.mjs';
import {envMilliseconds, runCommand} from '../lib/process.mjs';
import {detectDuration} from './media.mjs';

const roundTime = (value) => Math.round(value * 1000) / 1000;
const textWeight = (value) => Math.max(1, String(value ?? '').replace(/\s+/g, '').length);
const hasLatinWords = (value) => /[A-Za-z][A-Za-z\s-]*[A-Za-z]/.test(value);
const captionWeightLimit = 16;

export const cleanCaptionText = (value) =>
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

const splitCaptionText = (value) => {
  const source = String(value ?? '').trim();
  const parts = source
    .split(/[，,。.!！?？、；;：:\n]+/)
    .map(cleanCaptionText)
    .filter(Boolean);
  const chunks = parts.length > 0 ? parts : [cleanCaptionText(source)].filter(Boolean);

  return chunks.flatMap((chunk) => {
    if (visualWeight(chunk) <= captionWeightLimit) {
      return [chunk];
    }

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

export const writeTimeline = ({
  planPath,
  plan,
  outputMp3,
  sceneDurations,
  providerMeta,
}) => {
  const planDir = path.dirname(planPath);
  const captionsDir = path.join(planDir, 'captions');
  fs.mkdirSync(captionsDir, {recursive: true});

  const captions = [];
  let cursor = 0;
  const finalDuration = detectDuration(outputMp3);

  if (sceneDurations) {
    plan.scenes = plan.scenes.map((scene, index) => {
      const start = roundTime(cursor);
      const end = roundTime(cursor + sceneDurations[index]);
      cursor = end;
      return {...scene, start, end};
    });
  } else {
    const sceneWeights = plan.scenes.map((scene) => textWeight(scene.voiceover));
    const totalWeight = sceneWeights.reduce((sum, weight) => sum + weight, 0);
    plan.scenes = plan.scenes.map((scene, index) => {
      const isLast = index === plan.scenes.length - 1;
      const sceneDuration = isLast
        ? finalDuration - cursor
        : (finalDuration * sceneWeights[index]) / totalWeight;
      const start = roundTime(cursor);
      const end = roundTime(Math.max(start + 0.5, cursor + sceneDuration));
      cursor = end;
      return {...scene, start, end};
    });
  }

  for (const scene of plan.scenes) {
    const chunks = splitCaptionText(scene.voiceover);
    const chunkWeights = chunks.map(textWeight);
    const totalChunkWeight = chunkWeights.reduce((sum, weight) => sum + weight, 0);
    let captionCursor = scene.start;

    chunks.forEach((chunk, chunkIndex) => {
      const captionDuration =
        chunkIndex === chunks.length - 1
          ? scene.end - captionCursor
          : ((scene.end - scene.start) * chunkWeights[chunkIndex]) / totalChunkWeight;
      const captionStart = roundTime(captionCursor);
      const captionEnd = roundTime(Math.min(scene.end, captionCursor + captionDuration));

      captions.push({
        id: `cap-${String(captions.length + 1).padStart(3, '0')}`,
        start: captionStart,
        end: captionEnd,
        text: chunk,
        keywords: scene.caption ? [scene.caption] : [],
      });

      captionCursor = captionEnd;
    });
  }

  plan.meta.durationSeconds = roundTime(finalDuration);
  plan.audio = {
    ...(plan.audio ?? {}),
    voiceover: 'audio/voiceover.mp3',
    voiceVolume: plan.audio?.voiceVolume ?? 1,
    ...providerMeta,
  };
  plan.captions = captions;

  const captionsJsonPath = path.join(captionsDir, 'captions.json');
  const captionsSrtPath = path.join(captionsDir, 'captions.srt');
  const srt = captions
    .map(
      (caption, index) =>
        `${index + 1}\n${srtTime(caption.start)} --> ${srtTime(caption.end)}\n${caption.text}\n`,
    )
    .join('\n');

  fs.writeFileSync(captionsJsonPath, `${JSON.stringify(captions, null, 2)}\n`, 'utf8');
  fs.writeFileSync(captionsSrtPath, srt, 'utf8');
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

  return {
    durationSeconds: finalDuration,
    captionsJsonPath,
    captionsSrtPath,
  };
};

export const concatMp3Segments = ({segmentFiles, outputMp3, concatListPath}) => {
  const escapeConcatPath = (file) => path.resolve(file).replaceAll('\\', '/').replaceAll("'", "'\\''");

  fs.writeFileSync(
    concatListPath,
    segmentFiles.map((file) => `file '${escapeConcatPath(file)}'`).join('\n'),
    'utf8',
  );
  runCommand(commandFromEnv('ffmpeg'), ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', outputMp3], {
    stdio: 'ignore',
    label: 'concat mp3 segments',
    timeoutMs: envMilliseconds('SHORT_VIDEO_FFMPEG_TIMEOUT_MS', 180000),
  });
};

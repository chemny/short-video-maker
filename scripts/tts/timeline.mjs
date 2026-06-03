import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {detectDuration} from './media.mjs';

const roundTime = (value) => Math.round(value * 1000) / 1000;
const textWeight = (value) => Math.max(1, String(value ?? '').replace(/\s+/g, '').length);

const splitCaptionText = (value) => {
  const source = String(value ?? '').trim();
  const parts = source
    .split(/(?<=[。！？；.!?;])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks = parts.length > 0 ? parts : [source];

  return chunks.flatMap((chunk) => {
    if (chunk.length <= 30) {
      return [chunk];
    }

    const result = [];
    for (let index = 0; index < chunk.length; index += 26) {
      result.push(chunk.slice(index, index + 26));
    }
    return result;
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
  fs.writeFileSync(
    concatListPath,
    segmentFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'),
    'utf8',
  );
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', outputMp3], {
    stdio: 'ignore',
  });
};

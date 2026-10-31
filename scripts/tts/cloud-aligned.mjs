import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {prepareNarration, alignGenerated} from './aligned.mjs';
import {runCommand} from '../lib/process.mjs';
import {commandFromEnv} from '../lib/bins.mjs';
import {inspectAsset} from '../lib/media-assets.mjs';

export const generateCloudAligned = async ({planPath, options = {}, provider, skillRoot}) => {
  const job = path.dirname(planPath); const plan = JSON.parse(fs.readFileSync(planPath));
  prepareNarration(plan); // Validate approved text before any online request.
  const work = path.join(job, 'audio', '.tts-work', provider.name); fs.mkdirSync(work, {recursive: true});
  let result;
  try {result = await (provider.generateSegments ?? provider.generate)({plan, planPath, planDir: job, outputMp3: path.join(work, 'voiceover.mp3'), options, skillRoot});}
  catch (error) {error.ttsSynthesisFailed = true; throw error;}
  if (!result.segments?.length) throw new Error('Cloud provider did not return scene audio segments');
  const stage = fs.mkdtempSync(path.join(work, '.pcm-'));
  try {
    let offset = 0; const words = []; let complete = true;
    const files = result.segments.map((segment, i) => {
      const file = path.join(stage, `${i}.wav`);
      runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-n', '-i', segment.segmentPath, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', file], {stdio: 'pipe'});
      const duration = inspectAsset(file).duration;
      if (!segment.words?.length) complete = false;
      for (const word of segment.words ?? []) words.push({...word, start: word.start + offset, end: word.end + offset});
      offset += duration; return file;
    });
    const joined = path.join(stage, 'narration.wav');
    runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-n', ...files.flatMap((file) => ['-i', file]), '-filter_complex', `${files.map((_, i) => `[${i}:a]`).join('')}concat=n=${files.length}:v=0:a=1[a]`, '-map', '[a]', '-c:a', 'pcm_s16le', joined], {stdio: 'pipe'});
    const audioSha256 = createHash('sha256').update(fs.readFileSync(joined)).digest('hex');
    const generated = {file: joined, words: complete ? words : null, reused: result.segments.every((s) => s.reused === true),
      meta: {provider: provider.name, providerMeta: result.providerMeta, audioSha256, texts: plan.scenes.map((s) => s.voiceover), duration: inspectAsset(joined).duration,
        sceneCache: result.segments.map((s) => ({reused: s.reused === true})),
        timingOrigin: result.timingOrigin ?? (complete ? 'synthesis-service-word-boundaries' : 'local-ASR-required')}};
    return alignGenerated({planPath, options, provider: provider.name, generated});
  } finally {fs.rmSync(stage, {recursive: true, force: true}); result.cleanup?.();}
};

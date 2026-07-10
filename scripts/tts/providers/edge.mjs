import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {detectDuration, requireCommands} from '../media.mjs';
import {concatMp3Segments} from '../timeline.mjs';
import {
  positiveInteger,
  readCachedScene,
  runWithConcurrency,
  sceneCacheKey,
  writeCachedScene,
} from '../cache.mjs';
import {timed} from '../../lib/timing.mjs';

export const name = 'edge';

const require = createRequire(import.meta.url);
const {EdgeTTS} = require('node-edge-tts');

const defaultVoice = 'zh-CN-XiaoxiaoNeural';
const defaultLang = 'zh-CN';
const defaultOutputFormat = 'audio-24khz-48kbitrate-mono-mp3';

const getConfig = ({options}) => ({
  voice: options.voice ?? process.env.EDGE_TTS_VOICE ?? defaultVoice,
  lang: process.env.EDGE_TTS_LANG ?? defaultLang,
  outputFormat: process.env.EDGE_TTS_OUTPUT_FORMAT ?? defaultOutputFormat,
  rate: options.rate ?? process.env.EDGE_TTS_RATE ?? 'default',
  pitch: process.env.EDGE_TTS_PITCH ?? 'default',
  volume: process.env.EDGE_TTS_VOLUME ?? 'default',
  timeout: process.env.EDGE_TTS_TIMEOUT ?? '30000',
  proxy: process.env.EDGE_TTS_PROXY,
});

const runEdgeTts = async ({text, outputPath, config}) => {
  const tts = new EdgeTTS({
    voice: config.voice,
    lang: config.lang,
    outputFormat: config.outputFormat,
    rate: config.rate,
    pitch: config.pitch,
    volume: config.volume,
    timeout: Number(config.timeout),
    proxy: config.proxy,
  });
  await tts.ttsPromise(text, outputPath);
};

export const listVoices = () => [
  {
    id: 'zh-CN-XiaoxiaoNeural',
    name: '小小',
    locale: 'zh-CN',
    configured: true,
    note: 'Default Edge TTS Mandarin female voice. No API key required.',
  },
  {
    id: 'zh-CN-XiaoyiNeural',
    name: '小艺',
    locale: 'zh-CN',
    configured: true,
    note: 'Alternative Edge TTS Mandarin female voice.',
  },
  {
    id: 'zh-CN-YunxiNeural',
    name: '云希',
    locale: 'zh-CN',
    configured: true,
    note: 'Alternative Edge TTS Mandarin male voice.',
  },
];

export const preview = async ({text, outputPath, options}) => {
  requireCommands(['ffprobe']);
  const config = getConfig({options});
  await runEdgeTts({text, outputPath, config});

  return {
    provider: 'edge',
    voice: config.voice,
    lang: config.lang,
    rate: config.rate,
    durationSeconds: detectDuration(outputPath),
  };
};

export const generate = async ({plan, outputMp3, options}) => {
  requireCommands(['ffmpeg', 'ffprobe']);
  const config = getConfig({options});
  const audioDir = path.dirname(outputMp3);
  const segmentsDir = path.join(audioDir, 'segments');
  const concurrency = positiveInteger(
    options.concurrency ?? process.env.SHORT_VIDEO_TTS_CONCURRENCY,
    2,
    'SHORT_VIDEO_TTS_CONCURRENCY',
  );
  fs.rmSync(segmentsDir, {recursive: true, force: true});
  fs.mkdirSync(segmentsDir, {recursive: true});

  const results = await runWithConcurrency({
    items: plan.scenes,
    concurrency,
    worker: async (scene, index) => {
      const text = String(scene.voiceover ?? '').trim();
      if (!text) {
        throw new Error(`Scene ${index + 1} has empty voiceover`);
      }

      const segmentPath = path.join(segmentsDir, `scene-${String(index + 1).padStart(3, '0')}.mp3`);
      const key = sceneCacheKey({provider: 'edge', text, config});
      const cached = readCachedScene({audioDir, provider: 'edge', key});
      if (cached) {
        fs.copyFileSync(cached.audioPath, segmentPath);
        console.log(`Reused cached scene ${index + 1}: ${cached.duration.toFixed(2)}s`);
        return {segmentPath, duration: cached.duration};
      }

      await timed(`edge tts scene ${index + 1}`, () => runEdgeTts({text, outputPath: segmentPath, config}));
      const duration = detectDuration(segmentPath);
      writeCachedScene({
        audioDir,
        provider: 'edge',
        key,
        sourcePath: segmentPath,
        meta: {duration, provider: 'edge', voice: config.voice, rate: config.rate},
      });
      console.log(`Generated scene ${index + 1}: ${duration.toFixed(2)}s`);
      return {segmentPath, duration};
    },
  });

  concatMp3Segments({
    segmentFiles: results.map((result) => result.segmentPath),
    outputMp3,
    concatListPath: path.join(segmentsDir, 'concat.txt'),
  });

  return {
    sceneDurations: results.map((result) => result.duration),
    providerMeta: {
      provider: 'edge',
      voice: config.voice,
      lang: config.lang,
      rate: config.rate,
      outputFormat: config.outputFormat,
      concurrency,
    },
  };
};

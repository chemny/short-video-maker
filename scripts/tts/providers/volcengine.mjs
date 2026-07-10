import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {envNumber, requireEnv} from '../args.mjs';
import {detectDuration, requireCommands} from '../media.mjs';
import {concatMp3Segments} from '../timeline.mjs';
import {fetchWithTimeout} from '../../lib/fetch.mjs';
import {
  positiveInteger,
  readCachedScene,
  runWithConcurrency,
  sceneCacheKey,
  writeCachedScene,
} from '../cache.mjs';
import {timed} from '../../lib/timing.mjs';

export const name = 'volcengine';

const loadPresets = (skillRoot) => {
  const presetsPath = path.join(skillRoot, 'data', 'voice-presets.json');
  return fs.existsSync(presetsPath) ? JSON.parse(fs.readFileSync(presetsPath, 'utf8')) : [];
};

const getConfig = ({skillRoot, options}) => {
  const presets = loadPresets(skillRoot);
  const presetId = options.voicePreset ?? process.env.VOLCENGINE_TTS_PRESET ?? 'deep-male';
  const preset = presets.find((item) => item.id === presetId);

  if (presetId && !preset) {
    throw new Error(`Unknown Volcengine TTS preset: ${presetId}`);
  }

  const voiceType = options.voice ?? process.env.VOLCENGINE_TTS_VOICE_TYPE ?? preset?.voiceType;
  if (!voiceType) {
    throw new Error(`Preset ${presetId} does not have a configured voiceType. Set VOLCENGINE_TTS_VOICE_TYPE.`);
  }

  return {
    appid: process.env.VOLCENGINE_TTS_APPID,
    accessToken: process.env.VOLCENGINE_TTS_ACCESS_TOKEN,
    cluster: options.cluster ?? process.env.VOLCENGINE_TTS_CLUSTER ?? preset?.cluster ?? 'volcano_tts',
    voiceType,
    endpoint:
      process.env.VOLCENGINE_TTS_ENDPOINT ??
      'https://openspeech.bytedance.com/api/v1/tts',
    encoding: process.env.VOLCENGINE_TTS_ENCODING ?? 'mp3',
    speedRatio:
      options.speed !== undefined
        ? Number(options.speed)
        : envNumber('VOLCENGINE_TTS_SPEED_RATIO', preset?.speedRatio ?? 1),
    loudnessRatio:
      options.loudness !== undefined
        ? Number(options.loudness)
        : envNumber('VOLCENGINE_TTS_LOUDNESS_RATIO', preset?.loudnessRatio ?? 1),
    model: options.model ?? process.env.VOLCENGINE_TTS_MODEL ?? preset?.model ?? 'seed-tts-1.1',
    uid: process.env.VOLCENGINE_TTS_UID ?? 'short-video-maker',
    preset,
  };
};

const requestTts = async ({config, text, index}) => {
  const body = {
    app: {
      appid: config.appid,
      token: config.accessToken,
      cluster: config.cluster,
    },
    user: {
      uid: config.uid,
    },
    audio: {
      voice_type: config.voiceType,
      encoding: config.encoding,
      speed_ratio: config.speedRatio,
      loudness_ratio: config.loudnessRatio,
      explicit_language: 'zh-cn',
    },
    request: {
      reqid: crypto.randomUUID(),
      text,
      operation: 'query',
      model: config.model,
      with_timestamp: 1,
      extra_param: JSON.stringify({
        disable_markdown_filter: true,
        mute_cut_threshold: '400',
        mute_cut_remain_ms: '50',
      }),
    },
  };

  const response = await fetchWithTimeout(config.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer;${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, {envName: 'SHORT_VIDEO_TTS_FETCH_TIMEOUT_MS', label: `Volcengine TTS${index !== undefined ? ` scene ${index + 1}` : ''}`});

  if (!response.ok) {
    throw new Error(`Volcengine TTS HTTP ${response.status}${index !== undefined ? ` for scene ${index + 1}` : ''}`);
  }

  const result = await response.json();
  if (result.code !== 3000 || !result.data) {
    throw new Error(`Volcengine TTS failed: code=${result.code} message=${result.message}`);
  }

  return result;
};

export const listVoices = ({skillRoot}) => {
  const presets = loadPresets(skillRoot);
  return presets.map((preset) => ({
    id: preset.voiceType || preset.id,
    name: preset.name,
    preset: preset.id,
    configured: Boolean(preset.voiceType),
    note: preset.note,
  }));
};

export const preview = async ({text, outputPath, options, skillRoot}) => {
  requireEnv(['VOLCENGINE_TTS_APPID', 'VOLCENGINE_TTS_ACCESS_TOKEN']);
  const config = getConfig({skillRoot, options});
  const result = await requestTts({config, text});
  fs.writeFileSync(outputPath, Buffer.from(result.data, 'base64'));

  return {
    provider: 'volcengine',
    preset: config.preset?.id,
    voiceType: config.voiceType,
    speedRatio: config.speedRatio,
    loudnessRatio: config.loudnessRatio,
    model: config.model,
  };
};

export const generate = async ({plan, planDir, outputMp3, options, skillRoot}) => {
  requireEnv(['VOLCENGINE_TTS_APPID', 'VOLCENGINE_TTS_ACCESS_TOKEN']);
  requireCommands(['ffmpeg', 'ffprobe']);
  const config = getConfig({skillRoot, options});
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
      const key = sceneCacheKey({provider: 'volcengine', text, config});
      const cached = readCachedScene({audioDir, provider: 'volcengine', key});
      if (cached) {
        fs.copyFileSync(cached.audioPath, segmentPath);
        console.log(`Reused cached scene ${index + 1}: ${cached.duration.toFixed(2)}s`);
        return {segmentPath, duration: cached.duration};
      }

      const result = await timed(`volcengine tts scene ${index + 1}`, () => requestTts({config, text, index}));
      fs.writeFileSync(segmentPath, Buffer.from(result.data, 'base64'));

      const apiDuration = Number(result.addition?.duration) / 1000;
      const duration = Number.isFinite(apiDuration) && apiDuration > 0 ? apiDuration : detectDuration(segmentPath);
      writeCachedScene({
        audioDir,
        provider: 'volcengine',
        key,
        sourcePath: segmentPath,
        meta: {duration, provider: 'volcengine', voiceType: config.voiceType, model: config.model},
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
      provider: 'volcengine',
      preset: config.preset?.id,
      cluster: config.cluster,
      voiceType: config.voiceType,
      speedRatio: config.speedRatio,
      loudnessRatio: config.loudnessRatio,
      model: config.model,
      endpoint: config.endpoint,
      concurrency,
    },
  };
};

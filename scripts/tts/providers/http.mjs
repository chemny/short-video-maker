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

export const name = 'http';

const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  const ttsCredential = process.env.TTS_API_KEY;
  const authType = process.env.TTS_API_AUTH_TYPE ?? 'bearer';

  if (!ttsCredential || authType === 'none') {
    return headers;
  }

  if (authType === 'bearer') {
    headers.Authorization = `Bearer ${ttsCredential}`;
    return headers;
  }

  const keyHeader = process.env.TTS_API_KEY_HEADER ?? 'X-API-Key';
  headers[keyHeader] = ttsCredential;
  return headers;
};

const extractAudio = async (response) => {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.startsWith('audio/') || contentType.includes('application/octet-stream')) {
    return Buffer.from(await response.arrayBuffer());
  }

  const result = await response.json();
  const base64Audio =
    result.audio ??
    result.audioBase64 ??
    result.audio_base64 ??
    result.data?.audio ??
    result.data?.audioBase64 ??
    result.data?.audio_base64 ??
    result.data;

  if (typeof base64Audio === 'string' && !base64Audio.startsWith('http')) {
    return Buffer.from(base64Audio, 'base64');
  }

  const audioUrl = result.url ?? result.audio_url ?? result.audioUrl ?? result.data?.url ?? result.data?.audio_url;
  if (typeof audioUrl === 'string') {
    const audioResponse = await fetchWithTimeout(audioUrl, {}, {envName: 'SHORT_VIDEO_TTS_FETCH_TIMEOUT_MS', label: 'HTTP TTS audio download'});
    if (!audioResponse.ok) {
      throw new Error(`Unable to download TTS audio URL: HTTP ${audioResponse.status}`);
    }
    return Buffer.from(await audioResponse.arrayBuffer());
  }

  throw new Error('HTTP TTS response must return audio bytes, base64 audio, or an audio URL.');
};

const requestTts = async ({text, options}) => {
  requireEnv(['TTS_API_BASE_URL']);
  const extra =
    process.env.TTS_API_EXTRA_JSON && process.env.TTS_API_EXTRA_JSON.trim()
      ? JSON.parse(process.env.TTS_API_EXTRA_JSON)
      : {};
  const body = {
    text,
    input: text,
    app_id: process.env.TTS_API_APP_ID,
    app_secret: process.env.TTS_API_APP_SECRET,
    base_id: process.env.TTS_API_BASE_ID,
    model: options.model ?? process.env.TTS_API_MODEL,
    voice: options.voice ?? process.env.TTS_API_VOICE,
    response_format: process.env.TTS_API_FORMAT ?? 'mp3',
    format: process.env.TTS_API_FORMAT ?? 'mp3',
    speed: options.speed !== undefined ? Number(options.speed) : envNumber('TTS_API_SPEED', 1),
    ...extra,
  };

  const response = await fetchWithTimeout(process.env.TTS_API_BASE_URL, {
    method: process.env.TTS_API_METHOD ?? 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  }, {envName: 'SHORT_VIDEO_TTS_FETCH_TIMEOUT_MS', label: 'HTTP TTS request'});

  if (!response.ok) {
    throw new Error(`HTTP TTS failed: HTTP ${response.status}`);
  }

  return extractAudio(response);
};

export const listVoices = async () => {
  if (!process.env.TTS_API_VOICES_URL) {
    return [
      {
        id: process.env.TTS_API_VOICE ?? '',
        name: process.env.TTS_API_VOICE ? 'Configured voice' : 'No voice list endpoint configured',
        configured: Boolean(process.env.TTS_API_VOICE),
        note: 'Set TTS_API_VOICES_URL if your provider supports listing voices.',
      },
    ];
  }

  const response = await fetchWithTimeout(process.env.TTS_API_VOICES_URL, {
    headers: getHeaders(),
  }, {envName: 'SHORT_VIDEO_TTS_FETCH_TIMEOUT_MS', label: 'HTTP TTS voices request'});

  if (!response.ok) {
    throw new Error(`HTTP voices request failed: HTTP ${response.status}`);
  }

  const result = await response.json();
  const voices = Array.isArray(result) ? result : result.voices ?? result.data ?? [];

  return voices.map((voice) => ({
    id: voice.id ?? voice.voice_id ?? voice.name ?? '',
    name: voice.name ?? voice.display_name ?? voice.id ?? voice.voice_id ?? '',
    raw: voice,
  }));
};

export const preview = async ({text, outputPath, options}) => {
  const audio = await requestTts({text, options});
  fs.writeFileSync(outputPath, audio);

  return {
    provider: 'http',
    endpoint: process.env.TTS_API_BASE_URL,
    model: options.model ?? process.env.TTS_API_MODEL,
    voice: options.voice ?? process.env.TTS_API_VOICE,
  };
};

export const generate = async ({plan, outputMp3, options}) => {
  requireCommands(['ffmpeg', 'ffprobe']);
  const audioDir = path.dirname(outputMp3);
  const segmentsDir = path.join(audioDir, 'segments');
  const config = {
    endpoint: process.env.TTS_API_BASE_URL,
    model: options.model ?? process.env.TTS_API_MODEL,
    voice: options.voice ?? process.env.TTS_API_VOICE,
    speed: options.speed !== undefined ? Number(options.speed) : envNumber('TTS_API_SPEED', 1),
  };
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
      const key = sceneCacheKey({provider: 'http', text, config});
      const cached = readCachedScene({audioDir, provider: 'http', key});
      if (cached) {
        fs.copyFileSync(cached.audioPath, segmentPath);
        console.log(`Reused cached scene ${index + 1}: ${cached.duration.toFixed(2)}s`);
        return {segmentPath, duration: cached.duration};
      }

      const audio = await timed(`http tts scene ${index + 1}`, () => requestTts({text, options}));
      fs.writeFileSync(segmentPath, audio);
      const duration = detectDuration(segmentPath);
      writeCachedScene({
        audioDir,
        provider: 'http',
        key,
        sourcePath: segmentPath,
        meta: {duration, provider: 'http', endpoint: config.endpoint, model: config.model, voice: config.voice},
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
      provider: 'http',
      endpoint: process.env.TTS_API_BASE_URL,
      model: options.model ?? process.env.TTS_API_MODEL,
      voice: options.voice ?? process.env.TTS_API_VOICE,
      concurrency,
    },
  };
};

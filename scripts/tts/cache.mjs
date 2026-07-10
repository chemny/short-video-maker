import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

export const positiveInteger = (value, fallback, label) => {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
};

export const sceneCacheKey = ({provider, text, config}) =>
  crypto
    .createHash('sha256')
    .update(stableStringify({provider, text, config}))
    .digest('hex')
    .slice(0, 24);

export const cachePaths = ({audioDir, provider, key}) => {
  const cacheDir = path.join(audioDir, '.tts-cache', provider);
  return {
    cacheDir,
    audioPath: path.join(cacheDir, `${key}.mp3`),
    metaPath: path.join(cacheDir, `${key}.json`),
  };
};

export const readCachedScene = ({audioDir, provider, key}) => {
  const paths = cachePaths({audioDir, provider, key});
  if (!fs.existsSync(paths.audioPath) || !fs.existsSync(paths.metaPath)) {
    return null;
  }

  const meta = JSON.parse(fs.readFileSync(paths.metaPath, 'utf8'));
  if (!Number.isFinite(meta.duration) || meta.duration <= 0) {
    return null;
  }

  return {
    audioPath: paths.audioPath,
    duration: meta.duration,
  };
};

export const writeCachedScene = ({audioDir, provider, key, sourcePath, meta}) => {
  const paths = cachePaths({audioDir, provider, key});
  fs.mkdirSync(paths.cacheDir, {recursive: true});
  fs.copyFileSync(sourcePath, paths.audioPath);
  fs.writeFileSync(paths.metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
};

export const runWithConcurrency = async ({items, concurrency, worker}) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({length: Math.min(concurrency, items.length)}, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

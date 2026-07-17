#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fetchWithTimeout} from './lib/fetch.mjs';
import {resolveRemotionBin} from './lib/bins.mjs';
import {skillRootFrom} from './lib/paths.mjs';
import {envMilliseconds, runCommand} from './lib/process.mjs';

const args = process.argv.slice(2);
const planPath = args[0];
const outputDirArg = args[1] ?? 'output';
const providerArg = args.find((arg) => arg.startsWith('--provider='))?.split('=')[1];
const remotionBinArg = args.find((arg) => arg.startsWith('--remotion-bin='))?.split('=')[1];

if (!planPath) {
  console.error(
    'Usage: node scripts/generate-cover.mjs <path-to-video-plan.json> [output-dir] [--provider=remotion|openai|nano-banana|http|none]',
  );
  process.exit(2);
}

const skillRoot = skillRootFrom(import.meta.url, '..');
const absolutePlanPath = path.resolve(planPath);
const planDir = path.dirname(absolutePlanPath);
const plan = JSON.parse(fs.readFileSync(absolutePlanPath, 'utf8'));
const outputDir = path.resolve(planDir, outputDirArg);
const coverPath = path.join(outputDir, 'cover.png');
const provider = providerArg ?? plan.cover?.provider ?? 'remotion';

fs.mkdirSync(outputDir, {recursive: true});

const envValue = (name, fallback = undefined) => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
};

const buildPrompt = () => {
  if (plan.cover?.prompt) {
    return plan.cover.prompt;
  }

  const parts = [
    `Vertical short-video cover for topic: ${plan.meta?.topic ?? plan.meta?.title ?? ''}.`,
    `Main title: ${plan.cover?.title ?? plan.meta?.title ?? ''}.`,
    plan.cover?.subtitle ? `Subtitle: ${plan.cover.subtitle}.` : '',
    'High contrast, premium Chinese social media thumbnail, clean editorial layout, strong focal point.',
    'Leave safe empty space for large Chinese title overlay, avoid small unreadable text.',
    `Aspect ratio ${plan.meta?.width ?? 1080}:${plan.meta?.height ?? 1920}.`,
  ];

  return parts.filter(Boolean).join(' ');
};

const writeBase64 = (base64, destination) => {
  const normalized = base64.includes(',') ? base64.split(',').pop() : base64;
  fs.writeFileSync(destination, Buffer.from(normalized, 'base64'));
};

const downloadToFile = async (url, destination) => {
  const response = await fetchWithTimeout(url, {}, {envName: 'SHORT_VIDEO_IMAGE_FETCH_TIMEOUT_MS', label: 'cover image download'});
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status} ${response.statusText}`);
  }

  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
};

const findImageData = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (typeof payload.b64_json === 'string') {
    return {type: 'base64', value: payload.b64_json};
  }

  if (typeof payload.image_base64 === 'string') {
    return {type: 'base64', value: payload.image_base64};
  }

  if (typeof payload.image === 'string' && payload.image.length > 200) {
    return {type: 'base64', value: payload.image};
  }

  if (typeof payload.url === 'string') {
    return {type: 'url', value: payload.url};
  }

  if (Array.isArray(payload.data)) {
    for (const item of payload.data) {
      const found = findImageData(item);
      if (found) {
        return found;
      }
    }
  }

  if (Array.isArray(payload.images)) {
    for (const item of payload.images) {
      const found = findImageData(typeof item === 'string' ? {url: item} : item);
      if (found) {
        return found;
      }
    }
  }

  for (const key of ['candidates', 'content', 'parts', 'outputs', 'result']) {
    const value = payload[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findImageData(item);
        if (found) {
          return found;
        }
      }
    } else if (value && typeof value === 'object') {
      const found = findImageData(value);
      if (found) {
        return found;
      }
    }
  }

  if (payload.inlineData?.data) {
    return {type: 'base64', value: payload.inlineData.data};
  }

  if (payload.inline_data?.data) {
    return {type: 'base64', value: payload.inline_data.data};
  }

  return null;
};

const saveImageFromPayload = async (payload, destination) => {
  const image = findImageData(payload);

  if (!image) {
    fs.writeFileSync(path.join(outputDir, 'cover-response.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    throw new Error('No image data found in provider response; wrote cover-response.json for inspection.');
  }

  if (image.type === 'base64') {
    writeBase64(image.value, destination);
  } else {
    await downloadToFile(image.value, destination);
  }
};

const renderRemotionCover = () => {
  const remotionDir = path.join(skillRoot, 'remotion');
  const remotionBin = remotionBinArg ?? resolveRemotionBin(remotionDir);

  if (!fs.existsSync(remotionBin)) {
    throw new Error(`Remotion CLI not found: ${remotionBin}`);
  }

  const outDir = path.join(remotionDir, 'out');
  const renderedCover = path.join(outDir, 'cover.png');
  fs.mkdirSync(outDir, {recursive: true});
  runCommand(remotionBin, ['still', 'src/index.ts', 'CoverStill', 'out/cover.png', '--frame=0'], {
    cwd: remotionDir,
    stdio: 'inherit',
    label: 'remotion cover generation',
    timeoutMs: envMilliseconds('SHORT_VIDEO_PREVIEW_TIMEOUT_MS', 300000),
  });
  fs.copyFileSync(renderedCover, coverPath);
};

const generateOpenAiCover = async () => {
  const imageCredential = envValue('OPENAI_API_KEY');
  if (!imageCredential) {
    throw new Error('OPENAI_API_KEY is required for --provider=openai');
  }

  const endpoint = envValue('OPENAI_IMAGES_ENDPOINT', 'https://api.openai.com/v1/images/generations');
  const model = envValue('OPENAI_IMAGE_MODEL', plan.cover?.model ?? 'gpt-image-1.5');
  const body = {
    model,
    prompt: buildPrompt(),
    size: envValue('OPENAI_IMAGE_SIZE', plan.cover?.size ?? '1024x1536'),
    n: 1,
  };

  for (const [envName, fieldName] of [
    ['OPENAI_IMAGE_QUALITY', 'quality'],
    ['OPENAI_IMAGE_BACKGROUND', 'background'],
    ['OPENAI_IMAGE_OUTPUT_FORMAT', 'output_format'],
  ]) {
    const value = envValue(envName);
    if (value) {
      body[fieldName] = value;
    }
  }

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${imageCredential}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, {envName: 'SHORT_VIDEO_IMAGE_FETCH_TIMEOUT_MS', label: 'OpenAI cover request'});

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenAI image request failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  await saveImageFromPayload(payload, coverPath);
};

const generateNanoBananaCover = async () => {
  const apiUrl = envValue('NANOBANANA_API_URL');
  const imageCredential = envValue('NANOBANANA_API_KEY');

  if (!apiUrl || !imageCredential) {
    throw new Error('NANOBANANA_API_URL and NANOBANANA_API_KEY are required for --provider=nano-banana');
  }

  const body = {
    contents: [
      {
        parts: [{text: buildPrompt()}],
      },
    ],
    generationConfig: {
      imageConfig: {
        aspectRatio: envValue('NANOBANANA_ASPECT_RATIO', plan.cover?.aspectRatio ?? '9:16'),
      },
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const response = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': imageCredential,
    },
    body: JSON.stringify(body),
  }, {envName: 'SHORT_VIDEO_IMAGE_FETCH_TIMEOUT_MS', label: 'Nano Banana cover request'});

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Nano Banana image request failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  await saveImageFromPayload(payload, coverPath);
};

const generateHttpCover = async () => {
  const endpoint = envValue('COVER_API_URL');
  const coverCredential = envValue('COVER_API_KEY');

  if (!endpoint) {
    throw new Error('COVER_API_URL is required for --provider=http');
  }

  const body = {
    prompt: buildPrompt(),
    width: plan.meta?.width ?? 1080,
    height: plan.meta?.height ?? 1920,
    aspectRatio: plan.cover?.aspectRatio ?? '9:16',
    model: envValue('COVER_API_MODEL', plan.cover?.model),
    style: plan.style,
    cover: plan.cover,
  };

  const headers = {'Content-Type': 'application/json'};
  if (coverCredential) {
    headers.Authorization = `Bearer ${coverCredential}`;
  }

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, {envName: 'SHORT_VIDEO_IMAGE_FETCH_TIMEOUT_MS', label: 'HTTP cover request'});

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Cover HTTP request failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  await saveImageFromPayload(payload, coverPath);
};

try {
  if (provider === 'none') {
    console.log('Skipped cover generation.');
  } else if (provider === 'remotion') {
    renderRemotionCover();
  } else if (provider === 'openai') {
    await generateOpenAiCover();
  } else if (provider === 'nano-banana') {
    await generateNanoBananaCover();
  } else if (provider === 'http') {
    await generateHttpCover();
  } else {
    throw new Error(`Unknown cover provider: ${provider}`);
  }

  if (provider !== 'none') {
    console.log(`Wrote ${coverPath}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

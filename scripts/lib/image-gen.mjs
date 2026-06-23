// 共享生图工具：接 GPT-Image-2 兼容 API（OpenAI images 格式）。
// 凭证只住 ~/.cmm/.env（个人数据，不进 skill 发布包）。
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const skillRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
for (const file of [path.join(os.homedir(), '.cmm', '.env'), path.join(skillRoot, '.env')]) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      // 忽略解析失败
    }
  }
}

const env = (name, fallback) => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
};

// 从各种响应结构里找出图片数据（base64 或 url）
export const findImageData = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.b64_json === 'string') return {type: 'base64', value: payload.b64_json};
  if (typeof payload.image_base64 === 'string') return {type: 'base64', value: payload.image_base64};
  if (typeof payload.image === 'string' && payload.image.length > 200) return {type: 'base64', value: payload.image};
  if (typeof payload.url === 'string') return {type: 'url', value: payload.url};
  if (Array.isArray(payload.data)) {
    for (const item of payload.data) {
      const found = findImageData(item);
      if (found) return found;
    }
  }
  if (Array.isArray(payload.images)) {
    for (const item of payload.images) {
      const found = findImageData(typeof item === 'string' ? {url: item} : item);
      if (found) return found;
    }
  }
  for (const key of ['candidates', 'content', 'parts', 'outputs', 'result']) {
    const value = payload[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findImageData(item);
        if (found) return found;
      }
    } else if (value && typeof value === 'object') {
      const found = findImageData(value);
      if (found) return found;
    }
  }
  if (payload.inlineData?.data) return {type: 'base64', value: payload.inlineData.data};
  if (payload.inline_data?.data) return {type: 'base64', value: payload.inline_data.data};
  return null;
};

const writeBase64 = (base64, destination) => {
  const normalized = base64.includes(',') ? base64.split(',').pop() : base64;
  writeFileSync(destination, Buffer.from(normalized, 'base64'));
};

const downloadToFile = async (url, destination) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`图片下载失败：${response.status} ${response.statusText}`);
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
};

export const hasImageProvider = () => Boolean(env('GPT_IMAGE2_API_KEY') && env('GPT_IMAGE2_BASE_URL'));

// 竖屏 9:16→1024x1536，横屏 16:9→1536x1024，方→1024x1024
export const sizeFor = (aspect) =>
  aspect === '16:9' ? '1536x1024' : aspect === '1:1' ? '1024x1024' : '1024x1536';

export const generateImage = async ({prompt, aspect = '9:16', size, outPath}) => {
  const key = env('GPT_IMAGE2_API_KEY');
  const base = env('GPT_IMAGE2_BASE_URL');
  const model = env('GPT_IMAGE2_MODEL', 'gpt-image-2-all');
  if (!key || !base) {
    throw new Error('未配置 GPT_IMAGE2_API_KEY / GPT_IMAGE2_BASE_URL（应在 ~/.cmm/.env）');
  }
  const endpoint = `${base.replace(/\/$/, '')}/v1/images/generations`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model, prompt, size: size ?? sizeFor(aspect), n: 1}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`生图请求失败 ${response.status}: ${JSON.stringify(payload).slice(0, 240)}`);
  }
  const image = findImageData(payload);
  if (!image) throw new Error('响应中找不到图片数据');
  mkdirSync(path.dirname(outPath), {recursive: true});
  if (image.type === 'base64') writeBase64(image.value, outPath);
  else await downloadToFile(image.value, outPath);
  return outPath;
};

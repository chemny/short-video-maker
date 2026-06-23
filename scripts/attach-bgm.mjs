#!/usr/bin/env node
// 给 video-plan.json 挂背景音乐，按优先级解析音乐源：
//   ① 已指定且文件存在的 audio.bgm（或 --file=...）→ 直接用
//   ② 配置了音乐生成 API（MUSIC_API_URL/KEY，在 ~/.cmm/.env）→ 生成
//   ③ 默认无版权垫乐 remotion/public/bgm/default-ambient.mp3
// 用法：node scripts/attach-bgm.mjs <plan.json> [--file=public/bgm/xxx.mp3] [--volume=0.1]
import './tts/load-env.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const planPath = args[0];
if (!planPath) {
  console.error('Usage: node scripts/attach-bgm.mjs <plan.json> [--file=...] [--volume=0.1]');
  process.exit(2);
}
const fileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1];
const volArg = args.find((a) => a.startsWith('--volume='))?.split('=')[1];

const absPlanPath = path.resolve(planPath);
const planDir = path.dirname(absPlanPath); // remotion/public
const plan = JSON.parse(fs.readFileSync(absPlanPath, 'utf8'));

const env = (n) => (process.env[n] && process.env[n].trim() ? process.env[n].trim() : undefined);
const exists = (rel) => rel && fs.existsSync(path.join(planDir, rel));

const downloadTo = async (url, dest) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`音乐下载失败 ${r.status}`);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
};

// ② 音乐生成 API（可选；OpenAI 风格 JSON，返回 url 或 b64）。未配置则跳过。
const generateViaApi = async () => {
  const apiUrl = env('MUSIC_API_URL');
  const apiKey = env('MUSIC_API_KEY');
  if (!apiUrl) return null;
  const mood = plan.style?.bgmMood ?? plan.meta?.topic ?? 'calm ambient';
  const body = {
    prompt: `Subtle, unobtrusive background music bed for a Chinese knowledge short-video. Mood: ${mood}. Instrumental, loopable, no vocals.`,
    duration: Math.ceil(plan.meta?.durationSeconds ?? 60),
    model: env('MUSIC_API_MODEL'),
  };
  const r = await fetch(apiUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...(apiKey ? {Authorization: `Bearer ${apiKey}`} : {})},
    body: JSON.stringify(body),
  });
  const payload = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`音乐 API 失败 ${r.status}: ${JSON.stringify(payload).slice(0, 200)}`);
  const url = payload.url || payload.audio_url || payload.data?.[0]?.url;
  if (!url) throw new Error('音乐 API 响应里找不到音频地址');
  const rel = 'bgm/generated.mp3';
  await downloadTo(url, path.join(planDir, rel));
  return rel;
};

let chosen;
let source;

// ① 指定文件优先
const explicit = fileArg ?? plan.audio?.bgm;
if (explicit && exists(explicit.replace(/^public\//, ''))) {
  chosen = explicit.replace(/^public\//, '');
  source = '指定文件';
} else {
  // ② 试音乐生成 API
  try {
    const gen = await generateViaApi();
    if (gen) {
      chosen = gen;
      source = '音乐 API 生成';
    }
  } catch (e) {
    console.warn(`音乐 API 跳过：${e.message}`);
  }
  // ③ 默认无版权垫乐
  if (!chosen) {
    const def = 'bgm/default-ambient.mp3';
    if (exists(def)) {
      chosen = def;
      source = '默认无版权垫乐';
    }
  }
}

if (!chosen) {
  console.error('没有可用的 BGM 源（无指定文件、未配置音乐 API、默认垫乐也不存在）');
  process.exit(1);
}

plan.audio = {
  ...(plan.audio ?? {}),
  bgm: chosen,
  bgmVolume: volArg ? Number(volArg) : plan.audio?.bgmVolume ?? 0.35,
};
fs.writeFileSync(absPlanPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
console.log(`✓ 已挂 BGM（来源：${source}）→ ${chosen}，音量 ${plan.audio.bgmVolume}`);

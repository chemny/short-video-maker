#!/usr/bin/env node
// 为 video-plan.json 生成 AI 配图：封面背景 + 场景图（apple-text-video/image-overlay 用）。
// 图片落在 remotion/public/assets/generated/，并把路径写回 plan。
// 用法：
//   node scripts/generate-images.mjs <plan.json> [--cover] [--scenes] [--force]
//   不带 --cover/--scenes 时两者都做。
import fs from 'node:fs';
import path from 'node:path';
import {generateImage, hasImageProvider} from './lib/image-gen.mjs';

const args = process.argv.slice(2);
const planPath = args[0];
if (!planPath) {
  console.error('Usage: node scripts/generate-images.mjs <plan.json> [--cover] [--scenes] [--force] [--dry-run]');
  process.exit(2);
}
const force = args.includes('--force');
const dryRun = args.includes('--dry-run'); // 只打印拼好的 prompt，不调 API、不写文件
const onlyCover = args.includes('--cover') && !args.includes('--scenes');
const onlyScenes = args.includes('--scenes') && !args.includes('--cover');
const doCover = !onlyScenes;
const doScenes = !onlyCover;

if (!dryRun && !hasImageProvider()) {
  console.error('未配置生图 provider（~/.cmm/.env 需要 GPT_IMAGE2_API_KEY / GPT_IMAGE2_BASE_URL）');
  process.exit(1);
}

const absPlanPath = path.resolve(planPath);
const planDir = path.dirname(absPlanPath);
const plan = JSON.parse(fs.readFileSync(absPlanPath, 'utf8'));
// 图片写到 plan 同级的 assets/generated（dark-card 预览时 planDir = remotion/public）
const assetsDir = path.join(planDir, 'assets', 'generated');

// 统一画风层：只描述"长什么样"，不再重复主体/世界观名词（那些交给 imageContext）。
const styleHint =
  'Photorealistic, cinematic, dark editorial mood (#0D1117) with warm amber (#F59E0B) ' +
  'accent lighting, shallow depth of field, premium and relatable. ' +
  'No text, no UI labels, no logos, no watermark.';

// 一次性世界观锚点：让图与全文上下文接地、六张成一套（不含抽象论点）。
const imageContext = (plan.style?.imageContext ?? '').trim();
// 顺序：主体(画什么) → 世界观(在哪/谁) → 画风(长什么样+负面)。主体打头，模型更重视。
const endPunct = (s) => (/[.!?。！？]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const composePrompt = (subject) =>
  [endPunct(String(subject)), imageContext, styleHint].filter(Boolean).join(' ');

const coverPrompt = () => {
  const subject = plan.cover?.prompt
    ? plan.cover.prompt
    : [
        `Vertical 9:16 cover background image for topic「${plan.meta?.topic ?? plan.meta?.title ?? ''}」`,
        plan.cover?.title ? `evoking「${plan.cover.title}」.` : '.',
        'Strong focal point in the upper 60%, keep the lower third darker and emptier for a large Chinese title overlay.',
      ]
        .filter(Boolean)
        .join(' ');
  return composePrompt(subject);
};

const scenePrompt = (scene) => {
  const subject = scene.visual?.prompt
    ? scene.visual.prompt
    : `Conceptual visual for「${scene.visual?.alt || scene.caption || scene.voiceover?.slice(0, 30) || ''}」`;
  return composePrompt(subject);
};

let changed = false;

if (doCover) {
  const out = path.join(assetsDir, 'cover-bg.png');
  if (dryRun) {
    console.log(`\n[封面] prompt:\n${coverPrompt()}\n`);
  } else if (!force && plan.cover?.backgroundAsset && fs.existsSync(path.join(planDir, plan.cover.backgroundAsset))) {
    console.log('封面背景已存在，跳过（--force 可重生）');
  } else {
    process.stdout.write('生成封面背景… ');
    await generateImage({prompt: coverPrompt(), aspect: '9:16', outPath: out});
    plan.cover = {...(plan.cover ?? {}), backgroundAsset: 'assets/generated/cover-bg.png'};
    changed = true;
    console.log('✓');
  }
}

if (doScenes) {
  // 仅给"需要配图的模板"生成：apple-text-video(16:9 框) / image-overlay(9:16 全屏)
  const template = plan.style?.template;
  const aspect = template === 'apple-text-video' ? '16:9' : '9:16';
  const needImages = template === 'apple-text-video' || template === 'image-overlay';
  if (!needImages) {
    console.log(`模板 ${template} 不使用场景图，跳过场景生图（封面已处理）`);
  } else {
    for (const [i, scene] of plan.scenes.entries()) {
      const rel = `assets/generated/scene-${String(i + 1).padStart(2, '0')}.png`;
      const out = path.join(planDir, rel);
      if (dryRun) {
        console.log(`\n[场景${i + 1}] prompt:\n${scenePrompt(scene)}\n`);
        continue;
      }
      if (!force && scene.visual?.asset && fs.existsSync(path.join(planDir, scene.visual.asset))) {
        console.log(`场景${i + 1} 已有图，跳过`);
        continue;
      }
      process.stdout.write(`生成场景${i + 1}图… `);
      await generateImage({prompt: scenePrompt(scene), aspect, outPath: out});
      scene.visual = {...(scene.visual ?? {}), asset: rel};
      changed = true;
      console.log('✓');
    }
  }
}

if (changed) {
  fs.writeFileSync(absPlanPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  console.log(`已更新 ${absPlanPath}`);
} else {
  console.log('无改动');
}

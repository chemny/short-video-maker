#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from './tts/args.mjs';
import {writeTimeline} from './tts/timeline.mjs';
import * as edgeProvider from './tts/providers/edge.mjs';
import * as httpProvider from './tts/providers/http.mjs';
import * as localProvider from './tts/providers/local.mjs';
import * as volcengineProvider from './tts/providers/volcengine.mjs';

const providers = {
  edge: edgeProvider,
  http: httpProvider,
  local: localProvider,
  volcengine: volcengineProvider,
};

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
const providerName = args.provider ?? process.env.TTS_PROVIDER ?? 'edge';
const provider = providers[providerName];
const skillRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const usage = () => {
  console.error(`Usage:
  node scripts/tts.mjs generate <path-to-video-plan.json> --provider=edge|local|volcengine|http
  node scripts/tts.mjs preview --provider=edge|local|volcengine|http [--text="..."]
  node scripts/tts.mjs voices --provider=edge|local|volcengine|http

Common options:
  --voice=<voice-id>
  --voice-preset=<preset-id>
  --speed=<number>
  --loudness=<number>
  --model=<model-id>
  --output=<path>`);
};

if (!command || !provider) {
  usage();
  if (!provider) {
    console.error(`Unknown TTS provider: ${providerName}`);
  }
  process.exit(2);
}

const options = {
  voice: args.voice,
  voicePreset: args['voice-preset'],
  speed: args.speed,
  loudness: args.loudness,
  model: args.model,
  rate: args.rate,
  cluster: args.cluster,
};

const defaultPreviewText =
  '你好，这是一段 Codex 教程的试听。我们会先讲清楚目标和边界，再让 AI 帮你一步一步完成任务。';

if (command === 'voices') {
  const voices = await provider.listVoices({skillRoot, options});
  for (const voice of voices) {
    console.log(
      [
        voice.preset ? `preset=${voice.preset}` : null,
        voice.id ? `id=${voice.id}` : null,
        voice.name ? `name=${voice.name}` : null,
        voice.configured === false ? 'not-configured' : null,
        voice.note ? `note=${voice.note}` : null,
      ]
        .filter(Boolean)
        .join('\t'),
    );
  }
} else if (command === 'preview') {
  const text = args.text ?? defaultPreviewText;
  const outputDir = path.join(skillRoot, 'remotion', 'public', 'audio', 'voice-samples');
  fs.mkdirSync(outputDir, {recursive: true});
  const safeProvider = providerName.replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeVoice = String(options.voice ?? options.voicePreset ?? process.env.TTS_API_VOICE ?? 'default').replace(
    /[^a-zA-Z0-9_-]/g,
    '-',
  );
  const outputPath = path.resolve(args.output ?? path.join(outputDir, `${safeProvider}-${safeVoice}.mp3`));
  const meta = await provider.preview({text, outputPath, options, skillRoot});
  console.log(`Provider: ${providerName}`);
  console.log(`Wrote ${outputPath}`);
  console.log(JSON.stringify(meta, null, 2));
} else if (command === 'generate') {
  const planPathArg = args._[1];
  if (!planPathArg) {
    usage();
    process.exit(2);
  }

  const planPath = path.resolve(planPathArg);
  const planDir = path.dirname(planPath);
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    throw new Error('video-plan.json must contain at least one scene');
  }

  const audioDir = path.join(planDir, 'audio');
  fs.mkdirSync(audioDir, {recursive: true});
  const outputMp3 = path.join(audioDir, 'voiceover.mp3');
  const result = await provider.generate({
    plan,
    planDir,
    planPath,
    outputMp3,
    options,
    skillRoot,
  });
  const timeline = writeTimeline({
    planPath,
    plan,
    outputMp3,
    sceneDurations: result.sceneDurations,
    providerMeta: result.providerMeta,
  });

  console.log(`Provider: ${providerName}`);
  console.log(`Generated ${outputMp3}`);
  console.log(`Audio duration: ${timeline.durationSeconds.toFixed(2)}s`);
  console.log(`Updated ${planPath}`);
  console.log(`Wrote ${timeline.captionsJsonPath}`);
  console.log(`Wrote ${timeline.captionsSrtPath}`);
} else {
  usage();
  process.exit(2);
}

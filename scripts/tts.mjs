#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import './tts/load-env.mjs';
import {parseArgs} from './tts/args.mjs';
import {writeTimeline} from './tts/timeline.mjs';
import * as edgeProvider from './tts/providers/edge.mjs';
import * as httpProvider from './tts/providers/http.mjs';
import * as localProvider from './tts/providers/local.mjs';
import * as volcengineProvider from './tts/providers/volcengine.mjs';
import * as voxcpm2Provider from './tts/providers/voxcpm2.mjs';
import {skillRootFrom} from './lib/paths.mjs';
import {timed} from './lib/timing.mjs';
import {selectProvider} from './tts/select-provider.mjs';
import {generateSelected} from './tts/generate-selected.mjs';
import {repairAcousticTiming} from './lib/acoustic-timing.mjs';

const providers = {
  edge: edgeProvider,
  http: httpProvider,
  local: localProvider,
  volcengine: volcengineProvider,
  voxcpm2: voxcpm2Provider,
};

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
const selectedPlan = command === 'generate' && args._[1] ? JSON.parse(fs.readFileSync(path.resolve(args._[1]))) : undefined;
const selection = selectProvider({explicit: args.provider, plan: selectedPlan});
const providerName = selection.provider;
const provider = providers[providerName];
const skillRoot = skillRootFrom(import.meta.url, '..');

const usage = () => {
  console.error(`Usage:
  node scripts/tts.mjs generate <path-to-video-plan.json> --provider=auto|voxcpm2|edge|local|volcengine|http
  node scripts/tts.mjs preview --provider=auto|voxcpm2|edge|local|volcengine|http [--text="..."]
  node scripts/tts.mjs voices --provider=auto|voxcpm2|edge|local|volcengine|http

Common options:
  --voice=<voice-id>
  --voice-preset=<preset-id>
  --speed=<number>
  --loudness=<number>
  --model=<model-id>
  --concurrency=<number>
  --skip-if-exists
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
  concurrency: args.concurrency,
  seed: args.seed,
  steps: args.steps,
  asrModel: args['asr-model'],
  transcript: args['asr-transcript'],
  forceAsr: Boolean(args['force-asr']),
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

  if (['voxcpm2', 'edge', 'volcengine', 'local'].includes(providerName)) {
    let holdsChanged = false;
    for (const scene of plan.scenes) if (scene.preservePauses === true && scene.minimumDurationSeconds === undefined) {
      scene.minimumDurationSeconds = scene.end - scene.start; holdsChanged = true;
    }
    if (holdsChanged) fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    const result = await generateSelected({planPath, selection, providers, options, skillRoot});
    const acoustic = await repairAcousticTiming(planPath, {phraseOptions: options});
    const repaired = JSON.parse(fs.readFileSync(planPath));
    console.log(JSON.stringify({...result,durationSeconds:repaired.meta.durationSeconds,voiceover:repaired.audio.voiceover,
      acousticTiming:{state:acoustic.state,changes:acoustic.changes}}));
    process.exit(0);
  }

  if (plan.audio?.sourceMode === 'imported') {
    throw new Error('Imported narration must not be replaced by TTS. Start a separate TTS job to change the voice.');
  }

  if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    throw new Error('video-plan.json must contain at least one scene');
  }

  const audioDir = path.join(planDir, 'audio');
  fs.mkdirSync(audioDir, {recursive: true});
  const outputMp3 = path.join(audioDir, 'voiceover.mp3');
  const skipIfExists = Boolean(args['skip-if-exists']);
  const reusableSceneDurations =
    Array.isArray(plan.scenes) &&
    plan.scenes.every((scene) => Number.isFinite(scene.start) && Number.isFinite(scene.end) && scene.end > scene.start)
      ? plan.scenes.map((scene) => scene.end - scene.start)
      : null;
  const result =
    skipIfExists && fs.existsSync(outputMp3) && fs.statSync(outputMp3).size > 0
      ? {
          sceneDurations: reusableSceneDurations,
          providerMeta: {
            ...(plan.audio ?? {}),
            provider: plan.audio?.provider ?? providerName,
            reusedExistingAudio: true,
          },
        }
      : await timed(`${providerName} tts generate`, () =>
          provider.generate({
            plan,
            planDir,
            planPath,
            outputMp3,
            options,
            skillRoot,
          }),
        );

  if (skipIfExists && result.providerMeta.reusedExistingAudio) {
    console.log(`Reused existing ${outputMp3}`);
  }
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

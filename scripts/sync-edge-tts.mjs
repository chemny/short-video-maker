#!/usr/bin/env node
import {envMilliseconds, runCommand} from './lib/process.mjs';

const planPath = process.argv[2];
const voiceArg = process.argv.find((arg) => arg.startsWith('--voice='));
const rateArg = process.argv.find((arg) => arg.startsWith('--rate='));
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const skipIfExists = process.argv.includes('--skip-if-exists');

if (!planPath) {
  console.error('Usage: node scripts/sync-edge-tts.mjs <path-to-video-plan.json> [--voice=zh-CN-XiaoxiaoNeural] [--rate=default]');
  process.exit(2);
}

runCommand(
  'node',
  [
    new URL('./tts.mjs', import.meta.url).pathname,
    'generate',
    planPath,
    '--provider=edge',
    ...(voiceArg ? [voiceArg] : []),
    ...(rateArg ? [rateArg] : []),
    ...(concurrencyArg ? [concurrencyArg] : []),
    ...(skipIfExists ? ['--skip-if-exists'] : []),
  ],
  {label: 'edge tts sync', timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000)},
);

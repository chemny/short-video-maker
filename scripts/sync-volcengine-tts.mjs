#!/usr/bin/env node
import {envMilliseconds, runCommand} from './lib/process.mjs';

const planPath = process.argv[2];
const presetArg = process.argv.find((arg) => arg.startsWith('--preset='));
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const skipIfExists = process.argv.includes('--skip-if-exists');

if (!planPath) {
  console.error('Usage: node scripts/sync-volcengine-tts.mjs <path-to-video-plan.json> [--preset=deep-male]');
  process.exit(2);
}

runCommand(
  'node',
  [
    new URL('./tts.mjs', import.meta.url).pathname,
    'generate',
    planPath,
    '--provider=volcengine',
    ...(presetArg ? [presetArg.replace('--preset=', '--voice-preset=')] : []),
    ...(concurrencyArg ? [concurrencyArg] : []),
    ...(skipIfExists ? ['--skip-if-exists'] : []),
  ],
  {label: 'volcengine tts sync', timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000)},
);

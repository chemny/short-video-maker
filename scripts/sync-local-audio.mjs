#!/usr/bin/env node
import {envMilliseconds, runCommand} from './lib/process.mjs';

const planPath = process.argv[2];
const voice = process.argv[3];
const rate = process.argv[4];
const skipIfExists = process.argv.includes('--skip-if-exists');

if (!planPath) {
  console.error('Usage: node scripts/sync-local-audio.mjs <path-to-video-plan.json> [voice] [rate]');
  process.exit(2);
}

runCommand(
  'node',
  [
    new URL('./tts.mjs', import.meta.url).pathname,
    'generate',
    planPath,
    '--provider=local',
    ...(voice ? [`--voice=${voice}`] : []),
    ...(rate ? [`--rate=${rate}`] : []),
    ...(skipIfExists ? ['--skip-if-exists'] : []),
  ],
  {label: 'local tts sync', timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000)},
);

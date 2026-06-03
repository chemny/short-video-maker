#!/usr/bin/env node
import {execFileSync} from 'node:child_process';

const planPath = process.argv[2];
const voice = process.argv[3];
const rate = process.argv[4];

if (!planPath) {
  console.error('Usage: node scripts/sync-local-audio.mjs <path-to-video-plan.json> [voice] [rate]');
  process.exit(2);
}

execFileSync(
  'node',
  [
    new URL('./tts.mjs', import.meta.url).pathname,
    'generate',
    planPath,
    '--provider=local',
    ...(voice ? [`--voice=${voice}`] : []),
    ...(rate ? [`--rate=${rate}`] : []),
  ],
  {stdio: 'inherit'},
);

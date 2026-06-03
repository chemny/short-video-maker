#!/usr/bin/env node
import {execFileSync} from 'node:child_process';

const planPath = process.argv[2];
const voiceArg = process.argv.find((arg) => arg.startsWith('--voice='));
const rateArg = process.argv.find((arg) => arg.startsWith('--rate='));

if (!planPath) {
  console.error('Usage: node scripts/sync-edge-tts.mjs <path-to-video-plan.json> [--voice=zh-CN-XiaoxiaoNeural] [--rate=default]');
  process.exit(2);
}

execFileSync(
  'node',
  [
    new URL('./tts.mjs', import.meta.url).pathname,
    'generate',
    planPath,
    '--provider=edge',
    ...(voiceArg ? [voiceArg] : []),
    ...(rateArg ? [rateArg] : []),
  ],
  {stdio: 'inherit'},
);

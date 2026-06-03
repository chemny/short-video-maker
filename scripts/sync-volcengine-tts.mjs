#!/usr/bin/env node
import {execFileSync} from 'node:child_process';

const planPath = process.argv[2];
const presetArg = process.argv.find((arg) => arg.startsWith('--preset='));

if (!planPath) {
  console.error('Usage: node scripts/sync-volcengine-tts.mjs <path-to-video-plan.json> [--preset=deep-male]');
  process.exit(2);
}

execFileSync(
  'node',
  [
    new URL('./tts.mjs', import.meta.url).pathname,
    'generate',
    planPath,
    '--provider=volcengine',
    ...(presetArg ? [presetArg.replace('--preset=', '--voice-preset=')] : []),
  ],
  {stdio: 'inherit'},
);

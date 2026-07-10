#!/usr/bin/env node
import {envMilliseconds, runCommand} from './lib/process.mjs';

const args = process.argv.slice(2);
const list = args.includes('--list');
const preset = args.find((arg) => arg.startsWith('--preset='))?.replace('--preset=', '--voice-preset=');
const voice = args.find((arg) => arg.startsWith('--voice-type='))?.replace('--voice-type=', '--voice=');
const text = args.find((arg) => arg.startsWith('--text='));
const speed = args.find((arg) => arg.startsWith('--speed='));
const loudness = args.find((arg) => arg.startsWith('--loudness='));
const model = args.find((arg) => arg.startsWith('--model='));

runCommand(
  'node',
  [
    new URL('./tts.mjs', import.meta.url).pathname,
    list ? 'voices' : 'preview',
    '--provider=volcengine',
    ...(preset ? [preset] : []),
    ...(voice ? [voice] : []),
    ...(text ? [text] : []),
    ...(speed ? [speed] : []),
    ...(loudness ? [loudness] : []),
    ...(model ? [model] : []),
  ],
  {label: 'volcengine voice preview', timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000)},
);

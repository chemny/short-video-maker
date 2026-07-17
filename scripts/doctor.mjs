#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {resolveRemotionBin} from './lib/bins.mjs';
import {readCommand, runCommand} from './lib/process.mjs';
import {skillRootFrom} from './lib/paths.mjs';
import {hasCommand} from './tts/media.mjs';

const skillRoot = skillRootFrom(import.meta.url, '..');
const remotionDir = path.join(skillRoot, 'remotion');

const checks = [];

const record = (name, ok, detail = '') => {
  checks.push({name, ok, detail});
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const checkCommandVersion = (name, args = ['--version']) => {
  try {
    const output = readCommand(name, args, {label: `${name} version`}).trim().split('\n')[0];
    record(name, true, output);
  } catch (error) {
    record(name, false, error.message);
  }
};

record('platform', true, `${process.platform} ${process.arch}`);
record('node', true, process.version);
checkCommandVersion('npm', ['--version']);
const hasFfmpeg = hasCommand('ffmpeg');
const hasFfprobe = hasCommand('ffprobe');
const hasRootDependencies = fs.existsSync(path.join(skillRoot, 'node_modules'));
const hasRemotionDependencies = fs.existsSync(path.join(remotionDir, 'node_modules'));
record('ffmpeg', hasFfmpeg, hasFfmpeg ? 'available' : 'required for audio/video processing');
record('ffprobe', hasFfprobe, hasFfprobe ? 'available' : 'required for media duration checks');
record(
  'root dependencies',
  hasRootDependencies,
  hasRootDependencies ? 'installed' : 'run npm install at skill root',
);
record(
  'remotion dependencies',
  hasRemotionDependencies,
  hasRemotionDependencies ? 'installed' : 'run npm install inside remotion/',
);

const remotionBin = resolveRemotionBin(remotionDir);
record('remotion cli', fs.existsSync(remotionBin), remotionBin);

const ttsProviders = [];
ttsProviders.push('edge');
if (process.env.VOLCENGINE_TTS_APPID && process.env.VOLCENGINE_TTS_ACCESS_TOKEN) {
  ttsProviders.push('volcengine');
}
if (process.env.TTS_API_URL || process.env.HTTP_TTS_ENDPOINT) {
  ttsProviders.push('http');
}
if (process.platform === 'darwin') {
  ttsProviders.push('local');
}
record('recommended tts', true, process.platform === 'win32' ? 'edge or volcengine' : 'edge');
record('available tts providers', true, ttsProviders.join(', '));

try {
  runCommand(process.execPath, [path.join(skillRoot, 'scripts/validate-plan.mjs'), path.join(skillRoot, 'templates/editorial-brief/example-plan.json')], {
    cwd: skillRoot,
    label: 'validate example plan',
  });
  record('example plan validation', true);
} catch (error) {
  record('example plan validation', false, error.message);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`Doctor found ${failed.length} blocking issue(s).`);
  process.exit(1);
}

console.log('Doctor passed.');

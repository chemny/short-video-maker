#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {resolveRuntime} from './tts/providers/voxcpm2.mjs';
import {inspectLocalAsr} from './lib/local-asr.mjs';
import {resolveRemotionBin} from './lib/bins.mjs';
import {readCommand, runCommand} from './lib/process.mjs';
import {skillRootFrom} from './lib/paths.mjs';
import {hasCommand} from './tts/media.mjs';
import './tts/load-env.mjs';
import {selectProvider, localCapability} from './tts/select-provider.mjs';
import {selectRenderEngine} from './lib/render-engine.mjs';

const skillRoot = skillRootFrom(import.meta.url, '..');
const remotionDir = path.join(skillRoot, 'remotion');

const checks = [];
const renderEngine=selectRenderEngine({explicit:process.argv.find(a=>a.startsWith('--engine='))?.slice(9)});

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

const hfBin=process.env.SHORT_VIDEO_HYPERFRAMES_BIN??path.join(skillRoot,'hyperframes/node_modules/.bin',process.platform==='win32'?'hyperframes.cmd':'hyperframes');
record('Hyperframes CLI', renderEngine!=='hyperframes'||fs.existsSync(hfBin), fs.existsSync(hfBin)?hfBin:'not installed; npm ci --prefix hyperframes only when selecting Hyperframes');
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
  renderEngine !== 'remotion' || hasRemotionDependencies,
  hasRemotionDependencies ? 'installed' : 'run npm install inside remotion/',
);

const remotionBin = resolveRemotionBin(remotionDir);
record('remotion cli', renderEngine !== 'remotion' || fs.existsSync(remotionBin), remotionBin);
record('default render engine', true, renderEngine);

const ttsProviders = [];
const capability = localCapability();
const selection = selectProvider({capability: () => capability});
try {
  const runtime = resolveRuntime();
  record('default VoxCPM2 runtime', true, `${runtime.folder} (${runtime.model}@${runtime.revision})`);
  ttsProviders.push('voxcpm2');
} catch {record('optional VoxCPM2 runtime', true, 'not installed; automatic default is Edge');}
const asr = capability.asr ?? inspectLocalAsr();
const configuredAsr = Boolean(process.env.SHORT_VIDEO_MLX_WHISPER_MODEL || process.env.SHORT_VIDEO_WHISPER_MODEL);
if (selection.provider === 'voxcpm2' || configuredAsr || asr.ready) {
  record('selected local ASR', asr.ready, asr.ready
    ? `${asr.runtime.backend}; model=${asr.runtime.model}; python=${asr.runtime.python}; dependencies checked, inference not performed`
    : asr.reason);
} else console.log(`WARN optional local ASR unavailable - ${asr.reason}`);
if (selection.provider !== 'voxcpm2') record('cloud timing/export runtime', true, 'Node.js + FFmpeg; no Python/Whisper/VoxCPM2 requirement when provider returns word timestamps');
ttsProviders.push('edge');
if (process.env.VOLCENGINE_TTS_APPID && process.env.VOLCENGINE_TTS_ACCESS_TOKEN) {
  ttsProviders.push('volcengine');
}
if (process.env.TTS_API_URL || process.env.HTTP_TTS_ENDPOINT) {
  ttsProviders.push('http');
}
if (process.platform === 'darwin' && hasCommand('say')) {
  ttsProviders.push('local');
}
record('macOS final fallback', true, process.platform === 'darwin' && hasCommand('say') ? 'say available; system default voice; measured phrase timing; no Python' : 'unavailable on this host');
record('default tts', true, `${selection.provider} (${selection.source})`);
if (selection.provider === 'voxcpm2') record('complete local capability', capability.ready, capability.reason);
if (selection.provider === 'volcengine') record('Volcengine credentials', Boolean(process.env.VOLCENGINE_TTS_APPID && process.env.VOLCENGINE_TTS_ACCESS_TOKEN), 'requires configured app ID/access token');
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

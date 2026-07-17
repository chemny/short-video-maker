import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {commandFromEnv} from '../../lib/bins.mjs';
import {envMilliseconds, readCommand, runCommand} from '../../lib/process.mjs';
import {requireCommands} from '../media.mjs';

export const name = 'local';

const assertMacOs = () => {
  if (process.platform !== 'darwin') {
    throw new Error('The local TTS provider uses the macOS say command and is only supported on macOS. Use --provider=edge, --provider=volcengine, or --provider=http on Windows.');
  }
};

export const listVoices = () => {
  assertMacOs();
  requireCommands(['say']);
  const output = readCommand('say', ['-v', '?'], {
    label: 'list macOS voices',
    timeoutMs: envMilliseconds('SHORT_VIDEO_SAY_TIMEOUT_MS', 30000),
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [voice, locale, ...sample] = line.split(/\s+/);
      return {
        id: voice,
        name: voice,
        locale,
        sample: sample.join(' '),
      };
    });
};

export const preview = async ({text, outputPath, options}) => {
  assertMacOs();
  requireCommands(['say', 'ffmpeg']);
  const voice = options.voice ?? process.env.MACOS_TTS_VOICE ?? 'Tingting';
  const rate = options.rate ?? process.env.MACOS_TTS_RATE ?? '185';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'short-video-maker-tts-preview-'));
  const textPath = path.join(tmpDir, 'sample.txt');
  const aiffPath = path.join(tmpDir, 'sample.aiff');

  fs.writeFileSync(textPath, text, 'utf8');
  runCommand('say', ['-v', voice, '-r', String(rate), '-f', textPath, '-o', aiffPath], {
    stdio: 'inherit',
    label: 'macOS TTS preview',
    timeoutMs: envMilliseconds('SHORT_VIDEO_SAY_TIMEOUT_MS', 180000),
  });
  runCommand(commandFromEnv('ffmpeg'), ['-y', '-i', aiffPath, '-codec:a', 'libmp3lame', '-q:a', '3', outputPath], {
    stdio: 'ignore',
    label: 'convert preview audio',
    timeoutMs: envMilliseconds('SHORT_VIDEO_FFMPEG_TIMEOUT_MS', 180000),
  });
  fs.rmSync(tmpDir, {recursive: true, force: true});

  return {
    provider: 'local',
    voice,
    rate: Number(rate),
  };
};

export const generate = async ({plan, planDir, outputMp3, options}) => {
  assertMacOs();
  requireCommands(['say', 'ffmpeg', 'ffprobe']);
  const voice = options.voice ?? process.env.MACOS_TTS_VOICE ?? 'Tingting';
  const rate = options.rate ?? process.env.MACOS_TTS_RATE ?? '185';
  const text = plan.scenes.map((scene) => scene.voiceover).join('\n\n');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'short-video-maker-tts-'));
  const textPath = path.join(tmpDir, 'voiceover.txt');
  const aiffPath = path.join(tmpDir, 'voiceover.aiff');

  fs.writeFileSync(textPath, text, 'utf8');
  runCommand('say', ['-v', voice, '-r', String(rate), '-f', textPath, '-o', aiffPath], {
    stdio: 'inherit',
    label: 'macOS TTS',
    timeoutMs: envMilliseconds('SHORT_VIDEO_SAY_TIMEOUT_MS', 600000),
  });
  runCommand(commandFromEnv('ffmpeg'), ['-y', '-i', aiffPath, '-codec:a', 'libmp3lame', '-q:a', '3', outputMp3], {
    stdio: 'ignore',
    label: 'convert TTS audio',
    timeoutMs: envMilliseconds('SHORT_VIDEO_FFMPEG_TIMEOUT_MS', 180000),
  });
  fs.rmSync(tmpDir, {recursive: true, force: true});

  return {
    sceneDurations: null,
    providerMeta: {
      provider: 'local',
      voice,
      rate: Number(rate),
    },
  };
};

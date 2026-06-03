import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {requireCommands} from '../media.mjs';

export const name = 'local';

export const listVoices = () => {
  requireCommands(['say']);
  const output = execFileSync('say', ['-v', '?']).toString();
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
  requireCommands(['say', 'ffmpeg']);
  const voice = options.voice ?? process.env.MACOS_TTS_VOICE ?? 'Tingting';
  const rate = options.rate ?? process.env.MACOS_TTS_RATE ?? '185';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remotion-short-video-tts-preview-'));
  const textPath = path.join(tmpDir, 'sample.txt');
  const aiffPath = path.join(tmpDir, 'sample.aiff');

  fs.writeFileSync(textPath, text, 'utf8');
  execFileSync('say', ['-v', voice, '-r', String(rate), '-f', textPath, '-o', aiffPath], {
    stdio: 'inherit',
  });
  execFileSync('ffmpeg', ['-y', '-i', aiffPath, '-codec:a', 'libmp3lame', '-q:a', '3', outputPath], {
    stdio: 'ignore',
  });
  fs.rmSync(tmpDir, {recursive: true, force: true});

  return {
    provider: 'local',
    voice,
    rate: Number(rate),
  };
};

export const generate = async ({plan, planDir, outputMp3, options}) => {
  requireCommands(['say', 'ffmpeg', 'ffprobe']);
  const voice = options.voice ?? process.env.MACOS_TTS_VOICE ?? 'Tingting';
  const rate = options.rate ?? process.env.MACOS_TTS_RATE ?? '185';
  const text = plan.scenes.map((scene) => scene.voiceover).join('\n\n');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remotion-short-video-tts-'));
  const textPath = path.join(tmpDir, 'voiceover.txt');
  const aiffPath = path.join(tmpDir, 'voiceover.aiff');

  fs.writeFileSync(textPath, text, 'utf8');
  execFileSync('say', ['-v', voice, '-r', String(rate), '-f', textPath, '-o', aiffPath], {
    stdio: 'inherit',
  });
  execFileSync('ffmpeg', ['-y', '-i', aiffPath, '-codec:a', 'libmp3lame', '-q:a', '3', outputMp3], {
    stdio: 'ignore',
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

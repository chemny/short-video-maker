import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {commandFromEnv} from '../../lib/bins.mjs';
import {envMilliseconds, readCommand, runCommand} from '../../lib/process.mjs';
import {requireCommands, detectDuration} from '../media.mjs';
import {prepareNarration} from '../aligned.mjs';

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
      const match = line.match(/^(.*?)\s+([a-z]{2,3}_(?:[A-Z]{2}|[0-9]{3}))\s+#\s*(.*)$/);
      if (!match) throw new Error('Unrecognized macOS voice list entry');
      return {id: match[1].trim(), name: match[1].trim(), locale: match[2], sample: match[3]};
    });
};

export const preview = async ({text, outputPath, options}) => {
  assertMacOs();
  requireCommands(['say', 'ffmpeg']);
  const voice = options.voice || process.env.MACOS_TTS_VOICE || undefined;
  const rate = options.rate || process.env.MACOS_TTS_RATE;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'short-video-maker-tts-preview-'));
  const textPath = path.join(tmpDir, 'sample.txt');
  const aiffPath = path.join(tmpDir, 'sample.aiff');

  fs.writeFileSync(textPath, text, 'utf8');
  runCommand('say', [...(voice ? ['-v', voice] : []), ...(rate ? ['-r', String(rate)] : []), '-f', textPath, '-o', aiffPath], {
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
    voice: voice ?? 'system-default',
    rate: rate ? Number(rate) : 'system-default',
  };
};

export const generate = async ({plan, planDir, outputMp3, options}) => {
  assertMacOs();
  requireCommands(['say', 'ffmpeg', 'ffprobe']);
  const voice = options.voice || process.env.MACOS_TTS_VOICE || undefined;
  const rate = options.rate || process.env.MACOS_TTS_RATE;
  const text = plan.scenes.map((scene) => scene.voiceover).join('\n\n');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'short-video-maker-tts-'));
  const textPath = path.join(tmpDir, 'voiceover.txt');
  const aiffPath = path.join(tmpDir, 'voiceover.aiff');

  fs.writeFileSync(textPath, text, 'utf8');
  runCommand('say', [...(voice ? ['-v', voice] : []), ...(rate ? ['-r', String(rate)] : []), '-f', textPath, '-o', aiffPath], {
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
      voice: voice ?? 'system-default',
      rate: rate ? Number(rate) : 'system-default',
    },
  };
};

export const generateSegments = async ({plan, outputMp3, options = {}}) => {
  assertMacOs();
  requireCommands(['say', 'ffmpeg', 'ffprobe']);
  const {captions} = prepareNarration(plan);
  let voice = options.voice || process.env.MACOS_TTS_VOICE;
  let voiceSelection = voice ? 'configured' : 'system-default';
  const chinese = /^zh/i.test(plan.meta?.language ?? '') || (!/^(ja|ko)/i.test(plan.meta?.language ?? '') && /\p{Script=Han}/u.test(captions.map(c => c.text).join('')));
  if (!voice && chinese) {
    const voices = listVoices();
    const preferred = /^zh[-_]?(TW|HK)/i.test(plan.meta?.language ?? '') ? plan.meta.language.replace('-', '_') : 'zh_CN';
    const candidates = voices.filter(v => v.locale.toLowerCase() === preferred.toLowerCase());
    const chosen = candidates.find(v => /^(Tingting|Meijia|Sinji)( |$)/.test(v.id)) ?? candidates[0];
    if (!chosen) throw new Error('No installed system voice for Chinese narration; choose an installed MACOS_TTS_VOICE. No voice was downloaded.');
    voice = chosen.id; voiceSelection = 'installed-language-default';
  }
  const rate = options.rate || process.env.MACOS_TTS_RATE;
  if (rate !== undefined && (!Number.isFinite(Number(rate)) || Number(rate) <= 0)) throw new Error('macOS rate must be a positive words-per-minute number');
  const work = fs.mkdtempSync(path.join(path.dirname(outputMp3), 'say-'));
  try {
    const segments = captions.map((caption, i) => {
      const text = path.join(work, `${i}.txt`), aiff = path.join(work, `${i}.aiff`), wav = path.join(work, `${i}.wav`);
      fs.writeFileSync(text, caption.text);
      runCommand('say', [...(voice ? ['-v', voice] : []), ...(rate ? ['-r', String(rate)] : []), '-f', text, '-o', aiff], {
        stdio: 'pipe', label: 'macOS system speech', timeoutMs: envMilliseconds('SHORT_VIDEO_SAY_TIMEOUT_MS', 180000)});
      runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-y', '-i', aiff, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', wav], {stdio: 'pipe'});
      const duration = detectDuration(wav);
      if (!(duration >= 0.25)) throw new Error('macOS system speech returned empty or implausibly short audio; check installed voice/language');
      const pcm = runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-i', wav, '-ar', '8000', '-ac', '1', '-f', 's16le', '-'], {stdio: 'pipe'});
      let energy = 0;
      for (let k = 0; k + 1 < pcm.length; k += 2) energy += (pcm.readInt16LE(k) / 32768) ** 2;
      if (Math.sqrt(energy / Math.max(1, pcm.length / 2)) < 1e-5) throw new Error('macOS system speech returned silent audio; check installed voice/language');
      return {segmentPath: wav, words: [{word: caption.text, start: 0, end: duration, probability: 1}], reused: false};
    });
    return {segments, cleanup: () => fs.rmSync(work, {recursive: true, force: true}), timingOrigin: 'system-synthesis-phrase-segments',
      providerMeta: {provider: 'local', voice: voice ?? 'system-default', voiceSelection, rate: rate ? Number(rate) : 'system-default', timingGranularity: 'caption-phrase'}};
  } catch (error) {fs.rmSync(work, {recursive: true, force: true}); throw error;}
};

import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {commandFromEnv} from './bins.mjs';
import {runCommand} from './process.mjs';
import {probeMedia} from './media-assets.mjs';

export const resolveJobAsset = (jobDir, relative) => {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('Audio paths must be local and relative to the job directory');
  const file = path.resolve(jobDir, relative);
  const realRoot = fs.realpathSync(jobDir);
  const realFile = fs.realpathSync(file);
  if (!realFile.startsWith(`${realRoot}${path.sep}`)) throw new Error(`Audio asset escapes job directory: ${relative}`);
  return file;
};

const gain = (value, fallback, name) => {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result < 0 || result > 4) throw new Error(`${name} must be a finite number from 0 to 4`);
  return result;
};

export const voiceCleanupFilter = cleanup => cleanup === 'light'
  ? 'highpass=f=85,lowpass=f=12000,afftdn=nr=10:nf=-28,acompressor=threshold=-24dB:ratio=2:attack=8:release=160:makeup=1,' : '';
export const voiceFinalFilter = normalize => `${normalize ? 'loudnorm=I=-16:TP=-1.5:LRA=8,' : ''}alimiter=limit=0.94:level=false:latency=true`;

export const prepareAudio = (planPath) => {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  if (!plan.audio?.voiceover) throw new Error('Configure audio.voiceover before audio preparation');
  const jobDir = path.dirname(planPath);
  const audio = plan.audio;
  const voicePath = resolveJobAsset(jobDir, audio.sourceVoiceover ?? audio.voiceover);
  const voiceInfo = probeMedia(voicePath);
  if (!voiceInfo.streams.some((stream) => stream.codec_type === 'audio')) throw new Error('Narration has no audio stream');
  const duration = Number(voiceInfo.format.duration);
  if (!Number.isFinite(duration) || duration <= 0 || Math.abs(duration - plan.meta.durationSeconds) > 0.15) {
    throw new Error('Audio duration does not match the plan. Supply correct timing before preparation.');
  }
  const bgmPath = audio.bgm ? resolveJobAsset(jobDir, audio.sourceBgm ?? audio.bgm) : null;
  if (bgmPath && !probeMedia(bgmPath).streams.some((stream) => stream.codec_type === 'audio')) throw new Error('BGM has no audio stream');
  const cleanup = audio.processing?.cleanup ?? 'none';
  if (!['none', 'light'].includes(cleanup)) throw new Error('audio.processing.cleanup must be none or light');
  if (audio.processing?.normalize !== undefined && typeof audio.processing.normalize !== 'boolean') throw new Error('audio.processing.normalize must be boolean');
  if (audio.duckBgm !== undefined && typeof audio.duckBgm !== 'boolean') throw new Error('audio.duckBgm must be boolean');
  const settings = {
    duration, cleanup, normalize: audio.processing?.normalize ?? false,
    voiceVolume: gain(audio.voiceVolume, 1, 'voiceVolume'),
    bgmVolume: gain(audio.bgmVolume, 0.12, 'bgmVolume'),
    duckBgm: audio.duckBgm ?? true,
  };
  const fingerprint = createHash('sha256').update('short-video-audio-v2-pcm').update(fs.readFileSync(voicePath));
  if (bgmPath) fingerprint.update(fs.readFileSync(bgmPath));
  fingerprint.update(JSON.stringify(settings));
  const relative = `audio/prepared/mix-${fingerprint.digest('hex').slice(0, 20)}.wav`;
  const output = path.join(jobDir, relative);
  fs.mkdirSync(path.dirname(output), {recursive: true});
  if (!fs.existsSync(output)) {
    const cleanupFilter = voiceCleanupFilter(cleanup);
    const filters = [`[0:a]atrim=duration=${duration},asetpts=PTS-STARTPTS,${cleanupFilter}volume=${settings.voiceVolume}[voice]`];
    let finalLabel = 'voice';
    if (bgmPath) {
      const fadeIn = Math.min(1.5, duration / 3);
      const fadeOut = Math.min(2.7, duration / 3);
      filters.push(`[1:a]atrim=duration=${duration},asetpts=PTS-STARTPTS,volume=${settings.bgmVolume},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${duration - fadeOut}:d=${fadeOut}[bgm]`);
      if (settings.duckBgm) {
        // A sidechain consumes its inputs: split voice so the audible voice remains available.
        filters.push('[voice]asplit=2[voice-main][voice-side]');
        filters.push('[bgm][voice-side]sidechaincompress=threshold=0.045:ratio=5:attack=20:release=300[ducked]');
        filters.push('[voice-main][ducked]amix=inputs=2:duration=first:normalize=0[mixed]');
      } else filters.push('[voice][bgm]amix=inputs=2:duration=first:normalize=0[mixed]');
      finalLabel = 'mixed';
    }
    filters.push(`[${finalLabel}]${voiceFinalFilter(settings.normalize)}[out]`);
    const temporary = path.join(path.dirname(output), `.mix-${process.pid}-${Date.now()}.wav`);
    try {
      runCommand(commandFromEnv('ffmpeg'), [
        '-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-i', voicePath,
        ...(bgmPath ? ['-stream_loop', '-1', '-i', bgmPath] : []),
        '-filter_complex', filters.join(';'), '-map', '[out]', '-vn', '-t', String(duration),
        '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', temporary,
      ], {label: 'prepare narration and BGM', timeoutMs: 180000, stdio: 'pipe'});
      const actual = Number(probeMedia(temporary).format.duration);
      if (!Number.isFinite(actual) || Math.abs(actual - duration) > 0.15) throw new Error('Processed audio changed duration; timing was not rewritten');
      fs.renameSync(temporary, output);
    } finally { fs.rmSync(temporary, {force: true}); }
  }
  const prepared = probeMedia(output);
  if (!prepared.streams.some((stream) => stream.codec_type === 'audio') || Math.abs(Number(prepared.format.duration) - duration) > 0.15) {
    throw new Error('Prepared audio cache is invalid; remove the named generated mix and retry');
  }
  // Keep the original narration/BGM references. The renderer plays the mix once.
  plan.audio = {...audio, mix: relative, mixIncludesBgm: Boolean(bgmPath)};
  const report = {schemaVersion: 1, settings, voiceover: audio.sourceVoiceover ?? audio.voiceover,
    bgm: audio.bgm ?? null, mix: relative, mixIncludesBgm: Boolean(bgmPath),
    durationSeconds: Number(prepared.format.duration), timingPreserved: true};
  fs.writeFileSync(path.join(jobDir, 'audio', 'processing-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  return report;
};

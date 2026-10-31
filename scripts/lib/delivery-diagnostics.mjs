import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {commandFromEnv} from './bins.mjs';
import {envMilliseconds} from './process.mjs';

const execute = (bin, args) => {
  const result = spawnSync(commandFromEnv(bin), args, {
    encoding: 'utf8', timeout: envMilliseconds('SHORT_VIDEO_QC_TIMEOUT_MS', 300000), maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`${bin} diagnostic failed: ${result.error?.message ?? result.stderr?.slice(-1500)}`);
  return result;
};

// These are signals for review, not a claim that narration or editorial quality is correct.
export const inspectDelivery = (videoPath, outputDir, {expectAudible = true} = {}) => {
  const probe = JSON.parse(execute('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', videoPath]).stdout);
  const duration = Number(probe.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid delivery duration');
  const video = probe.streams.find((s) => s.codec_type === 'video');
  if (!video) throw new Error('Delivery has no video stream');
  const hasAudio = probe.streams.some((s) => s.codec_type === 'audio');
  const result = execute('ffmpeg', ['-hide_banner', '-nostdin', '-i', videoPath,
    '-vf', 'blackdetect=d=0.01:pix_th=0.10',
    ...(hasAudio ? ['-af', 'silencedetect=noise=-45dB:d=1,volumedetect'] : ['-an']),
    '-f', 'null', '-']);
  const black = [...result.stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)]
    .map((m) => ({start: Number(m[1]), end: Number(m[2]), duration: Number(m[3])}));
  const silences = [];
  let silenceStart;
  for (const m of result.stderr.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
    if (m[1] === 'start') silenceStart = Number(m[2]);
    else if (silenceStart !== undefined) {silences.push({start: silenceStart, end: Number(m[2]), duration: Number(m[2]) - silenceStart}); silenceStart = undefined;}
  }
  if (silenceStart !== undefined) silences.push({start: silenceStart, end: duration, duration: duration - silenceStart});
  const db = (label) => {
    const value = result.stderr.match(new RegExp(`${label}_volume: (-?inf|[-\\d.]+) dB`))?.[1];
    return value === undefined ? null : value.includes('inf') ? value : Number(value);
  };
  const volume = hasAudio ? {meanDb: db('mean'), maxDb: db('max')} : null;
  // Uniform samples span the entire film, unlike the legacy first-45-seconds sheet.
  const samples = 12;
  const tileHeight = Math.round(240 * video.height / video.width / 2) * 2;
  const contact = path.join(outputDir, 'contact-sheet.jpg');
  execute('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', videoPath,
    '-vf', `fps=${samples / duration},scale=240:${tileHeight},tile=4x3:nb_frames=12:padding=4:margin=4`,
    '-frames:v', '1', '-q:v', '2', contact]);
  if (!fs.existsSync(contact) || !fs.statSync(contact).size) throw new Error('Contact sheet was not produced');
  const errors = [];
  const warnings = [];
  if (black.some((s) => s.duration >= duration * 0.95)) errors.push('Delivery is almost entirely black');
  if (black.length) warnings.push(`Review ${black.length} detected black interval(s); dark designs can trigger this detector`);
  if (hasAudio && (volume.meanDb === null || volume.maxDb === null)) errors.push('Audio volume measurement is unavailable');
  if (expectAudible && hasAudio && (volume.maxDb === '-inf' || volume.maxDb < -60)) errors.push('Delivery audio is effectively silent');
  if (hasAudio && typeof volume.maxDb === 'number' && volume.maxDb >= -0.1) warnings.push('Audio peak is near full scale; review clipping');
  if (expectAudible && hasAudio && typeof volume.meanDb === 'number' && volume.meanDb < -35) warnings.push('Average audio level is low; review audibility');
  if (expectAudible && silences.some((s) => s.duration >= 3)) warnings.push('Audio has silence of at least 3s; review whether pauses/tail are intentional');
  return {
    probe, checks: {blackdetect: black, volumedetect: volume, silencedetect: silences}, errors, warnings,
    contactSheet: {file: 'contact-sheet.jpg', columns: 4, rows: 3, samples, sampling: 'uniform across full duration; read left to right, top to bottom'},
    thresholds: {blackPixel: 0.1, blackMinimumSeconds: 0.01, silenceDb: -45, silenceMinimumSeconds: 1},
    reviewLimits: ['No speech recognition or forced alignment', 'No semantic image relevance or listening judgment', 'Contact sheet is sampled; it does not replace full playback'],
  };
};

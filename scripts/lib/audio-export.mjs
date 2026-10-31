import fs from 'node:fs';
import path from 'node:path';
import {verifyAudioSync} from './audio-sync.mjs';
import {createHash} from 'node:crypto';
import {runCommand} from './process.mjs';
import {commandFromEnv} from './bins.mjs';
import {probeMedia} from './media-assets.mjs';
import {resolveJobAsset} from './audio-processing.mjs';

const hash = (data) => createHash('sha256').update(data).digest('hex');
export const finalizeAudio = (planPath, outputDir) => {
  const plan = JSON.parse(fs.readFileSync(planPath)); const job = path.dirname(planPath);
  const clips = plan.scenes.map((scene, i) => ({scene, i})).filter(({scene}) => scene.visual?.kind === 'video' && scene.visual.sourceVolume > 0);
  if (!plan.audio?.voiceover && !plan.audio?.bgm && !clips.length) return null;
  if (plan.audio?.voiceover && !plan.audio.mix) throw new Error('Prepare narration/BGM before final audio export');
  const video = path.join(outputDir, 'video.mp4');
  const info = probeMedia(video); const stream = info.streams.find((s) => s.codec_type === 'video');
  const fps = plan.meta.fps; const coverFrames = Math.round((plan.cover.introSeconds ?? 0.5) * fps);
  const contentFrames = Math.ceil(plan.meta.durationSeconds * fps); const frames = coverFrames + contentFrames;
  if (Number(stream?.nb_frames) !== frames) throw new Error('Video frame count does not match audio master timeline');
  const duration = frames / fps; const inputs = []; const filters = []; const labels = []; const sources = [];
  const input = (relative) => {
    const file = resolveJobAsset(job, relative); const index = sources.length;
    inputs.push('-i', file); sources.push({file: relative, sha256: hash(fs.readFileSync(file))}); return index;
  };
  if (plan.audio?.mix) {
    const i = input(plan.audio.mix);
    filters.push(`[${i}:a]asetpts=PTS-STARTPTS,adelay=${coverFrames * 1000 / fps}:all=1[base]`); labels.push('[base]');
  } else if (plan.audio?.bgm) {
    const i = input(plan.audio.bgm); const d = plan.meta.durationSeconds;
    filters.push(`[${i}:a]aloop=loop=-1:size=2147483647,atrim=duration=${d},asetpts=PTS-STARTPTS,volume=${plan.audio.bgmVolume ?? 0.35},afade=t=in:d=${Math.min(1, d)},afade=t=out:st=${Math.max(0, d - 1.5)}:d=${Math.min(1.5, d)},adelay=${coverFrames * 1000 / fps}:all=1[base]`); labels.push('[base]');
  }
  for (const {scene, i: sceneIndex} of clips) {
    const v = scene.visual; const index = input(v.asset);
    const start = Math.round(scene.start * fps);
    const end = sceneIndex === plan.scenes.length - 1 ? Math.ceil(scene.end * fps) : Math.round(scene.end * fps);
    const transition = sceneIndex < plan.scenes.length - 1 && !['cut', 'none'].includes(scene.transition) ? 12 : 0;
    const length = Math.min(contentFrames - start, end - start + transition) / fps;
    const sourceStart = Math.round(v.sourceStart * fps) / fps;
    if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(sourceStart) || sourceStart < 0 || !Number.isFinite(v.sourceVolume) || v.sourceVolume > 1) throw new Error('Invalid audible clip window/volume');
    const probe = probeMedia(resolveJobAsset(job, v.asset));
    if (!probe.streams.some((s) => s.codec_type === 'audio') || Number(probe.format.duration) + 0.01 < sourceStart + length) throw new Error(`Audible clip ${scene.id} is missing audio or too short`);
    const label = `clip${sceneIndex}`;
    filters.push(`[${index}:a]atrim=start=${sourceStart}:duration=${length},asetpts=PTS-STARTPTS,volume=${v.sourceVolume},adelay=${(coverFrames + start) * 1000 / fps}:all=1[${label}]`); labels.push(`[${label}]`);
  }
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,alimiter=limit=0.97:level=false:latency=true,apad,atrim=duration=${duration},aresample=48000[out]`);
  const dir = path.join(job, 'audio/prepared'); fs.mkdirSync(dir, {recursive: true});
  const identity = hash(JSON.stringify({plan, sources, filters})).slice(0, 24);
  const master = path.join(dir, `delivery-${identity}.wav`);
  const tempMaster = path.join(dir, `.delivery-${process.pid}-${Date.now()}.wav`);
  const tempVideo = path.join(outputDir, `.audio-export-${process.pid}-${Date.now()}.mp4`);
  const reportPath = path.join(outputDir, 'audio-export-report.json');
  const report = {schemaVersion: 1, status: 'pending', planSha256: hash(JSON.stringify(plan)), sources,
    master: path.relative(job, master).split(path.sep).join('/'), coverSeconds: coverFrames / fps, durationSeconds: duration,
    audibleClips: clips.map(({scene}) => scene.id), method: 'PCM timeline master; copy video and encode AAC once; verify decoded waveform'};
  try {
    if (!fs.existsSync(master)) {
      runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-n', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', tempMaster], {label: 'mix delivery master', stdio: 'pipe', timeoutMs: 180000});
      fs.renameSync(tempMaster, master);
    }
    report.masterSha256 = hash(fs.readFileSync(master));
    runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-n', '-i', video, '-i', master, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tempVideo], {label: 'final audio mux', stdio: 'pipe', timeoutMs: 180000});
    report.verification = verifyAudioSync(master, tempVideo);
    if (report.verification.status !== 'passed') throw new Error('Exported audio failed waveform timing verification');
    // A failed mux/check leaves the original render intact, never a half-written delivery.
    fs.renameSync(tempVideo, video);
    report.videoSha256 = hash(fs.readFileSync(video)); report.status = 'passed';
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    report.status = 'failed'; report.error = error.message;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    throw error;
  } finally {
    fs.rmSync(tempMaster, {force: true}); fs.rmSync(tempVideo, {force: true});
  }
};

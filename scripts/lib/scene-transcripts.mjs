import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {commandFromEnv} from './bins.mjs';
import {inspectAsset} from './media-assets.mjs';
import {resolveLocalAsr, transcribeLocal} from './local-asr.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export const sceneTranscripts = ({segments, audioFile, audioSha256, model, mlxModel, python, language, folder, transcribe}) => {
  const pcm = file => execFileSync(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-i', file, '-ar', '48000', '-ac', '1', '-f', 's16le', '-'], {maxBuffer: 128 * 1024 * 1024, timeout: 120000});
  const combined = createHash('sha256'); for (const s of segments) combined.update(pcm(s.file));
  if (hash(fs.readFileSync(audioFile)) !== audioSha256 || combined.digest('hex') !== hash(pcm(audioFile))) throw new Error('Scene audio does not exactly assemble into narration');
  const runtime = resolveLocalAsr({model, mlxModel, python});
  const {modelSha256, engineSha256} = runtime;
  const observe = transcribe ?? ((file, out) => transcribeLocal({audioFile: file, out, language, model: runtime.model, python: runtime.python}));
  const dir = path.join(folder, 'scene-transcripts'); fs.mkdirSync(dir, {recursive: true});
  let offset = 0; const words = [], text = [], cache = [];
  for (const segment of segments) {
    const file = segment.file, sourceHash = hash(fs.readFileSync(file));
    if (sourceHash !== segment.audioSha256) throw new Error('Scene ASR source hash mismatch');
    const duration = inspectAsset(file).duration;
    const key = hash(JSON.stringify({sourceHash, modelSha256, engineSha256, language}));
    const out = path.join(dir, `${key}.json`), seal = `${out}.sha256`;
    const reused = fs.existsSync(out) && fs.existsSync(seal);
    if (!reused) {
      const temp = `${out}.${process.pid}.tmp`;
      try {observe(file, temp); fs.renameSync(temp, out); fs.writeFileSync(seal, hash(fs.readFileSync(out)));}
      finally {fs.rmSync(temp, {force: true});}
    }
    if (hash(fs.readFileSync(out)) !== fs.readFileSync(seal, 'utf8')) throw new Error('Scene ASR cache modified; preserve evidence before retrying');
    const transcript = JSON.parse(fs.readFileSync(out));
    if (transcript.audioSha256 !== sourceHash || transcript.modelSha256 !== modelSha256 || !Array.isArray(transcript.words)) throw new Error('Scene ASR cache provenance mismatch');
    for (const w of transcript.words) {
      if (![w.start, w.end, w.probability].every(Number.isFinite) || w.start < 0 || w.end < w.start || w.end > duration + .1) throw new Error('Invalid scene ASR timestamps');
      words.push({...w, start: w.start + offset, end: w.end + offset});
    }
    text.push(transcript.text); cache.push({audioSha256: sourceHash, key, reused, duration, offset}); offset += duration;
  }
  return {schemaVersion: 1, engine: runtime.backend === 'mlx' ? 'mlx-whisper-local-scene-assembly' : 'openai-whisper-local-scene-assembly', backend: runtime.backend, audioSha256, modelSha256, engineSha256, language,
    text: text.join(' '), words, sceneCache: cache, duration: offset};
};

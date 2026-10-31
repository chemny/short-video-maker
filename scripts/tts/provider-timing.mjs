import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {alignCaptions, retimeScenes, normalized} from '../lib/alignment.mjs';
import {inspectAsset, copyAsset} from '../lib/media-assets.mjs';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
export const applyProviderTiming = (planPath, generated, provider) => {
  const plan = JSON.parse(fs.readFileSync(planPath)); const job = path.dirname(planPath);
  const asset = inspectAsset(generated.file); const audioSha256 = hash(fs.readFileSync(generated.file));
  if (audioSha256 !== generated.meta.audioSha256) throw new Error('Provider audio hash mismatch');
  const words = generated.words.filter((w) => normalized(w.word));
  let result;
  try {result = alignCaptions(plan.captions, {words, text: words.map((w) => w.word).join('')}, asset.duration);}
  catch (error) {result = {status: 'needs-review', proposed: [], issues: [{code: 'invalid-provider-timestamps', message: error.message}]};}
  const dir = path.join(job, 'alignment'); fs.mkdirSync(dir, {recursive: true});
  const phrase = generated.meta.timingOrigin === 'system-synthesis-phrase-segments';
  const timing = {provider, audioSha256, words, origin: `${generated.meta.timingOrigin ?? 'synthesis-service-word-boundaries'}; probability=1 is a matching sentinel, not ASR confidence`};
  write(path.join(dir, 'provider-timing.json'), timing);
  const report = {...result, method: phrase ? 'system-phrase-segment-matching' : 'provider-word-boundary-matching', engine: provider, audioSha256,
    scriptSha256: hash(JSON.stringify(plan.captions.map(({id, text}) => ({id, text})))),
    providerTimingSha256: hash(fs.readFileSync(path.join(dir, 'provider-timing.json'))), applied: false,
    limits: [phrase ? 'Actual separately synthesized caption phrase durations; includes silence, no word-level or independent ASR verification' : 'Word times reported by synthesis provider, not independent ASR', 'No guessed text normalization or proportional timing fallback']};
  write(path.join(dir, 'alignment-report.json'), report);
  if (result.status !== 'matched') throw new Error('Synthesis word boundaries do not unambiguously match approved captions');
  const voiceover = copyAsset(asset, job, 'audio/source');
  plan.scenes = retimeScenes(plan.scenes, result.proposed, asset.duration);
  plan.captions = result.proposed.map(({alignment, ...caption}) => caption); plan.meta.durationSeconds = asset.duration;
  plan.audio = {...plan.audio, voiceover, sourceVoiceover: voiceover, sourceMode: 'tts', timingSource: 'provider-matched'};
  delete plan.audio.mix; delete plan.audio.mixIncludesBgm;
  report.applied = true; write(planPath, plan); write(path.join(dir, 'alignment-report.json'), report);
};

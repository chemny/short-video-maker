import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runCommand, envMilliseconds} from '../lib/process.mjs';
import {normalized} from '../lib/alignment.mjs';
import {splitCaptionText} from './timeline.mjs';
import {applyProviderTiming} from './provider-timing.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

export const prepareNarration = (plan) => {
  if (plan.audio?.sourceMode === 'imported') throw new Error('Imported narration is protected; start a separate TTS job');
  const scenes = plan.scenes;
  if (!scenes?.length || scenes.some((s) => !s.voiceover?.trim())) throw new Error('Every scene requires approved narration');
  let captions = plan.captions?.length ? structuredClone(plan.captions) : scenes.flatMap((s) => splitCaptionText(s.voiceover)).map((text, i) => ({id: `cap-${i + 1}`, text}));
  if (normalized(captions.map((c) => c.text).join('')) !== normalized(scenes.map((s) => s.voiceover).join(''))) throw new Error('Approved captions must match narration; resolve text differences before synthesis');
  let cursor = 0;
  const mapped = scenes.map((s) => {
    const group = []; let text = '';
    while (cursor < captions.length && text.length < normalized(s.voiceover).length) {
      const c = captions[cursor++]; group.push(c.id); text += normalized(c.text);
    }
    if (text !== normalized(s.voiceover)) throw new Error(`Scene ${s.id}: caption crosses an approved scene boundary`);
    return {...s, captionIds: group};
  });
  return {captions, mapped};
};

export const alignGenerated = ({planPath, options = {}, provider, generated}) => {
  const file = path.resolve(planPath); const job = path.dirname(file); const before = fs.readFileSync(file);
  const plan = JSON.parse(before);
  if (plan.audio?.sourceMode === 'imported') throw new Error('Imported narration is protected; start a separate TTS job');
  const {captions, mapped} = prepareNarration(plan);
  const stage = fs.mkdtempSync(path.join(job, '.tts-align-'));
  try {
    const stagingPlan = path.join(stage, 'video-plan.json');
    write(stagingPlan, {...plan, scenes: mapped, captions});
    const alignment = path.join(stage, 'alignment'); fs.mkdirSync(alignment);
    const prior = path.join(job, 'alignment');
    if (fs.existsSync(prior)) for (const entry of fs.readdirSync(prior).filter((v) => v.startsWith('transcript-') && v.endsWith('.json'))) fs.copyFileSync(path.join(prior, entry), path.join(alignment, entry));
    const args = [path.join(root, 'scripts/align-narration.mjs'), stagingPlan, `--audio=${generated.file}`, '--apply',
      ...(options.asrModel ? [`--model=${options.asrModel}`] : []), ...(options.transcript ? [`--transcript=${path.resolve(options.transcript)}`] : [])];
    if (generated.segments?.length && !options.transcript) {
      const manifest = path.join(stage, 'segments.json'); write(manifest, generated.segments);
      args.push(`--segments=${manifest}`, `--scene-cache=${path.join(job, 'alignment')}`);
    }
    const align = (argv) => runCommand(process.execPath, argv, {timeoutMs: envMilliseconds('SHORT_VIDEO_ASR_TIMEOUT_MS', 900000), label: 'align generated narration'});
    try {
      if (generated.words?.length && !options.asrModel && !options.transcript && !options.forceAsr) {
        applyProviderTiming(stagingPlan, generated, provider);
      } else {
      try {align(args);}
      catch (firstError) {
        const reportFile = path.join(alignment, 'alignment-report.json');
        let first = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile)) : null;
        let recovered = false;
        // Isolated scene decoding can lose language context (including homophone
        // spelling). Observe the actual complete audio once before rejecting it;
        // never substitute expected words or relax matching/confidence thresholds.
        if (!options.transcript && generated.segments?.length && first?.issues?.length) {
          write(path.join(alignment, 'alignment-scene-pass.json'), first);
          const fullArgs = args.filter(arg => !arg.startsWith('--segments=') && !arg.startsWith('--scene-cache='));
          try {align(fullArgs); recovered = true;}
          catch {first = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile)) : first;}
        }
        if (!recovered) {
          const base = path.join(os.homedir(), '.cache/whisper/base.pt');
          const small = path.join(os.homedir(), '.cache/whisper/small.pt');
          // Independent corroboration only for exact text with uncertain boundaries.
          if (options.asrModel || options.transcript || !fs.existsSync(base) || !fs.existsSync(small) || !first?.issues?.length ||
            first.issues.some(issue => !['low-asr-probability', 'ambiguous-zero-duration-boundary'].includes(issue.code))) throw firstError;
          write(path.join(alignment, 'alignment-first-pass.json'), first);
          align([...args.filter(arg => !arg.startsWith('--segments=') && !arg.startsWith('--scene-cache=')), `--model=${base}`]);
          const second = JSON.parse(fs.readFileSync(reportFile));
          if (second.proposed.some((c, i) => Math.abs(c.start - first.proposed[i].start) > 0.25 || Math.abs(c.end - first.proposed[i].end) > 0.25)) {
            throw new Error('Independent ASR boundaries disagree by more than 250ms; review required');
          }
        }
      }
      }
    }
    catch (error) {
      const reportDir = path.join(job, 'alignment'); fs.mkdirSync(reportDir, {recursive: true});
      if (fs.existsSync(path.join(alignment, 'alignment-report.json'))) write(path.join(reportDir, `${provider}-rejected-${Date.now()}.json`), {
        ...JSON.parse(fs.readFileSync(path.join(alignment, 'alignment-report.json'))),
        status: 'needs-review', applied: false, rejectionReason: error.message,
      });
      for (const entry of fs.readdirSync(alignment).filter((v) => v.startsWith('transcript-') && v.endsWith('.json'))) {
        fs.copyFileSync(path.join(alignment, entry), path.join(reportDir, entry));
      }
      if (fs.existsSync(path.join(alignment, 'alignment-scene-pass.json'))) fs.copyFileSync(
        path.join(alignment, 'alignment-scene-pass.json'), path.join(reportDir, `${provider}-scene-pass-rejected-${Date.now()}.json`));
      throw new Error(`${provider} alignment blocked; original plan and delivery retained. ${error.message}`);
    }
    const aligned = JSON.parse(fs.readFileSync(stagingPlan));
    const destination = path.join(job, aligned.audio.voiceover); fs.mkdirSync(path.dirname(destination), {recursive: true});
    if (!fs.existsSync(destination)) fs.copyFileSync(path.join(stage, aligned.audio.voiceover), destination, fs.constants.COPYFILE_EXCL);
    if (hash(fs.readFileSync(destination)) !== generated.meta.audioSha256) throw new Error('Narration snapshot was modified');
    const dir = path.join(job, 'alignment'); fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, `plan-before-${provider}-${hash(before).slice(0, 16)}.json`), before);
    // Commit only after full matching; old audio/outputs remain recoverable.
    for (const entry of fs.readdirSync(alignment)) if (entry.startsWith('alignment-') || entry.startsWith('transcript-') || entry === 'provider-timing.json') fs.copyFileSync(path.join(alignment, entry), path.join(dir, entry));
    for (const key of ['provider', 'model', 'voice', 'voiceType', 'preset', 'rate', 'lang', 'outputFormat', 'speedRatio', 'loudnessRatio', 'concurrency', 'cluster', 'endpoint', 'reusedExistingAudio']) delete aligned.audio[key];
    aligned.audio = {...aligned.audio, ...generated.meta.providerMeta, sourceMode: 'tts', provider,
      processing: {normalize: true, ...plan.audio?.processing}};
    // Fresh observations replace old refined cue times, even for a reused WAV.
    // The default post-alignment acoustic pass must verify this observation anew.
    delete aligned.audio.acousticTiming;
    if (provider === 'voxcpm2') delete aligned.audio.rate;
    write(path.join(job, `audio/${provider}-generation.json`), {...generated.meta, reused: generated.reused});
    write(file, aligned);
    return {durationSeconds: aligned.meta.durationSeconds, reused: generated.reused, voiceover: aligned.audio.voiceover};
  } finally {fs.rmSync(stage, {recursive: true, force: true});}
};

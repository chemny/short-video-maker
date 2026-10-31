import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {alignCaptions, normalized} from '../lib/alignment.mjs';
import {inspectAsset} from '../lib/media-assets.mjs';
import {commandFromEnv} from '../lib/bins.mjs';
import {runCommand} from '../lib/process.mjs';
import {resolveLocalAsr, transcribeLocal} from '../lib/local-asr.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const synthesizePhrase = async ({provider, text, plan, outputDir, options}) => {
  if (provider === 'voxcpm2') {
    const {synthesize} = await import('./providers/voxcpm2.mjs');
    return synthesize({texts: [text], audioDir: outputDir, options});
  }
  if (!['edge', 'volcengine', 'local'].includes(provider)) throw new Error(`Phrase repair unavailable for ${provider}; provider is never switched automatically`);
  const adapter = await import(`./providers/${provider}.mjs`);
  const single = {...plan, scenes: [{id: 'phrase', start: 0, end: 1, voiceover: text, captionIds: ['phrase']}], captions: [{id: 'phrase', text, start: 0, end: 1}]};
  const outputMp3 = path.join(outputDir, 'phrase.mp3');
  const generated = await (adapter.generateSegments ?? adapter.generate)({plan: single, planDir: outputDir, outputMp3, options, skillRoot: root});
  if (generated.segments?.length !== 1) {generated.cleanup?.(); throw new Error('Phrase synthesis must return exactly one observed segment');}
  return {file: generated.segments[0].segmentPath, words: generated.segments[0].words,
    reused: generated.segments[0].reused === true, cleanup: generated.cleanup,
    meta: {provider, providerMeta: generated.providerMeta, timingOrigin: generated.timingOrigin ?? 'synthesis-service-word-boundaries'}};
};

const matchingNormalization = ({text, words, language}) => {
  // Cloud timestamps normally echo the requested text exactly; no Python or
  // local ASR dependency is needed for that route on other machines.
  if (normalized(text) === normalized(words.map(w=>w.word).join(''))) return {};
  if (language !== 'zh') return {};
  const values = JSON.parse(execFileSync(commandFromEnv('python3'), [path.join(root, 'scripts/normalize-chinese.py')], {
    input: JSON.stringify([text, ...words.map(w => w.word)]), timeout: 30000, maxBuffer: 4 * 1024 * 1024,
  }));
  return {captionTexts: values.slice(0, 1), wordTexts: values.slice(1)};
};

// Return an immutable verified candidate. Only the caller can commit an edit to
// the original job; a synthesis/recognition failure never changes the delivery.
export const repairPhrase = async ({planPath, caption, sourceFile, outputDir, provider, options = {}}) => {
  const plan = JSON.parse(fs.readFileSync(planPath));
  if (plan.audio?.sourceMode === 'imported') throw new Error('Imported narration is protected from automatic phrase replacement');
  const approved = plan.captions?.find(c => c.id === caption?.id);
  if (!approved?.text?.trim() || approved.text !== caption.text) throw new Error('Phrase repair requires an unchanged approved caption');
  const selected = provider === 'voxcpm2-local' ? 'voxcpm2' : provider;
  if (!['voxcpm2', 'edge', 'volcengine', 'local'].includes(selected)) throw new Error(`Phrase repair unavailable for ${selected}; provider is never switched automatically`);
  const actual = plan.audio?.provider === 'voxcpm2-local' ? 'voxcpm2' : plan.audio?.provider;
  if (actual && actual !== 'auto' && actual !== selected) throw new Error('Phrase repair provider must match the current narration provider');
  const language = plan.meta?.language?.split('-')[0] ?? 'auto';
  const sourceSha256 = sourceFile ? hash(fs.readFileSync(sourceFile)) : null;
  fs.mkdirSync(outputDir, {recursive: true});
  const stage = fs.mkdtempSync(path.join(outputDir, '.phrase-candidate-'));
  const adapters = options.adapters ?? {};
  let generated;
  try {
    const storedVoice = selected === 'volcengine' ? plan.audio?.voiceType : plan.audio?.voice;
    const voice = options.voice ?? (selected === 'voxcpm2' || storedVoice === 'system-default' ? undefined : storedVoice);
    const seedFromVoice = selected === 'voxcpm2' ? /^plain-seed-(\d+)$/.exec(plan.audio?.voice ?? '')?.[1] : undefined;
    const settings = {...options, voice,
      rate: options.rate ?? (plan.audio?.rate === 'system-default' ? undefined : plan.audio?.rate),
      speed: options.speed ?? plan.audio?.speedRatio, loudness: options.loudness ?? plan.audio?.loudnessRatio,
      cluster: options.cluster ?? plan.audio?.cluster, voicePreset: options.voicePreset ?? plan.audio?.preset,
      ...(selected === 'volcengine' ? {model: options.model ?? plan.audio?.model} : {}),
      ...(options.seed === undefined && seedFromVoice ? {seed: Number(seedFromVoice)} : {})};
    const synthesisDir = path.join(outputDir, 'synthesis', hash(JSON.stringify({provider: selected, text: caption.text})).slice(0, 24));
    fs.mkdirSync(synthesisDir, {recursive: true});
    generated = await (adapters.synthesize ?? synthesizePhrase)({provider: selected, text: caption.text, plan, outputDir: synthesisDir, options: settings});
    const pcm = path.join(stage, 'phrase.wav');
    runCommand(commandFromEnv('ffmpeg'), ['-v', 'error', '-nostdin', '-n', '-i', generated.file, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', pcm], {stdio: 'pipe'});
    const asset = inspectAsset(pcm);
    if (!asset.hasAudio || !(asset.duration > 0)) throw new Error('Phrase synthesis returned no usable audio');
    const audioSha256 = hash(fs.readFileSync(pcm));
    let transcript, transcriptFile, timingOrigin;
    const independent = selected === 'voxcpm2' || selected === 'local' || options.forceAsr || !generated.words?.length;
    if (!independent) {
      transcript = {engine: `${selected}-provider-timestamps`, audioSha256, text: caption.text, words: generated.words};
      timingOrigin = 'synthesis-service-word-boundaries; probability=1 is a matching sentinel, not ASR confidence';
    } else if (options.phraseTranscript) {
      transcriptFile = path.resolve(options.phraseTranscript); transcript = JSON.parse(fs.readFileSync(transcriptFile));
      timingOrigin = 'explicit-audio-bound-local-ASR';
    } else {
      const runtime = adapters.observe ? {modelSha256: 'injected-observer', engineSha256: 'injected-observer'}
        : resolveLocalAsr({model: options.asrModel, mlxModel: options.mlxModel, python: options.mlxPython});
      const key = hash(JSON.stringify({audioSha256, language, model: runtime.modelSha256, engine: runtime.engineSha256}));
      transcriptFile = path.join(outputDir, `phrase-transcript-${key}.json`);
      const seal = `${transcriptFile}.sha256`;
      if (fs.existsSync(transcriptFile) && fs.existsSync(seal)) {
        if (hash(fs.readFileSync(transcriptFile)) !== fs.readFileSync(seal, 'utf8')) throw new Error('Phrase ASR cache modified; preserve the evidence before retrying');
        transcript = JSON.parse(fs.readFileSync(transcriptFile));
      } else {
        const temp = path.join(stage, 'observed.json');
        transcript = adapters.observe
          ? await adapters.observe({audioFile: pcm, out: temp, language, runtime})
          : transcribeLocal({audioFile: pcm, out: temp, language, model: options.asrModel, mlxModel: options.mlxModel, python: options.mlxPython});
        write(temp, transcript); fs.renameSync(temp, transcriptFile); fs.writeFileSync(seal, hash(fs.readFileSync(transcriptFile)));
      }
      if (!adapters.observe && transcript.modelSha256 !== runtime.modelSha256) throw new Error('Phrase ASR model provenance mismatch');
      timingOrigin = 'independent-local-ASR-word-boundaries';
    }
    if (transcript.audioSha256 !== audioSha256) throw new Error('Phrase transcript does not match candidate audio');
    const normalization = await (adapters.normalize ?? matchingNormalization)({text: caption.text, words: transcript.words ?? [], language});
    const verification = alignCaptions([{id: caption.id, text: caption.text}], transcript, asset.duration, normalization);
    if (verification.status !== 'matched') throw new Error(`Phrase repair text/timing verification rejected: ${JSON.stringify(verification.issues)}`);
    if (!transcriptFile) {
      const evidence = `${JSON.stringify(transcript, null, 2)}\n`;
      transcriptFile = path.join(outputDir, `phrase-provider-timing-${hash(evidence).slice(0, 24)}.json`);
      if (fs.existsSync(transcriptFile) && hash(fs.readFileSync(transcriptFile)) !== hash(evidence)) throw new Error('Phrase provider timing snapshot was modified');
      if (!fs.existsSync(transcriptFile)) fs.writeFileSync(transcriptFile, evidence, {flag: 'wx'});
    }
    const file = path.join(outputDir, `phrase-${audioSha256.slice(0, 24)}.wav`);
    if (fs.existsSync(file)) {
      if (hash(fs.readFileSync(file)) !== audioSha256) throw new Error('Verified phrase snapshot was modified');
    } else fs.copyFileSync(pcm, file, fs.constants.COPYFILE_EXCL);
    const meta = {schemaVersion: 1, provider: selected, audioSha256, sourceSha256, text: caption.text,
      captionId: caption.id, duration: asset.duration, timingOrigin, verification, transcriptFile: transcriptFile ?? null,
      generation: generated.meta ?? null, limits: ['Strict observed-text matching does not certify intonation or human listening quality', 'Candidate only; original plan/audio/delivery are unchanged']};
    write(file.replace(/\.wav$/, '.json'), meta);
    return {file, duration: asset.duration, words: transcript.words, meta, reused: generated.reused === true};
  } finally {
    generated?.cleanup?.(); fs.rmSync(stage, {recursive: true, force: true});
  }
};

import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {commandFromEnv} from './bins.mjs';
import {resolveLocalAsr, transcribeLocal} from './local-asr.mjs';
import {normalized} from './alignment.mjs';
import {synthesize, loadVoiceProfile} from '../tts/providers/voxcpm2.mjs';

// Take selection for VoxCPM2 narration. Plain-mode synthesis is not repeatable across seeds: one seed may hum after a sentence,
// another may misread a word. Each scene is synthesised with several seeds, every take is transcribed by the same local ASR the
// alignment gate uses, and the take whose transcript reproduces the approved text with the highest word confidence is kept.
// This only chooses between real recordings; nothing is edited, and the normal alignment gate still runs on the assembled audio.
const hash = (b) => createHash('sha256').update(b).digest('hex');
const same = (s) => normalized(s).replace(/著/g, '着');
// Fundamental frequency of a take (scripts/voice-pitch.py, numpy only, run with the ASR runtime's Python). Rough: it flags a clone that
// drifted to a different voice, it does not identify a speaker.
export const pitchOf = (python, wav) => { const r = JSON.parse(execFileSync(python, [fileURLToPath(new URL('../voice-pitch.py', import.meta.url)), wav], {timeout: 60000}).toString()); return r.f0; };
export const PITCH_TOLERANCE = 0.3;
export const DEFAULT_SEEDS = [42, 7, 11, 23, 5, 99, 3, 17];

// Does an ASR transcript reproduce the text, and how sure was the recogniser of its least certain word?
// The same OpenCC helper the alignment gate uses, so a transcript in Traditional characters still counts as a match.
export const toSimplified = (texts) => JSON.parse(execFileSync(commandFromEnv('python3'), [fileURLToPath(new URL('../normalize-chinese.py', import.meta.url))],
  {input: JSON.stringify(texts), maxBuffer: 4 * 1024 * 1024, timeout: 30000}).toString());

// Does an ASR transcript reproduce the text, and how sure was the recogniser of its least certain word?
export function judgeTake(text, transcript, convert = (x) => x) {
  const words = (transcript.words ?? []).map((w) => w.word);
  const [wantText, ...gotWords] = convert([text, ...words]);
  const want = same(wantText), got = same(words.length ? gotWords.join('') : transcript.text ?? '');
  const probs = (transcript.words ?? []).filter((w) => /[\p{L}\p{N}]/u.test(w.word)).map((w) => w.probability);
  const minProbability = probs.length ? Math.min(...probs) : 0;
  return {textMatches: want === got, minProbability: Number.isFinite(minProbability) ? minProbability : 0, heard: got};
}

export function chooseTake(takes, {minProbability = 0.4} = {}) {
  const good = takes.filter((t) => t.textMatches && t.minProbability >= minProbability && t.pitchOk !== false);
  if (!good.length) return null;
  return good.sort((a, b) => b.minProbability - a.minProbability)[0];
}

// `avoid` lists seeds not to choose for a scene (for example one the whole-audio check rejected); `exhaustive` tries every seed.
export function pickTakes({job, seeds = DEFAULT_SEEDS, minProbability = 0.4, goodEnough = 0.6, scenes: only, avoid = {}, exhaustive = false, voiceProfile, pitchTolerance: tol, log = () => {}, ...rest}) {
  const dir = path.join(job, 'narration'), plan = JSON.parse(fs.readFileSync(path.join(dir, 'video-plan.json'), 'utf8'));
  const audioDir = path.join(dir, 'audio'), cache = path.join(dir, 'takes-asr');
  fs.mkdirSync(cache, {recursive: true});
  const runtime = resolveLocalAsr({});
  const file = path.join(dir, 'takes.json');
  const referencePitch = voiceProfile ? pitchOf(runtime.python, loadVoiceProfile(voiceProfile).reference) : null;
  const pitchTolerance = tol ?? PITCH_TOLERANCE;
  const prior = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {scenes: {}};
  const record = {scenes: {...prior.scenes}};
  for (const scene of plan.scenes) {
    if (only && !only.includes(scene.id)) continue;
    const tried = record.scenes[scene.id]?.tried ?? [];
    let best = null;
    const attempts = [...tried];
    for (const seed of seeds) {
      let take = attempts.find((t) => t.seed === seed);
      if (take && voiceProfile && take.pitchHz === undefined) {
        const wav = synthesize({texts: [scene.voiceover], audioDir, options: {seed, voiceProfile}}).segments[0].file;
        take.pitchHz = pitchOf(runtime.python, wav);
        take.pitchOk = take.pitchHz == null ? false : Math.abs(take.pitchHz - referencePitch) / referencePitch <= pitchTolerance;
        if (!take.pitchOk) log(`${scene.id} seed ${seed}: pitch ${Math.round(take.pitchHz ?? 0)} Hz is off the reference ${Math.round(referencePitch)} Hz`);
      }
      if (!take) {
        const made = synthesize({texts: [scene.voiceover], audioDir, options: {seed, voiceProfile}});
        const wav = made.segments[0].file, sha = hash(fs.readFileSync(wav)), out = path.join(cache, `${sha.slice(0, 20)}.json`);
        const transcript = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : transcribeLocal({audioFile: wav, out, language: 'zh', model: runtime.model, python: runtime.python});
        take = {seed, audioSha256: sha, ...judgeTake(scene.voiceover, transcript, toSimplified)};
        if (voiceProfile) { take.pitchHz = pitchOf(runtime.python, wav); take.pitchOk = take.pitchHz == null ? false : Math.abs(take.pitchHz - referencePitch) / referencePitch <= pitchTolerance; }
        attempts.push(take);
        log(`${scene.id} seed ${seed}: ${take.textMatches ? 'text ok' : `heard "${take.heard}"`}, least sure word ${take.minProbability.toFixed(2)}${take.pitchHz ? `, pitch ${Math.round(take.pitchHz)} Hz${take.pitchOk ? '' : ' (off)'}` : ''}`);
      }
      best = chooseTake(attempts.filter((t) => !(avoid[scene.id] ?? []).includes(t.seed)), {minProbability});
      if (!exhaustive && best && best.minProbability >= goodEnough) break;
    }
    record.scenes[scene.id] = {seed: best?.seed ?? null, minProbability: best?.minProbability ?? null, tried: attempts};
  }
  const order = plan.scenes.map((s) => record.scenes[s.id]?.seed ?? null);
  record.sceneSeeds = order.every((s) => s !== null) ? order : null;
  record.failing = plan.scenes.filter((s) => record.scenes[s.id]?.seed == null).map((s) => s.id);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

// What the real alignment gate says about an assembled narration, without applying anything: copy the plan to a temp folder, run
// align-narration on the audio and read its report. Issues are mapped back to scenes through the plan's caption ids.
export function diagnose(job, wav, segments) {
  const plan = JSON.parse(fs.readFileSync(path.join(job, 'narration/video-plan.json'), 'utf8'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-diag-'));
  const sceneOf = new Map(plan.scenes.flatMap((s) => s.captionIds.map((c) => [c, s.id])));
  const align = (extra) => {
    try { execFileSync(process.execPath, [fileURLToPath(new URL('../align-narration.mjs', import.meta.url)), path.join(tmp, 'video-plan.json'), `--audio=${wav}`, ...extra], {stdio: 'pipe', timeout: 900000}); } catch { /* a blocked alignment still writes its report */ }
    const report = JSON.parse(fs.readFileSync(path.join(tmp, 'alignment/alignment-report.json'), 'utf8'));
    const issues = (report.issues ?? []).map((i) => ({...i, scene: sceneOf.get(i.captionId) ?? null}));
    return {status: report.status, issues, scenes: [...new Set(issues.map((i) => i.scene).filter(Boolean))], unlocated: issues.filter((i) => !i.scene).length};
  };
  try {
    fs.writeFileSync(path.join(tmp, 'video-plan.json'), JSON.stringify(plan));
    // the real flow tries each scene on its own first and only then the whole audio; either one matching is enough
    if (segments?.length) {
      fs.writeFileSync(path.join(tmp, 'segments.json'), JSON.stringify(segments));
      const scenePass = align([`--segments=${path.join(tmp, 'segments.json')}`, `--scene-cache=${path.join(tmp, 'alignment')}`]);
      if (scenePass.status === 'matched') return {...scenePass, pass: 'scenes'};
    }
    return {...align([]), pass: 'whole audio'};
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

// Choose takes, assemble, ask the alignment gate, and swap the take of every scene it flags; repeat. Rejected seeds are remembered.
export function refineTakes({job, seeds = DEFAULT_SEEDS, rounds = 6, log = () => {}, voiceProfile, ...rest}) {
  const dir = path.join(job, 'narration'), file = path.join(dir, 'takes.json');
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'video-plan.json'), 'utf8'));
  let record = pickTakes({job, seeds, log, voiceProfile, ...rest});
  for (let round = 1; round <= rounds; round++) {
    if (!record.sceneSeeds) return {...record, aligned: false, reason: `no acceptable take for ${record.failing.join(', ')}`};
    const made = synthesize({texts: plan.scenes.map((s) => s.voiceover), audioDir: path.join(dir, 'audio'), options: {sceneSeeds: record.sceneSeeds, voiceProfile}});
    const d = diagnose(job, made.file, made.segments);
    log(`round ${round}: alignment ${d.status}${d.pass ? ` (${d.pass})` : ''}${d.issues.length ? `; ${d.issues.map((i) => `${i.code}@${i.scene ?? '?'}`).join(', ')}` : ''}`);
    if (d.status === 'matched') return {...record, aligned: true, rounds: round};
    if (!d.scenes.length) return {...record, aligned: false, reason: 'the gate flagged speech that cannot be tied to a scene'};
    const avoid = {...(record.avoid ?? {}), ...(rest.avoid ?? {})};
    for (const id of d.scenes) { const seed = record.scenes[id].seed; avoid[id] = [...new Set([...(avoid[id] ?? []), seed])]; }
    record = pickTakes({job, seeds, log, voiceProfile, ...rest, avoid, exhaustive: true, scenes: d.scenes});
    record.avoid = avoid;
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  }
  return {...record, aligned: false, reason: `still flagged after ${rounds} rounds`};
}

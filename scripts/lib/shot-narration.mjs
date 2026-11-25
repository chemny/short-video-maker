import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {estimateTimings, splitPhrases} from './shot-film.mjs';

// Bridge between a shot script and the existing narration tools. The tools (scripts/tts.mjs, alignment, acoustic timing) work on a
// plan with scenes and verbatim phrase captions, so each beat becomes a scene and its narration is split into phrase captions.
// The plan lives in <job>/narration/, next to the audio and alignment evidence the tools write there.
export const NARRATION_DIR = 'narration';
const sha = (text) => createHash('sha256').update(text).digest('hex');
const norm = (t) => String(t).replace(/[^一-鿿A-Za-z0-9]/g, '');

export const narrationText = (script) => script.beats.map((b) => String(b.narration).trim()).join('\n');
export const narrationSha = (script) => sha(narrationText(script));

export function buildNarrationPlan(script, {title, audio = {}} = {}) {
  const est = estimateTimings(script.beats);
  let n = 0;
  const captions = [], scenes = script.beats.map((b, i) => {
    const phrases = splitPhrases(String(b.narration).trim());
    const first = captions.length;
    phrases.forEach((text) => captions.push({id: `cap-${String(++n).padStart(3, '0')}`, start: 0, end: 0, text}));
    return {id: b.id, start: est.spans[i].start, end: est.spans[i].end, voiceover: String(b.narration).trim(), caption: phrases[0], layout: 'text-card', captionIds: captions.slice(first).map((c) => c.id)};
  });
  // estimated caption times, replaced by the narration tools after synthesis
  est.captions.forEach((c, i) => { if (captions[i]) { captions[i].start = c.start; captions[i].end = c.end; } });
  const total = scenes.at(-1).end;
  if (norm(captions.map((c) => c.text).join('')) !== norm(scenes.map((s) => s.voiceover).join(''))) throw new Error('phrase captions do not reproduce the narration; check the beat text');
  return {meta: {title: title ?? script.topic ?? 'shot film', topic: script.topic ?? '', fps: 30, width: 1080, height: 1920, durationSeconds: Math.round(total * 100) / 100, platforms: ['douyin', 'channels'], language: 'zh-CN'},
    style: {template: 'shot-film'}, cover: {}, publish: {}, audio: {voiceover: 'audio/voiceover.mp3', voiceVolume: 1, ...audio}, captions, scenes};
}

export const planPath = (job) => path.join(job, NARRATION_DIR, 'video-plan.json');
export const statePath = (job) => path.join(job, NARRATION_DIR, 'state.json');

// Timings after synthesis: beat spans from the plan's scenes, captions from its captions, audio path relative to the job.
export function timingsFromPlan(job, script) {
  const plan = JSON.parse(fs.readFileSync(planPath(job), 'utf8'));
  const state = fs.existsSync(statePath(job)) ? JSON.parse(fs.readFileSync(statePath(job), 'utf8')) : null;
  if (!state || state.narrationSha256 !== narrationSha(script)) throw new Error('narration is out of date: the script text changed after the voiceover was made; run the narration stage again');
  const byId = new Map(plan.scenes.map((s) => [s.id, s]));
  const spans = script.beats.map((b) => {
    const s = byId.get(b.id);
    if (!s || !Number.isFinite(s.start) || !Number.isFinite(s.end)) throw new Error(`narration plan has no timing for beat ${b.id}`);
    return {start: s.start, end: s.end};
  });
  const raw = plan.audio?.voiceover ? `${NARRATION_DIR}/${plan.audio.voiceover}` : null;
  if (!raw || !fs.existsSync(path.join(job, raw))) throw new Error('narration audio is missing; run the narration stage');
  // the loudness-normalised copy made by the narration stage is what the film plays
  const normalised = `${NARRATION_DIR}/audio/voiceover-norm.wav`, audio = state.normalized && fs.existsSync(path.join(job, normalised)) ? normalised : raw;
  return {timing: {spans, captions: plan.captions.map((c) => ({start: c.start, end: c.end, text: c.text})), source: plan.audio?.timingSource ?? 'aligned'}, audio, plan, state};
}

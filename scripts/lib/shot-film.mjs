import fs from 'node:fs';
import path from 'node:path';
import {auditShotScript, estimateSeconds, loadInventory, MEDIA_RUNGS} from './shot-script.mjs';
import {ensureSfx, gainFor, measureLufs, synthBed} from './sfx.mjs';
import {splitForLines, styleCaptions} from './caption-style.mjs';
import {FRAMES, assignLayouts, assignTransitions} from './transitions-plan.mjs';
import {cornerPalette} from './media-palette.mjs';

// Compiles shot-script.json plus the visual inventory into shot-film.json, the props of the ShotFilm composition
// (remotion/src/templates/frame/shots). Times come from aligned captions when given, otherwise from estimates.
const norm = (t) => String(t).replace(/[^一-鿿A-Za-z0-9]/g, '');
const FPS = 30;
export const TRANSITION_SECONDS = Object.fromEntries(Object.entries(FRAMES).map(([k, v]) => [k, v / 30]));
const WHOOSH_GAIN = {dissolve: 0.15, slide: 0.18, push: 0.22, stack: 0.22, wipe: 0.18, zoom: 0.15, blur: 0.12};   // low: they sit under the voice
export const HOOK_SECONDS = 2.6;
export const BGM_LUFS = -32;

// Phrase captions: every piece fits one caption line (references/caption-standard.md), so a long sentence becomes several events.
export function splitPhrases(text) {
  return splitForLines(text).map((s) => s.replace(/[，、；：]$/, ''));
}

export function estimateTimings(beats) {
  let t = 0;
  const spans = [], captions = [];
  for (const b of beats) {
    const d = estimateSeconds(b.narration), start = t, end = t + d, phrases = splitPhrases(b.narration);
    const weights = phrases.map((p) => Math.max(1, norm(p).length)), sum = weights.reduce((a, c) => a + c, 0);
    let c = start;
    phrases.forEach((p, i) => { const e = i === phrases.length - 1 ? end : c + (d * weights[i]) / sum; captions.push({start: c, end: e, text: p}); c = e; });
    spans.push({start, end}); t = end;
  }
  return {spans, captions, source: 'estimated'};
}

// Aligned captions [{start,end,text}] are handed to beats in order, by the number of characters each beat speaks.
export function alignTimings(beats, captions) {
  const spans = [];
  let i = 0;
  for (const b of beats) {
    const need = norm(b.narration).length;
    let have = 0;
    const first = i;
    while (i < captions.length && have < need) { have += norm(captions[i].text).length; i++; }
    if (i === first || have < need - 1) throw new Error(`captions do not cover the narration of beat ${b.id}`);
    if (Math.abs(have - need) > Math.max(3, need * 0.15)) throw new Error(`captions and the narration of beat ${b.id} differ (${have} vs ${need} characters)`);
    spans.push({start: captions[first].start, end: captions[i - 1].end});
  }
  if (i < captions.length) throw new Error('captions continue after the last beat');
  return {spans, captions, source: 'aligned'};
}

export function compileFilm(job, {captionsFile, timing: given, audio, theme = 'dark', tail = 0.4} = {}) {
  const script = JSON.parse(fs.readFileSync(path.join(job, 'shot-script.json'), 'utf8'));
  const inventory = loadInventory(job);
  if (!inventory) throw new Error('research/visual-inventory.json is missing; run build-visual-inventory.mjs first');
  const audit = auditShotScript(script, {inventory});
  if (audit.errors.length) throw new Error(`shot script has errors:\n  ${audit.errors.join('\n  ')}`);

  const timing = given ?? (captionsFile ? alignTimings(script.beats, (() => { const j = JSON.parse(fs.readFileSync(captionsFile, 'utf8')); return Array.isArray(j) ? j : j.captions; })()) : estimateTimings(script.beats));
  const problems = [];
  const mediaOf = (id, beatId, seconds, sourceStart = 0) => {
    const item = inventory.get(id);
    if (!item || item.status !== 'on-disk' || !item.file || !fs.existsSync(path.join(job, item.file))) { problems.push(`${beatId}: ${id} is not on disk; download it (with the user's approval) or capture it first`); return undefined; }
    if (!(item.width > 0 && item.height > 0)) { problems.push(`${beatId}: ${id} has no known size`); return undefined; }
    if (item.kind === 'video' && Number.isFinite(item.duration) && item.duration < sourceStart + seconds - 0.05) problems.push(`${beatId}: footage ${id} is ${item.duration.toFixed(1)} s, shorter than the ${seconds.toFixed(1)} s shot (it is never looped)`);
    const palette = item.kind === 'image' ? cornerPalette(path.join(job, item.file)) : null;
    return {kind: item.kind === 'video' ? 'video' : 'image', src: item.file, mw: item.width, mh: item.height, ...(item.kind === 'video' ? {sourceStart} : {}), ...(palette ? {palette} : {})};
  };

  // Pauses between spoken beats belong to the shot that was just on screen, and any lead-in silence to the first shot, so the
  // picture is never empty. Spans become contiguous from 0.
  const spans = timing.spans.map((s, i, all) => ({start: i === 0 ? 0 : s.start, end: i + 1 < all.length ? all[i + 1].start : s.end}));
  const shots = script.beats.map((b, i) => {
    const {start, end} = spans[i], seconds = end - start;
    const shot = {id: b.id, start, end, rung: MEDIA_RUNGS.has(b.rung) ? b.rung : 'text', move: MEDIA_RUNGS.has(b.rung) ? b.move : 'hold'};
    if (b.rung === 'diagram') problems.push(`${b.id}: diagram beats have no renderer yet; use a picture or a text beat`);
    if (MEDIA_RUNGS.has(b.rung)) shot.media = mediaOf(b.material, b.id, seconds, b.sourceStart ?? 0);
    if (b.materialB) shot.mediaB = mediaOf(b.materialB, b.id, seconds, b.sourceStartB ?? 0);
    for (const k of ['region', 'regionEnd', 'fit', 'at', 'figure', 'labels']) if (b[k] !== undefined) shot[k] = b[k];
    if (b.onScreen !== undefined) shot.onScreen = {lines: b.onScreen};
    return shot;
  });
  if (problems.length) throw new Error(`cannot compile:\n  ${problems.join('\n  ')}`);

  // entry effects and picture layouts from the deterministic plan (explicit fields on a beat win); the first shot always cuts
  const secs = shots.map((s) => s.end - s.start), entries = assignTransitions(script.beats, secs, {materials: script.beats.map((b) => b.material)});
  const layouts = assignLayouts(script.beats, secs, shots.map((s) => (s.media && s.media.mw / s.media.mh > 0.75 ? 'contain' : 'cover')));
  shots.forEach((s, i) => {
    s.transition = i === 0 ? 'cut' : entries[i].type;
    if (entries[i].dir && entries[i].type !== 'cut') s.dir = entries[i].dir;
    if (layouts[i] !== 'card' && s.media) s.layout = layouts[i];
  });

  // pictures that leave room sit a little above or below the middle in turn, so two in a row never share the same band
  let lane = 1;
  for (const s of shots) if (s.media?.kind === 'image' && s.media.mw / s.media.mh > 0.75) { s.lane = lane; lane = -lane; }

  // sound events (seconds on the film's clock): swish on a transition, tick on a highlight or click, hit on a figure or the hook
  const sfx = [];
  shots.forEach((s) => {
    const len = s.end - s.start, T = TRANSITION_SECONDS[s.transition];
    if (T) sfx.push({t: s.start - T, kind: 'whoosh', gain: WHOOSH_GAIN[s.transition] ?? 0.3});
    if (s.move === 'highlight') sfx.push({t: s.start + (s.at ?? 0.5), kind: 'click', gain: 0.5});
    if (s.move === 'cursor') sfx.push({t: s.start + (s.at ?? len * 0.55), kind: 'click', gain: 0.6});
    if (s.move === 'count') sfx.push({t: s.start + (s.figure?.at ?? 0.3) + 1.2, kind: 'thump', gain: 0.5});
    if (s.move === 'compare') sfx.push({t: s.start + (s.at ?? 1), kind: 'whoosh', gain: 0.25});
  });
  const hook = script.hook ? {lines: script.hook.lines, seconds: HOOK_SECONDS} : undefined;
  if (hook) sfx.push({t: 0.1, kind: 'thump', gain: 0.55});
  sfx.sort((a, b) => a.t - b.t);

  const last = Math.max(...shots.map((s) => s.end)) + tail;
  shots[shots.length - 1].end = last;
  let bgm;
  if (script.bgm?.file) {
    let rel;
    if (script.bgm.file === 'synth') rel = synthBed(job, last);
    else {
      const src = path.isAbsolute(script.bgm.file) ? script.bgm.file : path.join(job, script.bgm.file);
      if (!fs.existsSync(src)) throw new Error(`bgm file not found: ${script.bgm.file}`);
      rel = path.relative(job, src).startsWith('..') ? `audio/bgm${path.extname(src)}` : path.relative(job, src);
      if (rel.startsWith('audio/bgm') && !fs.existsSync(path.join(job, rel))) { fs.mkdirSync(path.join(job, 'audio'), {recursive: true}); fs.copyFileSync(src, path.join(job, rel)); }
    }
    // level: an explicit volume, or a target loudness for the bed (default -32 LUFS, about 16 LU under narration at -16 LUFS)
    const lufs = script.bgm.lufs ?? BGM_LUFS, measured = measureLufs(path.join(job, rel));
    bgm = {src: rel, volume: script.bgm.volume ?? Math.round(gainFor(measured, lufs) * 1000) / 1000, measuredLufs: measured, targetLufs: script.bgm.volume === undefined ? lufs : undefined, synthetic: script.bgm.file === 'synth'};
  }
  const kinds = [...new Set(sfx.map((e) => e.kind))];
  const files = kinds.length ? ensureSfx(job, kinds) : {};
  const film = {fps: FPS, durationInFrames: Math.ceil(last * FPS), theme, shots, captions: styleCaptions(timing.captions, {fps: FPS, endAt: last}), ...(audio ? {audio} : {}),
    ...(hook ? {hook} : {}), ...(bgm ? {bgm} : {}), sfx: sfx.map((e) => ({...e, src: files[e.kind]}))};
  return {film, audit, timingSource: timing.source};
}

import fs from 'node:fs';
import path from 'node:path';

// Shot script: the script written beat by beat, each beat bound to a picture from the visual inventory and a camera move.
// Contract and thresholds are in references/shot-script.md; the shared limits are in references/quality-bar.md.
export const RUNGS = ['video', 'image', 'recording', 'diagram', 'text'];            // best first
export const MEDIA_RUNGS = new Set(['video', 'image', 'recording']);
export const MOVES = ['push', 'pull', 'pan', 'focus', 'highlight', 'compare', 'count', 'cursor', 'hold'];
import {LAYOUTS, TRANSITIONS, assignTransitions, varietyFindings} from './transitions-plan.mjs';
export {TRANSITIONS, LAYOUTS};
export const LIMITS = {
  rhythm: {minBeats: 5, minVariation: 0.15, flicker: 1.6, openingRatio: 1.3},   // variation = standard deviation / mean of beat length
  transitionShare: 0.4,                         // beats entered by a transition other than a cut
  hookLines: 2, hookChars: 8,
  textShare: {pass: 0.15, fail: 0.25},        // beats with only text on screen
  noMediaShare: {pass: 0.3, fail: 0.5},       // text plus diagram
  beatSeconds: {pass: 8, fail: 12},
  firstBeatSeconds: {pass: 4.5, fail: 7},
  maxUses: 2,                                  // one picture may serve at most two beats, each with its own crop or move
  runLength: 3,                                // identical rung and move this many times in a row is a warning
  distinctMaterials: 4,
};

export const regionOk = (r) => !!r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.x >= 0 && r.y >= 0 && r.w > 0.02 && r.h > 0.02 && r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001;
const NEEDS_REGION = new Set(['focus', 'highlight', 'cursor', 'pan']);

const CHARS_PER_SECOND = 4.7;
export const estimateSeconds = (text) => {
  const han = (text.match(/[一-鿿]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]+/g) ?? []).length, digits = (text.match(/\d+/g) ?? []).length;
  return Math.max(0.8, (han + latin * 2 + digits * 1.5) / CHARS_PER_SECOND);
};
const bigrams = (text) => { const c = text.replace(/[^一-鿿A-Za-z0-9]/g, ''), s = new Set(); for (let i = 0; i < c.length - 1; i++) s.add(c.slice(i, i + 2)); return s; };
const overlap = (a, b) => { const x = bigrams(a), y = bigrams(b); if (!x.size || !y.size) return 0; let n = 0; for (const i of x) if (y.has(i)) n++; return n / Math.min(x.size, y.size); };

const inventoryRung = (item) => {
  if (item.kind === 'image') return 'image';
  if (item.moving || item.kind === 'video') return /scroll-recording/i.test(item.acquisition ?? '') ? 'recording' : 'video';
  return 'image';
};

export function loadInventory(job) {
  try {
    const inv = JSON.parse(fs.readFileSync(path.join(job, 'research/visual-inventory.json'), 'utf8'));
    return new Map(inv.items.map((i) => [i.id, i]));
  } catch { return null; }
}

export function auditShotScript(script, {inventory = null, claimIds = null, target} = {}) {
  const errors = [], warnings = [], L = LIMITS;
  const beats = Array.isArray(script?.beats) ? script.beats : [];
  if (!beats.length) return {errors: ['shot script has no beats'], warnings, stats: {beats: 0}, beats: []};

  const seen = new Set(), uses = new Map(), rows = [];
  let total = 0;
  const times = {text: 0, diagram: 0, media: 0};
  beats.forEach((b, i) => {
    const at = `beats[${i}]${b?.id ? ` (${b.id})` : ''}`;
    if (!b?.id || seen.has(b.id)) errors.push(`${at}: id is missing or repeated`);
    seen.add(b?.id);
    const narration = String(b?.narration ?? '').trim();
    if (!narration) { errors.push(`${at}: narration is empty`); return; }
    const seconds = estimateSeconds(narration);
    total += seconds;
    if (!RUNGS.includes(b.rung)) { errors.push(`${at}: rung must be one of ${RUNGS.join(', ')}`); return; }
    if (!MOVES.includes(b.move)) errors.push(`${at}: move must be one of ${MOVES.join(', ')}`);
    if (MOVES.includes(b.move)) {
      if (NEEDS_REGION.has(b.move) && !regionOk(b.region)) errors.push(`${at}: move ${b.move} needs region {x,y,w,h}, each 0..1, inside the picture (crop is only a note)`);
      if (b.move === 'pan' && !regionOk(b.regionEnd)) errors.push(`${at}: move pan needs regionEnd {x,y,w,h} as the view to pan to`);
      if (b.move === 'count' && !(b.figure && Array.isArray(b.figure.parts))) errors.push(`${at}: move count needs figure {parts:[{value}], label?, at}`);
      if (b.move === 'compare' && !b.materialB) errors.push(`${at}: move compare needs materialB, the second picture`);
      if (!MEDIA_RUNGS.has(b.rung) && b.move !== 'hold') warnings.push(`${at}: ${b.rung} beats do not use move ${b.move}; it is ignored`);
    }
    if (b.rung === 'text' && !(Array.isArray(b.onScreen) && b.onScreen.length >= 1 && b.onScreen.length <= 2)) errors.push(`${at}: text beat needs onScreen: one or two [{text, at}] lines`);
    if (b.materialB && inventory && !inventory.get(b.materialB)) errors.push(`${at}: materialB ${b.materialB} is not in the visual inventory`);
    if (!String(b.why ?? '').trim()) errors.push(`${at}: why is empty; say what this picture adds to the sentence`);
    else if (overlap(b.why, narration) >= 0.8) warnings.push(`${at}: why mostly repeats the narration; describe what the viewer sees instead`);
    if (b.rung === 'text') times.text += seconds; else if (b.rung === 'diagram') times.diagram += seconds; else times.media += seconds;

    if (MEDIA_RUNGS.has(b.rung)) {
      if (!b.material) errors.push(`${at}: rung ${b.rung} needs a material id from research/visual-inventory.json`);
      else {
        uses.set(b.material, [...(uses.get(b.material) ?? []), {at, key: `${b.move}|${b.crop ?? ''}`}]);
        if (inventory) {
          const item = inventory.get(b.material);
          if (!item) errors.push(`${at}: material ${b.material} is not in the visual inventory`);
          else {
            if (item.status === 'missing-file' || item.grade === 'X') errors.push(`${at}: material ${b.material} is unusable (${item.reasons?.[0] ?? item.grade})`);
            else if (item.grade === 'C') warnings.push(`${at}: material ${b.material} is grade C (filler); keep it short or swap it`);
            if (inventoryRung(item) !== b.rung && item.grade !== 'X') errors.push(`${at}: rung ${b.rung} does not match the material, which is a ${inventoryRung(item)}`);
            if (item.status === 'candidate') warnings.push(`${at}: material ${b.material} is not downloaded yet; needs the user's download approval`);
            if (item.rights === 'unknown') warnings.push(`${at}: material ${b.material} has no provenance record; label it before use`);
          }
        }
      }
    } else if (b.material) warnings.push(`${at}: rung ${b.rung} ignores material ${b.material}; use a media rung or drop it`);
    if (!MEDIA_RUNGS.has(b.rung) && !String(b.noMaterialReason ?? '').trim()) errors.push(`${at}: ${b.rung} beat needs noMaterialReason: why no picture from the inventory fits, or rewrite the sentence`);

    if (b.claimIds !== undefined) {
      if (!Array.isArray(b.claimIds)) errors.push(`${at}: claimIds must be a list`);
      else if (claimIds) for (const id of b.claimIds) if (!claimIds.has(id)) errors.push(`${at}: claim ${id} is not in research/claims.json`);
    } else if (/\d/.test(narration)) warnings.push(`${at}: narration has a number or date but no claimIds`);

    if (i === 0) {
      if (!MEDIA_RUNGS.has(b.rung)) errors.push(`${at}: the opening beat must show a real picture, not ${b.rung}`);
      if (seconds > L.firstBeatSeconds.fail) errors.push(`${at}: opening beat is ~${seconds.toFixed(1)} s; split it so the picture changes within ${L.firstBeatSeconds.pass} s`);
      else if (seconds > L.firstBeatSeconds.pass) warnings.push(`${at}: opening beat is ~${seconds.toFixed(1)} s; aim for ${L.firstBeatSeconds.pass} s or less before the first change`);
    }
    if (seconds > L.beatSeconds.fail && !(b.rung === 'video' || b.rung === 'recording')) errors.push(`${at}: ~${seconds.toFixed(1)} s on one still picture; split the beat`);
    else if (seconds > L.beatSeconds.pass) warnings.push(`${at}: ~${seconds.toFixed(1)} s in one beat; consider splitting it`);
    rows.push({id: b.id, rung: b.rung, move: b.move, material: b.material ?? null, seconds: Math.round(seconds * 10) / 10});
  });

  for (const [id, list] of uses) {
    if (list.length > L.maxUses) errors.push(`material ${id} is used in ${list.length} beats (limit ${L.maxUses}): ${list.map((u) => u.at).join(', ')}`);
    else if (list.length === 2 && list[0].key === list[1].key) warnings.push(`material ${id} is reused with the same move and crop at ${list.map((u) => u.at).join(' and ')}; vary the crop or move`);
  }
  let run = 1;
  for (let i = 1; i < rows.length; i++) {
    run = rows[i].rung === rows[i - 1].rung && rows[i].move === rows[i - 1].move ? run + 1 : 1;
    if (run === L.runLength) warnings.push(`beats ${rows[i - L.runLength + 1].id} to ${rows[i].id} repeat the same rung and move ${L.runLength} times in a row`);
  }
  // film layer: rhythm, transitions, hook line, music bed
  const R = L.rhythm, secs = rows.map((r) => r.seconds), mean = secs.reduce((a, c) => a + c, 0) / secs.length;
  const variation = Math.sqrt(secs.reduce((a, c) => a + (c - mean) ** 2, 0) / secs.length) / mean;
  if (rows.length >= R.minBeats && variation < R.minVariation) warnings.push(`every beat is about the same length (variation ${(variation * 100).toFixed(0)}%); mix quick beats of 1.6 to 3 s with one or two longer ones so the film breathes`);
  const flicker = rows.filter((r) => r.seconds < R.flicker);
  if (flicker.length) warnings.push(`beats under ${R.flicker} s are hard to read: ${flicker.map((r) => r.id).join(', ')}`);
  if (rows.length > 2 && rows[0].seconds > mean * R.openingRatio) warnings.push(`the opening beat (${rows[0].seconds.toFixed(1)} s) is slower than the average (${mean.toFixed(1)} s); open at least as fast as the film runs`);
  beats.forEach((b, i) => { if (b.transition !== undefined && !TRANSITIONS.includes(b.transition)) errors.push(`beats[${i}] (${b.id}): transition must be one of ${TRANSITIONS.join(', ')}`); });
  const plan = assignTransitions(beats, secs), types = plan.map((x) => x.type);
  for (const m of varietyFindings(types)) warnings.push(`${m}; set transition on a beat to choose, or leave it to the plan`);
  beats.forEach((b, i) => {
    if (b.layout !== undefined && !LAYOUTS.includes(b.layout)) errors.push(`beats[${i}] (${b.id}): layout must be one of ${LAYOUTS.join(', ')}`);
    if (b.layout === 'stack' && !b.materialB) errors.push(`beats[${i}] (${b.id}): layout stack needs materialB, the picture behind`);
  });
  if (script.hook === undefined) warnings.push('no hook: add hook {lines:[{text, at}]}, one or two short lines on screen in the first seconds (a number, a question or a claim)');
  else if (!Array.isArray(script.hook.lines) || script.hook.lines.length < 1 || script.hook.lines.length > L.hookLines) errors.push(`hook.lines must be 1 to ${L.hookLines} lines`);
  else script.hook.lines.forEach((l, i) => { if (!String(l.text ?? '').trim() || [...String(l.text)].length > L.hookChars) errors.push(`hook.lines[${i}].text must be 1 to ${L.hookChars} characters`); if (!Number.isFinite(l.at) || l.at < 0) errors.push(`hook.lines[${i}].at must be seconds from the start`); });
  if (!script.bgm) warnings.push('no music bed planned: add bgm {file, volume}');
  if (!script.title) warnings.push('no title: packaging and the cover use it');
  if (!script.publish) warnings.push('no publish copy yet: delivery needs publish.douyin and publish.channels, each with title, body and tags, written separately');

  const distinct = new Set(rows.filter((r) => r.material).map((r) => r.material)).size, wanted = Math.min(L.distinctMaterials, beats.length);
  if (distinct < wanted) warnings.push(`only ${distinct} distinct pictures across ${beats.length} beats (aim for ${wanted} or more)`);

  const share = {text: times.text / total, noMedia: (times.text + times.diagram) / total};
  if (share.text > L.textShare.fail) errors.push(`text-only beats take ${(share.text * 100).toFixed(0)}% of the film (limit ${L.textShare.fail * 100}%); rewrite those sentences around a picture`);
  else if (share.text > L.textShare.pass) warnings.push(`text-only beats take ${(share.text * 100).toFixed(0)}% (aim for ${L.textShare.pass * 100}% or less)`);
  if (share.noMedia > L.noMediaShare.fail) errors.push(`beats with no real picture take ${(share.noMedia * 100).toFixed(0)}% (limit ${L.noMediaShare.fail * 100}%)`);
  else if (share.noMedia > L.noMediaShare.pass) warnings.push(`beats with no real picture take ${(share.noMedia * 100).toFixed(0)}% (aim for ${L.noMediaShare.pass * 100}% or less)`);
  if (target && Math.abs(total - target) / target > 0.2) warnings.push(`estimated ${total.toFixed(0)} s is more than 20% from the ${target} s target`);

  return {errors, warnings, stats: {beats: beats.length, estimatedSeconds: Math.round(total), variation, textShare: share.text, noMediaShare: share.noMedia, distinctPictures: distinct}, beats: rows};
}

export const narrationText = (script) => script.beats.map((b) => String(b.narration ?? '').trim()).filter(Boolean).join('\n\n');

import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {commandFromEnv} from './bins.mjs';
import {lintCaptions} from './caption-style.mjs';
import {varietyFindings} from './transitions-plan.mjs';

// Review loop for shot films (references/quality-bar.md, layers 1 to 3). The rendered preview is measured with FFmpeg only: blank
// frames, stalled stretches, caption contrast, how soon the picture first changes, loudness, peak and silence. Measurements can
// refuse a film; they cannot approve it. Approval needs a frame review recorded against the film's hash.
export const SAMPLE = {fps: 2, w: 270, h: 480};
export const LIMITS = {
  blank: {dark: 6, light: 249},                 // mean luma 0..255 of a frame
  staticSeconds: {pass: 2.5, fail: 4},          // longest stretch with no visible change
  shotSeconds: {pass: 8, fail: 12},             // longest shot on the aligned timeline; footage may run longer
  staticDiff: 0.4,                              // mean absolute luma difference between samples counted as "no change"
  contrast: {pass: 3, fail: 2, share: 0.1},     // caption text (white) against its background; WCAG large-text 3:1
  changeDiff: 6,                                // a sample-to-sample difference above this is a picture change
  firstChange: {pass: 4.5, fail: 7},            // seconds until the picture first changes
  loudness: {low: -17.5, high: -11.5},          // integrated LUFS of the final mix
  peak: {warn: -1, fail: 0},                    // dBFS true peak
  silence: 1.5,                                 // seconds of near-silence that is reported
};
// Caption box at full size: x 190..890, y 1320..1490 of 1080x1920.
export const CAPTION_ZONE = {x0: 190 / 1080, x1: 890 / 1080, y0: 1320 / 1920, y1: 1490 / 1920};

const ff = (args, opts = {}) => spawnSync(commandFromEnv('ffmpeg'), ['-nostdin', '-hide_banner', ...args], {maxBuffer: 512 * 1024 * 1024, ...opts});

export const sha256File = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function extractGray(video, {fps, w, h} = SAMPLE) {
  const r = ff(['-v', 'error', '-i', video, '-vf', `fps=${fps},scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
  if (r.status !== 0) throw new Error(`could not read frames from ${video}: ${r.stderr?.toString().slice(0, 200)}`);
  const size = w * h, frames = [];
  for (let o = 0; o + size <= r.stdout.length; o += size) frames.push(r.stdout.subarray(o, o + size));
  return frames;
}

const median = (arr) => { const s = Float64Array.from(arr).sort(); return s.length ? s[s.length >> 1] : 0; };
export const contrastWhite = (luma) => 1.05 / (Math.pow(luma / 255, 2.2) + 0.05);

export function measureFrames(frames, {fps, w, h} = SAMPLE) {
  const zone = {x0: Math.floor(CAPTION_ZONE.x0 * w), x1: Math.ceil(CAPTION_ZONE.x1 * w), y0: Math.floor(CAPTION_ZONE.y0 * h), y1: Math.ceil(CAPTION_ZONE.y1 * h)};
  return frames.map((f, i) => {
    let sum = 0;
    for (let k = 0; k < f.length; k++) sum += f[k];
    let diff = 0;
    if (i > 0) { const p = frames[i - 1]; for (let k = 0; k < f.length; k++) diff += Math.abs(f[k] - p[k]); diff /= f.length; }
    const zoneLuma = [];
    for (let y = zone.y0; y < zone.y1; y++) for (let x = zone.x0; x < zone.x1; x++) zoneLuma.push(f[y * w + x]);
    return {t: i / fps, mean: sum / f.length, diff, captionLuma: median(zoneLuma)};
  });
}

export function audioStats(video) {
  const r = ff(['-i', video, '-af', 'ebur128=peak=true,silencedetect=noise=-50dB:d=' + LIMITS.silence, '-f', 'null', '-'], {encoding: 'utf8'});
  const text = r.stderr ?? '';
  const summary = text.slice(text.lastIndexOf('Summary:'));
  const num = (re) => { const m = re.exec(summary); return m ? Number(m[1]) : null; };
  const silences = [...text.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_duration: ([\d.]+)/g)].map((m) => ({at: Number(m[1]), seconds: Number(m[2])}));
  const hasAudio = /Stream #\d+:\d+.*Audio/.test(text) || /Summary:/.test(text);
  return {hasAudio, lufs: num(/\n\s*I:\s*(-?[\d.]+)\s*LUFS/), peak: num(/Peak:\s*(-?[\d.]+)\s*dBFS/), silences};
}

export function evaluate({measures, audio, film, fps = SAMPLE.fps}) {
  const L = LIMITS, checks = [];
  const add = (id, label, status, shown, rule) => checks.push({id, label, status, shown, rule});
  const blank = measures.filter((m) => m.mean < L.blank.dark || m.mean > L.blank.light);
  add('blank', 'Blank frames', blank.length ? 'fail' : 'pass', blank.length ? `${blank.length} at ${blank.slice(0, 4).map((m) => m.t.toFixed(1) + ' s').join(', ')}` : 'none', 'no black or white frame');

  let run = 0, best = 0, bestAt = 0;
  measures.forEach((m, i) => { if (i > 0 && m.diff < L.staticDiff) { run++; if (run > best) { best = run; bestAt = m.t - (run - 1) / fps; } } else run = 0; });
  const staticS = best / fps;
  add('static', 'Longest stretch with no visible change', staticS >= L.staticSeconds.fail ? 'fail' : staticS >= L.staticSeconds.pass ? 'warn' : 'pass', `${staticS.toFixed(1)} s${staticS ? ` from ${bestAt.toFixed(1)} s` : ''}`, `pass < ${L.staticSeconds.pass} s, fail ≥ ${L.staticSeconds.fail} s`);

  const long = (film?.shots ?? []).filter((s) => s.rung !== 'video' && s.rung !== 'recording').map((s) => ({id: s.id, seconds: s.end - s.start})).sort((a, b) => b.seconds - a.seconds)[0];
  if (long) add('shotLength', 'Longest still shot on the aligned timeline', long.seconds > L.shotSeconds.fail ? 'fail' : long.seconds > L.shotSeconds.pass ? 'warn' : 'pass', `${long.seconds.toFixed(1)} s (${long.id})`, `pass ≤ ${L.shotSeconds.pass} s, fail > ${L.shotSeconds.fail} s`);

  if (film?.shots?.length > 2 && film.shots.every((s) => s.transition !== undefined)) {
    const types = film.shots.map((s) => s.transition), found = varietyFindings(types), kinds = new Set(types.slice(1).filter((t) => t !== 'cut'));
    add('entryVariety', 'Entry effect variety', found.some((m) => /three times/.test(m)) ? 'fail' : found.length ? 'warn' : 'pass', `${kinds.size} moving kind(s) in ${film.shots.length} shots${found.length ? `: ${found[0]}` : ''}`, 'at least 3 moving kinds from 10 shots, none three times in a row, at most 40% moving');
  }

  const caps = film?.captions ?? [];
  const onCaption = measures.filter((m) => caps.some((c) => m.t >= c.start + 0.3 && m.t <= c.end - 0.1));
  if (onCaption.length) {
    const ratios = onCaption.map((m) => contrastWhite(m.captionLuma)), low = onCaption.filter((m, i) => ratios[i] < L.contrast.pass);
    const worst = Math.min(...ratios), share = low.length / onCaption.length;
    add('contrast', 'Caption contrast (white text on its background)', worst < L.contrast.fail && share > L.contrast.share ? 'fail' : share > L.contrast.share ? 'warn' : 'pass',
      `worst ${worst.toFixed(1)}:1, ${(share * 100).toFixed(0)}% of caption time under ${L.contrast.pass}:1${low.length ? ` (e.g. ${low.slice(0, 3).map((m) => m.t.toFixed(1) + ' s').join(', ')})` : ''}`, `pass: at most ${L.contrast.share * 100}% of caption time under ${L.contrast.pass}:1`);
  }

  if (film?.captions?.length) {
    const lint = lintCaptions(film.captions), first = lint.fails[0];
    add('captionStyle', lint.fails.length ? 'fail' : lint.warns.length ? 'warn' : 'pass',
      lint.fails.length ? `${lint.fails.length} violation(s), first at ${first.start.toFixed(1)} s: ${first.msg}` : lint.warns.length ? `${lint.warns.length} warning(s), first: ${lint.warns[0].msg}` : `${lint.count} captions follow the standard`,
      'Netflix Simplified Chinese rules as adapted in references/caption-standard.md');
  }

  const firstIdx = measures.findIndex((m, i) => i > 0 && m.t >= 0.4 && m.diff > L.changeDiff);
  const first = firstIdx < 0 ? Infinity : measures[firstIdx].t;
  add('firstChange', 'First visible picture change', first > L.firstChange.fail ? 'fail' : first > L.firstChange.pass ? 'warn' : 'pass', Number.isFinite(first) ? `${first.toFixed(1)} s` : 'none', `pass ≤ ${L.firstChange.pass} s, fail > ${L.firstChange.fail} s`);

  if (audio) {
    if (audio.lufs == null) add('loudness', 'Integrated loudness', 'warn', 'no audio measured', `${L.loudness.low} to ${L.loudness.high} LUFS`);
    else add('loudness', 'Integrated loudness', audio.lufs < L.loudness.low || audio.lufs > L.loudness.high ? 'warn' : 'pass', `${audio.lufs.toFixed(1)} LUFS`, `pass ${L.loudness.low} to ${L.loudness.high} LUFS`);
    if (audio.peak != null) add('peak', 'True peak', audio.peak > L.peak.fail ? 'fail' : audio.peak > L.peak.warn ? 'warn' : 'pass', `${audio.peak.toFixed(1)} dBFS`, `pass ≤ ${L.peak.warn}, fail > ${L.peak.fail} dBFS`);
    add('silence', `Silence over ${L.silence} s`, audio.silences.length ? 'warn' : 'pass', audio.silences.length ? audio.silences.map((s) => `${s.at.toFixed(1)} s for ${s.seconds.toFixed(1)} s`).join(', ') : 'none', 'none');
  }
  return checks;
}

// Frame review: a record written after actually looking at the contact sheets, bound to the film's hash. Five judgements per shot.
export const JUDGEMENTS = ['focal', 'textShare', 'relevance', 'variety', 'safeArea'];
export const STATUSES = ['passed', 'needs-fix', 'not-performed'];

export function reviewTemplate(film, hash) {
  const blank = () => Object.fromEntries(JUDGEMENTS.map((j) => [j, {status: 'not-performed', notes: ''}]));
  return {filmSha256: hash, reviewer: '', summary: '', shots: film.shots.map((s) => ({id: s.id, at: `${s.start.toFixed(1)}-${s.end.toFixed(1)} s`, ...blank()}))};
}

export function checkRecord(record, film, hash) {
  const problems = [];
  if (!record) return {state: 'missing', problems: ['no frame review recorded']};
  if (record.filmSha256 !== hash) return {state: 'stale', problems: ['the film changed after this review']};
  if (!String(record.reviewer ?? '').trim()) problems.push('reviewer is empty');
  const byId = new Map((record.shots ?? []).map((s) => [s.id, s]));
  let needsFix = 0, pending = 0;
  for (const s of film.shots) {
    const r = byId.get(s.id);
    if (!r) { problems.push(`shot ${s.id} has no review row`); pending++; continue; }
    for (const j of JUDGEMENTS) {
      const v = r[j];
      if (!v || !STATUSES.includes(v.status)) { problems.push(`${s.id}.${j}: status must be one of ${STATUSES.join(', ')}`); pending++; continue; }
      if (v.status === 'not-performed') pending++;
      else if (!String(v.notes ?? '').trim()) problems.push(`${s.id}.${j}: say what was actually seen`);
      if (v.status === 'needs-fix') { needsFix++; problems.push(`${s.id}.${j} needs a fix: ${v.notes}`); }
    }
  }
  return {state: needsFix ? 'needs-fix' : pending || problems.length ? 'incomplete' : 'passed', problems, needsFix, pending};
}

export function verdict(checks, recordState) {
  const failed = checks.filter((c) => c.status === 'fail').map((c) => c.id);
  if (failed.length) return {state: 'needs-fix', why: `measurement failed: ${failed.join(', ')}`};
  if (recordState.state === 'needs-fix') return {state: 'needs-fix', why: `frame review found ${recordState.needsFix} issue(s)`};
  if (recordState.state === 'passed') return {state: 'ready-for-user', why: 'measurements pass and the frame review is recorded and current'};
  return {state: 'review-pending', why: recordState.state === 'stale' ? 'frame review is out of date' : recordState.state === 'missing' ? 'frame review not yet recorded' : 'frame review is incomplete'};
}

// 1 fps contact sheets: eight tiles per row, 24 seconds per sheet, chronological.
export function contactSheets(video, outDir, seconds, {cols = 8, perSheet = 24, tileW = 180} = {}) {
  fs.mkdirSync(outDir, {recursive: true});
  const sheets = [];
  for (let start = 0, n = 1; start < seconds; start += perSheet, n++) {
    const file = path.join(outDir, `contact-${String(n).padStart(2, '0')}.png`), rows = Math.ceil(Math.min(perSheet, seconds - start) / cols);
    const r = ff(['-v', 'error', '-y', '-ss', String(start), '-t', String(perSheet), '-i', video, '-vf', `fps=1,scale=${tileW}:-1,tile=${cols}x${rows}`, '-frames:v', '1', file]);
    if (r.status === 0 && fs.existsSync(file)) sheets.push({file, from: start, to: Math.min(start + perSheet, Math.ceil(seconds)), cols});
  }
  return sheets;
}

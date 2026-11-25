// Caption standard for burned-in Chinese captions (references/caption-standard.md). Built on Netflix's Simplified Chinese (PRC)
// Timed Text Style Guide and its subtitle timing guidelines, adapted to a 1080 px vertical frame where the safe caption width is
// 700 px. Rule numbers (§) below are the Chinese guide's.
//   §1  16 characters per line         -> MAX_UNITS 14 here: 700 px at 50 px type fits 14 full-width characters
//   §10 one line unless it will not fit, two at most -> one line, always; a longer sentence becomes several caption events
//   §12 no commas or periods, one space instead; no punctuation at the end of a caption; question marks kept; full-width ？ ！ ：;
//       enumeration comma 、 allowed inside a list but never at the end; ellipsis is U+2026; never "!?" "??" "!!"
//   §13 full-width quotation marks
//   §11 half-width Arabic numerals, no comma inside four-digit numbers, never mixed with Chinese numerals
//   §14 reading speed up to 9 characters per second (adult programmes)
//   timing: at least 20 frames at 24 fps (0.83 s); gaps of 3 to 11 frames at 24 fps are closed to 2 frames (0.07 s)
export const MAX_UNITS = 14;
export const FONT_PX = 50;
export const BOX_PX = 700;
export const LIMITS = {maxCps: 9, minSeconds: 20 / 24, closeGapBelow: 0.5, gapSeconds: 2 / 30, tailSeconds: 0.5};

const CJK = /[　-〿一-鿿＀-￯]/;
// Visual width in full-width units: a Han character is 1, a Latin letter or digit about .55, a space .3.
export const units = (text) => [...String(text)].reduce((a, ch) => a + (CJK.test(ch) ? 1 : /\s/.test(ch) ? 0.3 : 0.55), 0);
// Characters counted for reading speed: everything except spaces and punctuation.
export const speechChars = (text) => [...String(text)].filter((ch) => !/[\s，。；：、！？…“”‘’（）,.;:!?"'()—-]/.test(ch)).length;

export function formatCaption(text) {
  let t = String(text).trim();
  t = t.replace(/\.{3}|。{2,}|…{2,}/g, '…').replace(/[?？]+!+|!+[?？]+/g, '？').replace(/[!！]{2,}/g, '！').replace(/[?？]{2,}/g, '？');
  t = t.replace(/\?/g, '？').replace(/!/g, '！');
  t = t.replace(/(?<!\d):(?!\d)/g, '：');
  t = t.replace(/"([^"]*)"/g, '“$1”');
  t = t.replace(/[，。；]/g, ' ').replace(/(?<!\d)[,.;](?!\d)/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/[、，。；：,.;:\s]+$/, '').replace(/^[、，。；,.;\s]+/, '');
  return t;
}

// Break a text into pieces that each fit one line. Splits first at clause punctuation, then inside a clause at the point
// nearest its middle that does not cut a Latin word or a number; merges neighbours that are short enough to share a line.

// Where a caption may be cut without breaking a phrase: after clause punctuation or an enumeration comma, after an aspect or
// modal particle, before a preposition, conjunction or demonstrative, or at a Latin/Han boundary. Anything else is a last resort.
const AFTER = /[，、；：的了着过吗呢吧啊里上中]/;
const BEFORE = /[在和与及并而但或还也再就都把被让给从向对用于替帮这那]/;
const betweenLatin = (chars, i) => {
  let a = i - 1, b = i;
  while (a >= 0 && /[\s、，；：]/.test(chars[a])) a--;
  while (b < chars.length && /[\s、，；：]/.test(chars[b])) b++;
  return a >= 0 && b < chars.length && /[A-Za-z0-9]/.test(chars[a]) && /[A-Za-z0-9]/.test(chars[b]);
};
const isNatural = (chars, i) => {
  const a = chars[i - 1], b = chars[i];
  return AFTER.test(a) || BEFORE.test(b) || (/[A-Za-z0-9]/.test(a) !== /[A-Za-z0-9]/.test(b));
};

export function splitForLines(text, max = MAX_UNITS) {
  const clauses = String(text).split(/(?<=[。！？；，：!?;])/).map((s) => s.trim()).filter(Boolean);
  const pieces = [];
  const fit = (s) => units(formatCaption(s)) <= max;
  const cut = (s) => {
    if (fit(s)) return [s];
    const chars = [...s];
    // a cut may only fall on a word boundary (so 朋友 is never split) and never inside a Latin word or a number
    const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh', {granularity: 'word'}) : null;
    const bounds = new Set();
    if (seg) { let at = 0; for (const part of seg.segment(s)) { at += [...part.segment].length; bounds.add(at); } }
    const ok = (i) => { const a = chars[i - 1], b = chars[i]; return !(/[A-Za-z0-9]/.test(a) && /[A-Za-z0-9]/.test(b)) && !betweenLatin(chars, i) && (!seg || bounds.has(i)); };
    let best = -1, bestScore = Infinity;
    for (let i = 2; i < chars.length - 1; i++) {
      if (!ok(i)) continue;
      const l = chars.slice(0, i).join(''), r = chars.slice(i).join('');
      const over = Math.max(units(formatCaption(l)), units(formatCaption(r)));
      const score = Math.abs(units(formatCaption(l)) - units(formatCaption(r))) * 0.35 + Math.max(0, over - max) * 10 + (isNatural(chars, i) ? 0 : 6);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) return [s];
    return [...cut(chars.slice(0, best).join('')), ...cut(chars.slice(best).join(''))];
  };
  for (const c of clauses) pieces.push(...cut(c));
  const out = [];
  for (const p of pieces) {
    const prev = out.at(-1);
    if (prev && (units(formatCaption(prev)) < 5 || units(formatCaption(p)) < 5) && units(formatCaption(`${prev} ${p}`)) <= max) out[out.length - 1] = `${prev} ${p}`; else out.push(p);
  }
  // A caption under about 6 units is gone before it can be read (the minimum is 20 frames): re-cut it together with its neighbour at
  // the most balanced word boundary instead of leaving a tail.
  const seg2 = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh', {granularity: 'word'}) : null;
  const recut = (a, b) => {
    const joined = `${a} ${b}`.trim(), chars = [...joined];
    const bounds = new Set(); if (seg2) { let at = 0; for (const part of seg2.segment(joined)) { at += [...part.segment].length; bounds.add(at); } }
    let best = -1, gap = Infinity;
    for (let i = 2; i < chars.length - 1; i++) {
      if ((seg2 && !bounds.has(i)) || (/[A-Za-z0-9]/.test(chars[i - 1]) && /[A-Za-z0-9]/.test(chars[i])) || betweenLatin(chars, i)) continue;
      const l = units(formatCaption(chars.slice(0, i).join(''))), r = units(formatCaption(chars.slice(i).join('')));
      if (l > max || r > max) continue;
      // a cut right after a clause comma reads better than the most even one inside a phrase
      const d = Math.abs(l - r) - (/[，、；：]/.test(chars[i - 1]) ? 3 : 0) + (isNatural(chars, i) ? 0 : 6); if (d < gap) { gap = d; best = i; }
    }
    return best < 0 ? null : [chars.slice(0, best).join('').trim(), chars.slice(best).join('').trim()];
  };
  for (let i = out.length - 1; i > 0; i--) {
    if (units(formatCaption(out[i])) < 6 && units(formatCaption(out[i - 1])) + units(formatCaption(out[i])) > max) {
      const r = recut(out[i - 1], out[i]);
      if (r && units(formatCaption(r[1])) >= 6) { out[i - 1] = r[0]; out[i] = r[1]; }
    }
  }
  return out;
}

export function lintCaption(c, {fps = 30} = {}) {
  const issues = [], t = String(c.text);
  const w = units(t);
  if (w > MAX_UNITS + 1e-9) issues.push({rule: '§1/§10', level: 'fail', msg: `${w.toFixed(1)} units on one line, the limit is ${MAX_UNITS}`});
  if (/[，。；,;]/.test(t) || /\.(?=\s|$)/.test(t)) issues.push({rule: '§12', level: 'fail', msg: 'comma or full stop inside the caption; use one space'});
  if (/[、，。；：,.;:]$/.test(t.trim())) issues.push({rule: '§12', level: 'fail', msg: 'punctuation at the end of the caption'});
  if (/^[、，。；：]/.test(t.trim())) issues.push({rule: '§12', level: 'fail', msg: 'punctuation at the start of the caption'});
  if (/[?!]/.test(t)) issues.push({rule: '§12', level: 'fail', msg: 'half-width ? or !; use ？ ！'});
  if (/[?？！!]{2,}|[?？][!！]|[!！][?？]/.test(t)) issues.push({rule: '§12', level: 'fail', msg: 'combined question and exclamation marks'});
  if (/\.{3}/.test(t)) issues.push({rule: '§12', level: 'fail', msg: 'three dots; use …'});
  if (/[０-９]/.test(t)) issues.push({rule: '§11', level: 'fail', msg: 'full-width digits'});
  if (/(?<!\d)\d,\d{3}(?![\d,])/.test(t)) issues.push({rule: '§11', level: 'fail', msg: 'comma inside a four-digit number'});
  if (/\d+[一二三四五六七八九十]|[一二三四五六七八九十]\d+/.test(t)) issues.push({rule: '§11', level: 'warn', msg: 'Arabic and Chinese numerals mixed'});
  if (/\n/.test(t)) issues.push({rule: '§10', level: 'fail', msg: 'line break; captions are one line'});
  const dur = c.end - c.start;
  if (dur + 1e-9 < LIMITS.minSeconds) issues.push({rule: 'timing', level: 'warn', msg: `${dur.toFixed(2)} s is under the ${LIMITS.minSeconds.toFixed(2)} s minimum`});
  const cps = speechChars(t) / Math.max(dur, 1e-6);
  if (cps > LIMITS.maxCps) issues.push({rule: '§14', level: 'warn', msg: `${cps.toFixed(1)} characters per second, the limit is ${LIMITS.maxCps}`});
  return issues;
}

export function lintCaptions(captions, opts = {}) {
  const rows = captions.map((c, i) => ({i, text: c.text, start: c.start, issues: lintCaption(c, opts)}));
  const fails = rows.flatMap((r) => r.issues.filter((x) => x.level === 'fail').map((x) => ({...x, i: r.i, text: r.text, start: r.start})));
  const warns = rows.flatMap((r) => r.issues.filter((x) => x.level === 'warn').map((x) => ({...x, i: r.i, text: r.text, start: r.start})));
  const gaps = [];
  for (let i = 1; i < captions.length; i++) { const g = captions[i].start - captions[i - 1].end; if (g > 0.01 && g < LIMITS.closeGapBelow - 1e-9 && g > LIMITS.gapSeconds + 1e-3) gaps.push({i, gap: g}); }
  return {fails, warns, gaps, count: captions.length};
}

// Display captions from timed phrase captions: standard text, short gaps closed to two frames, minimum duration, tail after the audio.
export function styleCaptions(captions, {fps = 30, endAt} = {}) {
  const out = captions.map((c) => ({start: c.start, end: c.end, text: formatCaption(c.text)})).filter((c) => c.text);
  for (let i = 0; i < out.length - 1; i++) {
    const gap = out[i + 1].start - out[i].end;
    if (gap > 0 && gap < LIMITS.closeGapBelow) out[i].end = Math.max(out[i].end, out[i + 1].start - LIMITS.gapSeconds);
  }
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1]?.start ?? Infinity, want = out[i].start + LIMITS.minSeconds;
    if (out[i].end < want) out[i].end = Math.min(want, next - LIMITS.gapSeconds);
  }
  if (out.length && endAt !== undefined) out[out.length - 1].end = Math.min(Math.max(out.at(-1).end, out.at(-1).end + LIMITS.tailSeconds), endAt);
  return out.map((c) => ({...c, start: Math.floor(c.start * 1000) / 1000, end: Math.ceil(c.end * 1000) / 1000}));
}

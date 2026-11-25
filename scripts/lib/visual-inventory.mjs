import fs from 'node:fs';
import path from 'node:path';
import {classifyCandidate} from './research-coverage.mjs';
import {inspectAsset, mediaKind} from './media-assets.mjs';

// Visual inventory: what picture material a topic's research actually yields, graded for a 1080x1920 film.
// Grades: A = strong on its own, B = usable with crop/motion/overlay, C = weak (fillers only), X = not usable as picture.
// Candidates that are not downloaded have no pixel size, so they are graded from their kind and surrounding text and are
// never better than B. Rating thresholds are the contract in references/quality-bar.md; change both together.
export const LIMITS = {
  rich: {usable: 8, needsMoving: true},
  medium: {usable: 4},
  // image short side in pixels: A, B, C (below C is X)
  imageSide: {A: 1080, B: 720, C: 400},
  videoSide: {A: 720, B: 480},
  minVideoSeconds: 2,
  candidateWeight: 0.5,
};

const NOISE = /logo|icon|sprite|avatar|favicon|badge|pixel|tracking|spacer|arrow|emoji|flag|share|social|placeholder|loading|\bnav\b|banner-ad/i;
const SUBJECT = /\b(hero|products?|screenshots?|screens?|demos?|features?|interface|ui|apps?|devices?|photos?|keynote|launch|press)\b/i;

const pathOf = (url) => { try {return decodeURIComponent(new URL(url).pathname).replace(/[_\-./]+/g, ' ');} catch {return String(url);} };
// One picture served in several sizes (small, large, 2x) is one picture: group by the URL without its size words.
export const familyKey = (url) => {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/([_\-@])(small|medium|large|xlarge|xxlarge|mobile|tablet|desktop|thumb|thumbnail|preview|\d{2,4}w|\d{2,4}x\d{2,4})(?=[_\-@.])/gi, '').replace(/([_\-@])2x(?=\.)/gi, '');
  } catch {return url;}
};
const sizeRank = (url) => (/xlarge|xxlarge/i.test(url) ? 4 : /large/i.test(url) ? 3 : /medium|desktop/i.test(url) ? 2 : /small|mobile|thumb/i.test(url) ? 1 : 2) * 2 + (/2x/i.test(url) ? 1 : 0);

const side = (a) => Math.min(a.width || 0, a.height || 0);
const rank = {A: 3, B: 2, C: 1, X: 0};
export const better = (grade, cap) => (rank[grade] > rank[cap] ? cap : grade);

export function gradeCandidate(c) {
  const kind = classifyCandidate(c), text = `${pathOf(c.url)} ${c.alt ?? ''} ${c.context ?? ''}`;
  if (/\.(svg|ico)(?:[?#]|$)/i.test(c.url)) return {kind, grade: 'X', reasons: ['vector or icon file']};
  if (NOISE.test(text) && !SUBJECT.test(text)) return {kind, grade: 'X', reasons: ['looks like a logo, icon or interface chrome']};
  if (kind === 'direct-video') return {kind, grade: 'B', reasons: ['official video file, size unknown until downloaded']};
  if (kind === 'hls-playlist') return {kind, grade: 'B', reasons: ['video stream, needs explicit acquisition']};
  if (kind === 'embedded-player') return {kind, grade: 'B', reasons: ['embedded player, needs an authorised extraction route']};
  if (kind === 'image') return SUBJECT.test(text)
    ? {kind, grade: 'B', reasons: ['image described as product, interface or demo; size unknown until downloaded']}
    : {kind, grade: 'C', reasons: ['image without a clear subject; size unknown until downloaded']};
  return {kind, grade: 'C', reasons: ['unclassified media link']};
}

export function gradeFile(info, {tag, acquisition} = {}) {
  const L = LIMITS;
  if (tag === 'page-capture' || /screenshot/i.test(acquisition ?? '')) {
    return {grade: 'C', reasons: ['desktop page screenshot: small text on a phone, use as context or zoom into one region']};
  }
  if (info.kind === 'video') {
    const s = side(info), reasons = [`${info.width}x${info.height}, ${(info.duration ?? 0).toFixed(1)} s`];
    if ((info.duration ?? 0) < L.minVideoSeconds) return {grade: 'C', reasons: [...reasons, 'shorter than the 2 s minimum visible time']};
    if (/scroll-recording/i.test(acquisition ?? '')) return {grade: s >= L.videoSide.A ? 'B' : 'C', reasons: [...reasons, 'recorded page scroll: real page, restrained motion']};
    return {grade: s >= L.videoSide.A ? 'A' : s >= L.videoSide.B ? 'B' : 'C', reasons};
  }
  if (info.kind === 'image') {
    const s = side(info), reasons = [`${info.width}x${info.height}`];
    if (s >= L.imageSide.A) return {grade: 'A', reasons};
    if (s >= L.imageSide.B) return {grade: 'B', reasons};
    if (s >= L.imageSide.C) return {grade: 'C', reasons: [...reasons, 'low resolution, will soften when enlarged']};
    return {grade: 'X', reasons: [...reasons, 'too small for a 1080 wide frame']};
  }
  return {grade: 'X', reasons: ['not a picture']};
}

const officialHost = (url, domains = []) => {
  try {const h = new URL(url).hostname; return domains.some((d) => h === d || h.endsWith(`.${d}`));} catch {return false;}
};
const readJson = (file, fallback) => { try {return JSON.parse(fs.readFileSync(file, 'utf8'));} catch {return fallback;} };

export function buildInventory(job) {
  const registry = readJson(path.join(job, 'research/sources.json'), {sources: []});
  const record = readJson(path.join(job, 'research/downloads.json'), {downloads: []});
  const items = [], acquiredIds = new Set(), recordedFiles = new Set();

  for (const d of record.downloads) {
    acquiredIds.add(`${d.sourceId}|${d.mediaId}`);
    const src = registry.sources.find((s) => s.id === d.sourceId);
    const cand = src?.mediaCandidates.find((m) => m.id === d.mediaId);
    const file = path.join(job, d.file);
    let info = {kind: d.kind, width: d.width, height: d.height, duration: d.duration};
    if (!fs.existsSync(file)) {
      items.push({id: d.mediaId, status: 'missing-file', origin: 'official', sourceId: d.sourceId, file: d.file, kind: d.kind, grade: 'X', reasons: ['recorded download is missing on disk'], rights: d.rightsNote ? 'noted' : 'unreviewed'});
      continue;
    }
    recordedFiles.add(path.resolve(file));
    const g = gradeFile(info, {tag: cand?.tag, acquisition: d.acquisition});
    items.push({id: d.mediaId, status: 'on-disk', origin: officialHost(d.finalUrl ?? d.candidateUrl, src?.officialDomains) ? 'official' : 'recorded-source', sourceId: d.sourceId,
      file: d.file, kind: d.kind, width: d.width, height: d.height, duration: d.duration ?? null, moving: d.kind === 'video',
      relevance: d.relevanceReason, rights: d.rightsNote && !/unreviewed/i.test(d.rightsNote) ? 'noted' : 'unreviewed', acquisition: d.acquisition ?? 'direct-download', ...g});
  }

  const families = new Map();
  for (const s of registry.sources) for (const c of s.mediaCandidates) {
    if (acquiredIds.has(`${s.id}|${c.id}`)) continue;
    const g = gradeCandidate(c), key = g.kind === 'image' ? familyKey(c.url) : c.url;
    const item = {id: c.id, status: 'candidate', origin: 'official', sourceId: s.id, url: c.url, kind: g.kind, moving: ['direct-video', 'hls-playlist', 'embedded-player'].includes(g.kind),
      context: c.context ?? c.alt ?? '', rights: 'unreviewed', grade: g.grade, reasons: g.reasons, variants: 1};
    const seen = families.get(key);
    if (!seen) { families.set(key, item); continue; }
    seen.variants++;
    if (sizeRank(c.url) > sizeRank(seen.url)) Object.assign(seen, {id: c.id, url: c.url});   // keep the largest rendition
    if (rank[g.grade] > rank[seen.grade]) { seen.grade = g.grade; seen.reasons = g.reasons; }
  }
  items.push(...families.values());

  // Files in assets/ that no download record explains (user-supplied or generated): kept visible, with unknown rights.
  const dir = path.join(job, 'assets');
  const walk = (d, depth) => {
    if (!fs.existsSync(d) || depth > 2) return;
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'official') walk(f, depth + 1); continue; }
      if (!e.isFile() || recordedFiles.has(path.resolve(f)) || !['image', 'video'].includes(mediaKind(f) ?? '')) continue;
      try {
        const info = inspectAsset(f, job), g = gradeFile(info);
        items.push({id: `local-${path.relative(job, f)}`, status: 'on-disk', origin: 'local-unrecorded', file: path.relative(job, f), kind: info.kind, width: info.width, height: info.height,
          duration: info.duration, moving: info.kind === 'video', rights: 'unknown', ...g, reasons: [...g.reasons, 'no provenance record: not evidence, label before use']});
      } catch { /* unreadable file is simply not inventoried */ }
    }
  };
  walk(dir, 0);
  return items;
}

export function rate(items) {
  const L = LIMITS, usable = (i) => ['A', 'B'].includes(i.grade) && i.status !== 'missing-file';
  const ready = items.filter((i) => i.status === 'on-disk' && usable(i)), potential = items.filter((i) => i.status === 'candidate' && usable(i));
  const all = [...ready, ...potential], moving = all.filter((i) => i.moving).length;
  // A candidate has no known pixel size and no download approval yet, so it counts half.
  const weighted = ready.length + L.candidateWeight * potential.length;
  const rating = weighted >= L.rich.usable && moving >= 1 ? 'rich' : weighted >= L.medium.usable ? 'medium' : 'poor';
  const note = {
    rich: 'Enough usable pictures to build the film from material. Candidates still need explicit download approval.',
    medium: 'Borderline: reuse each picture with a different crop or motion, and plan diagrams for the rest. Say so before writing the script.',
    poor: 'Too little usable picture material. Tell the user before writing the script: add material, widen the research to other official pages, record the page, or change the angle. Do not fill with text cards.',
  }[rating];
  return {rating, weighted, ready: ready.length, potential: potential.length, usable: all.length, moving, unusable: items.filter((i) => !usable(i)).length, note};
}

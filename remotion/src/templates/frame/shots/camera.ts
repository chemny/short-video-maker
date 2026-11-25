// Camera grammar for real pictures (references/shot-script.md): a move is a function from progress to a view of the picture.
// Pure functions, no React: every value depends only on the shot's fields and the progress, so a frame always renders the same.
export type Region = {x: number; y: number; w: number; h: number};            // normalised 0..1 in the picture
export type Fit = 'cover' | 'contain';
export const MOVES = ['push', 'pull', 'pan', 'focus', 'highlight', 'compare', 'count', 'cursor', 'hold'] as const;
export type Move = (typeof MOVES)[number];
export type CameraShot = {move: Move; mw: number; mh: number; region?: Region; regionEnd?: Region; fit?: Fit};
export type View = {cx: number; cy: number; z: number; ax: number; ay: number};

export const FRAME = {w: 1080, h: 1920};
export const HOME = {x: 540, y: 960};              // where the middle of the picture sits when nothing is focused
export const ANCHOR = {x: 540, y: 860};            // where a focused region is centred: inside the safe band, above the caption
export const FIT_BOX = {w: 936, h: 960};           // a focused region is scaled to fill this box
export const PUSH = 1.16;
export const Z_MAX = 4;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (t: number, a: number, b: number) => a + (b - a) * t;
export const ease = (t: number) => { const x = clamp(t, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const centre = (r: Region) => ({x: r.x + r.w / 2, y: r.y + r.h / 2});

// Landscape pictures would show only a thin slice of a portrait frame when covering it, so they are fitted to the width instead.
export const fitFor = (mw: number, mh: number): Fit => (mw / mh <= 0.75 ? 'cover' : 'contain');
export const baseScale = (mw: number, mh: number, fit: Fit = fitFor(mw, mh)) => (fit === 'cover' ? Math.max(FRAME.w / mw, FRAME.h / mh) : (FRAME.w * 1.0) / mw);
export const zoomFor = (r: Region, mw: number, mh: number, fit?: Fit) => {
  const s = baseScale(mw, mh, fit);
  return clamp(Math.min(FIT_BOX.w / (r.w * mw * s), FIT_BOX.h / (r.h * mh * s)), 1, Z_MAX);
};

export function viewAt(shot: CameraShot, progress: number): View {
  const {move, mw, mh, region, regionEnd, fit} = shot, p = clamp(progress, 0, 1), e = ease(p), mid = {x: 0.5, y: 0.5};
  const home: View = {cx: 0.5, cy: 0.5, z: 1, ax: HOME.x, ay: HOME.y};
  switch (move) {
    case 'push': { const t = region ? centre(region) : mid; return {cx: lerp(e, 0.5, t.x), cy: lerp(e, 0.5, t.y), z: lerp(e, 1, PUSH), ax: HOME.x, ay: HOME.y}; }
    case 'pull': { const t = region ? centre(region) : mid; return {cx: lerp(e, t.x, 0.5), cy: lerp(e, t.y, 0.5), z: lerp(e, PUSH + 0.04, 1), ax: HOME.x, ay: HOME.y}; }
    case 'pan': {
      if (!region || !regionEnd) return home;
      const a = centre(region), b = centre(regionEnd), z = Math.max(1.15, zoomFor(region, mw, mh, fit), zoomFor(regionEnd, mw, mh, fit));
      return {cx: lerp(e, a.x, b.x), cy: lerp(e, a.y, b.y), z, ax: ANCHOR.x, ay: ANCHOR.y};
    }
    case 'focus': case 'highlight': case 'cursor': {
      if (!region) return home;
      const zf = zoomFor(region, mw, mh, fit), target = move === 'highlight' ? Math.min(zf, 1.4) : zf, q = easeOut(p / 0.45), t = centre(region);
      return {cx: lerp(q, 0.5, t.x), cy: lerp(q, 0.5, t.y), z: lerp(q, 1, target) * (1 + 0.08 * p), ax: ANCHOR.x, ay: lerp(q, HOME.y, ANCHOR.y)};
    }
    default: return home;   // hold, count and compare keep the picture still; count and compare draw on top of it
  }
}

// Where the picture sits in the 1080x1920 frame for a view. A picture larger than the frame never exposes an edge; a smaller one stays inside it.
export function placement(view: View, mw: number, mh: number, fit?: Fit, shift = {x: 0, y: 0}) {
  const s = baseScale(mw, mh, fit) * view.z, width = mw * s, height = mh * s;
  // a picture larger than the frame follows the focus without exposing an edge; a smaller one is centred, so the blurred backdrop is split evenly
  const axis = (anchor: number, c: number, size: number, frame: number, by: number) => (size >= frame ? clamp(anchor - c * size, frame - size, 0) : (frame - size) / 2 + by);
  return {left: axis(view.ax, view.cx, width, FRAME.w, shift.x), top: axis(view.ay, view.cy, height, FRAME.h, shift.y), width, height, scale: s};
}

export const regionOk = (r: unknown): r is Region => {
  const q = r as Region;
  return !!q && [q.x, q.y, q.w, q.h].every((v) => Number.isFinite(v)) && q.x >= 0 && q.y >= 0 && q.w > 0.02 && q.h > 0.02 && q.x + q.w <= 1.0001 && q.y + q.h <= 1.0001;
};

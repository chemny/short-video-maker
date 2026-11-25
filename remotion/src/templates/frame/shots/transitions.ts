import React from 'react';
import {clamp, ease, easeOut, lerp} from './camera';

// Entry and exit effects for a shot (references/shot-script.md, step 8). A transition belongs to the INCOMING shot: it starts
// `TRANSITION_FRAMES[type]` frames early on top of the outgoing one. The incoming shot animates with `enterFx`, the outgoing one with
// `exitFx` over the same frames. Everything is a pure function of progress 0..1, so a frame always renders the same, and every effect
// ends at rest (nothing offset, blurred or dimmed once progress is 1).
export const TRANSITIONS = ['cut', 'dissolve', 'slide', 'push', 'stack', 'wipe', 'zoom', 'blur'] as const;
export type Transition = (typeof TRANSITIONS)[number];
export type Dir = 'left' | 'right' | 'up' | 'down';
export const TRANSITION_FRAMES: Record<Transition, number> = {cut: 0, dissolve: 9, slide: 8, push: 10, stack: 11, wipe: 10, zoom: 10, blur: 7};
export const TRANSITION_NAMES: Record<Transition, string> = {cut: '硬切', dissolve: '淡入', slide: '上浮', push: '推出', stack: '叠放', wipe: '擦除', zoom: '穿入', blur: '模糊切'};

export type Fx = {opacity?: number; transform?: string; filter?: string; clipPath?: string; boxShadow?: string};
const W = 1080, H = 1920;
const vec = (dir: Dir) => ({left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1]} as const)[dir];   // where the incoming shot comes FROM, as a unit vector

export function enterFx(type: Transition, t: number, dir: Dir = 'left', focus = {x: W / 2, y: 860}): Fx {
  const p = clamp(t, 0, 1);
  switch (type) {
    case 'dissolve': return {opacity: easeOut(p)};
    case 'slide': return {opacity: easeOut(p), transform: `translateY(${(1 - easeOut(p)) * 90}px)`};
    case 'push': { const [x, y] = vec(dir), e = ease(p); return {transform: `translate(${x * (1 - e) * W}px, ${y * (1 - e) * H}px)`}; }
    case 'stack': {
      const [x, y] = vec(dir), e = easeOut(p), shadow = 0.5 * (1 - e);
      return {transform: `translate(${x * (1 - e) * W * 0.9}px, ${y * (1 - e) * H * 0.55}px)`, boxShadow: `0 0 ${60 * (1 - e)}px rgba(0,0,0,${shadow})`, opacity: clamp(p * 3, 0, 1)};
    }
    case 'wipe': {
      const e = ease(p), r = e * 150;
      return {clipPath: `circle(${r}% at ${(focus.x / W) * 100}% ${(focus.y / H) * 100}%)`};
    }
    case 'zoom': { const e = easeOut(p); return {opacity: clamp(p * 2.2, 0, 1), transform: `scale(${lerp(e, 1.22, 1)})`}; }
    case 'blur': { const e = easeOut(p); return {opacity: clamp(p * 1.8, 0, 1), filter: `blur(${(1 - e) * 20}px)`, transform: `scale(${lerp(e, 1.05, 1)})`}; }
    default: return {};
  }
}

// What the OUTGOING shot does while the next one comes in. Defined by the incoming shot's type.
export function exitFx(type: Transition, t: number, dir: Dir = 'left'): Fx {
  const p = clamp(t, 0, 1);
  switch (type) {
    case 'push': { const [x, y] = vec(dir), e = ease(p); return {transform: `translate(${-x * e * W}px, ${-y * e * H}px)`}; }
    case 'stack': { const e = easeOut(p); return {transform: `scale(${1 - 0.07 * e})`, filter: `brightness(${1 - 0.4 * e})`}; }
    case 'wipe': { const e = ease(p); return {transform: `scale(${1 + 0.03 * e})`}; }
    case 'zoom': { const e = easeOut(p); return {transform: `scale(${lerp(e, 1, 1.14)})`, opacity: 1 - 0.5 * e}; }
    case 'blur': { const e = easeOut(p); return {filter: `blur(${e * 14}px)`, transform: `scale(${1 + 0.03 * e})`}; }
    default: return {};
  }
}

const join = (a?: string, b?: string) => [a, b].filter(Boolean).join(' ') || undefined;
export const mergeFx = (a: Fx, b: Fx): React.CSSProperties => ({
  opacity: (a.opacity ?? 1) * (b.opacity ?? 1), transform: join(a.transform, b.transform), filter: join(a.filter, b.filter),
  clipPath: a.clipPath ?? b.clipPath, boxShadow: a.boxShadow ?? b.boxShadow,
});

// Whether an effect needs a direction, and the directions a plan alternates through.
export const DIRECTIONAL: Transition[] = ['slide', 'push', 'stack'];

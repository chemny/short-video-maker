import React from 'react';
import {EASE, ramp} from '../../../components/shotcraft-vendor/_fixtures/Polish';

export const F = (s: number) => Math.ceil(s * 30);
export const seen = (f: number, at?: number) => at === undefined || f >= F(at);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
// Segment progress 0..1 between two spoken times, eased.
export const seg = (f: number, from: number, to: number, ease: (t: number) => number = EASE.smooth) => ramp(f, F(from), Math.max(1, F(to) - F(from)), ease);
export const lerp = (p: number, a: number, b: number) => a + (b - a) * p;
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const abs = (left: number, top: number, width?: number, height?: number): React.CSSProperties => ({position: 'absolute', left, top, ...(width === undefined ? {} : {width}), ...(height === undefined ? {} : {height})});
export {EASE, ramp};

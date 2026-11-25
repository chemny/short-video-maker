import React from 'react';
import {EASE, mix, ramp} from '../../components/shotcraft-vendor/_fixtures/Polish';

export {EASE, mix, ramp};

// Shared contract for the frame component library (references/component-library.md). Style A: editorial serif, restrained clay accent.
// Zones follow references/visual-system.md: conservative Douyin / WeChat Channels safe band (top 290, bottom 385, button rail 194).
export const W = 1080;
export const Z = {margin: 72, width: 936, topic: 300, stage: {top: 410, height: 880}, caption: {top: 1320, height: 170, width: 810}} as const;

export const THEMES: Record<'light' | 'dark', Record<string, string>> = {
  light: {'--page': '#F4EFE4', '--ink': '#1A1814', '--muted': '#6F685A', '--accent': '#C4623A', '--hair': 'rgba(26,24,20,.16)', '--mark': 'rgba(196,98,58,.22)', '--glow': 'rgba(217,119,87,.10)', '--blend': 'multiply', '--grade': 'saturate(.8)'},
  dark: {'--page': '#14120F', '--ink': '#F4EFE4', '--muted': '#A39B8B', '--accent': '#E58D62', '--hair': 'rgba(244,239,228,.18)', '--mark': 'rgba(229,141,98,.3)', '--glow': 'rgba(217,119,87,.14)', '--blend': 'normal', '--grade': 'saturate(.88)'},
};
export const font = {serif: '"Songti SC","STSong",serif', sans: '"PingFang SC","Hiragino Sans GB",sans-serif', numeral: 'Baskerville,"Songti SC",serif'};

export const F = (s: number) => Math.ceil(s * 30);
export const seen = (f: number, at?: number) => at === undefined || f >= F(at);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (p: number, a: number, b: number) => a + (b - a) * p;
export const abs = (left: number, top: number, width?: number, height?: number): React.CSSProperties => ({position: 'absolute', left, top, ...(width === undefined ? {} : {width}), ...(height === undefined ? {} : {height})});
export const centred: React.CSSProperties = {display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'};
export const Role = ({role = 'body', style, children}: {role?: string; style?: React.CSSProperties; children: React.ReactNode}) => <div data-layout-role={role} style={style}>{children}</div>;
// Progress 0..1 of an entrance starting at a spoken time; 0 before it.
export const enter = (f: number, at: number, frames = 16, ease: (t: number) => number = EASE.out) => (seen(f, at) ? ramp(f, F(at), frames, ease) : 0);

// What a component receives besides its own props: the frame, the shot's time span, and the stage box it must stay inside.
export type StageProps = {f: number; from: number; to: number; W: number; H: number};
export type Spec<P> = {
  id: string;
  type: string;
  minSeconds: number;
  Component: React.FC<{p: P} & StageProps>;
  validate: (p: P) => void;
  sample: P;
  sampleMax: P;
  sampleSeconds: number;
};

export const fail = (id: string, prop: string, why: string): never => { throw new Error(`${id}.${prop}: ${why}`); };
// Width of a string in CJK-character units: Han and fullwidth count 1, ASCII counts .55.
export const weight = (s: string) => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 1 : 0.55), 0);
export const needText = (id: string, prop: string, s: unknown, max: number): void => {
  if (typeof s !== 'string' || !s.trim()) fail(id, prop, 'text is required');
  else if (weight(s) > max) fail(id, prop, `"${s}" is wider than ${max} characters`);
};
export const needTime = (id: string, prop: string, t: unknown): void => { if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) fail(id, prop, 'a cue time in seconds is required'); };
export const needCount = (id: string, prop: string, n: number, min: number, max: number): void => { if (n < min || n > max) fail(id, prop, `needs ${min} to ${max} items, got ${n}`); };
// A component must be on screen long enough to read and to hold its end state.
export const checkSpan = (spec: Spec<unknown>, from: number, to: number): void => { if (to - from < spec.minSeconds) fail(spec.id, 'span', `shot is ${(to - from).toFixed(1)} s, needs at least ${spec.minSeconds} s`); };

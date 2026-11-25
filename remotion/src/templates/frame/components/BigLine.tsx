import React from 'react';
import {EASE, Role, Spec, enter, font, needCount, needText, needTime, seen, weight} from '../kit';

// type "hook" (and the fallback for any claim without a matching type): one or two bold lines already on screen when the shot
// starts. Each line rises on its own cue; the last one can carry the accent. Nothing else is on the stage.
export type Line = {text: string; at: number; accent?: boolean};
export type BigLineProps = {lines: Line[]};

export const lineSize = (lines: Line[]) => Math.min(210, Math.floor(936 / Math.max(...lines.map((l) => weight(l.text)), 1) * 0.96));

const View: React.FC<{p: BigLineProps; f: number}> = ({p, f}) => {
  const fs = lineSize(p.lines);
  return <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: fs * 0.22}}>
    {p.lines.map((l, i) => {
      const a = enter(f, l.at, 20, EASE.smooth);
      return <Role key={i} role="title" style={{fontFamily: font.serif, fontWeight: 700, fontSize: fs, lineHeight: 1.08, letterSpacing: '-0.01em', whiteSpace: 'nowrap', color: l.accent ? 'var(--accent)' : 'var(--ink)', opacity: seen(f, l.at) ? a : 0, transform: `translateY(${(1 - a) * 28}px)`}}>{l.text}</Role>;
    })}
  </div>;
};

export const BigLine: Spec<BigLineProps> = {
  id: 'BigLine', type: 'hook', minSeconds: 2, sampleSeconds: 5,
  Component: ({p, f}) => <View p={p} f={f}/>,
  validate: (p) => { needCount('BigLine', 'lines', p.lines?.length ?? 0, 1, 2); p.lines.forEach((l, i) => { needText('BigLine', `lines[${i}].text`, l.text, 8); needTime('BigLine', `lines[${i}].at`, l.at); }); },
  sample: {lines: [{text: '入口在系统层', at: 0.2}, {text: '不在某个应用里', at: 1.4, accent: true}]},
  sampleMax: {lines: [{text: '八个字的第一行话', at: 0.2}, {text: '八个字的第二行话', at: 1.4, accent: true}]},
};

import React from 'react';
import {EASE, F, Role, Spec, enter, font, needCount, needText, needTime, ramp, seen} from '../kit';

// type "sequence": two to four moments on a vertical line. The line grows to each point as it is spoken, the dot pops, the date
// and what happened rise beside it. The newest point takes the accent; earlier ones settle back to ink. Held to the shot's end.
export type Point = {when: string; what: string; at: number};
export type TimelineProps = {points: Point[]};

const LINE_X = 380, TOP = 40;

const View: React.FC<{p: TimelineProps; H: number; f: number}> = ({p, H, f}) => {
  const n = p.points.length, pitch = Math.min(340, (H - TOP * 2) / n), y0 = (H - pitch * (n - 1)) / 2;
  const ys = p.points.map((_, i) => y0 + i * pitch);
  const newest = p.points.map((pt) => seen(f, pt.at)).lastIndexOf(true);
  return <div style={{position: 'absolute', inset: 0}}>
    <svg width={1080} height={H} style={{position: 'absolute', left: -72, top: 0, overflow: 'visible'}}>
      {p.points.slice(1).map((pt, i) => {
        const g = seen(f, pt.at) ? ramp(f, F(pt.at) - 8, 24, EASE.smooth) : 0;
        return <line key={i} x1={LINE_X + 72} x2={LINE_X + 72} y1={ys[i]} y2={ys[i] + (ys[i + 1] - ys[i]) * g} stroke="var(--hair)" strokeWidth={5} strokeLinecap="round"/>;
      })}
    </svg>
    {p.points.map((pt, i) => {
      const a = enter(f, pt.at, 18, EASE.smooth), pop = enter(f, pt.at - 0.1, 16, EASE.overshoot), hot = i === newest;
      return <React.Fragment key={i}>
        <div style={{position: 'absolute', left: LINE_X - 20, top: ys[i] - 20, width: 40, height: 40, borderRadius: 40, background: hot ? 'var(--accent)' : 'var(--ink)', transform: `scale(${Math.min(1.15, pop)})`, opacity: Math.min(1, pop)}}/>
        <Role role="stat" style={{position: 'absolute', left: 0, top: ys[i] - 60, width: LINE_X - 56, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontFamily: font.serif, fontWeight: 700, fontSize: 96, whiteSpace: 'nowrap', color: hot ? 'var(--accent)' : 'var(--ink)', opacity: a, transform: `translateX(${(1 - a) * -24}px)`}}>{pt.when}</Role>
        <Role role="body" style={{position: 'absolute', left: LINE_X + 56, top: ys[i] - 60, width: 936 - LINE_X - 56, height: 120, display: 'flex', alignItems: 'center', fontFamily: font.sans, fontWeight: 600, fontSize: 62, whiteSpace: 'nowrap', color: hot ? 'var(--ink)' : 'var(--muted)', opacity: a, transform: `translateX(${(1 - a) * 24}px)`}}>{pt.what}</Role>
      </React.Fragment>;
    })}
  </div>;
};

export const Timeline: Spec<TimelineProps> = {
  id: 'Timeline', type: 'sequence', minSeconds: 3, sampleSeconds: 7,
  Component: ({p, H, f}) => <View p={p} H={H} f={f}/>,
  validate: (p) => { needCount('Timeline', 'points', p.points?.length ?? 0, 2, 4); p.points.forEach((pt, i) => { needText('Timeline', `points[${i}].when`, pt.when, 4); needText('Timeline', `points[${i}].what`, pt.what, 7); needTime('Timeline', `points[${i}].at`, pt.at); }); },
  sample: {points: [{when: '11月4日', what: '开始测试', at: 0.4}, {when: '12月', what: '正式上线', at: 3.2}]},
  sampleMax: {points: [{when: '1月初', what: '七个字的说明文', at: 0.4}, {when: '3月底', what: '七个字的说明文', at: 2.2}, {when: '6月起', what: '七个字的说明文', at: 4}, {when: '12月', what: '七个字的说明文', at: 5.6}]},
};

import React from 'react';
import {EASE, F, Role, Spec, enter, font, lerp, needCount, needText, needTime, ramp, seen} from '../kit';

// type "scope": conditions joined by "or" / "and". After video-shotcraft brace-expand: a pair of braces appears small at the
// centre as a hard cut, slides outward with outBack overshoot while growing, and the text is revealed like a curtain: its clip
// width is bound to the brace gap. Each condition gets its own pair on its cue; a medallion joins two rows when the next opens.
export type Condition = {text: string; sub?: string; at: number};
export type BraceExpandProps = {conditions: Condition[]; joiner: string};

const HALF = 400, ROW = 220, GAP = 100;

const Row: React.FC<{c: Condition; f: number; y: number}> = ({c, f, y}) => {
  const on = seen(f, c.at) ? 1 : 0, ex = seen(f, c.at) ? ramp(f, F(c.at) + 4, 22, EASE.overshoot) : 0, sc = lerp(Math.min(ex, 1.2), 0.6, 1), x = HALF * ex * sc;
  const ls = lerp(ramp(f, F(c.at) + 24, 24, EASE.smooth), 0, 4);
  const brace = (ch: string, dx: number) => <Role role="stat" style={{position: 'absolute', left: '50%', top: '50%', fontFamily: font.numeral, fontSize: 300, lineHeight: 1, color: 'var(--accent)', opacity: on, transform: `translate(-50%,-50%) translateX(${dx * x}px) scale(${sc})`}}>{ch}</Role>;
  return <div style={{position: 'absolute', left: 0, top: y, width: '100%', height: ROW}}>
    {brace('{', -1)}{brace('}', 1)}
    <div style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', overflow: 'hidden', width: Math.max(0, x * 2 - 96), height: ROW, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: on}}>
      <Role role="title" style={{fontFamily: font.serif, fontWeight: 700, fontSize: 84, whiteSpace: 'nowrap', color: 'var(--ink)', letterSpacing: `${ls}px`, transform: `scale(${sc})`}}>{c.text}</Role>
      {c.sub && <Role role="body" style={{fontFamily: font.sans, fontSize: 46, whiteSpace: 'nowrap', color: 'var(--muted)', marginTop: 8}}>{c.sub}</Role>}
    </div>
  </div>;
};

const View: React.FC<{p: BraceExpandProps; f: number; H: number; W: number}> = ({p, f, H, W}) => {
  const n = p.conditions.length, total = n * ROW + (n - 1) * GAP, y0 = (H - total) / 2;
  return <div style={{position: 'absolute', inset: 0}}>
    {p.conditions.map((c, i) => <Row key={i} c={c} f={f} y={y0 + i * (ROW + GAP)}/>)}
    {p.conditions.slice(1).map((c, i) => {
      const jo = enter(f, c.at, 18, EASE.overshoot), y = y0 + (i + 1) * ROW + i * GAP + GAP / 2;
      return <Role key={i} role="stat" style={{position: 'absolute', left: W / 2 - 46, top: y - 46, width: 92, height: 92, borderRadius: 92, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font.serif, fontWeight: 700, fontSize: 50, color: 'var(--page)', transform: `scale(${Math.min(1, jo)})`, opacity: Math.min(1, jo)}}>{p.joiner}</Role>;
    })}
  </div>;
};

export const BraceExpand: Spec<BraceExpandProps> = {
  id: 'BraceExpand', type: 'scope', minSeconds: 3.5, sampleSeconds: 7,
  Component: ({p, f, H, W}) => <View p={p} f={f} H={H} W={W}/>,
  validate: (p) => {
    needCount('BraceExpand', 'conditions', p.conditions?.length ?? 0, 2, 3);
    needText('BraceExpand', 'joiner', p.joiner, 1);
    p.conditions.forEach((c, i) => { needText('BraceExpand', `conditions[${i}].text`, c.text, 8); if (c.sub) needText('BraceExpand', `conditions[${i}].sub`, c.sub, 10); needTime('BraceExpand', `conditions[${i}].at`, c.at); });
  },
  sample: {conditions: [{text: '在中国购买', sub: '设备与 Apple 账户', at: 0.4}, {text: '地区设为中国', sub: '设备定位加账户', at: 2.6}], joiner: '或'},
  sampleMax: {conditions: [{text: '八个字的条件一', sub: '十个字以内的补充说明', at: 0.4}, {text: '八个字的条件二', sub: '十个字以内的补充说明', at: 2}, {text: '八个字的条件三', sub: '十个字以内的补充说明', at: 3.6}], joiner: '或'},
};

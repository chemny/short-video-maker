import React from 'react';
import {EASE, F, abs, lerp, ramp, seen} from './shared';

// After video-shotcraft brace-expand: a pair of braces appears small at the centre as a hard cut, then slides outward with
// outBack overshoot while growing, and the text is revealed like a curtain: its clip width is bound to the brace gap. Here each
// condition gets its own pair, stacked, opening on its spoken cue; an "or" medallion joins the two when the second opens.
export type Brace = {text: string; sub?: string; at: number};
export type BraceProps = {badge?: {text: string; at: number}; conditions: Brace[]; joiner: {text: string; at: number}; windowW: number; windowH: number};
const HALF = 400;

function Row({b, f, y}: {b: Brace; f: number; y: number}) {
  const on = seen(f, b.at) ? 1 : 0, ex = seen(f, b.at) ? ramp(f, F(b.at) + 4, 22, EASE.overshoot) : 0, sc = lerp(Math.min(ex, 1.2), 0.6, 1), x = HALF * ex * sc;
  const ls = lerp(ramp(f, F(b.at) + 24, 24, EASE.smooth), 0, 4);
  const brace = (ch: string, dx: number) => <div data-layout-role="stat" style={{position: 'absolute', left: '50%', top: '50%', fontFamily: 'Baskerville,"Songti SC",serif', fontSize: 330, color: 'var(--accent)', lineHeight: 1, opacity: on, transform: `translate(-50%,-50%) translateX(${dx * x}px) scale(${sc})`}}>{ch}</div>;
  return <div style={{position: 'absolute', left: 0, top: y, width: '100%', height: 300}}>
    {brace('{', -1)}{brace('}', 1)}
    <div style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', overflow: 'hidden', width: Math.max(0, x * 2 - 90), height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: on}}>
      <div data-layout-role="title" style={{fontFamily: '"Songti SC",serif', fontWeight: 700, fontSize: 104, whiteSpace: 'nowrap', color: 'var(--ink)', letterSpacing: `${ls}px`, transform: `scale(${sc})`}}>{b.text}</div>
      {b.sub && <div data-layout-role="body" style={{fontFamily: '"PingFang SC",sans-serif', fontSize: 54, whiteSpace: 'nowrap', color: 'var(--muted)', marginTop: 12}}>{b.sub}</div>}
    </div>
  </div>;
}

export function BraceExpand({m, f}: {m: BraceProps; f: number}) {
  const jo = seen(f, m.joiner.at) ? ramp(f, F(m.joiner.at), 18, EASE.overshoot) : 0;
  return <div style={{position: 'absolute', inset: 0}}>
    {m.badge && <div data-layout-role="title" style={{...abs(0, 40, m.windowW), textAlign: 'center', fontFamily: '"Songti SC",serif', fontWeight: 700, fontSize: 130, color: 'var(--accent)', opacity: seen(f, m.badge.at) ? ramp(f, F(m.badge.at), 16, EASE.out) : 0}}>{m.badge.text}</div>}
    <Row b={m.conditions[0]} f={f} y={230}/>
    <div data-layout-role="stat" style={{...abs(m.windowW / 2 - 80, 540, 160, 160), borderRadius: 140, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Songti SC",serif', fontWeight: 700, fontSize: 84, color: 'var(--page)', transform: `scale(${Math.min(1, jo)})`, opacity: Math.min(1, jo)}}>{m.joiner.text}</div>
    <Row b={m.conditions[1]} f={f} y={760}/>
  </div>;
}

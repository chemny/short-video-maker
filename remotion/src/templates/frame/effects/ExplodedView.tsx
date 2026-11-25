import React from 'react';
import {Img, staticFile} from 'remotion';
import {EASE, F, abs, lerp, ramp, seen} from './shared';

// After video-shotcraft exploded-view (real parts, staggered out-back along depth, reverse-order close). The three official
// interfaces start stacked as one object, fan out in 3D onto a shared lit floor when the system layer is named, and close again
// for the final watch point. The words sit above and below the stage so nothing collides with the phones.
export type Layer = {photo: string; w: number; h: number; label: string};
export type ExplodedProps = {layers: Layer[]; from: number; explodeAt: number; closeAt: number; lines: {text: string; at: number; size?: number}[]; floor: {text: string; at: number}[]; windowW: number; windowH: number};
const PHONE_H = 620;

export function ExplodedView({m, f}: {m: ExplodedProps; f: number}) {
  const W = m.windowW, H = m.windowH, n = m.layers.length, enter = ramp(f, F(m.from), 24, EASE.out);
  const line = m.lines.filter((l) => seen(f, l.at)).at(-1), floor = m.floor.filter((l) => seen(f, l.at)).at(-1);
  const lp = (i: number) => {
    const order = i === 1 ? 0 : i === 0 ? 1 : 2;
    return (seen(f, m.explodeAt) ? ramp(f, F(m.explodeAt) + order * 5, 26, EASE.overshoot) : 0) * (1 - (seen(f, m.closeAt) ? ramp(f, F(m.closeAt) + (2 - order) * 4, 20, EASE.smooth) : 0));
  };
  const open = Math.max(lp(0), lp(1), lp(2));
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <div style={{...abs(0, 10, W, 190), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {line && <div key={line.text} data-layout-role="stat" style={{fontFamily: '"Songti SC",serif', fontWeight: 700, fontSize: line.size ?? 150, color: 'var(--accent)', whiteSpace: 'nowrap', opacity: ramp(f, F(line.at), 16, EASE.out), transform: `translateY(${(1 - ramp(f, F(line.at), 16, EASE.out)) * 26}px)`}}>{line.text}</div>}
    </div>
    <div style={{...abs(W / 2 - 480, 870, 960, 60), borderRadius: '50%', background: 'radial-gradient(ellipse at center,var(--accent),transparent 70%)', opacity: 0.5 * Math.min(1, open), filter: 'blur(14px)'}}/>
    <div style={{position: 'absolute', inset: 0, perspective: 1900, opacity: enter}}>
      <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d'}}>
        {m.layers.map((L, i) => {
          const p = lp(i), side = i - (n - 1) / 2, pw = (L.w / L.h) * PHONE_H;
          const stackX = side * 34, x = lerp(p, stackX, side * 318), rot = lerp(Math.min(p, 1.1), 0, -side * 24), z = lerp(p, side === 0 ? 20 : -30, side === 0 ? 40 : -170);
          return <div key={i} style={{...abs(W / 2 - pw / 2, 240, pw, PHONE_H), transform: `translateX(${x}px) translateZ(${z}px) rotateY(${rot}deg)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.45))'}}>
            <Img src={staticFile(L.photo)} style={{width: '100%', height: '100%'}}/>
          </div>;
        })}
      </div>
    </div>
    {m.layers.map((L, i) => { const side = i - (n - 1) / 2, a = Math.min(1, Math.max(0, lp(i))); return <div key={L.label} data-layout-role="body" style={{...abs(W / 2 + side * 318 - 170, 892, 340), textAlign: 'center', fontFamily: '"Songti SC",serif', fontWeight: 700, fontSize: 46, whiteSpace: 'nowrap', color: 'var(--ink)', opacity: a}}>{L.label}</div>; })}
    <div style={{...abs(0, 970, W, 130), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {floor && <div key={floor.text} data-layout-role="title" style={{fontFamily: '"Songti SC",serif', fontWeight: 700, fontSize: 76, color: 'var(--ink)', whiteSpace: 'nowrap', opacity: ramp(f, F(floor.at), 16, EASE.out)}}>{floor.text}</div>}
    </div>
  </div>;
}

import React from 'react';
import {Img, staticFile} from 'remotion';
import {EASE, F, abs, lerp, mix, ramp, seen} from './shared';

// After video-shotcraft doc-park-left-pill-deal. The sourced article is read, not decorated: it fills the stage, then parks into
// the top half when the first point lands. For each spoken point it scrolls to the exact sentence, the marker sweeps over it, and
// a pill with a drawn check is dealt below (outBack). The newest pill carries the accent; earlier ones stay as a tally.
export type Pill = {text: string; at: number; rects: number[][]};
export type DocParkProps = {photo: string; w: number; h: number; parkAt: number; pills: Pill[]; credit?: string; from: number; to: number; windowW: number; windowH: number};
const PILL_H = 136, PILL_GAP = 22;

export function DocParkPills({m, f}: {m: DocParkProps; f: number}) {
  const W = m.windowW, H = m.windowH, cardW = W - 96, scale = cardW / m.w, docH = m.h * scale;
  const park = seen(f, m.parkAt) ? ramp(f, F(m.parkAt), 30, EASE.smooth) : 0;
  const pillsH = m.pills.length * (PILL_H + PILL_GAP), viewH = lerp(park, H - 30, H - pillsH - 50);
  let y = 0; m.pills.forEach((p) => { const [, ry, , rh] = p.rects[0], t = ramp(f, F(p.at), 30, EASE.smooth); y = mix(y, Math.min(docH - viewH, Math.max(0, ry * scale + rh * scale / 2 - viewH * 0.42)), t); });
  const enter = ramp(f, F(m.from), 26, EASE.out), active = m.pills.filter((p) => seen(f, p.at)).length - 1;
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <div data-layout-role="media" data-media-crop="intentional" style={{...abs(48, 16, cardW, viewH), overflow: 'hidden', borderRadius: 32, background: '#fff', boxShadow: '0 40px 90px rgba(0,0,0,.45)', opacity: enter, transform: `translateY(${(1 - enter) * 50}px)`}}>
      <div style={{position: 'absolute', left: 0, top: -y, width: cardW, height: docH}}>
        <Img src={staticFile(m.photo)} style={{width: '100%', height: '100%'}}/>
        {m.pills.flatMap((p, i) => seen(f, p.at) ? p.rects.map(([x, ry, w, h], k) => <div key={`${i}-${k}`} style={{position: 'absolute', left: `${(x / m.w) * 100}%`, top: `${(ry / m.h) * 100}%`, width: `${((w * ramp(f, F(p.at) + 22 + k * 10, 16, EASE.out)) / m.w) * 100}%`, height: `${(h / m.h) * 100}%`, background: 'rgba(235,130,80,.42)', mixBlendMode: 'multiply', borderRadius: 6}}/>) : [])}
      </div>
      {m.credit && <div data-layout-role="source" style={{position: 'absolute', right: 22, bottom: 14, padding: '4px 16px', borderRadius: 20, background: 'rgba(255,255,255,.92)', fontFamily: '"PingFang SC",sans-serif', fontSize: 28, color: '#6f6a5f'}}>{m.credit}</div>}
    </div>
    {m.pills.map((p, k) => {
      const o = seen(f, p.at) ? ramp(f, F(p.at) + 14, 10, EASE.out) : 0, b = seen(f, p.at) ? ramp(f, F(p.at) + 14, 20, EASE.overshoot) : 0, check = seen(f, p.at) ? ramp(f, F(p.at) + 24, 14, EASE.out) : 0, hot = k === active;
      return <div key={k} data-layout-role="body" style={{...abs(48, H - pillsH - 8 + k * (PILL_H + PILL_GAP), cardW, PILL_H), display: 'flex', alignItems: 'center', gap: 32, padding: '0 44px', borderRadius: PILL_H / 2, boxSizing: 'border-box', border: `3px solid ${hot ? 'var(--accent)' : 'var(--muted)'}`, opacity: o * (hot ? 1 : 0.72), transform: `translateY(${lerp(b, 44, 0)}px) scale(${lerp(b, 0.94, 1)})`}}>
        <svg width="70" height="70" viewBox="0 0 70 70" style={{flexShrink: 0}}><circle cx="35" cy="35" r="33" fill={hot ? 'var(--accent)' : 'none'} stroke="var(--accent)" strokeWidth="3"/><path d="M20 36l11 11 20-23" fill="none" stroke={hot ? 'var(--page)' : 'var(--accent)'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - check}/></svg>
        <div style={{fontFamily: '"Songti SC",serif', fontWeight: 700, fontSize: 64, color: 'var(--ink)', whiteSpace: 'nowrap'}}>{p.text}</div>
      </div>;
    })}
  </div>;
}

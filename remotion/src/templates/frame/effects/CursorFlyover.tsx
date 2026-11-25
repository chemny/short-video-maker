import React from 'react';
import {Img, staticFile} from 'remotion';
import {EASE, F, abs, clamp, mix, ramp, seen} from './shared';

// After video-shotcraft cursor-flyover. The source page is a real card captured at phone width, so its text reads without
// extreme zoom. The card settles from a slight tilt, then the camera flies between stops (easeInOutCubic), each stop framing a
// whole sentence; the cursor keeps screen size and clicks when it lands; the marker sweeps over the sentence after the click.
export type FlyStop = {at: number; y: number; x?: number; zoom: number; rects?: number[][]};
export type FlyoverProps = {photo: string; w: number; h: number; start: {y: number; x?: number; zoom: number}; stops: FlyStop[]; from: number; windowW: number; windowH: number};

export function CursorFlyover({m, f}: {m: FlyoverProps; f: number}) {
  const W = m.windowW, H = m.windowH, cardW = W - 96, base = cardW / m.w;
  let zoom = m.start.zoom, cy = m.start.y, cx = m.start.x ?? m.w / 2, px = W * 0.72, py = H * 0.62;
  for (const s of m.stops) {
    const t = ramp(f, F(s.at), 34, EASE.smooth);
    zoom = mix(zoom, s.zoom, t); cy = mix(cy, s.y, t); cx = mix(cx, s.x ?? m.w / 2, t);
    const last = s.rects?.at(-1), c = ramp(f, F(s.at) + 8, 28, EASE.smooth);
    if (last) { const sc = s.zoom * base; px = mix(px, W / 2 + (last[0] + last[2] - (s.x ?? m.w / 2)) * sc, c); py = mix(py, H / 2 + (last[1] + last[3] + 6 - s.y) * sc, c); }
  }
  const scale = zoom * base, drift = 1 + 0.012 * Math.sin(f / 70);
  const left = W / 2 - cx * scale, top = clamp(H / 2 - cy * scale, H - m.h * scale - 40, 40);
  const enter = ramp(f, F(m.from), 34, EASE.out);
  let click = 0; m.stops.forEach((s) => { if (s.rects) { const c = ramp(f, F(s.at) + 36, 14, EASE.out); if (c > 0 && c < 1) click = c; } });
  const cursorOn = ramp(f, F(m.stops[0]?.at ?? 0), 12, EASE.out);
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', perspective: 1800, WebkitMaskImage: 'linear-gradient(180deg,transparent 0,#000 40px,#000 calc(100% - 60px),transparent 100%)'}}>
    <div style={{position: 'absolute', inset: 0, transform: `translateY(${(1 - enter) * 90}px) rotateX(${(1 - enter) * 16}deg) scale(${(0.94 + 0.06 * enter) * drift})`, opacity: enter}}>
      <div data-layout-role="media" data-media-crop="intentional" style={{position: 'absolute', left, top, width: m.w * scale, height: m.h * scale, borderRadius: 34 * zoom, overflow: 'hidden', background: '#fff', boxShadow: '0 50px 110px rgba(0,0,0,.5)'}}>
        <Img src={staticFile(m.photo)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}/>
        {m.stops.flatMap((s, i) => (s.rects ?? []).map(([x, y, w, h], k) => {
          if (!seen(f, s.at)) return null;
          const p = ramp(f, F(s.at) + 36 + k * 10, 16, EASE.out);
          return <div key={`${i}-${k}`} style={{position: 'absolute', left: `${((x - 6) / m.w) * 100}%`, top: `${((y - 2) / m.h) * 100}%`, width: `${(((w + 12) * p) / m.w) * 100}%`, height: `${((h + 4) / m.h) * 100}%`, background: 'rgba(235,130,80,.42)', mixBlendMode: 'multiply', borderRadius: 6}}/>;
        }))}
      </div>
    </div>
    {click > 0 && <div style={{...abs(px - 40, py - 40, 80, 80), borderRadius: 80, border: '4px solid #E58D62', opacity: (1 - click) * 0.9, transform: `scale(${0.3 + click * 1.5})`}}/>}
    <svg viewBox="0 0 24 24" style={{...abs(px, py, 72, 72), opacity: cursorOn, filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.45))', transform: `scale(${click > 0 && click < 0.4 ? 0.88 : 1})`}}><path d="M4 2 L4 19 L9 14.4 L12.2 21.5 L15.4 20 L12.2 13 L19 12.6 Z" fill="#fff" stroke="#101320" strokeWidth={1.1}/></svg>
  </div>;
}

import React from 'react';
import {Img, staticFile} from 'remotion';
import {EASE, F, abs, lerp, ramp, seen} from './shared';

// After video-shotcraft bezier-source-converge-merge. The sources are the real interfaces, not labelled dots: each phone lands
// when spoken and takes the focus (others recede), a thick curve grows from it to the Qwen medallion, packets travel the curve
// and the medallion pulses on arrival. On the merge cue each phone slides down its own curve shrinking in stages and is absorbed.
export type Source = {label: string; at: number; photo: string; w: number; h: number};
export type ConvergeProps = {sources: Source[]; mergeAt: number; mergeLabel: string; width: number; height: number; note?: string};

const SAMPLES = 600;
type P = [number, number];
const cubic = (p: [P, P, P, P], u: number): P => { const v = 1 - u; return [0, 1].map((a) => v * v * v * p[0][a] + 3 * v * v * u * p[1][a] + 3 * v * u * u * p[2][a] + u * u * u * p[3][a]) as P; };
const geom = (p: [P, P, P, P]) => {
  const cum = [0]; let prev = p[0], acc = 0;
  for (let k = 1; k <= SAMPLES; k++) { const q = cubic(p, k / SAMPLES); acc += Math.hypot(q[0] - prev[0], q[1] - prev[1]); cum.push(acc); prev = q; }
  return {len: acc, at: (s: number): P => { const t = Math.max(0, Math.min(acc, s)); let lo = 0, hi = SAMPLES; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; } const i = Math.max(1, lo), a = cum[i - 1], b = cum[i]; return cubic(p, (i - 1 + (b > a ? (t - a) / (b - a) : 0)) / SAMPLES); }};
};
const PHONE_H = 450, LABEL_Y = 490, CURVE_Y = 570, MERGE_Y = 880;

export function ConvergeMerge({m, f}: {m: ConvergeProps; f: number}) {
  const W = m.width, n = m.sources.length, mx = W / 2;
  const items = m.sources.map((s, i) => { const x = W * (0.19 + (0.62 * i) / Math.max(1, n - 1)), p: [P, P, P, P] = [[x, CURVE_Y], [x, CURVE_Y + 170], [mx, MERGE_Y - 210], [mx, MERGE_Y - 100]]; return {...s, x, p, g: geom(p)}; });
  const active = m.sources.filter((s) => seen(f, s.at)).length - 1;
  const conv = ramp(f, F(m.mergeAt), 40, EASE.smooth), flash = ramp(f, F(m.mergeAt) + 34, 22, EASE.out);
  const on = ramp(f, F(m.sources[0].at), 20, EASE.out);
  const arrivals = m.sources.map((s) => ramp(f, F(s.at) + 22, 24, EASE.out));
  const pulse = Math.max(...arrivals.map((a) => (a > 0 && a < 1 ? 1 - a : 0)), flash > 0 && flash < 1 ? 1 - flash : 0);
  return <div style={{position: 'absolute', inset: 0}}>
    <svg width={W} height={m.height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      {items.map((it, i) => { const draw = seen(f, it.at) ? ramp(f, F(it.at) + 4, 26, EASE.smooth) : 0; const hot = i === active && conv === 0;
        return <path key={i} d={`M${it.p[0]} C${it.p[1]} ${it.p[2]} ${it.p[3]}`} fill="none" stroke={hot ? 'var(--accent)' : 'var(--muted)'} strokeWidth={hot ? 8 : 5} strokeLinecap="round" strokeDasharray={it.g.len} strokeDashoffset={it.g.len * (1 - draw) - it.g.len * conv} opacity={0.95 - 0.35 * (hot ? 0 : 1)}/>; })}
      {items.map((it, i) => { if (!seen(f, it.at) || conv > 0.6) return null; const u = ((f - F(it.at)) / 54 + i * 0.3) % 1, q = it.g.at(it.g.len * u); return <circle key={i} cx={q[0]} cy={q[1]} r={11} fill="var(--accent)" opacity={ramp(f, F(it.at) + 12, 12, EASE.out)}/>; })}
    </svg>
    {items.map((it, i) => {
      const a = seen(f, it.at) ? ramp(f, F(it.at), 22, EASE.overshoot) : 0, focus = i === active ? 1 : 0;
      const pt = it.g.at(it.g.len * conv), dy = lerp(conv, -(CURVE_Y - PHONE_H / 2 - 30), 0), s = (conv < 0.75 ? lerp(conv / 0.75, 1, 0.3) : lerp((conv - 0.75) / 0.25, 0.3, 0)) * (active >= 0 && !focus && conv === 0 ? 0.9 : 1);
      const pw = (it.w / it.h) * PHONE_H;
      return <React.Fragment key={i}>
        <div style={{...abs(pt[0] - pw / 2, pt[1] + dy - PHONE_H / 2, pw, PHONE_H), opacity: Math.min(1, a) * (focus || conv > 0 ? 1 : 0.5), transform: `translateY(${(1 - Math.min(1, a)) * 50}px) scale(${s})`, filter: 'drop-shadow(0 24px 34px rgba(0,0,0,.35))'}}>
          <Img src={staticFile(it.photo)} style={{width: '100%', height: '100%'}}/>
        </div>
        <div data-layout-role="body" style={{...abs(it.x - 170, LABEL_Y, 340), textAlign: 'center', fontFamily: '"Songti SC",serif', fontWeight: 700, fontSize: 50, whiteSpace: 'nowrap', color: focus ? 'var(--accent)' : 'var(--ink)', opacity: Math.min(1, a) * Math.max(0, 1 - conv * 4)}}>{it.label}</div>
      </React.Fragment>;
    })}
    <div style={{...abs(mx - 130, MERGE_Y - 100, 260, 260), opacity: on, transform: `scale(${(0.8 + 0.2 * on) * (1 + 0.1 * pulse + 0.14 * flash)})`, borderRadius: 260, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${60 + 110 * pulse}px var(--accent)`}}>
      <div data-layout-role="stat" style={{fontFamily: '"Songti SC",serif', fontWeight: 700, fontSize: 92, color: 'var(--page)'}}>{m.mergeLabel}</div>
    </div>
  </div>;
}

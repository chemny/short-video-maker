import React from 'react';
import {EASE, F, Role, Spec, abs, font, lerp, needCount, needText, needTime, ramp, seen} from '../kit';

// type "relation": several sources into one target. After video-shotcraft bezier-source-converge-merge: a cubic curve grows from
// each source as it is spoken, packets travel it and the target pulses on arrival; on the merge cue every source slides down its
// own curve, shrinking in stages, and is absorbed. Path length comes from a precomputed arc table, never a DOM measure.
// Sources are text chips here; interface cut-outs are a later variant.
export type Source = {label: string; at: number};
export type ConvergeMergeProps = {sources: Source[]; target: string; mergeAt: number};

type P = [number, number];
type Curve = [P, P, P, P];
const SAMPLES = 400, CHIP_H = 130, CHIP_Y = 90, CURVE_Y = CHIP_Y + CHIP_H / 2 + 14, TARGET_Y = 640, R = 130;
const cubic = (p: Curve, u: number): P => { const v = 1 - u; return [0, 1].map((a) => v * v * v * p[0][a] + 3 * v * v * u * p[1][a] + 3 * v * u * u * p[2][a] + u * u * u * p[3][a]) as P; };
const arc = (p: Curve) => {
  const cum = [0]; let prev = p[0], acc = 0;
  for (let k = 1; k <= SAMPLES; k++) { const q = cubic(p, k / SAMPLES); acc += Math.hypot(q[0] - prev[0], q[1] - prev[1]); cum.push(acc); prev = q; }
  return {len: acc, at: (s: number): P => { const t = Math.max(0, Math.min(acc, s)); let lo = 0, hi = SAMPLES; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; } const i = Math.max(1, lo), a = cum[i - 1], b = cum[i]; return cubic(p, (i - 1 + (b > a ? (t - a) / (b - a) : 0)) / SAMPLES); }};
};

const View: React.FC<{p: ConvergeMergeProps; f: number; W: number; H: number}> = ({p, f, W, H}) => {
  const n = p.sources.length, mx = W / 2, chipW = Math.min(280, (W - 24 * (n - 1)) / n);
  const items = p.sources.map((s, i) => {
    const x = n === 1 ? mx : chipW / 2 + (i * (W - chipW)) / (n - 1);
    const c: Curve = [[x, CURVE_Y], [x, CURVE_Y + 150], [mx, TARGET_Y - R - 170], [mx, TARGET_Y - R - 10]];
    return {...s, x, c, g: arc(c)};
  });
  const active = p.sources.filter((s) => seen(f, s.at)).length - 1;
  const conv = ramp(f, F(p.mergeAt), 40, EASE.smooth), flash = ramp(f, F(p.mergeAt) + 34, 22, EASE.out);
  const on = ramp(f, F(p.sources[0].at), 20, EASE.out), settle = ramp(f, F(p.mergeAt) + 30, 24, EASE.smooth);
  const arrivals = p.sources.map((s) => ramp(f, F(s.at) + 22, 24, EASE.out));
  const pulse = Math.max(...arrivals.map((a) => (a > 0 && a < 1 ? 1 - a : 0)), flash > 0 && flash < 1 ? 1 - flash : 0);
  return <div style={{position: 'absolute', inset: 0}}>
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      {items.map((it, i) => {
        const draw = seen(f, it.at) ? ramp(f, F(it.at) + 4, 26, EASE.smooth) : 0, hot = i === active && conv === 0;
        return <path key={i} d={`M${it.c[0]} C${it.c[1]} ${it.c[2]} ${it.c[3]}`} fill="none" stroke={hot ? 'var(--accent)' : 'var(--hair)'} strokeWidth={hot ? 8 : 5} strokeLinecap="round" strokeDasharray={it.g.len} strokeDashoffset={it.g.len * (1 - draw) - it.g.len * conv}/>;
      })}
      {items.map((it, i) => {
        if (!seen(f, it.at) || conv > 0.6) return null;
        const u = ((f - F(it.at)) / 54 + i * 0.3) % 1, q = it.g.at(it.g.len * u);
        return <circle key={i} cx={q[0]} cy={q[1]} r={10} fill="var(--accent)" opacity={ramp(f, F(it.at) + 12, 12, EASE.out)}/>;
      })}
    </svg>
    {items.map((it, i) => {
      const a = seen(f, it.at) ? ramp(f, F(it.at), 22, EASE.overshoot) : 0, focus = i === active;
      const pt = it.g.at(it.g.len * conv), s = conv < 0.75 ? lerp(conv / 0.75, 1, 0.3) : lerp((conv - 0.75) / 0.25, 0.3, 0);
      const top = lerp(conv, CHIP_Y - CHIP_H / 2, pt[1] - CHIP_H / 2), left = lerp(conv, it.x - chipW / 2, pt[0] - chipW / 2);
      return <div key={i} style={{...abs(left, top, chipW, CHIP_H), borderRadius: CHIP_H, border: `3px solid ${focus && conv === 0 ? 'var(--accent)' : 'var(--hair)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: Math.min(1, a) * (focus || conv > 0 ? 1 : 0.55), transform: `translateY(${(1 - Math.min(1, a)) * 40}px) scale(${s})`}}>
        <Role role="body" style={{fontFamily: font.serif, fontWeight: 700, fontSize: 56, whiteSpace: 'nowrap', color: focus && conv === 0 ? 'var(--accent)' : 'var(--ink)'}}>{it.label}</Role>
      </div>;
    })}
    <div style={{...abs(mx - R, lerp(settle, TARGET_Y - R, H / 2 - R), R * 2, R * 2), opacity: on, transform: `scale(${(0.8 + 0.2 * on) * (1 + 0.1 * pulse + 0.14 * flash + 0.4 * settle)})`, borderRadius: R * 2, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${50 + 90 * pulse}px var(--glow)`}}>
      <Role role="stat" style={{fontFamily: font.serif, fontWeight: 700, fontSize: p.target.length > 2 ? 64 : 84, color: 'var(--page)'}}>{p.target}</Role>
    </div>
  </div>;
};

export const ConvergeMerge: Spec<ConvergeMergeProps> = {
  id: 'ConvergeMerge', type: 'relation', minSeconds: 4, sampleSeconds: 8,
  Component: ({p, f, W, H}) => <View p={p} f={f} W={W} H={H}/>,
  validate: (p) => {
    needCount('ConvergeMerge', 'sources', p.sources?.length ?? 0, 2, 4);
    needText('ConvergeMerge', 'target', p.target, 3);
    needTime('ConvergeMerge', 'mergeAt', p.mergeAt);
    p.sources.forEach((s, i) => { needText('ConvergeMerge', `sources[${i}].label`, s.label, p.sources.length > 3 ? 3 : 4); needTime('ConvergeMerge', `sources[${i}].at`, s.at); });
    if (p.mergeAt <= Math.max(...p.sources.map((s) => s.at))) throw new Error('ConvergeMerge.mergeAt: must come after the last source cue');
  },
  sample: {sources: [{label: 'Siri', at: 0.4}, {label: '写作工具', at: 1.8}, {label: '视觉智能', at: 3.2}], target: '千问', mergeAt: 4.8},
  sampleMax: {sources: [{label: '来源一', at: 0.4}, {label: '来源二', at: 1.6}, {label: '来源三', at: 2.8}, {label: '来源四', at: 4}], target: '千问智', mergeAt: 5.4},
};

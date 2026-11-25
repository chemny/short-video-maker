import React from 'react';
import {EASE, F, abs, clamp, lerp, ramp, seen} from './shared';

// After video-shotcraft odometer-digit-roll: every digit is its own 0-9 strip that spins fast, then decelerates in turn
// (easeOutCubic), overshoots half a cell and settles; two ghost copies trail the spin and drop away when it stops; the whole
// number pulses once when the last digit locks. Static glyphs (dot, units) stay put. Each figure starts on its spoken cue.
export type Figure = {digits: string; unit?: string; label: string; at: number; labelAt: number; accent?: boolean};
export type OdometerProps = {figures: Figure[]; windowW: number; windowH: number};

const ROW = 330, DW = 200, FS = 300, SPIN = 0.9;
const posAt = (f: number, start: number, i: number, d: number): number => {
  const s = start + 6 + i * 7, p0 = SPIN * Math.max(0, f - start);
  const T = Math.ceil((SPIN * (s - start) + 6 - d) / 10) * 10 + d;
  if (f < s) return p0;
  if (f < s + 16) return lerp(EASE.out(clamp((f - s) / 16, 0, 1)), SPIN * (s - start), T + 0.5);
  if (f < s + 22) return lerp(EASE.out(clamp((f - s - 16) / 6, 0, 1)), T + 0.5, T);
  return T;
};

const Strip = ({pos, color, opacity = 1, dy = 0}: {pos: number; color: string; opacity?: number; dy?: number}) =>
  <div style={{position: 'absolute', left: 0, top: 0, width: DW, transform: `translateY(${-(pos % 10) * ROW + dy}px)`, opacity}}>
    {Array.from({length: 20}).map((_, k) => <div key={k} style={{width: DW, height: ROW, lineHeight: `${ROW}px`, textAlign: 'center', fontSize: FS, fontFamily: 'Baskerville,"Songti SC",serif', color}}>{k % 10}</div>)}
  </div>;

function Reading({fig, f}: {fig: Figure; f: number}) {
  const start = F(fig.at), color = fig.accent ? 'var(--accent)' : 'var(--ink)';
  const cells = fig.digits.split('');
  const lockAt = start + 6 + (cells.filter((c) => /\d/.test(c)).length - 1) * 7 + 22;
  const pulse = f >= lockAt && f < lockAt + 14 ? Math.sin(((f - lockAt) / 14) * Math.PI) : 0;
  let di = -1;
  return <div style={{textAlign: 'center'}}>
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'flex-start', transform: `scale(${1 + 0.035 * pulse})`}}>
      {cells.map((c, k) => {
        if (!/\d/.test(c)) return <div key={k} data-layout-role="stat" style={{width: c === '.' ? 80 : undefined, height: ROW, lineHeight: `${ROW}px`, textAlign: 'center', fontSize: FS, fontFamily: 'Baskerville,"Songti SC",serif', color}}>{c}</div>;
        di++; const pos = posAt(f, start, di, Number(c)), speed = Math.abs(pos - posAt(f - 1, start, di, Number(c))), gate = clamp((speed - 0.06) / 0.44, 0, 1);
        return <div key={k} data-layout-role="stat" style={{position: 'relative', width: DW, height: ROW, overflow: 'hidden'}}>
          {gate > 0.001 && <><Strip pos={pos} color={color} opacity={0.25 * gate} dy={ROW * 0.5}/><Strip pos={pos} color={color} opacity={0.12 * gate} dy={-ROW * 0.5}/></>}
          <Strip pos={pos} color={color}/>
        </div>;
      })}
      {fig.unit && <div data-layout-role="title" style={{height: ROW, lineHeight: `${ROW - 70}px`, fontSize: 150, fontFamily: '"Songti SC",serif', fontWeight: 700, color, marginLeft: 14}}>{fig.unit}</div>}
    </div>
    <div data-layout-role="body" style={{fontFamily: '"PingFang SC",sans-serif', fontSize: 60, color: 'var(--ink)', opacity: seen(f, fig.labelAt) ? ramp(f, F(fig.labelAt), 16, EASE.out) : 0, marginTop: -6}}>{fig.label}</div>
  </div>;
}

export function Odometer({m, f}: {m: OdometerProps; f: number}) {
  return <div style={{...abs(0, 0, m.windowW, m.windowH), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
    {m.figures.map((fig, i) => <div key={i} style={{opacity: seen(f, fig.at) ? ramp(f, F(fig.at), 6, EASE.out) : 0}}><Reading fig={fig} f={f}/></div>)}
  </div>;
}

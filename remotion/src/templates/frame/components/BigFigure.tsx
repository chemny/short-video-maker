import React from 'react';
import {EASE, F, Role, Spec, clamp, enter, fail, font, lerp, needCount, needText, needTime, ramp, seen} from '../kit';

// type "figure": a date, amount or count. After video-shotcraft odometer-digit-roll: every digit is its own 0-9 strip that spins
// fast, decelerates in turn (easeOutCubic), overshoots half a cell and settles; ghost copies trail the spin; the number pulses
// once when the last digit locks. Prefix and suffix are static small glyphs. The end state holds until the shot ends.
export type FigurePart = {prefix?: string; value: string; suffix?: string};
export type BigFigureProps = {parts: FigurePart[]; label?: string; at: number; labelAt?: number};

const SPIN = 0.9, STAGGER = 7, LOCK = 22;
const posAt = (f: number, start: number, i: number, d: number): number => {
  const s = start + 6 + i * STAGGER, p0 = SPIN * Math.max(0, f - start);
  const T = Math.ceil((SPIN * (s - start) + 6 - d) / 10) * 10 + d;
  if (f < s) return p0;
  if (f < s + 16) return lerp(EASE.out(clamp((f - s) / 16, 0, 1)), SPIN * (s - start), T + 0.5);
  if (f < s + LOCK) return lerp(EASE.out(clamp((f - s - 16) / 6, 0, 1)), T + 0.5, T);
  return T;
};
const digitsOf = (parts: FigurePart[]) => parts.reduce((n, p) => n + (p.value.match(/\d/g)?.length ?? 0), 0);
const affixOf = (parts: FigurePart[]) => parts.reduce((n, p) => n + [...(p.prefix ?? '')].length + [...(p.suffix ?? '')].length, 0);
// Font size that fits the stage: digits are .58 em cells, separators about .3 em, affixes about .36 em plus their gap.
const CELL = 0.58;
const separatorsOf = (parts: FigurePart[]) => parts.reduce((n, p) => n + (p.value.match(/[.,]/g)?.length ?? 0), 0);
export const figureSize = (parts: FigurePart[]) => Math.min(400, Math.floor(936 / (digitsOf(parts) * CELL + separatorsOf(parts) * 0.3 + affixOf(parts) * 0.36 + 0.3)));

const Strip = ({pos, fs, color, opacity = 1, dy = 0}: {pos: number; fs: number; color: string; opacity?: number; dy?: number}) => {
  const row = fs * 1.05, cell = fs * CELL;
  return <div style={{position: 'absolute', left: 0, top: 0, width: cell, transform: `translateY(${-(pos % 10) * row + dy}px)`, opacity}}>
    {Array.from({length: 20}).map((_, k) => <div key={k} style={{width: cell, height: row, lineHeight: `${row}px`, textAlign: 'center', fontSize: fs, fontFamily: font.numeral, fontWeight: 700, color}}>{k % 10}</div>)}
  </div>;
};

const BigFigureView: React.FC<{p: BigFigureProps; f: number; from: number; to: number}> = ({p, f, from, to}) => {
  const fs = figureSize(p.parts), row = fs * 1.05, cell = fs * CELL, start = F(p.at), total = digitsOf(p.parts);
  const lockAt = start + 6 + (total - 1) * STAGGER + LOCK;
  const pulse = f >= lockAt && f < lockAt + 14 ? Math.sin(((f - lockAt) / 14) * Math.PI) : 0;
  const drift = 1 + 0.012 * clamp((f - lockAt) / Math.max(1, F(to) - lockAt), 0, 1);
  const small = {fontFamily: font.serif, fontWeight: 700, fontSize: fs * 0.3, lineHeight: 1, color: 'var(--accent)', marginBottom: fs * 0.16} as const;
  let di = -1;
  const labelAt = p.labelAt ?? lockAt / 30;
  return <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
    <div style={{display: 'flex', alignItems: 'flex-end', opacity: seen(f, p.at) ? ramp(f, start, 6, EASE.out) : 0, transform: `scale(${(1 + 0.035 * pulse) * drift})`}}>
      {p.parts.map((part, pi) => <React.Fragment key={pi}>
        {part.prefix && <Role role="stat" style={{...small, marginRight: fs * 0.04}}>{part.prefix}</Role>}
        {part.value.split('').map((c, k) => {
          if (!/\d/.test(c)) return <Role key={k} role="stat" style={{height: row, lineHeight: `${row}px`, fontSize: fs, fontFamily: font.numeral, fontWeight: 700, color: 'var(--ink)'}}>{c}</Role>;
          di++; const d = Number(c), pos = posAt(f, start, di, d), speed = Math.abs(pos - posAt(f - 1, start, di, d)), gate = clamp((speed - 0.06) / 0.44, 0, 1);
          return <Role key={k} role="stat" style={{position: 'relative', width: cell, height: row, overflow: 'hidden'}}>
            {gate > 0.001 && <><Strip pos={pos} fs={fs} color="var(--ink)" opacity={0.25 * gate} dy={row * 0.5}/><Strip pos={pos} fs={fs} color="var(--ink)" opacity={0.12 * gate} dy={-row * 0.5}/></>}
            <Strip pos={pos} fs={fs} color="var(--ink)"/>
          </Role>;
        })}
        {part.suffix && <Role role="stat" style={{...small, marginLeft: fs * 0.04, marginRight: pi < p.parts.length - 1 ? fs * 0.1 : 0}}>{part.suffix}</Role>}
      </React.Fragment>)}
    </div>
    {p.label && <>
      <div style={{width: 120, height: 2, background: 'var(--hair)', margin: '56px 0 40px', opacity: enter(f, labelAt)}}/>
      <Role role="body" style={{fontFamily: font.sans, fontSize: 60, letterSpacing: '0.5em', marginRight: '-0.5em', color: 'var(--muted)', opacity: enter(f, labelAt), transform: `translateY(${(1 - enter(f, labelAt)) * 14}px)`}}>{p.label}</Role>
    </>}
  </div>;
};

export const BigFigure: Spec<BigFigureProps> = {
  id: 'BigFigure', type: 'figure', minSeconds: 2.4, sampleSeconds: 5,
  Component: ({p, f, from, to}) => <BigFigureView p={p} f={f} from={from} to={to}/>,
  validate: (p) => {
    needCount('BigFigure', 'parts', p.parts?.length ?? 0, 1, 2);
    p.parts.forEach((part, i) => { if (typeof part.value !== 'string') fail('BigFigure', `parts[${i}].value`, 'must be a string of digits, for example "6"'); if (!/^[0-9.,]+$/.test(part.value) || !/\d/.test(part.value)) fail('BigFigure', `parts[${i}].value`, 'digits only (with . or ,)'); if (part.prefix) needText('BigFigure', `parts[${i}].prefix`, part.prefix, 3); if (part.suffix) needText('BigFigure', `parts[${i}].suffix`, part.suffix, 3); });
    if (digitsOf(p.parts) > 6) fail('BigFigure', 'parts', `${digitsOf(p.parts)} digits, the limit is 6`);
    if (p.label) needText('BigFigure', 'label', p.label, 4);
    needTime('BigFigure', 'at', p.at);
  },
  sample: {parts: [{value: '11', suffix: '月'}, {value: '4', suffix: '日'}], label: '测试', at: 0.4},
  sampleMax: {parts: [{prefix: '约', value: '1,250', suffix: '万'}], label: '用户数', at: 0.4},
};

import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {AudioLayer} from '../../components/AudioLayer';
import {LayoutAudit} from '../../components/LayoutAudit';
import {EASE, mix, ramp} from '../../components/shotcraft-vendor/_fixtures/Polish';
import {CursorFlyover} from './effects/CursorFlyover';
import {ConvergeMerge} from './effects/ConvergeMerge';
import {DocParkPills} from './effects/DocParkPills';
import {ExplodedView} from './effects/ExplodedView';
import {Odometer} from './effects/Odometer';
import {BraceExpand} from './effects/BraceExpand';

// Fixed-frame editorial system (references/visual-system.md). Single focus: the topic never changes, the shot title changes only
// between shots, and the caption is the one text that moves with the speech. Everything else is the visual: a picture, a
// sourced quote, a relation or a figure, chosen sentence by sentence. Light and dark share all of this; only tokens differ.
const themes: Record<string, Record<string, string>> = {
  light: {'--page': '#F4EFE4', '--ink': '#23201B', '--muted': '#857E70', '--accent': '#BF5F3B', '--mark': 'rgba(191,95,59,.24)', '--blend': 'multiply', '--grade': 'saturate(.8)'},
  dark: {'--page': '#100F0D', '--ink': '#F3EEE3', '--muted': '#A59E8E', '--accent': '#E58D62', '--mark': 'rgba(229,141,98,.3)', '--blend': 'normal', '--grade': 'saturate(.88)'},
};
const C = {paper: 'var(--page)', ink: 'var(--ink)', muted: 'var(--muted)', clay: 'var(--accent)', mark: 'var(--mark)'};
const serif = '"Songti SC","STSong",serif';
const numeral = 'Baskerville,"Songti SC",serif';
const sans = '"PingFang SC","Hiragino Sans GB",sans-serif';
const Z = {margin: 72, width: 936, topic: 104, window: {top: 226, height: 1130}, caption: {top: 1380, height: 170}};
const W = 1080, H = Z.window.height;
const F = (s: number) => Math.ceil(s * 30);
const seen = (f: number, at?: number) => at === undefined || f >= F(at);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const abs = (left: number, top: number, width?: number, height?: number): React.CSSProperties => ({position: 'absolute', left, top, ...(width === undefined ? {} : {width}), ...(height === undefined ? {} : {height})});
const centred: React.CSSProperties = {display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'};
const Role = ({role = 'body', style, children}: {role?: string; style?: React.CSSProperties; children: React.ReactNode}) => <div data-layout-role={role} style={style}>{children}</div>;
const Rise = ({f, at, children}: {f: number; at?: number; children: React.ReactNode}) => {
  const a = at === undefined ? 1 : seen(f, at) ? ramp(f, F(at), 16, EASE.out) : 0;
  return <div style={{opacity: a, transform: `translateY(${(1 - a) * 18}px)`}}>{children}</div>;
};

// ---------- visuals ----------
type Key = {at?: number; s: number; fx: number; fy: number};
function Picture({m, f, from, to}: {m: any; f: number; from: number; to: number}) {
  const base = Math.max(W / m.w, H / m.h);
  const keys: Key[] = m.keys ?? [{s: m.fit === 'contain' ? Math.min(W / m.w, H / m.h) : base, fx: m.fx ?? 0.5, fy: m.fy ?? 0.5}];
  let state = keys[0];
  for (const k of keys.slice(1)) {
    const t = ramp(f, F(k.at ?? from), 48, EASE.smooth);
    state = {s: mix(state.s, k.s, t), fx: mix(state.fx, k.fx, t), fy: mix(state.fy, k.fy, t)};
  }
  const s = state.s * (1 + 0.035 * clamp((f - F(from)) / Math.max(1, F(to) - F(from)), 0, 1)), dw = m.w * s, dh = m.h * s;
  const left = dw >= W ? clamp(W / 2 - state.fx * dw, W - dw, 0) : (W - dw) / 2;
  const top = dh >= H ? clamp(H / 2 - state.fy * dh, H - dh, 0) : (H - dh) / 2;
  const mask = m.soft ? 'radial-gradient(ellipse 50% 50% at 50% 50%,#000 62%,transparent 100%)' : 'linear-gradient(180deg,transparent 0,#000 5%,#000 95%,transparent 100%)';
  const marks: any[] = m.marks ?? [];
  return <div style={{position: 'absolute', inset: 0, mixBlendMode: (m.blend ?? 'var(--blend)') as any, filter: marks.length ? undefined : `brightness(${m.lift ?? 1}) var(--grade)`, WebkitMaskImage: marks.length ? undefined : mask}}>
    <div style={{position: 'absolute', left, top, width: dw, height: dh}}>
      <Img src={staticFile(m.photo)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', filter: m.dim ? `brightness(${m.dim})` : undefined}}/>
      {marks.flatMap((mk, i) => (mk.rects as number[][]).map(([x, y, w, h], k) => {
        if (!seen(f, mk.at)) return null;
        const p = ramp(f, F(mk.at) + k * 8, 18, EASE.out), pad = 6;
        return <div key={`${i}-${k}`} style={{position: 'absolute', left: `${((x - pad) / m.w) * 100}%`, top: `${((y - pad) / m.h) * 100}%`, width: `${(((w + pad * 2) * p) / m.w) * 100}%`, height: `${((h + pad * 2) / m.h) * 100}%`, background: 'rgba(224,112,68,.38)', mixBlendMode: 'multiply', borderRadius: 8, boxShadow: `0 0 0 ${3 * p}px rgba(224,112,68,${0.75 * p})`}}/>;
      }))}
    </div>
  </div>;
}
// A verbatim sourced sentence; the marked phrases light up on their spoken cues.
function Quote({m, f}: {m: any; f: number}) {
  const parts: React.ReactNode[] = []; let rest: string = m.text;
  (m.marks ?? []).forEach((k: any, i: number) => {
    const [a, b] = rest.split(k.text); if (b === undefined) throw Error('Mark not in quote: ' + k.text);
    const p = seen(f, k.at) ? ramp(f, F(k.at), 20, EASE.smooth) : 0;
    parts.push(a, <span key={i} style={{backgroundImage: `linear-gradient(${C.mark},${C.mark})`, backgroundRepeat: 'no-repeat', backgroundSize: `${p * 100}% 100%`, color: p > 0.5 ? C.ink : undefined, WebkitBoxDecorationBreak: 'clone', padding: '2px 6px', ...(k.text.length <= 10 ? {display: 'inline-block', whiteSpace: 'nowrap'} : {})}}>{k.text}</span>);
    rest = b;
  });
  parts.push(rest);
  return <div style={{...abs(Z.margin, 0, Z.width, H), ...centred, gap: 44}}>
    <Role role="source" style={{fontFamily: sans, fontSize: 34, fontWeight: 600, color: C.clay}}>{m.source}</Role>
    <Role style={{fontFamily: serif, fontSize: m.size ?? 72, fontWeight: 700, lineHeight: 1.45, color: C.ink, textWrap: 'balance' as any}}>{parts}</Role>
  </div>;
}
// Who answers for whom: a relation drawn with words.
const Link = ({m, f}: {m: any; f: number}) => {
  const p = ramp(f, F(m.at), 26, EASE.smooth);
  return <div style={{...abs(0, 0, W, H), ...centred, gap: 40}}>
    <Role role="stat" style={{fontFamily: numeral, fontSize: 170, lineHeight: 1, color: C.ink}}>{m.from}</Role>
    <svg width="60" height="170" viewBox="0 0 60 170" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M30 165V10M12 30L30 8l18 22" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p}/></svg>
    <Role role="stat" style={{fontFamily: serif, fontSize: 210, fontWeight: 700, lineHeight: 1, color: C.clay, opacity: p}}>{m.to}</Role>
  </div>;
};
const Type = ({m}: {m: any}) => <div style={{...abs(Z.margin, 0, Z.width, H), ...centred, gap: 30}}>
  {(m.lines as any[]).map((l) => <Role key={l.text} role="stat" style={{fontFamily: l.number ? numeral : serif, fontSize: l.size ?? 110, fontWeight: l.number ? 400 : 700, lineHeight: 1.15, color: l.accent ? C.clay : l.muted ? C.muted : C.ink}}>{l.text}</Role>)}
</div>;
const Numbers = ({m, f}: {m: any; f: number}) => <div style={{...abs(0, 0, W, H), ...centred, gap: 90}}>
  {(m.rows as any[]).map((r, i) => <div key={r.big}>
    <Rise f={f} at={r.at}><Role role="stat" style={{fontFamily: numeral, fontSize: 220, lineHeight: 1.05, color: i === m.rows.length - 1 ? C.clay : C.ink}}>{r.big}</Role></Rise>
    <Rise f={f} at={r.labelAt ?? r.at}><Role style={{fontFamily: sans, fontSize: 46, color: C.muted, marginTop: 14}}>{r.label}</Role></Rise>
  </div>)}
</div>;

function Trio({m, f}: {m: any; f: number}) {
  const phones: any[] = m.phones, cues: number[] = m.cues;
  let focus = 0; cues.forEach((c, i) => { if (i > 0) focus = mix(focus, i, ramp(f, F(c), 34, EASE.smooth)); });
  const idx = cues.map((c) => seen(f, c)).lastIndexOf(true);
  const nodeOn = ramp(f, F(m.at), 20, EASE.out);
  return <div style={{position: 'absolute', inset: 0}}>
    <Role role="stat" style={{...abs(0, 22, W, 130), ...centred, fontFamily: serif, fontSize: 104, fontWeight: 700, color: C.clay, opacity: nodeOn, transform: `translateY(${(1 - nodeOn) * -20}px)`}}>千问</Role>
    {phones.map((ph, i) => {
      const d = i - focus, a = Math.min(1, Math.abs(d)), scale = mix(1, 0.62, a), x = W / 2 + d * 400 - (ph.w * scale) / 2, y = 170 + mix(0, 120, a);
      const shown = seen(f, m.at), op = shown ? mix(1, 0.38, a) : 0;
      return <div key={ph.label} style={{position: 'absolute', left: x, top: y, width: ph.w * scale, height: ph.h * scale, opacity: op}}>
        <Img src={staticFile(ph.photo)} style={{width: '100%', height: '100%', filter: 'drop-shadow(0 28px 40px rgba(0,0,0,.35))'}}/>
        <Role role="body" style={{...abs(0, ph.h * scale + 4, ph.w * scale), ...centred, fontFamily: serif, fontSize: 52, fontWeight: 700, color: C.ink, opacity: mix(1, 0, a)}}>{ph.label}</Role>
      </div>;
    })}
    {idx >= 0 && <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={W} height={H}><path d={`M${W / 2} 160 V190`} stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - ramp(f, F(cues[idx]), 18, EASE.out)}/></svg>}
  </div>;
}

// One official phone on a stage: the Qwen node above, a line drawn down to the phone, its name below.
function PhoneStage({m, f}: {m: any; f: number}) {
  const a = ramp(f, F(m.at), 22, EASE.out), line = ramp(f, F(m.at) + 6, 20, EASE.out);
  return <div style={{position: 'absolute', inset: 0}}>
    <Role role="stat" style={{...abs(0, 14, W, 130), ...centred, fontFamily: serif, fontSize: 100, fontWeight: 700, color: C.clay, opacity: a}}>千问</Role>
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={W} height={H}><path d="M540 150V196" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - line}/></svg>
    <div style={{position: 'absolute', left: (W - m.w) / 2, top: 210 + (1 - a) * 60, width: m.w, height: m.h, opacity: a}}>
      <Img src={staticFile(m.photo)} style={{width: '100%', height: '100%', filter: 'drop-shadow(0 30px 44px rgba(0,0,0,.38))'}}/>
    </div>
    <Role role="body" style={{...abs(0, 210 + m.h + 14, W), ...centred, fontFamily: serif, fontSize: 60, fontWeight: 700, color: C.ink, opacity: a}}>{m.label}</Role>
  </div>;
}

function Visual({m, f, from, to, opacity}: {m: any; f: number; from: number; to: number; opacity: number}) {
  if (m.photo && m.kind === 'page') return <div style={{position: 'absolute', inset: 0, opacity: opacity < 1 ? opacity : undefined}}><Picture m={m} f={f} from={from} to={to}/>{m.label && <Role role="body" style={{...abs(0, H - 190, W), ...centred, fontFamily: serif, fontSize: 60, fontWeight: 700, color: C.ink}}>{m.label}</Role>}</div>;
  if (m.photo && !m.kind) return <div style={{position: 'absolute', inset: 0, opacity: opacity < 1 ? opacity : undefined}}><Picture m={m} f={f} from={from} to={to}/></div>;
  const body = m.kind === 'odometer' ? <Odometer m={{...m, windowW: W, windowH: H}} f={f}/> : m.kind === 'brace' ? <BraceExpand m={{...m, windowW: W, windowH: H}} f={f}/> : m.kind === 'flyover' ? <CursorFlyover m={{...m, windowW: W, windowH: H}} f={f}/> : m.kind === 'converge' ? <ConvergeMerge m={{...m, width: W, height: H}} f={f}/> : m.kind === 'docpark' ? <DocParkPills m={{...m, windowW: W, windowH: H}} f={f}/> : m.kind === 'exploded' ? <ExplodedView m={{...m, windowW: W, windowH: H}} f={f}/> : m.kind === 'phone' ? <PhoneStage m={m} f={f}/> : m.kind === 'trio' ? <Trio m={m} f={f}/> : m.kind === 'quote' ? <Quote m={m} f={f}/> : m.kind === 'link' ? <Link m={{...m, at: from}} f={f}/> : m.kind === 'numbers' ? <Numbers m={m} f={f}/> : <Type m={m}/>;
  return <div style={{position: 'absolute', inset: 0, opacity}}>{body}</div>;
}

export function FrameFilm({plan}: {plan: any}) {
  const f = useCurrentFrame(), shots: any[] = plan.directorRender?.shots ?? [];
  const index = shots.findIndex((x) => f >= F(x.start) && f < F(x.end));
  if (index < 0) throw Error('Uncovered frame ' + f);
  const shot = shots[index], beats: any[] = shot.beats, shown = beats.filter((b) => seen(f, b.at));
  const current = shown.at(-1), previous = shown.at(-2);
  const cap = plan.captions.find((c: any) => f >= F(Math.max(c.start, c.displayStart ?? c.start)) && f < F(c.end));
  const a = current?.at === undefined ? 1 : ramp(f, F(current.at), 20, EASE.smooth);
  const next = current ? beats[beats.indexOf(current) + 1] : undefined;
  const fade = Math.min(index > 0 ? clamp((f - F(shot.start)) / 10, 0, 1) : 1, index < shots.length - 1 ? clamp((F(shot.end) - f) / 8, 0, 1) : 1);
  return <AbsoluteFill data-svm-root style={{...(themes[plan.style?.frameTheme ?? 'light'] as React.CSSProperties), background: C.paper}}>
    <AudioLayer plan={plan}/>
    <div style={{position: 'absolute', left: 0, top: 240, width: W, height: 1100, background: 'radial-gradient(ellipse 62% 52% at 50% 48%,var(--mark),transparent 100%)', opacity: 0.55}}/>
    <Role role="label" style={{...abs(Z.margin, Z.topic, Z.width), textAlign: 'center', fontFamily: serif, fontSize: 72, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap'}}>{plan.meta.topicLabel}</Role>
    <div style={{position: 'absolute', inset: 0, opacity: EASE.smooth(fade)}}>
      <div data-layout-role="media" data-media-crop="intentional" style={{...abs(0, Z.window.top, W, H), overflow: 'hidden'}}>
        {previous && a < 1 && <Visual m={previous.media} f={f} from={previous.at ?? shot.start} to={current.at} opacity={Math.max(0, 1 - a * 2.2)}/>}
        {current && <Visual m={current.media} f={f} from={current.at ?? shot.start} to={next?.at ?? shot.end} opacity={Math.max(0, Math.min(1, a * 2.2 - 1.2))}/>}
      </div>
      {current?.credit && <Role role="source" style={{...abs(Z.margin, Z.window.top + H - 44, Z.width), textAlign: 'right', fontFamily: sans, fontSize: 28, color: C.muted}}>{current.credit}</Role>}
    </div>
    {cap && <Role role="caption" style={{...abs(Z.margin, Z.caption.top, Z.width, Z.caption.height), ...centred, fontFamily: sans, fontSize: 54, fontWeight: 600, lineHeight: 1.3, color: C.ink, textWrap: 'balance'}}>{cap.text.replace(/[，。！？；：、“”]/g, ' ').replace(/(\d)([月日])/g, '$1\u2060$2')}</Role>}
    {plan.style?.layoutAudit && <LayoutAudit plan={plan}/>}
  </AbsoluteFill>;
}

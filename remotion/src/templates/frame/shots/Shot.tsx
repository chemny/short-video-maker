import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Video} from '@remotion/media';
import {F, Role, THEMES, W, Z, abs, font} from '../kit';
import {byType} from '../registry';
import {Dir, TRANSITION_FRAMES, Transition, enterFx, exitFx, mergeFx} from './transitions';
import {CameraShot, FRAME, Fit, Move, Region, ANCHOR, baseScale, centre, ease, easeOut, fitFor, lerp, placement, viewAt, clamp} from './camera';

// One shot of a film made from real pictures: a picture or footage moved by the camera grammar, with its overlay, scrims and a
// caption. Everything is a function of the local frame. Time fields are seconds from the start of the shot.
export type Media = {kind: 'image' | 'video'; src: string; mw: number; mh: number; sourceStart?: number; palette?: string[]};
export {TRANSITION_FRAMES};
export type {Transition, Dir};
export type ShotSpec = {
  id: string; keyword?: string; transition?: Transition; dir?: Dir; layout?: 'card' | 'float' | 'stack'; lane?: -1 | 1; start: number; end: number; rung: 'video' | 'image' | 'recording' | 'text'; move: Move;
  media?: Media; mediaB?: Media; labels?: [string, string];
  region?: Region; regionEnd?: Region; fit?: Fit; at?: number;
  figure?: unknown; onScreen?: unknown; keywordAt?: number;
};
export type Caption = {start: number; end: number; text: string};
export type Hook = {lines: {text: string; at: number; accent?: boolean}[]; seconds: number};
export type Bgm = {src: string; volume: number; synthetic?: boolean};
export type Sfx = {t: number; kind: string; gain: number; src: string};
export type Label = {start: number; end: number; text: string; sub?: string};
export type Film = {labels?: Label[]; fps: number; durationInFrames: number; theme: 'light' | 'dark'; shots: ShotSpec[]; captions: Caption[]; audio?: string; hook?: Hook; bgm?: Bgm; sfx?: Sfx[]};

const ink = '#F7F3EA';
const Picture: React.FC<{m: Media; style: React.CSSProperties; frame: number}> = ({m, style, frame}) => m.kind === 'video'
  ? <Video src={staticFile(m.src)} muted trimBefore={F(m.sourceStart ?? 0)} objectFit="fill" style={style}/>
  : <Img src={staticFile(m.src)} style={{...style, maxWidth: 'none'}} data-frame={frame}/>;

// Backdrop for a picture that leaves room: a gradient drawn from the picture's own corner colours (darkened, a little more saturated),
// a soft glow behind the card, and the blurred picture underneath for texture. `drift` turns the gradient slowly over the shot.
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHsl = ([r, g, b]: number[]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l]; const sat = d / (1 - Math.abs(2 * l - 1)); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, sat, l]; };
const tone = (rgb: number[], lightness: number, boost = 1.25) => { const [h, sat] = toHsl(rgb); return `hsl(${Math.round(h)} ${Math.round(clamp(sat * boost, 0.12, 0.62) * 100)}% ${Math.round(lightness * 100)}%)`; };
const mean = (a: number[], b: number[]) => a.map((v, i) => Math.round((v + b[i]) / 2));
const Backdrop: React.FC<{m: Media; contain: boolean; shift?: number; drift?: number}> = ({m, contain, shift = 0, drift = 0}) => {
  const pal = m.palette?.length === 4 ? m.palette.map(hex) : null;
  const top = pal ? mean(pal[0], pal[1]) : [30, 28, 26], bottom = pal ? mean(pal[2], pal[3]) : [20, 19, 18], mid = mean(top, bottom);
  return <AbsoluteFill style={{background: '#0d0c0a'}}>
    {contain && <AbsoluteFill style={{background: `linear-gradient(${172 + drift}deg, ${tone(top, 0.30)} 0%, ${tone(mid, 0.2)} 52%, ${tone(bottom, 0.13)} 100%)`}}/>}
    {contain && m.kind === 'image' && <Img src={staticFile(m.src)} style={{position: 'absolute', left: -120 + shift, top: -120, width: FRAME.w + 240, height: FRAME.h + 240, objectFit: 'cover', filter: 'blur(60px) brightness(.8) saturate(1.2)', opacity: 0.42, maxWidth: 'none'}}/>}
    {contain && <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 34% at 50% 50%, ${tone(mid, 0.42, 1.1).replace(')', ' / .38)')}, transparent 100%)`}}/>}
  </AbsoluteFill>;
};

const Cursor: React.FC<{x: number; y: number; click: number}> = ({x, y, click}) => (
  <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0}}>
    {click > 0 && <div style={{position: 'absolute', left: -60 * click - 6, top: -60 * click - 6, width: 120 * click + 12, height: 120 * click + 12, borderRadius: '50%', border: '5px solid var(--accent)', opacity: 1 - click}}/>}
    <svg width="88" height="88" viewBox="0 0 24 24" style={{position: 'absolute', left: -7, top: -4, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.45))'}}><path d="M5 3l14 8-6 1.8L9.8 19z" fill="#fff" stroke="#14120F" strokeWidth="1.4" strokeLinejoin="round"/></svg>
  </div>
);

const MediaShot: React.FC<{s: ShotSpec; f: number; n: number}> = ({s, f, n}) => {
  const m = s.media!, p = n > 1 ? f / (n - 1) : 1, cam: CameraShot = {move: s.move, mw: m.mw, mh: m.mh, region: s.region, regionEnd: s.regionEnd, fit: s.fit};
  const contain = (s.fit ?? fitFor(m.mw, m.mh)) === 'contain', view = viewAt(cam, p), pl = placement(view, m.mw, m.mh, s.fit, {x: 0, y: contain ? (s.lane ?? 0) * 70 : 0});
  const at = F(s.at ?? 0.5), rise = clamp((f - at) / 10, 0, 1), r = s.region;
  const count = s.move === 'count' ? byType('figure') : undefined;
  const dim = s.move === 'count' ? 0.72 : 0;
  // cursor: starts low-left of the target and arrives at the middle of the region on its cue, then clicks
  const target = r ? centre(r) : {x: 0.5, y: 0.5};
  const arrive = F(s.at ?? (n / 30) * 0.55), travel = clamp(f / Math.max(1, arrive), 0, 1), q = easeOut(travel);
  const tx = pl.left + target.x * pl.width, ty = pl.top + target.y * pl.height;
  const cx = lerp(q, tx - 300, tx), cy = lerp(q, ty + 380, ty), click = f >= arrive ? clamp((f - arrive) / 14, 0, 1) : 0;
  // layouts for a picture that does not fill the frame: 'float' tilts the card slowly in perspective while the backdrop drifts the
  // other way (parallax); 'stack' shows a second picture behind it, offset and turned. Both stay inside the frame and end at rest.
  const layout = contain ? (s.layout ?? 'card') : 'card', sign = s.dir === 'right' ? -1 : 1;
  const tilt = layout === 'float' ? `perspective(1500px) rotateY(${lerp(ease(p), -7, 7) * sign}deg) rotateX(${lerp(ease(p), 3.5, -2)}deg) scale(0.95)` : undefined;
  const sb = s.mediaB, stackB = layout === 'stack' && sb ? (() => { const sc = baseScale(sb.mw, sb.mh, 'contain') * 0.82; const w = sb.mw * sc, h = sb.mh * sc; return {w, h, x: pl.left + pl.width / 2 - w / 2 - 120, y: pl.top + pl.height / 2 - h / 2 - 90}; })() : null;
  // accent: a short warm flash when a highlight or a figure lands
  const accentAt = s.move === 'highlight' ? at : s.move === 'count' ? at + F(1.2) : -1, flash = accentAt >= 0 && f >= accentAt && f < accentAt + 5 ? 0.32 * (1 - (f - accentAt) / 5) : 0;
  return <AbsoluteFill>
    <Backdrop m={m} contain={contain} shift={layout === 'float' ? lerp(ease(p), 60, -60) * sign : 0} drift={lerp(p, -8, 8)}/>
    {stackB && sb && <div style={{position: 'absolute', left: stackB.x, top: stackB.y, width: stackB.w, height: stackB.h, borderRadius: 18, overflow: 'hidden', transform: `rotate(${-5 * sign}deg)`, filter: 'brightness(.58) blur(1.5px)', boxShadow: '0 24px 60px rgba(0,0,0,.5)'}}><Picture m={sb} frame={f} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}/></div>}
    <div style={{position: 'absolute', left: pl.left, top: pl.top, width: pl.width, height: pl.height, boxShadow: contain ? '0 30px 80px rgba(0,0,0,.5)' : undefined, borderRadius: contain && (layout !== 'card' || pl.width < FRAME.w - 1) ? 18 : 0, overflow: 'hidden', transform: tilt, transformOrigin: 'center center'}}>
      <Picture m={m} frame={f} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}/>
      {s.move === 'highlight' && r && rise > 0 && <div style={{position: 'absolute', left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, border: '6px solid var(--accent)', borderRadius: 14, boxShadow: `0 0 0 9999px rgba(0,0,0,${0.38 * rise}), 0 0 36px var(--accent)`, opacity: rise}}/>}
    </div>
    {s.keyword && <KeywordPlate text={s.keyword} f={f} at={F(s.keywordAt ?? 0.25)}/>}
    {flash > 0 && <AbsoluteFill style={{background: `rgba(255,236,210,${flash})`, mixBlendMode: 'screen'}}/>}
    {dim > 0 && <AbsoluteFill style={{background: `rgba(10,9,8,${dim})`, backdropFilter: 'blur(14px)'}}/>}
    {s.move === 'cursor' && r && <Cursor x={cx} y={cy} click={click}/>}
    {count && s.figure !== undefined && <div data-layout-role="media" style={{...abs(Z.margin, Z.stage.top, Z.width, Z.stage.height)}}><count.Component p={s.figure} f={f} from={0} to={n / 30} W={Z.width} H={Z.stage.height}/></div>}
  </AbsoluteFill>;
};

// Optional keyword plate: two to eight characters in the serif face above a picture that leaves room, with a short accent bar. Off unless
// a beat sets `keyword` (references/shot-script.md); it sits below the platform's top band (y 290) and rises in on its cue.
const KeywordPlate: React.FC<{text: string; f: number; at: number}> = ({text, f, at}) => {
  const a = easeOut(clamp((f - at) / 14, 0, 1)), size = Math.min(150, Math.floor(880 / Math.max([...text].length, 1)));
  return <div data-layout-role="title" style={{...abs(0, 330, 1080), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, opacity: a, transform: `translateY(${(1 - a) * 26}px)`}}>
    <div style={{fontFamily: font.serif, fontWeight: 700, fontSize: size, lineHeight: 1.05, letterSpacing: '0.04em', color: '#F7F3EA', textShadow: '0 4px 30px rgba(0,0,0,.55)', whiteSpace: 'nowrap'}}>{text}</div>
    <div style={{width: 96 * a, height: 7, borderRadius: 4, background: 'var(--accent)'}}/>
  </div>;
};

const CompareShot: React.FC<{s: ShotSpec; f: number}> = ({s, f}) => {
  const a = s.media!, b = s.mediaB!, rise = ease(clamp(f / 14, 0, 1)), rise2 = ease(clamp((f - F(s.at ?? 1)) / 14, 0, 1));
  const card = (m: Media, top: number, k: number, label?: string) => <div style={{...abs(Z.margin, top, Z.width, 480), borderRadius: 26, overflow: 'hidden', opacity: k, transform: `translateY(${(1 - k) * 40}px)`, boxShadow: '0 24px 60px rgba(0,0,0,.45)', background: '#000'}}>
    <Picture m={m} frame={f} style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover'}}/>
    {label && <div style={{position: 'absolute', left: 20, top: 20, padding: '8px 22px', borderRadius: 999, background: 'rgba(10,9,8,.72)', color: ink, fontFamily: font.sans, fontWeight: 600, fontSize: 34}}>{label}</div>}
  </div>;
  return <AbsoluteFill><Backdrop m={a} contain/>{card(a, 310, rise, s.labels?.[0])}{card(b, 820, rise2, s.labels?.[1])}</AbsoluteFill>;
};

const TextShot: React.FC<{s: ShotSpec; f: number; n: number}> = ({s, f, n}) => {
  const spec = byType('hook');
  return <AbsoluteFill style={{background: 'var(--page)'}}>
    <div style={{...abs(0, Z.stage.top - 30, W, Z.stage.height + 60), background: 'radial-gradient(ellipse 58% 48% at 50% 50%,var(--glow),transparent 100%)'}}/>
    <div data-layout-role="media" style={{...abs(Z.margin, Z.stage.top, Z.width, Z.stage.height)}}>{spec && <spec.Component p={s.onScreen} f={f} from={0} to={n / 30} W={Z.width} H={Z.stage.height}/>}</div>
  </AbsoluteFill>;
};

const ShotBody: React.FC<{s: ShotSpec; n: number; lead: number}> = ({s, n, lead}) => {
  const f = Math.max(0, useCurrentFrame() - lead);
  if (s.rung === 'text') return <TextShot s={s} f={f} n={n}/>;
  if (s.move === 'compare' && s.mediaB) return <CompareShot s={s} f={f}/>;
  return <MediaShot s={s} f={f} n={n}/>;
};

// A shot that is entered by a transition starts `lead` frames early on top of the previous shot; its camera and cues still count from
// its own start. While the NEXT shot comes in, this one plays that transition's exit effect over its last `exit.frames` frames.
export type Exit = {type: Transition; dir: Dir; frames: number};
export const ShotView: React.FC<{s: ShotSpec; theme: 'light' | 'dark'; exit?: Exit}> = ({s, theme, exit}) => {
  const type = s.transition ?? 'cut', lead = TRANSITION_FRAMES[type], n = F(s.end) - F(s.start), total = n + lead, raw = useCurrentFrame();
  const focus = s.region && s.media ? {x: (s.region.x + s.region.w / 2) * 1080, y: 860} : undefined;
  const inFx = lead ? enterFx(type, clamp(raw / lead, 0, 1), s.dir ?? 'left', focus) : {};
  const outFx = exit && exit.frames ? exitFx(exit.type, clamp((raw - (total - exit.frames)) / exit.frames, 0, 1), exit.dir) : {};
  const style: React.CSSProperties = {...(THEMES[theme] as React.CSSProperties), fontFamily: font.sans, ...mergeFx(inFx, outFx)};
  return <AbsoluteFill style={style}><ShotBody s={s} n={n} lead={lead}/></AbsoluteFill>;
};

// Opening hook: one or two lines already rising at frame 0 over a darkened first shot, gone before the picture needs to speak.
export const HookLayer: React.FC<{hook: Hook}> = ({hook}) => {
  const f = useCurrentFrame(), n = F(hook.seconds), spec = byType('hook');
  const out = 1 - ease(clamp((f - (n - 10)) / 10, 0, 1)), dim = 0.66 * out;
  return <AbsoluteFill style={{...(THEMES.dark as React.CSSProperties), opacity: out === 0 ? 0 : 1}}>
    <AbsoluteFill style={{background: `rgba(10,9,8,${dim})`}}/>
    <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 30% at 50% 47%, rgba(10,9,8,${0.5 * out}), transparent 100%)`}}/>
    <div data-layout-role="title" style={{...abs(Z.margin, Z.stage.top, Z.width, Z.stage.height), opacity: out}}>{spec && <spec.Component p={{lines: hook.lines}} f={f} from={0} to={hook.seconds} W={Z.width} H={Z.stage.height}/>}</div>
  </AbsoluteFill>;
};

export const CaptionLayer: React.FC<{captions: Caption[]; light: boolean}> = ({captions, light}) => <>
  <AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(10,9,8,0) 0%, rgba(10,9,8,0) 55%, rgba(10,9,8,.72) 68%, rgba(10,9,8,.82) 76%, rgba(10,9,8,.5) 88%, rgba(10,9,8,.34) 100%)', pointerEvents: 'none', opacity: light ? 0.8 : 1}}/>
  {captions.map((c, i) => <Sequence key={i} from={F(c.start)} durationInFrames={Math.max(1, F(c.end) - F(c.start))}><CaptionText text={c.text}/></Sequence>)}
</>;

const CaptionText: React.FC<{text: string}> = ({text}) => {
  const f = useCurrentFrame(), a = clamp(f / 5, 0, 1);
  return <div data-layout-role="caption" style={{...abs((W - 700) / 2, Z.caption.top, 700, Z.caption.height), display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: font.sans, fontSize: 50, fontWeight: 600, lineHeight: 1.3, color: ink, whiteSpace: 'nowrap', textShadow: '0 3px 18px rgba(0,0,0,.55)', opacity: a, transform: `translateY(${(1 - a) * 10}px)`}}>{text}</div>;
};

// Sampler only: the name of the effect on screen, in the reserved top band.
export const LabelLayer: React.FC<{labels: Label[]}> = ({labels}) => <>{labels.map((l, i) => <Sequence key={i} from={F(l.start)} durationInFrames={Math.max(1, F(l.end) - F(l.start))}>
  <div style={{...abs(0, 96, 1080), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
    <div style={{padding: '10px 34px', borderRadius: 999, background: 'rgba(10,9,8,.78)', color: '#F7F3EA', fontFamily: font.serif, fontWeight: 700, fontSize: 52}}>{l.text}</div>
    {l.sub && <div style={{color: '#F7F3EA', fontFamily: font.sans, fontSize: 30, textShadow: '0 2px 10px rgba(0,0,0,.7)'}}>{l.sub}</div>}
  </div></Sequence>)}</>;

import React from 'react';
import {Img, Loop, OffthreadVideo, staticFile} from 'remotion';
import {EASE, ramp} from '../../components/shotcraft-vendor/_fixtures/Polish';

// Warm-paper template kit: tokens, motion primitives and imagery. Restrained editorial look: ivory paper, near-black ink,
// one clay accent, serif headlines, hairlines instead of boxes. Every element is deterministic (no Date/random).
export const P = {paper: '#F4F1EA', card: '#FBF9F4', ink: '#1F1D19', muted: '#6F6A5F', line: '#D8D1C0', clay: '#D97757', sky: '#6A9BCC', olive: '#788C5D', fig: '#C46686', kraft: '#D4A27F', oat: '#E8E0CF'};
const sansFamily = '"PingFang SC","Hiragino Sans GB","Helvetica Neue",sans-serif';
const serifFamily = '"Songti SC","Source Han Serif SC","STSong",serif';
export const abs = (left: number, top: number, width: number, height?: number): React.CSSProperties => ({position: 'absolute', left, top, width, ...(height === undefined ? {} : {height})});
export const flex = (extra: React.CSSProperties = {}): React.CSSProperties => ({display: 'flex', alignItems: 'center', justifyContent: 'center', ...extra});
export const serif = (size: number, color = P.ink, extra: React.CSSProperties = {}): React.CSSProperties => ({fontFamily: serifFamily, fontSize: size, fontWeight: 700, color, lineHeight: 1.22, ...extra});
export const sans = (size: number, color = P.ink, weight = 500, extra: React.CSSProperties = {}): React.CSSProperties => ({fontFamily: sansFamily, fontSize: size, fontWeight: weight, color, lineHeight: 1.35, ...extra});

// ---------- motion ----------
export const FPS = 30;
export const F = (seconds: number) => Math.ceil(seconds * FPS);
export const prog = (f: number, at: number, dur = 16, ease: (t: number) => number = EASE.snappy) => ramp(f, F(at), dur, ease);
// A missing cue means "visible from the start of the shot" (context-first).
export const seen = (f: number, at?: number) => at === undefined || (Number.isFinite(at) && f >= F(at));
export {EASE};

export const Role = ({role = 'body', children, style}: {role?: string; children: React.ReactNode; style?: React.CSSProperties}) =>
  <div data-layout-role={role} style={style}>{children}</div>;

// Fade and rise at the spoken cue; stays until the shot ends.
export const Reveal = ({f, at, children, style, dy = 22, dur = 16}: {f: number; at?: number; children: React.ReactNode; style?: React.CSSProperties; dy?: number; dur?: number}) => {
  if (!seen(f, at)) return null;
  const a = at === undefined ? 1 : prog(f, at, dur);
  return <div data-cue={at} style={{...style, opacity: a, transform: `translateY(${(1 - a) * dy}px)`}}>{children}</div>;
};

// Hairline that draws from the left.
export const Hair = ({f, at, top, left = 90, width = 900, color = P.line}: {f: number; at?: number; top: number; left?: number; width?: number; color?: string}) => {
  if (!seen(f, at)) return null;
  const a = at === undefined ? 1 : prog(f, at, 22, EASE.out);
  return <div style={abs(left, top, width * a, 2)}><div style={{height: 2, background: color}}/></div>;
};

// Counts a number up at its cue (keeps any non-digit prefix/suffix).
export const CountUp = ({f, at, value}: {f: number; at?: number; value: string}) => {
  const target = Number(value.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(target)) return <>{value}</>;
  const a = at === undefined ? 1 : prog(f, at, 34, EASE.out);
  const decimals = (value.split('.')[1] ?? '').length;
  return <>{(target * a).toFixed(decimals)}</>;
};

export const Dot = () => <span style={{width: 12, height: 12, borderRadius: 12, background: P.clay, flexShrink: 0, marginTop: 16}}/>;
export const Num = ({n, size = 36}: {n: string; size?: number}) => <Role role="label" style={serif(size, P.clay, {fontStyle: 'italic', fontWeight: 600})}>{n}</Role>;

// ---------- imagery ----------
// photo: a file under the job's public dir; fit/focus control cropping; ratio (width/height) lets a frame size itself to the image.
// video: a short clip that loops for the shot (frames = clip length at the composition fps). art: a built-in flat illustration.
export type ImageSpec = {photo: string; fit?: 'cover' | 'contain'; focus?: string; ratio?: number; bg?: string} | {video: string; frames: number; ratio?: number} | {art: string};
const Art = ({kind}: {kind: string}) => {
  const body: Record<string, React.ReactNode> = {
    hills: <><rect width="400" height="300" fill="#DCE6EE"/><circle cx="305" cy="85" r="40" fill={P.clay}/><path d="M0 225Q90 150 200 205T400 185V300H0z" fill={P.olive}/><path d="M0 268Q120 205 240 250T400 238V300H0z" fill={P.kraft}/><ellipse cx="90" cy="70" rx="46" ry="16" fill="#fff" opacity=".9"/><ellipse cx="120" cy="60" rx="30" ry="14" fill="#fff" opacity=".9"/></>,
    city: <><rect width="400" height="300" fill={P.oat}/><circle cx="300" cy="80" r="36" fill={P.clay}/>{[[30, 120, 60], [95, 80, 70], [170, 140, 55], [235, 100, 75], [315, 150, 55]].map(([x, y, w], i) => <g key={i}><rect x={x} y={y} width={w} height={270 - y} fill={[P.ink, P.sky, P.kraft, P.ink, P.olive][i]}/>{[0, 1, 2, 3].map((r) => <rect key={r} x={x + 10} y={y + 16 + r * 30} width={w - 20} height="8" fill="#F4F1EA" opacity=".55"/>)}</g>)}<rect x="0" y="270" width="400" height="30" fill={P.ink}/></>,
    device: <><rect width="400" height="300" fill={P.oat}/><rect x="140" y="30" width="120" height="240" rx="22" fill={P.card} stroke={P.ink} strokeWidth="5"/><rect x="156" y="62" width="88" height="14" rx="7" fill={P.line}/><rect x="156" y="88" width="64" height="14" rx="7" fill={P.line}/><circle cx="200" cy="190" r="34" fill={P.clay}/><path d="M318 62l8 22 22 8-22 8-8 22-8-22-22-8 22-8z" fill={P.clay}/></>,
    chart: <><rect width="400" height="300" fill={P.oat}/>{[60, 105, 150, 195, 240].map((x, i) => <rect key={i} x={x} y={230 - [50, 80, 105, 140, 175][i]} width="30" height={[50, 80, 105, 140, 175][i]} rx="5" fill={i === 4 ? P.clay : P.kraft}/>)}<path d="M40 230H370" stroke={P.ink} strokeWidth="4"/><path d="M60 190L120 150 170 125 215 100 270 55" fill="none" stroke={P.olive} strokeWidth="6" strokeLinecap="round"/></>,
    people: <><rect width="400" height="300" fill={P.oat}/>{[[110, P.clay], [200, P.sky], [290, P.olive]].map(([x, c], i) => <g key={i}><circle cx={x as number} cy={120 - (i === 1 ? 14 : 0)} r="34" fill={c as string}/><path d={`M${(x as number) - 52} 270Q${x} ${170 - (i === 1 ? 14 : 0)} ${(x as number) + 52} 270z`} fill={c as string} opacity=".85"/></g>)}</>,
    document: <><rect width="400" height="300" fill={P.oat}/><rect x="110" y="40" width="160" height="210" rx="10" fill={P.card} stroke={P.ink} strokeWidth="4" transform="rotate(-6 190 145)"/><rect x="140" y="30" width="160" height="210" rx="10" fill={P.card} stroke={P.ink} strokeWidth="4"/>{[70, 100, 130, 160].map((y) => <rect key={y} x="162" y={y} width="116" height="9" rx="4" fill={P.line}/>)}<rect x="162" y="190" width="60" height="16" rx="8" fill={P.clay}/></>,
    server: <><rect width="400" height="300" fill={P.oat}/>{[50, 125, 200].map((y, i) => <g key={i}><rect x="90" y={y} width="220" height="58" rx="12" fill={P.ink}/><circle cx="125" cy={y + 29} r="8" fill={[P.clay, P.olive, P.sky][i]}/><rect x="150" y={y + 22} width="120" height="14" rx="7" fill="#4a463d"/></g>)}</>,
    moon: <><rect width="400" height="300" fill="#2E3A5C"/><circle cx="260" cy="100" r="52" fill="#F4E9CE"/><circle cx="282" cy="86" r="46" fill="#2E3A5C"/>{[[60, 50], [110, 110], [170, 40], [330, 190], [60, 180]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#F4E9CE"/>)}<path d="M0 250Q110 200 220 240T400 225V300H0z" fill="#1B2440"/></>,
    cup: <><rect width="400" height="300" fill={P.oat}/><path d="M120 120h150v70a60 60 0 01-60 60h-30a60 60 0 01-60-60z" fill={P.kraft} stroke={P.ink} strokeWidth="5"/><path d="M270 140h24a26 26 0 010 52h-30" fill="none" stroke={P.ink} strokeWidth="5"/><path d="M160 90q-14-20 0-38M200 90q-14-20 0-38M240 90q-14-20 0-38" fill="none" stroke={P.clay} strokeWidth="6" strokeLinecap="round"/></>,
    house: <><rect width="400" height="300" fill="#DCE6EE"/><circle cx="320" cy="70" r="30" fill={P.clay}/><rect x="110" y="140" width="180" height="120" fill={P.card} stroke={P.ink} strokeWidth="5"/><path d="M90 145L200 60 310 145z" fill={P.clay} stroke={P.ink} strokeWidth="5" strokeLinejoin="round"/><rect x="180" y="190" width="40" height="70" fill={P.olive}/><rect x="0" y="260" width="400" height="40" fill={P.olive} opacity=".7"/></>,
    pin: <><rect width="400" height="300" fill={P.oat}/><path d="M0 220Q100 150 200 190T400 120M0 100Q120 60 230 110T400 60" fill="none" stroke={P.line} strokeWidth="8"/><path d="M200 250s-52-52-52-100a52 52 0 01104 0c0 48-52 100-52 100z" fill={P.clay} stroke={P.ink} strokeWidth="5"/><circle cx="200" cy="150" r="20" fill={P.card}/></>,
    assistant: <><rect width="400" height="300" fill={P.oat}/><rect x="70" y="62" width="96" height="176" rx="20" fill={P.card} stroke={P.ink} strokeWidth="5"/><rect x="86" y="92" width="64" height="12" rx="6" fill={P.line}/><rect x="86" y="114" width="44" height="12" rx="6" fill={P.line}/><circle cx="118" cy="190" r="22" fill={P.clay}/><rect x="196" y="74" width="132" height="54" rx="27" fill={P.card} stroke={P.ink} strokeWidth="5"/>{[236, 262, 288].map((x) => <circle key={x} cx={x} cy="101" r="6" fill={P.ink}/>)}<rect x="214" y="150" width="150" height="74" rx="37" fill={P.clay}/><path d="M289 164l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" fill="#fff"/></>,
    voice: <><rect width="400" height="300" fill={P.oat}/><circle cx="200" cy="150" r="96" fill={P.clay} opacity=".18"/><circle cx="200" cy="150" r="64" fill={P.clay} opacity=".4"/><circle cx="200" cy="150" r="36" fill={P.clay}/>{[[110, 20], [135, 44], [265, 44], [290, 20]].map(([x, h], i) => <rect key={i} x={x - 6} y={150 - h} width="12" height={h * 2} rx="6" fill={P.ink}/>)}</>,
    camera: <><rect width="400" height="300" fill={P.oat}/><path d="M110 90V70a10 10 0 0110-10h20M260 60h20a10 10 0 0110 10v20M290 210v20a10 10 0 01-10 10h-20M140 240h-20a10 10 0 01-10-10v-20" fill="none" stroke={P.ink} strokeWidth="9" strokeLinecap="round"/><circle cx="200" cy="150" r="46" fill="none" stroke={P.clay} strokeWidth="10"/><circle cx="200" cy="150" r="14" fill={P.clay}/></>,
    layers: <><rect width="400" height="300" fill={P.oat}/>{[[200, P.line], [165, P.kraft], [130, P.clay]].map(([y, c], i) => <path key={i} d={`M200 ${(y as number) - 40}L320 ${y}L200 ${(y as number) + 40}L80 ${y}z`} fill={c as string} stroke={P.ink} strokeWidth="4" strokeLinejoin="round"/>)}</>,
    shield: <><rect width="400" height="300" fill={P.oat}/><path d="M200 40l96 36v70c0 60-40 100-96 122-56-22-96-62-96-122V76z" fill={P.card} stroke={P.ink} strokeWidth="6" strokeLinejoin="round"/><path d="M158 150l30 30 56-62" fill="none" stroke={P.olive} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{display: 'block'}}>{body[kind] ?? body.hills}</svg>;
};

// Rounded picture that wipes in at its cue and drifts slowly across the shot (duration-bound, no randomness).
export const Pic = ({image, style, radius = 28, f, at, driftT = 0}: {image: ImageSpec; style: React.CSSProperties; radius?: number; f: number; at?: number; driftT?: number}) => {
  if (!seen(f, at)) return null;
  const a = at === undefined ? 1 : prog(f, at, 20, EASE.out);
  const photo = 'photo' in image ? image : undefined;
  const cover = !photo || (photo.fit ?? 'cover') === 'cover';
  return <div data-layout-role="media" data-media-crop="intentional" style={{...style, borderRadius: radius, overflow: 'hidden', position: style.position ?? 'relative', clipPath: `inset(${(1 - a) * 100}% 0 0 0 round ${radius}px)`, boxShadow: '0 28px 50px -30px rgba(70,45,20,.45)', background: photo?.bg ?? P.oat}}>
    <div style={{width: '100%', height: '100%', transform: `scale(${1 + 0.06 * (1 - a) + (photo ? 0.04 : 0) * driftT})`}}>
      {photo ? <Img src={staticFile(photo.photo)} style={{width: '100%', height: '100%', objectFit: cover ? 'cover' : 'contain', objectPosition: photo.focus ?? 'center', display: 'block'}}/>
        : 'video' in image ? <Loop durationInFrames={Math.max(1, image.frames)}><OffthreadVideo src={staticFile(image.video)} muted style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}/></Loop>
        : <Art kind={(image as {art: string}).art}/>}
    </div>
    {photo && photo.fit !== 'contain' && !photo.bg && <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(217,168,122,.08),rgba(120,70,30,.08))', mixBlendMode: 'multiply'}}/>}
    <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 1px rgba(31,29,25,.12)', borderRadius: radius}}/>
  </div>;
};

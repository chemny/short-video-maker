import React from 'react';
import {CountUp, Dot, EASE, F, Hair, ImageSpec, Num, P, Pic, Reveal, Role, abs, flex, prog, sans, seen, serif} from './kit';

// Shot recipes: content data in, motion tied to spoken cues out. `at` values are absolute seconds
// (the Director resolves caption anchors to seconds); a missing `at` means visible from the shot start.
// Body region: y 450..1490. Header: y 190..420. Caption zone below 1512 belongs to PaperFilm.
export type Shot = {id: string; start: number; end: number; recipe: string; title?: string; kicker?: string; [key: string]: any};
type Props = {f: number; shot: Shot};
const BODY_TOP = 450, BODY_BOTTOM = 1440;
const driftOf = (f: number, shot: Shot) => Math.min(1, Math.max(0, (f - F(shot.start)) / Math.max(1, F(shot.end) - F(shot.start))));

const Header = ({shot}: {shot: Shot}) => <div style={abs(90, 190, 900)}>
  {shot.kicker && <Role role="source" style={sans(30, P.clay, 700, {letterSpacing: 5})}>{shot.kicker}</Role>}
  {shot.title && <Role role="title" style={serif(shot.title.length > 9 ? 78 : 92, P.ink, {marginTop: 14})}>{shot.title}</Role>}
</div>;
const Point = ({f, at, text}: {f: number; at?: number; text: string}) =>
  <Reveal f={f} at={at} style={{display: 'flex', gap: 22}}><Dot/><Role style={sans(44, P.ink, 600)}>{text}</Role></Reveal>;

// 1. Hook / opinion / takeaway: optional picture, headline lines that arrive with the speech, supporting notes.
export const PaperStatement = ({f, shot}: Props) => {
  const image: ImageSpec | undefined = shot.image;
  const ratio = image && 'ratio' in image ? image.ratio : undefined;
  const imageH = image ? Math.round(Math.min(640, ratio ? 900 / ratio : 640)) : 0;
  const tagTop = 250 + imageH + 28, linesTop = image ? tagTop + 76 : 360, lineCount = (shot.lines ?? []).length;
  const notesTop = Math.min(1262, linesTop + lineCount * 112 + 28);
  return <>
    {shot.kicker && <div style={abs(90, 190, 900)}><Role role="source" style={sans(30, P.clay, 700, {letterSpacing: 5})}>{shot.kicker}</Role></div>}
    {image && <Pic f={f} at={shot.imageAt} image={image} style={abs(90, 250, 900, imageH)} driftT={driftOf(f, shot)}/>}
    {shot.tag && <Reveal f={f} at={shot.tag.at} style={{...abs(90, image ? tagTop : 280, 330), ...flex(), border: `2px solid ${P.clay}`, borderRadius: 40, padding: '6px 0'}}><Role role="label" style={sans(32, P.clay, 700)}>{shot.tag.text}</Role></Reveal>}
    <div style={abs(90, linesTop, 900)}>
      {(shot.lines ?? []).map((l: any, i: number) => <Reveal key={i} f={f} at={l.at} style={{display: 'block'}}>
        <Role role="title" style={serif(92, l.accent ? P.clay : P.ink, {lineHeight: 1.2})}>{l.text}</Role>
      </Reveal>)}
    </div>
    {(shot.notes ?? []).map((n: any, i: number) => <Reveal key={i} f={f} at={n.at} style={abs(90, notesTop + i * 80, 900)}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 18}}>
        <Role style={sans(44, n.dim === false ? P.ink : P.muted, 500, {lineHeight: 1.45})}>{n.text}</Role>
        {n.source && <Role role="source" style={sans(30, P.muted, 500, {border: `2px solid ${P.line}`, borderRadius: 30, padding: '2px 16px'})}>{n.source}</Role>}
      </div>
    </Reveal>)}
  </>;
};

// 2. List of 3 to 5 parallel items, each with a picture, title, sub line, optional tags.
export const PaperList = ({f, shot}: Props) => {
  const rows: any[] = shot.rows ?? [], h = (BODY_BOTTOM - BODY_TOP) / rows.length, size = Math.min(280, h - 50);
  return <>
    <Header shot={shot}/>
    {rows.map((r, i) => <React.Fragment key={i}>
      {i > 0 && <Hair f={f} top={BODY_TOP + i * h - 8}/>}
      <div style={{...abs(90, BODY_TOP + i * h, 900, h - 20), display: 'flex', alignItems: 'center', gap: 44}}>
        <Pic f={f} at={r.at} image={r.image} style={{width: size, height: size, flexShrink: 0}} driftT={driftOf(f, shot)}/>
        <div style={{flex: 1}}>
          <Num n={String(i + 1).padStart(2, '0')}/>
          <Reveal f={f} at={r.at}><Role role="title" style={serif(68, P.ink, {marginTop: 4})}>{r.title}</Role></Reveal>
          {r.sub && <Reveal f={f} at={r.subAt ?? r.at}><Role style={sans(44, P.muted, 500, {marginTop: 8})}>{r.sub}</Role></Reveal>}
          {r.tags && <div style={{display: 'flex', gap: 16, marginTop: 14}}>{r.tags.map((t: any, k: number) => <Reveal key={k} f={f} at={t.at}><Role role="source" style={sans(30, P.ink, 600, {border: `2px solid ${P.line}`, borderRadius: 40, padding: '4px 22px'})}>{t.text}</Role></Reveal>)}</div>}
          {r.extra && <Reveal f={f} at={r.extra.at}><Role style={sans(44, P.clay, 600, {marginTop: 10})}>{r.extra.text}</Role></Reveal>}
        </div>
      </div>
    </React.Fragment>)}
  </>;
};

// 3. Timeline: ordered steps on a vertical axis that draws as each date is spoken.
export const PaperTimeline = ({f, shot}: Props) => {
  const steps: any[] = shot.steps ?? [], h = (BODY_BOTTOM - BODY_TOP - (shot.note ? 150 : 0)) / steps.length;
  const visibleSteps = steps.filter((s) => seen(f, s.at)).length;
  const last = steps.filter((s) => seen(f, s.at)).pop();
  const axis = visibleSteps ? Math.min(1, (visibleSteps - 1 + (last ? prog(f, last.at, 24, EASE.out) : 0)) / Math.max(1, steps.length - 1)) : 0;
  return <>
    <Header shot={shot}/>
    <div style={abs(121, BODY_TOP + h / 2, 2, (steps.length - 1) * h)}><div style={{width: 2, height: '100%', background: P.line, opacity: 0.45}}/><div style={{width: 2, height: `${axis * 100}%`, background: P.clay, marginTop: '-100%'}}/></div>
    {steps.map((s, i) => <React.Fragment key={i}>
      <Reveal f={f} at={s.at} style={abs(106, BODY_TOP + i * h + h / 2 - 16, 32, 32)}><div style={{width: 32, height: 32, borderRadius: 32, background: P.paper, border: `5px solid ${P.clay}`, boxSizing: 'border-box'}}/></Reveal>
      <div style={{...abs(190, BODY_TOP + i * h, 570, h - 20), display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <Reveal f={f} at={s.at}><Role role="title" style={serif(82, P.clay)}>{s.when}</Role></Reveal>
        <Reveal f={f} at={s.whatAt ?? s.at}><Role style={sans(44, P.ink, 600, {marginTop: 6, textWrap: 'balance'})}>{s.what}</Role></Reveal>
      </div>
      <Pic f={f} at={s.at} image={s.image} style={abs(780, BODY_TOP + i * h + (h - 20 - 210) / 2, 210, 210)} driftT={driftOf(f, shot)}/>
    </React.Fragment>)}
    {shot.note && <Reveal f={f} at={shot.note.at} style={abs(190, BODY_BOTTOM - 110, 800)}><div style={{height: 2, background: P.line, marginBottom: 24}}/><Role style={sans(48, P.clay, 700)}>{shot.note.text}</Role></Reveal>}
  </>;
};

// 4. Numbered points: 2 or 3 groups, each with a heading, supporting lines and a picture.
export const PaperPoints = ({f, shot}: Props) => {
  const groups: any[] = shot.groups ?? [], weights = groups.map((g) => 3 + (g.lines?.length ?? 0)), total = weights.reduce((a, b) => a + b, 0);
  const tops = weights.map((_, i) => BODY_TOP + ((BODY_BOTTOM - BODY_TOP) * weights.slice(0, i).reduce((a, b) => a + b, 0)) / total), heights = weights.map((w) => ((BODY_BOTTOM - BODY_TOP) * w) / total);
  return <>
    <Header shot={shot}/>
    {groups.map((g, i) => <React.Fragment key={i}>
      {i > 0 && <Hair f={f} at={g.numAt ?? g.headAt} top={tops[i] - 12}/>}
      <div style={abs(90, tops[i], 900, heights[i] - 30)}>
        <Reveal f={f} at={g.numAt ?? g.headAt}><Num n={String(i + 1).padStart(2, '0')} size={44}/></Reveal>
        <Reveal f={f} at={g.headAt}><Role role="title" style={serif(72, P.ink, {marginTop: 4})}>{g.head}</Role></Reveal>
        <div style={{marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16, width: 600}}>{(g.lines ?? []).map((l: any, k: number) => <Point key={k} f={f} at={l.at} text={l.text}/>)}</div>
      </div>
      <Pic f={f} at={g.headAt} image={g.image} style={abs(730, tops[i] + 20, 260, Math.min(260, heights[i] - 70))} driftT={driftOf(f, shot)}/>
    </React.Fragment>)}
  </>;
};

// 5. Compare: two sides with pictures and points, an optional connector ("or"/"vs") and badge.
export const PaperCompare = ({f, shot}: Props) => {
  const sides: any[] = shot.sides ?? [];
  return <>
    <Header shot={shot}/>
    {shot.badge && <Reveal f={f} at={shot.badge.at} style={{...abs(700, 200, 290), ...flex(), border: `2px solid ${P.ink}`, borderRadius: 44, padding: '8px 0'}}><Role role="label" style={sans(36, P.ink, 700)}>{shot.badge.text}</Role></Reveal>}
    {sides.map((s, i) => <div key={i} style={abs(90 + i * 480, BODY_TOP, 420, 760)}>
      <Pic f={f} at={s.at} image={s.image} style={{width: 420, height: 330}} driftT={driftOf(f, shot)}/>
      <Reveal f={f} at={s.at}><Role role="title" style={serif(64, i ? P.clay : P.ink, {marginTop: 26})}>{s.label}</Role></Reveal>
      <div style={{marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18}}>{(s.points ?? []).map((p: any, k: number) => <Point key={k} f={f} at={p.at} text={p.text}/>)}</div>
    </div>)}
    <div style={abs(539, BODY_TOP, 2, 760)}><div style={{width: 2, height: `${(seen(f, shot.dividerAt) ? (shot.dividerAt === undefined ? 1 : prog(f, shot.dividerAt, 24, EASE.out)) : 0) * 100}%`, background: P.line}}/></div>
    {shot.connector && <Reveal f={f} at={shot.connector.at} style={{...abs(484, BODY_TOP + 110, 112), ...flex(), height: 112, borderRadius: 112, background: P.clay}}><Role role="label" style={serif(48, '#fff')}>{shot.connector.text}</Role></Reveal>}
    {shot.verdict && <Reveal f={f} at={shot.verdict.at} style={abs(90, 1290, 900)}><div style={{height: 2, background: P.line, marginBottom: 26}}/><Role style={serif(54, P.ink, {fontWeight: 600, lineHeight: 1.4})}>{shot.verdict.text}</Role></Reveal>}
  </>;
};

// 6. Stat: one dominant number that counts up, a trend line that draws, supporting points.
export const PaperStat = ({f, shot}: Props) => {
  const trend: number[] = shot.trend ?? [], max = Math.max(...trend), min = Math.min(...trend);
  const pts = trend.map((v, i) => [40 + (i * 820) / Math.max(1, trend.length - 1), 220 - ((v - min) / Math.max(1e-6, max - min)) * 170] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const drawn = seen(f, shot.trendAt) ? (shot.trendAt === undefined ? 1 : prog(f, shot.trendAt, 40, EASE.out)) : 0;
  return <>
    <Header shot={shot}/>
    <Reveal f={f} at={shot.at} style={abs(90, 450, 900)}><Role style={sans(42, P.muted, 600)}>{shot.label}</Role></Reveal>
    <Reveal f={f} at={shot.at} dy={30} style={{...abs(90, 490, 900), display: 'flex', alignItems: 'baseline', gap: 16}}>
      <Role role="stat" style={serif(330, P.clay, {lineHeight: 1, letterSpacing: -10})}><CountUp f={f} at={shot.at} value={shot.value}/></Role>
      <Role role="title" style={serif(90, P.ink)}>{shot.unit}</Role>
    </Reveal>
    <Hair f={f} at={shot.trendAt} top={880}/>
    {drawn > 0 && <svg width="900" height="250" style={abs(90, 900, 900, 250)}>
      <path d={`${line} L860 250 L40 250z`} fill={P.clay} opacity={0.1 * drawn}/>
      <path d={line} fill="none" stroke={P.clay} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - drawn}/>
      {pts.map(([x, y], i) => drawn > i / pts.length ? <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 13 : 8} fill={i === pts.length - 1 ? P.clay : P.paper} stroke={P.clay} strokeWidth="4"/> : null)}
    </svg>}
    {shot.context && <Reveal f={f} at={shot.contextAt} style={abs(90, 1150, 900)}><Role style={sans(42, P.muted, 500)}>{shot.context}</Role></Reveal>}
    <div style={{...abs(90, 1235, 900), display: 'flex', flexDirection: 'column', gap: 16}}>{(shot.points ?? []).map((p: any, i: number) => <Point key={i} f={f} at={p.at} text={p.text}/>)}</div>
  </>;
};

// 7. Flow: a process or relationship as 2 to 4 nodes joined by arrows that draw in.
export const PaperFlow = ({f, shot}: Props) => {
  const nodes: any[] = shot.nodes ?? [], gap = 70, h = (BODY_BOTTOM - BODY_TOP - gap * (nodes.length - 1)) / nodes.length, w = Math.min(h * 1.15, 420);
  return <>
    <Header shot={shot}/>
    {nodes.map((nd, i) => { const top = BODY_TOP + i * (h + gap); return <React.Fragment key={i}>
      <Pic f={f} at={nd.at} image={nd.image} style={abs(90, top, w, h)} driftT={driftOf(f, shot)}/>
      <div style={{...abs(90 + w + 44, top, 900 - w - 44, h), display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <Reveal f={f} at={nd.at}><Num n={`步骤 ${i + 1}`}/></Reveal>
        <Reveal f={f} at={nd.at}><Role role="title" style={serif(72, P.ink, {marginTop: 4})}>{nd.label}</Role></Reveal>
        <Reveal f={f} at={nd.subAt ?? nd.at}><Role style={sans(44, P.muted, 500, {marginTop: 6})}>{nd.sub}</Role></Reveal>
      </div>
      {i < nodes.length - 1 && seen(f, nodes[i + 1].at) && <svg width="60" height={gap} style={abs(130, top + h, 60, gap)}><path d={`M30 6V${gap - 18}M14 ${gap - 30}l16 16 16-16`} fill="none" stroke={P.clay} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - prog(f, nodes[i + 1].at, 18, EASE.out)}/></svg>}
    </React.Fragment>; })}
  </>;
};

// 8. Quote: a statement attributed to a person or source.
export const PaperQuote = ({f, shot}: Props) => <>
  {shot.kicker && <div style={abs(90, 190, 900)}><Role role="source" style={sans(30, P.clay, 700, {letterSpacing: 5})}>{shot.kicker}</Role></div>}
  <Reveal f={f} at={shot.quoteAt} style={abs(80, 220, 300)}><div style={serif(400, P.clay, {lineHeight: 1})}>“</div></Reveal>
  <Reveal f={f} at={shot.quoteAt} style={abs(90, 660, 900)}><Role role="title" style={serif(92, P.ink, {lineHeight: 1.3, textWrap: 'balance'})}>{shot.quote}</Role></Reveal>
  <Hair f={f} at={shot.whoAt} top={1200}/>
  <div style={{...abs(90, 1230, 900, 230), display: 'flex', alignItems: 'center', gap: 40}}>
    <Pic f={f} at={shot.whoAt} image={shot.image} radius={110} style={{width: 220, height: 220, flexShrink: 0}}/>
    <Reveal f={f} at={shot.whoAt}><Role role="title" style={serif(60, P.ink)}>{shot.who}</Role><Role role="source" style={sans(32, P.muted, 500, {marginTop: 8})}>{shot.source}</Role></Reveal>
  </div>
</>;

// 9. Media: a real image, screenshot or clip frame at full width with a label and evidence points.
export const PaperMedia = ({f, shot}: Props) => <>
  <Header shot={shot}/>
  <Pic f={f} at={shot.imageAt} image={shot.image} style={abs(90, 440, 900, 780)} driftT={driftOf(f, shot)}/>
  {shot.label && <Reveal f={f} at={shot.labelAt ?? shot.imageAt} style={{...abs(122, 472, 280), ...flex(), background: P.paper, borderRadius: 40, padding: '8px 0'}}><Role role="label" style={sans(32, P.ink, 700)}>{shot.label}</Role></Reveal>}
  {shot.source && <Reveal f={f} at={shot.imageAt} style={abs(560, 1170, 400)}><Role role="label" style={sans(28, '#fff', 600, {textAlign: 'right', textShadow: '0 1px 6px rgba(0,0,0,.6)'})}>{shot.source}</Role></Reveal>}
  {(shot.points ?? []).slice(0, 2).map((p: any, i: number) => <Reveal key={i} f={f} at={p.at} style={{...abs(90 + i * 470, 1260, 430), borderTop: `2px solid ${P.ink}`, paddingTop: 22}}><Num n={`0${i + 1}`}/><Role style={sans(44, P.ink, 600, {marginTop: 6})}>{p.text}</Role></Reveal>)}
</>;

// 10. Split: one picture with three numbered lines.
export const PaperSplit = ({f, shot}: Props) => <>
  <Header shot={shot}/>
  <Pic f={f} at={shot.imageAt} image={shot.image} style={abs(90, 440, 900, 560)} driftT={driftOf(f, shot)}/>
  {(shot.lines ?? []).map((l: any, i: number) => <React.Fragment key={i}>
    {i > 0 && <Hair f={f} at={l.at} top={1030 + i * 160 - 12}/>}
    <Reveal f={f} at={l.at} style={{...abs(90, 1030 + i * 160, 900, 140), display: 'flex', alignItems: 'center', gap: 30}}>
      <Num n={String(i + 1).padStart(2, '0')} size={44}/>
      <div><Role role="title" style={serif(56, P.ink)}>{l.head}</Role><Role style={sans(42, P.muted, 500)}>{l.text}</Role></div>
    </Reveal>
  </React.Fragment>)}
</>;

export const paperRecipes: Record<string, React.FC<Props>> = {
  'paper-statement': PaperStatement, 'paper-list': PaperList, 'paper-timeline': PaperTimeline, 'paper-points': PaperPoints, 'paper-compare': PaperCompare,
  'paper-stat': PaperStat, 'paper-flow': PaperFlow, 'paper-quote': PaperQuote, 'paper-media': PaperMedia, 'paper-split': PaperSplit,
};

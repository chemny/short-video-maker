import React from 'react';
import {AbsoluteFill, Composition, Freeze, useCurrentFrame} from 'remotion';
import {AudioLayer} from '../../components/AudioLayer';
import {LayoutAudit} from '../../components/LayoutAudit';
import {EASE, F, P, Role, abs, flex, sans, serif} from './kit';
import {Shot, paperRecipes} from './recipes';

const Grain = () => <svg width="1080" height="1920" style={{position: 'absolute', inset: 0, opacity: 0.07, mixBlendMode: 'multiply'}}><filter id="paper-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .25  0 0 0 0 .2  0 0 0 .9 0"/></filter><rect width="1080" height="1920" filter="url(#paper-grain)"/></svg>;

// Page chrome shared by every recipe: paper, channel label, progress, hairlines and the subtitle line.
export const PaperFrame = ({channel, progress, caption, children}: {channel: string; progress: string; caption?: string; children: React.ReactNode}) =>
  <AbsoluteFill data-svm-root style={{background: P.paper}}>
    <Grain/>
    <Role role="label" style={{...abs(90, 84, 900), display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...sans(28, P.muted, 600)}}>
      <span style={{display: 'flex', alignItems: 'center', gap: 12}}><span style={{width: 14, height: 14, borderRadius: 14, background: P.clay}}/>{channel}</span><span>{progress}</span>
    </Role>
    <div style={abs(90, 140, 900, 2)}><div style={{height: 2, background: P.line}}/></div>
    {children}
    <div style={abs(90, 1512, 900, 2)}><div style={{height: 2, background: P.line}}/></div>
    {caption && <Role role="caption" style={{...abs(90, 1540, 900, 110), ...flex(), ...serif(46, P.ink, {fontWeight: 600}), textWrap: 'balance', overflowWrap: 'anywhere'}}>{caption}</Role>}
  </AbsoluteFill>;

const shotOpacity = (f: number, shot: Shot, first: boolean, last: boolean) => {
  const a = first ? 1 : Math.min(1, Math.max(0, (f - F(shot.start)) / 8));
  const b = last ? 1 : 1 - Math.min(1, Math.max(0, (f - (F(shot.end) - 6)) / 6));
  return EASE.out(a) * b;
};

// Renders a compiled plan: plan.directorRender.shots carry recipe, content and cue seconds.
export function PaperFilm({plan}: {plan: any}) {
  const f = useCurrentFrame(), shots: Shot[] = plan.directorRender?.shots ?? [];
  const index = shots.findIndex((x) => f >= F(x.start) && f < F(x.end));
  if (index < 0) throw Error('Uncovered frame ' + f);
  const shot = shots[index], Painter = paperRecipes[shot.recipe];
  if (!Painter) throw Error('Unknown paper recipe ' + shot.recipe);
  const cap = plan.captions.find((c: any) => f >= F(Math.max(c.start, c.displayStart ?? c.start)) && f < F(c.end));
  return <PaperFrame channel={plan.meta.seriesLabel ?? '频道名'} progress={`${String(index + 1).padStart(2, '0')} / ${String(shots.length).padStart(2, '0')}`} caption={cap?.text.replace(/[，。！？；：、“”]/g, ' ')}>
    <AudioLayer plan={plan}/>
    <div style={{position: 'absolute', inset: 0, opacity: shotOpacity(f, shot, index === 0, index === shots.length - 1)}}><Painter f={f} shot={shot}/>{shot.credit && <Role role="source" style={{...abs(90, 1458, 900), ...sans(28, P.muted, 500, {textAlign: 'right'})}}>{shot.credit}</Role>}</div>
    {plan.style.layoutAudit && <LayoutAudit plan={plan}/>}
  </PaperFrame>;
}

// Registers the film and a cover still for a job: <PaperRoot plan={plan} id="Film" coverId="Cover"/>.
export const PaperRoot = ({plan, id, coverId}: {plan: any; id: string; coverId: string}) => {
  const frames = Math.ceil(plan.meta.durationSeconds * 30);
  const Cover = ({plan: p}: {plan: any}) => <Freeze frame={F(p.captions[0].end - 0.2)}><PaperFilm plan={p}/></Freeze>;
  return <>
    <Composition id={id} component={PaperFilm} width={1080} height={1920} fps={30} durationInFrames={frames} defaultProps={{plan}} calculateMetadata={({props}) => ({durationInFrames: Math.ceil(props.plan.meta.durationSeconds * 30)})}/>
    <Composition id={coverId} component={Cover} width={1080} height={1920} fps={30} durationInFrames={frames} defaultProps={{plan}}/>
  </>;
};

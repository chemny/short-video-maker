import React from 'react';
import {AbsoluteFill, Composition, Sequence, registerRoot, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {F, THEMES} from '../kit';
import {CaptionLayer, Film, HookLayer, LabelLayer, ShotView, TRANSITION_FRAMES} from './Shot';

// Entry for films built from real pictures: `node scripts/render-shot-film.mjs <job>` compiles shot-script.json to shot-film.json and
// renders this composition with the job folder as the public directory. Studio: remotion studio <this file>.
export const ShotFilm: React.FC<Film> = ({shots, captions, theme, audio, hook, bgm, sfx, labels, durationInFrames}) => (
  <AbsoluteFill style={{...(THEMES[theme] as React.CSSProperties), background: 'var(--page)'}}>
    {shots.map((s, i) => {
      const lead = TRANSITION_FRAMES[s.transition ?? 'cut'], next = shots[i + 1], nextType = next?.transition ?? 'cut';
      const exit = next && TRANSITION_FRAMES[nextType] ? {type: nextType, dir: next.dir ?? 'left', frames: TRANSITION_FRAMES[nextType]} : undefined;
      return <Sequence key={s.id} from={F(s.start) - lead} durationInFrames={Math.max(1, F(s.end) - F(s.start)) + lead}><ShotView s={s} theme={theme} exit={exit}/></Sequence>;
    })}
    {hook && <Sequence from={0} durationInFrames={F(hook.seconds)}><HookLayer hook={hook}/></Sequence>}
    <CaptionLayer captions={captions} light={theme === 'light'}/>
    {labels && <LabelLayer labels={labels}/>}
    {audio && <Audio src={staticFile(audio)}/>}
    {bgm && <Audio src={staticFile(bgm.src)} loop volume={(f) => bgm.volume * Math.min(1, f / 30, (durationInFrames - f) / 45)}/>}
    {(sfx ?? []).map((e, i) => <Sequence key={i} from={Math.max(0, F(e.t))} durationInFrames={30}><Audio src={staticFile(e.src)} volume={e.gain}/></Sequence>)}
  </AbsoluteFill>
);

const empty: Film = {fps: 30, durationInFrames: 30, theme: 'dark', shots: [], captions: []};
const Root: React.FC = () => <Composition id="ShotFilm" component={ShotFilm as React.FC<any>} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={empty}
  calculateMetadata={({props}) => ({durationInFrames: (props as unknown as Film).durationInFrames, fps: (props as unknown as Film).fps})}/>;
registerRoot(Root);

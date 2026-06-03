import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {AudioLayer} from './components/AudioLayer';
import {CaptionLayer} from './components/CaptionLayer';
import {SceneRenderer} from './components/SceneRenderer';
import {secondsToFrames} from './lib/timing';
import {VideoPlan} from './lib/types';

export const ShortVideo = ({plan}: {plan: VideoPlan}) => {
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{background: plan.style.background}}>
      <AudioLayer plan={plan} />
      {plan.scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={secondsToFrames(scene.start, fps)}
          durationInFrames={secondsToFrames(scene.end - scene.start, fps)}
        >
          <SceneRenderer plan={plan} scene={scene} sceneIndex={index} totalScenes={plan.scenes.length} />
        </Sequence>
      ))}
      <CaptionLayer captions={plan.captions} style={plan.style} />
    </AbsoluteFill>
  );
};

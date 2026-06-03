import {Composition, Still} from 'remotion';
import {CoverStill} from './CoverStill';
import {ShortVideo} from './ShortVideo';
import {samplePlan} from './lib/samplePlan';

export const RemotionRoot = () => {
  const {meta} = samplePlan;

  return (
    <>
      <Composition
        id="ShortVideo"
        component={ShortVideo}
        durationInFrames={Math.ceil(meta.durationSeconds * meta.fps)}
        fps={meta.fps}
        width={meta.width}
        height={meta.height}
        defaultProps={{plan: samplePlan}}
      />
      <Still
        id="CoverStill"
        component={CoverStill}
        width={meta.width}
        height={meta.height}
        defaultProps={{plan: samplePlan}}
      />
    </>
  );
};

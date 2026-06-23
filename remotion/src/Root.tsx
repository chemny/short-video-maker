import {Composition, Still} from 'remotion';
import {CoverStill} from './CoverStill';
import {PrimitiveCatalog} from './PrimitiveCatalog';
import {ShortVideo} from './ShortVideo';
import {coverIntroFrames} from './lib/cover';
import {samplePlan} from './lib/samplePlan';

export const RemotionRoot = () => {
  const {meta} = samplePlan;
  // 总时长 = 封面 intro + 正片（音频/内容）
  const totalFrames = coverIntroFrames(samplePlan, meta.fps) + Math.ceil(meta.durationSeconds * meta.fps);

  return (
    <>
      <Composition
        id="ShortVideo"
        component={ShortVideo}
        durationInFrames={totalFrames}
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
      <Composition
        id="PrimitiveCatalog"
        component={PrimitiveCatalog}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

import {TransitionPresentation, TransitionSeries, springTiming} from '@remotion/transitions';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {AudioLayer} from './components/AudioLayer';
import {CaptionLayer} from './components/CaptionLayer';
import {CoverIntro} from './components/CoverIntro';
import {SceneAppWorkflow} from './components/SceneAppWorkflow';
import {SceneAppleTextVideo} from './components/SceneAppleTextVideo';
import {SceneCleanExplainer} from './components/SceneCleanExplainer';
import {SceneDataPunch} from './components/SceneDataPunch';
import {SceneDarkCard} from './components/SceneDarkCard';
import {SceneImageOverlay} from './components/SceneImageOverlay';
import {SceneRenderer} from './components/SceneRenderer';
import {SceneSketchNotes} from './components/SceneSketchNotes';
import {coverIntroFrames} from './lib/cover';
import {secondsToFrames} from './lib/timing';
import {Scene, VideoPlan} from './lib/types';

// 根据 scene.transition 字段选择过渡效果
const getPresentation = (
  transition: string | undefined,
  width: number,
  height: number,
): TransitionPresentation<Record<string, unknown>> => {
  switch (transition) {
    case 'slide':      return slide() as unknown as TransitionPresentation<Record<string, unknown>>;
    case 'wipe':       return wipe() as unknown as TransitionPresentation<Record<string, unknown>>;
    case 'clock-wipe': return clockWipe({width, height}) as unknown as TransitionPresentation<Record<string, unknown>>;
    case 'fade':
    default:           return fade() as unknown as TransitionPresentation<Record<string, unknown>>;
  }
};

const SceneComponent = ({
  plan,
  scene,
  sceneIndex,
  totalScenes,
}: {
  plan: VideoPlan;
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
}) => {
  const template = plan.style.template;
  if (template === 'clean-explainer') {
    return <SceneCleanExplainer plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} />;
  }
  if (template === 'app-workflow') {
    return <SceneAppWorkflow plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} />;
  }
  if (template === 'sketch-notes') {
    return <SceneSketchNotes plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} />;
  }
  if (template === 'dark-card') {
    return <SceneDarkCard plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} />;
  }
  if (template === 'image-overlay') {
    return <SceneImageOverlay plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} />;
  }
  if (template === 'apple-text-video') {
    return <SceneAppleTextVideo plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} />;
  }
  if (template === 'data-punch') {
    return <SceneDataPunch plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} />;
  }
  return <SceneRenderer plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} />;
};

export const ShortVideo = ({plan}: {plan: VideoPlan}) => {
  const {fps, width, height} = useVideoConfig();
  const transitionDuration = 12; // frames
  const introFrames = coverIntroFrames(plan, fps);

  return (
    <AbsoluteFill style={{background: plan.style.background}}>
      {/* 开头封面标题卡：frame 0 即封面，主题先入 */}
      {introFrames > 0 ? (
        <Sequence durationInFrames={introFrames} name="Cover">
          <CoverIntro plan={plan} durationInFrames={introFrames} />
        </Sequence>
      ) : null}

      {/* 正片：整体后移到封面之后，音频/场景/字幕内部时间轴不变 */}
      <Sequence from={introFrames} name="Content">
        <AbsoluteFill style={{background: plan.style.background}}>
          <AudioLayer plan={plan} />
          <TransitionSeries>
        {plan.scenes.map((scene, index) => {
          const isLast = index === plan.scenes.length - 1;
          // cut/none = 硬切，不插入过渡
          const hardCut = scene.transition === 'cut' || scene.transition === 'none';
          const hasTransitionAfter = !isLast && !hardCut;
          // 转场会"重叠"相邻两个场景，吃掉 transitionDuration 帧。
          // 给带转场的场景补上这段帧，保证：画面总时长 == 音频总时长，
          // 且每个场景的内容起点仍精确对齐其旁白起点（消除尾部黑屏与漂移）。
          const baseFrames = secondsToFrames(scene.end - scene.start, fps);
          const seqFrames = baseFrames + (hasTransitionAfter ? transitionDuration : 0);
          return [
            <TransitionSeries.Sequence key={scene.id} durationInFrames={seqFrames}>
              <SceneComponent plan={plan} scene={scene} sceneIndex={index} totalScenes={plan.scenes.length} />
            </TransitionSeries.Sequence>,
            hasTransitionAfter && (
              <TransitionSeries.Transition
                key={`t-${scene.id}`}
                presentation={getPresentation(scene.transition, width, height)}
                timing={springTiming({config: {damping: 200}, durationInFrames: transitionDuration})}
              />
            ),
          ];
        })}
          </TransitionSeries>
          <CaptionLayer captions={plan.captions} style={plan.style} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

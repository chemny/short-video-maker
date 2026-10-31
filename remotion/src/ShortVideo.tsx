import {DirectedNews} from './components/DirectedNews';
import {SceneShotcraftBrief} from './components/SceneShotcraftBrief';
import {SceneComponents} from './components/SceneComponents';
import {LayoutAudit} from './components/LayoutAudit';
import {TransitionPresentation, TransitionSeries, springTiming} from '@remotion/transitions';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AudioLayer} from './components/AudioLayer';
import {CaptionLayer} from './components/CaptionLayer';
import {CoverIntro} from './components/CoverIntro';
import {SceneAppWorkflow} from './components/SceneAppWorkflow';
import {SceneAppleTextVideo} from './components/SceneAppleTextVideo';
import {SceneCleanExplainer} from './components/SceneCleanExplainer';
import {SceneDataPunch} from './components/SceneDataPunch';
import {SceneDarkCard} from './components/SceneDarkCard';
import {SceneEditorialBrief} from './components/SceneEditorialBrief';
import {SceneImageOverlay} from './components/SceneImageOverlay';
import {SceneRenderer} from './components/SceneRenderer';
import {SceneSketchNotes} from './components/SceneSketchNotes';
import {SceneResponsive} from './components/SceneResponsive';
import {coverIntroFrames} from './lib/cover';
import {resolveSafeArea} from './lib/safeArea';
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
  globalFrame,
}: {
  plan: VideoPlan;
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  globalFrame: number;
}) => {
  if (plan.style.template === 'shotcraft-brief') return <SceneShotcraftBrief plan={plan} scene={scene} />;
  if (plan.style.componentSystem === 'semantic-v1') return <SceneComponents plan={plan} scene={scene} />;
  const template = plan.style.template;
  if (template === 'responsive-report' || scene.visual?.kind === 'video') return <SceneResponsive plan={plan} scene={scene} />;
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
  if (template === 'editorial-brief') {
    return <SceneEditorialBrief plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} globalFrame={globalFrame} />;
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

const SafeAreaOverlay = ({plan}: {plan: VideoPlan}) => {
  const {width, height} = useVideoConfig();
  const safeArea = resolveSafeArea(width, height, plan.meta.platforms);
  const unsafeTop = safeArea.baseMarginTop;
  const unsafeBottom = safeArea.baseMarginBottom;
  const unsafeRight = safeArea.platformRightRail;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: unsafeTop, background: 'rgba(255, 46, 99, 0.13)', borderBottom: '2px solid rgba(255, 46, 99, 0.42)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: unsafeBottom, background: 'rgba(255, 192, 0, 0.13)', borderTop: '2px solid rgba(255, 192, 0, 0.42)'}} />
      {unsafeRight > 0 ? (
        <div style={{position: 'absolute', right: 0, top: unsafeTop, bottom: unsafeBottom, width: unsafeRight, background: 'rgba(99, 102, 241, 0.14)', borderLeft: '2px solid rgba(99, 102, 241, 0.44)'}} />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: safeArea.baseMarginLeft,
          right: safeArea.baseMarginRight,
          top: safeArea.baseMarginTop,
          bottom: safeArea.baseMarginBottom,
          border: '2px dashed rgba(53, 242, 197, 0.42)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: safeArea.contentLeft,
          right: safeArea.contentRight,
          top: safeArea.contentTop,
          bottom: safeArea.contentBottom,
          border: '2px solid rgba(53, 242, 197, 0.24)',
        }}
      />
    </AbsoluteFill>
  );
};

export const ShortVideo = ({plan}: {plan: VideoPlan}) => {
  const globalFrame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const transitionDuration = 12; // frames
  const introFrames = coverIntroFrames(plan, fps);

  if(plan.style.template==='directed-news')return <AbsoluteFill><AudioLayer plan={plan}/><DirectedNews plan={plan}/>{plan.style.layoutAudit?<LayoutAudit plan={plan}/>:null}</AbsoluteFill>;
  return (
    <AbsoluteFill data-svm-root style={{background: plan.style.background}}>
      {plan.style.layoutAudit ? <LayoutAudit plan={plan} /> : null}
      {/* 开头封面标题卡：frame 0 即封面，主题先入 */}
      {introFrames > 0 ? (
        <Sequence durationInFrames={introFrames} name="Cover">
          <CoverIntro plan={plan} durationInFrames={introFrames} />
        </Sequence>
      ) : null}

      {/* 正片：整体后移到封面之后，音频/场景/字幕内部时间轴不变 */}
      <Sequence from={introFrames} name="Content">
        <AbsoluteFill data-svm-root style={{background: plan.style.background}}>
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
          // Round absolute boundaries, not each duration independently: per-scene
          // rounding can accumulate and leave the last delivery frame uncovered.
          const endFrame = isLast ? Math.ceil(scene.end * fps) : secondsToFrames(scene.end, fps);
          const baseFrames = Math.max(1, endFrame - secondsToFrames(scene.start, fps));
          const seqFrames = baseFrames + (hasTransitionAfter ? transitionDuration : 0);
          return [
            <TransitionSeries.Sequence key={scene.id} durationInFrames={seqFrames}>
              <SceneComponent plan={plan} scene={scene} sceneIndex={index} totalScenes={plan.scenes.length} globalFrame={globalFrame} />
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
          {(plan.cover.overlaySeconds ?? 0) > 0 ? (
            <Sequence durationInFrames={secondsToFrames(plan.cover.overlaySeconds!, fps)} name="Content title">
              <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: width * 0.08, color: '#fff', textAlign: 'center', background: 'rgba(0,0,0,0.22)', fontFamily: '"PingFang SC", system-ui, sans-serif', textShadow: '0 3px 14px #000'}}>
                <div style={{fontSize: Math.min(width * 0.10, height * 0.12), fontWeight: 800}}>{plan.cover.title}</div>
                {plan.meta.speaker ? <div style={{fontSize: Math.min(width * 0.035, height * 0.05), marginTop: 24}}>朗诵者：{plan.meta.speaker}</div> : null}
              </AbsoluteFill>
            </Sequence>
          ) : null}
          <CaptionLayer captions={plan.captions} style={plan.style} platforms={plan.meta.platforms} />
          {plan.style.safeAreaOverlay ? <SafeAreaOverlay plan={plan} /> : null}
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

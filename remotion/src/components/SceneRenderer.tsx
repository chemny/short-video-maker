import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Scene, VideoPlan} from '../lib/types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const sceneLabel: Record<string, string> = {
  hook: '开场',
  definition: '定义',
  explain: '解释',
  example: '案例',
  benefits: '价值',
  howto: '步骤',
  risk: '提醒',
  ending: '总结',
  thesis: '核心',
  analysis: '分析',
  process: '流程',
  framework: '框架',
  step: '步骤',
  mistake: '避坑',
};

const shortText = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}...` : text;

const splitKeywords = (scene: Scene) => {
  const fromCaption = scene.caption
    .split(/[，、：:？?。\s]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  const fromVisual = scene.visual?.alt
    ?.split(/[，、：:？?。\s]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  return Array.from(new Set([...fromCaption, ...(fromVisual ?? [])])).slice(0, 4);
};

const CleanBackground = ({plan, progress}: {plan: VideoPlan; progress: number}) => {
  const drift = interpolate(progress, [0, 1], [-14, 14], clamp);

  return (
    <AbsoluteFill style={{background: plan.style.background, overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0) 48%), radial-gradient(circle at 84% 13%, rgba(37,99,235,0.13), transparent 32%), radial-gradient(circle at 12% 78%, rgba(16,185,129,0.10), transparent 34%)',
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.7,
          transform: `translateY(${drift}px)`,
          backgroundImage:
            'linear-gradient(rgba(17,24,39,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(17,24,39,0.04) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 58,
          top: 0,
          bottom: 0,
          width: 2,
          background: `${plan.style.accent}44`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -120,
          top: 210,
          width: 360,
          height: 900,
          border: `2px solid ${plan.style.accent}24`,
          transform: 'rotate(8deg)',
        }}
      />
    </AbsoluteFill>
  );
};

const KeywordStack = ({scene, plan, local}: {scene: Scene; plan: VideoPlan; local: number}) => {
  const keywords = splitKeywords(scene);
  const reveal = spring({frame: local - 22, fps: 30, config: {damping: 180}});

  if (keywords.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 84,
        right: 84,
        bottom: 332,
        display: 'grid',
        gridTemplateColumns: keywords.length > 2 ? 'repeat(2, 1fr)' : '1fr',
        gap: 18,
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * 24}px)`,
      }}
    >
      {keywords.map((keyword, index) => (
        <div
          key={`${keyword}-${index}`}
          style={{
            alignItems: 'center',
            background: index === 0 ? `${plan.style.accent}18` : 'rgba(255,255,255,0.64)',
            borderLeft: `8px solid ${index === 0 ? plan.style.accent : 'rgba(17,24,39,0.20)'}`,
            borderRadius: 6,
            color: plan.style.textPrimary,
            display: 'flex',
            fontSize: keywords.length > 2 ? 32 : 38,
            fontWeight: 850,
            minHeight: 78,
            padding: '0 24px',
            outline: '1px solid rgba(17,24,39,0.10)',
          }}
        >
          {keyword}
        </div>
      ))}
    </div>
  );
};

export const SceneRenderer = ({
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
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames);
  const entrance = spring({frame, fps, config: {damping: 190}, durationInFrames: 32});
  const opacity = interpolate(frame, [0, 0.42 * fps], [0.9, 1], {
    ...clamp,
    easing: Easing.out(Easing.quad),
  });
  const titleY = interpolate(entrance, [0, 1], [42, 0], clamp);
  const ruleWidth = interpolate(frame, [0, 0.7 * fps], [0, 360], clamp);
  const titleSize = scene.caption.length > 24 ? 62 : scene.caption.length > 17 ? 72 : 88;
  const label = sceneLabel[scene.type] ?? scene.type;
  const secondary = plan.style.textSecondary ?? '#4B5563';

  return (
    <AbsoluteFill
      style={{
        color: plan.style.textPrimary,
        fontFamily:
          'Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", ui-sans-serif, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <CleanBackground plan={plan} progress={progress} />

      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 78,
          color: 'rgba(17,24,39,0.48)',
          fontFamily: 'Menlo, ui-monospace, monospace',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 3,
        }}
      >
        {String(sceneIndex + 1).padStart(2, '0')} / {String(totalScenes).padStart(2, '0')}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 84,
          top: 70,
          borderRadius: 6,
          color: plan.style.accent,
          fontSize: 30,
          fontWeight: 880,
          outline: `2px solid ${plan.style.accent}`,
          padding: '10px 18px',
        }}
      >
        {label}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 188,
          height: 7,
          width: ruleWidth,
          background: plan.style.accent,
          borderRadius: 6,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          top: 245,
          opacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            color: plan.style.accent,
            fontSize: 32,
            fontWeight: 840,
            letterSpacing: 0,
            marginBottom: 28,
          }}
        >
          {plan.meta.topic}
        </div>
        <div
          style={{
            color: plan.style.textPrimary,
            fontSize: titleSize,
            fontWeight: 960,
            letterSpacing: 0,
            lineHeight: 1.12,
            maxWidth: 860,
          }}
        >
          {scene.caption}
        </div>
        <div
          style={{
            color: secondary,
            fontSize: 34,
            fontWeight: 650,
            lineHeight: 1.55,
            marginTop: 42,
            maxWidth: 820,
          }}
        >
          {shortText(scene.voiceover, scene.type === 'ending' ? 58 : 70)}
        </div>
      </div>

      <KeywordStack scene={scene} plan={plan} local={frame} />

      <div
        style={{
          position: 'absolute',
          right: 84,
          bottom: 520,
          color: `${plan.style.accent}24`,
          fontSize: 96,
          fontWeight: 900,
          letterSpacing: 0,
          writingMode: 'vertical-rl',
        }}
      >
        {shortText(plan.cover.title || plan.meta.topic, 8)}
      </div>
    </AbsoluteFill>
  );
};

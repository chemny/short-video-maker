import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
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

// 无图时的渐变兜底背景（按 sceneIndex 换色）
const FALLBACK_GRADIENTS = [
  'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
  'linear-gradient(160deg, #0d1b2a 0%, #1b2a3b 40%, #2d4a6b 100%)',
  'linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 40%, #4a2d7a 100%)',
  'linear-gradient(160deg, #0a1a0d 0%, #1b3a20 40%, #2d5a35 100%)',
  'linear-gradient(160deg, #2a1a0a 0%, #4e3a1b 40%, #7a5a2d 100%)',
];

const extractKeywords = (scene: Scene): string[] => {
  const fromCaption = scene.caption
    .split(/[，、：:？?。！\s]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 8);
  const fromAlt = (scene.visual?.alt ?? '')
    .split(/[，、：:？?。！\s]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 8);
  return Array.from(new Set([...fromCaption, ...fromAlt])).slice(0, 4);
};

export const SceneImageOverlay = ({
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

  const accent = plan.style.accent;
  const hasImage = !!scene.visual?.asset;
  const bare = !!scene.visual?.bare;

  // 慢速缩放：图片从 108% → 100%，制造 Ken Burns 感
  const imgScale = interpolate(frame, [0, durationInFrames], [1.08, 1.0], clamp);

  // 裸图模式：成品整图满屏 + 极轻微缓动，不叠任何文字层/蒙层。
  // 用 contain + 同色背景避免裁掉图上已有的文字；缓动幅度很小，防止边缘文字被裁。
  if (bare && hasImage) {
    const bareScale = interpolate(frame, [0, durationInFrames], [1.0, 1.035], clamp);
    return (
      <AbsoluteFill style={{background: plan.style.background ?? '#F5F0E8', overflow: 'hidden'}}>
        <Img
          src={staticFile(scene.visual!.asset!)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `scale(${bareScale})`,
            transformOrigin: 'center center',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 文字入场 springs
  const badgeReveal = spring({frame, fps, config: {damping: 200}, durationInFrames: 20});
  const titleReveal = spring({frame: frame - 8, fps, config: {damping: 150}, durationInFrames: 32});
  const bodyReveal  = spring({frame: frame - 16, fps, config: {damping: 160}, durationInFrames: 28});
  const kwReveal    = spring({frame: frame - 24, fps, config: {damping: 180}, durationInFrames: 28});

  const titleY = interpolate(titleReveal, [0, 1], [48, 0], clamp);
  const bodyY  = interpolate(bodyReveal,  [0, 1], [32, 0], clamp);
  const kwY    = interpolate(kwReveal,    [0, 1], [24, 0], clamp);

  const label    = sceneLabel[scene.type] ?? scene.type;
  const keywords = extractKeywords(scene);
  const titleSize = scene.caption.length > 18 ? 72 : scene.caption.length > 12 ? 86 : 100;

  const fallbackBg = FALLBACK_GRADIENTS[sceneIndex % FALLBACK_GRADIENTS.length];

  return (
    <AbsoluteFill
      style={{
        color: '#FFFFFF',
        fontFamily: '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ── 背景层 ── */}
      <AbsoluteFill style={{background: hasImage ? '#000' : fallbackBg}}>
        {hasImage && (
          <Img
            src={staticFile(scene.visual!.asset!)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${imgScale})`,
              transformOrigin: 'center center',
            }}
          />
        )}
        {/* 全屏暗化蒙层：统一降低图片亮度 */}
        <AbsoluteFill style={{background: 'rgba(0,0,0,0.28)'}} />
        {/* 底部渐变 scrim：文字区可读性 */}
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.88) 75%, rgba(0,0,0,0.96) 100%)',
          }}
        />
      </AbsoluteFill>

      {/* ── 顶部标签条 ── */}
      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          top: 72,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: badgeReveal,
        }}
      >
        {/* 场次计数 */}
        <div
          style={{
            color: 'rgba(255,255,255,0.50)',
            fontFamily: 'Menlo, ui-monospace, monospace',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          {String(sceneIndex + 1).padStart(2, '0')}
          <span style={{opacity: 0.45}}> / {String(totalScenes).padStart(2, '0')}</span>
        </div>
        {/* 场景类型标签 */}
        <div
          style={{
            backdropFilter: 'blur(12px)',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 8,
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 2,
            padding: '10px 22px',
          }}
        >
          {label}
        </div>
      </div>

      {/* ── 底部文字区（下 42%）── */}
      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          bottom: 180,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: 0,
        }}
      >
        {/* 话题标签 */}
        <div
          style={{
            alignSelf: 'flex-start',
            background: `${accent}33`,
            border: `1.5px solid ${accent}99`,
            borderRadius: 6,
            color: accent,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: 28,
            opacity: badgeReveal,
            padding: '8px 18px',
          }}
        >
          {plan.meta.topic}
        </div>

        {/* 主标题 */}
        <div
          style={{
            color: '#FFFFFF',
            fontSize: titleSize,
            fontWeight: 960,
            letterSpacing: -0.5,
            lineHeight: 1.1,
            marginBottom: 28,
            opacity: titleReveal,
            textShadow: '0 4px 24px rgba(0,0,0,0.6)',
            transform: `translateY(${titleY}px)`,
          }}
        >
          {scene.caption}
        </div>

        {/* accent 分割线 */}
        <div
          style={{
            background: `linear-gradient(90deg, ${accent} 0%, ${accent}00 100%)`,
            borderRadius: 3,
            height: 3,
            marginBottom: 28,
            width: interpolate(titleReveal, [0, 1], [0, 240], clamp),
          }}
        />

        {/* 旁白摘要 */}
        <div
          style={{
            color: 'rgba(255,255,255,0.72)',
            fontSize: 36,
            fontWeight: 500,
            lineHeight: 1.6,
            marginBottom: 40,
            maxWidth: 880,
            opacity: bodyReveal,
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            transform: `translateY(${bodyY}px)`,
          }}
        >
          {scene.voiceover.length > 70
            ? `${scene.voiceover.slice(0, 70)}…`
            : scene.voiceover}
        </div>

        {/* 关键词 chips — 毛玻璃风格 */}
        {keywords.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              opacity: kwReveal,
              transform: `translateY(${kwY}px)`,
            }}
          >
            {keywords.map((kw, i) => {
              const activateAt = (i / keywords.length) * durationInFrames;
              const chipOp = interpolate(frame, [activateAt, activateAt + 10], [0.3, 1], clamp);
              const isActive = frame >= activateAt;
              return (
                <div
                  key={kw}
                  style={{
                    backdropFilter: 'blur(8px)',
                    background: isActive
                      ? `${accent}2a`
                      : 'rgba(255,255,255,0.10)',
                    border: `1px solid ${isActive ? `${accent}88` : 'rgba(255,255,255,0.20)'}`,
                    borderRadius: 8,
                    color: isActive ? accent : 'rgba(255,255,255,0.70)',
                    fontSize: 30,
                    fontWeight: isActive ? 800 : 500,
                    opacity: chipOp,
                    padding: '12px 24px',
                  }}
                >
                  {kw}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

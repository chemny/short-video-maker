import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Scene, VideoPlan} from '../lib/types';
import {WireGlobe} from './WireGlobe';

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

const extractKeywords = (scene: Scene): string[] => {
  const fromCaption = scene.caption
    .split(/[，、：:？?。！\s]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 8);
  const fromAlt = (scene.visual?.alt ?? '')
    .split(/[，、：:？?。！\s]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 8);
  return Array.from(new Set([...fromCaption, ...fromAlt])).slice(0, 3);
};

// ── Background ────────────────────────────────────────────────────────────────

const DarkBackground = ({
  accent,
  sceneIndex,
  topic,
  progress,
  globe,
}: {
  accent: string;
  sceneIndex: number;
  topic: string;
  progress: number;
  globe?: VideoPlan['style']['globe'];
}) => {
  const drift = interpolate(progress, [0, 1], [0, -18], clamp);

  return (
    <AbsoluteFill style={{background: '#0D1117', overflow: 'hidden'}}>
      {/* subtle noise grain */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
          opacity: 0.4,
        }}
      />
      {/* top-right glow */}
      <div
        style={{
          position: 'absolute',
          right: -180,
          top: -180,
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
          transform: `translateY(${drift}px)`,
        }}
      />
      {/* bottom-left glow */}
      <div
        style={{
          position: 'absolute',
          left: -140,
          bottom: 200,
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}0e 0%, transparent 70%)`,
        }}
      />
      {/* wire globe — params from plan.style.globe, fallback to template defaults */}
      <WireGlobe
        cx={globe?.cx ?? 1008}
        cy={globe?.cy ?? 1472}
        radius={globe?.radius ?? 1056}
        color={accent}
        maxOpacity={globe?.maxOpacity ?? 0.22}
        speed={globe?.speed ?? 0.1152}
        polarCapDeg={globe?.polarCapDeg ?? 18}
      />

      {/* large watermark number */}
      <div
        style={{
          position: 'absolute',
          right: 40,
          bottom: 280,
          color: 'rgba(255,255,255,0.025)',
          fontSize: 480,
          fontWeight: 900,
          lineHeight: 1,
          userSelect: 'none',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(sceneIndex + 1).padStart(2, '0')}
      </div>
    </AbsoluteFill>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const SceneDarkCard = ({
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

  const accent = plan.style.accent;
  const textPrimary = '#F9FAFB';
  const textSecondary = '#9CA3AF';

  // entrance springs
  const badgeReveal  = spring({frame,       fps, config: {damping: 200}, durationInFrames: 20});
  const titleReveal  = spring({frame: frame - 6,  fps, config: {damping: 160}, durationInFrames: 28});
  const ruleReveal   = spring({frame: frame - 10, fps, config: {damping: 220}, durationInFrames: 24});
  const bodyReveal   = spring({frame: frame - 14, fps, config: {damping: 160}, durationInFrames: 28});
  const kwReveal     = spring({frame: frame - 20, fps, config: {damping: 180}, durationInFrames: 28});

  const titleY  = interpolate(titleReveal,  [0, 1], [36, 0], clamp);
  const bodyY   = interpolate(bodyReveal,   [0, 1], [28, 0], clamp);
  const kwY     = interpolate(kwReveal,     [0, 1], [24, 0], clamp);
  const ruleW   = interpolate(ruleReveal,   [0, 1], [0, 280], clamp);

  const label = sceneLabel[scene.type] ?? scene.type;
  const keywords = extractKeywords(scene);
  const titleSize = scene.caption.length > 22 ? 68 : scene.caption.length > 14 ? 80 : 94;

  // 卡片正文：优先用精写的 scene.body，缺省回退到旁白摘要
  const bodyText =
    scene.body && scene.body.trim()
      ? scene.body
      : scene.voiceover.length > 80
      ? `${scene.voiceover.slice(0, 80)}…`
      : scene.voiceover;

  // 标签：优先用 plan 富集过的 scene.tags（带 at 点亮时刻），否则回退到旁白提取
  const tagItems: Array<{text: string; at: number | null}> =
    Array.isArray(scene.tags) && scene.tags.length > 0
      ? scene.tags.map((t) =>
          typeof t === 'string' ? {text: t, at: null} : {text: t.text, at: t.at ?? null},
        )
      : keywords.map((text) => ({text, at: null}));

  return (
    <AbsoluteFill
      style={{
        color: textPrimary,
        fontFamily: '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <DarkBackground
        accent={accent}
        sceneIndex={sceneIndex}
        topic={plan.meta.topic}
        progress={progress}
        globe={plan.style.globe}
      />

      {/* ── top bar ── */}
      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          top: 72,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* counter */}
        <div
          style={{
            color: 'rgba(255,255,255,0.30)',
            fontFamily: 'Menlo, ui-monospace, monospace',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          {String(sceneIndex + 1).padStart(2, '0')}
          <span style={{opacity: 0.4}}> / {String(totalScenes).padStart(2, '0')}</span>
        </div>
        {/* type badge */}
        <div
          style={{
            background: `${accent}22`,
            border: `1.5px solid ${accent}88`,
            borderRadius: 8,
            color: accent,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 2,
            opacity: badgeReveal,
            padding: '10px 22px',
          }}
        >
          {label}
        </div>
      </div>

      {/* ── main content zone ── */}
      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          top: 600,
          bottom: 260,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: 0,
        }}
      >
        {/* topic tag */}
        <div
          style={{
            alignSelf: 'flex-start',
            background: `${accent}1a`,
            border: `1px solid ${accent}55`,
            borderRadius: 6,
            color: accent,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: 36,
            opacity: badgeReveal,
            padding: '8px 18px',
          }}
        >
          {plan.meta.topic}
        </div>

        {/* main caption */}
        <div
          style={{
            color: textPrimary,
            fontSize: titleSize,
            fontWeight: 960,
            letterSpacing: -0.5,
            lineHeight: 1.1,
            marginBottom: 32,
            opacity: titleReveal,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {scene.caption}
        </div>

        {/* accent rule */}
        <div
          style={{
            background: `linear-gradient(90deg, ${accent} 0%, ${accent}00 100%)`,
            borderRadius: 4,
            height: 4,
            marginBottom: 36,
            width: ruleW,
          }}
        />

        {/* 支撑句正文（精写，不重复旁白） */}
        <div
          style={{
            color: textSecondary,
            fontSize: 36,
            fontWeight: 500,
            lineHeight: 1.65,
            marginBottom: 52,
            maxWidth: 900,
            opacity: bodyReveal,
            transform: `translateY(${bodyY}px)`,
          }}
        >
          {bodyText}
        </div>

        {/* 标签 chips — 在被念到的时刻点亮（词时间戳真同步） */}
        {tagItems.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              opacity: kwReveal,
              transform: `translateY(${kwY}px)`,
            }}
          >
            {tagItems.map((item, i) => {
              // 有真实时刻则按"被念到时"点亮（at 为绝对秒，换算成场景内相对帧）；
              // 否则回退到场景内均匀分布
              const activateAt =
                item.at != null
                  ? Math.max(0, (item.at - scene.start) * fps)
                  : (i / tagItems.length) * durationInFrames;
              const chipReveal = interpolate(frame, [activateAt, activateAt + 8], [0, 1], clamp);
              const isActive = frame >= activateAt;
              return (
                <div
                  key={`${item.text}-${i}`}
                  style={{
                    background: isActive ? `${accent}30` : 'rgba(255,255,255,0.06)',
                    border: `1.5px solid ${isActive ? `${accent}` : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 8,
                    color: isActive ? accent : textSecondary,
                    fontSize: 32,
                    fontWeight: isActive ? 800 : 600,
                    padding: '14px 28px',
                    transition: 'none',
                    transform: `scale(${interpolate(chipReveal, [0, 1], [0.94, 1], clamp)})`,
                    opacity: interpolate(frame, [activateAt, activateAt + 6], [0.4, 1], clamp),
                  }}
                >
                  {item.text}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </AbsoluteFill>
  );
};

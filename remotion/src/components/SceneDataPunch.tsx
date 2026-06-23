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
const easeOut = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)} as const;
const easeOutQuart = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.poly(4))} as const;

const sceneLabel: Record<string, string> = {
  hook: '开场', definition: '定义', explain: '解析', example: '案例',
  benefits: '价值', howto: '步骤', risk: '风险', ending: '总结',
  thesis: '核心', analysis: '分析', process: '流程', framework: '框架',
  step: '步骤', mistake: '避坑',
};

// 脉冲光圈 SVG
const PulseRing = ({cx, cy, r, color, frame, delay}: {
  cx: number; cy: number; r: number; color: string; frame: number; delay: number;
}) => {
  const t = ((frame - delay) % 60) / 60;
  if (t < 0) return null;
  const scale = interpolate(t, [0, 1], [0.8, 1.6], clamp);
  const opacity = interpolate(t, [0, 0.4, 1], [0.5, 0.3, 0], clamp);
  return (
    <circle
      cx={cx} cy={cy}
      r={r * scale}
      fill="none"
      stroke={color}
      strokeWidth="2"
      opacity={opacity}
    />
  );
};

// 对比条（comparison bar）
const ComparisonBar = ({
  before, after, label, color, frame,
}: {before: number; after: number; label: string; color: string; frame: number}) => {
  const maxVal = Math.max(before, after);
  const beforeW = interpolate(frame, [20, 50], [0, (before / maxVal) * 100], easeOutQuart);
  const afterW  = interpolate(frame, [30, 60], [0, (after  / maxVal) * 100], easeOutQuart);
  const labelOp = interpolate(frame, [18, 32], [0, 1], easeOut);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14, width: '100%', opacity: labelOp}}>
      <div style={{fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em'}}>
        {label}
      </div>
      {/* Before */}
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{width: 80, fontSize: 24, color: 'rgba(255,255,255,0.40)', textAlign: 'right', fontFamily: 'Menlo,monospace'}}>
          之前
        </div>
        <div style={{flex: 1, height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden'}}>
          <div style={{
            width: `${beforeW}%`, height: '100%', borderRadius: 6,
            background: 'rgba(255,255,255,0.25)',
          }} />
        </div>
        <div style={{width: 60, fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.50)', fontFamily: 'Menlo,monospace'}}>
          {before}
        </div>
      </div>
      {/* After */}
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{width: 80, fontSize: 24, color: color, textAlign: 'right', fontFamily: 'Menlo,monospace', fontWeight: 700}}>
          之后
        </div>
        <div style={{flex: 1, height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden'}}>
          <div style={{
            width: `${afterW}%`, height: '100%', borderRadius: 6,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
          }} />
        </div>
        <div style={{width: 60, fontSize: 26, fontWeight: 800, color, fontFamily: 'Menlo,monospace'}}>
          {after}
        </div>
      </div>
    </div>
  );
};

export const SceneDataPunch = ({
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
  const data = scene.data;
  const metric = data?.metric;
  const comparison = data?.comparison;
  const stats = data?.stats ?? [];

  // 计数动画：60帧内从0数到目标值
  const countDuration = 55;
  const countProgress = interpolate(frame, [8, 8 + countDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const displayValue = metric
    ? Math.round(countProgress * metric.value)
    : null;

  // 计数完成时的脉冲缩放
  const punchScale = spring({
    frame: frame - (8 + countDuration),
    fps,
    config: {damping: 12, stiffness: 200},
    durationInFrames: 20,
  });
  const numScale = 1 + interpolate(punchScale, [0, 1], [0, 0.06], clamp);

  // 其他入场
  const masterIn  = interpolate(frame, [0, 18],  [0, 1], easeOut);
  const labelIn   = interpolate(frame, [4, 22],  [0, 1], easeOut);
  const labelY    = interpolate(frame, [4, 22],  [16, 0], easeOut);
  const numIn     = interpolate(frame, [6, 28],  [0, 1], easeOut);
  const unitIn    = interpolate(frame, [10, 32], [0, 1], easeOut);
  const ruleW     = interpolate(frame, [30, 50], [0, 120], easeOutQuart);
  const bodyIn    = interpolate(frame, [35, 55], [0, 1], easeOut);
  const bodyY     = interpolate(frame, [35, 55], [20, 0], easeOut);
  const statsIn   = interpolate(frame, [45, 65], [0, 1], easeOut);
  const statsY    = interpolate(frame, [45, 65], [24, 0], easeOut);

  // 背景光晕跟随计数强度
  const glowScale = 0.7 + 0.3 * countProgress + 0.06 * punchScale;

  const label = sceneLabel[scene.type] ?? scene.type;

  // caption 字号
  const captionSize = scene.caption.length > 14 ? 52 : scene.caption.length > 8 ? 62 : 72;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        fontFamily: '"PingFang SC","Noto Sans CJK SC","Helvetica Neue",Inter,system-ui,sans-serif',
        color: '#fff',
        background: '#06060e',
      }}
    >
      {/* ── 背景光晕（随计数脉动）── */}
      <AbsoluteFill>
        <div style={{
          position: 'absolute', left: '50%', top: '38%',
          transform: `translate(-50%, -50%) scale(${glowScale})`,
          width: 900, height: 900, borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}20 0%, ${accent}08 40%, transparent 70%)`,
        }} />
        <div style={{
          position: 'absolute', left: '50%', top: '38%',
          transform: `translate(-50%, -50%) scale(${glowScale * 0.6})`,
          width: 600, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}30 0%, transparent 60%)`,
        }} />
      </AbsoluteFill>

      {/* 脉冲光圈 SVG */}
      <svg width="1080" height="1920" style={{position: 'absolute', top: 0, left: 0, pointerEvents: 'none'}}>
        <PulseRing cx={540} cy={730} r={220} color={accent} frame={frame} delay={8 + countDuration} />
        <PulseRing cx={540} cy={730} r={220} color={accent} frame={frame} delay={8 + countDuration + 20} />
      </svg>

      {/* ── 顶部导航 ── */}
      <div style={{
        position: 'absolute', top: 64, left: 64, right: 64,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        opacity: masterIn,
      }}>
        <div style={{
          fontFamily: 'Menlo,"SF Mono",ui-monospace,monospace',
          fontSize: 22, fontWeight: 500,
          color: 'rgba(255,255,255,0.30)', letterSpacing: '0.14em',
        }}>
          {String(sceneIndex + 1).padStart(2, '0')}
          <span style={{opacity: 0.45}}> / {String(totalScenes).padStart(2, '0')}</span>
        </div>
        <div style={{
          fontSize: 20, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em', fontWeight: 600,
        }}>
          {plan.meta.topic}
        </div>
      </div>

      {/* ── 主内容区（垂直居中偏上）── */}
      <div style={{
        position: 'absolute', left: 64, right: 64,
        top: 180, bottom: 180,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0,
      }}>

        {/* Eyebrow */}
        <div style={{
          fontSize: 22, fontWeight: 700, letterSpacing: '0.20em',
          textTransform: 'uppercase', color: accent,
          fontFamily: 'Menlo,"SF Mono",ui-monospace,monospace',
          marginBottom: 36,
          opacity: labelIn, transform: `translateY(${labelY}px)`,
        }}>
          {label}
        </div>

        {/* 大标题/caption */}
        <div style={{
          fontSize: captionSize, fontWeight: 800,
          lineHeight: 1.1, letterSpacing: '-0.02em',
          textAlign: 'center', marginBottom: 48,
          opacity: labelIn, transform: `translateY(${labelY}px)`,
          background: `linear-gradient(135deg, #FFFFFF 40%, ${accent} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          {scene.caption}
        </div>

        {/* ── 核心数字 ── */}
        {metric && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            gap: 0, marginBottom: 16,
            opacity: numIn, transform: `scale(${numScale})`,
          }}>
            {/* 主数字 */}
            <div style={{
              fontSize: 280, fontWeight: 800,
              lineHeight: 0.9, letterSpacing: '-0.04em',
              fontFamily: '"Helvetica Neue",Inter,system-ui,sans-serif',
              background: `linear-gradient(160deg, #FFFFFF 0%, ${accent} 60%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {displayValue?.toLocaleString()}
            </div>
            {/* 单位 */}
            {metric.unit && (
              <div style={{
                fontSize: 96, fontWeight: 700,
                lineHeight: 1, paddingTop: 32,
                color: accent, opacity: unitIn,
                fontFamily: '"Helvetica Neue",Inter,system-ui,sans-serif',
              }}>
                {metric.unit}
              </div>
            )}
          </div>
        )}

        {/* 指标标签 pill */}
        {metric && (
          <div style={{
            background: `${accent}1a`,
            border: `1px solid ${accent}55`,
            borderRadius: 100,
            padding: '12px 32px',
            fontSize: 30, fontWeight: 600,
            color: accent, letterSpacing: '0.04em',
            marginBottom: 48,
            opacity: unitIn,
          }}>
            {metric.label}
          </div>
        )}

        {/* 对比条 */}
        {comparison && (
          <div style={{width: '100%', marginBottom: 48, opacity: bodyIn, transform: `translateY(${bodyY}px)`}}>
            <ComparisonBar {...comparison} color={accent} frame={frame} />
          </div>
        )}

        {/* 分割线 */}
        <div style={{
          height: 1, borderRadius: 1, marginBottom: 36,
          width: ruleW,
          background: `linear-gradient(90deg, transparent, ${accent}66, transparent)`,
        }} />

        {/* 旁白说明 */}
        <div style={{
          fontSize: 34, fontWeight: 400, lineHeight: 1.65,
          color: 'rgba(255,255,255,0.60)',
          textAlign: 'center', maxWidth: 840,
          marginBottom: 52,
          opacity: bodyIn, transform: `translateY(${bodyY}px)`,
        }}>
          {scene.voiceover.length > 60 ? `${scene.voiceover.slice(0, 60)}…` : scene.voiceover}
        </div>

        {/* ── 次级指标卡（3列）── */}
        {stats.length > 0 && (
          <div style={{
            display: 'flex', gap: 20, width: '100%',
            opacity: statsIn, transform: `translateY(${statsY}px)`,
          }}>
            {stats.map((s, i) => {
              const cardIn = interpolate(frame, [50 + i * 6, 68 + i * 6], [0, 1], easeOut);
              return (
                <div key={i} style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${accent}33`,
                  borderRadius: 16,
                  padding: '24px 20px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 10,
                  opacity: cardIn,
                }}>
                  <div style={{
                    fontSize: 56, fontWeight: 800,
                    letterSpacing: '-0.02em', lineHeight: 1,
                    color: accent,
                    fontFamily: '"Helvetica Neue",Inter,system-ui,sans-serif',
                  }}>
                    {s.value}
                  </div>
                  <div style={{
                    fontSize: 24, fontWeight: 500,
                    color: 'rgba(255,255,255,0.45)',
                    textAlign: 'center', lineHeight: 1.4,
                  }}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 底部进度条 ── */}
      <div style={{
        position: 'absolute', bottom: 72, left: 64, right: 64,
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: masterIn,
      }}>
        {Array.from({length: totalScenes}).map((_, i) => (
          <div key={i} style={{
            height: 3, borderRadius: 2,
            flex: i === sceneIndex ? 3 : 1,
            background: i === sceneIndex
              ? `linear-gradient(90deg, ${accent}, ${accent}88)`
              : 'rgba(255,255,255,0.15)',
          }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

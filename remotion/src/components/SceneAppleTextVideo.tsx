import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Scene, VideoPlan} from '../lib/types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const easeOut = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)} as const;
const easeOutQuart = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)} as const;

// 每种场景类型的配色方案
const SCENE_PALETTE: Record<string, {primary: string; secondary: string; bg1: string; bg2: string}> = {
  hook:       {primary: '#60A5FA', secondary: '#818CF8', bg1: '#0d0e2a', bg2: '#0a0a1a'},
  definition: {primary: '#A78BFA', secondary: '#F472B6', bg1: '#140d2a', bg2: '#0e0a1a'},
  explain:    {primary: '#34D399', secondary: '#60A5FA', bg1: '#0a1f1a', bg2: '#080d14'},
  example:    {primary: '#FBBF24', secondary: '#F97316', bg1: '#1a120a', bg2: '#140c06'},
  benefits:   {primary: '#10B981', secondary: '#34D399', bg1: '#0a1a12', bg2: '#060e0a'},
  howto:      {primary: '#3B82F6', secondary: '#60A5FA', bg1: '#0a0e20', bg2: '#080c18'},
  risk:       {primary: '#F87171', secondary: '#FBBF24', bg1: '#1a0a0a', bg2: '#120606'},
  ending:     {primary: '#94A3B8', secondary: '#CBD5E1', bg1: '#0e1018', bg2: '#0a0c14'},
  thesis:     {primary: '#E879F9', secondary: '#A78BFA', bg1: '#160a20', bg2: '#0e0614'},
  analysis:   {primary: '#06B6D4', secondary: '#3B82F6', bg1: '#0a1620', bg2: '#060e18'},
  process:    {primary: '#6EE7B7', secondary: '#34D399', bg1: '#0a1a14', bg2: '#060e0a'},
  framework:  {primary: '#FCD34D', secondary: '#FBBF24', bg1: '#181206', bg2: '#120e04'},
  step:       {primary: '#38BDF8', secondary: '#818CF8', bg1: '#0a1220', bg2: '#060c18'},
  mistake:    {primary: '#F97316', secondary: '#F87171', bg1: '#1a0e06', bg2: '#120800'},
};

const DEFAULT_PALETTE = {primary: '#60A5FA', secondary: '#818CF8', bg1: '#0d0e2a', bg2: '#0a0a1a'};

const sceneLabel: Record<string, string> = {
  hook: '开场', definition: '定义', explain: '解析', example: '案例',
  benefits: '价值', howto: '步骤', risk: '风险', ending: '总结',
  thesis: '核心', analysis: '分析', process: '流程', framework: '框架',
  step: '步骤', mistake: '避坑',
};

// 点阵装饰 SVG
const DotGrid = ({color, opacity}: {color: string; opacity: number}) => (
  <svg width="320" height="320" style={{position: 'absolute', bottom: 160, right: 40, opacity}}>
    <defs>
      <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.8" fill={color} />
      </pattern>
    </defs>
    <rect width="320" height="320" fill="url(#dots)" />
  </svg>
);

// 大弧线装饰
const ArcDecor = ({color, opacity, frame}: {color: string; opacity: number; frame: number}) => {
  const rot = interpolate(frame, [0, 900], [0, 15], clamp);
  return (
    <svg
      width="700" height="700"
      style={{position: 'absolute', top: -200, right: -200, opacity, transform: `rotate(${rot}deg)`}}
    >
      <circle cx="350" cy="350" r="300" fill="none" stroke={color} strokeWidth="1" />
      <circle cx="350" cy="350" r="230" fill="none" stroke={color} strokeWidth="0.5" />
      <circle cx="350" cy="350" r="160" fill="none" stroke={color} strokeWidth="0.5" />
      {/* 刻度线 */}
      {Array.from({length: 24}).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r1 = 290, r2 = 310;
        return (
          <line
            key={i}
            x1={350 + r1 * Math.cos(a)} y1={350 + r1 * Math.sin(a)}
            x2={350 + r2 * Math.cos(a)} y2={350 + r2 * Math.sin(a)}
            stroke={color} strokeWidth="1"
          />
        );
      })}
    </svg>
  );
};

export const SceneAppleTextVideo = ({
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

  const palette = SCENE_PALETTE[scene.type] ?? DEFAULT_PALETTE;
  const {primary, secondary, bg1, bg2} = palette;

  // ── 入场动画 ──────────────────────────────────────────────────────────────
  const masterIn   = interpolate(frame, [0, 20],  [0, 1], easeOut);
  const numIn      = interpolate(frame, [0, 30],  [60, 0], easeOut);
  const numOp      = interpolate(frame, [0, 24],  [0, 0.49], easeOut);
  const eyebrowIn  = interpolate(frame, [6, 26],  [0, 1], easeOut);
  const titleIn    = interpolate(frame, [12, 40], [0, 1], easeOut);
  const titleY     = interpolate(frame, [12, 40], [40, 0], easeOut);
  const lineW      = interpolate(frame, [24, 44], [0, 200], easeOutQuart);
  const bodyIn     = interpolate(frame, [28, 50], [0, 1], easeOut);
  const bodyY      = interpolate(frame, [28, 50], [24, 0], easeOut);
  const tagIn      = interpolate(frame, [38, 56], [0, 1], easeOut);

  const label = sceneLabel[scene.type] ?? scene.type;
  const titleSize = scene.caption.length > 14 ? 88 : scene.caption.length > 9 ? 104 : 120;
  const bodyText = scene.voiceover.length > 60 ? `${scene.voiceover.slice(0, 60)}…` : scene.voiceover;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        fontFamily: '"PingFang SC","Noto Sans CJK SC","Helvetica Neue",Inter,system-ui,sans-serif',
        color: '#fff',
      }}
    >
      {/* ── 渐变背景 ─────────────────────────────────────────────── */}
      <AbsoluteFill style={{background: `linear-gradient(160deg, ${bg1} 0%, ${bg2} 100%)`}} />

      {/* 彩色 blob ×3 */}
      <AbsoluteFill>
        <div style={{
          position: 'absolute', top: -300, left: -200,
          width: 900, height: 900, borderRadius: '50%',
          background: `radial-gradient(circle, ${primary}22 0%, transparent 65%)`,
        }} />
        <div style={{
          position: 'absolute', bottom: -200, right: -300,
          width: 800, height: 800, borderRadius: '50%',
          background: `radial-gradient(circle, ${secondary}18 0%, transparent 65%)`,
        }} />
        <div style={{
          position: 'absolute', top: '40%', left: '30%',
          width: 600, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, ${primary}0c 0%, transparent 65%)`,
        }} />
      </AbsoluteFill>

      {/* ── 装饰层 ──────────────────────────────────────────────── */}
      <ArcDecor color={primary} opacity={0.18} frame={frame} />
      <DotGrid color={primary} opacity={0.25} />


      {/* ── 顶部导航 ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 64, left: 80, right: 64,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        opacity: masterIn,
      }}>
        <div style={{
          fontFamily: 'Menlo,"SF Mono",ui-monospace,monospace',
          fontSize: 22, fontWeight: 500,
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em',
        }}>
          {String(sceneIndex + 1).padStart(2, '0')}
          <span style={{opacity: 0.45}}> / {String(totalScenes).padStart(2, '0')}</span>
        </div>
        <div style={{
          fontSize: 20, fontWeight: 600,
          color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em',
        }}>
          {plan.meta.topic}
        </div>
      </div>

      {/* ── 大场次数字（右侧装饰）─────────────────────────────── */}
      <div style={{
        position: 'absolute', right: 48, top: 130,
        fontSize: 182, fontWeight: 200, lineHeight: 1,
        letterSpacing: '0.02em',
        fontFamily: '"Helvetica Neue","PingFang SC",Inter,system-ui,sans-serif',
        background: `linear-gradient(135deg, ${primary}55 0%, ${secondary}22 100%)`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        opacity: numOp,
        transform: `translateY(${numIn}px)`,
        userSelect: 'none',
      }}>
        {String(sceneIndex + 1).padStart(2, '0')}
      </div>

      {/* ── 主内容卡片（玻璃态）─────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        left: 80, right: 56,
        top: 314, bottom: 160,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
      }}>

        {/* EYEBROW */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: 32, opacity: eyebrowIn,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: `linear-gradient(135deg, ${primary}, ${secondary})`,
            boxShadow: `0 0 12px ${primary}`,
          }} />
          <div style={{
            fontSize: 22, fontWeight: 700,
            color: primary, letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontFamily: 'Menlo,"SF Mono",ui-monospace,monospace',
          }}>
            {label}
          </div>
        </div>

        {/* 主标题 — 渐变文字 */}
        <div style={{
          fontSize: titleSize, fontWeight: 800,
          lineHeight: 1.08, letterSpacing: '-0.02em',
          marginBottom: 44,
          background: `linear-gradient(130deg, #FFFFFF 0%, #FFFFFF 40%, ${primary} 80%, ${secondary} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          opacity: titleIn,
          transform: `translateY(${titleY}px)`,
        }}>
          {scene.caption}
        </div>

        {/* 渐变分割线 */}
        <div style={{
          height: 2, borderRadius: 2,
          marginBottom: 40,
          width: lineW,
          background: `linear-gradient(90deg, ${primary} 0%, ${secondary} 60%, transparent 100%)`,
        }} />

        {/* 玻璃态正文卡 */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid rgba(255,255,255,0.10)`,
          borderRadius: 20,
          padding: '32px 36px',
          marginBottom: 40,
          opacity: bodyIn,
          transform: `translateY(${bodyY}px)`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 卡片左侧彩色边框 */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: 3, borderRadius: '20px 0 0 20px',
            background: `linear-gradient(to bottom, ${primary}, ${secondary})`,
          }} />
          <div style={{
            fontSize: 36, fontWeight: 400, lineHeight: 1.7,
            color: 'rgba(255,255,255,0.72)',
            letterSpacing: '0.01em',
          }}>
            {bodyText}
          </div>
        </div>

        {/* 标签行 */}
        <div style={{
          display: 'flex', gap: 14, flexWrap: 'wrap',
          opacity: tagIn,
          marginBottom: 32,
        }}>
          {/* 话题标签 */}
          <div style={{
            background: `linear-gradient(135deg, ${primary}28, ${secondary}18)`,
            border: `1px solid ${primary}44`,
            borderRadius: 100,
            padding: '10px 24px',
            fontSize: 26, fontWeight: 600,
            color: primary, letterSpacing: '0.02em',
          }}>
            # {plan.meta.topic}
          </div>
          {/* 场景类型标签 */}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 100,
            padding: '10px 24px',
            fontSize: 26, fontWeight: 500,
            color: 'rgba(255,255,255,0.50)',
          }}>
            {label}
          </div>
        </div>

        {/* 16:9 图片框 */}
        <div style={{
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 16,
          overflow: 'hidden',
          opacity: tagIn,
          position: 'relative',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${primary}33`,
        }}>
          {scene.visual?.asset ? (
            <Img
              src={staticFile(scene.visual.asset)}
              style={{width: '100%', height: '100%', objectFit: 'cover'}}
            />
          ) : (
            /* 占位框 */
            <>
              {/* 对角线装饰 */}
              <svg width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
                <line x1="0" y1="0" x2="100%" y2="100%" stroke={primary} strokeWidth="0.8" strokeOpacity="0.2" />
                <line x1="100%" y1="0" x2="0" y2="100%" stroke={primary} strokeWidth="0.8" strokeOpacity="0.2" />
                <rect x="1" y="1" width="calc(100% - 2)" height="calc(100% - 2)"
                  fill="none" stroke={primary} strokeWidth="1" strokeOpacity="0.15"
                  strokeDasharray="8 6" rx="15" />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <div style={{
                  fontSize: 48, opacity: 0.25,
                  background: `linear-gradient(135deg, ${primary}, ${secondary})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>⬛</div>
                <div style={{
                  fontSize: 24, fontWeight: 500,
                  color: `${primary}88`,
                  letterSpacing: '0.12em',
                  fontFamily: 'Menlo,"SF Mono",ui-monospace,monospace',
                }}>
                  {scene.visual?.prompt ? 'AI IMAGE · PENDING' : '16 : 9'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 底部进度条 ─────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 72, left: 80, right: 64,
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: masterIn,
      }}>
        {Array.from({length: totalScenes}).map((_, i) => (
          <div key={i} style={{
            height: 3, borderRadius: 2,
            flex: i === sceneIndex ? 3 : 1,
            background: i === sceneIndex
              ? `linear-gradient(90deg, ${primary}, ${secondary})`
              : 'rgba(255,255,255,0.15)',
          }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

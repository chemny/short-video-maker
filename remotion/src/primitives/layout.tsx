/**
 * 布局类原语
 * SceneHeader   — 顶部导航条（场次 + 话题）
 * SceneFooter   — 底部进度条
 * GlassCard     — 玻璃态卡片容器
 * Chip          — 标签 / 胶囊按钮
 * Divider       — 动态渐变分割线
 */
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {ReactNode, CSSProperties} from 'react';

const easeOut = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
  easing: Easing.out(Easing.cubic),
};

// ── SceneHeader ───────────────────────────────────────────────────────────────
/** 顶部左：场次计数；右：话题名称 */
export const SceneHeader = ({
  sceneIndex,
  totalScenes,
  topic,
  startFrame = 0,
  style,
}: {
  sceneIndex: number;
  totalScenes: number;
  topic: string;
  startFrame?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], easeOut);

  return (
    <div style={{
      position: 'absolute', top: 64, left: 64, right: 64,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      opacity,
      ...style,
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
        fontSize: 20, fontWeight: 600,
        color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em',
      }}>
        {topic}
      </div>
    </div>
  );
};

// ── SceneFooter ───────────────────────────────────────────────────────────────
/** 底部分段进度条，当前 scene 段落拉长高亮 */
export const SceneFooter = ({
  sceneIndex,
  totalScenes,
  color = '#F59E0B',
  startFrame = 0,
}: {
  sceneIndex: number;
  totalScenes: number;
  color?: string;
  startFrame?: number;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], easeOut);

  return (
    <div style={{
      position: 'absolute', bottom: 72, left: 64, right: 64,
      display: 'flex', alignItems: 'center', gap: 12,
      opacity,
    }}>
      {Array.from({length: totalScenes}).map((_, i) => (
        <div key={i} style={{
          height: 3, borderRadius: 2,
          flex: i === sceneIndex ? 3 : 1,
          background: i === sceneIndex
            ? `linear-gradient(90deg, ${color}, ${color}88)`
            : 'rgba(255,255,255,0.15)',
        }} />
      ))}
    </div>
  );
};

// ── GlassCard ─────────────────────────────────────────────────────────────────
/** 玻璃态卡片，支持左侧彩色边框线 */
export const GlassCard = ({
  children,
  accentColor,
  startFrame = 0,
  borderRadius = 20,
  padding = '32px 36px',
  style,
}: {
  children: ReactNode;
  accentColor?: string;
  startFrame?: number;
  borderRadius?: number;
  padding?: string;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], easeOut);
  const y = interpolate(frame, [startFrame, startFrame + 20], [20, 0], easeOut);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius,
      padding,
      opacity, transform: `translateY(${y}px)`,
      position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {accentColor && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, borderRadius: `${borderRadius}px 0 0 ${borderRadius}px`,
          background: `linear-gradient(to bottom, ${accentColor}, ${accentColor}55)`,
        }} />
      )}
      {children}
    </div>
  );
};

// ── Chip ──────────────────────────────────────────────────────────────────────
/** 标签胶囊，支持实色/渐变/ghost 三种变体 */
export const Chip = ({
  children,
  color = '#F59E0B',
  variant = 'tint',
  startFrame = 0,
  style,
}: {
  children: ReactNode;
  color?: string;
  variant?: 'tint' | 'outline' | 'ghost';
  startFrame?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 14], [0, 1], easeOut);

  const variantStyle: CSSProperties =
    variant === 'tint'
      ? {background: `${color}22`, border: `1px solid ${color}55`, color}
      : variant === 'outline'
      ? {background: 'transparent', border: `1.5px solid ${color}`, color}
      : {background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)'};

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      borderRadius: 100, padding: '10px 24px',
      fontSize: 26, fontWeight: 600, letterSpacing: '0.02em',
      opacity,
      ...variantStyle,
      ...style,
    }}>
      {children}
    </div>
  );
};

// ── Divider ───────────────────────────────────────────────────────────────────
/** 从左向右展开的渐变分割线 */
export const Divider = ({
  color = '#F59E0B',
  maxWidth = 160,
  startFrame = 0,
  duration = 20,
  height = 2,
  style,
}: {
  color?: string;
  maxWidth?: number;
  startFrame?: number;
  duration?: number;
  height?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [startFrame, startFrame + duration], [0, maxWidth], {
    ...easeOut, easing: Easing.out(Easing.poly(4)),
  });

  return (
    <div style={{
      height, borderRadius: height / 2,
      width: w,
      background: `linear-gradient(90deg, ${color} 0%, ${color}00 100%)`,
      ...style,
    }} />
  );
};

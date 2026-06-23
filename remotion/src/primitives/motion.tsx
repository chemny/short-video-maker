/**
 * 动画包装器原语
 * 用法：<FadeUp delay={6}><你的内容 /></FadeUp>
 */
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {ReactNode} from 'react';
import {Springs} from './springs';

const easeOut = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
  easing: Easing.out(Easing.cubic),
};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

// ── FadeUp ──────────────────────────────────────────────────────────────────
/** 淡入 + 上移，最常用的入场方式 */
export const FadeUp = ({
  children,
  delay = 0,
  duration = 20,
  distance = 28,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + duration], [0, 1], easeOut);
  const y = interpolate(frame, [delay, delay + duration], [distance, 0], easeOut);
  return (
    <div style={{opacity, transform: `translateY(${y}px)`, ...style}}>
      {children}
    </div>
  );
};

// ── ScaleIn ─────────────────────────────────────────────────────────────────
/** 缩放 + 淡入，适合数字、图标、徽章 */
export const ScaleIn = ({
  children,
  delay = 0,
  from = 0.88,
  springConfig = Springs.default,
  style,
}: {
  children: ReactNode;
  delay?: number;
  from?: number;
  springConfig?: {damping: number; stiffness: number; mass: number};
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: springConfig, durationInFrames: 30});
  const scale = interpolate(s, [0, 1], [from, 1], clamp);
  const opacity = interpolate(frame, [delay, delay + 12], [0, 1], easeOut);
  return (
    <div style={{opacity, transform: `scale(${scale})`, ...style}}>
      {children}
    </div>
  );
};

// ── StaggerIn ───────────────────────────────────────────────────────────────
/** 子元素依次入场，自动计算每个子元素的延迟 */
export const StaggerIn = ({
  children,
  startDelay = 0,
  staggerFrames = 6,
  duration = 20,
  distance = 20,
}: {
  children: ReactNode[];
  startDelay?: number;
  staggerFrames?: number;
  duration?: number;
  distance?: number;
}) => {
  return (
    <>
      {children.map((child, i) => (
        <FadeUp
          key={i}
          delay={startDelay + i * staggerFrames}
          duration={duration}
          distance={distance}
        >
          {child}
        </FadeUp>
      ))}
    </>
  );
};

// ── SlideIn ──────────────────────────────────────────────────────────────────
/** 从指定方向滑入 */
export const SlideIn = ({
  children,
  delay = 0,
  duration = 24,
  from = 'left' as 'left' | 'right' | 'top' | 'bottom',
  distance = 40,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  from?: 'left' | 'right' | 'top' | 'bottom';
  distance?: number;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + duration], [0, 1], easeOut);
  const opacity = interpolate(frame, [delay, delay + duration], [0, 1], easeOut);
  const dx = from === 'left' ? -distance : from === 'right' ? distance : 0;
  const dy = from === 'top'  ? -distance : from === 'bottom' ? distance : 0;
  return (
    <div style={{
      opacity,
      transform: `translate(${dx * (1 - t)}px, ${dy * (1 - t)}px)`,
      ...style,
    }}>
      {children}
    </div>
  );
};

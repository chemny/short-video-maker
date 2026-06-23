/**
 * 文字类原语
 * GradientText — 渐变填充文字
 * CountUp      — 数字计数动画
 * TextReveal   — 逐词/逐字显示
 */
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {ReactNode, CSSProperties} from 'react';
import {Springs} from './springs';

const easeOut = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
  easing: Easing.out(Easing.cubic),
};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

// ── GradientText ─────────────────────────────────────────────────────────────
/** 渐变色文字，支持任意 CSS 渐变方向与色标 */
export const GradientText = ({
  children,
  gradient,
  style,
}: {
  children: ReactNode;
  /** CSS gradient 字符串，如 'linear-gradient(135deg, #fff 40%, #F59E0B 100%)' */
  gradient: string;
  style?: CSSProperties;
}) => (
  <span style={{
    background: gradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    display: 'inline-block',
    ...style,
  }}>
    {children}
  </span>
);

// ── CountUp ──────────────────────────────────────────────────────────────────
/** 数字从 0（或 from）计数到 to，带可选的脉冲完成动效 */
export const CountUp = ({
  to,
  from = 0,
  startFrame = 0,
  duration = 55,
  decimals = 0,
  suffix = '',
  prefix = '',
  pulse = true,
  color,
  fontSize = 280,
  style,
}: {
  to: number;
  from?: number;
  startFrame?: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  pulse?: boolean;
  color?: string;
  fontSize?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    ...easeOut,
    easing: Easing.out(Easing.cubic),
  });
  const value = from + progress * (to - from);
  const display = value.toFixed(decimals);

  // 计数完成后的脉冲缩放
  const punchSpring = spring({
    frame: frame - (startFrame + duration),
    fps,
    config: Springs.punch,
    durationInFrames: 20,
  });
  const scale = pulse ? 1 + interpolate(punchSpring, [0, 1], [0, 0.05], clamp) : 1;

  return (
    <span style={{
      fontFamily: '"Helvetica Neue", Inter, system-ui, sans-serif',
      fontSize,
      fontWeight: 800,
      lineHeight: 0.9,
      letterSpacing: '-0.04em',
      color: color ?? 'inherit',
      display: 'inline-block',
      transform: `scale(${scale})`,
      transformOrigin: 'center bottom',
      ...style,
    }}>
      {prefix}{display}{suffix}
    </span>
  );
};

// ── TextReveal ───────────────────────────────────────────────────────────────
/** 文本按词（或字符）依次显示 */
export const TextReveal = ({
  text,
  splitBy = 'word',
  startFrame = 0,
  staggerFrames = 4,
  duration = 10,
  style,
  wordStyle,
}: {
  text: string;
  splitBy?: 'word' | 'char';
  startFrame?: number;
  staggerFrames?: number;
  duration?: number;
  style?: CSSProperties;
  wordStyle?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const tokens = splitBy === 'word' ? text.split(/(\s+)/) : text.split('');

  return (
    <span style={{display: 'inline', ...style}}>
      {tokens.map((token, i) => {
        const delay = startFrame + i * staggerFrames;
        const opacity = interpolate(frame, [delay, delay + duration], [0, 1], easeOut);
        const y = interpolate(frame, [delay, delay + duration], [12, 0], easeOut);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity,
              transform: `translateY(${y}px)`,
              whiteSpace: /^\s+$/.test(token) ? 'pre' : undefined,
              ...wordStyle,
            }}
          >
            {token}
          </span>
        );
      })}
    </span>
  );
};

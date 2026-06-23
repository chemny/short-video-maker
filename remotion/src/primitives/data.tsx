/**
 * 数据可视化原语
 * ProgressRing  — SVG 圆形进度环
 * AnimatedBar   — 水平进度条（带标签）
 * StatCard      — 单项指标卡
 * CompareBar    — 前后对比条组
 */
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {CSSProperties} from 'react';

const easeOut = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
  easing: Easing.out(Easing.poly(4)),
};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

// ── ProgressRing ─────────────────────────────────────────────────────────────
/** SVG 圆形进度环，progress 0~1 */
export const ProgressRing = ({
  progress,
  size = 200,
  strokeWidth = 8,
  color = '#F59E0B',
  trackColor = 'rgba(255,255,255,0.08)',
  startFrame = 0,
  duration = 60,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  startFrame?: number;
  duration?: number;
  children?: React.ReactNode;
}) => {
  const frame = useCurrentFrame();
  const animatedProgress = interpolate(frame, [startFrame, startFrame + duration], [0, progress], easeOut);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - animatedProgress);

  return (
    <div style={{position: 'relative', width: size, height: size}}>
      <svg width={size} height={size} style={{transform: 'rotate(-90deg)'}}>
        {/* 轨道 */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        {/* 进度弧 */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round" />
      </svg>
      {children && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ── AnimatedBar ───────────────────────────────────────────────────────────────
/** 单条水平进度条，带标签和数值 */
export const AnimatedBar = ({
  label,
  value,
  maxValue = 100,
  color = '#F59E0B',
  startFrame = 0,
  duration = 40,
  height = 12,
  showValue = true,
  style,
}: {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
  startFrame?: number;
  duration?: number;
  height?: number;
  showValue?: boolean;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [startFrame, startFrame + duration], [0, (value / maxValue) * 100], easeOut);
  const opacity = interpolate(frame, [startFrame, startFrame + 12], [0, 1], clamp);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 10, opacity, ...style}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <span style={{fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.65)'}}>
          {label}
        </span>
        {showValue && (
          <span style={{fontSize: 26, fontWeight: 700, color, fontFamily: 'Menlo,monospace'}}>
            {value}
          </span>
        )}
      </div>
      <div style={{
        height, borderRadius: height / 2,
        background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: height / 2,
          width: `${w}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
        }} />
      </div>
    </div>
  );
};

// ── StatCard ──────────────────────────────────────────────────────────────────
/** 单项指标卡片：大数值 + 说明标签 */
export const StatCard = ({
  value,
  label,
  color = '#F59E0B',
  startFrame = 0,
  style,
}: {
  value: string;
  label: string;
  color?: string;
  startFrame?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], {
    ...easeOut, easing: Easing.out(Easing.cubic),
  });
  const y = interpolate(frame, [startFrame, startFrame + 18], [20, 0], {
    ...easeOut, easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.05)',
      border: `1px solid ${color}33`,
      borderRadius: 16,
      padding: '24px 20px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 10,
      opacity, transform: `translateY(${y}px)`,
      ...style,
    }}>
      <div style={{
        fontSize: 56, fontWeight: 800,
        letterSpacing: '-0.02em', lineHeight: 1,
        color,
        fontFamily: '"Helvetica Neue", Inter, system-ui, sans-serif',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 24, fontWeight: 500,
        color: 'rgba(255,255,255,0.45)',
        textAlign: 'center', lineHeight: 1.4,
      }}>
        {label}
      </div>
    </div>
  );
};

// ── CompareBar ────────────────────────────────────────────────────────────────
/** 前后对比条组（before / after 两行） */
export const CompareBar = ({
  before,
  after,
  label,
  color = '#F59E0B',
  startFrame = 0,
  beforeLabel = '之前',
  afterLabel = '之后',
}: {
  before: number;
  after: number;
  label: string;
  color?: string;
  startFrame?: number;
  beforeLabel?: string;
  afterLabel?: string;
}) => {
  const frame = useCurrentFrame();
  const maxVal = Math.max(before, after);
  const beforeW = interpolate(frame, [startFrame + 6,  startFrame + 46], [0, (before / maxVal) * 100], easeOut);
  const afterW  = interpolate(frame, [startFrame + 16, startFrame + 56], [0, (after  / maxVal) * 100], easeOut);
  const opacity = interpolate(frame, [startFrame, startFrame + 14], [0, 1], clamp);

  const Row = ({label: l, w, c, val}: {label: string; w: number; c: string; val: number}) => (
    <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
      <div style={{width: 72, fontSize: 24, color: c, textAlign: 'right', fontFamily: 'Menlo,monospace', fontWeight: 700}}>
        {l}
      </div>
      <div style={{flex: 1, height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden'}}>
        <div style={{width: `${w}%`, height: '100%', borderRadius: 6, background: c}} />
      </div>
      <div style={{width: 48, fontSize: 24, fontWeight: 700, color: c, fontFamily: 'Menlo,monospace'}}>
        {val}
      </div>
    </div>
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14, width: '100%', opacity}}>
      <div style={{fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em'}}>
        {label}
      </div>
      <Row label={beforeLabel} w={beforeW} c="rgba(255,255,255,0.28)" val={before} />
      <Row label={afterLabel}  w={afterW}  c={color}                  val={after} />
    </div>
  );
};

/**
 * 特效原语 — 封装官方包的常用模式
 *
 * CinematicBlur  — @remotion/motion-blur: CameraMotionBlur 包装器，给快速运动元素加运动模糊
 * TrailEffect    — @remotion/motion-blur: Trail 残影效果
 * NoiseField     — @remotion/noise: Perlin 噪声驱动的有机背景动画
 * ShapeDecor     — @remotion/shapes: 装饰性 SVG 形状（Star/Circle/Triangle/Rect）
 */
import {CameraMotionBlur, Trail} from '@remotion/motion-blur';
import {noise2D} from '@remotion/noise';
import {Circle, Polygon, Rect, Star, Triangle} from '@remotion/shapes';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ReactNode, CSSProperties} from 'react';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

// ── CinematicBlur ─────────────────────────────────────────────────────────────
/**
 * 给子元素添加相机运动模糊，适合快速移入/移出的大标题、数字
 * blurAmount: 每帧的模糊强度（推荐 0.5~2）
 */
export const CinematicBlur = ({
  children,
  blurAmount = 0.75,
  style,
}: {
  children: ReactNode;
  blurAmount?: number;
  style?: CSSProperties;
}) => (
  <div style={style}>
    <CameraMotionBlur shutterAngle={180} samples={10}>
      {children}
    </CameraMotionBlur>
  </div>
);

// ── TrailEffect ───────────────────────────────────────────────────────────────
/**
 * 残影效果，子元素会留下淡出的轨迹
 * n: 残影层数（推荐 3~8）
 * lagInFrames: 每层延迟帧数
 */
export const TrailEffect = ({
  children,
  n = 5,
  lagInFrames = 3,
  style,
}: {
  children: ReactNode;
  n?: number;
  lagInFrames?: number;
  style?: CSSProperties;
}) => (
  <div style={style}>
    <Trail layers={n} lagInFrames={lagInFrames} trailOpacity={0.45}>
      {children}
    </Trail>
  </div>
);

// ── NoiseField ────────────────────────────────────────────────────────────────
/**
 * Perlin 噪声驱动的点阵背景，每个点独立波动，产生有机的"呼吸感"
 * cols × rows 个点，颜色和大小随噪声变化
 */
export const NoiseField = ({
  cols = 12,
  rows = 20,
  color = '#F59E0B',
  maxOpacity = 0.25,
  speed = 0.004,
  style,
}: {
  cols?: number;
  rows?: number;
  color?: string;
  maxOpacity?: number;
  speed?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const cellW = width  / cols;
  const cellH = height / rows;

  return (
    <svg
      width={width} height={height}
      style={{position: 'absolute', top: 0, left: 0, pointerEvents: 'none', ...style}}
    >
      {Array.from({length: rows}).map((_, row) =>
        Array.from({length: cols}).map((_, col) => {
          const n = noise2D(`dot-${col}-${row}`, col * 0.3, row * 0.3 + frame * speed);
          const t = (n + 1) / 2; // 0~1
          const opacity = t * maxOpacity;
          const r = 1.5 + t * 2.5;
          return (
            <circle
              key={`${col}-${row}`}
              cx={col * cellW + cellW / 2}
              cy={row * cellH + cellH / 2}
              r={r}
              fill={color}
              opacity={opacity}
            />
          );
        })
      )}
    </svg>
  );
};

// ── ShapeDecor ────────────────────────────────────────────────────────────────
/** @remotion/shapes 的装饰性形状，支持旋转动画 */
export type ShapeType = 'star' | 'triangle' | 'circle' | 'rect' | 'polygon';

export const ShapeDecor = ({
  type = 'star',
  size = 80,
  color = '#F59E0B',
  opacity = 0.15,
  rotate = true,
  rotateSpeed = 0.3,
  x = 0,
  y = 0,
  sides = 6,
  style,
}: {
  type?: ShapeType;
  size?: number;
  color?: string;
  opacity?: number;
  rotate?: boolean;
  rotateSpeed?: number;
  x?: number;
  y?: number;
  sides?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const angle = rotate ? (frame / fps) * rotateSpeed * 360 : 0;
  const fillOpacity = interpolate(frame, [0, 20], [0, opacity], clamp);

  const sharedProps = {fill: color, style: {opacity: fillOpacity} as CSSProperties};

  const shape =
    type === 'star'     ? <Star points={5} innerRadius={size * 0.4} outerRadius={size} {...sharedProps} /> :
    type === 'triangle' ? <Triangle length={size} direction="up" {...sharedProps} /> :
    type === 'circle'   ? <Circle radius={size / 2} {...sharedProps} /> :
    type === 'rect'     ? <Rect width={size} height={size} {...sharedProps} /> :
    /* polygon */         <Polygon points={sides} radius={size / 2} {...sharedProps} />;

  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: `rotate(${angle}deg)`,
      transformOrigin: 'center center',
      ...style,
    }}>
      {shape}
    </div>
  );
};

// ── 场景过渡 preset helpers (re-export for convenience) ──────────────────────
export {linearTiming, springTiming} from '@remotion/transitions';
export {clockWipe} from '@remotion/transitions/clock-wipe';
export {fade} from '@remotion/transitions/fade';
export {flip} from '@remotion/transitions/flip';
export {slide} from '@remotion/transitions/slide';
export {wipe} from '@remotion/transitions/wipe';

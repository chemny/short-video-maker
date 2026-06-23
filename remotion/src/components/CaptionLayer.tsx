import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Caption, VideoPlan} from '../lib/types';
import {secondsToFrames} from '../lib/timing';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const activeCaption = (captions: Caption[], frame: number, fps: number) =>
  captions.find(
    (c) =>
      frame >= secondsToFrames(c.start, fps) &&
      frame <= secondsToFrames(c.end, fps),
  );

const HighlightedText = ({caption, accent}: {caption: Caption; accent: string}) => {
  const keyword = caption.keywords?.find((k) => k && caption.text.includes(k));
  if (!keyword) return <>{caption.text}</>;
  const [before, after] = caption.text.split(keyword);
  return (
    <>
      {before}
      <span style={{color: accent, fontWeight: 900}}>{keyword}</span>
      {after}
    </>
  );
};

export const CaptionLayer = ({
  captions,
  style,
}: {
  captions: Caption[];
  style: VideoPlan['style'];
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const caption = activeCaption(captions, frame, fps);

  if (!caption) return null;

  const startFrame = secondsToFrames(caption.start, fps);
  const opacity = interpolate(frame, [startFrame, startFrame + 6], [0, 1], clamp);
  const y = interpolate(frame, [startFrame, startFrame + 8], [12, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        justifyContent: style.captionPosition === 'middle' ? 'center' : 'flex-end',
        padding: '0 56px 110px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          alignSelf: 'center',
          color: '#FFFFFF',
          fontFamily:
            '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", Inter, system-ui, sans-serif',
          fontSize: 40,
          fontWeight: 800,
          letterSpacing: 0.5,
          lineHeight: 1.3,
          // 安全区：屏宽 1080 - 左右各 56 padding = 968，再留一点余量
          maxWidth: 940,
          opacity,
          textAlign: 'center',
          textShadow: '0 2px 12px rgba(0,0,0,0.85)',
          // 浅色画面（奶油底卡片）上加深色毛玻璃底衬，保证字幕可读
          ...(style.captionBackdrop
            ? {
                background: 'rgba(15,18,20,0.66)',
                borderRadius: 18,
                padding: '14px 30px',
                backdropFilter: 'blur(6px)',
              }
            : {}),
          transform: `translateY(${y}px)`,
          // 允许自动换行，最多 2 行，超出省略，杜绝溢出屏幕
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        <HighlightedText caption={caption} accent={style.accent} />
      </div>
    </AbsoluteFill>
  );
};

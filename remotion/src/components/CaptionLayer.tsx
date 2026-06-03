import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Caption, VideoPlan} from '../lib/types';
import {secondsToFrames} from '../lib/timing';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const activeCaption = (captions: Caption[], frame: number, fps: number) =>
  captions.find(
    (caption) =>
      frame >= secondsToFrames(caption.start, fps) &&
      frame <= secondsToFrames(caption.end, fps),
  );

const renderHighlightedText = (caption: Caption, accent: string) => {
  const keyword = caption.keywords?.find((item) => item && caption.text.includes(item));

  if (!keyword) {
    return caption.text;
  }

  const [before, after] = caption.text.split(keyword);

  return (
    <>
      {before}
      <span style={{color: accent}}>{keyword}</span>
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

  if (!caption) {
    return null;
  }

  const startFrame = secondsToFrames(caption.start, fps);
  const opacity = interpolate(frame, [startFrame, startFrame + 7], [0, 1], clamp);
  const y = interpolate(frame, [startFrame, startFrame + 10], [18, 0], clamp);
  const fontSize = caption.text.length > 28 ? 44 : caption.text.length > 18 ? 50 : 58;

  return (
    <AbsoluteFill
      style={{
        justifyContent: style.captionPosition === 'middle' ? 'center' : 'flex-end',
        padding: '0 70px 118px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          alignSelf: 'center',
          background: 'rgba(10, 12, 16, 0.84)',
          borderRadius: 8,
          boxShadow: '0 18px 70px rgba(0,0,0,0.42)',
          color: '#FFFFFF',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
          fontSize,
          fontWeight: 880,
          lineHeight: 1.22,
          maxWidth: 940,
          opacity,
          outline: '1px solid rgba(255,255,255,0.14)',
          padding: '24px 34px 26px',
          textAlign: 'center',
          textWrap: 'balance',
          transform: `translateY(${y}px)`,
        }}
      >
        {renderHighlightedText(caption, style.accent)}
      </div>
    </AbsoluteFill>
  );
};

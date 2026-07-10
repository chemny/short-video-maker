import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {resolveSafeArea} from '../lib/safeArea';
import {Caption, VideoPlan} from '../lib/types';
import {secondsToFrames} from '../lib/timing';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const activeCaption = (captions: Caption[], frame: number, fps: number) =>
  captions.find(
    (c) =>
      frame >= secondsToFrames(c.start, fps) &&
      frame <= secondsToFrames(c.end, fps),
  );

const cleanCaptionText = (value: string) =>
  value
    .replace(/[，,。.!！?？、；;：:“”"‘’'（）()《》【】[\]{}…·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const HighlightedText = ({caption, accent}: {caption: Caption; accent: string}) => {
  const text = cleanCaptionText(caption.text);
  const keyword = caption.keywords
    ?.map(cleanCaptionText)
    .find((k) => k && text.includes(k));
  if (!keyword) return <>{text}</>;
  const [before, after] = text.split(keyword);
  return (
    <>
      {before}
      <span style={{color: accent, fontWeight: 900}}>{keyword}</span>
      {after}
    </>
  );
};

const CaptionLines = ({
  caption,
  accent,
  baseFontSize,
}: {
  caption: Caption;
  accent: string;
  baseFontSize: number;
}) => {
  if (!caption.lines?.length) {
    return <HighlightedText caption={caption} accent={accent} />;
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
      {caption.lines.map((line, index) => (
        <div
          key={`${caption.id}-${index}`}
          style={{
            fontSize: Math.round(baseFontSize * (line.scale ?? 1)),
            fontWeight: line.weight ?? (index === 0 ? 900 : 700),
            lineHeight: 1.18,
            whiteSpace: 'nowrap',
          }}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
};

const luminance = (hex: string) => {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return 1;
  const rgb = [match[1], match[2], match[3]].map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};

const resolveCaptionColor = (style: VideoPlan['style'], plainCaption: boolean) => {
  if (!plainCaption) return '#FFFFFF';
  const theme = style.captionTheme ?? 'auto';
  if (theme === 'light-on-dark') return '#FFFFFF';
  if (theme === 'dark-on-light') return style.textPrimary;
  return luminance(style.background) < 0.42 ? '#FFFFFF' : style.textPrimary;
};

export const CaptionLayer = ({
  captions,
  style,
  platforms = [],
}: {
  captions: Caption[];
  style: VideoPlan['style'];
  platforms?: VideoPlan['meta']['platforms'];
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const caption = activeCaption(captions, frame, fps);

  if (!caption) return null;

  const startFrame = secondsToFrames(caption.start, fps);
  const opacity = interpolate(frame, [startFrame, startFrame + 6], [0, 1], clamp);
  const y = interpolate(frame, [startFrame, startFrame + 8], [12, 0], clamp);
  const plainCaption = !style.captionBackdrop;
  const captionColor = resolveCaptionColor(style, plainCaption);
  const safeArea = resolveSafeArea(width, height, platforms);
  const text = cleanCaptionText(caption.text);
  const textLength = text.length;
  const captionScale = Number.isFinite(style.captionScale) ? Math.max(0.5, Math.min(style.captionScale ?? 1, 2)) : 1;
  const baseFontSize = plainCaption
    ? textLength > 30
      ? 32
      : textLength > 24
        ? 35
        : 40
    : 40;
  const fontSize = Math.round(baseFontSize * captionScale);

  return (
    <AbsoluteFill
      style={{
        justifyContent: style.captionPosition === 'middle' ? 'center' : 'flex-end',
        padding: `0 ${safeArea.captionRight}px ${safeArea.captionBottom}px ${safeArea.captionLeft}px`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          alignSelf: 'center',
          color: captionColor,
          fontFamily:
            '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", Inter, system-ui, sans-serif',
          fontSize,
          fontWeight: 800,
          letterSpacing: 0.5,
          lineHeight: 1.3,
          maxWidth: Math.max(520, width - safeArea.captionLeft - safeArea.captionRight - 48),
          opacity,
          textAlign: 'center',
          textShadow:
            plainCaption && captionColor === '#FFFFFF'
              ? '0 2px 12px rgba(0,0,0,0.55)'
              : plainCaption
                ? '0 2px 10px rgba(255,255,255,0.92)'
                : '0 2px 12px rgba(0,0,0,0.85)',
          // 浅色画面（奶油底卡片）上加深色毛玻璃底衬，保证字幕可读
          ...(style.captionBackdrop
            ? {
                background: 'rgba(15,18,20,0.66)',
                borderRadius: 18,
                padding: `${Math.round(14 * captionScale)}px ${Math.round(30 * captionScale)}px`,
                backdropFilter: 'blur(6px)',
              }
            : {}),
          transform: `translateY(${y}px)`,
          display: plainCaption ? 'block' : '-webkit-box',
          WebkitBoxOrient: plainCaption ? undefined : 'vertical',
          WebkitLineClamp: plainCaption ? undefined : 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: plainCaption ? 'nowrap' : undefined,
          wordBreak: plainCaption ? 'keep-all' : 'break-word',
        }}
      >
        <CaptionLines caption={{...caption, text}} accent={style.accent} baseFontSize={fontSize} />
      </div>
    </AbsoluteFill>
  );
};

import {AbsoluteFill, Img, staticFile} from 'remotion';
import {VideoPlan} from './lib/types';
import {resolvePreset} from './lib/stylePresets';

const pickFooter = (plan: VideoPlan) => {
  const platforms = plan.meta.platforms?.length > 0 ? plan.meta.platforms.join(' / ') : 'short video';
  return `${plan.meta.topic} / ${platforms}`;
};

export const CoverStill = ({plan}: {plan: VideoPlan}) => {
  const titleLength = plan.cover.title.length;
  const bgAsset = plan.cover.backgroundAsset;
  const preset = resolvePreset(plan);

  // 有 AI 背景图：深色压暗 + 底部蒙层，保证浅色标题可读
  const hasImage = Boolean(bgAsset);
  const secondary = hasImage ? 'rgba(255,255,255,0.72)' : preset.textSecondary;
  const titleColor = hasImage ? '#FFFFFF' : preset.textPrimary;

  return (
    <AbsoluteFill
      style={{
        background: preset.background,
        color: titleColor,
        fontFamily:
          'Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", ui-sans-serif, system-ui, sans-serif',
        overflow: 'hidden',
        padding: 76,
      }}
    >
      {hasImage ? (
        <>
          <Img
            src={staticFile(bgAsset as string)}
            style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}}
          />
          {/* 整体压暗 + 底部加重，托住底部大标题 */}
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.10) 38%, rgba(0,0,0,0.62) 74%, rgba(0,0,0,0.86) 100%)',
            }}
          />
        </>
      ) : (
        <>
          <AbsoluteFill
            style={{
              background:
                `linear-gradient(180deg, rgba(255,255,255,0.44), rgba(255,255,255,0)), radial-gradient(circle at 82% 12%, ${preset.accent}24, transparent 30%), radial-gradient(circle at 12% 82%, ${preset.accentAlt}20, transparent 32%)`,
            }}
          />
          <AbsoluteFill
            style={{
              opacity: 0.68,
              backgroundImage:
                `linear-gradient(${preset.line}66 1px, transparent 1px), linear-gradient(90deg, ${preset.line}50 1px, transparent 1px)`,
              backgroundSize: '58px 58px',
            }}
          />
        </>
      )}

      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 82,
          borderRadius: 6,
          color: preset.accent,
          fontSize: 36,
          fontWeight: 850,
          outline: `2px solid ${preset.accent}`,
          padding: '12px 20px',
          zIndex: 1,
        }}
      >
        {plan.cover.label ?? plan.meta.topic}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 84,
          top: 86,
          color: 'rgba(17,24,39,0.16)',
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: 0,
          zIndex: 1,
        }}
      >
        {String(Math.round(plan.meta.durationSeconds))}s
      </div>

      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          bottom: 250,
          zIndex: 1,
        }}
      >
        {plan.cover.subtitle ? (
          <div
            style={{
          color: preset.accent,
              fontSize: 42,
              fontWeight: 820,
              marginBottom: 30,
              maxWidth: 820,
            }}
          >
            {plan.cover.subtitle}
          </div>
        ) : null}
        <div
          style={{
            fontSize: titleLength > 12 ? 86 : titleLength > 8 ? 104 : 122,
            fontWeight: 960,
            lineHeight: 1.05,
            letterSpacing: 0,
            maxWidth: 850,
          }}
        >
          {plan.cover.title}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          bottom: 86,
          color: secondary,
          fontSize: 30,
          fontWeight: 720,
          zIndex: 1,
        }}
      >
        {pickFooter(plan)}
      </div>
    </AbsoluteFill>
  );
};

import {AbsoluteFill} from 'remotion';
import {VideoPlan} from './lib/types';

const pickFooter = (plan: VideoPlan) => {
  const platforms = plan.meta.platforms?.length > 0 ? plan.meta.platforms.join(' / ') : 'short video';
  return `${plan.meta.topic} / ${platforms}`;
};

export const CoverStill = ({plan}: {plan: VideoPlan}) => {
  const secondary = plan.style.textSecondary ?? '#4B5563';
  const titleLength = plan.cover.title.length;

  return (
    <AbsoluteFill
      style={{
        background: plan.style.background,
        color: plan.style.textPrimary,
        fontFamily:
          'Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", ui-sans-serif, system-ui, sans-serif',
        overflow: 'hidden',
        padding: 76,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0)), radial-gradient(circle at 84% 14%, rgba(37,99,235,0.14), transparent 30%), radial-gradient(circle at 10% 82%, rgba(16,185,129,0.12), transparent 32%)',
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.68,
          backgroundImage:
            'linear-gradient(rgba(17,24,39,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(17,24,39,0.045) 1px, transparent 1px)',
          backgroundSize: '58px 58px',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 82,
          borderRadius: 6,
          color: plan.style.accent,
          fontSize: 36,
          fontWeight: 850,
          outline: `2px solid ${plan.style.accent}`,
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
              color: plan.style.accent,
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

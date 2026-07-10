import {AbsoluteFill, Img, staticFile, useVideoConfig} from 'remotion';
import {VideoPlan} from './lib/types';
import {resolvePreset} from './lib/stylePresets';
import {WireGlobe} from './components/WireGlobe';

const pickFooter = (plan: VideoPlan) => {
  const platforms = plan.meta.platforms?.length > 0 ? plan.meta.platforms.join(' / ') : 'short video';
  return `${plan.meta.topic} / ${platforms}`;
};

export const CoverStill = ({plan}: {plan: VideoPlan}) => {
  const {width, height} = useVideoConfig();
  const titleLength = plan.cover.title.length;
  const bgAsset = plan.cover.backgroundAsset;
  const preset = resolvePreset(plan);
  const isLiquidDark = plan.style.editorialVariant === 'html-liquid-dark';
  const padX = width >= 1600 ? 112 : 84;
  const isLandscape = width > height;
  const titleSize = isLandscape
    ? titleLength > 12 ? 74 : titleLength > 8 ? 92 : 110
    : titleLength > 12 ? 86 : titleLength > 8 ? 104 : 122;

  // 有 AI 背景图：深色压暗 + 底部蒙层，保证浅色标题可读
  const hasImage = Boolean(bgAsset);
  const secondary = hasImage ? 'rgba(255,255,255,0.72)' : preset.textSecondary;
  const titleColor = hasImage ? '#FFFFFF' : preset.textPrimary;

  if (isLiquidDark && !hasImage) {
    return (
      <AbsoluteFill
        style={{
          background: '#090A12',
          color: '#F5F7FF',
          fontFamily: '"Inter Tight", "Noto Sans SC", "PingFang SC", system-ui, sans-serif',
          overflow: 'hidden',
        }}
      >
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse 720px 520px at 18% 12%, rgba(117,103,255,0.30) 0%, transparent 62%), radial-gradient(ellipse 620px 500px at 82% 18%, rgba(53,242,197,0.20) 0%, transparent 64%), radial-gradient(ellipse 760px 560px at 54% 74%, rgba(238,94,150,0.16) 0%, transparent 66%)',
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(180deg, rgba(9,10,18,0.06) 0%, rgba(9,10,18,0.42) 52%, rgba(9,10,18,0.86) 100%)',
          }}
        />
        <AbsoluteFill
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            opacity: 0.42,
          }}
        />
        <WireGlobe
          frame={0}
          cx={width * 0.93}
          cy={height * 1.03}
          radius={Math.max(width, height) * 0.58}
          color="#35F2C5"
          maxOpacity={0.18}
          speed={0.12}
          polarCapDeg={18}
        />
        <div
          style={{
            position: 'absolute',
            right: width * -0.05,
            top: height * 0.08,
            width: isLandscape ? 190 : 230,
            height: isLandscape ? 190 : 230,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
            opacity: 0.14,
          }}
        >
          {Array.from({length: 49}).map((_, index) => (
            <div
              key={index}
              style={{
                background: [2, 3, 4, 9, 16, 23, 24, 25, 31, 37, 43, 44, 45].includes(index)
                  ? '#7567FF'
                  : 'transparent',
              }}
            />
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            left: padX,
            right: padX,
            top: isLandscape ? 64 : 84,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#C9D2E8',
            fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
            fontSize: isLandscape ? 20 : 24,
            fontWeight: 760,
            letterSpacing: '0.08em',
          }}
        >
          <span>{plan.meta.topic.toUpperCase()}</span>
          <span>{String(Math.round(plan.meta.durationSeconds))}s</span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: padX,
            bottom: isLandscape ? height * 0.18 : height * 0.21,
            maxWidth: isLandscape ? width * 0.68 : width - padX * 2,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              minHeight: isLandscape ? 38 : 46,
              marginBottom: isLandscape ? 28 : 38,
              padding: '0 18px 0 14px',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: 999,
              color: '#F5F7FF',
              background: 'linear-gradient(90deg, rgba(117,103,255,0.28), rgba(53,242,197,0.10))',
              boxShadow: '0 0 30px rgba(117,103,255,0.17)',
              fontSize: isLandscape ? 20 : 24,
              fontWeight: 760,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: '#35F2C5',
                boxShadow: '0 0 18px #35F2C5',
              }}
            />
            <span>{plan.cover.label ?? plan.meta.topic}</span>
          </div>

          {plan.cover.subtitle ? (
            <div
              style={{
                color: '#35F2C5',
                fontSize: isLandscape ? 34 : 40,
                fontWeight: 760,
                lineHeight: 1.18,
                marginBottom: isLandscape ? 18 : 28,
              }}
            >
              {plan.cover.subtitle}
            </div>
          ) : null}

          <div
            style={{
              color: '#F5F7FF',
              fontSize: titleSize,
              fontWeight: 780,
              letterSpacing: 0,
              lineHeight: 1.03,
              textShadow: '0 18px 70px rgba(0,0,0,0.45)',
            }}
          >
            {plan.cover.title}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

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
            fontSize: titleSize,
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

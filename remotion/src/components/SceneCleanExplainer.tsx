import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Scene, VideoPlan} from '../lib/types';
import {resolvePreset, sceneLabel, shortText, tagText} from '../lib/stylePresets';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)} as const;

export const SceneCleanExplainer = ({
  plan,
  scene,
  sceneIndex,
  totalScenes,
}: {
  plan: VideoPlan;
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const preset = resolvePreset(plan);
  const progress = frame / Math.max(1, durationInFrames);
  const titleIn = spring({frame: frame - 5, fps, config: {damping: 170}, durationInFrames: 30});
  const bodyIn = spring({frame: frame - 16, fps, config: {damping: 190}, durationInFrames: 30});
  const ruleW = interpolate(frame, [10, 34], [0, 520], ease);
  const drift = interpolate(progress, [0, 1], [0, -22], clamp);
  const label = sceneLabel[scene.type] ?? scene.type;
  const tags = (scene.tags ?? []).map(tagText).slice(0, 3);
  const titleSize = scene.caption.length > 16 ? 76 : scene.caption.length > 10 ? 88 : 102;
  const bodyText = scene.body || shortText(scene.voiceover, 64);

  return (
    <AbsoluteFill
      style={{
        background: preset.background,
        color: preset.textPrimary,
        fontFamily: '"PingFang SC", "Noto Sans CJK SC", Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            `linear-gradient(${preset.line}44 1px, transparent 1px), linear-gradient(90deg, ${preset.line}38 1px, transparent 1px)`,
          backgroundSize: '72px 72px',
          opacity: 0.42,
          transform: `translateY(${drift}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 74,
          color: preset.textSecondary,
          fontFamily: 'Menlo, ui-monospace, monospace',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        {String(sceneIndex + 1).padStart(2, '0')} / {String(totalScenes).padStart(2, '0')}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 76,
          top: 68,
          border: `2px solid ${preset.accent}`,
          borderRadius: 6,
          color: preset.accent,
          fontSize: 28,
          fontWeight: 850,
          padding: '10px 18px',
        }}
      >
        {label}
      </div>

      <div style={{position: 'absolute', left: 84, right: 78, top: 170}}>
        <div style={{color: preset.accent, fontSize: 32, fontWeight: 880, marginBottom: 22}}>
          {plan.meta.topic}
        </div>
        <div style={{height: 7, width: ruleW, background: preset.accent, borderRadius: 8, marginBottom: 44}} />
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 1.08,
            maxWidth: 870,
            transform: `translateY(${(1 - titleIn) * 30}px)`,
            opacity: titleIn,
          }}
        >
          {scene.caption}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 78,
          top: 566,
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 18,
          opacity: bodyIn,
          transform: `translateY(${(1 - bodyIn) * 26}px)`,
        }}
      >
        <div
          style={{
            background: preset.surface,
            border: `2px solid ${preset.line}`,
            borderRadius: 8,
            boxShadow: preset.shadow,
            color: preset.textPrimary,
            fontSize: 38,
            fontWeight: 780,
            lineHeight: 1.38,
            padding: '30px 34px',
          }}
        >
          {bodyText}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18}}>
          <div
            style={{
              background: preset.textPrimary,
              borderRadius: 8,
              color: preset.surface,
              minHeight: 116,
              padding: '22px 26px',
            }}
          >
            <div style={{fontSize: 22, fontWeight: 760, opacity: 0.76, marginBottom: 10}}>要避免</div>
            <div style={{fontSize: 32, fontWeight: 900, lineHeight: 1.16}}>{shortText(scene.voiceover, 20)}</div>
          </div>
          <div
            style={{
              background: `${preset.accent}18`,
              border: `2px solid ${preset.accent}`,
              borderRadius: 8,
              color: preset.textPrimary,
              minHeight: 116,
              padding: '22px 26px',
            }}
          >
            <div style={{fontSize: 22, fontWeight: 760, color: preset.accent, marginBottom: 10}}>先抓住</div>
            <div style={{fontSize: 32, fontWeight: 900, lineHeight: 1.16}}>{tags[0] ?? label}</div>
          </div>
        </div>
      </div>

      {tags.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 84,
            right: 78,
            bottom: 328,
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {tags.map((tag, index) => (
            <div
              key={`${tag}-${index}`}
              style={{
                background: index === 0 ? preset.accent : preset.surface,
                border: `1.5px solid ${index === 0 ? preset.accent : preset.line}`,
                borderRadius: 8,
                boxShadow: index === 0 ? preset.shadow : 'none',
                color: index === 0 ? preset.surface : preset.textPrimary,
                fontSize: 30,
                fontWeight: 850,
                padding: '16px 22px',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

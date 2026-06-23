import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Scene, VideoPlan} from '../lib/types';
import {resolvePreset, sceneLabel, shortText, tagText} from '../lib/stylePresets';

const ease = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)} as const;

export const SceneSketchNotes = ({
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
  const {fps} = useVideoConfig();
  const preset = resolvePreset(plan);
  const noteIn = spring({frame: frame - 6, fps, config: {damping: 150}, durationInFrames: 36});
  const markerW = interpolate(frame, [20, 48], [0, 460], ease);
  const label = sceneLabel[scene.type] ?? scene.type;
  const tags = (scene.tags ?? []).map(tagText).slice(0, 3);
  const titleSize = scene.caption.length > 15 ? 70 : 84;
  const bodyText = scene.body || shortText(scene.voiceover, 68);
  const noteItems = [
    tags[0] ?? label,
    tags[1] ?? shortText(bodyText, 8),
    scene.type === 'ending' ? '收束' : '动作',
  ];

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
            `linear-gradient(${preset.line}66 1px, transparent 1px), linear-gradient(90deg, ${preset.line}50 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 340,
          background: `linear-gradient(180deg, ${preset.surfaceAlt} 0%, transparent 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 96,
          color: preset.textSecondary,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 24,
          fontWeight: 800,
        }}
      >
        <span>{label}</span>
        <span>{sceneIndex + 1}/{totalScenes}</span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 176,
          minHeight: 512,
          background: preset.surface,
          border: `3px solid ${preset.textPrimary}`,
          borderRadius: 8,
          boxShadow: '14px 14px 0 rgba(0,0,0,0.10)',
          opacity: noteIn,
          padding: '52px 54px',
          transform: `rotate(-0.6deg) translateY(${(1 - noteIn) * 30}px)`,
        }}
      >
        <div style={{color: preset.accentAlt, fontSize: 30, fontWeight: 900, marginBottom: 28}}>
          {plan.meta.topic}
        </div>
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 980,
            lineHeight: 1.14,
            maxWidth: 800,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {scene.caption}
        </div>
        <div
          style={{
            height: 20,
            width: markerW,
            background: `${preset.accent}66`,
            marginTop: -20,
            marginLeft: -6,
          }}
        />
        <div style={{color: preset.textSecondary, fontSize: 34, fontWeight: 700, lineHeight: 1.42, marginTop: 38}}>
          {bodyText}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 86,
          right: 86,
          top: 788,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
        }}
      >
        <div
          style={{
            background: `${preset.accent}28`,
            border: `3px solid ${preset.textPrimary}`,
            borderRadius: 8,
            boxShadow: '10px 10px 0 rgba(0,0,0,0.08)',
            minHeight: 224,
            padding: '28px 28px',
            transform: 'rotate(1deg)',
          }}
        >
          <div style={{fontSize: 24, fontWeight: 900, color: preset.accentAlt, marginBottom: 18}}>NOTES</div>
          <div style={{fontSize: 34, fontWeight: 920, lineHeight: 1.22}}>{shortText(bodyText, 28)}</div>
        </div>
        <div
          style={{
            background: preset.surface,
            border: `3px solid ${preset.textPrimary}`,
            borderRadius: 8,
            minHeight: 224,
            padding: '26px 28px',
            transform: 'rotate(-1deg)',
          }}
        >
          {noteItems.map((item, index) => (
            <div
              key={`${item}-${index}`}
              style={{
                alignItems: 'center',
                display: 'flex',
                gap: 14,
                fontSize: 28,
                fontWeight: 900,
                minHeight: 50,
                lineHeight: 1.1,
              }}
            >
              <span style={{width: 20, height: 20, border: `3px solid ${preset.textPrimary}`, background: index === 0 ? preset.accent : 'transparent'}} />
              {item}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 86,
          right: 86,
          bottom: 344,
          background: preset.textPrimary,
          borderRadius: 8,
          color: preset.surface,
          fontSize: 34,
          fontWeight: 920,
          lineHeight: 1.22,
          padding: '26px 30px',
          transform: 'rotate(-0.5deg)',
        }}
      >
        {shortText(scene.voiceover, 34)}
      </div>
    </AbsoluteFill>
  );
};

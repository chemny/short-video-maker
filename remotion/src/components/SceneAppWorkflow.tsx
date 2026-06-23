import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Scene, VideoPlan} from '../lib/types';
import {resolvePreset, sceneLabel, shortText, tagText} from '../lib/stylePresets';

const ease = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)} as const;

const defaultSteps = ['找到入口', '接住动作', '稳定扩展'];

export const SceneAppWorkflow = ({
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
  const label = sceneLabel[scene.type] ?? scene.type;
  const steps = (scene.steps ?? (scene.tags ?? []).map(tagText)).filter(Boolean).slice(0, 3);
  const workflowSteps = steps.length >= 2 ? steps : defaultSteps;
  const panelIn = spring({frame, fps, config: {damping: 180}, durationInFrames: 34});
  const titleIn = interpolate(frame, [8, 34], [0, 1], ease);
  const railH = interpolate(frame, [24, 64], [0, 430], ease);
  const titleSize = scene.caption.length > 14 ? 68 : 82;
  const bodyText = scene.body || shortText(scene.voiceover, 58);

  return (
    <AbsoluteFill
      style={{
        background: preset.background,
        color: preset.textPrimary,
        fontFamily: '"PingFang SC", "Noto Sans CJK SC", Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            `linear-gradient(135deg, ${preset.surface} 0%, transparent 45%), radial-gradient(circle at 86% 16%, ${preset.accent}18 0, transparent 270px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 68,
          right: 68,
          top: 72,
          display: 'flex',
          justifyContent: 'space-between',
          color: preset.textSecondary,
          fontSize: 24,
          fontWeight: 760,
        }}
      >
        <span>{String(sceneIndex + 1).padStart(2, '0')} / {String(totalScenes).padStart(2, '0')}</span>
        <span>{label}</span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 68,
          right: 68,
          top: 146,
          height: 482,
          background: preset.surface,
          border: `2px solid ${preset.line}`,
          borderRadius: 8,
          boxShadow: preset.shadow,
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 24}px)`,
        }}
      >
        <div
          style={{
            height: 58,
            borderBottom: `2px solid ${preset.line}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 24px',
          }}
        >
          {[preset.accent, preset.accentAlt, preset.line].map((color) => (
            <div key={color} style={{width: 14, height: 14, borderRadius: 7, background: color}} />
          ))}
          <div style={{marginLeft: 12, color: preset.textSecondary, fontSize: 21, fontWeight: 740}}>
            workflow / {plan.meta.topic}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 34,
            top: 100,
            bottom: 46,
            width: 5,
            background: `${preset.line}AA`,
            borderRadius: 5,
          }}
        >
          <div style={{width: 5, height: railH, background: preset.accent, borderRadius: 5}} />
        </div>

        <div style={{position: 'absolute', left: 68, right: 38, top: 90, display: 'grid', gap: 18}}>
          {workflowSteps.map((step, index) => {
            const itemIn = interpolate(frame, [18 + index * 8, 42 + index * 8], [0, 1], ease);
            return (
              <div
                key={`${step}-${index}`}
                style={{
                  alignItems: 'center',
                  background: index === 0 ? `${preset.accent}16` : index === 1 ? preset.background : preset.surfaceAlt,
                  border: `2px solid ${index === 0 ? preset.accent : preset.line}`,
                  borderRadius: 8,
                  display: 'flex',
                  minHeight: 92,
                  opacity: itemIn,
                  padding: '0 22px',
                  transform: `translateX(${(1 - itemIn) * 28}px)`,
                }}
              >
                <div style={{color: preset.accent, fontFamily: 'Menlo, ui-monospace, monospace', fontSize: 24, fontWeight: 900, width: 56}}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div style={{fontSize: 34, fontWeight: 900, lineHeight: 1.15}}>{step}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{position: 'absolute', left: 68, right: 68, top: 700, opacity: titleIn}}>
        <div style={{color: preset.accent, fontSize: 30, fontWeight: 860, marginBottom: 22}}>
          {plan.cover.label ?? plan.meta.topic}
        </div>
        <div style={{fontSize: titleSize, fontWeight: 960, lineHeight: 1.08, maxWidth: 890}}>
          {scene.caption}
        </div>
        <div style={{color: preset.textSecondary, fontSize: 34, fontWeight: 680, lineHeight: 1.42, marginTop: 28, maxWidth: 860}}>
          {bodyText}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 68,
          right: 68,
          top: 1084,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
        }}
      >
        <div
          style={{
            background: preset.textPrimary,
            borderRadius: 8,
            color: preset.surface,
            minHeight: 128,
            padding: '24px 26px',
          }}
        >
          <div style={{fontSize: 22, fontWeight: 760, opacity: 0.78, marginBottom: 12}}>关键判断</div>
          <div style={{fontSize: 34, fontWeight: 900, lineHeight: 1.18}}>{shortText(bodyText, 24)}</div>
        </div>
        <div
          style={{
            background: preset.surface,
            border: `2px solid ${preset.line}`,
            borderRadius: 8,
            minHeight: 128,
            padding: '24px 26px',
          }}
        >
          <div style={{fontSize: 22, fontWeight: 760, color: preset.textSecondary, marginBottom: 12}}>下一步</div>
          <div style={{fontSize: 34, fontWeight: 900, lineHeight: 1.18}}>{workflowSteps[0]}</div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 68,
          right: 68,
          top: 1260,
          background: `${preset.accent}14`,
          border: `2px solid ${preset.accent}`,
          borderRadius: 8,
          display: 'grid',
          gridTemplateColumns: '160px 1fr',
          minHeight: 112,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            background: preset.accent,
            color: preset.surface,
            display: 'flex',
            fontSize: 28,
            fontWeight: 900,
            justifyContent: 'center',
          }}
        >
          FLOW
        </div>
        <div
          style={{
            alignItems: 'center',
            color: preset.textPrimary,
            display: 'flex',
            fontSize: 34,
            fontWeight: 900,
            lineHeight: 1.18,
            padding: '0 30px',
          }}
        >
          {workflowSteps.join('  /  ')}
        </div>
      </div>
    </AbsoluteFill>
  );
};

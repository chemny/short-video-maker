import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Scene, VideoPlan} from '../lib/types';
import {resolveSafeArea} from '../lib/safeArea';
import {sceneLabel, shortText, tagText} from '../lib/stylePresets';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)} as const;

type FrameKind = 'statement' | 'split' | 'process' | 'quote' | 'stat' | 'closing';

const cjkCount = (value: string) => Array.from(value).filter((char) => /[\u3400-\u9fff]/.test(char)).length;

const splitTitle = (value: string, preferredMax = 11) => {
  const source = value.trim();
  if (source.length <= preferredMax && cjkCount(source) <= Math.max(8, preferredMax - 2)) return [source];
  const breakpoints = ['，', '、', '：', ':', ' '];
  for (const mark of breakpoints) {
    const index = source.indexOf(mark);
    if (index > 3 && index < source.length - 3) {
      return [source.slice(0, index + (mark.trim() ? 1 : 0)).trim(), source.slice(index + 1).trim()];
    }
  }
  let mid = Math.ceil(source.length / 2);
  if (source.length - mid === 1) mid -= 1;
  if (mid === 1) mid += 1;
  return [source.slice(0, mid), source.slice(mid)];
};

const routeTokens = {
  'html-cobalt-grid': {
    source: 'Cobalt Grid',
    mode: 'cobalt',
    bg: '#F0EBDE',
    bg2: '#E6E0CE',
    ink: '#1F2BE0',
    muted: '#5560E5',
    accent: '#1F2BE0',
    accent2: '#F0EBDE',
    panel: '#F0EBDE',
    panel2: '#E6E0CE',
    line: '#1F2BE0',
    grid: 'rgba(31,43,224,0.10)',
    soft: 'rgba(31,43,224,0.18)',
    displayFont: '"Newsreader", "Noto Serif SC", Georgia, serif',
    bodyFont: '"Hanken Grotesk", "Noto Sans SC", system-ui, sans-serif',
    monoFont: '"DM Mono", "JetBrains Mono", ui-monospace, monospace',
    radius: 0,
  },
  'html-editorial-forest': {
    source: 'Editorial Forest',
    mode: 'forest',
    bg: '#EFE7D4',
    bg2: '#E6DCC4',
    ink: '#1A1A17',
    muted: '#2E4A2A',
    accent: '#2E4A2A',
    accent2: '#E89CB1',
    panel: '#2E4A2A',
    panel2: '#E89CB1',
    line: '#2E4A2A',
    grid: 'rgba(46,74,42,0.075)',
    soft: 'rgba(232,156,177,0.32)',
    displayFont: '"Source Serif 4", "Noto Serif SC", Georgia, serif',
    bodyFont: '"Source Serif 4", "Noto Serif SC", Georgia, serif',
    monoFont: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    radius: 8,
  },
  'html-signal': {
    source: 'Signal',
    mode: 'signal',
    bg: '#1C2644',
    bg2: '#232F55',
    ink: '#E2DCD0',
    muted: '#8A96A8',
    accent: '#C8A870',
    accent2: '#F0ECE3',
    panel: '#F0ECE3',
    panel2: '#E6E0D4',
    line: '#2E3D5C',
    grid: 'rgba(226,220,208,0.05)',
    soft: 'rgba(200,168,112,0.18)',
    displayFont: '"Source Serif 4", "Noto Serif SC", Georgia, serif',
    bodyFont: '"DM Sans", "Noto Sans SC", system-ui, sans-serif',
    monoFont: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
    radius: 0,
  },
  'html-liquid-dark': {
    source: 'Liquid Dark',
    mode: 'liquid-dark',
    bg: '#090A12',
    bg2: '#11182E',
    ink: '#F5F7FF',
    muted: '#C9D2E8',
    accent: '#7567FF',
    accent2: '#35F2C5',
    panel: 'rgba(255,255,255,0.085)',
    panel2: 'rgba(53,242,197,0.13)',
    line: 'rgba(255,255,255,0.22)',
    grid: 'rgba(255,255,255,0.045)',
    soft: 'rgba(117,103,255,0.20)',
    displayFont: '"Inter Tight", "Noto Sans SC", system-ui, sans-serif',
    bodyFont: '"Inter", "Noto Sans SC", system-ui, sans-serif',
    monoFont: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
    radius: 12,
  },
  'html-soft-editorial': {
    source: 'Soft Editorial',
    mode: 'soft',
    bg: '#F2EEDF',
    bg2: '#ECE6D2',
    ink: '#2A241B',
    muted: '#5C5345',
    accent: '#E1A4C2',
    accent2: '#D6DD63',
    panel: 'rgba(255,255,255,0.58)',
    panel2: '#B7C7A8',
    line: 'rgba(42,36,27,0.20)',
    grid: 'rgba(42,36,27,0.045)',
    soft: 'rgba(225,164,194,0.34)',
    displayFont: '"Cormorant Garamond", "Noto Serif SC", Garamond, serif',
    bodyFont: '"Work Sans", "Noto Sans SC", system-ui, sans-serif',
    monoFont: '"Work Sans", "Noto Sans SC", system-ui, sans-serif',
    radius: 30,
  },
  'swiss-blue': null,
  'editorial-ink': null,
  'magazine-cream': null,
  'xhs-morandi': null,
} as const;

const resolveTokens = (variant: VideoPlan['style']['editorialVariant']) =>
  routeTokens[variant ?? 'html-cobalt-grid'] ?? routeTokens['html-cobalt-grid'];

const resolveFrame = (scene: Scene, sceneIndex: number): FrameKind => {
  if (scene.type === 'hook') return 'statement';
  if (scene.type === 'ending' || scene.layout === 'ending-card') return 'closing';
  if (scene.layout === 'data-card') return 'stat';
  if (scene.layout === 'quote-card' || scene.type === 'thesis') return scene.type === 'definition' ? 'split' : 'quote';
  if (scene.layout === 'step-list' || scene.type === 'example' || scene.type === 'benefits') return 'process';
  return 'split';
};

const labelText = (scene: Scene) => sceneLabel[scene.type] ?? scene.type;

const chromeConfig = (style: VideoPlan['style']) => {
  const chrome = style.chrome ?? {};
  const header = chrome.header ?? 'editorial';
  const footer = chrome.footer ?? 'tags';
  return {
    header,
    footer,
    showTopic: chrome.showTopic ?? header !== 'none',
    showSceneNumber: chrome.showSceneNumber ?? header !== 'none',
    showSceneLabel: chrome.showSceneLabel ?? header !== 'none',
    showLedger: chrome.showLedger ?? footer === 'tags',
  };
};

const HtmlInspiredBackground = ({
  tokens,
  frameKind,
  drift,
}: {
  tokens: ReturnType<typeof resolveTokens>;
  frameKind: FrameKind;
  drift: number;
}) => {
  const isSignal = tokens.mode === 'signal';
  const isForest = tokens.mode === 'forest';
  const isSoft = tokens.mode === 'soft';
  const isCobalt = tokens.mode === 'cobalt';

  return (
    <>
      <AbsoluteFill
        style={{
          background: isSignal && (frameKind === 'split' || frameKind === 'stat') ? tokens.accent2 : tokens.bg,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${tokens.grid} 1px, transparent 1px), linear-gradient(90deg, ${tokens.grid} 1px, transparent 1px)`,
          backgroundSize: isCobalt ? '42px 42px' : '58px 58px',
          opacity: isSignal ? 0.5 : 1,
          transform: `translateY(${drift}px)`,
        }}
      />
      {isCobalt ? (
        <>
          <div
            style={{
              position: 'absolute',
              right: 58,
              top: 120,
              width: 250,
              height: 720,
              background:
                'repeating-linear-gradient(90deg, rgba(31,43,224,0.0) 0 11px, rgba(31,43,224,0.34) 11px 14px)',
              clipPath:
                'polygon(38% 0, 100% 0, 100% 12%, 74% 12%, 74% 26%, 88% 26%, 88% 44%, 62% 44%, 62% 61%, 78% 61%, 78% 82%, 46% 82%, 46% 100%, 0 100%, 0 68%, 24% 68%, 24% 39%, 8% 39%, 8% 16%, 38% 16%)',
              opacity: 0.42,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 188,
              top: 104,
              width: 84,
              height: 84,
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 4,
              background: tokens.bg,
              padding: 6,
            }}
          >
            {Array.from({length: 36}).map((_, index) => (
              <div
                key={index}
                style={{background: [0, 1, 2, 6, 12, 14, 17, 21, 25, 28, 30, 31, 35].includes(index) ? tokens.ink : tokens.bg}}
              />
            ))}
          </div>
        </>
      ) : null}
      {isForest ? (
        <>
          <div style={{position: 'absolute', right: 0, top: 0, width: 220, height: 220, background: tokens.accent2}} />
          <div style={{position: 'absolute', left: -80, bottom: 210, width: 360, height: 160, background: tokens.accent, opacity: 0.96}} />
          <div
            style={{
              position: 'absolute',
              right: 92,
              bottom: 112,
              width: 118,
              height: 118,
              borderRadius: '50%',
              border: `2px solid ${tokens.accent2}`,
            }}
          />
        </>
      ) : null}
      {isSignal ? (
        <>
          <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, background: tokens.accent}} />
          <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 280, background: tokens.bg2, opacity: frameKind === 'statement' || frameKind === 'closing' ? 1 : 0}} />
        </>
      ) : null}
      {isSoft ? (
        <>
          <div style={{position: 'absolute', right: 64, top: 74, display: 'flex', gap: 18}}>
            {[tokens.accent, tokens.accent2, '#E8C9B6', '#B7C7A8', '#C9BEDC'].map((color) => (
              <div key={color} style={{width: 44, height: 44, borderRadius: '50%', background: color}} />
            ))}
          </div>
          <div style={{position: 'absolute', left: -90, bottom: 180, width: 420, height: 420, borderRadius: 48, background: tokens.soft}} />
        </>
      ) : null}
    </>
  );
};

const Chrome = ({
  plan,
  scene,
  sceneIndex,
  totalScenes,
  tokens,
  color,
}: {
  plan: VideoPlan;
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  tokens: ReturnType<typeof resolveTokens>;
  color?: string;
}) => {
  const chromeColor = color ?? tokens.ink;
  const config = chromeConfig(plan.style);
  const showHeader =
    config.header !== 'none' &&
    (config.showTopic || config.showSceneNumber || config.showSceneLabel);
  const showTopRule = config.header === 'editorial';
  const showBottomRule = config.footer === 'tags' || config.footer === 'progress';

  return (
    <>
      {showHeader ? (
        <div
          style={{
            position: 'absolute',
            left: 72,
            right: 72,
            top: 54,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            color: chromeColor,
            fontFamily: tokens.monoFont,
            fontSize: config.header === 'minimal' ? 16 : 18,
            fontWeight: 600,
            letterSpacing: tokens.mode === 'soft' ? 1.2 : 3,
            textTransform: 'uppercase',
            opacity: config.header === 'minimal' ? 0.58 : 0.88,
          }}
        >
          <div>{config.showTopic ? plan.meta.topic : null}</div>
          <div>
            {config.showSceneNumber
              ? `${String(sceneIndex + 1).padStart(2, '0')} / ${String(totalScenes).padStart(2, '0')}`
              : null}
          </div>
          <div style={{textAlign: 'right'}}>{config.showSceneLabel ? labelText(scene) : null}</div>
        </div>
      ) : null}
      {showTopRule ? <div style={{position: 'absolute', left: 72, right: 72, top: 104, height: 2, background: chromeColor, opacity: 0.82}} /> : null}
      {showBottomRule ? <div style={{position: 'absolute', left: 72, right: 72, bottom: 120, height: 1.5, background: chromeColor, opacity: 0.32}} /> : null}
    </>
  );
};

const Kicker = ({
  children,
  tokens,
  tone = 'default',
}: {
  children: React.ReactNode;
  tokens: ReturnType<typeof resolveTokens>;
  tone?: 'default' | 'filled';
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      alignSelf: 'flex-start',
      background: tone === 'filled' ? tokens.accent : 'transparent',
      color: tone === 'filled' ? (tokens.mode === 'liquid-dark' ? tokens.ink : tokens.bg) : tokens.accent,
      border: tone === 'filled' ? 'none' : `1.5px solid ${tokens.accent}`,
      padding: '8px 14px',
      fontFamily: tokens.monoFont,
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: 1.4,
      lineHeight: 1,
    }}
  >
    {children}
  </div>
);

const globeLatitudes = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
const globeLongitudes = [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75];

const SpokenCardBg = ({
  tokens,
  frameKind,
  drift,
  frame,
}: {
  tokens: ReturnType<typeof resolveTokens>;
  frameKind: FrameKind;
  drift: number;
  frame: number;
}) => (
  <>
    <AbsoluteFill style={{background: tokens.bg}} />
    {tokens.mode === 'liquid-dark' ? (
      <>
        <AbsoluteFill
          style={{
            background:
              `radial-gradient(ellipse 720px 520px at 18% 12%, ${tokens.accent}4d 0%, transparent 62%), ` +
              `radial-gradient(ellipse 620px 500px at 82% 18%, ${tokens.accent2}36 0%, transparent 64%), ` +
              'radial-gradient(ellipse 760px 560px at 54% 74%, rgba(238,94,150,0.18) 0%, transparent 66%)',
            opacity: 0.92,
            transform: `translate3d(${drift * -0.5}px, ${drift}px, 0)`,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(180deg, rgba(9,10,18,0.10) 0%, rgba(9,10,18,0.50) 54%, rgba(9,10,18,0.86) 100%)',
          }}
        />
      </>
    ) : null}
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${tokens.grid} 1px, transparent 1px), linear-gradient(90deg, ${tokens.grid} 1px, transparent 1px)`,
        backgroundSize: tokens.mode === 'liquid-dark' ? '64px 64px' : '42px 42px',
        opacity: tokens.mode === 'liquid-dark' ? 0.42 : 0.72,
        transform: `translateY(${drift}px)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        right: frameKind === 'quote' ? 72 : 96,
        top: frameKind === 'statement' ? 108 : 82,
        width: frameKind === 'closing' ? 230 : 185,
        height: frameKind === 'closing' ? 230 : 185,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 6,
        opacity: tokens.mode === 'liquid-dark' ? 0.14 : frameKind === 'process' || frameKind === 'stat' ? 0.2 : 0.36,
      }}
    >
      {Array.from({length: 49}).map((_, index) => (
        <div
          key={index}
          style={{
            background: [2, 3, 4, 9, 16, 23, 24, 25, 31, 37, 43, 44, 45].includes(index)
              ? tokens.accent
              : 'transparent',
          }}
        />
      ))}
    </div>
    {tokens.mode === 'liquid-dark' ? (
      <svg
        viewBox="0 0 360 360"
        style={{
          position: 'absolute',
          right: -560,
          bottom: -692,
          width: 1530,
          height: 1530,
          opacity: 0.2,
          transform: `rotate(${frame * 0.012}deg)`,
          filter: `drop-shadow(0 0 18px ${tokens.accent2}1c)`,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id="wireGlobeStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tokens.accent2} />
            <stop offset="58%" stopColor={tokens.accent} />
            <stop offset="100%" stopColor="#ED5C98" />
          </linearGradient>
          <radialGradient id="wireGlobeFade" cx="50%" cy="50%" r="54%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="58%" stopColor="#fff" stopOpacity="0.86" />
            <stop offset="84%" stopColor="#fff" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="wireGlobeMask">
            <rect x="0" y="0" width="360" height="360" fill="url(#wireGlobeFade)" />
          </mask>
          <clipPath id="wireGlobeClip">
            <circle cx="180" cy="180" r="132" />
          </clipPath>
        </defs>
        <g mask="url(#wireGlobeMask)">
          <circle cx="180" cy="180" r="132" fill="none" stroke="url(#wireGlobeStroke)" strokeWidth="0.18" opacity="0.34" />
          <g clipPath="url(#wireGlobeClip)" transform="rotate(-18 180 180)">
            <g transform={`rotate(${frame * 0.055} 180 180)`}>
              {globeLongitudes.map((lng) => {
                const rx = Math.max(8, Math.cos((Math.abs(lng) * Math.PI) / 180) * 132);
                const opacity = lng === 0 ? 0.56 : 0.29 + (1 - Math.abs(lng) / 90) * 0.24;

                return (
                  <ellipse
                    key={`lng-${lng}`}
                    cx="180"
                    cy="180"
                    rx={rx}
                    ry="132"
                    fill="none"
                    stroke="url(#wireGlobeStroke)"
                    strokeWidth={lng === 0 ? 0.24 : 0.18}
                    opacity={opacity}
                  />
                );
              })}
            </g>
            {globeLatitudes.map((lat) => {
              const radians = (lat * Math.PI) / 180;
              const y = 180 + Math.sin(radians) * 132;
              const rx = Math.cos(radians) * 132;
              const ry = Math.max(3, Math.cos(radians) * 18);
              const opacity = lat === 0 ? 0.56 : 0.27 + (1 - Math.abs(lat) / 75) * 0.24;

              return (
                <ellipse
                  key={`lat-${lat}`}
                  cx="180"
                  cy={y}
                  rx={rx}
                  ry={ry}
                  fill="none"
                  stroke="url(#wireGlobeStroke)"
                  strokeWidth={lat === 0 ? 0.24 : 0.18}
                  opacity={opacity}
                />
              );
            })}
            {[35, 145].map((tilt) => (
              <ellipse
                key={`great-circle-${tilt}`}
                cx="180"
                cy="180"
                rx="132"
                ry="24"
                fill="none"
                stroke="url(#wireGlobeStroke)"
                strokeWidth="0.16"
                opacity="0.24"
                transform={`rotate(${tilt} 180 180)`}
              />
            ))}
          </g>
        </g>
      </svg>
    ) : null}
    <div
      style={{
        position: 'absolute',
        right: -60,
        bottom: frameKind === 'statement' || frameKind === 'closing' ? 190 : 310,
        width: 320,
        height: 520,
        background:
          tokens.mode === 'liquid-dark'
            ? `repeating-linear-gradient(90deg, transparent 0 12px, ${tokens.accent2}24 12px 15px)`
            : 'repeating-linear-gradient(90deg, rgba(31,43,224,0.0) 0 12px, rgba(31,43,224,0.18) 12px 15px)',
        clipPath: 'polygon(36% 0, 100% 0, 100% 22%, 72% 22%, 72% 48%, 92% 48%, 92% 100%, 20% 100%, 20% 68%, 0 68%, 0 24%, 36% 24%)',
        opacity: tokens.mode === 'liquid-dark' ? 0.08 : frameKind === 'process' || frameKind === 'stat' ? 0.12 : 0.22,
      }}
    />
  </>
);

const Ledger = ({
  tags,
  tokens,
  bottom = 238,
  color,
}: {
  tags: string[];
  tokens: ReturnType<typeof resolveTokens>;
  bottom?: number;
  color?: string;
}) =>
  tags.length > 0 ? (
    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        bottom,
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, tags.length)}, 1fr)`,
        gap: 14,
        color: color ?? tokens.ink,
      }}
    >
      {tags.map((tag, index) => (
        <div key={`${tag}-${index}`} style={{borderTop: `2px solid ${index === 0 ? tokens.accent : tokens.line}`, paddingTop: 16}}>
          <div
            style={{
              fontFamily: tokens.monoFont,
              fontSize: 15,
              letterSpacing: tokens.mode === 'soft' ? 1 : 2,
              marginBottom: 10,
              opacity: 0.62,
            }}
          >
            0{index + 1}
          </div>
          <div style={{fontSize: 27, fontWeight: tokens.mode === 'forest' ? 500 : 800, lineHeight: 1.12}}>{tag}</div>
        </div>
      ))}
    </div>
  ) : null;

export const SceneEditorialBrief = ({
  plan,
  scene,
  sceneIndex,
  totalScenes,
  globalFrame,
}: {
  plan: VideoPlan;
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  globalFrame?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const safeArea = resolveSafeArea(width, height, plan.meta.platforms);
  const progress = frame / Math.max(1, durationInFrames);
  const isThreeFour = height / width < 1.45;
  const tokens = resolveTokens(plan.style.editorialVariant);
  const frameKind = resolveFrame(scene, sceneIndex);
  const isNineSixteen = safeArea.name === '9:16';
  const bodyText = scene.body || shortText(scene.voiceover, 42);
  const tags = (scene.tags ?? []).map(tagText).slice(0, 4);
  const config = chromeConfig(plan.style);
  const showFrameLabels = config.header !== 'none';
  const showLedger = config.showLedger;
  const titleLines = splitTitle(scene.caption);
  const drift = interpolate(progress, [0, 1], [0, -20], clamp);
  const titleIn = spring({frame: frame - 4, fps, config: {damping: 170}, durationInFrames: 28});
  const contentIn = spring({frame: frame - 16, fps, config: {damping: 190}, durationInFrames: 30});
  const wipe = interpolate(frame, [8, 30], [0, 1], ease);
  const darkSignal = tokens.mode === 'signal' && (frameKind === 'statement' || frameKind === 'quote' || frameKind === 'closing');
  const primary = darkSignal ? tokens.ink : tokens.ink;
  const onAccent = tokens.mode === 'forest' ? tokens.accent2 : tokens.accent2;
  const filledBg = tokens.mode === 'cobalt' ? tokens.accent : tokens.panel;
  const filledFg = tokens.mode === 'cobalt' ? tokens.bg : onAccent;
  const titleSize = scene.caption.length > 18 ? 74 : scene.caption.length > 12 ? 88 : 106;

  const common = {
    color: primary,
    fontFamily: tokens.bodyFont,
    overflow: 'hidden' as const,
  };

  const renderStatement = () => (
    <>
      <Chrome plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} tokens={tokens} />
      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 168,
          width: tokens.mode === 'cobalt' ? '64%' : '78%',
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 26}px)`,
        }}
      >
        {showFrameLabels ? (
          <div style={{fontFamily: tokens.monoFont, fontSize: 21, letterSpacing: 4, color: tokens.accent, marginBottom: 26, textTransform: 'uppercase'}}>
            {tokens.source} / Statement
          </div>
        ) : null}
        <div
          style={{
            fontFamily: tokens.displayFont,
            fontSize: tokens.mode === 'forest' ? 104 : titleSize,
            fontWeight: tokens.mode === 'cobalt' || tokens.mode === 'soft' ? 400 : 500,
            lineHeight: tokens.mode === 'cobalt' ? 0.92 : 0.96,
            letterSpacing: 0,
          }}
        >
          {titleLines.map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
        <div
          style={{
            marginTop: 36,
            maxWidth: 720,
            fontSize: 36,
            lineHeight: 1.3,
            fontWeight: tokens.mode === 'cobalt' ? 600 : 500,
          }}
        >
          {bodyText}
        </div>
      </div>
      {showLedger ? <Ledger tags={tags} tokens={tokens} /> : null}
    </>
  );

  const renderSplit = () => (
    <>
      <Chrome plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} tokens={tokens} color={tokens.mode === 'signal' ? '#1A2030' : undefined} />
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 166,
          bottom: 220,
          display: 'grid',
          gridTemplateColumns: '0.92fr 1.08fr',
          gap: 34,
          opacity: contentIn,
          transform: `translateY(${(1 - contentIn) * 18}px)`,
          color: tokens.mode === 'signal' ? '#1A2030' : tokens.ink,
        }}
      >
        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
          <div>
            {showFrameLabels ? (
              <div style={{fontFamily: tokens.monoFont, fontSize: 20, letterSpacing: 3, color: tokens.accent, marginBottom: 20, textTransform: 'uppercase'}}>
                Definition / Context
              </div>
            ) : null}
            <div style={{fontFamily: tokens.displayFont, fontSize: 86, fontWeight: 500, lineHeight: 0.98}}>
              {titleLines.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </div>
          </div>
          <div style={{fontSize: 31, lineHeight: 1.36, maxWidth: 480}}>{bodyText}</div>
        </div>
        <div
          style={{
            background: tokens.mode === 'signal' ? tokens.bg : filledBg,
            color: tokens.mode === 'signal' ? tokens.ink : filledFg,
            borderRadius: tokens.radius,
            padding: 40,
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{fontFamily: tokens.monoFont, fontSize: 18, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.78}}>Field Note</div>
          <div style={{alignSelf: 'center', fontFamily: tokens.displayFont, fontSize: 66, lineHeight: 1, fontWeight: 500}}>
            {tags[0] ?? shortText(scene.caption, 8)}
          </div>
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
            {tags.map((tag) => (
              <span key={tag} style={{border: `1px solid currentColor`, padding: '8px 12px', fontFamily: tokens.monoFont, fontSize: 15, letterSpacing: 1.2}}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const renderProcess = () => {
    const items = tags.length > 0 ? tags : ['业务现场', 'AI 判断', '流程重构'];
    return (
      <>
        <Chrome plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} tokens={tokens} />
        <div style={{position: 'absolute', left: 72, right: 72, top: 156}}>
          {showFrameLabels ? (
            <div style={{fontFamily: tokens.monoFont, fontSize: 20, color: tokens.accent, letterSpacing: 3, textTransform: 'uppercase'}}>Process Frame</div>
          ) : null}
          <div style={{fontFamily: tokens.displayFont, fontSize: 74, fontWeight: 500, lineHeight: 0.98, marginTop: 20, maxWidth: 780}}>{scene.caption}</div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 72,
            right: 72,
            top: isThreeFour ? 430 : 500,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            opacity: contentIn,
            transform: `translateY(${(1 - contentIn) * 18}px)`,
          }}
        >
          {items.slice(0, 3).map((item, index) => {
            const filled = index === 0;
            const bg = filled ? filledBg : index === 1 ? tokens.panel2 : tokens.bg2;
            const fg = filled ? filledFg : tokens.ink;
            return (
              <div
                key={item}
                style={{
                  minHeight: 260,
                  borderRadius: tokens.radius,
                  background: bg,
                  color: fg,
                  border: filled ? 'none' : `2px solid ${tokens.line}`,
                  padding: 30,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{fontFamily: tokens.monoFont, fontSize: 18, letterSpacing: 2}}>0{index + 1}</div>
                <div style={{fontFamily: tokens.displayFont, fontSize: 46, lineHeight: 1.02, fontWeight: 500}}>{item}</div>
                <div style={{fontSize: 21, lineHeight: 1.28, opacity: 0.82}}>{index === 0 ? bodyText : shortText(scene.voiceover, 18)}</div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderQuote = () => (
    <>
      <Chrome plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} tokens={tokens} />
      <div
        style={{
          position: 'absolute',
          left: 96,
          right: 96,
          top: 190,
          bottom: 230,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          opacity: titleIn,
          transform: `scale(${0.98 + wipe * 0.02})`,
        }}
      >
        <div style={{fontFamily: tokens.displayFont, fontSize: 118, fontWeight: 500, lineHeight: 1.02, textAlign: tokens.mode === 'cobalt' ? 'left' : 'center'}}>
          {scene.caption}
        </div>
        <div
          style={{
            marginTop: 36,
            alignSelf: tokens.mode === 'cobalt' ? 'flex-start' : 'center',
            maxWidth: 720,
            fontSize: 34,
            lineHeight: 1.34,
            textAlign: tokens.mode === 'cobalt' ? 'left' : 'center',
            color: tokens.mode === 'signal' ? tokens.accent : tokens.muted,
          }}
        >
          {bodyText}
        </div>
      </div>
      {showLedger ? <Ledger tags={tags} tokens={tokens} /> : null}
    </>
  );

  const renderStat = () => (
    <>
      <Chrome plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} tokens={tokens} color={tokens.mode === 'signal' ? '#1A2030' : undefined} />
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 170,
          bottom: 220,
          color: tokens.mode === 'signal' ? '#1A2030' : tokens.ink,
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          gap: 42,
        }}
      >
        <div>
          {showFrameLabels ? (
            <div style={{fontFamily: tokens.monoFont, color: tokens.accent, letterSpacing: 3, fontSize: 20, textTransform: 'uppercase'}}>Signal / Evidence</div>
          ) : null}
          <div style={{fontFamily: tokens.displayFont, fontSize: 82, lineHeight: 0.98, fontWeight: 500, marginTop: 18}}>{scene.caption}</div>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 24}}>
            <div
            style={{
              background: tokens.mode === 'signal' ? tokens.bg : filledBg,
              color: tokens.mode === 'signal' ? tokens.ink : filledFg,
              borderRadius: tokens.radius,
              padding: 38,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{fontFamily: tokens.monoFont, fontSize: 18, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.75}}>Role Shift</div>
            <div style={{fontFamily: tokens.displayFont, fontSize: 88, lineHeight: 0.94, fontWeight: 500}}>{tags[2] ?? tags[0] ?? 'AI'}</div>
            <div style={{fontSize: 30, lineHeight: 1.28}}>{bodyText}</div>
          </div>
          <div style={{display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', gap: 16}}>
            {tags.map((tag, index) => (
              <div key={tag} style={{borderTop: `2px solid ${tokens.accent}`, padding: '18px 0 0'}}>
                <div style={{fontFamily: tokens.monoFont, fontSize: 16, letterSpacing: 2, color: tokens.accent}}>0{index + 1}</div>
                <div style={{fontFamily: tokens.displayFont, fontSize: 42, lineHeight: 1.05, marginTop: 10}}>{tag}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const renderClosing = () => (
    <>
      <Chrome plan={plan} scene={scene} sceneIndex={sceneIndex} totalScenes={totalScenes} tokens={tokens} />
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 168,
          bottom: 210,
          display: 'grid',
          placeItems: tokens.mode === 'cobalt' ? 'start' : 'center',
          textAlign: tokens.mode === 'cobalt' ? 'left' : 'center',
        }}
      >
        <div style={{maxWidth: 900, opacity: titleIn}}>
          {showFrameLabels ? (
            <div style={{fontFamily: tokens.monoFont, color: tokens.accent, fontSize: 20, letterSpacing: 3, marginBottom: 28, textTransform: 'uppercase'}}>
              Closing / Takeaway
            </div>
          ) : null}
          <div style={{fontFamily: tokens.displayFont, fontSize: 110, fontWeight: 500, lineHeight: 0.96}}>{scene.caption}</div>
          <div style={{fontSize: 36, lineHeight: 1.34, marginTop: 34, color: tokens.mode === 'signal' ? tokens.accent : tokens.muted}}>{bodyText}</div>
        </div>
      </div>
      {showLedger ? <Ledger tags={tags} tokens={tokens} /> : null}
    </>
  );

  const renderSpokenCardV1 = () => {
    const items = tags.length > 0 ? tags : ['业务现场', 'AI 判断', '流程重构'];
    const indexText = String(sceneIndex + 1).padStart(2, '0');
    const isDark = tokens.mode === 'liquid-dark' || tokens.mode === 'signal';
    const surface = isDark ? 'rgba(255,255,255,0.072)' : 'rgba(255,255,255,0.56)';
    const surfaceStrong = isDark ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.68)';
    const titleSize = isNineSixteen
      ? sceneIndex === 0
        ? 78
        : scene.caption.length > 18
          ? 54
          : scene.caption.length > 12
            ? 62
            : 72
      : sceneIndex === 0
        ? 96
        : scene.caption.length > 18
          ? 66
          : scene.caption.length > 12
            ? 76
            : 86;
    const sceneFrames = Math.max(1, Math.round((scene.end - scene.start) * fps));
    const sceneProgress = frame / sceneFrames;
    const bgShift = interpolate(sceneProgress, [0, 1], [0, -18], clamp);
    const layerIn = (delay = 0, distance = 18) => {
      const value = spring({frame: frame - delay, fps, config: {damping: 180}, durationInFrames: 28});
      return {
        opacity: value,
        transform: `translateY(${(1 - value) * distance}px)`,
      };
    };
    const itemIn = (index: number, delay = 24, distance = 16) => {
      const value = spring({frame: frame - delay - index * 7, fps, config: {damping: 190}, durationInFrames: 26});
      return {
        opacity: value,
        transform: `translateY(${(1 - value) * distance}px) scale(${0.985 + value * 0.015})`,
      };
    };
    const accentFor = (index: number) => [tokens.accent2, tokens.accent, '#ED5C98', '#F2C94C'][index % 4];
    const labelByFrame: Record<FrameKind, string> = {
      statement: '开场判断',
      split: '它到底是什么',
      process: scene.type === 'analysis' ? '真正的问题' : '进到真实业务里',
      quote: 'FDE 难在哪',
      stat: '为什么突然火',
      closing: '未来能力',
    };

    const titleText = scene.caption;
    const leadText = bodyText;

    const Topline = () => (
      <div
        style={{
          ...layerIn(0, 12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 34,
          color: tokens.muted,
          fontFamily: tokens.monoFont,
          fontSize: isNineSixteen ? 18 : 22,
          fontWeight: 720,
          letterSpacing: '0.08em',
          marginBottom: isNineSixteen ? 24 : 42,
        }}
      >
        <span>FDE / AI WORKFLOW</span>
        <span>{indexText}</span>
      </div>
    );

    const Tag = () => (
      <div
        style={{
          ...layerIn(5, 14),
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          minHeight: isNineSixteen ? 36 : 42,
          marginBottom: isNineSixteen ? 24 : 38,
          padding: '0 16px 0 13px',
          border: `1px solid ${tokens.mode === 'liquid-dark' ? 'rgba(255,255,255,0.16)' : tokens.line}`,
          borderRadius: tokens.mode === 'liquid-dark' ? 999 : 8,
          color: tokens.ink,
          background:
            tokens.mode === 'liquid-dark'
              ? 'linear-gradient(90deg, rgba(117,103,255,0.28), rgba(53,242,197,0.10))'
              : surface,
          boxShadow: tokens.mode === 'liquid-dark' ? `0 0 30px ${tokens.accent}2b` : undefined,
          fontSize: isNineSixteen ? 18 : 22,
          fontWeight: 720,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: tokens.accent2,
            boxShadow: `0 0 18px ${tokens.accent2}`,
            flex: '0 0 auto',
          }}
        />
        <span style={{color: tokens.accent2, fontFamily: tokens.monoFont, fontSize: 16, letterSpacing: '0.08em'}}>
          {String(sceneIndex + 1).padStart(2, '0')}
        </span>
        <span>{labelByFrame[frameKind]}</span>
      </div>
    );

    const headlineLines = splitTitle(titleText, sceneIndex === 0 ? 12 : 10);

    const Headline = () => (
      <div
        style={{
          ...layerIn(9, 20),
          maxWidth: frameKind === 'statement' ? 900 : 880,
          color: tokens.ink,
          fontFamily: tokens.displayFont,
          fontSize: titleSize,
          lineHeight: sceneIndex === 0 ? 1.02 : isNineSixteen ? 1.08 : 1.06,
          fontWeight: 730,
          letterSpacing: 0,
        }}
      >
        {headlineLines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    );

    const Lead = () => (
      <div
        style={{
          ...layerIn(14, 18),
          maxWidth: isNineSixteen ? 720 : 830,
          marginTop: isNineSixteen ? 24 : 34,
          color: tokens.mode === 'liquid-dark' ? tokens.ink : tokens.muted,
          fontSize: isNineSixteen ? 27 : 34,
          lineHeight: 1.34,
          fontWeight: 590,
        }}
      >
        {leadText}
      </div>
    );

    const ContentZone = ({children}: {children: React.ReactNode}) => (
      <div
        style={{
          ...layerIn(22, 20),
          marginTop: leadText ? (isNineSixteen ? 34 : 60) : (isNineSixteen ? 38 : 64),
          maxWidth: isNineSixteen ? 720 : 880,
        }}
      >
        {children}
      </div>
    );

    const ChipRow = () => (
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18}}>
        {items.slice(0, 4).map((item, index) => (
          <span
            key={item}
            style={{
              ...itemIn(index, 32, 10),
              padding: '10px 14px',
              border: `1px solid rgba(255,255,255,0.14)`,
              borderRadius: 999,
              color: index === 0 ? tokens.ink : tokens.muted,
              background: index === 0 ? 'rgba(53,242,197,0.13)' : 'rgba(255,255,255,0.045)',
              fontFamily: tokens.monoFont,
              fontSize: 17,
              fontWeight: 640,
              opacity: index === 0 ? 0.92 : 0.76,
            }}
          >
            {item}
          </span>
        ))}
      </div>
    );

    const Copy = ({lines, chips = false}: {lines: string[]; chips?: boolean}) => (
      <div
        style={{
          display: 'grid',
          gap: 18,
          maxWidth: 850,
          padding: isNineSixteen ? '26px 28px' : '32px 34px',
          borderLeft: `5px solid ${tokens.accent2}`,
          borderTop: '1px solid rgba(255,255,255,0.10)',
          background: `linear-gradient(135deg, ${surfaceStrong}, rgba(255,255,255,0.035))`,
          boxShadow: '0 24px 70px rgba(0,0,0,0.24)',
          fontSize: isNineSixteen ? 26 : 32,
          lineHeight: 1.34,
          fontWeight: 620,
        }}
      >
        {lines.map((line) => (
          <p key={line} style={{margin: 0}}>{line}</p>
        ))}
        {chips ? <ChipRow /> : null}
      </div>
    );

    const List = ({values = items}: {values?: string[]}) => (
      <div style={{display: 'grid', gap: 15}}>
        {values.slice(0, 4).map((item, index) => (
          <div
            key={`${item}-${index}`}
            style={{
              ...itemIn(index, 24, 18),
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '48px 1fr',
              alignItems: 'center',
              gap: 18,
              minHeight: isNineSixteen ? 72 : 78,
              padding: '0 24px 0 22px',
              marginLeft: 0,
              marginRight: 0,
              border: `1px solid ${index === 0 ? 'rgba(53,242,197,0.26)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: 8,
              background:
                index === 0
                  ? 'linear-gradient(90deg, rgba(53,242,197,0.18), rgba(255,255,255,0.06))'
                  : `linear-gradient(90deg, ${surface}, rgba(255,255,255,0.032))`,
              boxShadow: index === 0 ? `0 0 34px ${tokens.accent2}1f` : '0 12px 44px rgba(0,0,0,0.14)',
              fontSize: isNineSixteen ? 24 : 28,
              fontWeight: 680,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 5,
                background: accentFor(index),
                opacity: 0.9,
              }}
            />
            <b style={{color: accentFor(index), fontSize: 18, fontFamily: tokens.monoFont, fontWeight: 650, opacity: 0.86}}>0{index + 1}</b>
            <span>{item}</span>
            <span
              style={{
                position: 'absolute',
                right: 24,
                top: '50%',
                width: 38,
                height: 3,
                background: accentFor(index),
                opacity: 0.85,
                transform: 'translateY(-50%)',
              }}
            />
          </div>
        ))}
      </div>
    );

    const DefinitionContrast = () => (
      <div style={{display: 'grid', gap: 16}}>
        {[
          ['不是', '卖软件', '不是销售话术，也不是需求转述'],
          ['而是', '进现场', '把 AI 接进真实业务动作'],
        ].map(([label, strong, desc], index) => (
          <div
            key={label}
            style={{
              ...itemIn(index, 24, 18),
              display: 'grid',
              gridTemplateColumns: '118px 1fr',
              alignItems: 'center',
              minHeight: isNineSixteen ? 98 : 118,
              padding: isNineSixteen ? '18px 22px' : '22px 28px',
              border: `1px solid ${index === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(53,242,197,0.28)'}`,
              borderRadius: 8,
              background: index === 0 ? `linear-gradient(90deg, ${surface}, rgba(255,255,255,0.03))` : `linear-gradient(90deg, rgba(53,242,197,0.18), ${surfaceStrong})`,
              boxShadow: index === 1 ? `0 0 42px ${tokens.accent2}1a` : '0 14px 46px rgba(0,0,0,0.14)',
            }}
          >
            <span style={{fontFamily: tokens.monoFont, color: index === 1 ? tokens.accent2 : tokens.muted, fontSize: 22, fontWeight: 650, opacity: 0.84}}>{label}</span>
            <div>
              <div style={{fontFamily: tokens.displayFont, fontSize: isNineSixteen ? 36 : 44, lineHeight: 1, fontWeight: 700}}>{strong}</div>
              <div style={{marginTop: 9, color: tokens.muted, fontSize: isNineSixteen ? 18 : 21, lineHeight: 1.25, fontWeight: 560}}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    );

    const SceneMatrix = () => (
      <div style={{display: 'grid', gridTemplateColumns: isNineSixteen ? '1fr' : '1fr 1fr', gap: isNineSixteen ? 12 : 15}}>
        {items.slice(0, 4).map((item, index) => (
          <div
            key={item}
            style={{
              ...itemIn(index, 24, 16),
              minHeight: isNineSixteen ? 82 : 126,
              padding: isNineSixteen ? '16px 20px' : '22px 24px',
              border: `1px solid rgba(255,255,255,0.11)`,
              borderLeft: `5px solid ${accentFor(index)}`,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${accentFor(index)}18, rgba(255,255,255,0.045))`,
              boxShadow: '0 16px 50px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{fontFamily: tokens.monoFont, color: accentFor(index), fontSize: 17, fontWeight: 650, opacity: 0.86}}>0{index + 1}</div>
            <div style={{marginTop: isNineSixteen ? 12 : 24, fontFamily: tokens.displayFont, fontSize: isNineSixteen ? 27 : 31, lineHeight: 1.08, fontWeight: 700}}>{item}</div>
          </div>
        ))}
      </div>
    );

    const Diagnostic = () => {
      const descriptions = ['哪个环节需要理解与生成', '哪里需要连续执行和调用工具', '哪些动作应该被重新设计'];
      return (
        <div style={{display: 'grid', gap: 16}}>
          {items.slice(0, 3).map((item, index) => (
            <div
              key={item}
              style={{
                ...itemIn(index, 24, 16),
                display: 'grid',
                gridTemplateColumns: '72px 1fr',
                gap: 20,
                alignItems: 'center',
                minHeight: isNineSixteen ? 92 : 108,
                padding: isNineSixteen ? '17px 20px' : '20px 24px',
                border: `1px solid rgba(255,255,255,0.12)`,
                borderRadius: 8,
                background: `linear-gradient(90deg, ${accentFor(index)}20, ${surface})`,
                boxShadow: '0 14px 44px rgba(0,0,0,0.14)',
              }}
            >
              <div style={{width: 54, height: 54, borderRadius: 999, border: `2px solid ${accentFor(index)}`, display: 'grid', placeItems: 'center', color: accentFor(index), fontFamily: tokens.monoFont, fontSize: 18, fontWeight: 680, opacity: 0.9}}>Q{index + 1}</div>
              <div>
                <div style={{fontFamily: tokens.displayFont, fontSize: isNineSixteen ? 29 : 34, lineHeight: 1.05, fontWeight: 700}}>{item}</div>
                <div style={{marginTop: 8, color: tokens.muted, fontSize: isNineSixteen ? 18 : 20, lineHeight: 1.25, fontWeight: 560}}>{descriptions[index]}</div>
              </div>
            </div>
          ))}
        </div>
      );
    };

    const TransformFlow = () => {
      const nodes = ['业务问题', '抽象规则', 'AI 工作流'];
      return (
        <div style={{display: 'grid', gridTemplateColumns: isNineSixteen ? '1fr' : '1fr 54px 1fr 54px 1fr', alignItems: 'center', gap: isNineSixteen ? 12 : 8}}>
          {nodes.map((node, index) => (
            <React.Fragment key={node}>
              <div
                style={{
                  ...itemIn(index, 24, 16),
                  minHeight: isNineSixteen ? 94 : 158,
                  padding: isNineSixteen ? '18px 20px' : '22px 18px',
                  border: `1px solid rgba(255,255,255,0.12)`,
                  borderTop: `5px solid ${accentFor(index)}`,
                  borderRadius: 8,
                  background: `linear-gradient(180deg, ${accentFor(index)}1c, rgba(255,255,255,0.045))`,
                  boxShadow: '0 18px 56px rgba(0,0,0,0.16)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{fontFamily: tokens.monoFont, color: accentFor(index), fontSize: 16, fontWeight: 650, opacity: 0.84}}>0{index + 1}</span>
                <strong style={{fontFamily: tokens.displayFont, fontSize: isNineSixteen ? 28 : 30, lineHeight: 1.08}}>{node}</strong>
              </div>
              {index < nodes.length - 1 ? (
                <div style={{color: accentFor(index), fontSize: isNineSixteen ? 26 : 34, fontWeight: 700, textAlign: 'center', opacity: 0.72}}>{isNineSixteen ? '↓' : '→'}</div>
              ) : null}
            </React.Fragment>
          ))}
        </div>
      );
    };

    const Flow = () => (
      <div style={{display: 'grid', gap: 16}}>
        {items.slice(0, 3).map((item, index) => (
          <div
            key={`${item}-${index}`}
            style={{
              ...itemIn(index, 24, 18),
              position: 'relative',
              padding: isNineSixteen ? '20px 24px' : '24px 28px 24px 30px',
              border: `1px solid rgba(255,255,255,0.12)`,
              borderLeft: `5px solid ${accentFor(index)}`,
              background: `linear-gradient(90deg, ${accentFor(index)}22, ${surface})`,
              boxShadow: '0 18px 56px rgba(0,0,0,0.18)',
              fontSize: isNineSixteen ? 25 : 30,
              lineHeight: 1.28,
              fontWeight: 700,
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: 24,
                top: 22,
                color: accentFor(index),
                fontFamily: tokens.monoFont,
                fontSize: 18,
                letterSpacing: '0.08em',
              }}
            >
              0{index + 1}
            </div>
            <strong style={{display: 'block', paddingRight: 56}}>{item}</strong>
            <small style={{display: 'block', marginTop: 10, color: tokens.muted, fontSize: 20, fontWeight: 560}}>
              {index === 0 ? '总结、检索、生成、判断' : index === 1 ? '连续执行、调用工具、跨系统协作' : '不只是替换人，而是改造工作方式'}
            </small>
          </div>
        ))}
      </div>
    );

    const Split = () => (
      <div style={{display: 'grid', gridTemplateColumns: isNineSixteen ? '1fr' : '1fr 1fr', gap: isNineSixteen ? 12 : 16}}>
        {[
          ['旧角色被压缩', '裁员 / 降本'],
          ['新角色被招聘', '招 FDE / 做落地'],
        ].map(([small, strong], index) => (
          <div
            key={small}
            style={{
              ...itemIn(index, 24, 18),
              minHeight: isNineSixteen ? 118 : 190,
              padding: isNineSixteen ? 22 : 26,
              border: `1px solid rgba(255,255,255,0.10)`,
              background: index === 1 ? `linear-gradient(135deg, ${tokens.accent}, rgba(53,242,197,0.32))` : surface,
              color: index === 1 ? tokens.ink : tokens.ink,
            }}
          >
            <small style={{display: 'block', marginBottom: isNineSixteen ? 16 : 26, color: index === 1 ? 'rgba(255,255,255,0.74)' : tokens.muted, fontSize: isNineSixteen ? 19 : 22, fontWeight: 600}}>
              {small}
            </small>
            <strong style={{display: 'block', color: index === 1 ? tokens.ink : tokens.accent, fontSize: isNineSixteen ? 32 : 38, lineHeight: 1.14, fontWeight: 720}}>
              {strong}
            </strong>
          </div>
        ))}
      </div>
    );

    const RoleMatrix = () => (
      <div style={{display: 'grid', gridTemplateColumns: isNineSixteen ? '1fr' : '1fr 1fr', gap: isNineSixteen ? 12 : 15}}>
        {items.slice(0, 4).map((item, index) => (
          <div
            key={item}
            style={{
              ...itemIn(index, 24, 16),
              minHeight: isNineSixteen ? 78 : 114,
              padding: isNineSixteen ? '17px 20px' : '20px 22px',
              border: `1px solid rgba(255,255,255,0.11)`,
              borderRadius: 8,
              background: index === 0 ? `linear-gradient(90deg, rgba(53,242,197,0.18), ${surfaceStrong})` : `linear-gradient(90deg, ${surface}, rgba(255,255,255,0.03))`,
              boxShadow: '0 14px 44px rgba(0,0,0,0.13)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong style={{fontFamily: tokens.displayFont, fontSize: isNineSixteen ? 27 : 32, lineHeight: 1, fontWeight: 700}}>{item}</strong>
            <span style={{fontFamily: tokens.monoFont, color: accentFor(index), fontSize: 16, fontWeight: 650, opacity: 0.82}}>+AI</span>
          </div>
        ))}
      </div>
    );

    const ConnectionTriangle = () => (
      <div style={{position: 'relative', height: isNineSixteen ? 420 : 360, maxWidth: isNineSixteen ? 620 : 780}}>
        <svg viewBox={isNineSixteen ? '0 0 620 420' : '0 0 780 360'} style={{position: 'absolute', inset: 0, opacity: 0.72}}>
          <circle cx="390" cy="188" r="28" fill="rgba(53,242,197,0.09)" stroke={tokens.accent2} strokeWidth="1.4" opacity="0.72" />
          <circle cx="390" cy="188" r="4" fill={tokens.accent2} opacity="0.9" />
          <path d="M390 160 L390 128" fill="none" stroke={tokens.accent2} strokeWidth="1.6" opacity="0.42" />
          <path d="M362 202 L254 278" fill="none" stroke={tokens.accent} strokeWidth="1.6" opacity="0.38" />
          <path d="M418 202 L526 278" fill="none" stroke="#ED5C98" strokeWidth="1.6" opacity="0.38" />
        </svg>
        {[
          ...(isNineSixteen
            ? [
                ['懂业务', '知道问题在哪', 210, 0, tokens.accent2],
                ['懂模型', '知道能力边界', 70, 245, tokens.accent],
                ['懂落地', '知道怎么跑通', 350, 245, '#ED5C98'],
              ]
            : [
                ['懂业务', '知道问题在哪', 292, 18, tokens.accent2],
                ['懂模型', '知道能力边界', 44, 252, tokens.accent],
                ['懂落地', '知道怎么跑通', 536, 252, '#ED5C98'],
              ]),
        ].map(([title, desc, left, top, color], index) => (
          <div
            key={title}
            style={{
              ...itemIn(index, 24, 14),
              position: 'absolute',
              left,
              top,
              width: isNineSixteen ? 190 : 200,
              padding: '18px 18px',
              border: `1px solid rgba(255,255,255,0.12)`,
              borderTop: `4px solid ${color}`,
              borderRadius: 8,
              background: `linear-gradient(180deg, ${color}24, rgba(18,22,34,0.94))`,
              boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
              textAlign: 'center',
            }}
          >
            <div style={{fontFamily: tokens.displayFont, fontSize: 30, lineHeight: 1, fontWeight: 700}}>{title}</div>
            <div style={{marginTop: 10, color: tokens.muted, fontSize: 17, lineHeight: 1.2, fontWeight: 560}}>{desc}</div>
          </div>
        ))}
      </div>
    );

    const CornerMarks = () => (
      <>
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 28,
            width: 86,
            height: 86,
            borderTop: `1px solid ${tokens.line}`,
            borderRight: `1px solid ${tokens.line}`,
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 28,
            bottom: 28,
            width: 86,
            height: 86,
            borderLeft: `1px solid rgba(255,255,255,0.08)`,
            borderBottom: `1px solid rgba(255,255,255,0.08)`,
            opacity: 0.62,
          }}
        />
      </>
    );

    const shellTop = isNineSixteen ? safeArea.contentTop + 8 : safeArea.contentTop;
    const shellRight = safeArea.contentRight;
    const shellBottom = Math.max(safeArea.contentBottom, safeArea.captionBottom + 84);
    const shellLeft = safeArea.contentLeft;

    const Shell = ({children}: {children: React.ReactNode}) => (
      <AbsoluteFill style={common}>
        <SpokenCardBg tokens={tokens} frameKind={frameKind} drift={drift + bgShift} frame={globalFrame ?? frame} />
        <CornerMarks />
        <div style={{position: 'absolute', top: shellTop, right: shellRight, bottom: shellBottom, left: shellLeft}}>
          <Topline />
          <Tag />
          <Headline />
          {children}
        </div>
      </AbsoluteFill>
    );

    const heroSupportLine = sceneIndex === 0
      ? '简单说，就是深入企业现场，把 AI 落到真实业务里'
      : scene.voiceover.split('。').find((line) => line.includes('AI')) || '这不是多了一个 title，而是企业开始认真问：AI 到底怎么在业务里干活？';

    const renderHero = () => (
      <Shell>
        <Lead />
        <ContentZone>
          <Copy lines={[heroSupportLine]} chips />
        </ContentZone>
      </Shell>
    );

    const renderDefinition = () => (
      <Shell>
        <Lead />
        <ContentZone>
          <DefinitionContrast />
        </ContentZone>
      </Shell>
    );

    const renderThreePoints = () => (
      <Shell>
        <Lead />
        <ContentZone>
          {scene.id === 'scene-003'
            ? <SceneMatrix />
            : scene.id === 'scene-004'
              ? <Diagnostic />
              : scene.id === 'scene-007'
                ? <RoleMatrix />
                : scene.type === 'analysis'
                  ? <Flow />
                  : <List />}
        </ContentZone>
      </Shell>
    );

    const renderQuoteCard = () => (
      <Shell>
        <Lead />
        <ContentZone>
          <TransformFlow />
        </ContentZone>
      </Shell>
    );

    const renderStatCard = () => (
      <Shell>
        <Lead />
        <ContentZone>
          <Split />
        </ContentZone>
      </Shell>
    );

    const renderEnd = () => (
      <Shell>
        <Lead />
        <ContentZone>
          <ConnectionTriangle />
        </ContentZone>
      </Shell>
    );

    return (
      <>
        {frameKind === 'statement'
          ? renderHero()
          : frameKind === 'split'
            ? renderDefinition()
            : frameKind === 'process'
              ? renderThreePoints()
              : frameKind === 'quote'
                ? renderQuoteCard()
                : frameKind === 'stat'
                  ? renderStatCard()
                  : renderEnd()}
      </>
    );
  };

  if (plan.style.layoutSystem === 'spoken-card-v1' || plan.style.layoutSystem === 'xhs-card-v1') {
    return renderSpokenCardV1();
  }

  return (
    <AbsoluteFill style={common}>
      <HtmlInspiredBackground tokens={tokens} frameKind={frameKind} drift={drift} />
      {frameKind === 'statement'
        ? renderStatement()
        : frameKind === 'split'
          ? renderSplit()
          : frameKind === 'process'
            ? renderProcess()
            : frameKind === 'quote'
              ? renderQuote()
              : frameKind === 'stat'
                ? renderStat()
                : renderClosing()}
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, Composition, registerRoot, useCurrentFrame} from 'remotion';
import {F, Role, THEMES, W, Z, abs, checkSpan, font} from './kit';
import {components} from './registry';

// Component workbench: `npm run gallery` in remotion/. One composition per component, sample and maximum-length text, light and
// dark. Samples are text only, written for the sample topic; they exist to review motion and to check text limits. Toggle
// "zones" in the Studio props panel to draw the platform-safe band over the frame.
const HOLD = 1.5;
const captions: Record<string, string> = {
  figure: '十一月四日开始测试', hook: '入口在系统层，不在某个应用里', sequence: '十一月测试，十二月正式上线',
  scope: '在中国购买，或把地区设为中国', relation: '三个入口，都接到千问',
};

type SampleProps = {id: string; variant: 'sample' | 'max'; theme: 'light' | 'dark'; zones: boolean};
const Sample: React.FC<SampleProps> = ({id, variant, theme, zones}) => {
  const f = useCurrentFrame(), spec = components.find((c) => c.id === id)!;
  const p = variant === 'sample' ? spec.sample : spec.sampleMax, to = spec.sampleSeconds + HOLD;
  spec.validate(p);
  checkSpan(spec, 0, to);
  const Body = spec.Component;
  return <AbsoluteFill data-svm-root style={{...(THEMES[theme] as React.CSSProperties), background: 'var(--page)', color: 'var(--ink)', fontFamily: font.sans}}>
    <div style={{...abs(0, Z.stage.top - 30, W, Z.stage.height + 60), background: 'radial-gradient(ellipse 58% 48% at 50% 50%,var(--glow),transparent 100%)'}}/>
    <Role role="label" style={{...abs(Z.margin, Z.topic, Z.width), fontFamily: font.serif, fontSize: 72, fontWeight: 700, lineHeight: 1.1, color: 'var(--ink)', whiteSpace: 'nowrap'}}>千问接入 Apple 智能</Role>
    <div data-layout-role="media" style={{...abs(Z.margin, Z.stage.top, Z.width, Z.stage.height)}}><Body p={p} f={f} from={0} to={to} W={Z.width} H={Z.stage.height}/></div>
    <Role role="caption" style={{...abs(Z.margin, Z.caption.top, Z.caption.width, Z.caption.height), display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 54, fontWeight: 600, lineHeight: 1.3, textWrap: 'balance'}}>{captions[spec.type]}</Role>
    {zones && <>
      <div style={{...abs(0, 0, W, 290), background: 'rgba(240,160,40,.28)'}}/><div style={{...abs(0, 1535, W, 385), background: 'rgba(240,160,40,.28)'}}/><div style={{...abs(886, 1000, 194, 535), background: 'rgba(240,160,40,.28)'}}/>
      <div style={{...abs(Z.margin, Z.stage.top, Z.width, Z.stage.height), border: '2px dashed rgba(60,160,120,.8)'}}/>
    </>}
  </AbsoluteFill>;
};

const Root: React.FC = () => <>{components.flatMap((spec) => (['sample', 'max'] as const).flatMap((variant) => (['dark', 'light'] as const).map((theme) =>
  <Composition key={`${spec.id}-${variant}-${theme}`} id={`${spec.id}-${variant}-${theme}`} component={Sample as React.FC<any>} width={1080} height={1920} fps={30}
    durationInFrames={F(spec.sampleSeconds + HOLD)} defaultProps={{id: spec.id, variant, theme, zones: false}}/>)))}</>;
registerRoot(Root);

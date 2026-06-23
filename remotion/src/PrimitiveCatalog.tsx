/**
 * Primitive Catalog — 在 Studio 中预览所有可复用原语
 * 合成名：PrimitiveCatalog，1080×1920，90帧
 */
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {
  AnimatedBar,
  Chip,
  CinematicBlur,
  CompareBar,
  CountUp,
  NoiseField,
  ShapeDecor,
  Divider,
  FadeUp,
  GlassCard,
  GradientText,
  ProgressRing,
  ScaleIn,
  SceneFooter,
  SceneHeader,
  SlideIn,
  StaggerIn,
  StatCard,
  TextReveal,
} from './primitives';

const ACCENT = '#F59E0B';
const BG = '#06060e';

const Section = ({title, children, top}: {title: string; children: React.ReactNode; top: number}) => (
  <div style={{position: 'absolute', left: 64, right: 64, top}}>
    <div style={{
      fontSize: 22, fontWeight: 700, letterSpacing: '0.16em',
      textTransform: 'uppercase', color: ACCENT,
      fontFamily: 'Menlo,monospace', marginBottom: 20,
    }}>
      {title}
    </div>
    {children}
  </div>
);

export const PrimitiveCatalog = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{background: BG, color: '#fff',
      fontFamily: '"PingFang SC","Noto Sans CJK SC",Inter,system-ui,sans-serif', overflow: 'hidden'}}>

      <SceneHeader sceneIndex={0} totalScenes={1} topic="原语目录" />

      {/* ── Motion ── */}
      <Section title="Motion" top={160}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <FadeUp delay={0}><div style={{fontSize: 32, color: 'rgba(255,255,255,0.8)'}}>FadeUp — 淡入上移</div></FadeUp>
          <ScaleIn delay={8}><div style={{fontSize: 32, color: 'rgba(255,255,255,0.8)'}}>ScaleIn — 缩放入场</div></ScaleIn>
          <SlideIn delay={16} from="left"><div style={{fontSize: 32, color: 'rgba(255,255,255,0.8)'}}>SlideIn — 左侧滑入</div></SlideIn>
        </div>
        <div style={{marginTop: 16, display: 'flex', gap: 16}}>
          <StaggerIn startDelay={24} staggerFrames={8}>
            {['StaggerIn', '逐个', '入场'].map(t => (
              <div style={{fontSize: 32, color: ACCENT}} key={t}>{t}</div>
            ))}
          </StaggerIn>
        </div>
      </Section>

      {/* ── Text ── */}
      <Section title="Text" top={520}>
        <GradientText gradient={`linear-gradient(135deg,#fff 30%,${ACCENT} 100%)`}
          style={{fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em'}}>
          GradientText 渐变文字
        </GradientText>
        <div style={{marginTop: 20, display: 'flex', alignItems: 'flex-end', gap: 0}}>
          <CountUp to={888} startFrame={0} duration={60} suffix="+" color={ACCENT} fontSize={120} />
        </div>
        <div style={{marginTop: 16}}>
          <TextReveal text="TextReveal 逐词显示效果" splitBy="word"
            startFrame={10} staggerFrames={5}
            style={{fontSize: 34, color: 'rgba(255,255,255,0.7)'}} />
        </div>
      </Section>

      {/* ── Data ── */}
      <Section title="Data" top={920}>
        <div style={{display: 'flex', gap: 24, alignItems: 'flex-start'}}>
          <ProgressRing progress={0.72} size={120} color={ACCENT} startFrame={0} duration={50}>
            <span style={{fontSize: 26, fontWeight: 700, color: ACCENT}}>72%</span>
          </ProgressRing>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 16}}>
            <AnimatedBar label="效率" value={85} color={ACCENT} startFrame={0} duration={45} />
            <AnimatedBar label="满意度" value={96} color="#60A5FA" startFrame={8} duration={45} />
          </div>
        </div>
        <div style={{marginTop: 20, display: 'flex', gap: 16}}>
          {[{v:'3×',l:'产出'},{v:'40h',l:'节省'},{v:'98%',l:'满意'}].map((s,i)=>(
            <StatCard key={i} value={s.v} label={s.l} color={ACCENT} startFrame={i*8} />
          ))}
        </div>
      </Section>

      {/* ── Layout ── */}
      <Section title="Layout" top={1380}>
        <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20}}>
          <Chip color={ACCENT} variant="tint">tint 标签</Chip>
          <Chip color="#60A5FA" variant="outline">outline 标签</Chip>
          <Chip variant="ghost">ghost 标签</Chip>
        </div>
        <Divider color={ACCENT} maxWidth={240} startFrame={0} duration={30} style={{marginBottom: 20}} />
        <GlassCard accentColor={ACCENT} startFrame={0} style={{fontSize: 30, color: 'rgba(255,255,255,0.7)'}}>
          GlassCard — 玻璃态卡片容器，带左侧彩色边框
        </GlassCard>
      </Section>

      {/* ── FX ── */}
      <Section title="FX (Official Packages)" top={1660}>
        <div style={{display: 'flex', gap: 24, alignItems: 'center'}}>
          <CinematicBlur>
            <CountUp to={99} startFrame={0} duration={40} suffix="%" color={ACCENT} fontSize={80} />
          </CinematicBlur>
          <div style={{fontSize: 26, color: 'rgba(255,255,255,0.45)'}}>
            CinematicBlur → CountUp
          </div>
        </div>
      </Section>

      {/* NoiseField 背景 */}
      <NoiseField cols={14} rows={24} color={ACCENT} maxOpacity={0.18} speed={0.003} />

      {/* ShapeDecor 装饰 */}
      <ShapeDecor type="star"   size={60}  color={ACCENT}   opacity={0.18} x={900} y={1700} rotateSpeed={0.2} />
      <ShapeDecor type="polygon" sides={6} size={40} color="#60A5FA" opacity={0.15} x={60}  y={1700} rotateSpeed={-0.15} />

      <SceneFooter sceneIndex={0} totalScenes={1} color={ACCENT} />
    </AbsoluteFill>
  );
};

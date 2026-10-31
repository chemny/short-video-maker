import {AbsoluteFill, Img, OffthreadVideo, staticFile, useVideoConfig, useCurrentFrame, interpolate} from 'remotion';
import {Scene, VideoPlan} from '../lib/types';
import {resolveSafeArea} from '../lib/safeArea';

export const SceneResponsive = ({plan, scene}: {plan: VideoPlan; scene: Scene}) => {
 const {width,height,fps,durationInFrames}=useVideoConfig();const frame=useCurrentFrame();
 const reveal=scene.motion?.type==='none'?1:interpolate(frame,[0,12],[0.15,1],{extrapolateRight:'clamp'});
 const landscape=width>height,safe=resolveSafeArea(width,height,plan.meta.platforms),unit=Math.min(width,height);
 const hasMedia=!!scene.visual?.asset, diagram=scene.layout==='flow'&&!!scene.steps?.length, split=hasMedia||diagram;
 const position=`${(scene.visual?.focalPoint?.x??.5)*100}% ${(scene.visual?.focalPoint?.y??.5)*100}%`;
 const mediaStyle={display:'block',width:'100%',height:'100%',objectFit:scene.visual?.fit??'contain',objectPosition:position} as const;
 const body=scene.body??scene.voiceover;
 const titleScale=scene.caption.length>18||(landscape&&split&&scene.caption.length>8)?.055:.073;
 return <AbsoluteFill style={{background:plan.style.background,color:plan.style.textPrimary,fontFamily:'"PingFang SC", Inter, system-ui, sans-serif',padding:`${safe.contentTop}px ${safe.contentRight}px ${safe.contentBottom}px ${safe.contentLeft}px`}}>
  <div data-layout-role="content" data-scene-id={scene.id} data-safe-left={safe.contentLeft} data-safe-right={safe.contentRight} data-safe-top={safe.contentTop} data-safe-bottom={safe.contentBottom} style={{height:'100%',display:'flex',flexDirection:landscape&&split?'row':'column',gap:unit*.045}}>
   <div style={{flex:split?landscape?'0 0 38%':'0 0 auto':'1',minWidth:0,display:'flex',flexDirection:'column',justifyContent:'center',gap:unit*.024,opacity:reveal,transform:`translateY(${(1-reveal)*unit*.025}px)`}}>
    <div data-layout-role="topic" style={{color:plan.style.accent,fontSize:unit*.025,fontWeight:700,letterSpacing:1}}>{plan.meta.topic}</div>
    <div data-layout-role="title" style={{fontSize:unit*titleScale,lineHeight:1.15,fontWeight:850,textWrap:'balance',overflowWrap:'anywhere'}}>{scene.caption}</div>
    <div data-layout-role="body" style={{fontSize:unit*.033,lineHeight:1.5,opacity:.8,overflowWrap:'anywhere'}}>{body}</div>
    {!diagram&&scene.steps?.length?<div style={{display:'flex',flexDirection:'column',gap:unit*.018,marginTop:unit*.02}}>{scene.steps.map((text,i)=><div data-layout-role="step" key={i} style={{fontSize:unit*.034,padding:`${unit*.016}px ${unit*.023}px`,borderLeft:`${unit*.004}px solid ${plan.style.accent}`,background:'#1A2A42',borderRadius:unit*.01}}>{text}</div>)}</div>:null}
    {scene.data?.stats?.map((stat,i)=><div data-layout-role="stat" key={i} style={{fontSize:unit*.045,color:plan.style.accent}}>{stat.value}<span style={{fontSize:unit*.027,marginLeft:unit*.02}}>{stat.label}</span></div>)}
   </div>
   {diagram?<div style={{flex:1,minHeight:0,minWidth:0,display:'flex',flexDirection:'column',justifyContent:'center',gap:unit*.012}}>{scene.steps!.map((text,i)=>{
    const progress=frame/Math.max(1,durationInFrames),active=scene.motion?.type==='none'||progress>=(i/scene.steps!.length);
    return <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'stretch',gap:unit*.012}}>
     {i>0?<div style={{color:plan.style.accent,fontSize:unit*.026,lineHeight:1,textAlign:'center'}}>↓</div>:null}
     <div data-layout-role="step" style={{fontSize:unit*.038,display:'flex',alignItems:'center',gap:unit*.025,padding:`${unit*.028}px ${unit*.03}px`,border:`${Math.max(1,unit*.002)}px solid ${active?plan.style.accent:'#3A4D66'}`,borderRadius:unit*.018,background:active?'#203B49':'#17283E'}}>
      <span style={{color:plan.style.accent,fontSize:unit*.025,fontWeight:800}}>0{i+1}</span><span style={{fontSize:unit*.038,lineHeight:1.3,fontWeight:700,overflowWrap:'anywhere'}}>{text}</span>
     </div>
    </div>;
   })}</div>:null}
   {hasMedia?<div data-layout-role="media" style={{flex:1,minHeight:0,minWidth:0,borderRadius:unit*.025,overflow:'hidden',background:'#151923',position:'relative'}}>
    {scene.visual?.kind==='video'?<OffthreadVideo src={staticFile(scene.visual.asset!)} startFrom={Math.round((scene.visual.sourceStart??0)*fps)} muted={!scene.visual.sourceVolume} volume={scene.visual.sourceVolume??0} style={mediaStyle}/>:<Img src={staticFile(scene.visual!.asset!)} style={mediaStyle}/>}
    {scene.visual?.alt?<div style={{position:'absolute',left:unit*.015,top:unit*.015,right:unit*.015,padding:unit*.012,background:'rgba(10,18,30,.8)',fontSize:unit*.023,lineHeight:1.35,color:'#EAF1FB'}}>{scene.visual.alt}</div>:null}
   </div>:null}
  </div>
 </AbsoluteFill>;
};
export const ResponsiveCover=({plan}:{plan:VideoPlan})=>{
 const {width,height}=useVideoConfig(),unit=Math.min(width,height),safe=resolveSafeArea(width,height,plan.meta.platforms);
 return <AbsoluteFill style={{background:plan.style.background,color:plan.style.textPrimary,fontFamily:'"PingFang SC", Inter, system-ui, sans-serif',justifyContent:'center',padding:`${safe.contentTop}px ${safe.contentRight}px ${safe.contentBottom}px ${safe.contentLeft}px`}}>
  <div style={{fontSize:unit*.03,color:plan.style.accent,marginBottom:unit*.04}}>{plan.meta.topic}</div>
  <div data-layout-role="cover-title" style={{textWrap:'balance',overflowWrap:'anywhere',fontSize:unit*(plan.cover.title.length>12?.07:.1),lineHeight:1.15,fontWeight:850}}>{plan.cover.title}</div>
  {plan.cover.subtitle?<div style={{fontSize:unit*.034,marginTop:unit*.04}}>{plan.cover.subtitle}</div>:null}
 </AbsoluteFill>;
};

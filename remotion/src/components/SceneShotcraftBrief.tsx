import React from 'react';
import {AbsoluteFill,useVideoConfig} from 'remotion';
import {Scene,VideoPlan} from '../lib/types';
import {ListReveal} from './shotcraft-vendor/ListReveal';
import {Stage,LOOKS} from './shotcraft-vendor/_fixtures/Look';
export const SceneShotcraftBrief=({plan,scene}:{plan:VideoPlan;scene:Scene})=>{
 const {width,height,fps}=useVideoConfig();
 if(width!==1080||height!==1920||fps!==30||plan.style.componentSystem==='semantic-v1')throw Error('Shotcraft Brief candidate requires9:16/30fps/components off');
 if(scene.visual?.asset||scene.data||scene.steps&&scene.steps.length>3||scene.steps?.some(s=>[...s].length>14)||[...scene.caption].length>24||[...(scene.body??'')].length>48)throw Error('Shotcraft Brief candidate content outside reviewed scope');
 const items=(scene.steps??[]).map(label=>{const tag=scene.tags?.find(t=>typeof t==='object'&&t.text===label);return {label,key:'',at:typeof tag==='object'&&typeof tag.at==='number'?Math.max(0,tag.at-scene.start):0};});
 if(items.length)return <ListReveal items={items} title={scene.caption} kicker={scene.body??plan.meta.title} durationFrames={Math.max(1,Math.ceil((scene.end-scene.start)*fps))}/>;
 return <AbsoluteFill style={{background:'#070b15',color:'#f4f6fa',fontFamily:'"PingFang SC",sans-serif'}}><Stage look={LOOKS.midnight} intensity={.35} grain={.05}/><div data-layout-role="title" style={{position:'absolute',left:90,right:90,top:450,fontSize:76,fontWeight:750,lineHeight:1.25}}>{scene.caption}</div>{scene.body&&<div data-layout-role="body" style={{position:'absolute',left:90,right:90,top:850,fontSize:50,lineHeight:1.4,color:'#34c8df'}}>{scene.body}</div>}</AbsoluteFill>;
};

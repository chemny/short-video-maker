import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fetchPublic,validatePublicUrl} from './official-sources.mjs';
import {commandFromEnv} from './bins.mjs';
import {inspectAsset} from './media-assets.mjs';
const maxBytes=150*1024*1024;
export const resolvePlayer = async (url, request) => {
 if(request.resolvePlayer!==true)throw new Error('Embedded player requires explicit resolvePlayer:true');
 await validatePublicUrl(url,request.allowedDomains);
 let info;
 try{info=JSON.parse(execFileSync(commandFromEnv('yt-dlp'),['--ignore-config','--no-cache-dir','--no-playlist','--skip-download','--dump-single-json','--socket-timeout','20','--retries','0',url],{timeout:60000,maxBuffer:12*1024*1024,stdio:'pipe'}));}
 catch{throw new Error('Public player metadata unavailable via existing yt-dlp; no install, cookies or login attempted. See research coverage gap.');}
 const formats=(info.formats??[info]).filter(f=>f.url&&f.vcodec!=='none'&&(!f.height||f.height<=1080));
 const direct=formats.filter(f=>f.protocol==='https'||f.protocol==='http');
 const selected=(direct.length?direct:formats.filter(f=>/m3u8/.test(f.protocol??''))).sort((a,b)=>(b.height??0)-(a.height??0))[0];
 if(!selected)throw new Error('No supported public progressive/HLS video format found');
 await validatePublicUrl(selected.url,request.allowedDomains);
 return {url:selected.url,title:info.title,formatId:selected.format_id,protocol:selected.protocol,hasAudio:selected.acodec!=='none'};
};
export const parsePlaylist = (text,base) => {
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(lines[0]!=='#EXTM3U')throw new Error('Invalid HLS playlist');
 if(lines.some(s=>s.startsWith('#EXT-X-KEY:')&&!/METHOD=NONE(?:,|$)/.test(s)))throw new Error('Encrypted/DRM HLS is not supported');
 if(lines.some(s=>s.startsWith('#EXT-X-BYTERANGE')))throw new Error('Byte-range HLS is not supported');
 const variants=[];const segments=[];let duration=null;let total=0;let init=null;
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.startsWith('#EXT-X-STREAM-INF:')) {const next=lines[i+1];if(!next||next.startsWith('#'))throw new Error('Missing HLS variant URI');variants.push({url:new URL(next,base).href,height:Number(line.match(/RESOLUTION=\d+x(\d+)/)?.[1]??0)});}
  else if(line.startsWith('#EXT-X-MAP:')){const uri=line.match(/URI="([^"]+)"/)?.[1];if(!uri||/BYTERANGE=/.test(line))throw new Error('Unsupported HLS initialization segment');init=new URL(uri,base).href;}
  else if(line.startsWith('#EXTINF:')){duration=Number(line.slice(8).split(',')[0]);if(!(duration>0))throw new Error('Invalid HLS segment duration');}
  else if(!line.startsWith('#')&&duration!==null){segments.push({url:new URL(line,base).href,start:total,end:total+duration,duration,init});total+=duration;duration=null;}
 }
 if(!variants.length&&!lines.includes('#EXT-X-ENDLIST'))throw new Error('Live/incomplete HLS is not supported; select a published VOD');
 return {variants,segments,duration:total};
};
export const acquireHls = async (url,request,{fetcher=fetchPublic}={}) => {
 if(!request.clip||!Number.isFinite(request.clip.start)||request.clip.start<0||!Number.isFinite(request.clip.duration)||request.clip.duration<=0||request.clip.duration>60)throw new Error('HLS acquisition requires an explicit <=60 second clip with finite start>=0');
 let fetched,playlist;
 for(let depth=0;depth<3;depth++){
  fetched=await fetcher(url,request.allowedDomains,{maxBytes:512*1024});playlist=parsePlaylist(fetched.body.toString(),fetched.url);
  if(!playlist.variants.length)break;
  const options=playlist.variants.filter(v=>v.height<=1080).sort((a,b)=>b.height-a.height);if(!options.length)throw new Error('No HLS variant at/below 1080p');url=options[0].url;
 }
 if(playlist.variants.length)throw new Error('HLS master nesting limit reached');
 const end=request.clip.start+request.clip.duration;
 if(end>playlist.duration+.05)throw new Error('HLS selected interval exceeds source');
 const selected=playlist.segments.filter(s=>s.end>request.clip.start&&s.start<end);
 if(!selected.length||selected.length>120)throw new Error('HLS selection has no segments or exceeds limit');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'svm-hls-'));
 try{
  let bytes=0;const files=[];const inits=new Map();
  for(const [i,segment]of selected.entries()){
   let prefix=Buffer.alloc(0);
   if(segment.init){if(!inits.has(segment.init)){const response=await fetcher(segment.init,request.allowedDomains,{maxBytes:8*1024*1024});inits.set(segment.init,response.body);bytes+=response.body.length;}prefix=inits.get(segment.init);}
   const response=await fetcher(segment.url,request.allowedDomains,{maxBytes:maxBytes-bytes});bytes+=response.body.length;if(bytes>maxBytes)throw new Error('HLS acquisition size limit exceeded');
   const file=path.join(temp,`${i}.${segment.init?'mp4':'ts'}`);fs.writeFileSync(file,Buffer.concat([prefix,response.body]));files.push(file);
  }
  fs.writeFileSync(path.join(temp,'concat.txt'),files.map(f=>`file '${f}'`).join('\n'));
  const output=path.join(temp,'clip.mp4');
  execFileSync(commandFromEnv('ffmpeg'),['-v','error','-nostdin','-y','-f','concat','-safe','0','-protocol_whitelist','file,crypto,data','-i',path.join(temp,'concat.txt'),'-ss',String(request.clip.start-selected[0].start),'-t',String(request.clip.duration),'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',output],{timeout:120000,stdio:'pipe'});
  const media=inspectAsset(output);if(Math.abs(media.duration-request.clip.duration)>.15)throw new Error('HLS decoded interval does not match request');
  return {...fetched,contentType:'video/mp4',body:fs.readFileSync(output),acquisition:'validated-public-HLS-VOD-segments',segmentUrls:selected.map(s=>s.url),sourceInterval:request.clip};
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
};

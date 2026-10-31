import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {parsePlaylist,acquireHls} from '../scripts/lib/acquire-official-media.mjs';
import {visualMap} from '../scripts/lib/visual-map.mjs';
import {classifyCandidate,writeResearchCoverage} from '../scripts/lib/research-coverage.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const workspace=t=>{const p=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'svm-p0-')));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;};
test('source extraction finds lazy media, contextual VideoObject and linked players without executing JS',()=>{
 const html='<title>Source</title><h2>Feature demo</h2><img data-src="/a.png" srcset="/a-small.png 1x, /a.png 2x"><script>bad fake fact</script><script type="application/ld+json">{"@type":"VideoObject","name":"Real demo","contentUrl":"https://cdn.example.com/a.mp4","embedUrl":"https://player.example.com/id"}</script><a href="https://www.youtube.com/watch?v=123">Recap</a>';
 const r=JSON.parse(execFileSync('python3',[path.join(root,'scripts/extract-source.py'),'https://example.com/release'],{input:html}));
 assert.ok(!r.text.includes('bad fake fact'));assert.ok(!r.text.includes('VideoObject'));assert.ok(r.media.some(m=>m.tag==='video-object-contentUrl'&&m.context==='Feature demo'));
 assert.ok(r.media.some(m=>m.url==='https://example.com/a-small.png'));assert.ok(r.media.some(m=>classifyCandidate(m)==='embedded-player'));
});
test('HLS parser rejects encryption, live streams and byte ranges; finds actual intervals and master variants',()=>{
 assert.throws(()=>parsePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXT-X-ENDLIST','https://a.example/'),/Encrypted/);
 assert.throws(()=>parsePlaylist('#EXTM3U\n#EXTINF:2,\na.ts','https://a.example/'),/Live/);
 assert.throws(()=>parsePlaylist('#EXTM3U\n#EXT-X-BYTERANGE:10@0\n#EXT-X-ENDLIST','https://a.example/'),/Byte-range/);
 const r=parsePlaylist('#EXTM3U\n#EXTINF:2,\na.ts\n#EXTINF:3,\nb.ts\n#EXT-X-ENDLIST','https://a.example/path/master.m3u8');assert.equal(r.duration,5);assert.equal(r.segments[1].start,2);assert.equal(r.segments[0].url,'https://a.example/path/a.ts');
});
test('real HLS selected interval decodes locally with bounded, explicit domain-bound segment requests',async t=>{
 const dir=workspace(t);execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=s=320x180:r=24:d=4','-c:v','libx264','-g','24','-f','hls','-hls_time','1','-hls_list_size','0',path.join(dir,'vod.m3u8')]);
 const calls=[];const r=await acquireHls('https://official.example/vod.m3u8',{allowedDomains:['official.example'],clip:{start:.75,duration:2}}, {fetcher:async(url,domains,options)=>{assert.deepEqual(domains,['official.example']);const bytes=fs.readFileSync(path.join(dir,new URL(url).pathname.slice(1)));assert.ok(bytes.length<=options.maxBytes);calls.push(url);return{url,body:bytes,contentType:url.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t'};}});
 assert.equal(r.acquisition,'validated-public-HLS-VOD-segments');assert.equal(r.contentType,'video/mp4');assert.ok(r.body.length>1000);assert.ok(calls.length>=3);
 await assert.rejects(acquireHls('https://official.example/vod.m3u8',{allowedDomains:['official.example']}),/explicit/);
});
test('P0 visual map rejects missing, reused, cross-scene and falsely declared source intervals',()=>{
 const p={meta:{productionVersion:'p0-v1'},captions:[{id:'c1',text:'Demo',start:0,end:2}],scenes:[{id:'s1',start:0,end:2,captionIds:['c1'],visual:{asset:'a.mp4',kind:'video',sourceStart:3},evidence:{visualOrigin:'official'},visualBindings:[{captionIds:['c1'],kind:'official-demo',shows:'Node change',reason:'Explains the narrated feature',sourceStart:3,sourceEnd:5}]}]};
 assert.equal(visualMap(p).errors.length,0);p.scenes[0].visualBindings[0].sourceEnd=6;assert.ok(visualMap(p).errors.some(e=>e.includes('actual clip')));
 p.scenes[0].visualBindings=[];assert.ok(visualMap(p).errors.some(e=>e.includes('missing')));
});
test('coverage keeps embedded-video gaps distinct from unavailable pages and downloaded selections',t=>{
 const dir=workspace(t);fs.mkdirSync(path.join(dir,'research'));const r=writeResearchCoverage(dir,{sources:[{id:'s1',url:'https://official.example/',title:'Source',mediaCandidates:[{id:'m1',tag:'iframe',url:'https://player.example/1'}]}],failures:[{url:'https://official.example/docs',error:'403'}]});assert.equal(r.gaps[0].kind,'embedded-player');assert.equal(r.failures.length,1);assert.ok(fs.existsSync(path.join(dir,'research/coverage.md')));
});

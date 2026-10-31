#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fetchPublic} from './lib/official-sources.mjs';
import {sha256} from './lib/production-audit.mjs';
import {inspectAsset} from './lib/media-assets.mjs';
import {commandFromEnv} from './lib/bins.mjs';
import {resolvePlayer,acquireHls} from './lib/acquire-official-media.mjs';
import {classifyCandidate,writeResearchCoverage} from './lib/research-coverage.mjs';
const [jobArg, requestFile] = process.argv.slice(2);
if (!jobArg || !requestFile) throw new Error('Usage: node scripts/download-source-media.mjs <job> <reviewed-media-request.json>');
const job = fs.realpathSync(jobArg); const registry = JSON.parse(fs.readFileSync(path.join(job, 'research/sources.json')));
const requests = JSON.parse(fs.readFileSync(requestFile));
if (!Array.isArray(requests)) throw new Error('Media requests must be an array');
const reportFile = path.join(job, 'research/downloads.json');
const report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile)) : {downloads: []};
let failures=0;
for (const request of requests) {
 try {
  const source = registry.sources.find((s) => s.id === request.sourceId);
  const candidate = source?.mediaCandidates.find((m) => m.id === request.mediaId);
  if (!candidate || !request.relevanceReason || !request.rightsNote || !Array.isArray(request.allowedDomains) || !request.allowedDomains.length) throw new Error('Each selected candidate needs source/media IDs, relevanceReason, rightsNote and explicit download/CDN domains');
  if (request.clip && (!Number.isFinite(request.clip.start) || request.clip.start < 0 || !Number.isFinite(request.clip.duration) || request.clip.duration <= 0 || request.clip.duration > 60)) throw new Error('Explicit remote clip selection requires start>=0 and duration 0..60s');
  let mediaUrl=candidate.url, resolved=null;
  if(classifyCandidate(candidate)==='embedded-player'){resolved=await resolvePlayer(candidate.url,request);mediaUrl=resolved.url;}
  const hls=classifyCandidate(candidate)==='hls-playlist'||/\.m3u8(?:[?#]|$)/i.test(mediaUrl)||/m3u8/.test(resolved?.protocol??'');
  let fetched = hls ? await acquireHls(mediaUrl,request) : await fetchPublic(mediaUrl, request.allowedDomains, {maxBytes: 150 * 1024 * 1024, method: request.clip ? 'HEAD' : 'GET'});
  if (request.clip && !hls) {
    if (!/video\/(mp4|webm)/.test(fetched.contentType)) throw new Error('Remote clip selection supports direct MP4/WebM only, not HTML/embedded players/playlists');
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'short-video-official-clip-'));
    try {
      const output = path.join(temporary, 'clip.mp4');
      execFileSync(commandFromEnv('ffmpeg'), ['-hide_banner', '-v', 'error', '-nostdin', '-y', '-ss', String(request.clip.start),
        '-protocol_whitelist', 'http,https,tcp,tls', '-f', /webm/.test(fetched.contentType) ? 'matroska' : 'mov', '-i', fetched.url,
        '-t', String(request.clip.duration), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-fs', String(150 * 1024 * 1024), output], {stdio: 'pipe', timeout: 120000});
      const selected = inspectAsset(output);
      if (selected.kind !== 'video' || !Number.isFinite(selected.duration) || Math.abs(selected.duration - request.clip.duration) > 0.15) throw new Error('Remote source does not cover the selected interval or clip output hit a limit');
      fetched.body = fs.readFileSync(output); fetched.contentType = 'video/mp4';
    } finally {fs.rmSync(temporary, {recursive: true, force: true});}
  }
  const extension = /video\/mp4/.test(fetched.contentType) ? '.mp4' : /video\/webm/.test(fetched.contentType) ? '.webm' : /image\/png/.test(fetched.contentType) ? '.png' : /image\/jpeg/.test(fetched.contentType) ? '.jpg' : /image\/webp/.test(fetched.contentType) ? '.webp' : null;
  if (!extension) throw new Error(`Candidate is not a supported direct media file (${fetched.contentType}); embedded players require another authorized extraction route`);
  const relative = `assets/official/${sha256(fetched.body).slice(0, 20)}${extension}`; const target = path.join(job, relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  if (fs.existsSync(target) && sha256(fs.readFileSync(target)) !== sha256(fetched.body)) throw new Error('Existing content-addressed media was modified');
  fs.writeFileSync(target, fetched.body);
  const media = inspectAsset(target);
  report.downloads = [...report.downloads.filter((d) => !(d.sourceId === request.sourceId && d.mediaId === request.mediaId)),
    {...request, ...(resolved?{playerResolution:{title:resolved.title,formatId:resolved.formatId,hasAudio:resolved.hasAudio}}:{}), ...(fetched.acquisition?{acquisition:fetched.acquisition,segmentUrls:fetched.segmentUrls.map(value=>{const url=new URL(value);return url.origin+url.pathname;})}:{}), candidateUrl: candidate.url, sourceTextSha256: source.textSha256, sourceSnapshot: source.htmlFile,
      file: relative, finalUrl: (resolved||hls)?new URL(fetched.url).origin+new URL(fetched.url).pathname:fetched.url, fetchedAt: fetched.fetchedAt, sha256: sha256(fetched.body), kind: media.kind, width: media.width, height: media.height, duration: media.duration}];
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  report.failures=(report.failures??[]).filter(f=>f.sourceId!==request.sourceId||f.mediaId!==request.mediaId);
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Downloaded ${relative}; rightsNote is a recorded assertion, not an inferred licence`);
 }catch(error){
  failures++;
  const message=String(error.message).replace(/https?:\/\/[^\s;]+/g,value=>{try{const url=new URL(value);return url.origin+url.pathname;}catch{return '[media URL]';}});
  report.failures=[...(report.failures??[]).filter(f=>f.sourceId!==request.sourceId||f.mediaId!==request.mediaId),{sourceId:request.sourceId,mediaId:request.mediaId,checkedAt:new Date().toISOString(),message}];
  fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
  console.error(`Media ${request.mediaId}: ${message}`);
 }
}

writeResearchCoverage(job,registry);
if(failures)process.exitCode=1;

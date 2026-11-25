#!/usr/bin/env node
// Records a registered official page as a phone-width scroll video and logs it in the job's research records.
import fs from 'node:fs';
import path from 'node:path';
import {fetchPublic} from './lib/official-sources.mjs';
import {sha256} from './lib/production-audit.mjs';
import {inspectAsset} from './lib/media-assets.mjs';
import {recordScroll, defaultBrowser} from './lib/page-recorder.mjs';

const [jobArg, sourceId, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!jobArg || !sourceId || !option('reason') || !option('rights-note')) throw new Error('Usage: node scripts/record-source-page.mjs <job> <source-id> --reason=<visual-purpose> --rights-note=<reuse-note> [--seconds=6] [--from-text=<heading text>|--from-y=<px>] [--speed=<px per second, default 260>] [--browser=<Chrome executable>]');
const job = fs.realpathSync(jobArg), registryFile = path.join(job, 'research/sources.json');
const registry = JSON.parse(fs.readFileSync(registryFile)), source = registry.sources.find((s) => s.id === sourceId);
if (!source) throw new Error('Unknown primary source');
const seconds = Number(option('seconds') ?? 6), fromText = option('from-text'), fromY = Number(option('from-y') ?? 0), speed = option('speed') ? Number(option('speed')) : undefined;
const page = await fetchPublic(source.url, source.officialDomains);   // identity and reachability check only
const temporary = path.join(job, 'research', `.recording-${process.pid}.mp4`);
try {
  const result = await recordScroll({url: page.url, outFile: temporary, seconds, fromText, fromY, ...(speed ? {speed} : {}), browser: option('browser') ?? defaultBrowser()});
  const info = inspectAsset(temporary);
  if (info.kind !== 'video' || info.width !== 1080 || info.height !== 1920) throw new Error('Recording has unexpected size');
  const bytes = fs.readFileSync(temporary), hash = sha256(bytes), relative = `assets/official/recording-${hash.slice(0, 20)}.mp4`;
  fs.mkdirSync(path.dirname(path.join(job, relative)), {recursive: true});
  fs.writeFileSync(path.join(job, relative), bytes);
  const mediaId = `${source.id}-page-recording-${hash.slice(0, 12)}`;
  source.mediaCandidates.push({id: mediaId, url: page.url, tag: 'page-recording', status: 'recorded-needs-visual-review', reuseRights: 'recorded-note-not-inferred'});
  fs.writeFileSync(registryFile, `${JSON.stringify(registry, null, 2)}\n`);
  const recordFile = path.join(job, 'research/downloads.json');
  const record = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile)) : {downloads: []};
  record.downloads.push({sourceId, mediaId, file: relative, candidateUrl: page.url, finalUrl: page.url, fetchedAt: page.fetchedAt,
    sourceTextSha256: source.textSha256, sourceSnapshot: source.htmlFile, sha256: hash, kind: 'video', width: info.width, height: info.height, duration: info.duration,
    relevanceReason: option('reason'), rightsNote: option('rights-note'), acquisition: 'isolated-headless-Chrome-scroll-recording',
    review: 'look for cookie banners, popups, login walls and blank areas before selection', recording: result});
  fs.writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Recorded ${relative} (${info.duration.toFixed(1)} s, from y ${result.startY} of ${result.pageHeight} px; inspect before using as an official scene asset`);
} finally { fs.rmSync(temporary, {force: true}); }

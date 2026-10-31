#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fetchPublic} from './lib/official-sources.mjs';
import {sha256} from './lib/production-audit.mjs';
import {inspectAsset} from './lib/media-assets.mjs';
const [jobArg, sourceId, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!jobArg || !sourceId || !option('reason') || !option('rights-note')) throw new Error('Usage: node scripts/capture-source-page.mjs <job> <source-id> --reason=<visual-purpose> --rights-note=<reuse-note> [--browser=<Chrome executable>]');
const job = fs.realpathSync(jobArg); const registryFile = path.join(job, 'research/sources.json');
const registry = JSON.parse(fs.readFileSync(registryFile)); const source = registry.sources.find((s) => s.id === sourceId);
if (!source) throw new Error('Unknown primary source');
const page = await fetchPublic(source.url, source.officialDomains);
const browser = option('browser') ?? process.env.REMOTION_BROWSER_EXECUTABLE ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'short-video-source-capture-'));
try {
  const png = path.join(temporary, 'page.png');
  execFileSync(browser, ['--headless=new', '--no-first-run', '--disable-default-apps', `--user-data-dir=${path.join(temporary, 'profile')}`,
    '--window-size=1440,1000', '--virtual-time-budget=5000', '--hide-scrollbars', `--screenshot=${png}`, page.url], {stdio: 'pipe', timeout: 60000, maxBuffer: 4 * 1024 * 1024});
  const info = inspectAsset(png);
  if (info.kind !== 'image' || info.width !== 1440 || info.height !== 1000) throw new Error('Browser screenshot is missing or has unexpected size');
  const bytes = fs.readFileSync(png); const hash = sha256(bytes); const relative = `assets/official/page-${hash.slice(0, 20)}.png`;
  fs.mkdirSync(path.dirname(path.join(job, relative)), {recursive: true});
  if (fs.existsSync(path.join(job, relative)) && sha256(fs.readFileSync(path.join(job, relative))) !== hash) throw new Error('Screenshot cache was modified');
  fs.writeFileSync(path.join(job, relative), bytes);
  const mediaId = `${source.id}-page-capture-${hash.slice(0, 12)}`;
  source.mediaCandidates.push({id: mediaId, url: page.url, tag: 'page-capture', status: 'captured-needs-visual-review', reuseRights: 'recorded-note-not-inferred'});
  fs.writeFileSync(registryFile, `${JSON.stringify(registry, null, 2)}\n`);
  const recordFile = path.join(job, 'research/downloads.json');
  const record = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile)) : {downloads: []};
  record.downloads.push({sourceId, mediaId, file: relative, candidateUrl: page.url, finalUrl: page.url, fetchedAt: page.fetchedAt,
    sourceTextSha256: source.textSha256, sourceSnapshot: source.htmlFile, sha256: hash, kind: 'image', width: info.width, height: info.height,
    relevanceReason: option('reason'), rightsNote: option('rights-note'), acquisition: 'isolated-headless-Chrome-screenshot', review: 'check for error/login/blank pages and relevance before selection'});
  fs.writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Captured ${relative}; inspect before using as an official scene asset`);
} finally {fs.rmSync(temporary, {recursive: true, force: true});}

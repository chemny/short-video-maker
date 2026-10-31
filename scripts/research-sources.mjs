#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {fetchPublic} from './lib/official-sources.mjs';
import {sha256} from './lib/production-audit.mjs';
import {writeResearchCoverage} from './lib/research-coverage.mjs';
const [jobArg, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const urls = args.filter((v) => v.startsWith('--url=')).map((v) => v.slice(6));
const domains = option('official-domains')?.split(',').map((d) => d.trim()).filter(Boolean);
if (!jobArg || !urls.length || !domains?.length) throw new Error('Usage: node scripts/research-sources.mjs <job> --official-domains=example.com --url=https://example.com/page [--url=...]');
const job = fs.realpathSync(jobArg); const folder = path.join(job, 'research'); fs.mkdirSync(folder, {recursive: true});
const registryFile = path.join(folder, 'sources.json');
const registry = fs.existsSync(registryFile) ? JSON.parse(fs.readFileSync(registryFile)) : {schemaVersion: 1, sources: [], failures: []};
let failures = 0;
const follow = option('follow') === 'true';
const limit = Number(option('max-pages') ?? (follow ? 6 : urls.length));
if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('max-pages must be 1..20');
const queue = [...new Set(urls)], visited = new Set();
for (let cursor = 0; cursor < queue.length && visited.size < limit; cursor++) {
  const url = queue[cursor]; if(visited.has(url))continue;visited.add(url);
  try {
    const result = await fetchPublic(url, domains);
    if (!/text\/html|application\/xhtml\+xml/.test(result.contentType)) throw new Error('Expected an HTML primary-source page; record PDF/API sources through a reviewed external extractor');
    const extracted = JSON.parse(execFileSync(process.env.PYTHON3_BIN ?? 'python3', [fileURLToPath(new URL('./extract-source.py', import.meta.url)), result.url], {input: result.body, maxBuffer: 4 * 1024 * 1024, timeout: 30000}).toString());
    if (extracted.text.length < 80) throw new Error('Page contains too little readable text; use browser extraction and record the limitation');
    const id = `source-${sha256(result.url).slice(0, 12)}`;
    const revision = sha256(result.body).slice(0, 16);
    const prefix = path.join(folder, `${id}-${revision}`);
    fs.writeFileSync(`${prefix}.html`, result.body); fs.writeFileSync(`${prefix}.txt`, extracted.text);
    const media = [...new Map(extracted.media.filter((m) => /^https?:/.test(m.url)).map((m) => [m.url, m])).values()];
    const source = {id, requestedUrl: url, url: result.url, officialDomains: domains, fetchedAt: result.fetchedAt, title: extracted.title,
      htmlFile: path.relative(job, `${prefix}.html`), textFile: path.relative(job, `${prefix}.txt`), textSha256: sha256(extracted.text),
      mediaCandidates: media.map((m, i) => ({id: `${id}-media-${i + 1}`, ...m, status: 'candidate-not-downloaded', reuseRights: 'unreviewed'})),
      relatedLinks: extracted.links.filter((value) => {try {return domains.some((d) => new URL(value).hostname === d || new URL(value).hostname.endsWith(`.${d}`));} catch {return false;}}).slice(0, 80)};
    if(follow)for(const link of source.relatedLinks)if(/docs|release|features|demo|video|press|download|manual|media/i.test(link)&&!visited.has(link)&&!queue.includes(link))queue.push(link);
    registry.sources = [...registry.sources.filter((s) => s.id !== id), source];
    registry.failures = registry.failures.filter((f) => f.url !== url);
    console.log(`${id}: ${source.title}; ${media.length} media candidate(s)`);
  } catch (error) {failures++; registry.failures.push({url, error: error.message, checkedAt: new Date().toISOString()}); console.error(`${url}: ${error.message}`);}
}
fs.writeFileSync(registryFile, `${JSON.stringify(registry, null, 2)}\n`);
registry.crawl={requestedSeeds:urls,visited:[...visited],queuedButNotInspected:queue.filter(url=>!visited.has(url)),maxPages:limit,follow};
fs.writeFileSync(registryFile, `${JSON.stringify(registry, null, 2)}\n`);
writeResearchCoverage(job, registry);
console.log(`Inspected ${visited.size} page(s); see research/coverage.md for candidates, failures and unresolved official media.`);
if (failures) process.exit(1);

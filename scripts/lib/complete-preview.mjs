import {renderSource,rendererIdentity} from './render-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolveRemotionBin} from './bins.mjs';
import {runCommand} from './process.mjs';
import {finalizeAudio} from './audio-export.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const previewScale = plan => (plan.meta.productionWorkflow==='reviewed-v1'?[.5,1]:[.25,.5,1]).find(scale => [plan.meta.width, plan.meta.height].every(n => Number.isInteger(n * scale) && (n * scale) % 2 === 0)) ?? 1;
const files = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
export const previewIdentity = (plan, job) => {
  const media = new Map();
  const visit = value => {
    if (typeof value === 'string' && !path.isAbsolute(value) && !value.includes('://')) {
      const file = path.resolve(job, value);
      if (file.startsWith(`${path.resolve(job)}${path.sep}`) && fs.existsSync(file) && fs.statSync(file).isFile()) media.set(value, hash(fs.readFileSync(file)));
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(plan);
  for(const name of ['sentence-storyboard.json','baseline.json','script.md','approved-script.md','narrative-brief.json']){const f=path.join(job,name);if(fs.existsSync(f))media.set(name,hash(fs.readFileSync(f)));}
  const source=renderSource(plan,job);
  const renderer = [...files(path.join(root, 'remotion/src')), ...(source.kind==='authored-remotion'?files(path.dirname(source.entry)):[]), path.join(root, 'remotion/package-lock.json'), fileURLToPath(import.meta.url), path.join(root, 'scripts/lib/audio-export.mjs'),path.join(root,'scripts/lib/render-source.mjs'),path.join(root,'scripts/lib/director.mjs'),path.join(root,'components/emphasis.mjs')]
    .filter(f => fs.existsSync(f)).sort().map(f => [path.relative(root, f), hash(fs.readFileSync(f))]);
  return hash(JSON.stringify({schema: 2, scale: previewScale(plan), plan, media: [...media].sort(), renderer}));
};

export const completePreview = planPath => {
  const plan = JSON.parse(fs.readFileSync(planPath)), job = path.dirname(planPath);
  const scale = previewScale(plan);const source=renderSource(plan,job);
  const identity = previewIdentity(plan, job), output = path.join(job, 'preview/complete', identity.slice(0, 24));
  fs.mkdirSync(output, {recursive: true});
  const video = path.join(output, 'video.mp4'), reportFile = path.join(output, 'preview-report.json');
  if (fs.existsSync(video) && fs.existsSync(reportFile)) {
    const report = JSON.parse(fs.readFileSync(reportFile));
    if (report.status === 'rendered' && report.identity === identity && report.videoSha256 === hash(fs.readFileSync(video))) {
      fs.writeFileSync(path.join(job, 'preview/complete/latest.json'), `${JSON.stringify({identity, video: path.relative(job, video)}, null, 2)}\n`);
      return {...report, reused: true, video};
    }
  }
  const props = path.join(output, 'render-props.json');
  fs.writeFileSync(props, JSON.stringify({plan}));
  // Studio's static fallback is required by the source import even with CLI props.
  const fallback = path.join(root, 'remotion/public/video-plan.json');
  fs.mkdirSync(path.dirname(fallback), {recursive: true});
  if (source.kind==='template' && !fs.existsSync(fallback)) fs.copyFileSync(planPath, fallback, fs.constants.COPYFILE_EXCL);
  const args = ['render', source.entry, source.composition, video, '--codec=h264', '--audio-codec=aac', `--scale=${scale}`, '--crf=30', '--concurrency=4', `--props=${props}`, `--public-dir=${job}`];
  if (process.env.REMOTION_BROWSER_EXECUTABLE) args.push(`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`);
  runCommand(resolveRemotionBin(path.join(root, 'remotion')), args, {cwd: source.cwd, label: 'complete low-resolution preview', timeoutMs: 1800000});
  const audio = finalizeAudio(planPath, output);
  if (previewIdentity(JSON.parse(fs.readFileSync(planPath)), job) !== identity) throw new Error('Plan/assets changed during preview; no successful cache evidence written');
  const report = {schemaVersion: 1, status: 'rendered', identity, scale, fps: plan.meta.fps,
    durationSeconds: plan.meta.durationSeconds,renderer:rendererIdentity(plan,job), videoSha256: hash(fs.readFileSync(video)), audioVerification: audio?.verification ?? null,
    editorialStatus: 'review-required', limits: 'Complete timing/audio preview; low resolution cannot approve final typography or replace human listening.'};
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(job, 'preview/complete/latest.json'), `${JSON.stringify({identity, video: path.relative(job, video)}, null, 2)}\n`);
  return {...report, reused: false, video};
};

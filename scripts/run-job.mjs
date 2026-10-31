#!/usr/bin/env node
import {compileDirectorFile} from './lib/director.mjs';
import {renderSource,rendererIdentity} from './lib/render-source.mjs';
import {needsPreviewReview,inspectPreviewReview} from './lib/preview-review.mjs';
import {compileComponents} from './lib/component-planning.mjs';
import fs from 'node:fs';
import path from 'node:path';
import './tts/load-env.mjs';
import {resolveRemotionBin} from './lib/bins.mjs';
import {skillRootFrom} from './lib/paths.mjs';
import {envMilliseconds, runCommand} from './lib/process.mjs';
import {prepareAudio} from './lib/audio-processing.mjs';
import {finalizeAudio} from './lib/audio-export.mjs';
import {completePreview} from './lib/complete-preview.mjs';
import {selectRenderEngine} from './lib/render-engine.mjs';
import {runHyperframesJob, hyperframesBin} from './lib/hyperframes-render.mjs';
import {selectProvider} from './tts/select-provider.mjs';
import {repairAcousticTiming} from './lib/acoustic-timing.mjs';

const args = process.argv.slice(2);
const jobDirArg = args[0];
const explicitTts = args.find((arg) => arg.startsWith('--tts='))?.split('=')[1];
const previewVideo = args.includes('--preview-video');
const shouldRender = args.includes('--render');
const confirmedRender = args.includes('--confirmed-render');
const fastMode = args.includes('--fast');
const skipTtsIfExists = fastMode || args.includes('--skip-tts-if-exists');
const ttsConcurrencyArg = args.find((arg) => arg.startsWith('--tts-concurrency='))?.replace('--tts-', '--');
const previewFrameArg = args.find((arg) => arg.startsWith('--preview-frame='))?.split('=')[1];
const previewFrame = previewFrameArg === undefined ? undefined : Number(previewFrameArg);

if (!jobDirArg) {
  console.error(
    'Usage: node scripts/run-job.mjs <job-dir> [--engine=remotion|hyperframes] [--align] [--asr-model=<local.pt>] [--preview-video] [--storyboard] [--require-content-review] [--fast] [--skip-tts-if-exists] [--tts-concurrency=2] [--tts=auto|voxcpm2|edge|volcengine|http|local|none] [--preview-frame=0] [--render --confirmed-render]',
  );
  process.exit(2);
}

if (fastMode && shouldRender) {
  console.error('--fast is for preview/package iteration and does not run full render. Remove --fast to render video.');
  process.exit(2);
}

if (shouldRender && !confirmedRender) {
  console.error('Rendering is gated. Re-run with --render --confirmed-render after the user approves rendering.');
  process.exit(2);
}

if (previewFrame !== undefined && (!Number.isInteger(previewFrame) || previewFrame < 0)) {
  console.error('--preview-frame must be a non-negative integer frame number.');
  process.exit(2);
}

const skillRoot = skillRootFrom(import.meta.url, '..');
const jobDir = path.resolve(jobDirArg);
const remotionDir = path.join(skillRoot, 'remotion');
const planPath = path.join(jobDir, 'video-plan.json');
const outputDir = path.join(jobDir, 'output');
const componentMode=args.find(arg=>arg.startsWith('--components='))?.slice(13);
if(componentMode&&!['auto','off'].includes(componentMode))throw new Error('--components must be auto or off');
let initialPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const briefFile=path.join(jobDir,'production-brief.json');
if(fs.existsSync(briefFile)){const brief=JSON.parse(fs.readFileSync(briefFile));if(brief.productionWorkflow==='reviewed-v1'){initialPlan.meta.productionWorkflow='reviewed-v1';initialPlan.style.layoutReadability='phone-v1';if(brief.directorRequired&&initialPlan.meta.directorVersion!=='director-v1')throw Error('This new brief requires explicit director-v1 decisions before production');fs.writeFileSync(planPath,JSON.stringify(initialPlan,null,2)+'\n');}}
if(fs.existsSync(briefFile)&&JSON.parse(fs.readFileSync(briefFile)).editorialWorkflow==='sentence-v1'&&initialPlan.meta.editorialWorkflow!=='sentence-v1'){initialPlan.meta.editorialWorkflow='sentence-v1';fs.writeFileSync(planPath,JSON.stringify(initialPlan,null,2)+'\n');}
if(!componentMode&&initialPlan.style.componentSystem===undefined&&fs.existsSync(briefFile)){const defaults=JSON.parse(fs.readFileSync(briefFile)).renderDefaults;if(defaults?.componentSystem==='semantic-v1'&&initialPlan.style.template===defaults.template){initialPlan.style.componentSystem='semantic-v1';fs.writeFileSync(planPath,JSON.stringify(initialPlan,null,2)+'\n');}}
if(componentMode){initialPlan.style.componentSystem=componentMode==='auto'?'semantic-v1':'off';fs.writeFileSync(planPath,JSON.stringify(initialPlan,null,2)+'\n');}
const engine = selectRenderEngine({explicit: args.find(arg => arg.startsWith('--engine='))?.slice(9), plan: initialPlan});
// Persist an explicit engine choice for a semantic job so compilation and delivery metadata agree.
if(initialPlan.style.componentSystem==='semantic-v1'&&args.some(a=>a.startsWith('--engine='))&&initialPlan.meta.renderEngine!==engine){initialPlan.meta.renderEngine=engine;fs.writeFileSync(planPath,JSON.stringify(initialPlan,null,2)+'\n');}
console.log(`Render engine: ${engine}`);
if(initialPlan.meta.productionWorkflow==='reviewed-v1'&&engine!=='remotion')throw Error('reviewed-v1 currently supports Remotion; do not bypass its review with another engine');
if(engine!=='remotion'&&initialPlan.style.componentSystem==='semantic-v1')throw new Error('Semantic components require Remotion; use --components=off for Hyperframes');
if (engine === 'hyperframes' && !fs.existsSync(hyperframesBin())) throw new Error('Optional Hyperframes runtime missing: npm ci --prefix hyperframes. No renderer fallback.');
const imported = initialPlan.audio?.sourceMode === 'imported';
const selection = selectProvider({explicit: explicitTts, plan: initialPlan});
const ttsArg = selection.provider;
console.log(`TTS selection: ${ttsArg} (${selection.source}${selection.reason ? `; ${selection.reason}` : ''})`);
// An explicit storyboard hold must survive re-synthesis/ASR retiming.
if (!imported && ['voxcpm2','edge','volcengine','local'].includes(ttsArg)) {
  let changed = false;
  for (const scene of initialPlan.scenes) if (scene.preservePauses === true && scene.minimumDurationSeconds === undefined) {
    scene.minimumDurationSeconds = scene.end - scene.start; changed = true;
  }
  if (changed) fs.writeFileSync(planPath, `${JSON.stringify(initialPlan, null, 2)}\n`);
}

const run = (command, args, cwd = skillRoot, options = {}) =>
  runCommand(command, args, {
    cwd,
    label: options.label,
    timeoutMs: options.timeoutMs ?? envMilliseconds('SHORT_VIDEO_STEP_TIMEOUT_MS', 180000),
  });

run('node', [path.join(skillRoot, 'scripts/validate-plan.mjs'), planPath], skillRoot, {label: 'validate plan'});
run('node', [path.join(skillRoot, 'scripts/audit-timing.mjs'), planPath], skillRoot, {label: 'audit timing'});

if (['voxcpm2', 'edge', 'volcengine', 'local'].includes(ttsArg)) {
  const optionNames = ['voice', 'voice-preset', 'rate', 'speed', 'loudness', 'model', 'cluster', 'seed', 'steps', 'asr-model', 'asr-transcript'];
  const forwarded = args.filter((arg) => optionNames.some((name) => arg.startsWith(`--${name}=`)));
  run('node', [path.join(skillRoot, 'scripts/tts.mjs'), 'generate', planPath, `--provider=${selection.source === 'auto' ? 'auto' : ttsArg}`,
    ...forwarded, ...(ttsConcurrencyArg ? [ttsConcurrencyArg] : []), ...(args.includes('--align') ? ['--force-asr'] : [])], skillRoot,
    {label: `${ttsArg} and required caption alignment`, timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000)});
} else if (ttsArg === 'http') {
  run('node', [path.join(skillRoot, 'scripts/tts.mjs'), 'generate', planPath, '--provider=http',
    ...(skipTtsIfExists ? ['--skip-if-exists'] : []),
  ], skillRoot, {label: 'http tts', timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000)});
} else if (ttsArg !== 'none') {
  console.error(`Unknown TTS provider: ${ttsArg}`);
  process.exit(2);
}

if (args.includes('--align') && !['voxcpm2', 'edge', 'volcengine', 'local'].includes(ttsArg)) {
  const model = args.find((v) => v.startsWith('--asr-model='))?.slice('--asr-model='.length);
  run('node', [path.join(skillRoot, 'scripts/align-narration.mjs'), planPath, '--apply', ...(model ? [`--model=${model}`] : [])], skillRoot, {label: 'align approved narration', timeoutMs: envMilliseconds('SHORT_VIDEO_ASR_TIMEOUT_MS', 900000)});
}
if (JSON.parse(fs.readFileSync(planPath, 'utf8')).audio?.voiceover) {
  const acoustic = await repairAcousticTiming(planPath, {allowResynthesis: explicitTts !== 'none'});
  console.log(`Default acoustic timing: ${acoustic.state}; onsets=${acoustic.changes?.captionOnsets.length ?? 0}, pauses=${acoustic.changes?.pauseCuts.length ?? 0}, phrases=${acoustic.changes?.phraseRepairs.length ?? 0}`);
  prepareAudio(planPath);
}
if (JSON.parse(fs.readFileSync(planPath, 'utf8')).audio?.voiceover) {
  const current = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  current.audio.exportPipeline = 'pcm-master-v1';
  fs.writeFileSync(planPath, `${JSON.stringify(current, null, 2)}\n`);
}
const director=compileDirectorFile(planPath);console.log(`Director: ${director.status}`);
const source=renderSource(JSON.parse(fs.readFileSync(planPath)),jobDir);
const components=compileComponents(planPath);
console.log(`Component plan: ${components.status}; ${components.rows.length} scenes`);
run('node', [path.join(skillRoot, 'scripts/validate-plan.mjs'), planPath], skillRoot, {label: 'validate plan after tts'});
run('node', [path.join(skillRoot, 'scripts/audit-timing.mjs'), planPath], skillRoot, {label: 'audit timing after tts'});
run('node', [path.join(skillRoot, 'scripts/map-visuals.mjs'), planPath], skillRoot, {label: 'narration and visual map'});
run('node', [path.join(skillRoot, 'scripts/audit-production.mjs'), planPath], skillRoot, {label: 'production evidence and clip audit'});
if (engine === 'hyperframes') {
  runHyperframesJob({planPath, preview: previewVideo, render: shouldRender, previewFrame, requireReview: args.includes('--require-content-review')});
  process.exit(0);
}
if((previewVideo||shouldRender)&&(initialPlan.style.componentSystem==='semantic-v1'||initialPlan.meta.productionWorkflow==='reviewed-v1'))run('node',[path.join(skillRoot,'scripts/check-layout.mjs'),planPath],skillRoot,{label:'measured component layout',timeoutMs:1200000});
if (previewVideo || shouldRender) {
  const preview = completePreview(planPath);
  console.log(`Complete preview: ${preview.video} (reused: ${preview.reused}; editorial review required)`);
  const review=inspectPreviewReview(jobDir,preview);
  fs.writeFileSync(path.join(jobDir,'workflow-status.json'),JSON.stringify({schemaVersion:1,stage:'complete-preview',renderer:rendererIdentity(JSON.parse(fs.readFileSync(planPath)),jobDir),preview:{identity:preview.identity,video:preview.video,videoSha256:preview.videoSha256},review,hdRendered:false},null,2)+'\n');
  if(shouldRender && needsPreviewReview(initialPlan) && review.status!=='reviewed'){console.log('Complete preview ready; bound visual/listening review required before HD. Existing deliveries retained.');process.exit(0);}
  // Preview-only runs retain the existing HD delivery intact.
  if (!shouldRender) process.exit(0);
}
// Preserve prior deliveries; a preview run must never present an earlier video as a new render.
if (fs.existsSync(outputDir)) {
  const history = path.join(jobDir, 'history');
  fs.mkdirSync(history, {recursive: true});
  fs.renameSync(outputDir, path.join(history, `output-${Date.now()}-${process.pid}`));
}
run('node', [path.join(skillRoot, 'scripts/package-output.mjs'), planPath, outputDir], skillRoot, {label: 'package output'});
fs.writeFileSync(path.join(outputDir, 'delivery-status.json'), JSON.stringify({status: 'prepared', rendered: false}));
const propsPath = path.join(outputDir, 'render-props.json');
fs.writeFileSync(propsPath, JSON.stringify({plan: JSON.parse(fs.readFileSync(planPath, 'utf8'))}));
const renderArgs = [`--props=${propsPath}`, `--public-dir=${jobDir}`];
if (process.env.REMOTION_BROWSER_EXECUTABLE) renderArgs.push(`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`);

if (previewFrame !== undefined || shouldRender) {
  const remotionBin = resolveRemotionBin(remotionDir);

  if (!fs.existsSync(remotionBin)) {
    console.error(`Remotion dependencies are not installed in ${remotionDir}`);
    console.error('Run npm install in the remotion directory, or render manually with an available Remotion CLI.');
    process.exit(1);
  }

  // Legacy Studio imports this ignored fallback. CLI props supply this job's actual plan.
  const fallback = path.join(remotionDir, 'public', 'video-plan.json');
  fs.mkdirSync(path.dirname(fallback), {recursive: true});
  if (!fs.existsSync(fallback)) fs.copyFileSync(planPath, fallback, fs.constants.COPYFILE_EXCL);
}

if (previewFrame !== undefined) {
  const remotionBin = resolveRemotionBin(remotionDir);
  run(
    remotionBin,
    [
      'still',
      source.entry,
      source.composition,
      path.join(outputDir, 'first-frame.png'),
      '--frame',
      String(previewFrame),
      ...renderArgs,
      ...(fastMode ? ['--scale=0.5'] : []),
    ],
    source.cwd,
    {label: 'remotion preview still', timeoutMs: envMilliseconds('SHORT_VIDEO_PREVIEW_TIMEOUT_MS', 300000)},
  );
}

if (shouldRender) {
  if (initialPlan.meta.productionVersion === 'p0-v1' && initialPlan.style.componentSystem!=='semantic-v1' && initialPlan.meta.productionWorkflow!=='reviewed-v1') run('node', [path.join(skillRoot, 'scripts/check-layout.mjs'), planPath], skillRoot, {label: 'measured scene/caption layout', timeoutMs: 1200000});
  if ((initialPlan.meta.productionMode === 'researched' && initialPlan.meta.productionVersion !== 'p0-v1') || args.includes('--storyboard')) {
    run('node', [path.join(skillRoot, 'scripts/preview-storyboard.mjs'), planPath, '--safe-area'], skillRoot, {label: 'storyboard and safe-area previews', timeoutMs: 1200000});
  }
  const remotionBin = resolveRemotionBin(remotionDir);
  run(remotionBin, ['still', source.entry, source.cover, path.join(outputDir, 'cover.png'), '--frame=0', ...renderArgs], source.cwd, {
    label: 'remotion cover still',
    timeoutMs: envMilliseconds('SHORT_VIDEO_PREVIEW_TIMEOUT_MS', 300000),
  });
  run(
    remotionBin,
    ['render', source.entry, source.composition, path.join(outputDir, 'video.mp4'), '--codec=h264', '--audio-codec=aac', ...renderArgs],
    source.cwd,
    {label: 'remotion render', timeoutMs: envMilliseconds('SHORT_VIDEO_RENDER_TIMEOUT_MS', 1800000)},
  );
  finalizeAudio(planPath, outputDir);
  const state=JSON.parse(fs.readFileSync(path.join(jobDir,'workflow-status.json')));state.stage='hd-rendered';state.hdRendered=true;fs.writeFileSync(path.join(jobDir,'workflow-status.json'),JSON.stringify(state,null,2)+'\n');
  if (fs.existsSync(path.join(jobDir,'layout-report.json'))) fs.copyFileSync(path.join(jobDir,'layout-report.json'),path.join(outputDir,'layout-report.json'));
}

run('node', [path.join(skillRoot, 'scripts/quality-check.mjs'), planPath, outputDir, ...(shouldRender ? ['--require-render'] : []), ...(args.includes('--require-content-review') ? ['--require-content-review'] : [])], skillRoot, {
  label: 'quality check',
});
const quality = JSON.parse(fs.readFileSync(path.join(outputDir, 'quality-report.json')));
fs.writeFileSync(path.join(outputDir, 'delivery-status.json'), `${JSON.stringify({status: shouldRender ? 'rendered' : 'prepared', rendered: shouldRender, contentReview: quality.production?.checks?.editorial?.status ?? 'review-required'}, null, 2)}\n`);

console.log(`${shouldRender ? 'Rendered' : 'Prepared (no new video rendered)'}: ${outputDir}`);

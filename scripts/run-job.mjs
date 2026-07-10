#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {envMilliseconds, runCommand} from './lib/process.mjs';

const args = process.argv.slice(2);
const jobDirArg = args[0];
const ttsArg = args.find((arg) => arg.startsWith('--tts='))?.split('=')[1] ?? 'edge';
const shouldRender = args.includes('--render');
const confirmedRender = args.includes('--confirmed-render');
const fastMode = args.includes('--fast');
const skipTtsIfExists = fastMode || args.includes('--skip-tts-if-exists');
const ttsConcurrencyArg = args.find((arg) => arg.startsWith('--tts-concurrency='))?.replace('--tts-', '--');
const previewFrameArg = args.find((arg) => arg.startsWith('--preview-frame='))?.split('=')[1];
const previewFrame = previewFrameArg === undefined ? undefined : Number(previewFrameArg);

if (!jobDirArg) {
  console.error(
    'Usage: node scripts/run-job.mjs <job-dir> [--fast] [--skip-tts-if-exists] [--tts-concurrency=2] [--tts=edge|volcengine|local|none] [--preview-frame=0] [--render --confirmed-render]',
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

const skillRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const jobDir = path.resolve(jobDirArg);
const remotionDir = path.join(skillRoot, 'remotion');
const remotionPublic = path.join(remotionDir, 'public');
const planPath = path.join(remotionPublic, 'video-plan.json');
const outputDir = path.join(remotionPublic, 'output');
const syncJobArtifacts = () => {
  fs.copyFileSync(planPath, path.join(jobDir, 'video-plan.json'));

  for (const dirName of ['audio', 'captions']) {
    const sourceDir = path.join(remotionPublic, dirName);
    const targetDir = path.join(jobDir, dirName);
    if (fs.existsSync(sourceDir)) {
      fs.rmSync(targetDir, {recursive: true, force: true});
      fs.cpSync(sourceDir, targetDir, {recursive: true});
    }
  }

  if (fs.existsSync(outputDir)) {
    const targetOutput = path.join(jobDir, 'output');
    fs.rmSync(targetOutput, {recursive: true, force: true});
    fs.cpSync(outputDir, targetOutput, {recursive: true});
  }
};

const run = (command, args, cwd = skillRoot, options = {}) =>
  runCommand(command, args, {
    cwd,
    label: options.label,
    timeoutMs: options.timeoutMs ?? envMilliseconds('SHORT_VIDEO_STEP_TIMEOUT_MS', 180000),
  });

run('node', [path.join(skillRoot, 'scripts/install-job-plan.mjs'), jobDir], skillRoot, {label: 'install job plan'});
run('node', [path.join(skillRoot, 'scripts/validate-plan.mjs'), planPath], skillRoot, {label: 'validate plan'});
run('node', [path.join(skillRoot, 'scripts/audit-timing.mjs'), planPath], skillRoot, {label: 'audit timing'});

if (ttsArg === 'edge') {
  run('node', [
    path.join(skillRoot, 'scripts/sync-edge-tts.mjs'),
    planPath,
    ...(ttsConcurrencyArg ? [ttsConcurrencyArg] : []),
    ...(skipTtsIfExists ? ['--skip-if-exists'] : []),
  ], skillRoot, {
    label: 'edge tts',
    timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000),
  });
} else if (ttsArg === 'volcengine') {
  run('node', [
    path.join(skillRoot, 'scripts/sync-volcengine-tts.mjs'),
    planPath,
    ...(ttsConcurrencyArg ? [ttsConcurrencyArg] : []),
    ...(skipTtsIfExists ? ['--skip-if-exists'] : []),
  ], skillRoot, {
    label: 'volcengine tts',
    timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000),
  });
} else if (ttsArg === 'local') {
  run('node', [
    path.join(skillRoot, 'scripts/sync-local-audio.mjs'),
    planPath,
    ...(skipTtsIfExists ? ['--skip-if-exists'] : []),
  ], skillRoot, {
    label: 'local tts',
    timeoutMs: envMilliseconds('SHORT_VIDEO_TTS_TIMEOUT_MS', 900000),
  });
} else if (ttsArg !== 'none') {
  console.error(`Unknown TTS provider: ${ttsArg}`);
  process.exit(2);
}

run('node', [path.join(skillRoot, 'scripts/validate-plan.mjs'), planPath], skillRoot, {label: 'validate plan after tts'});
run('node', [path.join(skillRoot, 'scripts/audit-timing.mjs'), planPath], skillRoot, {label: 'audit timing after tts'});
syncJobArtifacts();
run('node', [path.join(skillRoot, 'scripts/package-output.mjs'), planPath, 'output'], skillRoot, {label: 'package output'});

if (previewFrame !== undefined || shouldRender) {
  const remotionBin = path.join(remotionDir, 'node_modules', '.bin', 'remotion');

  if (!fs.existsSync(remotionBin)) {
    console.error(`Remotion dependencies are not installed in ${remotionDir}`);
    console.error('Run npm install in the remotion directory, or render manually with an available Remotion CLI.');
    process.exit(1);
  }

  fs.mkdirSync(path.join(remotionDir, 'out'), {recursive: true});
}

if (previewFrame !== undefined) {
  const remotionBin = path.join(remotionDir, 'node_modules', '.bin', 'remotion');
  run(
    remotionBin,
    [
      'still',
      'src/index.ts',
      'ShortVideo',
      'out/first-frame.png',
      '--frame',
      String(previewFrame),
      ...(fastMode ? ['--scale=0.5'] : []),
    ],
    remotionDir,
    {label: 'remotion preview still', timeoutMs: envMilliseconds('SHORT_VIDEO_PREVIEW_TIMEOUT_MS', 300000)},
  );
  fs.copyFileSync(path.join(remotionDir, 'out', 'first-frame.png'), path.join(outputDir, 'first-frame.png'));
}

if (shouldRender) {
  const remotionBin = path.join(remotionDir, 'node_modules', '.bin', 'remotion');
  run(remotionBin, ['still', 'src/index.ts', 'CoverStill', 'out/cover.png', '--frame=0'], remotionDir, {
    label: 'remotion cover still',
    timeoutMs: envMilliseconds('SHORT_VIDEO_PREVIEW_TIMEOUT_MS', 300000),
  });
  run(
    remotionBin,
    ['render', 'src/index.ts', 'ShortVideo', 'out/video.mp4', '--codec=h264', '--audio-codec=aac'],
    remotionDir,
    {label: 'remotion render', timeoutMs: envMilliseconds('SHORT_VIDEO_RENDER_TIMEOUT_MS', 1800000)},
  );
  fs.copyFileSync(path.join(remotionDir, 'out', 'cover.png'), path.join(outputDir, 'cover.png'));
  fs.copyFileSync(path.join(remotionDir, 'out', 'video.mp4'), path.join(outputDir, 'video.mp4'));
}

run('node', [path.join(skillRoot, 'scripts/quality-check.mjs'), planPath, 'output'], skillRoot, {
  label: 'quality check',
});
syncJobArtifacts();

console.log(`Done: ${outputDir}`);
console.log(`Synced job output: ${path.join(jobDir, 'output')}`);

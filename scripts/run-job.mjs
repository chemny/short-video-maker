#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const jobDirArg = args[0];
const ttsArg = args.find((arg) => arg.startsWith('--tts='))?.split('=')[1] ?? 'edge';
const shouldRender = args.includes('--render');
const confirmedRender = args.includes('--confirmed-render');
const previewFrameArg = args.find((arg) => arg.startsWith('--preview-frame='))?.split('=')[1];
const previewFrame = previewFrameArg === undefined ? undefined : Number(previewFrameArg);

if (!jobDirArg) {
  console.error(
    'Usage: node scripts/run-job.mjs <job-dir> [--tts=edge|volcengine|local|none] [--preview-frame=0] [--render --confirmed-render]',
  );
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

const run = (command, args, cwd = skillRoot) => {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, {cwd, stdio: 'inherit'});
};

run('node', [path.join(skillRoot, 'scripts/install-job-plan.mjs'), jobDir]);
run('node', [path.join(skillRoot, 'scripts/validate-plan.mjs'), planPath]);

if (ttsArg === 'edge') {
  run('node', [path.join(skillRoot, 'scripts/sync-edge-tts.mjs'), planPath]);
} else if (ttsArg === 'volcengine') {
  run('node', [path.join(skillRoot, 'scripts/sync-volcengine-tts.mjs'), planPath]);
} else if (ttsArg === 'local') {
  run('node', [path.join(skillRoot, 'scripts/sync-local-audio.mjs'), planPath]);
} else if (ttsArg !== 'none') {
  console.error(`Unknown TTS provider: ${ttsArg}`);
  process.exit(2);
}

run('node', [path.join(skillRoot, 'scripts/validate-plan.mjs'), planPath]);
run('node', [path.join(skillRoot, 'scripts/package-output.mjs'), planPath, 'output']);

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
    ['still', 'src/index.ts', 'ShortVideo', 'out/first-frame.png', '--frame', String(previewFrame)],
    remotionDir,
  );
  fs.copyFileSync(path.join(remotionDir, 'out', 'first-frame.png'), path.join(outputDir, 'first-frame.png'));
}

if (shouldRender) {
  const remotionBin = path.join(remotionDir, 'node_modules', '.bin', 'remotion');
  run(remotionBin, ['still', 'src/index.ts', 'CoverStill', 'out/cover.png', '--frame=0'], remotionDir);
  run(
    remotionBin,
    ['render', 'src/index.ts', 'ShortVideo', 'out/video.mp4', '--codec=h264', '--audio-codec=aac'],
    remotionDir,
  );
  fs.copyFileSync(path.join(remotionDir, 'out', 'cover.png'), path.join(outputDir, 'cover.png'));
  fs.copyFileSync(path.join(remotionDir, 'out', 'video.mp4'), path.join(outputDir, 'video.mp4'));
}

run('node', [path.join(skillRoot, 'scripts/quality-check.mjs'), planPath, 'output']);

console.log(`Done: ${outputDir}`);

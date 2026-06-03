#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const jobDirArg = process.argv[2];

if (!jobDirArg) {
  console.error('Usage: node scripts/install-job-plan.mjs <job-dir>');
  process.exit(2);
}

const jobDir = path.resolve(jobDirArg);
const planPath = path.join(jobDir, 'video-plan.json');

if (!fs.existsSync(planPath)) {
  console.error(`video-plan.json not found: ${planPath}`);
  process.exit(1);
}

const skillRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const remotionPublic = path.join(skillRoot, 'remotion', 'public');
const remotionPlanPath = path.join(remotionPublic, 'video-plan.json');

fs.mkdirSync(remotionPublic, {recursive: true});
fs.copyFileSync(planPath, remotionPlanPath);

for (const dirName of ['audio', 'captions', 'assets']) {
  const sourceDir = path.join(jobDir, dirName);
  const targetDir = path.join(remotionPublic, dirName);

  if (!fs.existsSync(sourceDir)) {
    continue;
  }

  fs.rmSync(targetDir, {recursive: true, force: true});
  fs.cpSync(sourceDir, targetDir, {recursive: true});
}

console.log(`Installed ${planPath}`);
console.log(`Remotion plan: ${remotionPlanPath}`);

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {runCommand} from './lib/process.mjs';
import {skillRootFrom} from './lib/paths.mjs';

const skillRoot = skillRootFrom(import.meta.url, '..');
const scriptsDir = path.join(skillRoot, 'scripts');

const collectMjsFiles = (dir) => {
  const files = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMjsFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(entryPath);
    }
  }
  return files;
};

const files = collectMjsFiles(scriptsDir).sort();

for (const file of files) {
  runCommand(process.execPath, ['--check', file], {
    cwd: skillRoot,
    label: `node --check ${path.relative(skillRoot, file)}`,
  });
}

console.log(`Checked ${files.length} JavaScript files.`);

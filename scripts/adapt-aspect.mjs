#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const [input, destination, aspect] = process.argv.slice(2);
const formats = {'9:16': [1080, 1920], '3:4': [1080, 1440], '16:9': [1920, 1080]};
if (!input || !destination || !formats[aspect]) throw new Error('Usage: node scripts/adapt-aspect.mjs <plan> <new-job> 9:16|3:4|16:9');
const file = path.resolve(input); const source = fs.realpathSync(path.dirname(file)); const target = path.resolve(destination);
if (fs.existsSync(target) || target === source || target.startsWith(`${source}${path.sep}`)) throw new Error('Use a new sibling/outside job directory');
const plan = JSON.parse(fs.readFileSync(file));
// Copy the reproducible job inputs; never carry old deliveries or stale review approvals.
const excluded = new Set(['output', 'history', 'preview', 'node_modules', '.git', 'review-frames', 'editorial-review.json', 'production-audit.json']);
fs.cpSync(source, target, {recursive: true, filter: (p) => {
  const relative = path.relative(source, p);
  if (!relative) return true;
  if (fs.lstatSync(p).isSymbolicLink()) throw new Error('Adaptation refuses symlinks; use self-contained job inputs');
  return !relative.split(path.sep).some((part) => excluded.has(part) || part.startsWith('.'));
}});
[plan.meta.width, plan.meta.height] = formats[aspect];
plan.style.template = 'responsive-report';
fs.writeFileSync(path.join(target, 'video-plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
fs.writeFileSync(path.join(target, 'aspect-adaptation.json'), `${JSON.stringify({source, aspect, renderer: 'responsive-report', review: 'required-for-this-aspect'}, null, 2)}\n`);
console.log(`Created ${target}; responsive reflow selected, old review approvals not copied`);

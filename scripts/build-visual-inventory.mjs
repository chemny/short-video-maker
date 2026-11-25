#!/usr/bin/env node
// Builds research/visual-inventory.{json,md}: every picture the research found or fetched, graded, plus a richness rating
// that decides whether the script can lean on real material. Reads only local files; downloads nothing.
import fs from 'node:fs';
import path from 'node:path';
import {buildInventory, rate} from './lib/visual-inventory.mjs';

const [jobArg, ...args] = process.argv.slice(2);
if (!jobArg) { console.error('Usage: node scripts/build-visual-inventory.mjs <job> [--json] [--strict]'); process.exit(2); }
const job = fs.realpathSync(jobArg);
const items = buildInventory(job), rating = rate(items);
const order = {A: 0, B: 1, C: 2, X: 3};
items.sort((a, b) => order[a.grade] - order[b.grade] || (b.moving - a.moving));
const out = {schemaVersion: 1, builtAt: new Date().toISOString(), rating, items};
fs.mkdirSync(path.join(job, 'research'), {recursive: true});
fs.writeFileSync(path.join(job, 'research/visual-inventory.json'), `${JSON.stringify(out, null, 2)}\n`);

const label = {rich: 'rich', medium: 'medium', poor: 'POOR'};
const row = (i) => `- [${i.grade}] ${i.moving ? 'moving' : 'still'} ${i.kind} · ${i.status === 'candidate' ? 'candidate, not downloaded' + (i.variants > 1 ? `, ${i.variants} sizes of one picture` : '') : i.status} · ${i.origin} · rights ${i.rights}\n  ${i.file ?? i.url} (${i.id})\n  ${i.reasons.join('; ')}${i.context ? `\n  context: ${i.context}` : ''}`;
const md = [`# Visual inventory`, '', `Rating: **${label[rating.rating]}**. ${rating.ready} usable on disk, ${rating.potential} usable candidates not yet downloaded (${rating.moving} moving), ${rating.unusable} unusable.`, '', rating.note, '',
  'Grades: A strong alone; B usable with crop, motion or overlay; C filler only; X not usable. Candidates are graded from their kind and text, never above B, until downloaded. A rights note is a recorded assertion, not a licence.', '',
  ...['A', 'B', 'C', 'X'].flatMap((g) => { const list = items.filter((i) => i.grade === g); return list.length ? [`## Grade ${g} (${list.length})`, ...list.map(row), ''] : []; })].join('\n');
fs.writeFileSync(path.join(job, 'research/visual-inventory.md'), md);

if (args.includes('--json')) console.log(JSON.stringify(out, null, 2));
else console.log(`Visual inventory: ${label[rating.rating]}; ${rating.ready} on disk, ${rating.potential} candidates, ${rating.moving} moving, ${rating.unusable} unusable.\n${rating.note}\nSee research/visual-inventory.md`);
if (args.includes('--strict') && rating.rating === 'poor') process.exit(1);

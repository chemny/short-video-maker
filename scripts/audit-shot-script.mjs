#!/usr/bin/env node
// Gate for shot-script.json: every beat bound to a picture and a camera move before narration is recorded.
import fs from 'node:fs';
import path from 'node:path';
import {auditShotScript, loadInventory, narrationText} from './lib/shot-script.mjs';

const [target, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!target) { console.error('Usage: node scripts/audit-shot-script.mjs <job-dir|shot-script.json> [--target=<seconds>] [--emit=<script.md>] [--json]'); process.exit(2); }
const abs = path.resolve(target), file = fs.statSync(abs).isDirectory() ? path.join(abs, 'shot-script.json') : abs, job = path.dirname(file);
const script = JSON.parse(fs.readFileSync(file, 'utf8'));
const inventory = loadInventory(job);
let claimIds = null;
try { claimIds = new Set(JSON.parse(fs.readFileSync(path.join(job, 'research/claims.json'), 'utf8')).claims.map((c) => c.id)); } catch { /* no claims yet */ }
const targetSeconds = option('target') === undefined ? undefined : Number(option('target'));
const report = auditShotScript(script, {inventory, claimIds, target: targetSeconds});

if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`${report.stats.beats} beats, ~${report.stats.estimatedSeconds ?? 0} s, ${report.stats.distinctPictures ?? 0} distinct pictures${inventory ? '' : ' (no visual inventory found: materials not checked)'}`);
  for (const r of report.beats) console.log(`  ${String(r.id).padEnd(8)} ${r.rung.padEnd(9)} ${r.move.padEnd(9)} ${String(r.seconds).padStart(4)} s  ${r.material ?? '-'}`);
  for (const m of report.warnings) console.log(`warning: ${m}`);
  for (const m of report.errors) console.error(`error: ${m}`);
  if (!report.errors.length && !report.warnings.length) console.log('no findings');
}
if (option('emit') && !report.errors.length) { fs.writeFileSync(path.resolve(option('emit')), `${narrationText(script)}\n`); console.log(`wrote ${option('emit')} (narration only, for audit-script.mjs and TTS)`); }
process.exit(report.errors.length ? 1 : 0);

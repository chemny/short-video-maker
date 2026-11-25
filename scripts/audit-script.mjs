#!/usr/bin/env node
import fs from 'node:fs';
import {auditScript} from './lib/script-audit.mjs';

const [file, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!file) throw new Error('Usage: node scripts/audit-script.mjs <approved-script.md> [--headline=<title>] [--target=<seconds>]');
const target = option('target') === undefined ? undefined : Number(option('target'));
if (target !== undefined && !(target > 0)) throw new Error('target must be a positive number of seconds');

const report = auditScript(fs.readFileSync(file, 'utf8'), {headline: option('headline'), target});
console.log(`${report.stats.sentences} sentences, ${report.stats.characters} characters, ~${report.stats.estimatedSeconds}s`);
for (const message of report.warnings) console.log(`warning: ${message}`);
for (const message of report.errors) console.error(`error: ${message}`);
if (!report.errors.length && !report.warnings.length) console.log('no findings');
process.exit(report.errors.length ? 1 : 0);

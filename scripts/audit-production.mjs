#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {auditProduction} from './lib/production-audit.mjs';
const [input] = process.argv.slice(2);
if (!input) throw new Error('Usage: node scripts/audit-production.mjs <plan>');
const file = path.resolve(input); const plan = JSON.parse(fs.readFileSync(file));
const report = auditProduction(plan, path.dirname(file));
fs.writeFileSync(path.join(path.dirname(file), 'production-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exit(1);

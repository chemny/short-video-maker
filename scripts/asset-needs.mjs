#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {writeAssetNeeds} from './lib/asset-needs.mjs';
const [input, output] = process.argv.slice(2);
if (!input) throw new Error('Usage: node scripts/asset-needs.mjs <video-plan.json> [output-dir]');
const file = path.resolve(input);
const report = writeAssetNeeds(JSON.parse(fs.readFileSync(file, 'utf8')), path.dirname(file), output ? path.resolve(output) : path.dirname(file));
console.log(`Wrote assets-needed.md/json: ${report.needs.length} item(s) need review`);

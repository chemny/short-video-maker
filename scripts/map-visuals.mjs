#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
import {writeVisualMap} from './lib/visual-map.mjs';
const file=path.resolve(process.argv[2]??'video-plan.json');
const report=writeVisualMap(JSON.parse(fs.readFileSync(file)),path.dirname(file));
console.log(`${report.status}: ${report.rows.length} narration/visual associations`);
if(report.errors.length){console.error(report.errors.join('\n'));process.exitCode=1;}

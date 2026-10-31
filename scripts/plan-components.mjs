#!/usr/bin/env node
import path from 'node:path';import {compileComponents} from './lib/component-planning.mjs';
const file=path.resolve(process.argv[2]??'video-plan.json'),mode=process.argv.find(s=>s.startsWith('--mode='))?.slice(7);const r=compileComponents(file,{mode});console.log(`Components: ${r.status}; ${r.rows.length} scenes`);for(const w of r.warnings)console.log(`Review: ${w}`);

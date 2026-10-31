#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {scanAssets} from './lib/media-assets.mjs';

const [inputDir, ...args] = process.argv.slice(2);
if (!inputDir) throw new Error('Usage: node scripts/scan-assets.mjs <input-dir> [--out=<manifest.json>]');
const output = args.find((arg) => arg.startsWith('--out='))?.slice(6);
const manifest = scanAssets(inputDir);
const json = `${JSON.stringify(manifest, null, 2)}\n`;
if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)), {recursive: true});
  fs.writeFileSync(output, json);
  console.log(`Wrote ${path.resolve(output)}`);
} else console.log(json);

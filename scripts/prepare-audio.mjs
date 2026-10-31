#!/usr/bin/env node
import path from 'node:path';
import {prepareAudio} from './lib/audio-processing.mjs';

const planPath = process.argv[2];
if (!planPath) throw new Error('Usage: node scripts/prepare-audio.mjs <video-plan.json>');
console.log(JSON.stringify(prepareAudio(path.resolve(planPath)), null, 2));

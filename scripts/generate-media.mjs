#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import './tts/load-env.mjs';
import * as api from './lib/comfy-agent.mjs';

const usage = `Usage: node scripts/generate-media.mjs <job-dir> <command> [options]
Commands: health | workflows | image | edit | video-text | video-image | video-reference | replace-person | character-swap | resume <jobId>
Generation options: --prompt=... --negative-prompt=... --width=N --height=N --steps=N --seed=N --duration=SECONDS --profile=fast|balanced|quality
  --framing=legacy|contain|cover --prompt-mode=full|supplement --frame-instruction=...
  --resolution-preset=480|768 --mask-expansion=N (character-swap only)
  --prepare-only (with --confirm and --purpose: uploads and preflights, never submits generation)
  --audio=source|generated|none --model-variant=standard|uncensored|turbo --encoder-variant=standard|atomicchat_q8 --resolution=N --motion-long-edge=N
Local files (uploaded to the generation server): --image=FILE (repeatable) --first-frame=FILE --last-frame=FILE --identity-image=FILE --motion-video=FILE --anchor-image=FILE
Safety: without --confirm nothing is uploaded or submitted; the command prints the plan. --confirm also requires --purpose="why this asset, which caption".`;

const [jobArg, command, ...rest] = process.argv.slice(2);
if (!jobArg || !command) { console.error(usage); process.exit(2); }
const flags = new Map();
const positional = [];
for (const arg of rest) {
  const match = /^--([\w-]+)(?:=(.*))?$/s.exec(arg);
  if (!match) { positional.push(arg); continue; }
  flags.set(match[1], [...(flags.get(match[1]) ?? []), match[2] ?? 'true']);
}
const one = (name) => flags.get(name)?.at(-1);
const number = (name, kind = 'int') => {
  const value = one(name); if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (kind === 'int' && !Number.isInteger(parsed))) throw new Error(`--${name} must be ${kind === 'int' ? 'an integer' : 'a number'}`);
  return parsed;
};
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const job = path.resolve(jobArg);
const recordFile = path.join(job, 'research/generated.json');
const readRecords = () => fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : {schemaVersion: 1, items: []};
const saveRecord = (item) => {
  const records = readRecords();
  records.items = [...records.items.filter((x) => x.idempotencyKey !== item.idempotencyKey), item];
  fs.mkdirSync(path.dirname(recordFile), {recursive: true});
  fs.writeFileSync(recordFile, `${JSON.stringify(records, null, 2)}\n`);
};

const workflowSpecs = {
  image: {workflow: 'image.generate', required: ['prompt']},
  edit: {workflow: 'image.edit', required: ['prompt'], assets: {image: 'images'}},
  'video-text': {workflow: 'video.text', required: ['prompt']},
  'video-image': {workflow: 'video.image', required: ['prompt'], assets: {'first-frame': 'first_frame', 'last-frame': 'last_frame'}, need: ['first-frame']},
  'video-reference': {workflow: 'video.reference', required: ['prompt'], assets: {image: 'images', 'motion-video': 'motion_video', 'anchor-image': 'anchor_image'}},
  'replace-person': {workflow: 'video.replace_person', required: [], assets: {'identity-image': 'identity_image', 'motion-video': 'motion_video', 'anchor-image': 'anchor_image', 'last-frame': 'last_frame', image: 'images'}, need: ['identity-image', 'motion-video']},
  'character-swap': {workflow: 'video.character_swap', required: [], assets: {'identity-image': 'identity_image', 'motion-video': 'motion_video'}, need: ['identity-image', 'motion-video']},
};

const finish = async (record, submitted) => {
  const done = await api.waitJob(submitted.id, {onStatus: (j) => console.log(`status: ${j.status}`)});
  const outputs = await api.downloadOutputs(done, path.join(job, 'assets/generated'));
  const final = {...record, status: 'downloaded', finishedAt: new Date().toISOString(), outputs: outputs.map((o) => ({file: path.relative(job, o.file), sha256: o.sha256, bytes: o.bytes}))};
  saveRecord(final);
  for (const o of final.outputs) console.log(`saved ${o.file} (${o.bytes} bytes, sha256 ${o.sha256.slice(0, 16)}…)`);
  console.log('Record: research/generated.json. Generated media must stay labelled "AI 生成" and may not be presented as a photograph or as news evidence.');
};

try {
  if (flags.has('prepare-only') && !workflowSpecs[command]) throw new Error('--prepare-only requires a generation command; it cannot resume a job');
  if (command === 'health') {
    console.log(JSON.stringify(await api.health()));
    if (process.env.COMFY_AGENT_API_KEY) console.log(JSON.stringify(await api.upstream(), null, 2));
    else console.log('No COMFY_AGENT_API_KEY set: authenticated checks skipped.');
  } else if (command === 'workflows') {
    console.log(JSON.stringify(await api.workflows(), null, 2));
  } else if (command === 'resume') {
    const id = positional[0]; if (!id) throw new Error('resume needs a job id');
    const record = readRecords().items.find((x) => x.jobId === id);
    if (!record) throw new Error(`Job ${id} is not in research/generated.json`);
    const current = await api.getJob(id);
    if (['interrupted', 'submission_unknown'].includes(current.status)) await api.resumeJob(id);
    await finish(record, {id});
  } else if (workflowSpecs[command]) {
    const spec = workflowSpecs[command];
    const supportedFlags = new Set(['prompt', 'negative-prompt', 'width', 'height', 'steps', 'seed', 'duration',
      'profile', 'audio', 'model-variant', 'encoder-variant', 'resolution', 'motion-long-edge',
      'framing', 'prompt-mode', 'frame-instruction', 'resolution-preset', 'mask-expansion',
      'confirm', 'purpose', 'prepare-only', ...Object.keys(spec.assets ?? {})]);
    for (const flag of flags.keys()) if (!supportedFlags.has(flag)) throw new Error(`Unknown or unsupported option: --${flag}`);
    const body = {workflow: spec.workflow};
    const map = {prompt: 'prompt', 'negative-prompt': 'negative_prompt', 'model-variant': 'model_variant', 'encoder-variant': 'encoder_variant', profile: 'profile', audio: 'audio', framing: 'framing', 'prompt-mode': 'prompt_mode', 'frame-instruction': 'frame_instruction', 'resolution-preset': 'resolution_preset'};
    for (const [flag, field] of Object.entries(map)) if (one(flag) !== undefined) body[field] = one(flag);
    for (const [flag, field] of [['width', 'width'], ['height', 'height'], ['steps', 'steps'], ['seed', 'seed'], ['resolution', 'resolution'], ['motion-long-edge', 'motion_reference_long_edge'], ['mask-expansion', 'mask_expansion']]) if (number(flag) !== undefined) body[field] = number(flag);
    if (number('duration', 'number') !== undefined) body.duration_seconds = number('duration', 'number');
    // Only explicit options enter the request; preserve legacy defaults and stable-key inputs.
    for (const [field, choices, commands] of [
      ['framing', ['legacy', 'contain', 'cover'], ['video-reference', 'replace-person']],
      ['prompt_mode', ['full', 'supplement'], ['replace-person', 'character-swap']],
      ['resolution_preset', ['480', '768'], ['character-swap']],
    ]) {
      if (body[field] !== undefined && (!commands.includes(command) || !choices.includes(body[field]))) {
        throw new Error(`${field} is unsupported for this command or has an invalid value`);
      }
    }
    if (body.frame_instruction !== undefined && (command !== 'replace-person' || body.prompt_mode !== 'supplement')) {
      throw new Error('--frame-instruction requires replace-person --prompt-mode=supplement');
    }
    if (body.mask_expansion !== undefined && command !== 'character-swap') throw new Error('--mask-expansion requires character-swap');
    for (const field of spec.required) if (!body[field]) throw new Error(`${command} needs --${field.replace('_', '-')}`);
    const files = {};
    for (const [flag, field] of Object.entries(spec.assets ?? {})) for (const file of flags.get(flag) ?? []) {
      if (!fs.existsSync(file)) throw new Error(`Local file not found: ${file}`);
      (files[field] ??= []).push(path.resolve(file));
    }
    for (const flag of spec.need ?? []) if (!(flags.get(flag) ?? []).length) throw new Error(`${command} needs --${flag}`);
    // The idempotency key depends on the local file hashes, not on server asset ids, so a retry reuses the same remote job.
    const assetHashes = Object.fromEntries(Object.entries(files).map(([field, list]) => [field, list.map((f) => sha256(fs.readFileSync(f)))]));
    const key = api.stableKey({...body, assets: assetHashes});
    const plan = {workflow: spec.workflow, request: body, uploads: Object.fromEntries(Object.entries(files).map(([field, list]) => [field, list.map((f) => `${path.basename(f)} (${fs.statSync(f).size} bytes)`)])), idempotencyKey: key, server: api.baseUrl()};
    if (flags.get('confirm') === undefined) { console.log('Dry run (nothing uploaded or submitted). Add --confirm --purpose="..." to run:'); console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
    const purpose = one('purpose')?.trim(); if (!purpose || purpose === 'true') throw new Error('--confirm needs --purpose="why this asset is generated and which captions it serves"');
    const uploads = [];
    for (const [field, list] of Object.entries(files)) for (const file of list) {
      const asset = await api.uploadAsset(file);
      uploads.push({field, file: path.relative(job, file) || file, localSha256: asset.localSha256, assetId: asset.id});
      if (field === 'images') (body.images ??= []).push(asset.id); else body[field] = asset.id;
    }
    // Preflight errors or malformed responses stop before any generation submission.
    const preflight = await api.prepare(body);
    const preflightSummary = {
      workflow: preflight.workflow, submitted: preflight.submitted,
      route: preflight.route, geometry: preflight.geometry,
      material_roles: preflight.material_roles, effective_prompt: preflight.effective_prompt,
      frame_edit_prompt: preflight.frame_edit_prompt, warnings: preflight.warnings ?? [], stages: preflight.stages,
    };
    console.log('Server preflight (no generation submitted):');
    console.log(JSON.stringify(preflightSummary, null, 2));
    const preflightFile = path.join(job, 'research/preflights', `${key}.json`);
    fs.mkdirSync(path.dirname(preflightFile), {recursive: true});
    fs.writeFileSync(preflightFile, `${JSON.stringify({idempotencyKey: key, request: body, uploads, purpose, preflight}, null, 2)}\n`);
    if (flags.has('prepare-only')) {
      console.log(`Preflight saved: ${path.relative(job, preflightFile)}. No generation submitted.`);
      process.exit(0);
    }
    // Use the caller's original request, never server-normalized defaults or rewritten prompts.
    const submitted = await api.submit(body, key);
    const record = {idempotencyKey: key, jobId: submitted.id, status: 'submitted', createdAt: new Date().toISOString(), workflow: spec.workflow, request: body, uploads, purpose, preflightFile: path.relative(job, preflightFile), label: 'AI 生成',
      rightsNote: '用户自有生成服务产出；必须标注“AI 生成”，不得冒充真实照片、官方素材或新闻证据'};
    saveRecord(record);
    console.log(`submitted job ${submitted.id}`);
    await finish(record, submitted);
  } else { console.error(usage); process.exit(2); }
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}

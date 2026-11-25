#!/usr/bin/env node
// The main line for a shot film, stage by stage, with the gates between them.
//   node scripts/make-shot-film.mjs <job>                    audit -> narration -> review (stops at the frame review)
//   node scripts/make-shot-film.mjs <job> --stage=<name>     one of: audit, narration, review, final
//   node scripts/make-shot-film.mjs <job> --final            also render, cover and package when the verdict is ready-for-user
// Narration options: --provider=voxcpm2|local|edge|volcengine --voice= --speed= --voice-profile= --asr-model= --seed= --steps= --redo
// A provider that sends the narration text to an online service (edge, volcengine, http) needs --allow-cloud.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {auditShotScript, loadInventory} from './lib/shot-script.mjs';
import {NARRATION_DIR, buildNarrationPlan, narrationSha, planPath, statePath, timingsFromPlan} from './lib/shot-narration.mjs';
import {compileFromArgs} from './lib/shot-options.mjs';
import {deliveryProblems, finalCheck, materialsUsed, writePackage} from './lib/shot-package.mjs';
import {selectProvider} from './tts/select-provider.mjs';
import {commandFromEnv} from './lib/bins.mjs';

const [jobArg, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name) => args.includes(`--${name}`);
if (!jobArg) { console.error('Usage: node scripts/make-shot-film.mjs <job> [--stage=audit|narration|review|final] [--final] [--provider=..] [--allow-cloud] [--redo]'); process.exit(2); }
const job = fs.realpathSync(jobArg), here = (f) => fileURLToPath(new URL(f, import.meta.url));
const stage = option('stage'), wants = (name) => !stage || stage === name;
const say = (m) => console.log(m);
const stop = (m, code = 1) => { console.error(m); process.exit(code); };
const node = (script, a, opts = {}) => spawnSync(process.execPath, [here(script), ...a], {encoding: 'utf8', ...opts});
const readScript = () => JSON.parse(fs.readFileSync(path.join(job, 'shot-script.json'), 'utf8'));

// 1. audit ---------------------------------------------------------------------------------------------------------------------------
const script = readScript();
const inventory = loadInventory(job);
if (!inventory) stop('research/visual-inventory.json is missing; run build-visual-inventory.mjs first');
if (wants('audit')) {
  const claimIds = (() => { try { return new Set(JSON.parse(fs.readFileSync(path.join(job, 'research/claims.json'), 'utf8')).claims.map((c) => c.id)); } catch { return null; } })();
  const r = auditShotScript(script, {inventory, claimIds});
  r.warnings.forEach((w) => say(`warning: ${w}`));
  if (r.errors.length) stop(`shot script has errors:\n  ${r.errors.join('\n  ')}`);
  say(`audit: ${r.stats.beats} beats, ~${r.stats.estimatedSeconds} s, ${r.warnings.length} warning(s)`);
}

// 2. narration -----------------------------------------------------------------------------------------------------------------------
if (wants('narration')) {
  const current = narrationSha(script), state = fs.existsSync(statePath(job)) ? JSON.parse(fs.readFileSync(statePath(job), 'utf8')) : null;
  if (state?.narrationSha256 === current && !flag('redo')) say(`narration: up to date (${state.provider}, ${state.timingSource ?? 'aligned'})`);
  else {
    const selection = selectProvider({explicit: option('provider')});
    const cloud = ['edge', 'volcengine', 'http'].includes(selection.provider);
    if (cloud && !flag('allow-cloud')) stop(`narration would use ${selection.provider}, which sends the narration text to an online service.\nRe-run with --allow-cloud to allow it, or pick a local provider: --provider=voxcpm2 or --provider=local (macOS system speech).`, 3);
    fs.mkdirSync(path.join(job, NARRATION_DIR, 'audio'), {recursive: true});
    const plan = buildNarrationPlan(script, {title: script.title, audio: {provider: selection.provider, ...(option('voice') ? {voice: option('voice')} : {})}});
    fs.writeFileSync(planPath(job), `${JSON.stringify(plan, null, 2)}\n`);
    say(`narration: ${selection.provider} (${selection.source}), ${plan.scenes.length} scenes, ${plan.captions.length} phrase captions`);
    const pass = ['voice', 'speed', 'voice-profile', 'asr-model', 'loudness', 'rate', 'seed', 'steps'].filter((n) => option(n)).map((n) => `--${n}=${option(n)}`);
    // takes chosen per scene by pick-voice-takes.mjs (VoxCPM2 only)
    const takesFile = path.join(job, NARRATION_DIR, 'takes.json');
    if (flag('one-take')) { pass.push('--one-take'); say('narration: one take for the whole script (single timbre; scene boundaries from ASR)'); }
    else if (selection.provider === 'voxcpm2' && fs.existsSync(takesFile)) {
      const takes = JSON.parse(fs.readFileSync(takesFile, 'utf8'));
      if (takes.sceneSeeds?.length === plan.scenes.length) { pass.push(`--scene-seeds=${takes.sceneSeeds.join(',')}`); say(`narration: using the chosen take per scene (seeds ${takes.sceneSeeds.join(',')})`); }
    }
    // an explicit provider is never replaced silently, so a failed local synthesis cannot fall over to an online one
    const r = spawnSync(process.execPath, [here('./tts.mjs'), 'generate', planPath(job), `--provider=${selection.provider}`, ...pass], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024});
    if (r.status !== 0) stop(`narration failed; nothing was sent anywhere else.\n${(r.stdout ?? '').slice(-400)}`);
    const done = JSON.parse(fs.readFileSync(planPath(job), 'utf8'));
    // level the voice: -16 LUFS integrated, true peak at most -2 dBFS; the film then adds music and effects far below it
    const voiced = path.join(job, NARRATION_DIR, done.audio.voiceover), norm = path.join(job, NARRATION_DIR, 'audio/voiceover-norm.wav');
    // voice mastering: a gentle compressor and limiter tame the peaks of synthetic speech, then two loudnorm passes (measure, then apply
    // the measured values linearly) land the integrated loudness on -16 LUFS with the true peak at most -1.5 dBFS
    const quiet = ['-hide_banner', '-v', 'error', '-nostdin', '-y'];
    const squeezed = path.join(job, NARRATION_DIR, 'audio/voiceover-comp.wav');
    const c1 = spawnSync(commandFromEnv('ffmpeg'), [...quiet, '-i', voiced, '-af', 'acompressor=threshold=0.1:ratio=2.5:attack=5:release=120:makeup=2,alimiter=limit=0.9', '-ar', '48000', '-ac', '2', squeezed], {encoding: 'utf8'});
    if (c1.status !== 0) stop(`could not compress the narration: ${c1.stderr.slice(0, 300)}`);
    const m = spawnSync(commandFromEnv('ffmpeg'), ['-hide_banner', '-nostdin', '-y', '-i', squeezed, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], {encoding: 'utf8'});
    const stats = (() => { try { return JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{'))); } catch { return null; } })();
    const filter = stats ? `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true` : 'loudnorm=I=-16:TP=-1.5:LRA=11';
    const ln = spawnSync(commandFromEnv('ffmpeg'), [...quiet, '-i', squeezed, '-af', filter, '-ar', '48000', '-ac', '2', norm], {encoding: 'utf8'});
    if (ln.status !== 0) stop(`could not level the narration: ${ln.stderr.slice(0, 300)}`);
    fs.writeFileSync(statePath(job), `${JSON.stringify({normalized: true, narrationSha256: current, provider: selection.provider, voice: done.audio?.voice ?? option('voice') ?? null, timingSource: done.audio?.timingSource ?? null, generatedAt: new Date().toISOString()}, null, 2)}\n`);
    say(`narration: done, ${done.meta.durationSeconds} s, timing ${done.audio?.timingSource ?? 'aligned'}`);
  }
}

// 3. compile + review ----------------------------------------------------------------------------------------------------------------
let verdict;
if (wants('review') || wants('final')) {
  const {film} = compileFromArgs(job, (n) => option(n), (n) => n === 'narration' || flag(n));
  say(`compile: ${film.shots.length} shots, ${(film.durationInFrames / film.fps).toFixed(1)} s, audio ${film.audio}`);
  const r = node('./review-shot-film.mjs', [job, '--narration', ...(wants('final') && stage ? ['--no-render'] : [])], {stdio: ['ignore', 'ignore', 'pipe']});
  const reportFile = path.join(job, 'output/review/report.json');
  let report; try { report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); } catch { stop(`review failed to run:\n${(r.stderr ?? '').slice(-600)}`); }
  if (r.status !== 0 && report.verdict.state !== 'needs-fix') stop(`review failed to run:\n${(r.stderr ?? '').slice(-600)}`);
  verdict = report.verdict;
  for (const c of report.checks) say(`  ${c.status.padEnd(5)} ${c.label}: ${c.shown}`);
  say(`review: ${verdict.state.toUpperCase()}: ${verdict.why}`);
  say(`contact sheets: ${report.sheets.map((s) => s.file).join(', ')}\nframe review template: output/review/frame-review.template.json (fill it after looking at the sheets, then: node scripts/review-shot-film.mjs ${jobArg} --narration --record=<file>)`);
}

// 4. final ---------------------------------------------------------------------------------------------------------------------------
if (flag('final') || stage === 'final') {
  if (verdict?.state !== 'ready-for-user') stop(`not delivering: verdict is ${verdict?.state}. Only a ready-for-user film is rendered at full size and packaged.`);
  const {film, audit} = compileFromArgs(job, (n) => option(n), (n) => n === 'narration' || flag(n));
  const {plan, state} = timingsFromPlan(job, script);
  const materials = materialsUsed(job, script, inventory), problems = deliveryProblems(script, materials);
  if (problems.length) stop(`cannot package:\n  ${problems.join('\n  ')}`);
  const out = path.join(job, 'output');
  fs.mkdirSync(out, {recursive: true});
  for (const [name, a] of [['video', ['--out=' + path.join(out, 'video.mp4')]], ['cover', ['--cover=' + path.join(out, 'cover.png')]]]) {
    const r = node('./render-shot-film.mjs', [job, '--narration', ...a], {stdio: ['ignore', 'inherit', 'inherit']});
    if (r.status !== 0) stop(`${name} render failed`);
  }
  const checks = finalCheck(path.join(out, 'video.mp4'), film);
  checks.forEach((c) => say(`  ${c.status.padEnd(5)} final ${c.id}: ${c.shown}  [${c.rule}]`));
  const record = JSON.parse(fs.readFileSync(path.join(job, 'frame-review.json'), 'utf8'));
  const meta = writePackage({job, script, film, materials, outDir: out, bgm: film.bgm,
    narration: {provider: state.provider, voice: state.voice, timingSource: state.timingSource, textSha256: state.narrationSha256, selection: plan.audio?.providerSelection ?? null},
    review: {verdict: verdict.state, reviewer: record.reviewer, recordedAt: record.recordedAt, filmSha256: record.filmSha256, summary: record.summary}});
  fs.writeFileSync(path.join(out, 'final-check.json'), `${JSON.stringify({checks, warnings: audit.warnings}, null, 2)}\n`);
  const failed = checks.filter((c) => c.status === 'fail');
  say(`package: ${path.relative(job, out)}/ video.mp4 cover.png script.md captions.srt publish.md sources.md metadata.json final-check.json`);
  if (failed.length) stop(`final check failed: ${failed.map((c) => c.id).join(', ')}`);
  say(`done. ${meta.materials.length} materials, music ${meta.music ? 'yes' : 'none'}. Show the user: video, cover, report, contact sheets.`);
}
else if (verdict) say(verdict.state === 'ready-for-user' ? 'next: --final to render, cover and package' : 'next: fix what the review lists, or record the frame review, then run again');

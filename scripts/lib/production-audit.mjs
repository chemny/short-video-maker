import {compileDirector} from './director.mjs';
import {auditSentenceStoryboard} from './sentence-storyboard.mjs';
import {planComponents} from './component-planning.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {visualMap} from './visual-map.mjs';
import {inspectAsset} from './media-assets.mjs';
import {verifyAcousticEvidence} from './acoustic-timing.mjs';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const auditProduction = (plan, job) => {
  const errors = []; const warnings = []; const checks = {};
  const duration = plan.meta.durationSeconds;
  if(plan.meta.directorVersion==='director-v1'){try{const board=JSON.parse(fs.readFileSync(path.join(job,'sentence-storyboard.json')));const d=compileDirector(plan,board,{job});errors.push(...d.report.errors);if(JSON.stringify(d.plan.directorRender)!==JSON.stringify(plan.directorRender))errors.push('Director compiled data is missing/stale; run the shared entry');checks.director=d.report;}catch(e){errors.push('Director evidence: '+e.message);}}
  if(plan.meta.editorialWorkflow==='sentence-v1'){const result=auditSentenceStoryboard(plan,job);errors.push(...result.errors);checks.sentenceStoryboard=result;}
  if(plan.style.componentSystem==='semantic-v1'){
    const expected=planComponents(plan,{job});errors.push(...expected.report.errors);
    if(JSON.stringify(expected.plan.scenes.map(s=>s.componentRender))!==JSON.stringify(plan.scenes.map(s=>s.componentRender)))errors.push('Component timing/content is stale; recompile components');
    checks.components={status:expected.report.status,scenes:expected.report.rows.length,warnings:expected.report.warnings};
  }
  if (plan.audio?.acousticTiming) {
    try {const acoustic = verifyAcousticEvidence(plan, job); checks.acousticTiming = {status: acoustic.state, changes: acoustic.changes, protectedWindows: acoustic.protectedWindows.length};}
    catch (error) {errors.push(error.message);}
  }
  if (plan.meta.productionVersion === 'p0-v1') {const mapping = visualMap(plan); errors.push(...mapping.errors);checks.visualMap = {status: mapping.status, bindings: mapping.rows.length};}
  let lastEnd = 0;
  for (const [i, scene] of plan.scenes.entries()) {
    if (Math.abs(scene.start - lastEnd) > 0.05) errors.push(`Scene ${scene.id}: timeline must be contiguous (expected start ${lastEnd})`);
    if (scene.start < 0 || scene.end <= scene.start) errors.push(`Scene ${scene.id}: invalid time range`);
    lastEnd = scene.end;
    const visual = scene.visual;
    if (!visual?.asset) continue;
    const file = path.resolve(job, visual.asset);
    if (path.isAbsolute(visual.asset) || !file.startsWith(`${path.resolve(job)}${path.sep}`)) {errors.push(`Scene ${scene.id}: visual must be job-local`); continue;}
    try {
      const media = inspectAsset(file);
      const isVideo = visual.kind === 'video';
      if (!fs.realpathSync(file).startsWith(`${fs.realpathSync(job)}${path.sep}`)) errors.push(`Scene ${scene.id}: visual symlink escapes job`);
      if (isVideo ? media.kind !== 'video' : media.kind !== 'image') errors.push(`Scene ${scene.id}: visual kind does not match file`);
      if (visual.fit !== undefined && !['contain', 'cover'].includes(visual.fit)) errors.push(`Scene ${scene.id}: fit must be contain or cover`);
      if (visual.focalPoint && ![visual.focalPoint.x, visual.focalPoint.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) errors.push(`Scene ${scene.id}: invalid focalPoint`);
      if (isVideo) {
        const start = visual.sourceStart;
        const volume = visual.sourceVolume ?? 0;
        if (!Number.isFinite(start) || start < 0 || !Number.isFinite(volume) || volume < 0 || volume > 1) errors.push(`Scene ${scene.id}: explicit sourceStart>=0 and sourceVolume 0..1 required`);
        const padding = i < plan.scenes.length - 1 && !['cut', 'none'].includes(scene.transition) ? 12 / plan.meta.fps : 0;
        if (!Number.isFinite(media.duration) || start + scene.end - scene.start + padding > media.duration + 0.01) errors.push(`Scene ${scene.id}: clip is too short for selected sourceStart/scene/transition; no automatic loop/freeze`);
        if (volume && !media.hasAudio) errors.push(`Scene ${scene.id}: sourceVolume requested but video has no audio`);
        if (volume > 0.3 && plan.audio?.voiceover) warnings.push(`Scene ${scene.id}: source audio may compete with narration`);
      }
    } catch (error) { errors.push(`Scene ${scene.id}: ${error.message}`); }
  }
  if (Math.abs(lastEnd - duration) > 0.05) errors.push('Scene timeline does not cover the content duration');
  let previous = 0;
  for (const caption of plan.captions) {
    if (caption.start < 0 || caption.start < previous - 0.02 || caption.end <= caption.start || caption.end > duration + 0.05) errors.push(`Caption ${caption.id}: negative, overlapping or out-of-range timing`);
    previous = caption.end;
  }
  if (['asr-matched', 'provider-matched'].includes(plan.audio?.timingSource)) {
    const file = path.join(job, 'alignment/alignment-report.json');
    try {
      const report = JSON.parse(fs.readFileSync(file));
      const source = path.resolve(job, plan.audio.sourceVoiceover ?? plan.audio.voiceover);
      const current = plan.captions.map(({id, text}) => ({id, text}));
      if (plan.audio.timingSource === 'provider-matched') {
        const timing = path.join(job, 'alignment/provider-timing.json');
        if (!['provider-word-boundary-matching', 'system-phrase-segment-matching'].includes(report.method) || report.providerTimingSha256 !== sha256(fs.readFileSync(timing))) errors.push('Provider timing evidence is missing/stale');
      }
      if (!report.applied || report.status !== 'matched' || report.audioSha256 !== sha256(fs.readFileSync(source)) || report.scriptSha256 !== sha256(JSON.stringify(current)) ||
        JSON.stringify(report.proposed.map(({id, start, end}) => ({id, start, end}))) !== JSON.stringify(plan.captions.map(({id, start, end}) => ({id, start, end})))) errors.push('Matched alignment evidence is missing/stale for this audio/script/timing');
      checks.alignment = {status: report.status, timingSource: plan.audio.timingSource, method: report.method, limits: report.limits};
    } catch { errors.push('Matched alignment report cannot be verified'); }
  } else {
    warnings.push('Caption timing has not been independently checked against ASR');
    try {
      const report = JSON.parse(fs.readFileSync(path.join(job, 'alignment/alignment-report.json')));
      const source = path.resolve(job, plan.audio?.sourceVoiceover ?? plan.audio?.voiceover ?? 'MISSING');
      if (report.audioSha256 === sha256(fs.readFileSync(source)) && report.scriptSha256 === sha256(JSON.stringify(plan.captions.map(({id, text}) => ({id, text})))) && report.status === 'needs-review') {
        checks.alignment = {status: 'needs-review', issues: report.issues, applied: false};
        warnings.push(`ASR found ${report.issues.length} unresolved speech/timing issue(s); see alignment report before final editorial acceptance`);
      }
    } catch {}
  }
  const researched = plan.meta.productionMode === 'researched';
  if (researched) {
    try {
      const sources = JSON.parse(fs.readFileSync(path.join(job, 'research/sources.json'))).sources;
      if(plan.meta.productionVersion === 'p0-v1'){
        const registry=JSON.parse(fs.readFileSync(path.join(job,'research/sources.json')));
        const coverage=JSON.parse(fs.readFileSync(path.join(job,'research/coverage.json')));
        const decisions=JSON.parse(fs.readFileSync(path.join(job,'research/decisions.json')));
        if(coverage.sourceRegistrySha256!==sha256(JSON.stringify(registry))||!decisions.officialMediaPolicy)errors.push('Official research coverage/selection decisions are missing or stale');
        checks.coverage={status:coverage.sourceRegistrySha256===sha256(JSON.stringify(registry))?'recorded':'stale',sourcePages:coverage.sources?.length,unselectedOrUnavailable:coverage.gaps?.length,acquisitionFailures:coverage.acquisitionFailures?.length??0};
      }
      const claims = JSON.parse(fs.readFileSync(path.join(job, 'research/claims.json'))).claims;
      let downloads = [];
      try {downloads = JSON.parse(fs.readFileSync(path.join(job, 'research/downloads.json'))).downloads;} catch {}
      const sourceMap = new Map(sources.map((s) => [s.id, s]));
      const claimMap = new Map();
      for (const claim of claims) {
        if (claimMap.has(claim.id)) errors.push(`Duplicate claim ${claim.id}`);
        claimMap.set(claim.id, claim);
        const source = sourceMap.get(claim.sourceId);
        if (!source || !claim.evidenceQuote || claim.reviewed !== true) {errors.push(`Claim ${claim.id}: reviewed primary-source evidence required`); continue;}
        const textPath = path.resolve(job, source.textFile);
        if (!textPath.startsWith(`${path.resolve(job)}${path.sep}`)) throw new Error('Source text escapes job');
        const text = fs.readFileSync(textPath, 'utf8');
        if (sha256(text) !== source.textSha256 || !text.replace(/\s+/g, ' ').includes(claim.evidenceQuote.replace(/\s+/g, ' '))) errors.push(`Claim ${claim.id}: evidence text is stale or quote is absent`);
      }
      for (const scene of plan.scenes) {
        const evidence = scene.evidence;
        if (!evidence?.visualReason || !evidence.claimIds?.length || !evidence.sourceIds?.length) {errors.push(`Scene ${scene.id}: claim/source IDs and visualReason required`); continue;}
        for (const id of evidence.claimIds) if (!claimMap.has(id) || !evidence.sourceIds.includes(claimMap.get(id).sourceId)) errors.push(`Scene ${scene.id}: unknown/inconsistent claim ${id}`);
        for (const id of evidence.sourceIds) if (!sourceMap.has(id)) errors.push(`Scene ${scene.id}: unknown source ${id}`);
        if (!['official', 'authored', 'user'].includes(evidence.visualOrigin)) errors.push(`Scene ${scene.id}: declare visualOrigin (official/authored/user)`);
        if (evidence.visualOrigin === 'official' && scene.visual?.asset) {
          const selected = downloads.find((d) => d.file === scene.visual.asset && d.mediaId === evidence.mediaId && evidence.sourceIds.includes(d.sourceId));
          if (!selected || selected.sourceTextSha256 !== sourceMap.get(selected?.sourceId)?.textSha256 ||
            selected.candidateUrl !== sourceMap.get(selected?.sourceId)?.mediaCandidates?.find((m) => m.id === selected.mediaId)?.url ||
            selected.sha256 !== sha256(fs.readFileSync(path.resolve(job, scene.visual.asset)))) errors.push(`Scene ${scene.id}: official asset provenance/hash cannot be verified`);
        }
      }
      checks.research = {sources: sources.length, claims: claims.length, status: errors.length ? 'needs-review' : 'traceable', limits: 'Quote presence and provenance do not establish factual entailment; reviewed is an explicit editorial assertion'};
    } catch (error) { errors.push(`Research evidence unavailable: ${error.message}`); }
  }
  // Human/agent review is bound to this exact plan; stale approvals cannot certify changes.
  let review = null;
  try { review = JSON.parse(fs.readFileSync(path.join(job, 'editorial-review.json'))); } catch {}
  const planHash = sha256(JSON.stringify(plan));
  const required = ['narrationIntelligible', 'captionSync', 'visualRelevance', 'layoutReadable', 'tailIntentional'];
  const contentApproved = review?.planSha256 === planHash && required.every((key) => review.checks?.[key] === true) && typeof review.reviewer === 'string' && Boolean(review.notes);
  checks.editorial = {status: contentApproved ? 'review-record-present' : 'review-required', planSha256: planHash, requiredChecks: required};
  return {errors, warnings, checks, contentApproved};
};

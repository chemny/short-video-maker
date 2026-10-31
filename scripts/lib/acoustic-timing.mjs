import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {commandFromEnv} from './bins.mjs';
import {resolveJobAsset, voiceCleanupFilter, voiceFinalFilter} from './audio-processing.mjs';
import {normalized} from './alignment.mjs';

const RATE = 48000;
const VERSION = 'acoustic-v1';
const hash = value => createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const overlap = (a, b) => a.start < b.end && b.start < a.end;
const sameCues = (a, b) => JSON.stringify(a.map(({id,start,end})=>({id,start,end}))) === JSON.stringify(b.map(({id,start,end})=>({id,start,end})));
const round = n => Math.round(n * RATE) / RATE;
const pcm = file => execFileSync(commandFromEnv('ffmpeg'), ['-v','error','-nostdin','-i',file,'-ar',String(RATE),'-ac','1','-f','s16le','-'], {maxBuffer:128*1024*1024, timeout:180000});
const wav = (data, file) => execFileSync(commandFromEnv('ffmpeg'), ['-v','error','-nostdin','-n','-f','s16le','-ar',String(RATE),'-ac','1','-i','pipe:0','-c:a','pcm_s16le',file], {input:data, maxBuffer:4*1024*1024, timeout:180000});
const config = plan => {
  const c = plan.audio?.timingRepair ?? {};
  const result = {version:VERSION, enabled:c.enabled!==false, silenceDb:-50, minimumOnsetLead:.18, finalOnsetLimit:.2, exportTolerance:.02, onsetLead:.03,
    onsetBridgeGap:.004, minSentencePause:1, maxSentencePause:.75, minWithinPhrasePause:.35, sentenceTail:.25};
  return result;
};
const legacyAcousticPlanHash = plan => hash(JSON.stringify({meta:{duration:plan.meta.durationSeconds,fps:plan.meta.fps},
  scenes:plan.scenes.map(({componentRender,...scene})=>scene), captions:plan.captions, source:plan.audio?.sourceVoiceover??plan.audio?.voiceover,
  sourceMode:plan.audio?.sourceMode, provider:plan.audio?.provider, timingRepair:plan.audio?.timingRepair??null}));

// Visual/component edits must not invalidate audio timing evidence for new reports.
export const acousticPlanHash = plan => hash(JSON.stringify({duration:plan.meta.durationSeconds,fps:plan.meta.fps,scenes:plan.scenes.map(s=>({id:s.id,start:s.start,end:s.end,voiceover:s.voiceover,captionIds:s.captionIds,preservePauses:s.preservePauses,minimumDurationSeconds:s.minimumDurationSeconds,pausePreservationReason:s.pausePreservationReason})),captions:plan.captions,source:plan.audio?.sourceVoiceover??plan.audio?.voiceover,sourceMode:plan.audio?.sourceMode,provider:plan.audio?.provider,timingRepair:plan.audio?.timingRepair??null}));

export const detectVoiceSilences = (file, work, audio = {processing:{normalize:true}}) => {
  const settings = {cleanup:audio.processing?.cleanup??'none',normalize:audio.processing?.normalize??false,volume:audio.voiceVolume??1};
  if(!Number.isFinite(settings.volume)||settings.volume<0||settings.volume>4)throw new Error('Invalid narration gain');
  const normalizedFile = path.join(work, `normalized-${hash(fs.readFileSync(file)).slice(0,16)}-${hash(JSON.stringify(settings)).slice(0,8)}.wav`);
  if (!fs.existsSync(normalizedFile)) execFileSync(commandFromEnv('ffmpeg'), ['-v','error','-nostdin','-n','-i',file,
    '-af',`asetpts=PTS-STARTPTS,${voiceCleanupFilter(settings.cleanup)}volume=${settings.volume},${voiceFinalFilter(settings.normalize)}`,'-ar',String(RATE),'-ac','2','-c:a','pcm_s16le',normalizedFile], {timeout:180000});
  const result = spawnSync(commandFromEnv('ffmpeg'), ['-hide_banner','-nostdin','-i',normalizedFile,'-af','silencedetect=noise=-50dB:d=0.04','-f','null','-'], {encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
  if (result.status !== 0) throw new Error(`Voice silence measurement failed: ${result.error?.message??result.stderr?.slice(-1000)}`);
  const silences=[]; let start;
  for (const m of result.stderr.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1]==='start') start=Number(m[2]); else if(start!==undefined){silences.push({start,end:Number(m[2]),duration:Number(m[2])-start});start=undefined;}
  }
  return silences;
};

export const planRepairs = (plan, silences) => {
  const policy=config(plan), protectedWindows=[];
  for(const s of plan.scenes??[]) if(s.visual?.kind==='video'||s.preservePauses===true) {
    const extra=s.visual?.kind==='video'&&!['cut','none'].includes(s.transition)?12/plan.meta.fps:0;
    protectedWindows.push({start:s.start,end:Math.min(plan.meta.durationSeconds,s.end+extra),sceneId:s.id,
      reason:s.pausePreservationReason??(s.visual?.kind==='video'?'video demonstration and outgoing transition':'explicit scene pause hold')});
  }
  for(const w of plan.audio?.timingRepair?.preserveWindows??[]) {
    if(!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end<=w.start||w.end>plan.meta.durationSeconds+.001||!w.reason?.trim()) throw new Error('preserveWindows requires valid start/end and reason');
    protectedWindows.push({...w});
  }
  const cuts=[],phrases=[],preserved=[],warnings=[];
  for(const gap of silences) {
    if(protectedWindows.some(w=>overlap(gap,w))){if(gap.duration>=.35)preserved.push({...gap,reason:'intersects protected demonstration/hold'});continue;}
    const cue=plan.captions?.find(c=>c.start<=gap.start+.02&&c.end>=gap.end-.02);
    if(cue&&gap.start>cue.start+.12&&gap.end<cue.end-.12&&gap.duration>=policy.minWithinPhrasePause){
      // A pure phrase has no intentional internal punctuation. Other cases need
      // semantic listening; punctuation/ASR text alone never approves prosody.
      const body=cue.text.trim().replace(/[。！？.!?]+$/u,'');
      if(!/[，,；;：:。！？!?、]/u.test(body)&&normalized(body).length>=4){if(!phrases.some(p=>p.captionId===cue.id))phrases.push({captionId:cue.id,start:cue.start,end:cue.end,gap,reason:'unpunctuated approved phrase interrupted by measured silence'});}
      else warnings.push({captionId:cue.id,gap,reason:'internal punctuation/semantic pause requires listening review'});
      continue;
    }
    if(gap.duration<policy.minSentencePause)continue;
    const prev=[...(plan.captions??[])].reverse().find(c=>c.end<=gap.start+.15);
    const next=plan.captions?.find(c=>c.start>=gap.start-.02&&c.start<=gap.end+.15);
    if(prev&&next&&prev.id!==next.id&&/[。！？.!?；;，,：:]\s*$/u.test(prev.text)){
      const remove=gap.duration-policy.maxSentencePause;
      if(remove>.05){const start=round(gap.start+policy.maxSentencePause/2);cuts.push({start,end:round(start+remove),gap,reason:'verified between-caption pause after approved punctuation'});}
    } else warnings.push({gap,reason:'long pause has no reliable sentence-boundary evidence; retained'});
  }
  return {cuts:cuts.filter(c=>!phrases.some(p=>overlap(c,p))),phrases,protectedWindows,preserved,warnings};
};

const mapTime = (value, edits) => {
  let shift=0;
  for(const e of edits){if(value<e.start)break;if(value<e.end)return round(e.start+shift);shift+=e.duration-(e.end-e.start);}
  return round(value+shift);
};
const mapPlan = (plan, edits) => {
  const next=structuredClone(plan);
  next.meta.durationSeconds=mapTime(plan.meta.durationSeconds,edits);
  for(const c of next.captions){
    const originalEnd=c.end;
    c.start=mapTime(c.start,edits);c.end=mapTime(c.end,edits);
    // A hold at the next scene boundary extends the picture, not the old word.
    c.end=round(c.end-edits.filter(e=>e.kind==='demonstration-hold'&&Math.abs(e.start-originalEnd)<.00001).reduce((sum,e)=>sum+e.duration,0));
  }
  for(const s of next.scenes){s.start=mapTime(s.start,edits);s.end=mapTime(s.end,edits);}
  for(const w of next.audio?.timingRepair?.preserveWindows??[]){w.start=mapTime(w.start,edits);w.end=mapTime(w.end,edits);}
  return next;
};
const updateVisualBindings = plan => {
  for(const s of plan.scenes) for(const b of s.visualBindings??[]) if(s.visual?.kind==='video') {
    const cues=plan.captions.filter(c=>b.captionIds.includes(c.id));
    b.sourceStart=(s.visual.sourceStart??0)+cues[0].start-s.start;
    b.sourceEnd=(s.visual.sourceStart??0)+cues.at(-1).end-s.start;
  }
};
const onsetWindows = silences => {
  const merged=[];
  for(const gap of silences){const prev=merged.at(-1);
    // Sub-4ms isolated transients can split an otherwise silent onset and
    // disappear in AAC. Bridge them for display timing only, never audio cuts.
    if(prev&&gap.start-prev.end<=.004){prev.end=gap.end;prev.duration=prev.end-prev.start;prev.bridgedTransients=(prev.bridgedTransients??0)+1;}
    else merged.push({...gap});
  }
  return merged;
};

export const verifyAcousticEvidence = (plan, job) => {
  const state=plan.audio?.acousticTiming;
  if(!state)return null;
  const file=resolveJobAsset(job,state.report), report=read(file);
  const source=resolveJobAsset(job,plan.audio.sourceVoiceover??plan.audio.voiceover);
  if(state.version!==VERSION||hash(fs.readFileSync(file))!==state.reportSha256||report.planSha256!==(report.planHashScope==='timing-v2'?acousticPlanHash(plan):legacyAcousticPlanHash(plan))||report.outputAudioSha256!==hash(fs.readFileSync(source))) throw new Error('Acoustic timing evidence is missing, modified or stale');
  const originalSource=resolveJobAsset(job,report.source), originalAlignment=resolveJobAsset(job,report.originalAlignment.file);
  if(hash(fs.readFileSync(originalSource))!==report.sourceSha256||hash(fs.readFileSync(originalAlignment))!==report.originalAlignment.sha256)throw new Error('Original acoustic alignment/audio evidence was modified');
  const origin=read(originalAlignment);
  if(origin.status!=='matched'||!origin.applied||origin.audioSha256!==report.sourceSha256)throw new Error('Original acoustic observations do not match source audio');
  for(const phrase of report.changes.phraseRepairs){
    const candidate=resolveJobAsset(job,phrase.candidate);
    if(hash(fs.readFileSync(candidate))!==phrase.candidateSha256||phrase.verifiedCandidate.verification.status!=='matched')throw new Error('Acoustic phrase replacement evidence was modified');
  }
  return report;
};

export const inspectExportedCaptionOnsets = (video, plan) => {
  if(!plan.audio?.acousticTiming)return {status:'not-applicable',issues:[]};
  if(plan.audio.bgm||plan.scenes.some(s=>s.visual?.sourceVolume>0))return {status:'isolated-source-verified',issues:[],limits:['Music/native audio masks waveform silence; use isolated narration evidence and master waveform offset verification']};
  const result=spawnSync(commandFromEnv('ffmpeg'),['-hide_banner','-nostdin','-i',video,'-af','silencedetect=noise=-50dB:d=0.04','-f','null','-'],{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
  if(result.status!==0)throw new Error('Final encoded caption-onset measurement failed');
  const gaps=[];let start;
  for(const m of result.stderr.matchAll(/silence_(start|end): ([\d.]+)/g)){if(m[1]==='start')start=Number(m[2]);else if(start!==undefined){gaps.push({start,end:Number(m[2])});start=undefined;}}
  const offset=Math.round((plan.cover.introSeconds??.5)*plan.meta.fps)/plan.meta.fps;
  const issues=plan.captions.flatMap(c=>gaps.filter(g=>g.start<=c.start+offset&&c.start+offset<g.end&&g.end-c.start-offset>=.2).map(g=>({captionId:c.id,silentLead:g.end-c.start-offset})));
  return {status:issues.length?'needs-review':'passed',issues,thresholdSeconds:.2,measured:'final encoded narration without BGM/native audio'};
};

export const repairAcousticTiming = async (planPath, options={}) => {
  const file=path.resolve(planPath), job=path.dirname(file), before=fs.readFileSync(file), plan=JSON.parse(before);
  if(!plan.audio?.voiceover)return {version:VERSION,state:'skipped',reason:'no narration'};
  const policy=config(plan), dir=path.join(job,'alignment');fs.mkdirSync(dir,{recursive:true});
  const source=resolveJobAsset(job,plan.audio.sourceVoiceover??plan.audio.voiceover), sourceHash=hash(fs.readFileSync(source));
  const reportFile=path.join(dir,'acoustic-timing-report.json');
  const stage=fs.mkdtempSync(path.join(job,'.acoustic-'));
  let committing=false, originalAlignmentBytes, priorReportBytes;
  const changes={captionOnsets:[],pauseCuts:[],phraseRepairs:[],demonstrationHolds:[]};
  const report={version:VERSION,planHashScope:'timing-v2',state:'pending',sourceSha256:sourceHash,source:path.relative(job,source),policy,changes,limits:[
    'Normalized isolated-narration silence is an acoustic aid, not phoneme forced alignment or human listening approval',
    'Video demonstrations and explicit holds are preserved; ambiguous punctuation/meaning is retained for listening review',
    'Only accepted text-bound narration is automatically edited; imported narration is audit-only by default']};
  try {
    if(plan.audio.sourceMode==='tts'&&policy.enabled&&plan.audio.acousticTiming?.sourceSha256===sourceHash) {
      const prior=verifyAcousticEvidence(plan,job);return {...prior,reused:true};
    }
    const detect=(audioFile,work)=> (options.detectSilences??detectVoiceSilences)(audioFile,work,plan.audio);
    const silences=await detect(source,stage); const intended=planRepairs(plan,silences);
    Object.assign(report,{inputSilences:silences,protectedWindows:intended.protectedWindows,preserved:intended.preserved,warnings:intended.warnings});
    if(plan.audio.sourceMode!=='tts'||!policy.enabled){report.state='audit-only';report.reason=plan.audio.sourceMode!=='tts'?'imported/provided narration protected':'explicitly disabled';report.outputAudioSha256=sourceHash;write(path.join(dir,'acoustic-timing-audit.json'),report);return report;}
    const alignmentFile=path.join(dir,'alignment-report.json');
    const originalBytes=fs.readFileSync(alignmentFile), original=JSON.parse(originalBytes);
    originalAlignmentBytes=originalBytes;
    if(!original.applied||original.status!=='matched'||original.audioSha256!==sourceHash||original.scriptSha256!==hash(JSON.stringify(plan.captions.map(({id,text})=>({id,text}))))||!sameCues(original.proposed,plan.captions)) throw new Error('Current accepted alignment is missing/stale; no acoustic edits applied');
    const sourcePcm=pcm(source), edits=intended.cuts.map(c=>({...c,duration:0,data:Buffer.alloc(0),kind:'pause-cut'}));
    for(const s of plan.scenes){
      const minimum=s.minimumDurationSeconds;
      if(minimum===undefined)continue;
      if(!Number.isFinite(minimum)||minimum<0||minimum>60)throw new Error('Scene minimumDurationSeconds must be 0..60');
      if(minimum>s.end-s.start+.002){
        if(s.preservePauses!==true&&s.visual?.kind!=='video')throw new Error('Minimum duration requires a demonstration or explicit pause hold');
        const duration=round(minimum-(s.end-s.start));
        edits.push({start:s.end,end:s.end,duration,data:Buffer.alloc(Math.round(duration*RATE)*2),kind:'demonstration-hold',sceneId:s.id,reason:s.pausePreservationReason??'explicit minimum storyboard demonstration duration'});
      }
    }
    const phraseRepair=options.repairPhrase??(await import('../tts/repair-phrase.mjs')).repairPhrase;
    if(intended.phrases.length&&options.allowResynthesis===false)throw new Error('Phrase resynthesis is required but TTS was explicitly disabled; no provider was called');
    for(const item of intended.phrases){
      const caption=plan.captions.find(c=>c.id===item.captionId), scene=plan.scenes.find(s=>s.captionIds?.includes(caption.id));
      const outputDir=path.join(job,'audio/phrase-repairs',hash(JSON.stringify({text:caption.text,provider:plan.audio.provider,model:plan.audio.model,voice:plan.audio.voice})).slice(0,24));
      const result=await phraseRepair({planPath:file,caption,sourceFile:source,outputDir,provider:plan.audio.provider,options:options.phraseOptions??{}});
      if(result.meta?.verification?.status!=='matched'||result.meta.text!==caption.text||result.meta.audioSha256!==hash(fs.readFileSync(result.file))||!result.words?.length)throw new Error('Phrase candidate lacks current audio-bound strict text verification');
      const data=pcm(result.file), duration=data.length/2/RATE;
      let previousWord=0;
      for(const w of result.words){
        if(![w.start,w.end,w.probability].every(Number.isFinite)||w.start<0||w.end<w.start||w.end>duration+.1||w.start<previousWord-.02||w.probability<0||w.probability>1)throw new Error('Phrase candidate has invalid observed word timestamps');
        previousWord=w.end;
      }
      const localGaps=await detect(result.file,stage);const tail=localGaps.find(g=>g.end>=duration-.03)?.duration??0;
      const wanted=Math.max(caption.end-caption.start,duration+Math.max(0,policy.sentenceTail-tail));
      if(wanted>(caption.end-caption.start)+Math.max(2, (caption.end-caption.start)*.5))throw new Error('Phrase candidate changes pacing excessively; listening review required');
      const samples=Math.round(wanted*RATE), out=Buffer.alloc(samples*2);data.copy(out);
      // Match the old phrase's RMS so a locally replaced sentence does not jump in volume.
      const old=sourcePcm.subarray(Math.round(caption.start*RATE)*2,Math.round(caption.end*RATE)*2);
      const rms=b=>{let sum=0;for(let i=0;i<b.length;i+=2)sum+=b.readInt16LE(i)**2;return Math.sqrt(sum/(b.length/2));};
      const gain=Math.max(.25,Math.min(4,rms(old)/Math.max(1,rms(data))));
      for(let i=0;i<data.length;i+=2)out.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(data.readInt16LE(i)*gain))),i);
      edits.push({...item,kind:'phrase-repair',duration:samples/RATE,data:out,result,gain,sceneId:scene?.id});
    }
    edits.sort((a,b)=>a.start-b.start);
    for(let i=1;i<edits.length;i++)if(edits[i].start<edits[i-1].end-.0001)throw new Error('Acoustic edits overlap; original retained');
    const parts=[];let cursor=0;
    for(const e of edits){const start=Math.round(e.start*RATE)*2,end=Math.round(e.end*RATE)*2;parts.push(sourcePcm.subarray(cursor,start),e.data);cursor=end;}
    parts.push(sourcePcm.subarray(cursor));const edited=edits.length?Buffer.concat(parts):sourcePcm;
    const candidate=path.join(stage,'narration.wav'); if(edits.length)wav(edited,candidate);
    const measuredFile=edits.length?candidate:source;
    const actualDuration=edited.length/2/RATE;
    const next=mapPlan(plan,edits); next.meta.durationSeconds=actualDuration;
    for(const e of edits){
      if(e.kind==='pause-cut')changes.pauseCuts.push({start:e.start,end:e.end,removedSeconds:e.end-e.start,gap:e.gap,reason:e.reason});
      else if(e.kind==='demonstration-hold')changes.demonstrationHolds.push({sceneId:e.sceneId,at:e.start,addedSeconds:e.duration,reason:e.reason});
      else {
        const c=next.captions.find(c=>c.id===e.captionId), base=mapTime(e.start,edits);
        c.start=round(base+e.result.words[0].start);c.end=round(Math.min(base+e.duration,e.result.words.at(-1).end+base+.08));
        changes.phraseRepairs.push({captionId:e.captionId,originalWindow:[e.start,e.end],outputWindow:[base,base+e.duration],rmsGain:e.gain,tempo:1,
          originalGap:e.gap,verifiedCandidate:e.result.meta,words:e.result.words,candidate:path.relative(job,e.result.file),candidateSha256:hash(fs.readFileSync(e.result.file))});
      }
    }
    const outputSilences=await detect(measuredFile,stage);
    const onsetSilences=onsetWindows(outputSilences);
    for(const c of next.captions){const gap=onsetSilences.find(g=>g.start<=c.start&&c.start<g.end&&g.end-c.start>=policy.minimumOnsetLead);
      if(gap){const after=round(gap.end-policy.onsetLead);if(after<c.end-.05){changes.captionOnsets.push({captionId:c.id,before:c.start,after,gap,reason:'normalized isolated voice; retain 30ms lead'});c.start=after;}}
    }
    updateVisualBindings(next);
    let previous=0;for(const c of next.captions){if(![c.start,c.end].every(Number.isFinite)||c.start<previous-.001||c.end<=c.start||c.end>actualDuration+.05)throw new Error(`Repair creates invalid caption ${c.id}`);previous=c.end;}
    const residual=planRepairs(next,outputSilences);
    if(residual.cuts.length||residual.phrases.length)throw new Error('Acoustic problem persists after candidate repair; original plan retained');
    const outputHash=hash(fs.readFileSync(measuredFile));
    let destination=source;
    if(edits.length){destination=path.join(job,'audio/source',`acoustic-${outputHash.slice(0,24)}.wav`);fs.mkdirSync(path.dirname(destination),{recursive:true});
      if(fs.existsSync(destination)&&hash(fs.readFileSync(destination))!==outputHash)throw new Error('Acoustic audio snapshot was modified');
      if(!fs.existsSync(destination))fs.copyFileSync(measuredFile,destination,fs.constants.COPYFILE_EXCL);
      next.audio.sourceVoiceover=path.relative(job,destination);next.audio.voiceover=path.relative(job,destination);delete next.audio.mix;delete next.audio.mixIncludesBgm;
    }
    const alignmentSnapshot=`acoustic-original-${hash(originalBytes).slice(0,24)}.json`;
    if(!fs.existsSync(path.join(dir,alignmentSnapshot)))fs.writeFileSync(path.join(dir,alignmentSnapshot),originalBytes, {flag:'wx'});
    const alignment={...original,audioSha256:outputHash,proposed:next.captions.map(c=>({...original.proposed.find(p=>p.id===c.id),...c})),
      acousticRefinement:{version:VERSION,originalAlignment:alignmentSnapshot,originalAlignmentSha256:hash(originalBytes),inputAudioSha256:sourceHash,outputAudioSha256:outputHash,report:'acoustic-timing-report.json'},
      limits:[...(original.limits??[]),'Original ASR/provider observations preserved; current cue times include separately evidenced acoustic edits']};
    for(const p of changes.phraseRepairs){alignment.proposed.find(c=>c.id===p.captionId).alignment=p.verifiedCandidate.verification.proposed[0].alignment;}
    next.audio.acousticTiming={version:VERSION,report:'alignment/acoustic-timing-report.json',sourceSha256:outputHash};
    report.state=edits.length||changes.captionOnsets.length?'applied':'verified';report.outputAudioSha256=outputHash;report.outputSource=path.relative(job,destination);
    report.outputPcmSha256=hash(edited);report.inputPcmSha256=hash(sourcePcm);report.outputSilences=outputSilences;report.onsetWindows=onsetSilences;
    report.outputProtectedWindows=intended.protectedWindows.map(w=>({...w,start:mapTime(w.start,edits),end:mapTime(w.end,edits)}));
    report.originalAlignment={file:`alignment/${alignmentSnapshot}`,sha256:hash(originalBytes)};
    report.planSha256=acousticPlanHash(next);
    const reportBytes=Buffer.from(`${JSON.stringify(report,null,2)}\n`);next.audio.acousticTiming.reportSha256=hash(reportBytes);
    // All synthesis, matching, audio measurements and candidate checks succeeded.
    // Canonical evidence and the plan are committed last; old sources/output remain.
    if(!fs.readFileSync(file).equals(before)||!fs.readFileSync(alignmentFile).equals(originalBytes))throw new Error('Plan/alignment changed during repair; original candidate was not committed');
    fs.writeFileSync(path.join(dir,`plan-before-acoustic-${hash(before).slice(0,24)}.json`),before);
    priorReportBytes=fs.existsSync(reportFile)?fs.readFileSync(reportFile):null;committing=true;
    fs.writeFileSync(reportFile,reportBytes);write(alignmentFile,alignment);write(file,next);
    return report;
  }catch(error){
    if(committing){
      const failures=[];
      for(const [target,bytes] of [[file,before],[path.join(dir,'alignment-report.json'),originalAlignmentBytes],[reportFile,priorReportBytes]])try{if(bytes===null)fs.rmSync(target,{force:true});else fs.writeFileSync(target,bytes);}catch(restore){failures.push(restore.message);}
      if(failures.length)error.message+=`; rollback incomplete: ${failures.join('; ')}`;
    }
    report.state='needs-review';report.error=error.message;write(path.join(dir,`acoustic-timing-rejected-${Date.now()}.json`),report);error.acousticTimingBlocked=true;throw error;
  }
  finally{fs.rmSync(stage,{recursive:true,force:true});}
};

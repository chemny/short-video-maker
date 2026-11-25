import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeCaptions} from './captions.mjs';
import {commandFromEnv} from './bins.mjs';
import {audioStats, LIMITS as REVIEW_LIMITS} from './film-review.mjs';

// Delivery package for a shot film: script.md, captions.srt, publish.md, metadata.json beside video.mp4 and cover.png, and the final
// check of the rendered file. Provenance comes from the research records; a picture without a rights note blocks delivery.
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
export const sha256File = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function materialsUsed(job, script, inventory) {
  const sources = readJson(path.join(job, 'research/sources.json'), {sources: []}).sources;
  const downloads = readJson(path.join(job, 'research/downloads.json'), {downloads: []}).downloads;
  const ids = [...new Set(script.beats.flatMap((b) => [b.material, b.materialB]).filter(Boolean))];
  return ids.map((id) => {
    const item = inventory.get(id) ?? {}, d = downloads.find((x) => x.mediaId === id), src = sources.find((s) => s.id === (d?.sourceId ?? item.sourceId));
    const file = item.file && fs.existsSync(path.join(job, item.file)) ? item.file : null;
    const note = script.provenance?.[id];
    return {id, kind: item.kind ?? null, file, sha256: file ? sha256File(path.join(job, file)) : null, origin: item.origin ?? 'unknown', sourceUrl: d?.finalUrl ?? d?.candidateUrl ?? src?.url ?? null,
      sourceTitle: src?.title ?? null, fetchedAt: d?.fetchedAt ?? null, acquisition: d?.acquisition ?? item.acquisition ?? null, rightsNote: d?.rightsNote ?? note ?? null,
      rights: d?.rightsNote || note ? 'noted' : 'unknown', relevance: d?.relevanceReason ?? null, aiGenerated: /ai|generated|生成/i.test(String(note ?? '')) || undefined};
  });
}

export function deliveryProblems(script, materials) {
  const problems = [];
  const pub = script.publish ?? {};
  for (const [key, label] of [['douyin', '抖音'], ['channels', '视频号']]) {
    const p = pub[key];
    if (!p || !String(p.title ?? '').trim() || !String(p.body ?? '').trim() || !Array.isArray(p.tags) || !p.tags.length) problems.push(`publish.${key} (${label}) needs title, body and at least one tag`);
    else if ([...String(p.title)].length > 30) problems.push(`publish.${key}.title is ${[...String(p.title)].length} characters; keep it within 30`);
  }
  if (pub.douyin && pub.channels && pub.douyin.title === pub.channels.title && pub.douyin.body === pub.channels.body) problems.push('publish.douyin and publish.channels are identical; platform copy must be written separately');
  for (const m of materials) if (m.rights !== 'noted') problems.push(`material ${m.id} has no rights note; record one when downloading, or add provenance.${m.id} to the shot script (who owns it and how it may be used)`);
  for (const m of materials) if (!m.file) problems.push(`material ${m.id} is not on disk`);
  return problems;
}

const tags = (platform, list) => list.map((t) => `#${String(t).replaceAll('#', '')}`).join(' ');
export function writePackage({job, script, film, materials, outDir, narration, review, bgm}) {
  fs.mkdirSync(outDir, {recursive: true});
  writeCaptions(film.captions.map((c, i) => ({id: `cap-${i + 1}`, ...c})), outDir);
  const byMaterial = new Map(materials.map((m) => [m.id, m]));
  const md = [`# ${script.title ?? script.topic}`, '', `主题：${script.topic ?? ''}`, `时长：${(film.durationInFrames / film.fps).toFixed(1)}s`, '', '## 分镜脚本', '',
    ...script.beats.flatMap((b, i) => { const s = film.shots[i], m = byMaterial.get(b.material); return [`### ${i + 1}. ${b.id}`, '', `时间：${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s`, '', `旁白：${b.narration}`, '',
      `画面：${b.rung}${m ? `，${m.id}（${m.sourceTitle ?? m.origin}）` : ''}，镜头 ${b.move}`, '', `理由：${b.why}`, '']; })].join('\n');
  fs.writeFileSync(path.join(outDir, 'script.md'), `${md}\n`);
  const pub = script.publish;
  fs.writeFileSync(path.join(outDir, 'publish.md'), [`# ${script.title ?? script.topic}`, '', ...[['抖音', pub.douyin], ['视频号', pub.channels]].flatMap(([n, p]) => [`## ${n}`, '', `标题：${p.title}`, '', p.body, '', tags(n, p.tags), '', ...(p.comment ? [`评论引导：${p.comment}`, ''] : [])])].join('\n'));
  const sources = materials.filter((m) => m.sourceUrl).map((m) => `- ${m.id}: ${m.sourceTitle ?? ''} ${m.sourceUrl} (${m.rightsNote})`);
  fs.writeFileSync(path.join(outDir, 'sources.md'), ['# 素材来源与权利记录', '', ...sources, '', '权利说明是记录的陈述，不是授权推断。', ''].join('\n'));
  const files = {};
  for (const f of ['video.mp4', 'cover.png']) if (fs.existsSync(path.join(outDir, f))) files[f] = {sha256: sha256File(path.join(outDir, f)), bytes: fs.statSync(path.join(outDir, f)).size};
  const meta = {title: script.title ?? script.topic, topic: script.topic, durationSeconds: Math.round((film.durationInFrames / film.fps) * 100) / 100, shots: film.shots.length,
    narration, music: bgm ? {file: bgm.src, synthetic: Boolean(bgm.synthetic), targetLufs: bgm.targetLufs, credit: script.bgm?.credit ?? null} : null, soundEffects: 'synthesised with FFmpeg, no third-party material',
    materials: materials.map(({sha256, ...m}) => ({...m, sha256})), review, files, generatedAt: new Date().toISOString(),
    limits: 'The review verdict records measurements and a frame review of still frames. Sound was measured, not auditioned. Safe-area values are estimates, not measured on the apps.'};
  fs.writeFileSync(path.join(outDir, 'metadata.json'), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

export function finalCheck(videoFile, film) {
  const checks = [], add = (id, status, shown, rule) => checks.push({id, status, shown, rule});
  const r = spawnSync(commandFromEnv('ffprobe'), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', videoFile], {encoding: 'utf8'});
  let info; try { info = JSON.parse(r.stdout); } catch { add('probe', 'fail', 'unreadable', 'ffprobe reads the file'); return checks; }
  const v = info.streams.find((s) => s.codec_type === 'video'), a = info.streams.find((s) => s.codec_type === 'audio'), dur = Number(info.format.duration), want = film.durationInFrames / film.fps;
  add('size', v?.width === 1080 && v?.height === 1920 ? 'pass' : 'fail', `${v?.width}x${v?.height}`, '1080x1920');
  const [num, den] = String(v?.r_frame_rate ?? '0/1').split('/').map(Number);
  add('fps', v && Math.abs(num / (den || 1) - film.fps) < 0.01 ? 'pass' : 'fail', v?.r_frame_rate ?? 'none', `${film.fps} fps`);
  add('audio', a ? 'pass' : 'fail', a ? `${a.codec_name}` : 'no audio stream', 'an audio stream');
  add('duration', Math.abs(dur - want) <= 0.2 ? 'pass' : 'fail', `${dur.toFixed(2)} s (film ${want.toFixed(2)} s)`, 'within 0.2 s of the film');
  if (a) {
    const ad = Number(a.duration ?? dur);
    add('avSync', Math.abs(ad - Number(v.duration ?? dur)) <= 0.25 ? 'pass' : 'fail', `audio ${ad.toFixed(2)} s, video ${Number(v.duration ?? dur).toFixed(2)} s`, 'stream lengths within 0.25 s');
    const st = audioStats(videoFile), L = REVIEW_LIMITS;
    add('loudness', st.lufs != null && st.lufs >= L.loudness.low && st.lufs <= L.loudness.high ? 'pass' : 'warn', `${st.lufs} LUFS`, `${L.loudness.low} to ${L.loudness.high} LUFS`);
    add('peak', st.peak != null && st.peak > L.peak.fail ? 'fail' : 'pass', `${st.peak} dBFS`, `at most ${L.peak.fail} dBFS`);
  }
  return checks;
}

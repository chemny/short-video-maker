#!/usr/bin/env node
// Transition and layout sampler: every entry effect and picture layout shown on the job's own pictures, labelled on screen, as a video
// and a sheet of frames across each transition. Used to choose which effects a film may use (references/shot-script.md, step 8).
//   node scripts/render-transition-sampler.mjs <job> [--scale=0.5]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {loadInventory} from './lib/shot-script.mjs';
import {commandFromEnv} from './lib/bins.mjs';

const [jobArg, ...args] = process.argv.slice(2);
const option = (name) => args.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!jobArg) { console.error('Usage: node scripts/render-transition-sampler.mjs <job> [--scale=0.5]'); process.exit(2); }
const job = fs.realpathSync(jobArg), remotion = fileURLToPath(new URL('../remotion/', import.meta.url)), bin = path.join(remotion, 'node_modules/.bin/remotion');
const inventory = loadInventory(job);
if (!inventory) throw new Error('research/visual-inventory.json is missing');
// pictures: those the shot script uses first (in order), then any other usable image on disk
const used = (() => { try { return JSON.parse(fs.readFileSync(path.join(job, 'shot-script.json'), 'utf8')).beats.flatMap((b) => [b.material, b.materialB]).filter(Boolean); } catch { return []; } })();
const usable = (i) => i && i.status === 'on-disk' && i.kind === 'image' && i.grade !== 'X' && i.width > 0 && i.file && fs.existsSync(path.join(job, i.file));
const pics = [...new Set([...used, ...inventory.keys()])].map((id) => inventory.get(id)).filter(usable)
  .map((i) => ({kind: 'image', src: i.file, mw: i.width, mh: i.height, landscape: i.width / i.height > 0.9}));
if (pics.length < 4) throw new Error('need at least four pictures on disk');
const land = pics.filter((p) => p.landscape), pool = [...land, ...pics.filter((p) => !p.landscape)];

const FRAMES = {cut: 0, dissolve: 9, slide: 8, push: 10, stack: 11, wipe: 10, zoom: 10, blur: 7};
const NAMES = {cut: '硬切', dissolve: '淡入', slide: '上浮', push: '推出', stack: '叠放', wipe: '擦除', zoom: '穿入', blur: '模糊切'};
const SUB = {cut: '没有过渡，节奏最快', dissolve: '0.3 秒淡入，用于换章节和结尾', slide: '带一点上浮的淡入', push: '新画面把旧画面推走', stack: '新卡片滑过来，旧画面缩小变暗',
  wipe: '从焦点处圆形展开', zoom: '旧画面放大，新画面从大变正常', blur: '模糊到清晰，用于快节奏'};
const plan = [
  {label: '硬切', type: 'cut', sub: SUB.cut}, {label: NAMES.push, type: 'push', dir: 'left', sub: SUB.push}, {label: NAMES.stack, type: 'stack', dir: 'up', sub: SUB.stack},
  {label: NAMES.wipe, type: 'wipe', sub: SUB.wipe}, {label: NAMES.zoom, type: 'zoom', sub: SUB.zoom}, {label: NAMES.blur, type: 'blur', sub: SUB.blur},
  {label: NAMES.dissolve, type: 'dissolve', sub: SUB.dissolve}, {label: NAMES.slide, type: 'slide', sub: SUB.slide},
  {label: '悬浮卡片', type: 'dissolve', layout: 'float', sub: '卡片慢慢倾斜，背景反向漂移'}, {label: '错位叠放', type: 'dissolve', layout: 'stack', sub: '后面叠一张相关画面'},
];
const HOLD = 2.5;
const shots = [], labels = [];
const pick = (i) => pool[i % pool.length];
shots.push({id: 's0', start: 0, end: HOLD, rung: 'image', move: 'push', media: pick(0), transition: 'cut'});
plan.forEach((c, i) => {
  const start = HOLD * (i + 1), media = pick(i + 1), s = {id: `s${i + 1}`, start, end: start + HOLD, rung: 'image', move: 'push', media, transition: c.type, ...(c.dir ? {dir: c.dir} : {}), ...(c.layout ? {layout: c.layout, mediaB: pick(i + 2)} : {})};
  if (c.type === 'wipe') { s.region = {x: 0.3, y: 0.3, w: 0.4, h: 0.4}; }
  shots.push(s);
  const nextLead = plan[i + 1] ? FRAMES[plan[i + 1].type] / 30 : 0;
  labels.push({start: start - FRAMES[c.type] / 30 + 0.05, end: start + HOLD - nextLead - 0.08, text: c.label, sub: c.sub});
});
const end = HOLD * (plan.length + 1);
const film = {fps: 30, durationInFrames: Math.ceil(end * 30), theme: 'dark', shots, captions: [], labels};
const out = path.join(job, 'output/sampler'); fs.mkdirSync(out, {recursive: true});
const props = path.join(out, 'sampler-film.json'); fs.writeFileSync(props, `${JSON.stringify(film, null, 2)}\n`);
const mp4 = path.join(out, 'transition-sampler.mp4');
execFileSync(bin, ['render', 'src/templates/frame/shots/index.tsx', 'ShotFilm', mp4, '--codec=h264', '--props', props, '--public-dir', job, '--log=error', `--scale=${option('scale') ?? '0.5'}`], {cwd: remotion, stdio: 'inherit', timeout: 1800000});

// a strip of frames across each transition, one row per effect
const rows = [];
plan.slice(0, 8).forEach((c, i) => {
  const lead = FRAMES[c.type] / 30, t0 = HOLD * (i + 1) - lead - 0.05, t1 = HOLD * (i + 1) + 0.15, strip = path.join(out, `strip-${i + 1}.png`);
  const times = Array.from({length: 6}, (_, k) => t0 + ((t1 - t0) * k) / 5);
  execFileSync(commandFromEnv('ffmpeg'), ['-hide_banner', '-v', 'error', '-nostdin', '-y', '-i', mp4, '-vf', `select='${times.map((t) => `eq(n,${Math.round(t * 30)})`).join('+')}',scale=200:-1,tile=6x1`, '-frames:v', '1', strip], {stdio: 'inherit'});
  rows.push(strip);
});
const sheet = path.join(out, 'transition-sheet.png');
execFileSync(commandFromEnv('ffmpeg'), ['-hide_banner', '-v', 'error', '-nostdin', '-y', ...rows.flatMap((r) => ['-i', r]), '-filter_complex', `vstack=inputs=${rows.length}`, sheet], {stdio: 'inherit'});
console.log(`sampler: ${mp4}\nsheet: ${sheet} (rows: ${plan.slice(0, 8).map((c) => c.label).join(', ')}; six frames across each, labelled in the video)`);

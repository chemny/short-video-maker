import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {scanAssets, chooseAsset} from '../scripts/lib/media-assets.mjs';
import {prepareAudio} from '../scripts/lib/audio-processing.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const command = (bin, args, options = {}) => execFileSync(bin, args, {stdio: 'pipe', timeout: 180000, ...options}).toString();
const ffmpeg = (args) => command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args]);
const cli = (script, args, skillRoot = root) => command(process.execPath, [path.join(skillRoot, 'scripts', script), ...args]);
const failure = (script, args) => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {encoding: 'utf8', timeout: 30000});
  assert.notEqual(result.status, 0);
  return result.stderr;
};

test('material intake and shared production preserve sources, timing and job identity', async (t) => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'short-video-phase1-')));
  t.after(() => fs.rmSync(workspace, {recursive: true, force: true}));
  const materials = path.join(workspace, '原素材 with spaces');
  const job = path.join(workspace, 'material job');
  fs.mkdirSync(materials); fs.mkdirSync(job);
  const voice = path.join(materials, 'narration.wav');
  const music = path.join(materials, 'music.mp4');
  const image = path.join(materials, '图解.png');
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=1000:duration=3', voice]);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=30:d=1', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', music]);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=orange:s=320x568', '-frames:v', '1', image]);
  const hashes = [voice, music, image].map(digest);
  const planPath = path.join(job, 'video-plan.json');
  const initial = json(path.join(root, 'examples', 'material-plan.json'));
  initial.meta.width = 320; initial.meta.height = 568;
  initial.cover.introSeconds = 0.5;
  write(planPath, initial);
  const map = path.join(workspace, 'scene-map.json');
  write(map, {'scene-01': '图解.png'});
  const importArgs = [job, `--input-dir=${materials}`, '--narration=narration.wav', '--music=music.mp4', `--scene-map=${map}`];

  await t.test('inventory probes video/audio/image and does not identify arbitrary long media as speech', () => {
    fs.writeFileSync(path.join(materials, 'notes.md'), 'not an automatically selected script');
    fs.symlinkSync(materials, path.join(materials, 'recursive-link'));
    const inventory = scanAssets(materials);
    assert.equal(inventory.assets.length, 4);
    assert.equal(inventory.assets.find((item) => item.kind === 'video').hasAudio, true);
    assert.equal(inventory.assets.find((item) => item.kind === 'image').width, 320);
    assert.equal(chooseAsset(inventory, 'narration', undefined, {required: true}).path, voice);
  });

  await t.test('multiple voice candidates are rejected without changing plan or choosing the longest', () => {
    fs.copyFileSync(voice, path.join(materials, 'voice-second.wav'));
    const before = digest(planPath);
    assert.match(failure('import-media.mjs', [job, `--input-dir=${materials}`]), /Select --narration/);
    assert.equal(digest(planPath), before);
    fs.rmSync(path.join(materials, 'voice-second.wav'));
  });

  await t.test('mismatched timing and video-as-image are rejected before import', () => {
    write(planPath, {...initial, meta: {...initial.meta, durationSeconds: 9}});
    const before = digest(planPath);
    assert.match(failure('import-media.mjs', importArgs), /duration.*differ/);
    assert.equal(digest(planPath), before);
    write(planPath, initial);
    write(map, {'scene-01': 'music.mp4'});
    assert.match(failure('import-media.mjs', importArgs), /phase-2 feature/);
    write(map, {'scene-01': '图解.png'});
  });

  await t.test('explicit import copies assets and preserves the authored timeline', () => {
    cli('import-media.mjs', importArgs);
    const plan = json(planPath);
    assert.deepEqual(plan.captions, initial.captions);
    assert.deepEqual(plan.scenes.map(({start, end}) => ({start, end})), initial.scenes.map(({start, end}) => ({start, end})));
    assert.equal(plan.audio.sourceMode, 'imported');
    assert.equal(digest(path.join(job, plan.audio.voiceover)), hashes[0]);
    assert.equal(digest(path.join(job, plan.scenes[0].visual.asset)), hashes[2]);
    assert.equal(json(path.join(job, 'manifest.json')).selections.narration, voice);
    assert.deepEqual([voice, music, image].map(digest), hashes);
    assert.match(failure('run-job.mjs', [job, '--tts=edge']), /must not be replaced/);
    assert.match(failure('tts.mjs', ['generate', planPath, '--provider=local']), /must not be replaced/);
  });

  await t.test('audio preparation is repeatable, preserves timing, and supports actual ducking/cleanup', () => {
    const before = json(planPath);
    const report = prepareAudio(planPath);
    assert.equal(report.mixIncludesBgm, true);
    const hash = digest(path.join(job, report.mix));
    assert.equal(prepareAudio(planPath).mix, report.mix);
    assert.equal(digest(path.join(job, report.mix)), hash);
    assert.deepEqual(json(planPath).captions, before.captions);
    const bandVolume = (file) => {
      const result = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'bandpass=f=330:t=h:width=30,volumedetect', '-f', 'null', '-'], {encoding: 'utf8'});
      assert.equal(result.status, 0);
      return Number(result.stderr.match(/mean_volume: ([\d.-]+)/)[1]);
    };
    const duckedVolume = bandVolume(path.join(job, report.mix));
    const unducked = json(planPath); unducked.audio.duckBgm = false; write(planPath, unducked);
    const unduckedReport = prepareAudio(planPath);
    assert.ok(bandVolume(path.join(job, unduckedReport.mix)) > duckedVolume + 1, 'BGM is measurably reduced under narration');
    const clean = json(planPath); clean.audio.processing = {cleanup: 'light', normalize: true}; write(planPath, clean);
    assert.equal(prepareAudio(planPath).timingPreserved, true);
    cli('attach-bgm.mjs', [planPath, `--file=${json(planPath).audio.bgm}`, '--volume=0.1']);
    assert.equal(json(planPath).audio.mix, undefined, 'Changing BGM invalidates a prior mix');
    assert.equal(json(planPath).audio.sourceBgm, undefined);
    prepareAudio(planPath);
    assert.deepEqual([voice, music, image].map(digest), hashes);
  });

  await t.test('prepared jobs use one package path and preserve earlier deliveries', () => {
    cli('run-job.mjs', [job]); // No --tts needed: imported narration must stay offline.
    const output = path.join(job, 'output');
    assert.equal(json(path.join(output, 'delivery-status.json')).rendered, false);
    assert.equal(json(path.join(output, 'metadata.json')).subtitleOffsetSeconds, 0.5);
    assert.match(fs.readFileSync(path.join(output, 'captions.srt'), 'utf8'), /00:00:00,500 --> 00:00:03,500/);
    fs.writeFileSync(path.join(output, 'video.mp4'), 'previous delivery marker');
    cli('run-job.mjs', [job]);
    assert.equal(fs.existsSync(path.join(output, 'video.mp4')), false);
    const history = fs.readdirSync(path.join(job, 'history'));
    assert.ok(history.some((entry) => {
      const file = path.join(job, 'history', entry, 'video.mp4');
      return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === 'previous delivery marker';
    }));
    assert.match(failure('quality-check.mjs', [planPath, output, '--require-render']), /video.mp4 is missing/);
  });

  await t.test('legacy authored audio jobs and explicit no-music selection still work', () => {
    cli('import-media.mjs', [...importArgs.filter((arg) => !arg.startsWith('--music=')), '--music=none']);
    const legacy = json(planPath); delete legacy.audio.sourceMode; delete legacy.audio.timingSource; write(planPath, legacy);
    cli('run-job.mjs', [job, '--tts=none']);
    assert.equal(json(planPath).audio.mixIncludesBgm, false);
    assert.deepEqual(json(planPath).captions, initial.captions);
    cli('import-media.mjs', importArgs);
  });

  await t.test('both media and TTS routes render using shared source with isolated job props', {skip: process.env.SHORT_VIDEO_RENDER_SMOKE !== '1'}, () => {
    const isolated = path.join(workspace, 'isolated-skill');
    fs.mkdirSync(path.join(isolated, 'remotion'), {recursive: true});
    fs.cpSync(path.join(root, 'scripts'), path.join(isolated, 'scripts'), {recursive: true});
    fs.cpSync(path.join(root, 'components'), path.join(isolated, 'components'), {recursive: true});
    fs.cpSync(path.join(root, 'remotion', 'src'), path.join(isolated, 'remotion', 'src'), {recursive: true});
    for (const file of ['package.json', 'tsconfig.json']) fs.copyFileSync(path.join(root, 'remotion', file), path.join(isolated, 'remotion', file));
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(isolated, 'node_modules'));
    fs.symlinkSync(path.join(root, 'remotion', 'node_modules'), path.join(isolated, 'remotion', 'node_modules'));
    const browser = process.env.REMOTION_BROWSER_EXECUTABLE;
    assert.ok(browser && fs.existsSync(browser), 'Use an installed browser; do not download one for this smoke check');
    cli('run-job.mjs', [job, '--preview-frame=30', '--render', '--confirmed-render'], isolated);
    const result = json(path.join(job, 'output', 'delivery-status.json'));
    assert.equal(result.rendered, true);
    // Audible gain should remain unchanged through rendering (no double voice/BGM).
    const meanVolume = (file, from) => {
      const result = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(from), '-i', file, '-t', '2', '-af', 'volumedetect', '-vn', '-f', 'null', '-'], {encoding: 'utf8'});
      assert.equal(result.status, 0);
      return Number(result.stderr.match(/mean_volume: ([\d.-]+)/)[1]);
    };
    const plan = json(planPath);
    assert.ok(Math.abs(meanVolume(path.join(job, plan.audio.mix), 0.2) - meanVolume(path.join(job, 'output', 'video.mp4'), 0.7)) < 1, 'rendered audio is not doubled');
    // Same compiled source must pick the second job dimensions/duration from props.
    const ttsJob = path.join(workspace, 'tts job'); fs.mkdirSync(ttsJob);
    const ttsPlan = structuredClone(initial);
    ttsPlan.meta.width = 640; ttsPlan.meta.height = 360;
    ttsPlan.scenes[0].voiceover = '这是本地配音测试。';
    ttsPlan.captions = [{id: 'local-c1', text: ttsPlan.scenes[0].voiceover, start: 0, end: ttsPlan.meta.durationSeconds}];
    ttsPlan.scenes[0].captionIds = ['local-c1'];
    ttsPlan.style.template = 'clean-explainer';
    write(path.join(ttsJob, 'video-plan.json'), ttsPlan);
    cli('run-job.mjs', [ttsJob, '--tts=local', '--render', '--confirmed-render'], isolated);
    const info = JSON.parse(command('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', path.join(ttsJob, 'output', 'video.mp4')]));
    assert.equal(info.streams.find((stream) => stream.codec_type === 'video').width, 640);
    assert.ok(info.streams.some((stream) => stream.codec_type === 'audio'));
    assert.equal(json(path.join(job, 'output', 'video-plan.json')).meta.width, 320);
    assert.deepEqual([voice, music, image].map(digest), hashes);
    // Write only a compact report; synthetic media and isolated source are temporary.
    console.log('Render smoke passed: imported material/BGM and local TTS, per-job dimensions and no doubled audio.');
  });
});

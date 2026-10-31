import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svm-asr-readiness-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const model = path.join(dir, 'mlx'); fs.mkdirSync(model);
  fs.writeFileSync(path.join(model, 'config.json'), '{}');
  fs.writeFileSync(path.join(model, 'weights.safetensors'), 'fixture');
  const torch = path.join(dir, 'available.pt'); fs.writeFileSync(torch, 'torch fixture');
  const runtime = path.join(dir, 'vox'); fs.mkdirSync(path.join(runtime, '.venv/bin'), {recursive: true});
  fs.writeFileSync(path.join(runtime, 'generate.py'), '# fixture');
  fs.writeFileSync(path.join(runtime, 'model-spec.json'), JSON.stringify({repository: 'fixture', revision: 'fixture'}));
  const python = path.join(runtime, '.venv/bin/python'), log = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(python, `#!${process.execPath}
import fs from 'node:fs';
const args=process.argv.slice(2);
fs.appendFileSync(process.env.ASR_PROBE_LOG,JSON.stringify(args)+'\\n');
if(args.some(a=>a.includes('import whisper,torch')) || (process.env.FAIL_MLX_PROBE==='1' && args.some(a=>a.includes('from mlx_audio.stt.models.whisper')))) process.exit(1);
if(args.some(a=>a.endsWith('normalize-chinese.py'))) console.log(JSON.stringify(['语音']));
`); fs.chmodSync(python, 0o755);
  const env = {...process.env, SHORT_VIDEO_MLX_WHISPER_MODEL: model, SHORT_VIDEO_WHISPER_MODEL: torch,
    SHORT_VIDEO_MLX_PYTHON: python, SHORT_VIDEO_VOXCPM2_DIR: runtime, PYTHON3_BIN: python,
    SHORT_VIDEO_TTS_PROVIDER: 'auto', ASR_PROBE_LOG: log, FAIL_MLX_PROBE: '0'};
  return {dir, model, python, log, env};
};
const probe = env => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
import {inspectLocalAsr} from './scripts/lib/local-asr.mjs';
import {localCapability,selectProvider} from './scripts/tts/select-provider.mjs';
const asr=inspectLocalAsr();const capability=localCapability();
console.log(JSON.stringify({asr,capability,selection:selectProvider({capability:()=>capability})}));
`], {cwd: root, env, encoding: 'utf8'}));

test('readiness honors selected MLX runtime without requiring an unused Torch backend', t => {
  const f = fixture(t), result = probe(f.env);
  assert.equal(result.asr.ready, true);
  assert.equal(result.asr.runtime.backend, 'mlx');
  assert.equal(result.asr.runtime.model, f.model);
  assert.equal(result.asr.runtime.python, f.python);
  assert.equal(result.asr.runtime.modelSha256, undefined, 'readiness must not hash model weights');
  assert.equal(result.capability.ready, true);
  assert.equal(result.selection.provider, 'voxcpm2');
  const calls = fs.readFileSync(f.log, 'utf8');
  assert.match(calls, /from mlx_audio.stt.models.whisper/);
  assert.match(calls, /normalize-chinese.py/);
  assert.doesNotMatch(calls, /import whisper,torch/);
});

test('missing selected MLX model cannot be masked by available legacy Torch weights or a passing doctor', t => {
  const f = fixture(t), env = {...f.env, SHORT_VIDEO_MLX_WHISPER_MODEL: path.join(f.dir, 'missing')};
  const result = probe(env);
  assert.equal(result.asr.ready, false);
  assert.equal(result.asr.stage, 'model');
  assert.equal(result.capability.ready, false);
  assert.equal(result.selection.provider, 'edge');
  const doctor = spawnSync(process.execPath, ['scripts/doctor.mjs'], {cwd: root, env, encoding: 'utf8'});
  assert.equal(doctor.status, 1);
  assert.match(doctor.stdout, /FAIL selected local ASR/);
  assert.match(doctor.stdout, /missing/);
  assert.doesNotMatch(doctor.stdout, /Doctor passed/);
});

test('broken selected MLX interpreter blocks readiness even when another ASR model exists', t => {
  const f = fixture(t), result = probe({...f.env, FAIL_MLX_PROBE: '1'});
  assert.equal(result.asr.ready, false);
  assert.equal(result.asr.stage, 'inference-runtime');
  assert.equal(result.capability.ready, false);
  assert.equal(result.selection.provider, 'edge');
});

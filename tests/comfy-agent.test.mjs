import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validatePreflight, stableKey} from '../scripts/lib/comfy-agent.mjs';

const run = promisify(execFile);
const KEY = 'test-secret-key-123';
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

// Mock of the generation API: Bearer auth, idempotent submit, async job that succeeds on the second poll.
const startServer = async () => {
  const state = {requests: [], jobs: new Map(), byKey: new Map(), uploads: [], preflights: [], preflightStatus: 200};
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    state.requests.push(`${req.method} ${req.url}`);
    const send = (code, body, type = 'application/json') => { res.writeHead(code, {'Content-Type': type}); res.end(Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
    if (req.url === '/health') return send(200, {status: 'ok'});
    if (req.headers.authorization !== `Bearer ${KEY}`) return send(401, {error: `bad key ${req.headers.authorization ?? ''}`});
    if (req.url.startsWith('/v1/assets?')) { const id = createHash('md5').update(raw).digest('hex'); state.uploads.push({id, bytes: raw.length}); return send(201, {id, size: raw.length}); }
    if (req.url === '/v1/prepare' && req.method === 'POST') {
      const body = JSON.parse(raw); state.preflights.push(body);
      return send(state.preflightStatus, state.preflightReply ?? {
        submitted: false, workflow: body.workflow,
        parameters: {...body, prompt: 'SERVER NORMALIZED PROMPT', seed: 999, steps: 25},
        graph: {test: {class_type: 'OfflineFixture', inputs: {}}},
        route: {workflow: body.workflow, automatic_route_switch: false},
        geometry: {mode: body.framing ?? 'legacy'},
        effective_prompt: body.prompt ?? 'default replacement prompt',
        warnings: state.preflightWarnings ?? [], stages: ['main'], material_roles: [],
      });
    }
    if (req.url === '/v1/jobs' && req.method === 'POST') {
      const key = req.headers['idempotency-key'];
      if (state.byKey.has(key)) return send(202, state.jobs.get(state.byKey.get(key)));
      const id = `job${state.jobs.size + 1}`;
      const job = {id, status: 'queued', polls: 0, request: JSON.parse(raw)};
      state.jobs.set(id, job); state.byKey.set(key, id);
      return send(202, {id, status: 'queued'});
    }
    const jobMatch = /^\/v1\/jobs\/(job\d+)$/.exec(req.url);
    if (jobMatch) {
      const job = state.jobs.get(jobMatch[1]); job.polls++;
      if (job.polls < 2) return send(200, {id: job.id, status: 'running'});
      return send(200, {id: job.id, status: 'succeeded', outputs: [{id: 'out1', filename: 'result.png', url: `/v1/jobs/${job.id}/files/out1`}]});
    }
    if (/\/files\/out1$/.test(req.url)) return send(200, png, 'image/png');
    send(404, {error: 'not found'});
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {server, state, url: `http://127.0.0.1:${server.address().port}`};
};

const cli = (url, args, env = {}) => run(process.execPath, ['scripts/generate-media.mjs', ...args], {cwd: path.resolve(import.meta.dirname, '..'), env: {...process.env, COMFY_AGENT_API_URL: url, COMFY_AGENT_API_KEY: KEY, ...env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(path.join(import.meta.dirname, 'helpers/comfy-offline-guard.mjs')).href}`}}).catch((e) => e);

test('dry run uploads and submits nothing; confirm needs a purpose', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const photo = path.join(job, 'ref.png'); fs.writeFileSync(photo, png);
  const dry = await cli(url, [job, 'edit', '--prompt=改成红色', `--image=${photo}`]);
  assert.match(dry.stdout, /Dry run/);
  assert.deepEqual(state.requests, []);
  const noPurpose = await cli(url, [job, 'image', '--prompt=x', '--confirm']);
  assert.match(noPurpose.stderr, /--purpose/);
  assert.deepEqual(state.requests, []);
});

test('confirmed run submits once with a stable key, downloads, hashes and records without leaking the key', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const args = [job, 'image', '--prompt=窗边的橘猫', '--width=864', '--height=1536', '--seed=42', '--confirm', '--purpose=封面插图，对应 cap-1'];
  const first = await cli(url, args);
  assert.equal(first.code, undefined, first.stderr);
  const record = JSON.parse(fs.readFileSync(path.join(job, 'research/generated.json'), 'utf8')).items[0];
  assert.equal(record.status, 'downloaded');
  assert.equal(record.label, 'AI 生成');
  assert.equal(record.outputs[0].sha256, createHash('sha256').update(png).digest('hex'));
  assert.ok(fs.existsSync(path.join(job, record.outputs[0].file)));
  assert.ok(!JSON.stringify(record).includes(KEY));
  // Same request again: the server sees the same idempotency key and no second job is created; the saved file is never overwritten.
  const again = await cli(url, args);
  assert.equal(state.jobs.size, 1);
  assert.match(again.stderr, /EEXIST|already exists/i);
});

test('missing key and wrong key give clear errors without printing a secret', async (t) => {
  const {server, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const missing = await cli(url, [job, 'workflows'], {COMFY_AGENT_API_KEY: ''});
  assert.match(missing.stderr, /COMFY_AGENT_API_KEY is not set/);
  const wrong = await cli(url, [job, 'workflows'], {COMFY_AGENT_API_KEY: 'wrong-key-999'});
  assert.match(wrong.stderr, /HTTP 401/);
  assert.ok(!wrong.stderr.includes('wrong-key-999'));
});

test('legacy request and stable key stay unchanged; remote preflight precedes submission', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const result = await cli(url, [job, 'video-text', '--prompt=legacy request', '--seed=42', '--confirm', '--purpose=fixture']);
  assert.equal(result.code, undefined, result.stderr);
  const request = {workflow: 'video.text', prompt: 'legacy request', seed: 42};
  assert.deepEqual(state.preflights, [request]);
  assert.deepEqual([...state.jobs.values()][0].request, request);
  assert.ok(state.requests.indexOf('POST /v1/prepare') < state.requests.indexOf('POST /v1/jobs'));
  assert.ok(state.byKey.has(stableKey({...request, assets: {}})));
  const record = JSON.parse(fs.readFileSync(path.join(job, 'research/generated.json'))).items[0];
  const stored = JSON.parse(fs.readFileSync(path.join(job, record.preflightFile)));
  assert.equal(stored.preflight.parameters.prompt, 'SERVER NORMALIZED PROMPT');
  assert.equal(record.request.prompt, 'legacy request');
  for (const field of ['framing', 'prompt_mode', 'frame_instruction', 'steps', 'duration_seconds']) assert.equal(field in record.request, false);
});

test('replace-person maps explicit options, endpoints and additional references; prepare-only never submits', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const photo = path.join(job, 'ref.png'), motion = path.join(job, 'source.mp4');
  fs.writeFileSync(photo, png); fs.writeFileSync(motion, 'offline source fixture');
  const args = [job, 'replace-person', `--identity-image=${photo}`, `--motion-video=${motion}`, `--anchor-image=${photo}`, `--last-frame=${photo}`, `--image=${photo}`,
    '--framing=contain', '--prompt-mode=supplement', '--frame-instruction=Keep earrings.', '--prompt=Natural smile.', '--duration=5', '--confirm', '--prepare-only', '--purpose=preflight fixture'];
  const result = await cli(url, args);
  assert.equal(result.code, undefined, result.stderr);
  assert.equal(state.jobs.size, 0);
  assert.equal(state.preflights.length, 1);
  const body = state.preflights[0];
  assert.equal(body.framing, 'contain'); assert.equal(body.prompt_mode, 'supplement');
  assert.equal(body.frame_instruction, 'Keep earrings.'); assert.equal(body.prompt, 'Natural smile.');
  assert.equal(body.duration_seconds, 5); assert.equal(body.images.length, 1);
  assert.equal(body.anchor_image, body.last_frame); assert.equal(body.identity_image, body.images[0]);
  assert.match(result.stdout, /No generation submitted/);
  assert.equal(fs.existsSync(path.join(job, 'research/generated.json')), false);
  const preflights = fs.readdirSync(path.join(job, 'research/preflights'));
  const stored = JSON.parse(fs.readFileSync(path.join(job, 'research/preflights', preflights[0])));
  assert.deepEqual(stored.request, body);
  assert.ok(!JSON.stringify(stored).includes(KEY));
});

test('new options remain opt-in in a local dry run, with no upload or preflight', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const photo = path.join(job, 'ref.png'), motion = path.join(job, 'source.mp4'); fs.writeFileSync(photo, png); fs.writeFileSync(motion, 'fixture');
  const result = await cli(url, [job, 'replace-person', `--identity-image=${photo}`, `--motion-video=${motion}`, '--framing=cover', '--prompt-mode=supplement', '--prepare-only']);
  assert.equal(result.code, undefined, result.stderr);
  assert.match(result.stdout, /"framing": "cover"/);
  assert.deepEqual(state.requests, []);
});

test('HTTP preflight rejection or malformed success blocks generation and polling', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const args = [job, 'image', '--prompt=x', '--confirm', '--purpose=fixture'];
  for (const [status, reply] of [
    [422, {error: 'Invalid request'}],
    [500, {error: 'Preflight failure'}],
    [200, {workflow: 'image.generate', submitted: true, graph: {x: {}}}],
    [200, {workflow: 'video.reference', submitted: false, graph: {x: {}}}],
    [200, {workflow: 'image.generate', submitted: false, graph: {}}],
  ]) {
    state.preflightStatus = status; state.preflightReply = reply;
    const result = await cli(url, args);
    assert.equal(result.code, 1);
    assert.equal(state.jobs.size, 0);
    assert.ok(!state.requests.includes('POST /v1/jobs'));
    assert.ok(!state.requests.some((r) => r.startsWith('GET /v1/jobs/')));
  }
});

test('preflight transport failure never falls through to generation', async (t) => {
  const server = http.createServer((req) => req.socket.destroy());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const result = await cli(`http://127.0.0.1:${server.address().port}`, [job, 'image', '--prompt=x', '--confirm', '--purpose=fixture']);
  assert.equal(result.code, 1); assert.match(result.stderr, /Cannot reach/);
  assert.equal(fs.existsSync(path.join(job, 'research/generated.json')), false);
});

test('informational label warnings are exposed and do not change full prompt behavior', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  state.preflightWarnings = ['Unbound <Picture 99>'];
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const result = await cli(url, [job, 'video-text', '--prompt=<Picture 99>', '--confirm', '--purpose=fixture']);
  assert.equal(result.code, undefined, result.stderr);
  assert.match(result.stdout, /Unbound/); assert.equal(state.jobs.size, 1);
  assert.equal([...state.jobs.values()][0].request.prompt, '<Picture 99>');
});

test('character-swap has an explicit entry and leaves duration, framing and prompts to API defaults', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const photo = path.join(job, 'ref.png'), motion = path.join(job, 'source.mp4'); fs.writeFileSync(photo, png); fs.writeFileSync(motion, 'fixture');
  const args = [job, 'character-swap', `--identity-image=${photo}`, `--motion-video=${motion}`, '--confirm', '--prepare-only', '--purpose=fixture'];
  let result = await cli(url, args); assert.equal(result.code, undefined, result.stderr);
  const first = state.preflights[0]; assert.equal(first.workflow, 'video.character_swap');
  for (const field of ['duration_seconds', 'framing', 'prompt_mode', 'steps', 'resolution_preset', 'mask_expansion']) assert.equal(field in first, false);
  result = await cli(url, [...args, '--prompt-mode=supplement', '--prompt=Natural smile.', '--resolution-preset=480', '--mask-expansion=32', '--duration=2']);
  assert.equal(result.code, undefined, result.stderr);
  const second = state.preflights[1]; assert.equal(second.resolution_preset, '480'); assert.equal(second.mask_expansion, 32); assert.equal(second.duration_seconds, 2);
  assert.equal(state.jobs.size, 0);
});

test('invalid or unsupported new options fail before any network request', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  for (const extra of [['--framing=stretch'], ['--framing=contain'], ['--prompt-mode=supplement'], ['--frame-instruction=x'], ['--resolution-preset=768'], ['--mask-expansion=64'], ['--prepare-onyl']]) {
    const result = await cli(url, [job, 'image', '--prompt=x', '--confirm', '--purpose=fixture', ...extra]);
    assert.equal(result.code, 1);
  }
  assert.deepEqual(state.requests, []);
});

test('preflight validation rejects inconsistent normalized or routed workflows', () => {
  const base = {submitted: false, workflow: 'image.generate', graph: {x: {}}};
  assert.equal(validatePreflight(base, {workflow: 'image.generate'}), base);
  for (const field of ['parameters', 'route']) assert.throws(() => validatePreflight({...base, [field]: {workflow: 'video.reference'}}, {workflow: 'image.generate'}), /Invalid preflight/);
});

test('direct RV2V preserves its explicit route and maps source, references and anchor', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  const photo = path.join(job, 'ref.png'), motion = path.join(job, 'source.mp4'); fs.writeFileSync(photo, png); fs.writeFileSync(motion, 'fixture');
  const result = await cli(url, [job, 'video-reference', '--prompt=Use <Picture 1> in <Video 1>.', `--image=${photo}`, `--motion-video=${motion}`, `--anchor-image=${photo}`, '--framing=cover', '--duration=2', '--confirm', '--prepare-only', '--purpose=fixture']);
  assert.equal(result.code, undefined, result.stderr);
  const body = state.preflights[0];
  assert.equal(body.workflow, 'video.reference'); assert.equal(body.framing, 'cover');
  assert.equal(body.images[0], body.anchor_image); assert.ok(body.motion_video);
  assert.equal('prompt_mode' in body, false); assert.equal(state.jobs.size, 0);
});

test('resuming an existing job only polls and downloads; it does not preflight or submit a new request', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  state.jobs.set('job1', {id:'job1', polls:2, request:{workflow:'video.text', prompt:'legacy'}});
  fs.mkdirSync(path.join(job, 'research'));
  fs.writeFileSync(path.join(job, 'research/generated.json'), JSON.stringify({schemaVersion:1, items:[{jobId:'job1', idempotencyKey:'legacy-key', request:{workflow:'video.text', prompt:'legacy'}}]}));
  const result = await cli(url, [job, 'resume', 'job1']);
  assert.equal(result.code, undefined, result.stderr);
  assert.equal(state.preflights.length, 0); assert.equal(state.uploads.length, 0);
  assert.ok(!state.requests.includes('POST /v1/jobs'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(job, 'research/generated.json'))).items[0].request.prompt, 'legacy');
});


test('prepare-only cannot resume an existing job or silently ignore a source-frame option', async (t) => {
  const {server, state, url} = await startServer(); t.after(() => server.close());
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-job-')); t.after(() => fs.rmSync(job, {recursive: true, force: true}));
  let result = await cli(url, [job, 'resume', 'job1', '--prepare-only']);
  assert.equal(result.code, 1); assert.match(result.stderr, /cannot resume/);
  result = await cli(url, [job, 'character-swap', '--last-frame=unused.png', '--confirm', '--purpose=fixture']);
  assert.equal(result.code, 1); assert.match(result.stderr, /unsupported option/);
  assert.deepEqual(state.requests, []);
});

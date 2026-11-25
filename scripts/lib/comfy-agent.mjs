import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Client for the user's ComfyUI Agent API (image and video generation workflows behind a Bearer key).
// The key comes only from COMFY_AGENT_API_KEY (the skill loads ~/.cmm/short-video-maker-local.env first); it is never
// written to logs, errors or job records. Requests go straight to the API address (no system proxy).
export const defaultBase = 'http://100.96.20.126:8788';
export const baseUrl = () => (process.env.COMFY_AGENT_API_URL || defaultBase).replace(/\/+$/, '');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

export class ComfyApiError extends Error {
  constructor(message, {status, body} = {}) { super(message); this.name = 'ComfyApiError'; this.status = status; this.body = body; }
}

const apiKey = () => {
  const key = process.env.COMFY_AGENT_API_KEY?.trim();
  if (!key) throw new ComfyApiError('COMFY_AGENT_API_KEY is not set. Add it to ~/.cmm/short-video-maker-local.env (mode 600) or export it; see references/generated-media.md.');
  return key;
};

const scrub = (text) => String(text ?? '').replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]').slice(0, 600);

export async function request(route, {method, body, raw, headers = {}, timeoutMs = 300000, auth = true} = {}) {
  const init = {method: method ?? (body !== undefined || raw !== undefined ? 'POST' : 'GET'), headers: {...headers}, signal: AbortSignal.timeout(timeoutMs)};
  if (auth) init.headers.Authorization = `Bearer ${apiKey()}`;
  if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  else if (raw !== undefined) init.body = raw;
  let response;
  try { response = await fetch(baseUrl() + route, init); }
  catch (error) { throw new ComfyApiError(`Cannot reach the generation API (${error.cause?.code ?? error.name}); the request may or may not have been received, so keep the idempotency key and resume instead of resubmitting`); }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ComfyApiError(`API ${init.method} ${route} returned HTTP ${response.status}: ${scrub(text)}`, {status: response.status, body: scrub(text)});
  }
  return response;
}
const json = async (route, options) => (await request(route, options)).json();

export const health = () => json('/health', {auth: false, timeoutMs: 15000});
export const upstream = () => json('/v1/upstream', {timeoutMs: 30000});
export const workflows = () => json('/v1/workflows', {timeoutMs: 30000});
export function validatePreflight(plan, body) {
  if (!plan || plan.submitted !== false || plan.workflow !== body.workflow ||
      !plan.graph || typeof plan.graph !== 'object' || Array.isArray(plan.graph) || !Object.keys(plan.graph).length ||
      (plan.parameters?.workflow !== undefined && plan.parameters.workflow !== body.workflow) ||
      (plan.route?.workflow !== undefined && plan.route.workflow !== body.workflow)) {
    throw new ComfyApiError('Invalid preflight response: expected an unsubmitted plan for the selected workflow; no generation submitted');
  }
  return plan;
}
export const prepare = async (body) => validatePreflight(await json('/v1/prepare', {body, timeoutMs: 60000}), body);
export const getJob = (id) => json(`/v1/jobs/${encodeURIComponent(id)}`, {timeoutMs: 60000});
export const resumeJob = (id) => json(`/v1/jobs/${encodeURIComponent(id)}/resume`, {method: 'POST', timeoutMs: 60000});

// Same request, same key: repeating the submit returns the same job instead of generating twice.
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])])) : value;
export const stableKey = (body) => `svm-${sha256(Buffer.from(JSON.stringify(canonical(body)))).slice(0, 40)}`;
export const submit = (body, idempotencyKey = stableKey(body)) => json('/v1/jobs', {body, headers: {'Idempotency-Key': idempotencyKey}, timeoutMs: 120000}).then((job) => ({...job, idempotencyKey}));

export async function uploadAsset(file) {
  const bytes = fs.readFileSync(file);
  const asset = await json(`/v1/assets?filename=${encodeURIComponent(path.basename(file))}`, {raw: bytes, headers: {'Content-Type': 'application/octet-stream'}, timeoutMs: 600000});
  return {...asset, localFile: path.resolve(file), localSha256: sha256(bytes)};
}

export async function waitJob(id, {timeoutMs = 7200000, intervalMs = 2000, onStatus} = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const job = await getJob(id);
    if (job.status !== last) { last = job.status; onStatus?.(job); }
    if (job.status === 'succeeded') return job;
    if (['failed', 'submission_unknown', 'interrupted'].includes(job.status)) throw new ComfyApiError(`Job ${id} ended as ${job.status}: ${scrub(JSON.stringify(job.error ?? job.stages ?? ''))}`, {body: job});
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new ComfyApiError(`Timed out waiting for job ${id}; the remote task was not cancelled, poll it again with the same job id`);
}

// Downloads every output next to the job, never overwriting an existing file.
export async function downloadOutputs(job, directory) {
  fs.mkdirSync(directory, {recursive: true});
  const saved = [];
  for (const item of job.outputs ?? []) {
    const response = await request(item.url, {timeoutMs: 600000});
    const bytes = Buffer.from(await response.arrayBuffer());
    const file = path.join(directory, `${job.id}-${item.id}-${path.basename(item.filename)}`);
    fs.writeFileSync(file, bytes, {flag: 'wx'});
    saved.push({file, sha256: sha256(bytes), bytes: bytes.length, remoteId: item.id, remoteFilename: item.filename});
  }
  return saved;
}

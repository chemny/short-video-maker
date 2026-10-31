import {execFileSync} from 'node:child_process';
import {resolveRuntime} from './providers/voxcpm2.mjs';
import {inspectLocalAsr} from '../lib/local-asr.mjs';

export const localCapability = () => {
  try {
    const runtime = resolveRuntime();
    execFileSync(runtime.python, ['-c', 'import importlib.util; assert importlib.util.find_spec("mlx_audio"); from model_setup import inspect_model; assert inspect_model(hashes=False)["ok"]'], {cwd: runtime.folder, timeout: 10000, stdio: 'pipe'});
    const asr = inspectLocalAsr();
    if (!asr.ready) return {ready: false, asr, reason: asr.reason};
    return {ready: true, asr, reason: `existing local VoxCPM2 runtime and selected ${asr.runtime.backend} ASR prerequisites found`};
  } catch {return {ready: false, reason: 'complete local VoxCPM2/ASR environment not available'};}
};
export const selectProvider = ({explicit, plan, env = process.env, capability = localCapability} = {}) => {
  if (plan?.audio?.sourceMode === 'imported') {
    if (explicit && !['auto', 'none'].includes(explicit)) throw new Error('Imported narration is protected; it must not be replaced by TTS');
    return {provider: 'none', source: 'imported-narration'};
  }
  const savedProvider = plan?.audio?.selectionMode === 'auto' ? 'auto' : plan?.audio?.provider;
  const job = savedProvider === 'voxcpm2-local' ? 'voxcpm2' : savedProvider;
  const choice = explicit ?? job ?? env.SHORT_VIDEO_TTS_PROVIDER;
  if (choice && choice !== 'auto') {
    if (!['voxcpm2', 'edge', 'volcengine', 'http', 'local', 'none'].includes(choice)) throw new Error(`Unknown TTS provider: ${choice}`);
    return {provider: choice, source: explicit ? 'explicit' : job ? 'job' : 'environment'};
  }
  const local = capability();
  return {provider: local.ready ? 'voxcpm2' : 'edge', source: 'auto', reason: local.reason};
};

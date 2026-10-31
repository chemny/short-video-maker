import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {commandFromEnv} from './bins.mjs';
import {runCommand, envMilliseconds} from './process.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const torchScript = fileURLToPath(new URL('../transcribe-local.py', import.meta.url));
const normalizeScript = fileURLToPath(new URL('../normalize-chinese.py', import.meta.url));
// Some older local MLX Whisper exports stored alignment-head metadata alongside
// the parameters. Current runtimes read the equivalent existing generation config.
// Remove that metadata in memory, never modify the model or fetch another export.
const mlxProgram = String.raw`import os,sys,json,pathlib,hashlib
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1'
from mlx_audio.stt.models.whisper.whisper import Model,ModelDimensions
import mlx.core as mx
from mlx.utils import tree_unflatten
folder=pathlib.Path(sys.argv[1]);audio=pathlib.Path(sys.argv[2]);out=pathlib.Path(sys.argv[3]);language=sys.argv[4];model_hash=sys.argv[5]
config=json.loads((folder/'config.json').read_text());config.pop('model_type',None)
model=Model(ModelDimensions.from_dict(config),mx.float16);model=Model.post_load_hook(model,folder)
weights={}
for file in sorted(folder.glob('*.safetensors')):weights.update(mx.load(str(file)))
weights.pop('alignment_heads',None)
model.update(tree_unflatten(list(weights.items())));mx.eval(model.parameters())
result=model.generate(str(audio),word_timestamps=True,language=None if language=='auto' else language,temperature=0,condition_on_previous_text=False,verbose=False)
words=[word for segment in result.segments for word in segment.get('words',[])]
report={'schemaVersion':1,'engine':'mlx-whisper-local','language':language,'modelSha256':model_hash,'audioSha256':hashlib.sha256(audio.read_bytes()).hexdigest(),'text':result.text,'words':words,'segments':result.segments}
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Transcribed '+str(len(words))+' words with existing local MLX Whisper')
`;

const modelFiles = model => {
  if (fs.statSync(model).isFile()) return [model];
  const files = fs.readdirSync(model).filter(f => f.endsWith('.safetensors') || ['config.json', 'generation_config.json', 'tokenizer.json', 'tokenizer_config.json'].includes(f)).sort();
  if (!files.includes('config.json') || !files.some(f => f.endsWith('.safetensors'))) throw new Error('Local MLX Whisper directory needs existing config.json and safetensors weights; no download is performed');
  return files.map(file => path.join(model, file));
};

const modelFingerprint = (model, files) => {
  const updateFile = (fingerprint, file) => {
    const fd = fs.openSync(file, 'r'), chunk = Buffer.allocUnsafe(8 * 1024 * 1024);
    try {let n; while ((n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) fingerprint.update(chunk.subarray(0, n));}
    finally {fs.closeSync(fd);}
    return fingerprint;
  };
  if (fs.statSync(model).isFile()) return updateFile(createHash('sha256'), model).digest('hex');
  const fingerprint = createHash('sha256');
  for (const file of files) {fingerprint.update(path.basename(file)); updateFile(fingerprint, file);}
  return fingerprint.digest('hex');
};

export const resolveLocalAsr = ({model, mlxModel, python, fingerprint = true} = {}) => {
  const cache = path.join(os.homedir(), '.cache/whisper');
  const selected = path.resolve(model ?? mlxModel ?? process.env.SHORT_VIDEO_MLX_WHISPER_MODEL ?? process.env.SHORT_VIDEO_WHISPER_MODEL ?? path.join(cache, fs.existsSync(path.join(cache, 'small.pt')) ? 'small.pt' : 'base.pt'));
  if (!fs.existsSync(selected)) throw new Error(`Existing local ASR model required at ${selected}; configure SHORT_VIDEO_MLX_WHISPER_MODEL or SHORT_VIDEO_WHISPER_MODEL. No model is installed or downloaded.`);
  const backend = fs.statSync(selected).isDirectory() ? 'mlx' : 'torch';
  const files = modelFiles(selected);
  for (const file of files) {
    fs.accessSync(file, fs.constants.R_OK);
    if (!fs.statSync(file).isFile() || !fs.statSync(file).size) throw new Error(`Local ASR model file is empty or invalid: ${file}`);
  }
  return {backend, model: selected, python: python ?? (backend === 'mlx' ? process.env.SHORT_VIDEO_MLX_PYTHON : undefined) ?? commandFromEnv('python3'),
    modelSha256: fingerprint ? modelFingerprint(selected, files) : undefined, engineSha256: hash(backend === 'mlx' ? mlxProgram : fs.readFileSync(torchScript))};
};

// Probe the same model/backend/interpreter as real transcription, without loading
// weights or hashing gigabytes. A dependency probe is not an inference test.
export const inspectLocalAsr = (options = {}) => {
  let runtime, stage = 'model';
  try {
    runtime = resolveLocalAsr({...options, fingerprint: false});
    stage = 'inference-runtime';
    const program = runtime.backend === 'mlx'
      ? 'from mlx_audio.stt.models.whisper.whisper import Model,ModelDimensions; import mlx.core; from mlx.utils import tree_unflatten'
      : 'import whisper,torch';
    const env = {...process.env, PYTHONDONTWRITEBYTECODE: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1'};
    execFileSync(runtime.python, ['-B', '-c', program], {timeout: 10000, stdio: 'pipe', env});
    stage = 'chinese-normalization';
    const result = execFileSync(commandFromEnv('python3'), ['-B', normalizeScript], {input: '["語音"]', encoding: 'utf8', timeout: 10000, stdio: 'pipe', env});
    if (JSON.parse(result)[0] !== '语音') throw new Error('Chinese normalization failed');
    return {ready: true, runtime, reason: 'selected local ASR model, backend and Chinese normalization imports are available; inference not performed'};
  } catch (error) {
    return {ready: false, runtime, stage, reason: stage === 'model' ? error.message : `Local ASR ${stage} check failed (${error.code ?? error.status ?? 'invalid result'}); check the selected Python dependencies`};
  }
};

export const transcribeLocal = ({audioFile, out, language = 'auto', ...options}) => {
  const runtime = resolveLocalAsr(options);
  const args = runtime.backend === 'mlx'
    ? ['-c', mlxProgram, runtime.model, path.resolve(audioFile), path.resolve(out), language, runtime.modelSha256]
    : [torchScript, path.resolve(audioFile), '--out', path.resolve(out), '--language', language, '--model', runtime.model];
  runCommand(runtime.python, args, {label: `${runtime.backend} local word-timestamp ASR`, stdio: 'pipe', timeoutMs: envMilliseconds('SHORT_VIDEO_ASR_TIMEOUT_MS', 900000)});
  const result = JSON.parse(fs.readFileSync(out));
  if (result.audioSha256 !== hash(fs.readFileSync(audioFile)) || result.modelSha256 !== runtime.modelSha256) throw new Error('Local ASR result does not match the selected audio/model');
  return result;
};

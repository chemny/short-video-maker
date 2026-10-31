import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {commandFromEnv} from './bins.mjs';
import {readCommand} from './process.mjs';

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const audioExtensions = new Set(['.m4a', '.mp3', '.wav', '.aac', '.flac', '.ogg']);
const videoExtensions = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const ignoredDirectories = new Set(['node_modules', '.git', '_auto_video_job']);

export const probeMedia = (file) => JSON.parse(readCommand(commandFromEnv('ffprobe'), [
  '-v', 'error', '-show_format', '-show_streams', '-of', 'json', file,
], {label: 'probe media', timeoutMs: 30000}));

export const mediaKind = (file) => {
  const extension = path.extname(file).toLowerCase();
  if (imageExtensions.has(extension)) return 'image';
  if (audioExtensions.has(extension)) return 'audio';
  if (videoExtensions.has(extension)) return 'video';
  if (['.txt', '.md'].includes(extension)) return 'text';
  return null;
};

export const inspectAsset = (file, root = path.dirname(file)) => {
  file = fs.realpathSync(file);
  const kind = mediaKind(file);
  if (!kind) throw new Error(`Unsupported asset: ${file}`);
  const info = kind === 'text' ? {} : probeMedia(file);
  const streams = info.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  const name = path.basename(file, path.extname(file)).toLowerCase();
  const hasAudio = Boolean(audio);
  let suggestedRole = kind === 'image' ? 'visual' : kind === 'text' ? 'script' : 'unassigned';
  if (hasAudio && /music|bgm|背景|配乐/.test(name)) suggestedRole = 'bgm';
  else if (hasAudio && /朗诵|voice|narration|口播|配音/.test(name)) suggestedRole = 'narration';
  return {
    path: path.resolve(file), relativePath: path.relative(root, file), kind, suggestedRole,
    size: fs.statSync(file).size,
    duration: Number(info.format?.duration) || null,
    width: video?.width ?? null, height: video?.height ?? null,
    fps: kind === 'video' ? video?.avg_frame_rate ?? video?.r_frame_rate ?? null : null,
    hasAudio, sampleRate: audio ? Number(audio.sample_rate) : null, channels: audio?.channels ?? null,
  };
};

export const scanAssets = (inputDir, {exclude = []} = {}) => {
  const root = fs.realpathSync(inputDir);
  if (!fs.statSync(root).isDirectory()) throw new Error('input-dir must be a directory');
  const excluded = exclude.map((entry) => path.resolve(entry));
  const assets = [];
  const warnings = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.name.startsWith('.') || excluded.some((item) => file === item || file.startsWith(`${item}${path.sep}`))) continue;
      if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) walk(file);
      else if (entry.isFile() && mediaKind(file)) {
        try { assets.push(inspectAsset(file, root)); }
        catch (error) { warnings.push({path: file, error: error.message}); }
      }
    }
  };
  walk(root);
  return {schemaVersion: 1, inputDir: root, assets, warnings};
};

export const chooseAsset = (manifest, role, explicit, {required = false} = {}) => {
  if (explicit === 'none' && !required) return null;
  if (explicit) {
    const file = path.isAbsolute(explicit) ? explicit : path.resolve(manifest.inputDir, explicit);
    const asset = inspectAsset(file, manifest.inputDir);
    if (!asset.hasAudio) throw new Error(`${role} must have an audio stream: ${file}`);
    return asset;
  }
  const candidates = manifest.assets.filter((asset) => asset.suggestedRole === role);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 || required) {
    const choices = candidates.length ? candidates : manifest.assets.filter((asset) => asset.hasAudio);
    throw new Error(`Select --${role === 'bgm' ? 'music' : role}=<file> explicitly. Candidates: ${choices.map((asset) => asset.relativePath).join(', ') || '(none)'}`);
  }
  return null;
};

export const copyAsset = (asset, jobDir, folder) => {
  const hash = createHash('sha256').update(fs.readFileSync(asset.path)).digest('hex').slice(0, 16);
  const stem = path.basename(asset.path, path.extname(asset.path)).replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 48);
  const relative = `${folder}/${stem}-${hash}${path.extname(asset.path).toLowerCase()}`;
  const destination = path.join(jobDir, relative);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  if (!fs.existsSync(destination)) fs.copyFileSync(asset.path, destination, fs.constants.COPYFILE_EXCL);
  else if (createHash('sha256').update(fs.readFileSync(destination)).digest('hex').slice(0, 16) !== hash) {
    throw new Error(`Imported asset was modified: ${relative}. Preserve that edit separately before reimporting.`);
  }
  return relative;
};

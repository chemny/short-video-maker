import {execFileSync} from 'node:child_process';
import {commandFromEnv} from './bins.mjs';

// Radix-2 FFT keeps cloud-only installations free of Python/NumPy requirements.
const fft = (re, im, inverse = false) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {[re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]];}
  }
  for (let len = 2; len <= n; len *= 2) {
    const angle = (inverse ? 2 : -2) * Math.PI / len;
    const wr = Math.cos(angle), wi = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let ur = 1, ui = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = start + k, b = a + len / 2;
        const vr = re[b] * ur - im[b] * ui, vi = re[b] * ui + im[b] * ur;
        re[b] = re[a] - vr; im[b] = im[a] - vi; re[a] += vr; im[a] += vi;
        const next = ur * wr - ui * wi; ui = ur * wi + ui * wr; ur = next;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) {re[i] /= n; im[i] /= n;}
};
const rate = 8000;
const rms = (values) => Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / Math.max(1, values.length));
export const compareWaveforms = (x, y) => {
  if (Math.min(x.length, y.length) < rate / 4 || !x.every(Number.isFinite) || !y.every(Number.isFinite)) throw new Error('Invalid or short waveform');
  let n = 1; while (n < x.length + y.length - 1) n *= 2;
  if (n > 2 ** 24) throw new Error('Waveform exceeds short-video verification size limit');
  const ar = new Float64Array(n), ai = new Float64Array(n), br = new Float64Array(n), bi = new Float64Array(n);
  for (let i = 0; i < x.length; i++) ar[i] = x[x.length - i - 1];
  br.set(y); fft(ar, ai); fft(br, bi);
  for (let i = 0; i < n; i++) {const re = ar[i] * br[i] - ai[i] * bi[i]; ai[i] = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = re;}
  fft(ar, ai, true);
  const center = x.length - 1, lo = Math.max(0, center - rate / 4), hi = Math.min(x.length + y.length - 1, center + rate / 4 + 1);
  let best = lo; for (let i = lo + 1; i < hi; i++) if (ar[i] > ar[best]) best = i;
  const lag = best - center; let dot = 0, xx = 0, yy = 0;
  for (let i = Math.max(0, -lag); i < Math.min(x.length, y.length - lag); i++) {dot += x[i] * y[i + lag]; xx += x[i] ** 2; yy += y[i + lag] ** 2;}
  return {offsetSeconds: lag / rate, correlation: xx * yy > 1e-20 ? dot / Math.sqrt(xx * yy) : 0};
};
const decode = (file) => {
  const data = execFileSync(commandFromEnv('ffmpeg'), ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], {maxBuffer: 128 * 1024 * 1024, timeout: 180000});
  return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
};
export const verifyAudioSync = (master, video) => {
  const ref = decode(master), actual = decode(video);
  if (rms(ref) < 1e-7) return {status: actual.length && actual.every((v) => Math.abs(v) < 1e-5) ? 'passed' : 'failed', mode: 'silent-master', windows: []};
  const global = compareWaveforms(ref, actual); const windows = [];
  for (const start of new Set([0, Math.max(0, Math.floor(ref.length / 2) - rate), Math.max(0, ref.length - 3 * rate)])) {
    const x = ref.subarray(start, start + 2 * rate), y = actual.subarray(start, start + 2 * rate);
    if (Math.min(x.length, y.length) < rate / 4 || rms(x) < 1e-5) continue;
    windows.push({startSeconds: start / rate, ...compareWaveforms(x, y)});
  }
  const pass = [global, ...windows].every((w) => Math.abs(w.offsetSeconds) <= .01 && w.correlation >= .9);
  return {status: pass ? 'passed' : 'failed', mode: 'waveform-cross-correlation', implementation: 'node-fft', sampleRate: rate,
    ...global, windows, maximumOffsetSeconds: .01, limits: 'Checks transport timing against the PCM master, not word timing or listening quality'};
};

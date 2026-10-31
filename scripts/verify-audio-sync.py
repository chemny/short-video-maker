#!/usr/bin/env python3
"""Verify decoded delivery timing against its exact PCM master; never retime by guess."""
import argparse
import json
import subprocess
import numpy as np

p = argparse.ArgumentParser()
p.add_argument('master')
p.add_argument('video')
p.add_argument('--ffmpeg', default='ffmpeg')
a = p.parse_args()
rate = 8000
def decode(file):
    raw = subprocess.check_output([a.ffmpeg, '-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', str(rate), '-f', 'f32le', '-'])
    return np.frombuffer(raw, dtype=np.float32)
ref, actual = decode(a.master), decode(a.video)
def compare(x, y):
    if len(x) < rate // 4 or len(y) < rate // 4 or not np.isfinite(x).all() or not np.isfinite(y).all():
        raise ValueError('Invalid or short waveform')
    n = 1 << (len(x) + len(y) - 2).bit_length()
    c = np.fft.irfft(np.fft.rfft(y, n) * np.fft.rfft(x[::-1], n), n)
    center = len(x) - 1
    lo, hi = max(0, center - rate // 4), min(len(x) + len(y) - 1, center + rate // 4 + 1)
    lag = int(np.argmax(c[lo:hi])) + lo - center
    left, right = max(0, -lag), min(len(x), len(y) - lag)
    xx, yy = x[left:right], y[left+lag:right+lag]
    norm = np.sqrt(np.dot(xx, xx) * np.dot(yy, yy))
    return lag / rate, float(np.dot(xx, yy) / norm) if norm > 1e-10 else 0
energy = float(np.sqrt(np.mean(ref**2))) if len(ref) else 0
if energy < 1e-7:
    result = {'status': 'passed' if len(actual) and np.max(np.abs(actual)) < 1e-5 else 'failed', 'mode': 'silent-master', 'windows': []}
else:
    lag, corr = compare(ref, actual)
    windows = []
    for start in sorted({0, max(0, len(ref)//2-rate), max(0, len(ref)-3*rate)}):
        x, y = ref[start:start+2*rate], actual[start:start+2*rate]
        if len(x) < rate//4 or len(y) < rate//4 or np.sqrt(np.mean(x**2)) < 1e-5:
            continue
        offset, similarity = compare(x, y)
        windows.append({'startSeconds': start/rate, 'offsetSeconds': offset, 'correlation': similarity})
    passed = abs(lag) <= .01 and corr >= .9 and all(abs(w['offsetSeconds']) <= .01 and w['correlation'] >= .9 for w in windows)
    result = {'status': 'passed' if passed else 'failed', 'mode': 'waveform-cross-correlation', 'sampleRate': rate,
              'offsetSeconds': lag, 'correlation': corr, 'windows': windows, 'maximumOffsetSeconds': .01,
              'limits': 'Checks transport offset/drift against the PCM mix, not ASR word accuracy or listening quality'}
print(json.dumps(result))
raise SystemExit(0 if result['status'] == 'passed' else 1)

#!/usr/bin/env python3
"""Median fundamental frequency of a speech WAV (numpy only). Prints {"f0": Hz or null, "frames": voiced frame count}.

Autocorrelation over 40 ms frames, 70 to 300 Hz; the lowest strong peak is taken so an octave error does not read as a higher voice.
A rough measure: enough to tell a voice that drifted away from its reference, not to identify a speaker."""
import json, sys, wave
import numpy as np

with wave.open(sys.argv[1], 'rb') as w:
    sr, ch, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
    raw = w.readframes(w.getnframes())
if width != 2:
    raise SystemExit('16-bit PCM expected')
x = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
if ch > 1:
    x = x.reshape(-1, ch).mean(1)
n, h = int(0.04 * sr), int(0.01 * sr)
lo, hi = int(sr / 300), int(sr / 70)
gate = 0.1 * float(np.sqrt((x ** 2).mean()) or 1)
vals = []
for i in range(0, len(x) - n, h):
    fr = x[i:i + n] - x[i:i + n].mean()
    if np.sqrt((fr ** 2).mean()) < gate:
        continue
    ac = np.correlate(fr, fr, 'full')[n - 1:]
    ac = ac / (ac[0] + 1e-9)
    seg = ac[lo:hi]
    m = float(seg.max())
    if m < 0.6:
        continue
    cand = [j for j in range(1, len(seg) - 1) if seg[j] >= seg[j - 1] and seg[j] >= seg[j + 1] and seg[j] >= 0.85 * m]
    k = cand[-1] if cand else int(seg.argmax())
    vals.append(sr / (lo + k))
print(json.dumps({'f0': float(np.median(vals)) if vals else None, 'frames': len(vals)}))

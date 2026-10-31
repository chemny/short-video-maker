#!/usr/bin/env python3
"""Normalize only matching inputs, preserving all authored display text."""
import json
import sys
from pathlib import Path
local = Path.home() / '.local/share/short-video-maker/python'
if local.is_dir(): sys.path.insert(0, str(local))
try:
    from opencc import OpenCC
except ImportError:
    raise SystemExit('Chinese matching requires OpenCC. Install requirements-asr.txt in your chosen Python runtime; no automatic install is performed.')
converter = OpenCC('t2s')
values = json.load(sys.stdin)
print(json.dumps([converter.convert(value) for value in values], ensure_ascii=False))

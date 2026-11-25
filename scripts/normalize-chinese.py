#!/usr/bin/env python3
"""Normalize only matching inputs, preserving all authored display text.

Traditional to Simplified (OpenCC t2s), and the single-digit Chinese numerals 一 to 九 to Arabic digits: a recogniser may write the
same spoken number as 六 or 6, which is an orthography choice, not a misreading. Both sides of a comparison go through this, so it
only changes the outcome where one side has the digit and the other the numeral."""
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
numerals = str.maketrans('一二三四五六七八九', '123456789')
print(json.dumps([converter.convert(value).translate(numerals) for value in values], ensure_ascii=False))

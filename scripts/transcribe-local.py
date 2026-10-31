#!/usr/bin/env python3
"""Local Whisper word timestamps. Requires an existing model; never downloads one."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('audio')
parser.add_argument('--model', default=str(Path.home() / '.cache/whisper/small.pt' if (Path.home() / '.cache/whisper/small.pt').is_file() else Path.home() / '.cache/whisper/base.pt'))
parser.add_argument('--language', default='zh')
parser.add_argument('--out', required=True)
args = parser.parse_args()
model_path = Path(args.model).resolve()
if not model_path.is_file():
    parser.error('Local Whisper model not found. Supply --model; no automatic download is performed.')
import torch
import whisper
torch.set_num_threads(4)
model = whisper.load_model(str(model_path), device='cpu')
result = model.transcribe(args.audio, language=None if args.language == 'auto' else args.language,
                          word_timestamps=True, fp16=False, temperature=0, verbose=False,
                          condition_on_previous_text=False)
words = [word for segment in result['segments'] for word in segment.get('words', [])]
report = {'schemaVersion': 1, 'engine': 'openai-whisper-local', 'language': result['language'],
          'audioSha256': hashlib.sha256(Path(args.audio).read_bytes()).hexdigest(),
          'modelSha256': hashlib.sha256(model_path.read_bytes()).hexdigest(),
          'text': result['text'], 'words': words, 'segments': result['segments']}
Path(args.out).parent.mkdir(parents=True, exist_ok=True)
Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(f"Transcribed {len(words)} words locally to {args.out}")

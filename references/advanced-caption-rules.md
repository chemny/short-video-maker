# Advanced Caption Rules

Use these rules when sentence-level captions are not enough.

## Caption Modes

- `sentence`: default MVP mode, one phrase or sentence at a time.
- `page`: TikTok-style caption pages, a small group of words or tokens shown together.
- `word`: word-level or token-level highlighting synchronized to speech.
- `srt`: imported captions from an external `.srt` file.

## When To Use Advanced Captions

- Use `page` or `word` mode for highly polished Douyin/TikTok-style videos.
- Use `srt` mode when the user provides subtitles or a transcription service returns SRT.
- Keep `sentence` mode for fast drafts, simple explainers, and when alignment is approximate.

## Package Guidance

- Prefer `@remotion/captions` when implementing page grouping, SRT parsing, or word-level caption formatting.
- Keep generated `captions.json` as the canonical internal caption format.
- Keep `.srt` as an export/import format, not the only source of truth.

## Word Highlighting

- Highlight the current spoken word or a short keyword span.
- Do not animate every character independently.
- Keep highlights stable enough to read on mobile.
- Avoid more than one active highlight style in a single caption block.

## Transcription Providers

- Local transcription is useful for offline or low-cost workflows.
- Cloud transcription is useful when quality and speed matter.
- Always reconcile transcription output with the final TTS audio.
- Do not generate captions from the script alone after audio has been changed.

## Quality Checks

- Verify caption start/end order.
- Verify captions do not exceed the video duration.
- Verify no caption is too short to read.
- Verify imported SRT files are parsed into the same internal caption schema before rendering.

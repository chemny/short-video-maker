# Caption Rules

Captions are a core output for Xiaohongshu and Douyin videos. Treat them as part of the video design, not as an afterthought.

## Timing

- Caption times are in seconds.
- `start` must be less than `end`.
- Captions must be ordered by `start`.
- Caption timing should follow the voiceover timeline.
- If word-level alignment is unavailable, use sentence-level or phrase-level captions derived from TTS segment durations.

## Text Length

- Keep each caption short enough for mobile.
- Prefer 8-18 Chinese characters per visible caption.
- Avoid more than two lines.
- Split long narration into multiple caption items instead of shrinking text too far.
- Highlight only 1-3 keywords per caption.

## Layout

- Keep captions inside a safe area, especially near the bottom where platform UI can cover content.
- Do not place critical captions at the extreme top, bottom, left, or right edge.
- Reserve stable dimensions for the caption container so text changes do not resize the layout.
- Use high contrast between caption text and the visual background.
- Add a backing plate or shadow when the background is busy.

## Readability

- Use large type that remains readable after platform compression.
- Do not use negative letter spacing.
- Do not scale font size with viewport width.
- Use dynamic sizing only as a last resort for unusually long words or phrases.
- Do not let captions overlap faces, charts, titles, or platform UI zones.

## Output Files

- Write machine-readable captions to `public/captions/captions.json`.
- Write platform/export captions to `public/captions/captions.srt`.
- Keep caption text in sync with `video-plan.json`.

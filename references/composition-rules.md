# Composition Rules

This skill uses parameterized Remotion compositions driven by `video-plan.json`.

## Root Composition

- Register compositions in `src/Root.tsx`.
- Keep `ShortVideo` as the primary video composition.
- Keep `CoverStill` as the default cover still.
- Read width, height, fps, and duration from `video-plan.json`.
- Use `Math.ceil(durationSeconds * fps)` for final duration.

## Parameters

- `video-plan.json` is the single render contract.
- Do not read agent reasoning files directly in Remotion components.
- Do not read secrets or provider keys in Remotion components.
- Keep Remotion props JSON-serializable.

## Template Structure

- `ShortVideo` should orchestrate audio, scenes, captions, and global background.
- `SceneRenderer` should handle scene visuals and per-scene layout.
- `CaptionLayer` should own subtitle display and safe-area behavior.
- `AudioLayer` should own voiceover and BGM playback.
- `CoverStill` should be renderable independently from the video.

## Dynamic Behavior

- Templates must support variable scene counts.
- Templates must support variable durations.
- Templates must support missing optional assets.
- Templates must support platform dimensions other than 1080x1920 when explicitly requested.

## Rendering

- Use Remotion CLI for video and still renders.
- Use FFmpeg only for auxiliary media work such as audio concatenation, diagnostics, trimming, or compression.
- Keep rendered outputs under ignored output folders.
- Run validation before rendering.

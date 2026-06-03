# Audio Sync Rules

Voiceover audio is the master timeline for this skill.

## Master Timeline

- Generate or import voiceover before finalizing scene and caption timing.
- Use the actual audio duration to set `meta.durationSeconds`.
- Retiming should update scenes and captions together.
- Do not trust estimated script durations after TTS has been generated.

## TTS Segments

- For long scripts, synthesize each scene separately and concatenate the segments.
- Record each segment duration.
- Use segment durations to retime scene start/end values.
- Use sentence or phrase weights inside each segment to estimate caption timing when forced alignment is unavailable.

## Audio Assets

- Store voiceover at `public/audio/voiceover.mp3`.
- Use paths relative to Remotion `public/` in `video-plan.json`, for example `audio/voiceover.mp3`.
- Keep generated segment files out of published repositories.
- Do not store provider credentials in audio metadata or plan files.

## BGM

- BGM is optional.
- Keep BGM volume low under narration.
- Default to `0.08-0.15` for background music volume.
- Duck or reduce BGM when voiceover is present.
- Avoid BGM that competes with spoken Chinese.

## Diagnostics

- Use FFmpeg or media tooling to inspect duration, codec, and stream presence.
- Check that the rendered video has audio when `audio.voiceover` is set.
- If the video ends before audio, fix `durationSeconds`.
- If captions drift, retime from audio again instead of manually nudging a few captions.

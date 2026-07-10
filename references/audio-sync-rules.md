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

## Audio Quality Gate

Add an explicit lock before final render whenever the job uses imported audio,
phone recordings, extracted clip audio, or newly generated TTS.

The gate passes only when narration is clear enough for mobile playback:

- no obvious room echo or long reverb tail after spoken phrases;
- no strong hiss, hum, fan noise, traffic noise, or broadband background noise;
- no clipping, harsh peaks, or sudden level jumps;
- speech remains intelligible after platform compression.

If the agent hears obvious echo/noise, or diagnostics suggest poor quality, the
workflow must add a repair step before rendering:

```text
source voiceover -> denoise/dialogue enhancement -> processed voiceover -> timing audit -> render
```

Recommended FFmpeg repair chain for a moderate noisy / echoey spoken recording:

```bash
ffmpeg -i input.mp4 -c:v copy \
  -af "highpass=f=100,lowpass=f=7800,afftdn=nr=12-18:nf=-32:nt=w:ad=0.65:gs=8-12,\
equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=3000:t=q:w=1:g=1.5,\
dialoguenhance=original=0.75:enhance=1.2-1.6:voice=6-10,\
pan=stereo|FL=FL+0.45*FC|FR=FR+0.45*FC,\
speechnorm=p=0.9:e=2-3:c=2,acompressor=threshold=-18dB:ratio=2-3:attack=12:release=120:makeup=1-2" \
  -c:a aac -b:a 192k output-denoised.mp4
```

For audio-only voiceover files, write the repaired file back under the job's
`audio/` directory, for example `audio/voiceover-denoised.mp3`, update
`video-plan.json` to point at it, then rerun timing audit. If the repair is a
post-render remux, keep the video stream copied with `-c:v copy`.

Do not over-process. If the voice becomes metallic, watery, or muffled, reduce
`afftdn.nr`, lower `dialoguenhance.enhance`, or remove one EQ stage.

## BGM

- BGM is optional.
- Keep BGM volume low under narration.
- Default to `0.08-0.15` for background music volume.
- Duck or reduce BGM when voiceover is present.
- Avoid BGM that competes with spoken Chinese.

## Diagnostics

- Use FFmpeg or media tooling to inspect duration, codec, and stream presence.
- Run the audio quality gate before final render when voiceover comes from a phone recording, meeting room, screen recording, or user-provided file.
- Run `scripts/audit-timing.mjs <video-plan.json>` before and after TTS.
- Check that the rendered video has audio when `audio.voiceover` is set.
- If the video ends before audio, fix `durationSeconds`.
- If captions drift, retime from audio again instead of manually nudging a few captions.

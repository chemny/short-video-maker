# Media Diagnostics Rules

Use these rules to validate audio, video, GIF, image, and remote media before rendering.

## What To Check

- Audio duration.
- Audio quality: obvious echo, reverb tail, hiss, hum, clipping, broadband noise, and speech intelligibility.
- Video duration.
- Video width and height.
- Whether browser/server rendering can decode the media.
- Whether remote media has CORS and stable availability.
- Whether the file exists and is non-empty.

## Tooling

- Use FFmpeg or `ffprobe` for local diagnostics and CI-friendly checks.
- Use Mediabunny-style metadata APIs when working inside browser-compatible Remotion utilities.
- Prefer deterministic local checks before a full render.

## Audio Duration

- Voiceover duration should update `meta.durationSeconds`.
- BGM can be looped or trimmed, but should not define the master timeline.
- If audio duration differs from plan duration, retime the plan.

## Audio Quality Lock

For any imported narration or user-provided recording, add a quality lock before
final render. The lock should be treated like missing assets or bad timing: if
it fails, fix the audio before packaging the video.

Fail the lock when any of these are clearly present:

- strong room echo or a long reverb tail after each phrase;
- steady hiss, hum, fan noise, or broadband room noise;
- clipping or harsh peaks;
- speech that becomes hard to understand on phone speakers.

When the lock fails:

- Prefer a light FFmpeg repair pass first: high-pass, low-pass, `afftdn`,
  mild EQ, `dialoguenhance`, `speechnorm`, and compression.
- Keep video copied with `-c:v copy` when only repairing a rendered video's
  audio.
- Keep the final audio as AAC stereo for platform compatibility.
- If the repair changes voiceover duration, update `meta.durationSeconds`,
  captions, and scene timing from the repaired audio.
- Save the repaired file with a clear suffix such as `-denoised` or
  `-降噪版`; do not overwrite the raw source unless the user explicitly asks.

Do not claim echo is fully removed unless it is actually gone. Room reverb can
usually be reduced and masked, not perfectly erased.

## Video Dimensions And Duration

- Check source clip dimensions before using them in 9:16 output.
- Do not stretch clips with mismatched aspect ratios.
- Use clip duration to avoid cutting off important visual content.
- Trim or loop clips deliberately.

## Decode Compatibility

- Check that video assets can be decoded before rendering.
- Re-encode incompatible files with FFmpeg.
- Prefer H.264/AAC MP4 for broad compatibility.
- Keep final platform output in a format accepted by Xiaohongshu and Douyin.

## Frame Extraction

- Extract frames when generating thumbnails, filmstrips, or cover candidates from a rendered video.
- Use exact timestamps in seconds.
- Confirm extracted frames are not black, blank, or between-transition frames.

## Publish Checks

- Generated media must stay out of the repository unless intentionally included as examples.
- Any diagnostic files should be written under ignored output folders.

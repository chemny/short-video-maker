# Complete preview and scene caches

Use an existing approved script and assets. For an already verified narration track:

```sh
node scripts/run-job.mjs /absolute/job --tts=none --preview-video
# After reviewing the complete low-resolution video:
node scripts/run-job.mjs /absolute/job --tts=none --render --confirmed-render
```

Omit `--tts=none` when synthesizing or changing narration. Normal TTS selection and strict alignment still apply. Preview-only runs preserve `output/` and do not archive or replace the HD delivery. They write a full-duration MP4 under `preview/complete/<identity>/video.mp4` plus a report and `preview/complete/latest.json`. Scale is normally 0.25 (0.5 or 1 for custom dimensions that cannot produce even pixel sizes at a smaller scale); FPS, scene/caption timings, cover and final PCM/AAC export workflow are the same as the delivery. Low resolution is for pacing, content and listening; final layout still needs measured HD checks.

A confirmed full render automatically creates or reuses this preview first. It continues to HD in the same authorized batch: producing a preview does not imply a human approved it. Use the two commands separately when an actual review checkpoint is needed. Preview reuse requires matching plan, referenced local asset bytes, renderer source and verified video hash. Changing text, timing, aspect, assets in place or renderer code invalidates it. Failed/incomplete previews have no successful reuse report.

VoxCPM2 now stores a WAV and generation evidence per scene under `audio/.tts-cache/voxcpm2/scene-*`. Keys include text, seed, steps, model revision and generation runtime fingerprint; scene order is excluded. A one-scene edit synthesizes only that scene. Reordering reuses audio and reassembles the whole narration. Audio hashes are checked before reuse; corrupt cache files block rather than silently replacing evidence. Older aggregate caches are retained, but are not automatically split or relabeled as verified scene caches. A first run of an old job can therefore regenerate narration. Cloud providers retain their existing segment caches.

Local VoxCPM2 ASR also caches each scene independently in `alignment/scene-transcripts/`, bound to actual audio, model, language and transcriber hashes. Decoded scene PCM must concatenate exactly to the assembled narration before observations are combined. Offsets come from measured audio durations; caption times still require strict approved-text matching. Changing one scene reuses unchanged scene observations. Changing the ASR model invalidates all observations for that model. Explicit supplied transcripts retain their own audio binding. New scene context can change recognition quality; uncertain text still blocks and requires review.

This is audio/ASR caching plus complete-preview reuse. The final HD video is still rendered as a whole; independently cached video-scene encodes and automatic cross-job asset-library retrieval are not implemented. Existing downloaded assets remain in the job.

For acoustic corrections, inspect the normalized audible track, not only raw TTS: normalization can make quiet initial syllables audible. Do not trim onset based on a high silence threshold or delete every long pause. Preserve deliberate demonstrations, avoid altering voiced samples, and retain original ASR evidence with a separate edit map. A zero export offset verifies transmission against the master, not perfect caption/phoneme alignment or natural prosody.

默认字幕声学校正、异常停顿处理与演示留白保护现已接入统一入口，见 [默认声学修复](default-acoustic-timing.md)。

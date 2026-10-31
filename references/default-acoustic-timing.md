# Default caption and pause repair

`run-job.mjs` and `tts.mjs generate` now call the same `scripts/lib/acoustic-timing.mjs` module by default for text-bound TTS narration. No extra repair flag or sample script is required. The runner also checks already generated TTS when `--tts=none` is used: caption and silent-interval edits remain available, but an explicit TTS disable never makes a new synthesis request. A phrase requiring resynthesis then blocks for review. The pass runs before the final voice/BGM mix, complete preview and HD rendering. Repeated checks of the same audio/timeline reuse verified evidence rather than applying cuts twice.

The actual sequence is approved text → synthesis → strict ASR/provider matching → isolated normalized voice acoustic repair → final voice/BGM preparation → complete low-resolution preview → measured HD layout → render → PCM/AAC mux → waveform and production evidence checks.

## What happens automatically

- Prepare an isolated copy of narration using the same cleanup, gain, normalization and latency-corrected limiter functions as delivery. This includes the same stereo PCM channel conversion; music is excluded. Background music cannot hide silent onsets; quiet initial syllables are not discarded based on raw TTS volume.
- If a caption starts at least 180ms before the end of measured -50dB silence (20ms guard for export differences, final AAC limit 200ms), move its start to 30ms before audible onset, provided a nonempty cue remains. For caption-onset judgment only, isolated transients of up to 4ms between silence intervals are bridged; these bridges are never used to delete audio. This is conservative silence correction, not phoneme forced alignment.
- A measured silence of at least 1s at a verified between-caption punctuation boundary is shortened to about .75s. Only the silent middle is removed; voiced samples remain intact. Following captions, scenes and source-video bindings are remapped together.
- A measured interruption of at least .35s strictly inside a punctuation-free approved phrase is a resynthesis candidate. Regenerate the complete caption with its existing provider/voice and require actual ASR/provider word observations to match unchanged approved text. Add a sentence-tail pause as needed, match local RMS, and retime downstream cues. No guessed words, raised confidence or proportional subtitle fallback.
- A verified candidate that still contains the detected problem, changes pacing excessively or fails text/timing checks blocks the operation with `needs-review`. The accepted acoustic-input plan, alignment, original audio and prior delivery are retained. Ambiguous pauses in punctuated text remain for listening review; the module cannot certify all semantic phrasing or intonation.

## Protect demonstrations and intentional pauses

All real video scenes are automatically protected, including their outgoing 12-frame transition when applicable. A silence intersecting a protected window is retained in full. For other intentional holds:

```json
{
  "id": "demo",
  "preservePauses": true,
  "pausePreservationReason": "Wait until all three imports finish",
  "minimumDurationSeconds": 4.45
}
```

Before fresh TTS retimes a scene, an explicit `preservePauses:true` captures its planned duration as `minimumDurationSeconds` if none is supplied. If speech becomes shorter, silent PCM is inserted at the scene boundary to maintain that demonstration window. The spoken caption is not stretched across the inserted hold; subsequent scenes/cues move together. A source clip still must be long enough—no automatic freeze/loop.

Specific actual narration content-time windows can also be protected. Use scene markers for a tentative storyboard before fresh synthesis:

```json
{"audio":{"timingRepair":{"preserveWindows":[{"start":43.5,"end":48.3,"reason":"Complete the demonstrated action"}]}}}
```

Set protection before synthesis/repair. Existing imported/provided narration is audit-only by default, preserving the user's audio and caption timings. An explicit `audio.timingRepair.enabled:false` requests audit-only behavior for TTS too; output never claims that repair was applied.

## Evidence and local recognition

The job keeps `alignment/acoustic-timing-report.json`, the original accepted alignment snapshot, input/output audio hashes, measured silences, edits and preservation windows, verified phrase candidates/real words, and a plan/timing binding. Canonical `audio.acousticTiming` binds the current report hash. Production/QC checks reject missing, stale or modified current/original evidence. Prior narration is immutable; candidates are committed after checks, and final evidence commit attempts restore prior canonical files on failure. A failed candidate may remain as diagnostic data.

Local ASR defaults to existing small/base Whisper. If scene decoding loses context and fails strict matching, the actual complete narration is independently transcribed once with the selected model; scene/full caches are separate. Only an exact observed match proceeds, and both passes remain as evidence. An already installed MLX Whisper directory can be selected with `SHORT_VIDEO_MLX_WHISPER_MODEL` and its Python with `SHORT_VIDEO_MLX_PYTHON`; explicit ASR model selection wins. Personal machine preferences live in `~/.cmm/short-video-maker-local.env`, outside the distributable Skill, and do not include credentials. No models or packages are automatically downloaded. Cloud word observations retain their original evidence and receive an explicit acoustic edit chain; macOS synthesis segment duration is never relabeled as independent word recognition.

Final delivery QC independently checks the encoded AAC for remaining caption leads of at least 200ms when narration is unmasked. With music/native audio it retains the isolated-voice evidence and master waveform verification instead of claiming to detect isolated speech in a mix.

Use the complete preview to review meaning, stress and voice continuity. Technical checks and zero export offset do not replace human listening.

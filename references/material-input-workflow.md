# Local materials: phase-1 consolidation

One job, one canonical plan, one renderer. This route migrates useful Auto Video Maker media intake and audio processing, without its image cycling, title guessing, silence-to-sentence guessing, or generated second Remotion project.

## 1. Inventory without changing inputs

```bash
node scripts/scan-assets.mjs /path/to/materials --out=/path/to/job/manifest.json
```

The manifest records images, videos, audio and text, dimensions, duration, streams, and filename-based **suggestions**. It skips symlinks, hidden paths and dependency folders. Probe failures are recorded; invalid files are not silently treated as usable. Read/inspect the materials before planning. Do not interpret a long audio file as proven speech. Multiple candidates need an explicit selection.

## 2. Author the canonical plan

Use `examples/material-plan.json` as a structural example, not a usable timing source. Replace its content, timings, dimensions and publication fields for the actual job. The job must be separate from the original material folder. Keep all originals unchanged.

- Preserve the approved script. Plan what each scene explains, then select a relevant image by scene id.
- Obtain actual sentence/cue timings from supplied subtitles, manual review, or the upgraded `align-narration.mjs` route described in `researched-production.md`. Populate `captions` and `scenes` before import. Matching the same narration hash preserves an existing ASR timing marker; a changed narration downgrades it to supplied timing until realignment.
- The plan content duration must match the narration within 0.15 seconds. Import never stretches the timeline to fit.
- Source video can supply narration/music. For moving scenes, use `import-clips.mjs` with an explicit sourceStart rather than passing an MP4 as an image.
- Missing relevant imagery is a planning gap; don't rotate arbitrary pictures to fill the timeline. Authored text/diagram scenes remain valid.

For selected image assets, create `scene-map.json` (paths relative to the materials folder, or absolute):

```json
{"scene-01": "product-screen.png", "scene-02": "diagram.png"}
```

## 3. Import and configure audio

```bash
node scripts/import-media.mjs /path/to/job \
  --input-dir=/path/to/materials \
  --narration=voiceover.m4a --music=music.mp4 \
  --scene-map=/path/to/scene-map.json
```

Omit explicit narration/music only when a single clearly named candidate exists. Use `--music=none` to intentionally exclude music. Text files are inventoried, never automatically picked as the script. An existing canonical plan and its timed captions are required. Paths and all selections are checked before the plan is updated. Re-import replaces the **audio selection**; optional audio settings can be reapplied using the flags/plan fields below. Unmapped scenes retain their authored visual configuration.

Original media is copied into content-addressed job paths. `audio.sourceMode="imported"` protects it from accidental TTS replacement. The provided timings are retained; `timingSource="provided"` describes provenance, **not** independent proof of correct alignment.

Optional `--clean=light` enables light filtering/denoising/compression. Optional `--normalize` enables loudness normalization. Both are off by default; don't process already clean audio unnecessarily. Plan controls:

```json
{
  "audio": {
    "sourceMode": "imported",
    "timingSource": "provided",
    "voiceover": "audio/source/voiceover-HASH.m4a",
    "sourceVoiceover": "audio/source/voiceover-HASH.m4a",
    "bgm": "audio/source/music-HASH.mp4",
    "sourceBgm": "audio/source/music-HASH.mp4",
    "voiceVolume": 1,
    "bgmVolume": 0.12,
    "duckBgm": true,
    "processing": {"cleanup": "none", "normalize": false}
  }
}
```

`prepare-audio.mjs` extracts audio streams, loops/fades BGM, optionally ducks music under voice, and applies limiting. It keeps the original track references, writes a fingerprinted `audio/prepared/mix-*.m4a`, and records `audio/processing-report.json`. It refuses processing that changes duration beyond the tolerance. The renderer uses `audio.mix` alone, so mixed BGM and voice are not doubled. It can also prepare existing TTS plans.

## 4. Preview/render through the shared workflow

```bash
node scripts/run-job.mjs /path/to/job --preview-frame=30
# Only after full-render authorization:
node scripts/run-job.mjs /path/to/job --render --confirmed-render
```

Imported audio defaults to no TTS; explicitly requesting a TTS provider on that job fails. New generated-narration jobs auto-select VoxCPM2 with ASR when available, otherwise Edge with provider word-time matching; Volcengine is explicitly selectable. `--tts=local` means macOS `say` synthesis, not audio import. `--tts=none` supports already prepared canonical jobs. Final narrated exports use the PCM timeline and waveform verification described in `default-voice-pipeline.md`.

The runner reads the job's plan directly and passes explicit props/public directory to the **same** Remotion source/dependency installation. It does not replace shared media directories or generate another project. Root metadata follows the passed plan. A missing legacy Studio default-plan JSON is bootstrapped once for bundling; existing defaults are not replaced. To preview this job in Studio, pass the generated `output/render-props.json` via `--props` and the job via `--public-dir`.

Prior output folders move into the job's `history/`, preserving old deliveries and avoiding stale-video claims. Do not run two processes against the same job directory concurrently. `output/delivery-status.json` distinguishes preparation from a newly completed render. Rendering checks dimensions, FPS, audio-stream presence and duration, then measures black intervals, volume and silence and generates a full-duration contact sheet. Asset needs are generated during packaging and QC. See `delivery-checks.md` for report semantics and review limits; speech alignment and semantic/subjective quality are not automatically proven.

Deliverables: `output/video.mp4` and `cover.png` after render, plus `script.md`, `publish.md`, `metadata.json`, `video-plan.json`, `captions.json`, `captions.srt`, and the audio processing report. Job-level `captions/` uses content time; output subtitles include the frame-rounded cover-intro offset to match the delivered MP4. The full job retains source copies and the manifest for reproducibility.

## Migration boundary

Retain historical Auto jobs. `migrate-auto-job.mjs` explicitly converts a legacy still-image plan and its existing timings into a new canonical job; see `delivery-checks.md`. It does not guess new alignment. Auto may be archived outside discovery roots after authorized real-project validation; the new route has no runtime dependency on it. New jobs use the unified schema. Material intake/audio processing originated in `chemny/auto-video-maker` (MIT, copyright 2026 chemny); the original license and repository are retained.

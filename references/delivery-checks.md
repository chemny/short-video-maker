# Delivery diagnostics and legacy conversion

## Automated artifacts

`package-output.mjs` and `quality-check.mjs` write `assets-needed.md` and `assets-needed.json`. Explicit image layouts, prompted images and referenced assets are checked for missing selections, unreadable/non-image files, unverified remote URLs, and significant upscaling (over 1.25× for cover-fit, or contain-fit on bare images). Text/diagram cards do not require stock filler. A resolved rerun replaces stale requests. The prompts describe the authored scene intent; no images are silently downloaded or generated. This check cannot determine semantic relevance.

With a delivered `video.mp4`, `quality-check.mjs <plan> <output-dir> --require-render` also writes:

- `quality-report.json`: pass/fail, errors/warnings, full probe metadata, black intervals, mean/peak volume, silence intervals, asset requests and explicit review limits.
- `contact-sheet.jpg`: 12 evenly sampled frames across the **whole** film, 4 columns × 3 rows. Read left to right, top to bottom. Sampling is not full-frame inspection.

FPS, dimensions, audio-stream presence and duration must match the plan. Almost entirely black or effectively silent deliveries fail. Black intervals, low volume, near-full-scale peaks and long silence are review warnings because dark designs and intentional pauses can trigger them. Detector errors/timeouts fail instead of producing a false pass. `SHORT_VIDEO_QC_TIMEOUT_MS` controls each diagnostic command (default 300000 ms).

Without a render, the report says `prepared-only`; the runner never marks that job as rendered. `passed-technical-checks` is not speech-alignment, semantic-relevance, or subjective sound-quality approval. Check the contact sheet and review relevant warnings; listening/playback remains necessary when assessing those qualities.

## Existing Auto jobs

```bash
node scripts/migrate-auto-job.mjs /path/to/old-job /path/to/new-job \
  --accept-existing-timing
node scripts/run-job.mjs /path/to/new-job --render --confirmed-render
```

Use this only for a legacy still-image job with existing timed captions and narration. The destination must be new and outside the original job. Override unavailable narration/music paths with `--narration=<file>` / `--music=<file>`; `--music=none` explicitly drops music. Audio is copied from the separate narration/music tracks, not the already mixed final output. Originals remain untouched; no dependency on the Auto directory, its Python script, or its renderer remains.

`migration-report.json` records old plan hash, source paths, old warnings and each scene boundary adjustment. Legacy scenes overlap; conversion flattens each ending to the next scene's start, retaining the same scene takeover times but not pixel-identical crossfades. Caption text/times remain unchanged. This is format conversion, **not** a new alignment or proof the old captions are accurate. Do not use this route to invent timings for a raw folder.

`meta.speaker` retains the speaker. `cover.overlaySeconds` optionally shows title/speaker **over the existing content timeline**, useful when a recording begins with a spoken title/credit. It does not delay narration or subtitles. `cover.introSeconds` instead prepends the normal title card. For legacy recitation conversion, intro is zero and the overlay lasts until the first existing caption; review that choice for other content types. `cover.subtitle` carries the speaker credit on the exported cover.

## Retirement boundary

Current local state: the Auto entry is retired and its local archive was subsequently deleted by explicit user request. Historical jobs and the remote repository remain. The converter only reads historical job inputs; it never imports the removed skill's code. The following archive guidance describes a recoverable retirement process, not an instruction to restore the deleted skill.

Once a real legacy job passes the replacement check, archive Auto outside all skill discovery roots. Retain its `.git`, license, scripts and documentation plus external historical jobs. A shared skills-root symlink means removing the active directory also removes that view's entry; do not remove the shared root. Do not create a forwarding Auto SKILL or restore it to other agent directories. Archived code is for recovery only. Automatic alignment, native video scenes and official-site media research remain separate future work; discarded length/text guesses and picture cycling are not restored.

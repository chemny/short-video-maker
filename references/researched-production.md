# Researched video production

The active agent owns research, writing, storyboarding and quality judgment. The CLIs make that work traceable and renderable; a topic alone is not converted into a fabricated script by a local template.

## Article/link/topic intake

1. Create a fresh job with `node scripts/init-report.mjs <job> article|product|daily --topic=<topic>`. Daily reports require `--date=YYYY-MM-DD` in the user's editorial timezone. Read a linked article in full; distinguish what it reports from what primary sources establish.
2. For a topic, use the available web search tool to identify the product/company/project's official domain. Search official documentation, announcements, changelogs, demo/video pages and press/media kits. Confirm domain identity; do not label a source official just because it mentions the product. Check event date separately from page publication date. Do not invoke another skill or install one just to perform a web search.
3. Save each useful public HTML source with `research-sources.mjs <job> --official-domains=example.com --url=https://example.com/...` (repeat URL flags). This records immutable HTML/text revisions, source IDs, fetch time, related official links and image/video/embed candidates. Read the text snapshots. A 403, login, JS-only page, PDF or unavailable source remains an explicit gap: use an appropriate existing browser/PDF tool if available and authorized, or record the missing evidence. Do not bypass access controls or replace a blocked official source with unrelated stock imagery.
4. Discover official demo clips from the candidate/related links and review relevance. `download-source-media.mjs <job> <requests.json>` downloads explicitly selected direct PNG/JPEG/WebP/MP4/WebM files (up to 150 MiB each), probes them and records hashes. Every request needs `sourceId`, `mediaId`, `allowedDomains` (including official CDN host), `relevanceReason`, and a meaningful `rightsNote`. Candidate visibility is not reuse permission. Embedded players are inventoried, not downloaded as if they were videos. Use another existing authorized interface for those, or record the gap.

   For a faithful screenshot of a registered official page, use `capture-source-page.mjs <job> <source-id> --reason=<purpose> --rights-note=<note>`. It uses an existing Chrome executable in an isolated temporary profile, captures a 1440×1000 viewport and records page/snapshot/hash provenance. It never reuses personal cookies. Inspect for error/login/blank pages before selecting; this is a page screenshot, not extraction of an embedded official demo video. No Chrome is installed automatically.

   A selected direct MP4/WebM request may specify `clip:{start:10,duration:4}` to fetch/transcode only that source interval through FFmpeg (up to 60s per request). It records the original source interval and verifies the resulting duration, rather than downloading an entire large demo. The downloaded local clip begins at zero: set the subsequent scene sourceStart relative to the selected clip. HTML players/HLS playlists are not treated as direct files; source audio remains available but scene sound still defaults to muted.
5. In `research/claims.json`, author `{claims:[{id,text,sourceId,evidenceQuote,reviewed:true}]}`. The quote must occur in the saved source text. Only set reviewed after checking that the source supports the claim; the validator can check quote presence, not semantic entailment. Keep quotes minimal. Record time-sensitive dates/qualifiers in claim text and script. Distinguish official claims from independently established facts and your inference.
6. Write an original, concise script, preserving already approved wording. Save approval/context in `approved-script.md`. Build a canonical plan with `meta.productionMode="researched"`, `meta.reportType="product"|"article"|"daily"` and `style.template="responsive-report"`. Each scene has `evidence:{claimIds:[...],sourceIds:[...],visualReason:"what this view explains"}`. Match a feature to its actual demo/screenshot; a mechanism to a diagram; a limitation to a clearly labelled card. Authored diagrams/text cards are valid when official imagery is absent. Do not use random footage or cycle images to pad a timeline.

## Narration and real timestamps

`node scripts/align-narration.mjs <plan> --audio=<recording> [--model=/path/local.pt] [--language=zh]` transcribes locally with installed Python Whisper and an existing model. It never downloads models during normal execution. A precomputed matching Whisper JSON can be supplied with `--transcript=...`; its audio SHA256 must match. Word start/end and probability fields are required.

The agent inspects `alignment/alignment-report.json`. Approved caption words are matched monotonically to observed ASR word boundaries. Missing/misread text, extra/repeated speech, low confidence, overlapping/shared words or scene-mapping gaps block `--apply`. No character-duration or silence-count fallback runs. Exact matching is conservative; homophones, Traditional/Simplified differences and noisy recordings may require review or a more accurate local model. A report is **ASR-based matching**, not acoustic forced alignment and not proof of human-verified sync.

Chinese matching uses OpenCC t2s normalization on both recognized and approved matching inputs, while preserving original display text. Homophones are not silently equated. Optional Python dependencies are listed in `requirements-asr.txt`; the current host keeps OpenCC in `~/.local/share/short-video-maker/python`, separate from system packages. The transcriber requires installed Whisper and an existing local model; `SHORT_VIDEO_WHISPER_MODEL` or `--model` selects one. No normal runtime command installs packages or downloads a model.

Use `scene.captionIds` to partition the captions in order, or make each scene's voiceover exactly match its ordered caption text. Only after a clean report, run again with `--apply` to copy/protect narration, update caption/scene timings, retain a before-plan backup and mark `audio.timingSource="asr-matched"`. Declared spoken title/credits must also appear as approved captions or be handled in a separate, explicitly authored timeline; never silently ignore extra speech. Timing evidence is checked against current audio, caption text and timings before render. Replacing TTS invalidates the evidence by removing the timing marker.

For an already configured job, `run-job.mjs <job> --align [--asr-model=/local/model.pt] --render --confirmed-render` adds the same conservative alignment step after optional TTS and before packaging/rendering. Uncertain alignment stops the run with its report. Model/language/audio identity is part of the transcript cache key. A local model is required; no model is downloaded by the normal runner.

## Selected native clips

Create `clip-map.json` keyed by scene ID:

```json
{"scene-02":{"file":"/path/official-demo.mp4","sourceStart":3.2,"sourceVolume":0,"fit":"contain","focalPoint":{"x":0.5,"y":0.5}}}
```

Run `node scripts/import-clips.mjs <plan> <clip-map.json>`. Original clips are copied into the job, default to muted and hard cuts, and use the shared renderer. No implicit loop/freeze/speed change fills short media. Out-of-range selections fail. `sourceVolume` 0..1 explicitly controls source sound; avoid competing speech. `contain` preserves the full frame; `cover` uses a reviewed focal point. Native clip scenes use the responsive media layout even in an older template.

## Aspect and review

The responsive-report template reflows horizontally (text beside media) and vertically (text above media), with scaled fonts, safe margins, original aspect fit and caption area. Older decorative templates are retained; they are not all retroactively redesigned. Use `adapt-aspect.mjs <plan> <new-job> 9:16|3:4|16:9` to create an independent, self-contained variant using responsive-report. It never overwrites the original and does not copy old delivery/review approvals. Review each chosen aspect at full target size, including small text, long titles, crop focus and platform margins. The safety profiles are conservative heuristics, not platform/version guarantees.

Run `audit-production.mjs <plan>` before render. The shared runner also does this automatically. It verifies contiguous scenes, caption ranges, clip source windows, ASR evidence freshness, claim/source references and quote snapshots for researched jobs. A production failure blocks rendering. After render, the output retains the reports/provenance alongside subtitles and video.

Automated technical checks cannot listen or judge facts/visual meaning. To mark editorial review, create `editorial-review.json` **after** reviewing the final prepared plan/render:

```json
{"planSha256":"from quality-report.json production.checks.editorial.planSha256","videoSha256":"from quality-report.json production.checks.editorial.videoSha256","reviewer":"actual reviewer identity","notes":"what was watched/listened to, issues resolved and accepted tail","checks":{"narrationIntelligible":true,"captionSync":true,"visualRelevance":true,"layoutReadable":true,"tailIntentional":true}}
```

Do not create a passing review just to satisfy a gate. Missing/false/stale checks remain `review-required`. `quality-check.mjs <plan> <output> --require-render --require-content-review` refuses final acceptance until the record matches the current plan. Normal rendering can still produce a review candidate and clearly reports the outstanding editorial review.

## Incremental edits

Keep one canonical plan per variant. Reuse unchanged local audio/media/transcript caches; adjust only affected claims/scenes/assets. Changing the audio or approved caption text invalidates ASR evidence; changing the plan invalidates editorial review. Re-fetching a source preserves old revision snapshots, and changed quotes must be reviewed. A new full render archives prior deliveries under history. Do not silently reuse an old MP4 after changing a scene. Partial *planning* updates are supported; this workflow does not claim to splice-render only a few Remotion frames into an old MP4.

## Default narration pipeline

The runner now selects VoxCPM2 with local ASR when its environment is complete, otherwise Edge with synthesis-word matching; all three supported providers share verified PCM audio export; see `default-voice-pipeline.md`. Explicit `--align` remains useful for imported/alternate-provider audio. An incomplete local setup selects Edge before synthesis. Explicit provider failures and uncertain timing block that choice; no silent runtime failover or estimated subtitle timing is used.

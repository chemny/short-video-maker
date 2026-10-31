# Sentence-directed video production

## Baseline and order

New narrated jobs and intentional remakes set `meta.editorialWorkflow="sentence-v1"`. Start with the exact approved script, audio and pronunciation/voice choice. Record local source paths and SHA256 in `baseline.json`. A revision sharing the topic is not automatically the approved baseline. Imported audio stays protected; use it once, mute sourced videos by default, and retain the accepted caption timing. Do not synthesize a new voice to solve a visual edit. Historical news remakes reuse dated evidence and disclose the original date rather than imply fresh reporting.

Author `sentence-storyboard.json` from the actual timed captions before component selection. One row per caption phrase, in plan order, with exact `captionId`, `sceneId`, `text`, `start`, `end`; `shotId` points to a declared contiguous visual shot. Each row supplies concrete `shows`, `change`, `reason`, and `screenText` (the approved narration stays separate). Continuous footage is a valid sentence-level decision: describe the relevant playback, not a gratuitous cut on every clause. Distinguish facts, historic context, quotation and opinion. Never require a separate random material for every sentence.

Shots cover the full scene timeline without gaps/overlap, and declare `kind`, `asset`, source interval, fit and factual role when using media. Source intervals must be long enough, job-local, aspect-preserving and not reused without a reviewed reason. Every row must lie within its shot. Any script/audio/timing change invalidates the storyboard fingerprint. Agent reviews actual source frames for relevance; the validator only checks the structure.

Schema: `{schemaVersion:1, timelineSha256, typography:{width,height,title,body,caption,source,referenceWidth:390}, shots:[{id,start,end,kind,asset?,sourceStart?,sourceVolume?,fit?,reuseReason?}], rows:[{captionId,sceneId,text,start,end,shotId,shows,change,reason,screenText}]}`. Supported kinds: video, image, diagram, quote, comparison, takeaway. `timelineSha256` is calculated by `sentenceTimelineHash` in `scripts/lib/sentence-storyboard.mjs`. It binds the narration identity/configuration, canonical captions and scene intervals, not derived graphic choices.

## Layout and typography

Compose separately for each aspect; do not just scale vertical into horizontal. On 1080-wide portrait output, start with title 60–76px, body 42–54px, subtitles 44–50px, source 28–32px. These are starting ranges, not proof of readability. At 390px phone width, critical text should remain about 15px or larger, subtitle about16px, source about10px. Title generally no more than two short lines, source no more than two; do not shrink long paragraphs until they fit. Critical media must be large enough to inspect; crop only a reviewed source region, never stretch the image. Use concise authored extracts for screenshot text that cannot remain readable.

Reserve independent title/content/source/subtitle/platform zones. Keep primary material visually dominant. Check at full composition size and a390px-wide still for the actual target; actual device readability overrides token compliance. Do not claim other aspects accepted unless separately composed and inspected. Content must be present during the sentence: show comparison structure early and emphasize at the correct spoken phrase instead of leaving a blank panel.

## Motion and acceptance

Every motion explains a relationship, directs focus or introduces the next shot. Use real caption anchors for switches/highlights, continuity for real footage, and restrained transitions at semantic boundaries. Do not distribute animations by item index or fixed arbitrary seconds. Keep motion out of subtitle reading space. Preserve demonstration pauses and never loop short footage to fill speech.

Before full encoding, inspect scene entrances/middles/exits, every caption midpoint, transition boundaries and390px phone stills, using actual measured DOM rectangles and font sizes. Check text clipping, vertical overflow, source readability, media geometry, blank stages and image-content relevance. Automated structural/geometry checks do not establish aesthetic or listening acceptance. Deliver a full preview marked awaiting user review. Never enable an unapproved visual system globally merely because tests passed.

The component registry remains available, default auto-application disabled. A job-local Remotion composition can implement authored shots and consume this same storyboard. Keep it reproducible, preserve licensed component attribution, run composition-specific checks and the shared PCM audio finalizer. Workbench UI remains out of scope.

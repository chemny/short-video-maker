# P0 production gates

Use `meta.productionVersion="p0-v1"` on new researched jobs. New narrated work also follows `sentence-directed-production.md` and sets `meta.editorialWorkflow="sentence-v1"`. Choose the layout after directing, with `responsive-report` or a job-local measured Remotion composition. Legacy jobs remain renderable without relabeling old evidence as new acceptance.

## Official research closure

The agent identifies official domains, reads the source and chooses useful claims; no crawler can establish semantic truth or copyright permission. `research-sources.mjs <job> --official-domains=example.com --url=https://example.com/release --follow=true --max-pages=6` optionally follows a bounded set of related documentation/demo/release pages. Inspect `research/coverage.md` for what was actually visited, candidates, read failures and incomplete acquisitions. A page count limit does not imply the whole site was searched.

The extractor inventories lazy images/srcset, native video, JSON-LD VideoObject, linked media and embedded players with nearby headings. Use explicit reviewed media requests with source/media IDs, allowed official/player/CDN domains, purpose and rights note. Native MP4/WebM/images use the existing download path. Embedded players additionally require `resolvePlayer:true` and an existing `yt-dlp` executable; metadata is resolved without cookies, user configuration or installation. Every resolved media host still needs approval in allowedDomains. A public player link does not prove the footage is owned by the website or licensed for reuse.

Public HLS VOD supports explicit <=60s intervals, validated playlist/segment domains, a <=150MiB acquisition bound, up to 120 segments and local decoding. Live, encrypted/DRM and byte-range streams remain unsupported gaps. Multi-track external audio is not assembled by this path; inspect actual source audio and keep scenes muted unless intentionally reviewed. HTTP failures are recorded in downloads/coverage; signed URL queries are omitted from failure summaries and resolved provenance. No blocked platform is bypassed. Prefer a relevant directly hosted official demonstration when the player media is unavailable. If no suitable official media exists, author a clearly labelled diagram rather than adding unrelated stock footage.

## Narration / visual map

Each P0 scene supplies `captionIds` and `visualBindings`, for example:

```json
{"visualBindings":[{"captionIds":["c1","c2"],"kind":"official-demo","shows":"The import operation in the official demo","reason":"These cues describe dragging files into the node editor","sourceStart":0,"sourceEnd":4}]}
```

Kinds: official-demo, official-image, authored-diagram, authored-card, user-media. Every caption must be covered exactly once, in order within its scene; no missing/cross-scene/repeated cues. Video binding intervals must match the actual selected playback position and narration duration. After changing narration/timings, review the selections and regenerate bindings; do not pad short clips with invisible loops or freezes. A binding describes the content that is actually visible, not merely the desired scene. Fact/diagram/interpretation statements should be distinguished in screen copy and the claim record.

`map-visuals.mjs <plan>` writes visual-map.md/json; the production audit enforces coverage. Mapping records and quote existence cannot prove semantic relevance. Inspect actual source frames and final selected shots.

## Browser-measured layout

`check-layout.mjs <plan>` renders full-resolution DOM layout at cover/start/tail, each scene's entrance/middle/last frame and its longest caption cue. Measurements cover scene content/text/media and caption geometry, readable font size, clipping, platform margins, subtitle/content overlap and accidental single-character last lines. Titles and ordinary captions use balanced wrapping; explicit artistic caption lines remain authored choices. Half-scale JPEGs are saved for inspection; the geometry is measured in composition coordinates. P0 rendering runs the check before encoding and quality-check rejects missing/stale/failed report hashes.

Supported template is responsive-report. Adapt with `adapt-aspect.mjs` to independent 1920×1080, 1080×1920 and 1080×1440 jobs. Review each aspect: avoid long dense prose, use short title/support text, keep real media readable and use contain unless a crop is intentionally reviewed. Captions wrap and never silently disappear behind ellipses. The validator blocks bad layouts; it does not shrink text indefinitely or rewrite approved text.

Sampling cannot inspect every animation frame, read tiny text embedded inside an image, or establish content/voice quality. Keep the actual visual and listening acceptance separate from technical check results. An automated pass must not create a fabricated editorial-review.json.

## Three complete regression examples

Use a product explanation with real official demonstrations, an article explanation with purpose-built diagrams, and a dated daily brief. Historical briefs must visibly state that they are historical, with their editorial date. Generate full narration and final MP4s for all three aspects (nine outputs); reuse identical narration without replacing its alignment evidence. Record technical results, measured geometry, source gaps, actual visual review and remaining listening review separately. Keep sample-specific topics and absolute runtime paths out of the reusable skill.

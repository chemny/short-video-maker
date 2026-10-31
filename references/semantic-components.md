> Current production policy: automatic component defaults are disabled after failed visual acceptance. Complete the sentence-directed storyboard first; use this registry only as an explicitly selected toolbox. Follow `sentence-directed-production.md`. Technical probe success is not visual approval.

# Semantic components (semantic-v1)

The production library is owned by this skill. It contains 20 parameterized component families and 32 declared variants; see `components/registry.json`. Atlas galleries are visual references, not runtime dependencies. Runtime code never reads an atlas/output directory, injects demo copy, downloads components, installs packages, or calls another Skill.

## Default and compatibility

New `init-report.mjs` briefs declare `renderDefaults` from `components/defaults.json`. When that default is enabled, the normal runner adopts `semantic-v1` only for a new brief's default `responsive-report` template. A different explicitly selected template, an old brief, or a plan without the marker keeps its existing rendering path.

- `style.componentSystem: "semantic-v1"` enables parameterized rendering.
- `style.componentSystem: "off"` preserves legacy rendering.
- `run-job.mjs JOB --components=auto|off` explicitly opts an existing job in/out.
- A semantic job saves an explicit `--engine` choice back to its plan, so compilation and delivery metadata identify the actual renderer.
- Components currently require Remotion. Hyperframes with the marker fails before synthesis; choose `--components=off` deliberately. No silent renderer fallback.

## Authoring

Narrative and sourcing come first. Use approved narration, primary-source evidence and actual relevant media; do not choose decorative components to compensate for missing footage.

1. Give each scene its own contiguous `captionIds` and, when useful, `contentShape`.
2. Only after the sentence storyboard is authored and semantic rendering is explicitly selected, leaving `visualComponent` absent uses conservative structural selection: actual media first, supplied metrics/comparisons next, explicit structural shape next, then a readable text fallback. No narration keyword classifier claims semantic understanding.
3. To select a specific structure, set `visualComponent.id`, `variant` and `props`. Missing facts block an explicit request; values, quotes, attributions and people are never invented.
4. For sequential emphasis, author cues referencing the actual caption where the corresponding idea is spoken. If that association is not known, show the whole group at one real caption onset. Do not mechanically map the nth item to the nth caption.
5. Keep one visual task per scene. Complex enhancements are opt-in, with a reason in the storyboard; do not apply them automatically to every scene. The registry is a menu, not a requirement to use everything.

Example (same authored idea, mutable timing):

```json
{
  "contentShape": "comparison",
  "visualComponent": {
    "id": "compare",
    "variant": "a",
    "props": {
      "columns": [
        {"title": "演示时", "body": "答对一道题"},
        {"title": "上线后", "body": "解决实际问题"}
      ]
    },
    "cues": [
      {"captionId": "example", "target": 0, "action": "reveal"},
      {"captionId": "deployment", "target": 1, "action": "reveal"}
    ]
  }
}
```

`action: "reveal"` keeps an item hidden until its anchor. `action: "focus"` keeps it visible from the scene start, then emphasizes the corresponding item/group when spoken. Use focus for comparison/summary scenes that would otherwise wait on an empty stage. `edge` is `start` (default) or `end`. Offsets are seconds inside the selected caption; cross-scene anchors, nonmonotonic events, and out-of-caption offsets are rejected. `displayStart`, when supplied, is honored by cues, visible captions and SRT. Canonical accepted ASR start/end/text stay unchanged. Holds, pauses and demonstration duration are not shortened to fit animation.

The compiler runs after TTS, alignment and acoustic repair, before layout/render. `componentRender` and `component-plan.json` are generated evidence. Edit authored props/cues, not generated values. Regeneration updates events from current captions and invalidates render caches. Direct rendering with stale source inputs blocks.

## Content contracts

Common props: `title` (optional override), `body`, and short `items`. Per-family inputs:

| Family | Inputs / constraints |
|---|---|
| evidence / media | scene.visual; b needs an authored normalized focus rectangle |
| demo | scene.visual; b needs focus + step items |
| compare | two `columns` with titles and optional body; never assume numbers from narration |
| flow / cards | `items`; dense lists (>3) require short items, measured layout still gates delivery |
| metric | numeric `metric` (a), or supplied `stats` (b) |
| chapter / takeaway | authored title/body/items; b changes the chapter/statement arrangement |
| identity | `person.name`, optional role and scene.visual portrait |
| quote | `quote` + `attribution`; reviewed source remains the author's responsibility |
| chart | `series` + equally sized `labels` (a), or positive `shares` (b) |
| montage | 2–3 `panels`; a is simultaneous, b needs distinct sequential caption anchors |
| camera | scene.visual + normalized `focus`; bounded crop, no guessed tracking |
| device | scene.visual; lightweight perspective, not a WebGL device model |
| kinetic | explicit `from`, `to`, and two chronological caption anchors |
| generation | authored `prompt` + result items; visibly a workflow illustration, not a real AI call |
| globe | supplied geographic `routes` with actual coordinates; no automatic map-data invention |
| race | supplied numeric series/labels plus distinct caption anchors for each time step |
| parallax | scene.visual; layered image treatment, no automatic human cutout |

All media are job-local. Video panels carry `sourceStart` and are muted; existing scene-level native sound keeps the shared PCM exporter. Extra audible panel tracks are not supported. Clip duration includes the selected window/transition; no looping/freezing. Reusing substantially overlapping source-video intervals requires a `visualReuseReason`.

## Validation and limits

- Input checks block unknown IDs, fields, bad data, media paths and ambiguous anchors before generation proceeds.
- Each enabled render/preview first runs browser-measured layout, including reserved caption/platform areas. Intentional camera/media cropping is explicitly marked; text clipping remains blocked.
- Preview identity includes plan/props/cues, local media content and renderer code. The final exporter retains waveform verification against the PCM master.
- New acoustic reports use a timing-only fingerprint so visual edits do not force voice regeneration. Existing legacy reports keep their strict compatibility check. For a materially edited old project, import its already approved narration into a new job and preserve its alignment evidence; do not relabel a stale report as passed.
- A technical pass does not prove source relevance, accurate quote interpretation or listening approval. Inspect per-scene/caption samples and the whole video. Keep technical reports out of on-screen copy.

## Workbench boundary

This release defines stable authored props and caption anchors suitable for a later layer editor. It does not ship a workbench, direct canvas manipulation, or arbitrary keyframes. Both future editing and rendering must use this same canonical plan.
